import { App } from "obsidian";

import type ObsidianScholarPlugin from "./main";
import { isValidUrl, parseBibString } from "./utility";
import type { ObsidianScholar } from "./obsidianScholar";
import {
	StructuredPaperData,
	fetchArxivPaperDataFromUrl,
	fetchSemanticScholarPaperDataFromUrl,
	PaperLibraryCheckResult,
	PaperLibrarySearchParams,
} from "./paperData";

export interface OpenPaperParams {
	title?: string;
	bibstring?: string;
	url?: string;
}

export class ObsidianScholarApi {
	public static GetApi(
		app: App,
		plugin: ObsidianScholarPlugin,
		scholar: ObsidianScholar,
		paperSearchModalClass?: any
	) {
		return {
			// Paper creation and management
			createPaperNoteFromUrl: async (url: string) => {
				return this.createPaperNoteFromUrl(app, plugin, scholar, url);
			},
			// Paper library checking
			isPaperInLibrary: async (searchParams: PaperLibrarySearchParams): Promise<PaperLibraryCheckResult> => {
				return scholar.isPaperInLibrary(searchParams);
			},
			// Paper search with title - opens the paper search modal with pre-filled title or creates paper note from URL
			openPaper: async (searchParams: OpenPaperParams) => {
				return this.openPaper(app, plugin, scholar, searchParams, paperSearchModalClass);
			},
			
			// Convenience method for URL-only searches
			// findPaperByUrl: async (url: string): Promise<PaperLibraryCheckResult> => {
			// 	if (!isValidUrl(url)) {
			// 		throw new Error("Invalid URL");
			// 	}
			// 	return scholar.isPaperInLibrary({ url });
			// },
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

	/**
	 * Opens the paper search modal with a pre-filled query or creates paper note from URL
	 * @param app - The Obsidian app instance
	 * @param plugin - The plugin instance
	 * @param scholar - The ObsidianScholar instance
	 * @param searchParams - The search parameters (title, bibstring, and/or url)
	 * @param paperSearchModalClass - The modal class to instantiate
	 */
	private static async openPaper(
		app: App,
		plugin: ObsidianScholarPlugin,
		scholar: ObsidianScholar,
		searchParams: OpenPaperParams,
		paperSearchModalClass?: any
	): Promise<void> {
		if (!searchParams || (!searchParams.title && !searchParams.bibstring && !searchParams.url)) {
			throw new Error("At least one search parameter (title, bibstring, or url) must be provided");
		}

		// If URL is provided directly, create paper note from URL
		if (searchParams.url) {
			await this.createPaperNoteFromUrl(app, plugin, scholar, searchParams.url);
			return;
		}

		// If title is provided, use it directly to open search modal
		if (searchParams.title) {
			this.openSearchModal(app, plugin, scholar, searchParams.title, paperSearchModalClass);
			return;
		}

		// If bibstring is provided, check if it contains a URL first
		if (searchParams.bibstring) {
			const parsedBib = parseBibString(searchParams.bibstring);
			
			// If bibstring contains a URL, use createPaperNoteFromUrl logic
			if (parsedBib.arxivUrl || parsedBib.url) {
				const url = parsedBib.arxivUrl || parsedBib.url;
				if (url) {
					await this.createPaperNoteFromUrl(app, plugin, scholar, url);
					return;
				}
			}

			// Otherwise, try to extract title or fallback to bibstring for search modal
			const queryText = parsedBib.title || searchParams.bibstring;
			this.openSearchModal(app, plugin, scholar, queryText, paperSearchModalClass);
			return;
		}
	}

	/**
	 * Helper method to open the paper search modal with a pre-filled query
	 */
	private static openSearchModal(
		app: App,
		plugin: ObsidianScholarPlugin,
		scholar: ObsidianScholar,
		queryText: string,
		paperSearchModalClass?: any
	): void {
		if (!paperSearchModalClass) {
			throw new Error("Paper search modal class not provided");
		}

		// Create an instance of the paperSearchModal with the pre-filled query
		const modal = new paperSearchModalClass(
			app,
			plugin.settings,
			scholar,
			queryText.trim()
		);
		modal.open();
	}
}
