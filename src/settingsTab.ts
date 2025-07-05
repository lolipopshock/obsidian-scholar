import { App, TFolder, Notice, PluginSettingTab, Setting } from "obsidian";

import {
	SETTING_GENERAL_HEADER,
	SETTING_NOTE_FOLDER_NAME,
	SETTING_NOTE_FOLDER_DESC,
	SETTING_NOTE_FOLDER_DEFAULT,
	SETTING_TEMPLATE_NAME,
	SETTING_TEMPLATE_DESC,
	SETTING_PDF_DOWNLOAD_NAME,
	SETTING_PDF_DOWNLOAD_DESC,
	SETTING_PDF_DOWNLOAD_FOLDER_DEFAULT,
	SETTING_IS_OPEN_PDF_WITH_NOTE_NAME,
	SETTING_IS_OPEN_PDF_WITH_NOTE_DESC,
	SETTING_IS_ADD_TO_BIB_FILE_NAME,
	SETTING_IS_ADD_TO_BIB_FILE_DESC,
	SETTING_ADD_TO_BIB_FILE_NAME,
	SETTING_ADD_TO_BIB_FILE_DESC,
	SETTING_SYS_SEP,
	SETTING_SYS_SEP_DESC,
	SETTING_NOTE_HEADER,
	SETTING_FRONTMATTER_ADD_ALIASES_NAME,
	SETTING_FRONTMATTER_ADD_ALIASES_DESC,
	SETTING_FRONTMATTER_ADD_ANNOTATION_NAME,
	SETTING_FRONTMATTER_ADD_ANNOTATION_DESC,
	SETTING_S2API_NAME,
	SETTING_S2API_DESC,
	SETTING_PDF_OVERRIDE_NAME,
	SETTING_PDF_OVERRIDE_DESC,
	NOTICE_NOT_BIB_FILE,
	NOTICE_NO_BIB_FILE_SELECTED,
} from "./constants";

import ObsidianScholarPlugin from "./main";

// Settings
export interface ObsidianScholarPluginSettings {
	NoteLocation: string;
	fileNaming: string;
	templateFileLocation: string;
	pdfDownloadLocation: string;
	openPdfAfterDownload: boolean;
	saveBibTex: boolean;
	bibTexFileLocation: string;
	noteAddFrontmatterAliases: boolean;
	noteAddFrontmatterAnnotation: boolean;
	s2apikey: string;
	pathSeparator: string;
	overridePdfs: boolean;
}

export const DEFAULT_SETTINGS: ObsidianScholarPluginSettings = {
	NoteLocation: "",
	fileNaming: "",
	templateFileLocation: "",
	pdfDownloadLocation: "",
	openPdfAfterDownload: false,
	saveBibTex: false,
	bibTexFileLocation: "",
	noteAddFrontmatterAliases: false,
	noteAddFrontmatterAnnotation: false,
	s2apikey: "",
	pathSeparator: "",
	overridePdfs: false,
};

// Settings Tab
export class ObsidianScholarSettingTab extends PluginSettingTab {
	plugin: ObsidianScholarPlugin;

	constructor(app: App, plugin: ObsidianScholarPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;

		containerEl.empty();

		containerEl.createEl("h2", { text: SETTING_GENERAL_HEADER });

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

		let pdfDownloadFolderOptions: Record<string, string> = {};
		folders.forEach((record) => {
			pdfDownloadFolderOptions[record] = record;
		});
		pdfDownloadFolderOptions[""] = SETTING_PDF_DOWNLOAD_FOLDER_DEFAULT;

		let allFiles = this.app.vault.getAllLoadedFiles().map((f) => f.path);
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
			.setName(SETTING_PDF_OVERRIDE_NAME)
			.setDesc(SETTING_PDF_OVERRIDE_DESC)
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.overridePdfs)
					.onChange(async (value) => {
						this.plugin.settings.overridePdfs = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName(SETTING_IS_OPEN_PDF_WITH_NOTE_NAME)
			.setDesc(SETTING_IS_OPEN_PDF_WITH_NOTE_DESC)
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.openPdfAfterDownload)
					.onChange(async (openPdfAfterDownload) => {
						this.plugin.settings.openPdfAfterDownload =
							openPdfAfterDownload;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName(SETTING_IS_ADD_TO_BIB_FILE_NAME)
			.setDesc(SETTING_IS_ADD_TO_BIB_FILE_DESC)
			.addToggle((toggle) =>
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
											this.plugin.settings
												.bibTexFileLocation
										)
										.onChange(async (value) => {
											// make sure the file is a .bib file
											if (!value.endsWith(".bib")) {
												new Notice(NOTICE_NOT_BIB_FILE);
											}
											if (
												value === "" ||
												value === undefined ||
												value === null
											) {
												new Notice(
													NOTICE_NO_BIB_FILE_SELECTED
												);
												return;
											}
											this.plugin.settings.bibTexFileLocation =
												value;
											this.plugin.settings.saveBibTex =
												saveBibTex;
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

		new Setting(containerEl)
			.setName(SETTING_SYS_SEP)
			.setDesc(SETTING_SYS_SEP_DESC)
			.addText((text) =>
				text
					.setPlaceholder("System path separator")
					.setValue(this.plugin.settings.pathSeparator)
					.onChange(async (value) => {
						this.plugin.settings.pathSeparator = value;
						await this.plugin.saveSettings();
					})
			);

		containerEl.createEl("h2", { text: SETTING_NOTE_HEADER });

		new Setting(containerEl)
			.setName(SETTING_FRONTMATTER_ADD_ALIASES_NAME)
			.setDesc(SETTING_FRONTMATTER_ADD_ALIASES_DESC)
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.noteAddFrontmatterAliases)
					.onChange(async (value) => {
						this.plugin.settings.noteAddFrontmatterAliases = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName(SETTING_FRONTMATTER_ADD_ANNOTATION_NAME)
			.setDesc(SETTING_FRONTMATTER_ADD_ANNOTATION_DESC)
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.noteAddFrontmatterAnnotation)
					.onChange(async (value) => {
						this.plugin.settings.noteAddFrontmatterAnnotation =
							value;
						await this.plugin.saveSettings();
					})
			);

		let files = this.app.vault.getMarkdownFiles().map((file) => file.path);
		let templateOptions: Record<string, string> = {};
		files.forEach((record) => {
			templateOptions[record] = record;
		});
		templateOptions[""] = "(none)";

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
			.setName(SETTING_S2API_NAME)
			.setDesc(SETTING_S2API_DESC)
			.addText((text) =>
				text
					.setPlaceholder("API key")
					.setValue(this.plugin.settings.s2apikey || "")
					.onChange(async (value) => {
						// Check if it is a valid API key
						if (!value || value.length !== 40) {
							new Notice("Please enter a valid API key");
							return;
						}
						this.plugin.settings.s2apikey = value;
						await this.plugin.saveSettings();
					})
			);
	}
}
