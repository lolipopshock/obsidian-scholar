import {
	App,
	requestUrl,
	TFile,
	TFolder,
	Editor,
	MarkdownView,
	Modal,
	Notice,
	Plugin,
	PluginSettingTab,
	Setting,
} from "obsidian";
import {
	StructuredPaperData,
	fetchArxivPaperDataFromUrl,
	fetchSemanticScholarPaperDataFromUrl,
} from "./paperData";
import {
	COMMAND_PAPER_NOTE_NAME,
	COMMAND_PAPER_NOTE_ID,
	SETTING_HEADER,
	SETTING_NOTE_FOLDER_NAME,
	SETTING_NOTE_FOLDER_DESC,
	SETTING_NOTE_FOLDER_DEFAULT,
	SETTING_TEMPLATE_NAME,
	SETTING_TEMPLATE_DESC,
	SETTING_PDF_DOWNLOAD_NAME,
	SETTING_PDF_DOWNLOAD_DESC,
	SETTING_PDF_DOWNLOAD_FOLDER_DEFAULT,
	SETTING_ADD_TO_BIB_FILE_NAME,
	SETTING_ADD_TO_BIB_FILE_DESC,
	NOTICE_NOT_BIB_FILE,
	COMMAND_PAPER_MODAL_TITLE,
	COMMAND_PAPER_MODAL_DESC,
	COMMAND_PAPER_MODAL_PLACEHOLDERS,
	NOTICE_RETRIEVING_ARXIV,
	NOTICE_RETRIEVING_S2,
	NOTICE_NO_BIB_FILE_SELECTED,
	NOTE_TEMPLATE_DEFAULT,
	FILE_ALREADY_EXISTS,
	NOTICE_PAPER_NOTE_DOWNLOAD_ERROR,
} from "./constants";
import * as path from "path";
import { getDate, trimString, isValidUrl } from "./utility";

// Settings
interface ObsidianScholarPluginSettings {
	NoteLocation: string;
	fileNaming: string;
	templateFileLocation: string;
	pdfDownloadLocation: string;
	openPdfAfterDownload: boolean;
	saveBibTex: boolean;
	bibTexFileLocation: string;
}

const DEFAULT_SETTINGS: ObsidianScholarPluginSettings = {
	NoteLocation: "",
	fileNaming: "",
	templateFileLocation: "",
	pdfDownloadLocation: "",
	openPdfAfterDownload: false,
	saveBibTex: false,
	bibTexFileLocation: "",
};

// Main Plugin Entry Point
export default class ObsidianScholarPlugin extends Plugin {
	settings: ObsidianScholarPluginSettings;

