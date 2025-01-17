import { App } from "obsidian";

import type ObsidianScholarPlugin from "./main";
import { isValidUrl, getSystemPathSeparator } from "./utility";
import type { ObsidianScholar } from "./obsidianScholar";
import {
	StructuredPaperData,
	fetchArxivPaperDataFromUrl,
	fetchSemanticScholarPaperDataFromUrl,
} from "./paperData";

export class ObsidianScholarApi {
	public static GetApi(
		app: App,
		plugin: ObsidianScholarPlugin,
		scholar: ObsidianScholar
	) {
		return {
			// Paper creation and management
			createPaperNoteFromUrl: async (url: string) => {
				return this.createPaperNoteFromUrl(app, plugin, scholar, url);
			},
		};
	}

	private static async createPaperNoteFromUrl(
		app: App,
		plugin: ObsidianScholarPlugin,
		scholar: ObsidianScholar,
		url: string
	): Promise<void> {
		if (!isValidUrl(url)) {
			throw new Error("Invalid URL");
		}
		try {
			const paperData: StructuredPaperData =
				await this.fetchPaperMetadata(app, plugin, url);
			await scholar.downloadAndSavePaperNotePDF(paperData);
		} catch (error) {
			console.error("Failed to create paper note:", error);
			throw error;
		}
	}

	private static async fetchPaperMetadata(
		app: App,
		plugin: ObsidianScholarPlugin,
		url: string
	): Promise<StructuredPaperData> {
		let paperFetchFunction: Function;

		if (url.includes("arxiv.org")) {
			paperFetchFunction = fetchArxivPaperDataFromUrl;
		} else {
			paperFetchFunction = (url: string) =>
				fetchSemanticScholarPaperDataFromUrl(
					url,
					plugin.settings.s2apikey
				);
		}

		return await paperFetchFunction(url);
	}
}
