import {
	App,
	SuggestModal,
	Modal,
	Notice,
	Plugin,
	TFile,
	Setting,
	Platform,
} from "obsidian";
import {
	StructuredPaperData,
	fetchArxivPaperDataFromUrl,
	fetchSemanticScholarPaperDataFromUrl,
	searchSemanticScholar,
	fetchSemanticScholarPaperReferences,
} from "./paperData";
import {
	COMMAND_PAPER_NOTE_NAME,
	COMMAND_PAPER_NOTE_ID,
	COMMAND_SEARCH_PAPER,
	COMMAND_SEARCH_PAPER_NAME,
	COMMAND_PAPER_MODAL_TITLE,
	COMMAND_PAPER_MODAL_DESC,
	COMMAND_PAPER_MODAL_PLACEHOLDERS,
	COMMAND_SEARCH_PAPER_REFERENCES,
	COMMAND_SEARCH_PAPER_REFERENCES_NAME,
	COMMAND_COPY_PAPER_BIBTEX,
	COMMAND_COPY_PAPER_BIBTEX_NAME,
	COMMAND_REMOVE_PAPER,
	COMMAND_REMOVE_PAPER_NAME,
	COMMAND_OPEN_PDF_IN_SYSTEM_APP,
	COMMAND_OPEN_PDF_IN_SYSTEM_APP_NAME,
	NOTICE_RETRIEVING_ARXIV,
	NOTICE_RETRIEVING_S2,
	NOTICE_SEARCH_BIBTEX_NOT_FOUND,
	NOTICE_SEARCH_BIBTEX_ERROR,
	NOTICE_SEARCH_BIBTEX_COPIED,
	NOTICE_PAPER_NOTE_DOWNLOAD_ERROR,
	NOTICE_DOWNLOADING_S2,
} from "./constants";
import { isValidUrl, getSystemPathSeparator } from "./utility";
import {
	ObsidianScholarSettingTab,
	ObsidianScholarPluginSettings,
	DEFAULT_SETTINGS,
} from "./settingsTab";
import { ObsidianScholar } from "./obsidianScholar";
import { ObsidianScholarApi } from "./obsidianScholarApi";

// Main Plugin Entry Point
export default class ObsidianScholarPlugin extends Plugin {
	settings: ObsidianScholarPluginSettings;
	obsidianScholar: ObsidianScholar;

	get api(): ReturnType<typeof ObsidianScholarApi.GetApi> {
		return ObsidianScholarApi.GetApi(this.app, this, this.obsidianScholar);
	}

