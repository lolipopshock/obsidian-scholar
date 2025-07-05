import {
	ARXIV_BIBTEX_API,
	ARXIV_REST_API,
	ARXIV_URL_SUFFIX_ON_S2,
	ACL_ANTHOLOGY_URL_SUFFIX_ON_S2,
	SEMANTIC_SCHOLAR_FIELDS,
	SEMANTIC_SCHOLAR_API,
	SEMANTIC_SCHOLAR_SEARCH_API,
	SEMANTIC_SCHOLAR_REFERENCE_SEARCH_FIELDS,
} from "./constants";
import { request, RequestUrlParam } from "obsidian";
import { trimString } from "./utility";
import { backOff } from "exponential-backoff";
import { Notice } from "obsidian";

export interface StructuredPaperData {
	title: string;
	authors: string[];
	abstract: string;
	url?: string;
	venue?: string;
	publicationDate?: string;
	tags?: string[];
	bibtex?: string;
	pdfPath?: string;
	pdfUrl?: string | null;
	citekey?: string | null;
}

export interface PaperLibraryCheckResult {
	isInLibrary: boolean;
	filePath?: string;
	paperData?: StructuredPaperData;
}

export interface PaperLibrarySearchParams {
	url?: string;
	title?: string;
	citekey?: string;
}

function getIdentifierFromUrl(url: string): string {
	//if url ends in / remove it
	if (url.endsWith("/")) url = url.slice(0, -1);
	return url.split("/").slice(-1)[0];
}

async function makeRequestWithRetry(url: string, apiKey?: string): Promise<any> {
	const makeRequest = async () => {
		const requestOptions: RequestUrlParam = {
			url: url,
			headers: apiKey && apiKey !== "" ? {'x-api-key': apiKey} : {},
		};
		const response = await request(requestOptions);
		return response;
	};

	return backOff(makeRequest, {
		startingDelay: 1000, // b/c the default is 1000ms according to the semanticscholar API
		numOfAttempts: 5,
		retry: (e) => {
		  console.log(e);
		  if (e.message.includes("429")) {
			new Notice("Rate limit exceeded. Trying again.");
			return true;
		  } else if (e.message.includes("404")) {
			new Notice("The paper cannot be found on SemanticScholar. Stop trying.");
		  	return false;
		  } else {
			return true;
		  }
		},
	  });
  };

  
