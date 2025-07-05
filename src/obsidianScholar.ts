import {
	App,
	Notice,
	TFile,
	requestUrl,
	Platform,
	FileSystemAdapter,
} from "obsidian";
import { ObsidianScholarPluginSettings } from "./settingsTab";
import {
	FILE_ALREADY_EXISTS,
	NOTE_FRONTMATTER_DEFAULT,
	NOTE_FRONTMATTER_ALIASES,
	NOTE_FRONTMATTER_ANNOTATION,
} from "./constants";
import { getDate, splitBibtex, formatTimeString, parseBibString } from "./utility";
import { StructuredPaperData, PaperLibraryCheckResult, PaperLibrarySearchParams } from "./paperData";
import { exec } from "child_process";

export class ObsidianScholar {
	settings: ObsidianScholarPluginSettings;
	app: App;
	pathSep: string;

	constructor(
		app: App,
		settings: ObsidianScholarPluginSettings,
		pathSep: string
	) {
		this.app = app;
		this.settings = settings;
		this.pathSep =
			settings.pathSeparator !== ""
				? (this.pathSep = settings.pathSeparator)
				: pathSep
				? pathSep
				: "/";
	}

	constructFileName(paperData: StructuredPaperData): string {
		// TODO: Allow configuring this
		return paperData.title.replace(/[^a-zA-Z0-9 ]/g, "");
	}

	getPaperDataFromLocalFile(file: TFile): StructuredPaperData {
		let fileCache = this.app.metadataCache.getFileCache(file);
		let frontmatter = fileCache?.frontmatter;

		// We need to convert the link format to a regular pdf path
		let pdfPath = frontmatter?.pdf ?? "";
		let matchedPdfPath = pdfPath.match(/\[\[(.*?)\]\]/);
		if (matchedPdfPath) {
			pdfPath = matchedPdfPath[1];
		} else {
			pdfPath = "";
		}

		return {
			title: frontmatter?.title ?? file.basename,
			authors: frontmatter?.authors.split(",") ?? [],
			abstract: frontmatter?.abstract ?? null,
			url: frontmatter?.url ?? null,
			venue: frontmatter?.venue ?? null,
			publicationDate: frontmatter?.year ?? null,
			tags: frontmatter?.tags ?? [],
			pdfPath: pdfPath,
			citekey: frontmatter?.citekey ?? null,
			bibtex: frontmatter?.bibtex ?? null,
		};
	}

	async detachAllUnpinnedLeaves() {
		// Get all unpinned leaves first to avoid modifying collection while iterating
		const leavesToDetach: any[] = [];
		this.app.workspace.iterateRootLeaves((leaf) => {
			if (!leaf.getViewState().state.pinned) {
				leavesToDetach.push(leaf);
			}
		});

		// Detach leaves sequentially to avoid state conflicts
		for (const leaf of leavesToDetach) {
			try {
				leaf.detach();
				// Small delay to let workspace settle
				await new Promise(resolve => setTimeout(resolve, 10));
			} catch (error) {
				console.log("Error detaching leaf:", error);
			}
		}
	}

	async getAllLocalPaperData(): Promise<StructuredPaperData[]> {
		return this.app.vault
			.getMarkdownFiles()
			.filter((file) => file.path.startsWith(this.settings.NoteLocation))
			.map((file) => {
				return this.getPaperDataFromLocalFile(file);
			});
	}

	private normalizeSearchString(str: string): string {
		return str.toLowerCase().trim().replace(/[^\w\s]/g, '').replace(/\s+/g, ' ');
	}

	private fuzzyTitleMatch(paperTitle: string, searchTitle: string): boolean {
		const normalizedPaperTitle = this.normalizeSearchString(paperTitle);
		const normalizedSearchTitle = this.normalizeSearchString(searchTitle);
		
		// Exact match
		if (normalizedPaperTitle === normalizedSearchTitle) {
			return true;
		}
		
		// Partial match - search title contained in paper title
		if (normalizedPaperTitle.includes(normalizedSearchTitle)) {
			return true;
		}
		
		// Split into words and check if most words match
		const paperWords = normalizedPaperTitle.split(' ');
		const searchWords = normalizedSearchTitle.split(' ');
		
		// For longer searches, require at least 70% of words to match
		const matchingWords = searchWords.filter(word => 
			paperWords.some(pWord => pWord.includes(word))
		);
		return matchingWords.length / searchWords.length >= 0.85;
	}