	async onload() {
		// console.log("Loading ObsidianScholar Plugin.");
		await this.loadSettings();

		this.obsidianScholar = new ObsidianScholar(
			this.app,
			this.settings,
			getSystemPathSeparator()
		);

		this.addCommand({
			id: COMMAND_PAPER_NOTE_ID,
			name: COMMAND_PAPER_NOTE_NAME,
			callback: () => {
				new createNoteFromUrlModal(
					this.app,
					this.settings,
					this.obsidianScholar
				).open();
			},
		});

		this.addCommand({
			id: COMMAND_SEARCH_PAPER,
			name: COMMAND_SEARCH_PAPER_NAME,
			callback: () => {
				new paperSearchModal(
					this.app,
					this.settings,
					this.obsidianScholar
				).open();
			},
		});

		this.addCommand({
			id: COMMAND_COPY_PAPER_BIBTEX,
			name: COMMAND_COPY_PAPER_BIBTEX_NAME,
			checkCallback: (checking: boolean) => {
				const currentFile = this.app.workspace.getActiveFile();

				if (
					!this.settings.saveBibTex ||
					!currentFile ||
					currentFile.extension !== "md" ||
					!this.obsidianScholar.isFileInNoteLocation(currentFile)
				) {
					// console.log("not valid path");
					return false;
				} else {
					if (!checking) {
						// console.log("copying bibtex");
						this.obsidianScholar
							.getPaperBibtex(currentFile)
							.then((bibtex) => {
								// console.log("got bibtex");
								if (!bibtex) {
									new Notice(NOTICE_SEARCH_BIBTEX_NOT_FOUND);
									return false;
								}
								navigator.clipboard.writeText(bibtex);
								new Notice(NOTICE_SEARCH_BIBTEX_COPIED);
							})
							.catch((err) => {
								console.log(err);
								new Notice(NOTICE_SEARCH_BIBTEX_ERROR);
							});
					}
					return true;
				}
			},
		});

		this.addCommand({
			id: COMMAND_SEARCH_PAPER_REFERENCES,
			name: COMMAND_SEARCH_PAPER_REFERENCES_NAME,
			checkCallback: (checking: boolean) => {
				const currentFile = this.app.workspace.getActiveFile();

				if (
					!currentFile ||
					currentFile.extension !== "md" ||
					!this.obsidianScholar.isFileInNoteLocation(currentFile)
				) {
					// console.log("not valid path");
					return false;
				} else {
					if (!checking) {
						let paperData =
							this.obsidianScholar.getPaperDataFromLocalFile(
								currentFile
							);

						if (paperData && paperData.url) {
							fetchSemanticScholarPaperReferences(
								paperData.url
							).then((references) => {
								new paperReferenceSearchModal(
									this.app,
									this.settings,
									this.obsidianScholar,
									references.map((reference, index) => {
										return {
											paper: reference,
											paperIndex: index,
											resultType: "semanticscholar",
											s2Url: reference.url,
										};
									}),
									"Check References for " + paperData.title
								).open();
							});
						}
					}
					return true;
				}
			},
		});

		this.addCommand({
			id: COMMAND_REMOVE_PAPER,
			name: COMMAND_REMOVE_PAPER_NAME,
			callback: () => {
				const currentFile = this.app.workspace.getActiveFile();

				new paperRemoveModal(
					this.app,
					this.settings,
					this.obsidianScholar,
					currentFile
				).open();
			},
		});

		this.addCommand({
			id: COMMAND_OPEN_PDF_IN_SYSTEM_APP,
			name: COMMAND_OPEN_PDF_IN_SYSTEM_APP_NAME,
			checkCallback: (checking: boolean) => {
				const currentFile = this.app.workspace.getActiveFile();

				if (!currentFile || !Platform.isMacOS) {
					return false;
				} else {
					if (!checking) {
						this.obsidianScholar.openPdfWithSystemViewer(
							currentFile
						);
					}
					return true;
				}
			},
		});

		this.addSettingTab(new ObsidianScholarSettingTab(this.app, this));

		// We want to be able to view bibtex files in obsidian
		this.registerExtensions(["bib"], "markdown");
		this.registerExtensions(["tex"], "markdown");

		this.addRibbonIcon('library-big', 'Open Scholar Library', () => {
			new paperSearchModal(
				this.app,
				this.settings,
				this.obsidianScholar
			).open();
		});

		this.addRibbonIcon('book-plus', 'Add to Scholar Library', () => {
			new createNoteFromUrlModal(
				this.app,
				this.settings,
				this.obsidianScholar
			).open();
		});
	}

	onunload() {}

	async loadSettings() {
		this.settings = Object.assign(
			{},
			DEFAULT_SETTINGS,
			await this.loadData()
		);
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}

type KeyListener = (event: KeyboardEvent) => void;

interface PaperSearchModelResult {
	paper: StructuredPaperData;
	resultType: "local" | "semanticscholar";
	paperIndex: number;
	localFilePath?: string;
	s2Url?: string;
	isFirstS2Result?: boolean;
}

// The Paper Search Modal
class paperSearchModal extends SuggestModal<PaperSearchModelResult> {
	private settings: ObsidianScholarPluginSettings;
	private obsidianScholar: ObsidianScholar;
	private keyListener: KeyListener;
	private lastSearchResults: PaperSearchModelResult[] = [];
	private localPaperData: PaperSearchModelResult[] = [];