	async onload() {
		console.log("Loading ObsidianScholar Plugin.");
		await this.loadSettings();

		this.addCommand({
			id: COMMAND_PAPER_NOTE_ID,
			name: COMMAND_PAPER_NOTE_NAME,
			callback: () => {
				new createNoteFromUrlModal(this.app, this.settings).open();
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

// The Paper Download Modal
class createNoteFromUrlModal extends Modal {
	settings: ObsidianScholarPluginSettings;

	constructor(app: App, settings: ObsidianScholarPluginSettings) {
		super(app);
		this.settings = settings;
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
			cls: "add-paper__title",
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
			cls: "add-paper__description",
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
				console.log("HTTP request: " + url);
				this.fetchPaperDataAndCreateNoteFromUrl(url);
			}
		});
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}

	constructFileName(paperData: StructuredPaperData): string {
		// TODO: Allow configuring this
		return paperData.title.replace(/[^a-zA-Z0-9 ]/g, "");
	}

	async createFileWithTemplate(
		paperData: StructuredPaperData,
	) {
		let template = "";
		let templateFile = this.app.vault.getAbstractFileByPath(this.settings.templateFileLocation);
		if (templateFile != null && templateFile instanceof TFile) {
			template = await this.app.vault.cachedRead(templateFile as TFile);
		} else {
			template = NOTE_TEMPLATE_DEFAULT;
		}

		/* eslint-disable */
		// Replace for time information
		template = template.replace(/{{date}}/g, getDate({ format: "YYYY-MM-DD" }));
		template = template.replace(/{{time}}/g, getDate({ format: "HH:mm" }));
		template = template.replace(/{{date:(.*?)}}/g, (_, format) => getDate({ format }));
		template = template.replace(/{{time:(.*?)}}/g, (_, format) => getDate({ format }));

		// Replace for paper metadata
		template = template.replace(/{{title}}/g, paperData.title);
		template = template.replace(/{{authors}}/g, paperData.authors.join(", "));
		template = template.replace(/{{abstract}}/g, paperData.abstract);
		template = template.replace(/{{url}}/g, paperData.url || "");
		template = template.replace(/{{venue}}/g, paperData.venue || "");
		template = template.replace(/{{publicationDate}}/g, paperData.publicationDate || "");
		template = template.replace(/{{tags}}/g, (paperData?.tags && paperData.tags.join(", ")) || "");

		// Replace for pdf file
		template = template.replace(/{{pdf}}/g, paperData.pdfPath ? `[[${paperData.pdfPath}]]` : "");
		if (paperData.citekey) {
			// we perhaps should keep the citekey in the template when the the bibtex is not available
			template = template.replace(/{{citekey}}/g, paperData.citekey);
		}
		/* eslint-enable */
		return template;
	}

	async createFileFromPaperData(
		paperData: StructuredPaperData,
		pathToFile: string
	) {
		let template = await this.createFileWithTemplate(paperData);

		//notification if the file already exists
		if (await this.app.vault.adapter.exists(pathToFile)) {
			new Notice(FILE_ALREADY_EXISTS);
			this.app.workspace.openLinkText(pathToFile, pathToFile);
		} else {
			await this.app.vault.create(pathToFile, template).then(() => {
				this.app.workspace.openLinkText(pathToFile, pathToFile);
			});
		}
		if (this.settings.openPdfAfterDownload) {
			let leaf = this.app.workspace.getLeaf('split', 'vertical');
			paperData.pdfPath && leaf.openFile(this.app.vault.getAbstractFileByPath(paperData.pdfPath) as TFile);
		}
	}

	async downloadPdf(
		pdfUrl: string | undefined | null,
		filename: string
	): Promise<string> {
		return new Promise(async (resolve, reject) => {
			// Check if pdfUrl is undefined or null
			if (!pdfUrl) {
				reject("pdfUrl is undefined or null");
				return;
			}

			let pdfDownloadFolder = this.settings.pdfDownloadLocation;
			let pdfSavePath = pdfDownloadFolder + path.sep + filename + ".pdf";

			// Check if the pdf already exists
			if (await this.app.vault.adapter.exists(pdfSavePath)) {
				resolve(pdfSavePath);
				return;
			}

			requestUrl({
				url: pdfUrl,
				method: "GET",
			})
				.arrayBuffer.then((arrayBuffer) => {
					this.app.vault
						.createBinary(pdfSavePath, arrayBuffer)
						.then(() => resolve(pdfSavePath))
						.catch(reject);
				})
				.catch(reject);
		});
	}

	async saveBibTex(bibtex: string) {
		if (this.settings.saveBibTex === false) {
			return;
		}

		let bibTexPath = this.settings.bibTexFileLocation;
		if (bibTexPath === "") {
			new Notice("BibTex location is not set in the settings.");
			return;
		}

		let bibtexText = "";
		if (await this.app.vault.adapter.exists(bibTexPath)) {
			let bibtexText = await this.app.vault.adapter.read(bibTexPath);
			if (bibtexText.includes(bibtex)) {
				new Notice("BibTex entry already exists.");
				return;
			}
		}

		let bibtextFile = this.app.vault.getAbstractFileByPath(bibTexPath);
		if (bibtextFile == null || !(bibtextFile instanceof TFile)) {
			new Notice("BibTex file not found.");
			return;
		}
		this.app.vault
			.append(bibtextFile as TFile, bibtex + "\n\n" + bibtexText)
			.then(() => {
				new Notice("BibTex entry saved.");
			})
			.catch((error) => {
				new Notice("Error: " + error);
			});
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
		paperFetchFunction(url).then(async (paperData: StructuredPaperData) => {
			let paperFilename = this.constructFileName(paperData);

			// console.log("Downloading pdf...")
			paperData.pdfPath = await this.downloadPdf(
				paperData.pdfUrl,
				paperFilename
			);

			let pathToFile =this.settings.NoteLocation + path.sep + paperFilename + ".md";
			
			// console.log("Creating note...")
			await this.createFileFromPaperData(
				paperData,
				pathToFile 
			);

			// console.log("Saving bibtex...")
			paperData?.bibtex && await this.saveBibTex(paperData.bibtex);
		})
		.catch((error:any) => {
			new Notice(NOTICE_PAPER_NOTE_DOWNLOAD_ERROR);
			console.log(error);
		})
		.finally(() => {
			this.close();
		});
	}
}

// Settings Tab
class ObsidianScholarSettingTab extends PluginSettingTab {
	plugin: ObsidianScholarPlugin;

	constructor(app: App, plugin: ObsidianScholarPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;

		containerEl.empty();

		containerEl.createEl("h2", { text: SETTING_HEADER });

		let folders = this.app.vault
			.getAllLoadedFiles()
			.filter((f) => f instanceof TFolder && f.path !== "/")
			.map((f) => f.path);

		let folderOptions: Record<string, string> = {};
		folders.forEach((record) => {
			folderOptions[record] = record;
		});
		folderOptions[""] = SETTING_NOTE_FOLDER_DEFAULT;

		// let namingOptions: Record<string, string> = {};
		// NAMING_TYPES.forEach((record) => {
		// 	namingOptions[record] = record;
		// });

		let files = this.app.vault.getMarkdownFiles().map((file) => file.path);
		let templateOptions: Record<string, string> = {};
		files.forEach((record) => {
			templateOptions[record] = record;
		});

		let pdfDownloadFolderOptions: Record<string, string> = {};
		folders.forEach((record) => {
			pdfDownloadFolderOptions[record] = record;
		});
		pdfDownloadFolderOptions[""] = SETTING_PDF_DOWNLOAD_FOLDER_DEFAULT;

		let allFiles = this.app.vault
			.getAllLoadedFiles()
			.map((f) => f.path);
		let bibTexSaveOption: Record<string, string> = {};

		allFiles.forEach((record) => {
			bibTexSaveOption[record] = record;
		});
		bibTexSaveOption[""] = "";

		new Setting(containerEl)
			.setName(SETTING_NOTE_FOLDER_NAME)
			.setDesc(SETTING_NOTE_FOLDER_DESC)
			/* create dropdown menu with all folders currently in the vault */
			.addDropdown((dropdown) =>
				dropdown
					.addOptions(folderOptions)
					.setValue(this.plugin.settings.NoteLocation)
					.onChange(async (value) => {
						this.plugin.settings.NoteLocation = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName(SETTING_TEMPLATE_NAME)
			.setDesc(SETTING_TEMPLATE_DESC)
			.addDropdown((dropdown) =>
				dropdown
					.addOptions(templateOptions)
					.setValue(this.plugin.settings.templateFileLocation)
					.onChange(async (value) => {
						this.plugin.settings.templateFileLocation = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName(SETTING_PDF_DOWNLOAD_NAME)
			.setDesc(SETTING_PDF_DOWNLOAD_DESC)
			.addDropdown((dropdown) =>
				dropdown
					.addOptions(pdfDownloadFolderOptions)
					.setValue(this.plugin.settings.pdfDownloadLocation)
					.onChange(async (value) => {
						this.plugin.settings.pdfDownloadLocation = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("Open PDF after download?")
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.openPdfAfterDownload)
					.onChange(async (openPdfAfterDownload) => {
						this.plugin.settings.openPdfAfterDownload = openPdfAfterDownload;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl).setName("Save BibTex?").addToggle((toggle) =>
			toggle
				.setValue(this.plugin.settings.saveBibTex)
				.onChange(async (saveBibTex) => {
					if (saveBibTex) {
						// Show command and another setting
						new Setting(containerEl)
							.setName(SETTING_ADD_TO_BIB_FILE_NAME)
							.setDesc(SETTING_ADD_TO_BIB_FILE_DESC)
							.addDropdown((dropdown) =>
								dropdown
									.addOptions(bibTexSaveOption)
									.setValue(
										this.plugin.settings.bibTexFileLocation
									)
									.onChange(async (value) => {
										// make sure the file is a .bib file
										if (!value.endsWith(".bib")) {
											new Notice(NOTICE_NOT_BIB_FILE);
										}
										if (value === "" || value === undefined || value === null) {
											new Notice(NOTICE_NO_BIB_FILE_SELECTED);
											return; 
										}
										this.plugin.settings.bibTexFileLocation = value;
										this.plugin.settings.saveBibTex = saveBibTex;
										await this.plugin.saveSettings();
									})
							);
					} else {
						// Hide command and another setting
						this.plugin.settings.saveBibTex = saveBibTex;
						containerEl.removeChild(containerEl.lastChild!);
					}
				})
		);

		if (this.plugin.settings.saveBibTex) {
			new Setting(containerEl)
				.setName(SETTING_ADD_TO_BIB_FILE_NAME)
				.setDesc(SETTING_ADD_TO_BIB_FILE_DESC)
				.addDropdown((dropdown) =>
					dropdown
						.addOptions(bibTexSaveOption)
						.setValue(this.plugin.settings.bibTexFileLocation)
						.onChange(async (value) => {
							// make sure the file is a .bib file
							if (!value.endsWith(".bib")) {
								new Notice(NOTICE_NOT_BIB_FILE);
							}
							this.plugin.settings.bibTexFileLocation = value;
							await this.plugin.saveSettings();
						})
				);
		}
	}
}