export function getCiteKeyFromBibtex(bibtex: string) {
	const match = bibtex.match(/@.*\{([^,]+)/);
	return match ? match[1] : null;
}

export async function fetchArxivBibtex(arxivId: string) {
	const bibtex = await makeRequestWithRetry(ARXIV_BIBTEX_API + arxivId);
	return bibtex;
}

export async function fetchArxivPaperDataFromUrl(
	url: string
): Promise<StructuredPaperData> {
	const arxivId = getIdentifierFromUrl(url);
	const arxivData = await makeRequestWithRetry(ARXIV_REST_API + arxivId);

	const parser = new DOMParser();
	const xmlDoc = parser.parseFromString(arxivData, "text/xml");

	let title = xmlDoc.getElementsByTagName("title")[1].textContent;
	let abstract = xmlDoc.getElementsByTagName("summary")[0].textContent;
	let authorsSource = xmlDoc.getElementsByTagName("author");

	let authors: string[] = [];
	for (let i = 0; i < authorsSource.length; i++) {
		authors.push(
			authorsSource[i].getElementsByTagName("name")[0]
				.textContent as string
		);
	}
	let date = xmlDoc.getElementsByTagName("published")[0].textContent;
	if (date) date = date.split("T")[0]; //make the date human-friendly

	if (title == null) title = "undefined";

	let pdfUrl = xmlDoc
		.querySelector('link[title="pdf"]')
		?.getAttribute("href");

	let bibtex = await fetchArxivBibtex(arxivId);

	return {
		title: trimString(title),
		authors: authors,
		url: trimString(url),
		publicationDate: trimString(date),
		abstract: trimString(abstract),
		pdfUrl: pdfUrl,
		bibtex: bibtex,
		citekey: getCiteKeyFromBibtex(bibtex),
	};
}

function parseS2paperData(json: any) {
	let title = json.title;
	let abstract = json.abstract;

	let authors = json.authors
		? json.authors.map((author: any) => author.name)
		: [];

	let venue = "";
	if (json.venue != null && json.venue != "")
		venue = json.venue + " " + json.year;

	let publicationDate = json.publicationDate;

	if (title == null) title = "undefined";

	let paperUrl = json.url;
	let pdfUrl = "";
	if (
		json["isOpenAccess"] &&
		json["isOpenAccess"] === true &&
		json["openAccessPdf"]
	) {
		pdfUrl = json["openAccessPdf"]?.url;
	}
	if (json["externalIds"] && json["externalIds"]["ArXiv"]) {
		paperUrl = "https://arxiv.org/abs/" + json.externalIds["ArXiv"];
		pdfUrl = "https://arxiv.org/pdf/" + json.externalIds["ArXiv"];
	}
	if (json["externalIds"] && json["externalIds"]["ACL]"]) {
		paperUrl = "https://aclanthology.org/" + json.externalIds["ACL"];
		let pdfUrl = paperUrl;
		if (pdfUrl.endsWith("/")) {
			pdfUrl = paperUrl.slice(0, -1);
		}
		pdfUrl = pdfUrl + ".pdf";
	}

	let bibtex = json["citationStyles"]?.bibtex
		? json["citationStyles"]["bibtex"]
		: "";

	return {
		title: trimString(title),
		authors: authors,
		venue: trimString(venue),
		url: paperUrl,
		publicationDate: trimString(publicationDate),
		abstract: trimString(abstract),
		pdfUrl: pdfUrl,
		bibtex: bibtex,
		citekey: getCiteKeyFromBibtex(bibtex),
	};
}

export async function fetchSemanticScholarPaperDataFromUrl(
	url: string,
	apiKey?: string,
	maxRetryCount = 3,
	retryDelay = 2000,
): Promise<StructuredPaperData> {
	let s2Id = getIdentifierFromUrl(url);

	if (url.toLowerCase().includes("arxiv")) {
		s2Id = ARXIV_URL_SUFFIX_ON_S2 + s2Id.split("v")[0];
	} else if (url.toLowerCase().includes("aclanthology")) {
		s2Id = ACL_ANTHOLOGY_URL_SUFFIX_ON_S2 + s2Id;
	} else if (url.toLowerCase().includes("semanticscholar")) {
		// Do nothing
	} else {
		console.log("Invalid url: " + url);
		throw new Error("Invalid url: " + url);
	}

	let s2Data = await makeRequestWithRetry(SEMANTIC_SCHOLAR_API + s2Id + "?" + SEMANTIC_SCHOLAR_FIELDS, apiKey);

	let json = JSON.parse(s2Data);

	if (json.error != null) {
		throw new Error(json.error);
	}
	return parseS2paperData(json);
}

export async function searchSemanticScholar(
	query: string,
	apiKey?: string
): Promise<StructuredPaperData[]> {
	let requestUrl =
		SEMANTIC_SCHOLAR_SEARCH_API +
		encodeURIComponent(query) +
		"&" +
		SEMANTIC_SCHOLAR_FIELDS;

	// console.log(requestUrl);

	let s2Data = await makeRequestWithRetry(requestUrl, apiKey);
	// console.log(s2Data);

	let json = JSON.parse(s2Data);

	if (json.error != null) {
		throw new Error(json.error);
	}

	if (json.data == null || json.data.length == 0 || json?.total == 0) {
		throw new Error("No data returned");
	}

	return json.data.map((paper: any) => parseS2paperData(paper));
}

export async function fetchSemanticScholarPaperReferences(
	url: string
): Promise<StructuredPaperData[]> {
	let s2Id = getIdentifierFromUrl(url);

	if (url.toLowerCase().includes("arxiv")) {
		s2Id = ARXIV_URL_SUFFIX_ON_S2 + s2Id.split("v")[0];
	} else if (url.toLowerCase().includes("aclanthology")) {
		s2Id = ACL_ANTHOLOGY_URL_SUFFIX_ON_S2 + s2Id;
	} else if (url.toLowerCase().includes("semanticscholar")) {
		// Do nothing
	} else {
		console.log("Invalid url: " + url);
		throw new Error("Invalid url: " + url);
	}

	let s2Data = await makeRequestWithRetry(
		SEMANTIC_SCHOLAR_API + s2Id + SEMANTIC_SCHOLAR_REFERENCE_SEARCH_FIELDS
	);

	let json = JSON.parse(s2Data);

	if (json.error != null) {
		throw new Error(json.error);
	}

	if (json.data == null || json.data.length == 0 || json?.total == 0) {
		throw new Error("No data returned");
	}

	return json.data.map((citedPaperData: any) =>
		parseS2paperData(citedPaperData["citedPaper"])
	);
}