	constructor(
		app: App,
		settings: ObsidianScholarPluginSettings,
		obsidianScholar: ObsidianScholar
	) {
		super(app);
		this.settings = settings;
		this.obsidianScholar = obsidianScholar;

		// Adding the instructions
		const instructions = [
			["↑↓", "to navigate"],
			["↵", "to open"],
			["shift ↵", "to search semanticscholar"],
			["⇥ (tab)", "to expand search result"],
			["esc", "to dismiss"],
		];

		const modalInstructionsHTML = this.modalEl.createEl("div", {
			cls: "prompt-instructions",
		});
		for (const instruction of instructions) {
			const modalInstructionHTML = modalInstructionsHTML.createDiv({
				cls: "prompt-instruction",
			});
			modalInstructionHTML.createSpan({
				cls: "prompt-instruction-command",
				text: instruction[0],
			});
			modalInstructionHTML.createSpan({ text: instruction[1] });
		}

		this.setPlaceholder("Enter paper Name");

		this.localPaperData = this.app.vault
			.getMarkdownFiles()
			.filter((file) => file.path.startsWith(this.settings.NoteLocation))
			.map((file, index) => {
				return {
					paper: this.obsidianScholar.getPaperDataFromLocalFile(file),
					resultType: "local",
					localFilePath: file.path,
					paperIndex: index,
				};
			}); // We need to store the filepath as well
	}

	searchLocalPapers(query: string): PaperSearchModelResult[] {
		// console.log("Searching local papers");
		let results = this.localPaperData.filter((paper) => {
			return (
				paper.paper.title.toLowerCase().contains(query.toLowerCase()) ||
				paper.paper.authors
					.map((author) => author.toLowerCase())
					.some((author) => author.contains(query.toLowerCase()))
			);
		});
		return results;
	}

	async searchSemanticScholar(query: string) {
		let searchResult: StructuredPaperData[] = [];
		try {
			searchResult = await searchSemanticScholar(
				query,
				this.settings.s2apikey
			);
		} catch (error) {
			new Notice("Errors when downloading papers from Semanticscholar");
			console.error(error);
		}

		this.lastSearchResults = searchResult.map((paper, index) => {
			return {
				paper: paper,
				paperIndex: index + this.localPaperData.length,
				resultType: "semanticscholar",
				s2Url: paper.url,
				isFirstS2Result: index === 0,
			};
		});
		(this as any).updateSuggestions();
	}

	onOpen(): void {
		// Inspired by https://github.com/solderneer/obsidian-ai-tools/blob/313a9b9353001a88f731fde86beb80cc76412ebc/src/main.ts#L319
		this.keyListener = async (event: KeyboardEvent) => {
			if (event.repeat) return;

			if (event.shiftKey && event.key === "Enter") {
				// console.log("Searching on Semantic Scholar");

				const inputEl = document.querySelector(
					".prompt-input"
				) as HTMLInputElement;

				const query = inputEl.value;
				await this.searchSemanticScholar(query);
			}

			if (event.shiftKey && event.key === "Tab") {
				const selectedItem = document.querySelector(
					".suggestion-item.is-selected"
				);
				if (selectedItem) {
					selectedItem.classList.toggle("is-added");
				}
			}

			if (!event.shiftKey && event.key === "Tab") {
				// console.log("Tab pressed");
				const abstractHTML = document.querySelector(
					".suggestion-item.is-selected > .paper-search-result-abstract"
				);
				if (abstractHTML) {
					abstractHTML.classList.toggle("is-show");
				}
			}
		};
		document.addEventListener("keydown", this.keyListener);
		super.onOpen();
	}

	getSuggestions(query: string): PaperSearchModelResult[] {
		if (query.trim() === "") {
			return this.localPaperData;
		}

		let result: PaperSearchModelResult[] = [];

		let localResults = this.searchLocalPapers(query);
		result = result.concat(localResults);

		result = result.concat(this.lastSearchResults);
		return result;
	}

	renderSuggestion(searchResult: PaperSearchModelResult, el: HTMLElement) {
		if (searchResult.resultType === "semanticscholar") {
			if (searchResult.isFirstS2Result) {
				el.createEl("div", {
					text: "SemanticScholar Search Results",
					cls: "paper-search-result-heading",
				});

				// const leadingPromptHTML = document.createEl("div", {
				// 	text: "SemanticScholar Search Results",
				// 	cls: "s2-result-heading",
				// });

				// this.resultContainerEl.appendChild(leadingPromptHTML);
			}
		}

		el.createEl("div", {
			text: searchResult.paper.title,
			cls: "paper-search-result-title",
			attr: {
				"data-paper-id": searchResult.paperIndex,
			},
		});
		el.createEl("div", {
			text: searchResult.paper.authors.join(", "),
			cls: "paper-search-result-authors",
		});
		el.createEl("div", {
			text: searchResult.paper.abstract,
			cls: "paper-search-result-abstract",
		});
	}

