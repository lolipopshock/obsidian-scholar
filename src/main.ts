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
import { getDate, trimString, isValidUrl } from "./utility";
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
	obScholar: ObsidianScholar;

	async onload() {
		console.log("Loading ObsidianScholar Plugin.");
		await this.loadSettings();

		this.obScholar = new ObsidianScholar(this.app, this.settings, path.sep);

		this.addCommand({
			id: COMMAND_PAPER_NOTE_ID,
			name: COMMAND_PAPER_NOTE_NAME,
			callback: () => {
				new createNoteFromUrlModal(
					this.app,
					this.settings,
					this.obScholar
				).open();
			},
		});
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
	obScholar: ObsidianScholar;

	constructor(
		app: App,
		settings: ObsidianScholarPluginSettings,
		obScholar: ObsidianScholar
	) {
		super(app);
		this.settings = settings;
		this.obScholar = obScholar;
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
				this.obScholar.downloadAndSavePaperNotePDF(paperData);
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