	private fuzzyAuthorMatch(paperAuthors: string[], searchAuthors: string): boolean {
		const normalizedSearchAuthors = this.normalizeSearchString(searchAuthors);
		const searchAuthorWords = normalizedSearchAuthors.split(' ');
		
		return paperAuthors.some(author => {
			const normalizedAuthor = this.normalizeSearchString(author);
			return searchAuthorWords.some(searchWord => 
				normalizedAuthor.includes(searchWord) && searchWord.length > 2
			);
		});
	}

	async isPaperInLibrary(searchParams: PaperLibrarySearchParams): Promise<PaperLibraryCheckResult> {
		// Input validation - at least one parameter must be provided
		let { url, title, citekey, bibstring } = searchParams;
		if (!url && !title && !citekey && !bibstring) {
			throw new Error("At least one search parameter (url, title, or citekey) must be provided");
		}

		// Parse bibstring if provided to extract additional search parameters
		if (bibstring) {
			const parsedBib = parseBibString(bibstring);
			// Use parsed values if original parameters weren't provided
			if (!url && parsedBib.arxivUrl) {
				url = parsedBib.arxivUrl;
			}
			if (!url && parsedBib.url) {
				url = parsedBib.url;
			}
			if (!title && parsedBib.title) {
				title = parsedBib.title;
			}
		}

		const allPapersWithFiles = this.app.vault
			.getMarkdownFiles()
			.filter((file) => file.path.startsWith(this.settings.NoteLocation))
			.map((file) => ({
				paperData: this.getPaperDataFromLocalFile(file),
				file: file,
			}));

		// 1. Search by URL first (most reliable)
		if (url) {
			const normalizedUrl = url.toLowerCase().trim();
			for (const { paperData, file } of allPapersWithFiles) {
				if (paperData.url && paperData.url.toLowerCase().trim() === normalizedUrl) {
					return {
						isInLibrary: true,
						filePath: file.path,
						paperData: paperData
					};
				}
			}
		}

		// 2. Search by citekey (also quite reliable)
		if (citekey) {
			const normalizedCitekey = citekey.toLowerCase().trim();
			for (const { paperData, file } of allPapersWithFiles) {
				if (paperData.citekey && paperData.citekey.toLowerCase().trim() === normalizedCitekey) {
					return {
						isInLibrary: true,
						filePath: file.path,
						paperData: paperData
					};
				}
			}
		}

		// 3. Fuzzy search by title
		if (title) {
			for (const { paperData, file } of allPapersWithFiles) {
				if (paperData.title && this.fuzzyTitleMatch(paperData.title, title)) {
					return {
						isInLibrary: true,
						filePath: file.path,
						paperData: paperData
					};
				}
			}
		}

		// 4. Fuzzy search by authors
		// 
		// if (authors) {
		// 	for (const { paperData, file } of allPapersWithFiles) {
		// 		if (paperData.authors && paperData.authors.length > 0 && 
		// 			this.fuzzyAuthorMatch(paperData.authors, authors)) {
		// 			return {
		// 				isInLibrary: true,
		// 				filePath: file.path,
		// 				paperData: paperData
		// 			};
		// 		}
		// 	}
		// }

		return { isInLibrary: false };
	}

	isFileInNoteLocation(file: TFile | string): boolean {
		if (typeof file === "string") {
			return file.startsWith(this.settings.NoteLocation);
		} else {
			return file.path.startsWith(this.settings.NoteLocation);
		}
	}

	async extractPaperBibtexFromFile(
		citekey: string
	): Promise<string | undefined> {
		if (
			!this.settings.saveBibTex ||
			this.settings.bibTexFileLocation === ""
		) {
			return undefined;
		}

		let bibtextFile = this.app.vault.getAbstractFileByPath(
			this.settings.bibTexFileLocation
		);
		if (bibtextFile == null || !(bibtextFile instanceof TFile)) {
			new Notice("BibTex file not found.");
			return;
		}

		let bibtexText = await this.app.vault.adapter.read(
			this.settings.bibTexFileLocation
		);
		let bibtexEntries = splitBibtex(bibtexText);
		if (!bibtexEntries) {
			new Notice("BibTex file is empty.");
			return;
		}

		for (let entry of bibtexEntries) {
			if (entry.includes(citekey)) {
				return entry;
			}
		}
		return;
	}