	onChooseSuggestion(
		searchResult: PaperSearchModelResult,
		evt: MouseEvent | KeyboardEvent
	) {
		let allSelectedPaperIds: Number[] = [];

		this.resultContainerEl.querySelectorAll(".is-added").forEach((el) => {
			let titleEl = el.querySelector(".paper-search-result-title");
			if (titleEl) {
				let paperId = (titleEl as Element).getAttribute(
					"data-paper-id"
				);
				if (paperId) {
					allSelectedPaperIds.push(parseInt(paperId));
				}
			}
		});

		console.log(allSelectedPaperIds);

		if (allSelectedPaperIds.length > 0) {
			let papersToDownload = this.lastSearchResults.filter(
				(searchResult) => {
					return allSelectedPaperIds.includes(
						searchResult.paperIndex
					);
				}
			);
			console.log(papersToDownload);
			papersToDownload.forEach((searchResult, index) => {
				new Notice(
					"Downloading paper " +
						(index + 1) +
						" of " +
						papersToDownload.length
				);
				this.obsidianScholar.downloadAndSavePaperNotePDF(
					searchResult.paper
				);
			});
		} else {
			if (searchResult.resultType === "local") {
				const localFilePath = searchResult.localFilePath;
				if (localFilePath) {
					this.obsidianScholar.openPaper(
						localFilePath,
						searchResult.paper
					);
				} else {
					new Notice("Local file path not found");
				}
			} else {
				const s2Url = searchResult.s2Url;
				if (s2Url) {
					new Notice(NOTICE_DOWNLOADING_S2);
					this.obsidianScholar.downloadAndSavePaperNotePDF(
						searchResult.paper
					);
				} else {
					new Notice("S2 URL not found");
				}
			}
		}
	}

	onNoSuggestion() {
		this.resultContainerEl.empty();
	}

	onClose(): void {
		document.removeEventListener("keydown", this.keyListener);
	}
}

// The Paper Reference Search Modal
class paperReferenceSearchModal extends SuggestModal<PaperSearchModelResult> {
	private settings: ObsidianScholarPluginSettings;
	private obsidianScholar: ObsidianScholar;
	private keyListener: KeyListener;
	private currentSearchResults: PaperSearchModelResult[];

	constructor(
		app: App,
		settings: ObsidianScholarPluginSettings,
		obsidianScholar: ObsidianScholar,
		currentPapers: PaperSearchModelResult[],
		headline: string
	) {
		super(app);
		this.settings = settings;
		this.obsidianScholar = obsidianScholar;
		this.currentSearchResults = currentPapers;

		// Adding the instructions
		const instructions = [
			["↑↓", "to navigate"],
			["↵", "to open"],
			["⇥ (tab)", "to expand search result"],
			["⇧ ⇥", "to add paper to selection"],
			["esc", "to dismiss"],
		];

		const modalInstructionsHTML = this.modalEl.createEl("div", {
			cls: "prompt-instructions",
		});
		for (const instruction of instructions) {
			const modalInstructionHTML = modalInstructionsHTML.createDiv({
				cls: "prompt-instruction",
			});
			modalInstructionHTML.createSpan({
				cls: "prompt-instruction-command",
				text: instruction[0],
			});
			modalInstructionHTML.createSpan({ text: instruction[1] });
		}

		this.setPlaceholder(headline);
	}

	onOpen(): void {
		// Inspired by https://github.com/solderneer/obsidian-ai-tools/blob/313a9b9353001a88f731fde86beb80cc76412ebc/src/main.ts#L319
		this.keyListener = async (event: KeyboardEvent) => {
			if (event.repeat) return;

			if (event.shiftKey && event.key === "Tab") {
				const selectedItem = document.querySelector(
					".suggestion-item.is-selected"
				);
				if (selectedItem) {
					selectedItem.classList.toggle("is-added");
				}
			}

			if (!event.shiftKey && event.key === "Tab") {
				// console.log("Tab pressed");
				const abstractHTML = document.querySelector(
					".suggestion-item.is-selected > .paper-search-result-abstract"
				);
				if (abstractHTML) {
					abstractHTML.classList.toggle("is-show");
				}
			}
		};
		document.addEventListener("keydown", this.keyListener);

		super.onOpen();
	}

