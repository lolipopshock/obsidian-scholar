import {
	ARXIV_BIBTEX_API,
	ARXIV_REST_API,
	ARXIV_URL_SUFFIX_ON_S2,
	ACL_ANTHOLOGY_URL_SUFFIX_ON_S2,
	SEMANTIC_SCHOLAR_FIELDS,
	SEMANTIC_SCHOLAR_API,
	SEMANTIC_SCHOLAR_SEARCH_API,
} from "./constants";
import { request } from "obsidian";
import { trimString } from "./utility";

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

function getIdentifierFromUrl(url: string): string {
	//if url ends in / remove it
	if (url.endsWith("/")) url = url.slice(0, -1);
	return url.split("/").slice(-1)[0];
}

export function getCiteKeyFromBibtex(bibtex: string) {
	const match = bibtex.match(/@.*\{([^,]+)/);
	return match ? match[1] : null;
}

export async function fetchArxivBibtex(arxivId: string) {
	const bibtex = await request(ARXIV_BIBTEX_API + arxivId);
	return bibtex;
}

export async function fetchArxivPaperDataFromUrl(
	url: string
): Promise<StructuredPaperData> {
	const arxivId = getIdentifierFromUrl(url);
	const arxivData = await request(ARXIV_REST_API + arxivId);

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

	let authors = json.authors.map((author: any) => author.name);

	let venue = "";
	if (json.venue != null && json.venue != "")
		venue = json.venue + " " + json.year;

	let publicationDate = json.publicationDate;

	if (title == null) title = "undefined";

	let paperUrl = json.url;
	let pdfUrl = "";
	if (json["isOpenAccess"] && json["isOpenAccess"] === true && json["openAccessPdf"]) {
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
	url: string
): Promise<StructuredPaperData> {
	const s2Id = getIdentifierFromUrl(url);
	let suffix = "INVALID";
	if (url.toLowerCase().includes("arxiv")) {
		suffix = ARXIV_URL_SUFFIX_ON_S2;
	} else if (url.toLowerCase().includes("aclanthology")) {
		suffix = ACL_ANTHOLOGY_URL_SUFFIX_ON_S2;
	} else if (url.toLowerCase().includes("semanticscholar")) {
		suffix = "";
	} else;

	if (suffix === "INVALID") {
		console.log("Invalid url: " + url);
		throw new Error("Invalid url: " + url);
	}

	let s2Data = await request(
		SEMANTIC_SCHOLAR_API + suffix + s2Id + "?" + SEMANTIC_SCHOLAR_FIELDS
	);

	let json = JSON.parse(s2Data);

	if (json.error != null) {
		throw new Error(json.error);
	}
	return parseS2paperData(json);
}

export async function searchSemanticScholar(
	query: string
): Promise<StructuredPaperData[]> {
	let requestUrl =
		SEMANTIC_SCHOLAR_SEARCH_API + encodeURIComponent(query) + "&" + SEMANTIC_SCHOLAR_FIELDS;

	// console.log(requestUrl);

	let s2Data = await request(requestUrl);
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