	async getPaperBibtex(file: TFile | string): Promise<string | undefined> {
		if (typeof file === "string") {
			file = this.app.vault.getAbstractFileByPath(file) as TFile;
		}

		let paperData = this.getPaperDataFromLocalFile(file);
		if (paperData.bibtex && paperData.bibtex !== "") {
			return paperData.bibtex;
		}
		if (paperData.citekey && paperData.citekey !== "") {
			return await this.extractPaperBibtexFromFile(paperData.citekey);
		}
	}

	cleanStringForFrontmatter(str: string): string {
		return str
			.replace("\n", " ")
			.replace(/\\[^bfnrtv0'"\\]/g, "")
			.replace(/"/g, '\\"');
	}

	// prettier-ignore
	async createFileWithTemplate(
		paperData: StructuredPaperData,
	) {
		let template = "";
		let templateFile = this.app.vault.getAbstractFileByPath(this.settings.templateFileLocation);
		if (templateFile != null && templateFile instanceof TFile) {
			template = await this.app.vault.cachedRead(templateFile as TFile);
		} else {
			template = "---\n";
			template += NOTE_FRONTMATTER_DEFAULT;
			if (this.settings.noteAddFrontmatterAliases) {
				template += "\n" + NOTE_FRONTMATTER_ALIASES;
			}
			if (this.settings.noteAddFrontmatterAnnotation) {
				template += "\n" + NOTE_FRONTMATTER_ANNOTATION;
			}
			template += "\n---\n\n";
			// console.log(template);
		}

		/* eslint-disable */
		// Replace for time information
		template = template.replace(/{{date}}/g, getDate({ format: "YYYY-MM-DD" }));
		template = template.replace(/{{time}}/g, getDate({ format: "HH:mm" }));
		template = template.replace(/{{date:(.*?)}}/g, (_, format) => getDate({ format }));
		template = template.replace(/{{time:(.*?)}}/g, (_, format) => getDate({ format }));

		// Replace for paper metadata
		template = template.replace(/{{title}}/g, this.cleanStringForFrontmatter(paperData.title));
		template = template.replace(/{{authors}}/g, this.cleanStringForFrontmatter(paperData.authors.join(", ")));
		template = template.replace(/{{abstract}}/g, this.cleanStringForFrontmatter(paperData.abstract));
		template = template.replace(/{{url}}/g, paperData.url ? this.cleanStringForFrontmatter(paperData.url) : "");
		template = template.replace(/{{venue}}/g, paperData.venue ? this.cleanStringForFrontmatter(paperData.venue) : "");
		template = template.replace(/{{tags}}/g, (paperData?.tags && this.cleanStringForFrontmatter(paperData.tags.join(", "))) ?? "");

		let publicationDate = paperData.publicationDate ? this.cleanStringForFrontmatter(paperData.publicationDate) : null;
		template = template.replace(/{{publicationDate}}/g, publicationDate ? formatTimeString(publicationDate): "");
		template = template.replace(/{{publicationDate:(.*?)}}/g, (_, format) => publicationDate ? formatTimeString(publicationDate, format): "");

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

		// When we want to open the pdf, we'd better close all the windows
		// in the current workspace
		if (this.settings.openPdfAfterDownload && paperData.pdfPath) {
			await this.detachAllUnpinnedLeaves();
		}

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
			let leaf = this.app.workspace.getLeaf("split", "vertical");
			paperData.pdfPath &&
				leaf.openFile(
					this.app.vault.getAbstractFileByPath(
						paperData.pdfPath
					) as TFile
				);
		}
	}

	async openPaper(pathToFile: string, paperData: StructuredPaperData, shouldOpenPdf?: boolean) {
		// Use the provided parameter or fall back to the existing setting
		const openPdf = shouldOpenPdf !== undefined ? shouldOpenPdf : this.settings.openPdfAfterDownload;
		
		// Only detach leaves if the setting is enabled for downloads, not for updates	
		if (shouldOpenPdf === undefined && this.settings.openPdfAfterDownload) {
			await this.detachAllUnpinnedLeaves();
		}
		
		this.app.workspace.openLinkText(pathToFile, pathToFile);
		
		if (openPdf && paperData.pdfPath) {

			// Open the note file first
			const noteFile = this.app.vault.getAbstractFileByPath(pathToFile);
			if (noteFile && noteFile instanceof TFile) {

				// Wait for the workspace to settle
				await new Promise(resolve => setTimeout(resolve, 150));
				
				// Now try to open the PDF in a split
				try {
					const pdfFile = this.app.vault.getAbstractFileByPath(paperData.pdfPath);
					if (pdfFile && pdfFile instanceof TFile) {
						// Create split from the note leaf
						const pdfLeaf = this.app.workspace.getLeaf("split", "vertical");
						await pdfLeaf.openFile(pdfFile);
					}
				} catch (error) {
					console.log("Could not open PDF in split, opening in same pane:", error);
					// Fallback: just open the PDF in the current leaf if split fails
					const pdfFile = this.app.vault.getAbstractFileByPath(paperData.pdfPath);
					if (pdfFile && pdfFile instanceof TFile) {
						const fallbackLeaf = this.app.workspace.getLeaf(true);
						await fallbackLeaf.openFile(pdfFile);
					}
				}
			}
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
			let pdfSavePath =
				pdfDownloadFolder + this.pathSep + filename + ".pdf";

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

	async openPdfWithSystemViewer(currentFile: TFile) {
		if (!Platform.isMacOS) {
			new Notice("This feature is only available on macOS.");
			return;
		}

		let pdfPath = "";
		if (
			currentFile.extension == "md" &&
			this.isFileInNoteLocation(currentFile)
		) {
			let paperData = this.getPaperDataFromLocalFile(currentFile);
			if (paperData.pdfPath) {
				pdfPath = paperData.pdfPath;
			}
		} else if (currentFile.extension == "pdf") {
			pdfPath = currentFile.path;
		} else {
			new Notice("The current file is not a pdf or a note.");
			return;
		}

		if (pdfPath === "" || !pdfPath) {
			// handle cases where the pdf path is not found
			new Notice("No pdf path found.");
			return;
		}

		let absolutePath = (
			this.app.vault.adapter as FileSystemAdapter
		).getFullPath(pdfPath);

		exec(`open "${absolutePath}"`, (error, stdout, stderr) => {
			if (error) {
				console.error(`exec error: ${error}`);
				return;
			}
			// console.log(`stdout: ${stdout}`);
			// console.error(`stderr: ${stderr}`);
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

	async downloadAndSavePaperNotePDF(paperData: StructuredPaperData) {
		let paperFilename = this.constructFileName(paperData);

		if (!paperData.pdfUrl) {
			new Notice(
				"No pdf url found. You might need to find the PDF manually."
			);
		} else {
			// console.log("Downloading pdf...");
			paperData.pdfPath = await this.downloadPdf(
				paperData.pdfUrl,
				paperFilename
			);
		}

		let pathToFile =
			this.settings.NoteLocation + this.pathSep + paperFilename + ".md";

		// console.log("Creating note...");
		await this.createFileFromPaperData(paperData, pathToFile);

		// console.log("Saving bibtex...");
		paperData?.bibtex && (await this.saveBibTex(paperData.bibtex));
	}

	async removePaperFromPath(pathsToFile: string[]) {
		let citeKeysToRemove: string[] = [];
		for (let pathToFile of pathsToFile) {
			if (await this.app.vault.adapter.exists(pathToFile)) {
				// Step 1: Find the note file
				let noteFile = this.app.vault.getAbstractFileByPath(pathToFile);
				if (noteFile == null || !(noteFile instanceof TFile)) {
					new Notice("Note file not found.");
					return;
				}

				let paperData = this.getPaperDataFromLocalFile(noteFile);
				// Step 2: Add the citekeys to the list of citekeys to remove
				if (paperData.citekey) {
					citeKeysToRemove.push(paperData.citekey);
				}

				// Step 3: Find the pdf file and remove it
				if (paperData.pdfPath) {
					let pdfFile = this.app.vault.getAbstractFileByPath(
						paperData.pdfPath
					);
					if (pdfFile == null || !(pdfFile instanceof TFile)) {
						new Notice("PDF file not found.");
						return;
					}
					await this.app.vault.delete(pdfFile);
				}

				// Step 4: Finally remove the note file
				await this.app.vault.delete(noteFile);
				new Notice(
					"Paper " + paperData.title + "removed from the library."
				);
			} else {
				new Notice("File" + pathToFile + "not found.");
			}
		}

		// We have to batch the citekey removal request because we can't read and
		// write to the same file at the same time
		if (this.settings.bibTexFileLocation) {
			let bibTexPath = this.settings.bibTexFileLocation;
			let bibtextFile = this.app.vault.getAbstractFileByPath(bibTexPath);
			if (bibtextFile == null || !(bibtextFile instanceof TFile)) {
				new Notice("BibTex file not found.");
				return;
			}

			let bibtexText = await this.app.vault.adapter.read(
				this.settings.bibTexFileLocation
			);

			let bibtexEntries = splitBibtex(bibtexText);
			if (!bibtexEntries) {
				new Notice("BibTex file is empty.");
				return;
			}

			bibtexEntries = bibtexEntries.filter(
				(entry) =>
					!citeKeysToRemove.some((citekey) => entry.includes(citekey))
			);
			// console.log(bibtexEntries);
			let newBibtexText = bibtexEntries.join("\n\n");
			await this.app.vault.adapter.write(
				this.settings.bibTexFileLocation,
				newBibtexText
			);
		}
	}

	async copyLocalPdfToLibrary(
		localPdfPath: string,
		targetFilename: string
	): Promise<string> {
		return new Promise(async (resolve, reject) => {
			try {
				// Check if running on desktop platform
				if (!Platform.isDesktop) {
					reject("Local file copying is only available on desktop platforms. Please use URL downloads on mobile.");
					return;
				}

				// Import Node.js modules only on desktop platforms
				const { promises: fs } = await import("fs");
				const { join } = await import("path");
				const { homedir } = await import("os");

				let pdfDownloadFolder = this.settings.pdfDownloadLocation;
				let pdfSavePath = pdfDownloadFolder + this.pathSep + targetFilename + ".pdf";

				// Check if the destination already exists
				if (await this.app.vault.adapter.exists(pdfSavePath)) {
					resolve(pdfSavePath);
					return;
				}

				let sourceBinary: ArrayBuffer;

				// Check if the path is absolute (external to vault) or relative (within vault)
				const isAbsolutePath = localPdfPath.startsWith('/') || 
					localPdfPath.startsWith('\\') || 
					localPdfPath.match(/^[A-Za-z]:/); // Windows drive letters
				
				// Expand tilde (~) for home directory
				let expandedPath = localPdfPath;
				if (localPdfPath.startsWith('~/')) {
					expandedPath = join(homedir(), localPdfPath.slice(2));
				}

				if (isAbsolutePath || expandedPath !== localPdfPath) {
					// Handle external file path
					try {
						await fs.access(expandedPath); // Check if file exists
						const fileBuffer = await fs.readFile(expandedPath);
						sourceBinary = fileBuffer.buffer.slice(fileBuffer.byteOffset, fileBuffer.byteOffset + fileBuffer.byteLength);
					} catch (error) {
						reject("Source PDF file not found or cannot be accessed: " + expandedPath);
						return;
					}
				} else {
					// Handle vault file path
					if (!await this.app.vault.adapter.exists(localPdfPath)) {
						reject("Source PDF file not found in vault: " + localPdfPath);
						return;
					}
					sourceBinary = await this.app.vault.adapter.readBinary(localPdfPath);
				}

				// Create the destination file in the vault
				await this.app.vault.createBinary(pdfSavePath, sourceBinary);
				
				resolve(pdfSavePath);
			} catch (error) {
				reject("Failed to copy PDF: " + error);
			}
		});
	}

	async updateNotePdfPath(notePath: string, pdfPath: string): Promise<void> {
		try {
			let noteFile = this.app.vault.getAbstractFileByPath(notePath);
			if (noteFile == null || !(noteFile instanceof TFile)) {
				throw new Error("Note file not found.");
			}

			// Get the current content
			let content = await this.app.vault.read(noteFile);
			
			// Parse frontmatter
			let frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
			if (!frontmatterMatch) {
				throw new Error("No frontmatter found in note.");
			}

			let frontmatterContent = frontmatterMatch[1];
			let bodyContent = content.slice(frontmatterMatch[0].length);

			// Split frontmatter into lines for more precise handling
			let frontmatterLines = frontmatterContent.split('\n');
			let pdfLinkFormat = `[[${pdfPath}]]`;
			let pdfLineFound = false;

			// Look for existing pdf line and replace it
			for (let i = 0; i < frontmatterLines.length; i++) {
				if (frontmatterLines[i].match(/^pdf:\s*/)) {
					frontmatterLines[i] = `pdf: "${pdfLinkFormat}"`;
					pdfLineFound = true;
					break;
				}
			}

			// If no pdf line found, add it
			if (!pdfLineFound) {
				frontmatterLines.push(`pdf: "${pdfLinkFormat}"`);
			}

			// Reconstruct frontmatter
			let newFrontmatterContent = frontmatterLines.join('\n');

			// Reconstruct the file content
			let newContent = `---\n${newFrontmatterContent}\n---${bodyContent}`;
			
			// Write the updated content
			await this.app.vault.modify(noteFile, newContent);
			
			new Notice("PDF path updated successfully.");
		} catch (error) {
			new Notice("Failed to update note: " + error);
			throw error;
		}
	}

	async addPdfToPaper(notePath: string, pdfSource: string): Promise<void> {
		try {
			let noteFile = this.app.vault.getAbstractFileByPath(notePath);
			if (noteFile == null || !(noteFile instanceof TFile)) {
				throw new Error("Note file not found.");
			}

			let paperData = this.getPaperDataFromLocalFile(noteFile);
			let paperFilename = this.constructFileName(paperData);
			let pdfPath: string;

			// Handle existing PDF if there is one
			if (paperData.pdfPath) {
				if (this.settings.overridePdfs) {
					// Remove existing PDF
					await this.removeExistingPdf(paperData.pdfPath);
				} else {
					// Create backup of existing PDF
					await this.createPdfBackup(paperData.pdfPath);
					await this.removeExistingPdf(paperData.pdfPath);
				}
			}

			// Check if it's a URL or local path
			if (pdfSource.startsWith("http://") || pdfSource.startsWith("https://")) {
				// Download from URL
				pdfPath = await this.downloadPdf(pdfSource, paperFilename);
			} else {
				// Copy from local path
				pdfPath = await this.copyLocalPdfToLibrary(pdfSource, paperFilename);
			}

			// Update the note's frontmatter
			await this.updateNotePdfPath(notePath, pdfPath);

			// Get updated paper data with new PDF path
			const updatedPaperData = this.getPaperDataFromLocalFile(noteFile);
			
			// Use the openPaper function to handle opening the note and PDF
			if (this.settings.openPdfAfterUpdate) {
				await this.openPaper(notePath, updatedPaperData, true);
			}
			
		} catch (error) {
			new Notice("Failed to add PDF to paper: " + error);
			throw error;
		}
	}

	async createPdfBackup(existingPdfPath: string): Promise<void> {
		try {
			// Check if the existing PDF file exists
			if (!await this.app.vault.adapter.exists(existingPdfPath)) {
				// If the file doesn't exist, no need to create backup
				return;
			}

			// Generate backup filename with timestamp
			const now = new Date();
			const timestamp = now.getFullYear().toString() + '.' +
				(now.getMonth() + 1).toString().padStart(2, '0') + '.' +
				now.getDate().toString().padStart(2, '0') + '.' +
				now.getHours().toString().padStart(2, '0') + '.' +
				now.getMinutes().toString().padStart(2, '0');

			// Extract filename without extension
			const pathParts = existingPdfPath.split(this.pathSep);
			const fileName = pathParts[pathParts.length - 1];
			const fileNameWithoutExt = fileName.replace(/\.pdf$/i, '');
			const directory = pathParts.slice(0, -1).join(this.pathSep);
			
			const backupFileName = `${fileNameWithoutExt}.backup.${timestamp}.pdf`;
			const backupPath = directory + this.pathSep + backupFileName;

			// Read the existing PDF
			const existingPdfData = await this.app.vault.adapter.readBinary(existingPdfPath);
			
			// Create the backup
			await this.app.vault.createBinary(backupPath, existingPdfData);
			
			new Notice(`PDF backup created: ${backupFileName}`);
		} catch (error) {
			new Notice("Failed to create PDF backup: " + error);
			throw error;
		}
	}

	async removeExistingPdf(existingPdfPath: string): Promise<void> {
		try {
			// Check if the existing PDF file exists
			if (!await this.app.vault.adapter.exists(existingPdfPath)) {
				// If the file doesn't exist, no need to remove
				return;
			}

			const existingPdfFile = this.app.vault.getAbstractFileByPath(existingPdfPath);
			if (existingPdfFile && existingPdfFile instanceof TFile) {
				await this.app.vault.delete(existingPdfFile);
				new Notice("Existing PDF removed.");
			}
		} catch (error) {
			new Notice("Failed to remove existing PDF: " + error);
			throw error;
		}
	}
}