	getSuggestions(query: string): PaperSearchModelResult[] {
		if (query.trim() === "") {
			return this.currentSearchResults;
		} else {
			let results = this.currentSearchResults.filter((searchResult) => {
				return (
					searchResult.paper.title
						.toLowerCase()
						.contains(query.toLowerCase()) ||
					searchResult.paper.authors
						.map((author) => author.toLowerCase())
						.some((author) => author.contains(query.toLowerCase()))
				);
			});
			return results;
		}
	}

	renderSuggestion(searchResult: PaperSearchModelResult, el: HTMLElement) {
		el.createEl("div", {
			text: searchResult.paper.title,
			cls: "paper-search-result-title",
			attr: { "data-paper-id": searchResult.paperIndex },
		});
		el.createEl("div", {
			text: searchResult.paper.authors.join(", "),
			cls: "paper-search-result-authors",
		});
		el.createEl("div", {
			text: searchResult.paper.abstract,
			cls: "paper-search-result-abstract",
		});
	}

	onChooseSuggestion(
		searchResult: PaperSearchModelResult,
		evt: MouseEvent | KeyboardEvent
	) {
		let allSelectedPaperIds: Number[] = [];

		this.resultContainerEl.querySelectorAll(".is-added").forEach((el) => {
			if (el.firstChild) {
				let paperId = (el.firstChild as Element).getAttribute(
					"data-paper-id"
				);
				if (paperId) {
					allSelectedPaperIds.push(parseInt(paperId));
				}
			}
		});

		// console.log(allSelectedPaperIds);

		if (allSelectedPaperIds.length > 0) {
			let papersToDownload = this.currentSearchResults.filter(
				(searchResult) => {
					return allSelectedPaperIds.includes(
						searchResult.paperIndex
					);
				}
			);
			// console.log(papersToDownload);
			papersToDownload.forEach((searchResult, index) => {
				new Notice(
					"Downloading paper " +
						(index + 1) +
						" of " +
						papersToDownload.length
				);
				this.obsidianScholar.downloadAndSavePaperNotePDF(
					searchResult.paper
				);
			});
		} else {
			this.obsidianScholar.downloadAndSavePaperNotePDF(
				searchResult.paper
			);
		}
	}

	onNoSuggestion() {
		this.resultContainerEl.empty();
	}

	onClose(): void {
		document.removeEventListener("keydown", this.keyListener);
	}
}

// The Paper Search Modal
class paperRemoveModal extends SuggestModal<PaperSearchModelResult> {
	private settings: ObsidianScholarPluginSettings;
	private obsidianScholar: ObsidianScholar;
	private keyListener: KeyListener;
	private currentFile: TFile | null;
	private localPaperData: PaperSearchModelResult[] = [];

	constructor(
		app: App,
		settings: ObsidianScholarPluginSettings,
		obsidianScholar: ObsidianScholar,
		currentFile: TFile | null
	) {
		super(app);
		this.settings = settings;
		this.obsidianScholar = obsidianScholar;
		this.currentFile = currentFile;

		// Adding the instructions
		const instructions = [
			["↑↓", "to navigate"],
			["↵", "to open"],
			["⇥ (tab)", "to expand search result"],
			["⇧ ⇥", "to add paper to selection"],
			["esc", "to dismiss"],
		];

		const modalInstructionsHTML = this.modalEl.createEl("div", {
			cls: "prompt-instructions",
		});
		for (const instruction of instructions) {
			const modalInstructionHTML = modalInstructionsHTML.createDiv({
				cls: "prompt-instruction",
			});
			modalInstructionHTML.createSpan({
				cls: "prompt-instruction-command",
				text: instruction[0],
			});
			modalInstructionHTML.createSpan({ text: instruction[1] });
		}

		this.setPlaceholder("Type paper to remove");

		this.localPaperData = this.app.vault
			.getMarkdownFiles()
			.filter((file) => file.path.startsWith(this.settings.NoteLocation))
			.map((file, index) => {
				return {
					paper: this.obsidianScholar.getPaperDataFromLocalFile(file),
					resultType: "local",
					localFilePath: file.path,
					paperIndex: index,
				};
			}); // We need to store the filepath as well

		// Reorder the localPaperData to make sure we have the current file at the top
		if (currentFile != null) {
			if (
				this.localPaperData.some(
					(paper) => paper.localFilePath === currentFile.path
				)
			) {
				let currentPaper = this.localPaperData.find(
					(paper) => paper.localFilePath === currentFile.path
				);
				if (currentPaper === undefined) {
					throw new Error(
						"Current paper not found in local paper data"
					);
				}
				this.localPaperData = [
					currentPaper,
					...this.localPaperData.filter(
						(paper) => paper.localFilePath !== currentFile.path
					),
				];
			}
		}
	}

