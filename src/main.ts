import { App, SuggestModal, Modal, Notice, Plugin } from "obsidian";
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
	NOTICE_RETRIEVING_ARXIV,
	NOTICE_RETRIEVING_S2,
	COMMAND_COPY_PAPER_BIBTEX,
	COMMAND_COPY_PAPER_BIBTEX_NAME,
	NOTICE_SEARCH_BIBTEX_NOT_FOUND,
	NOTICE_SEARCH_BIBTEX_ERROR,
	NOTICE_PAPER_NOTE_DOWNLOAD_ERROR,
} from "./constants";
import { isValidUrl } from "./utility";
import {
	ObsidianScholarSettingTab,
	ObsidianScholarPluginSettings,
	DEFAULT_SETTINGS,
} from "./settingsTab";
import { ObsidianScholar } from "./obsidianScholar";
import * as path from "path";

// Main Plugin Entry Point
export default class ObsidianScholarPlugin extends Plugin {
	settings: ObsidianScholarPluginSettings;
	obsidianScholar: ObsidianScholar;

	async onload() {
		// console.log("Loading ObsidianScholar Plugin.");
		await this.loadSettings();

		this.obsidianScholar = new ObsidianScholar(
			this.app,
			this.settings,
			path.sep
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

		this.addSettingTab(new ObsidianScholarSettingTab(this.app, this));

		// We want to be able to view bibtex files in obsidian
		this.registerExtensions(["bib"], "markdown");
		this.registerExtensions(["tex"], "markdown");
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
	private lastSearchTime: number = 0;
	private delayInMs: number = 250;
	private lastSearch: string = "";
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

	async searchSemanticScholarWithDelay(query: string) {
		// Inspired by https://github.com/esm7/obsidian-map-view/blob/2b3be819067c2e2dd85418f61f8bd9a4f126ba7b/src/locationSearchDialog.ts#L149
		if (query === this.lastSearch || query.length < 3) return;
		const timestamp = Date.now();
		this.lastSearchTime = timestamp;
		const Sleep = (ms: number) =>
			new Promise((resolve) => setTimeout(resolve, ms));
		await Sleep(this.delayInMs);
		if (this.lastSearchTime != timestamp) {
			// Search is canceled by a newer search
			return;
		}
		// After the sleep our search is still the last -- so the user stopped and we can go on
		this.lastSearch = query;
		let searchResult = await searchSemanticScholar(query);

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
				await this.searchSemanticScholarWithDelay(query);
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

		if (query == this.lastSearch) {
			result = result.concat(this.lastSearchResults);
		}
		// console.log(result);
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
			let papersToDownload = this.lastSearchResults.filter(
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
					new Notice("Download Paper From S2");
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
			["⇧ ⇥", "to add paper to collection"],
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
			paperFetchFunction = fetchSemanticScholarPaperDataFromUrl;
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