	searchLocalPapers(query: string): PaperSearchModelResult[] {
		// console.log("Searching local papers");
		let results = this.localPaperData.filter((paper) => {
			return (
				paper.paper.title.toLowerCase().contains(query.toLowerCase()) ||
				paper.paper.authors
					.map((author) => author.toLowerCase())
					.some((author) => author.contains(query.toLowerCase()))
			);
		});
		return results;
	}

	onOpen(): void {
		// Inspired by https://github.com/solderneer/obsidian-ai-tools/blob/313a9b9353001a88f731fde86beb80cc76412ebc/src/main.ts#L319
		this.keyListener = async (event: KeyboardEvent) => {
			if (event.repeat) return;

			if (event.shiftKey && event.key === "Tab") {
				const selectedItem = document.querySelector(
					".suggestion-item.is-selected"
				);
				if (selectedItem) {
					selectedItem.classList.toggle("is-added");
				}
			}

			if (!event.shiftKey && event.key === "Tab") {
				// console.log("Tab pressed");
				const abstractHTML = document.querySelector(
					".suggestion-item.is-selected > .paper-search-result-abstract"
				);
				if (abstractHTML) {
					abstractHTML.classList.toggle("is-show");
				}
			}
		};
		document.addEventListener("keydown", this.keyListener);
		super.onOpen();
	}

	getSuggestions(query: string): PaperSearchModelResult[] {
		if (query.trim() === "") {
			return this.localPaperData;
		}

		let result: PaperSearchModelResult[] = [];

		let localResults = this.searchLocalPapers(query);
		result = result.concat(localResults);

		return result;
	}

	renderSuggestion(searchResult: PaperSearchModelResult, el: HTMLElement) {
		el.createEl("div", {
			text: searchResult.paper.title,
			cls: "paper-search-result-title",
			attr: {
				"data-paper-id": searchResult.paperIndex,
			},
		});
		el.createEl("div", {
			text: searchResult.paper.authors.join(", "),
			cls: "paper-search-result-authors",
		});
		el.createEl("div", {
			text: searchResult.paper.abstract,
			cls: "paper-search-result-abstract",
		});
	}

	onChooseSuggestion(
		searchResult: PaperSearchModelResult,
		evt: MouseEvent | KeyboardEvent
	) {
		let allSelectedPaperIds: Number[] = [];

		this.resultContainerEl.querySelectorAll(".is-added").forEach((el) => {
			if (el.firstChild) {
				let paperId = (el.firstChild as Element).getAttribute(
					"data-paper-id"
				);
				if (paperId) {
					allSelectedPaperIds.push(parseInt(paperId));
				}
			}
		});

		// console.log(allSelectedPaperIds);

		if (allSelectedPaperIds.length > 0) {
			let papersToRemove = this.localPaperData.filter((searchResult) => {
				return allSelectedPaperIds.includes(searchResult.paperIndex);
			});
			// console.log(papersToDownload);
			new confirmDeleteModal(
				this.app,
				this.settings,
				this.obsidianScholar,
				papersToRemove
					.map((paper) => paper.localFilePath)
					.filter(
						(path: string | undefined): path is string =>
							path !== undefined
					)
			).open();
		} else {
			const localFilePath = searchResult.localFilePath;
			if (localFilePath) {
				new Notice("Removing papers from library");
				// this.obsidianScholar.openPaper(
				// 	localFilePath,
				// 	searchResult.paper
				// );
				// this.close();
				new confirmDeleteModal(
					this.app,
					this.settings,
					this.obsidianScholar,
					[localFilePath]
				).open();
			} else {
				new Notice("Local file path not found");
			}
		}
	}

	onNoSuggestion() {
		this.resultContainerEl.empty();
	}

	onClose(): void {
		document.removeEventListener("keydown", this.keyListener);
	}
}

class confirmDeleteModal extends Modal {
	private settings: ObsidianScholarPluginSettings;
	private obsidianScholar: ObsidianScholar;
	private paperPaths: string[];

	constructor(
		app: App,
		settings: ObsidianScholarPluginSettings,
		obsidianScholar: ObsidianScholar,
		paperPaths: string[]
	) {
		super(app);
		this.settings = settings;
		this.obsidianScholar = obsidianScholar;
		this.paperPaths = paperPaths;
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.createEl("h1", {
			text: "Are you sure to remove the following papers?",
		});
		const paperList = contentEl.createEl("ul");
		this.paperPaths.forEach((paperPath) => {
			paperList.createEl("li", { text: paperPath });
		});

		new Setting(contentEl)
			.addButton((btn) =>
				btn.setButtonText("No").onClick(() => {
					this.close();
					// console.log("Not Confirm");
				})
			)
			.addButton((btn) =>
				btn
					.setButtonText("Yes")
					.setWarning()
					.onClick(() => {
						this.close();
						// console.log("Confirm");
						this.obsidianScholar.removePaperFromPath(
							this.paperPaths
						);
					})
			);
	}

	onClose() {
		let { contentEl } = this;
		contentEl.empty();
	}
}

// The Paper Download Modal
class createNoteFromUrlModal extends Modal {
	settings: ObsidianScholarPluginSettings;
	obsidianScholar: ObsidianScholar;

	constructor(
		app: App,
		settings: ObsidianScholarPluginSettings,
		obsidianScholar: ObsidianScholar
	) {
		super(app);
		this.settings = settings;
		this.obsidianScholar = obsidianScholar;
	}

	addInputElementToModal(type: keyof HTMLElementTagNameMap): any {
		const { contentEl } = this;
		let input = contentEl.createEl(type);
		return input;
	}

	addPropertyToElement(
		element: HTMLElement,
		property: string,
		value: string
	): void {
		element.setAttribute(property, value);
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.createEl("h4", {
			text: COMMAND_PAPER_MODAL_TITLE,
			cls: "add-paper-title",
		});

		// randomly choose a placeholder
		let placeholder =
			COMMAND_PAPER_MODAL_PLACEHOLDERS[
				Math.floor(
					Math.random() * COMMAND_PAPER_MODAL_PLACEHOLDERS.length
				)
			];
		let input = this.addInputElementToModal("input");
		this.addPropertyToElement(input, "type", "search");
		this.addPropertyToElement(input, "placeholder", placeholder);
		this.addPropertyToElement(input, "minLength", "1");
		this.addPropertyToElement(input, "style", "width: 95%;");

		contentEl.createEl("p", {
			text: COMMAND_PAPER_MODAL_DESC,
			cls: "add-paper-description",
		});

		let running = false;
		contentEl.addEventListener("keydown", (event) => {
			if (event.key !== "Enter") return;

			//get the URL from the input field
			let url = input.value.trim().toLowerCase();

			//check if the URL is valid
			if (!isValidUrl(url)) {
				new Notice("Invalid URL");
				return;
			}

			if (!running) {
				// Avoid multiple requests
				running = true;
				// console.log("HTTP request: " + url);
				this.fetchPaperDataAndCreateNoteFromUrl(url);
			}
		});
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}

	async fetchPaperDataAndCreateNoteFromUrl(url: string) {
		let paperFetchFunction: Function;

		if (url.includes("arxiv.org")) {
			new Notice(NOTICE_RETRIEVING_ARXIV);
			paperFetchFunction = fetchArxivPaperDataFromUrl;
		} else {
			new Notice(NOTICE_RETRIEVING_S2);
			paperFetchFunction = (url: string) =>
				fetchSemanticScholarPaperDataFromUrl(
					url,
					this.settings.s2apikey
				);
		}
		paperFetchFunction(url)
			.then(async (paperData: StructuredPaperData) => {
				this.obsidianScholar.downloadAndSavePaperNotePDF(paperData);
			})
			.catch((error: any) => {
				new Notice(NOTICE_PAPER_NOTE_DOWNLOAD_ERROR);
				console.log(error);
			})
			.finally(() => {
				this.close();
			});
	}
}
