import {Platform} from "obsidian";

export function getDate(input?: { format?: string; offset?: number }) {
	let duration;

	if (
		input?.offset !== null &&
		input?.offset !== undefined &&
		typeof input.offset === "number"
	) {
		duration = window.moment.duration(input.offset, "days");
	}

	return input?.format
		? window.moment().add(duration).format(input.format)
		: window.moment().add(duration).format("YYYY-MM-DD");
}

export function formatTimeString(input: string, format?: string) {
	return format ? window.moment(input).format(format) : window.moment(input).format("YYYY-MM-DD");
}

export function trimString(str: string | null): string {
	if (str == null) return "";

	return str.replace(/\s+/g, " ").trim();
}

export function isValidUrl(s: string) {
	var regex =
		/^(https?:\/\/)?((([a-z\d]([a-z\d-]*[a-z\d])*)\.)+[a-z]{2,}|((\d{1,3}\.){3}\d{1,3}))(\:\d+)?(\/[-a-z\d%_.~+]*)*(\?[;&a-z\d%_.~+=-]*)?(\#[-a-z\d_]*)?$/i;
	return !!regex.test(s);
}

export function splitBibtex(bibtex:string): string[] | null {
    let regex = /(@.*?{[^@]*})/gs;
    return bibtex.match(regex);
}

export function getSystemPathSeparator(): string {
	return Platform.isWin? "\\" : "/";
}

export interface BibResult {
	arxivId?: string;
	arxivUrl?: string;
	url?: string;
	title?: string;
}

export function parseBibString(bibString: string): BibResult {
	const result: BibResult = {};
	
	// 1. Try to extract arXiv IDs
	// Common patterns: arXiv:XXXX.XXXXX, arXiv preprint arXiv:XXXX.XXXXX, or just XXXX.XXXXX in context
	const arxivPatterns = [
		/arxiv[:\s]+(\d{4}\.\d{4,5})/i,
		/arxiv[:\s]+([a-z\-]+\/\d{7})/i, // older format like cond-mat/9901001
		/(?:^|\s)(\d{4}\.\d{4,5})(?:\s|$)/ // just the number pattern with word boundaries
	];
	
	for (const pattern of arxivPatterns) {
		const match = bibString.match(pattern);
		if (match) {
			result.arxivId = match[1];
			result.arxivUrl = `https://arxiv.org/abs/${match[1]}`;
			break;
		}
	}
	
	// 2. Try to extract URLs (if no arXiv found)
	if (!result.arxivUrl) {
		const urlPattern = /https?:\/\/[^\s\)]+/gi;
		const urlMatches = bibString.match(urlPattern);
		if (urlMatches && urlMatches.length > 0) {
			// Clean up URL (remove trailing punctuation)
			result.url = urlMatches[0].replace(/[.,;:]+$/, '');
		}
	}
	
	// 3. Try to extract title
	// Strategy: Look for quoted text first, then patterns after year
	
	// Pattern 1: Text within quotes (single or double)
	const quotedPattern = /["']([^"']+)["']/;
	const quotedMatch = bibString.match(quotedPattern);
	
	if (quotedMatch) {
		result.title = quotedMatch[1].trim();
	} else {
		// Pattern 2: After year pattern (e.g., "2016. Title here.")
		const afterYearPattern = /\b(19|20)\d{2}[a-z]?\.\s+([^.]+?)(?:\.|$)/i;
		const yearMatch = bibString.match(afterYearPattern);
		
		if (yearMatch) {
			// Clean up the title
			let title = yearMatch[2].trim();
			
			// Remove common prefixes that might be caught
			title = title.replace(/^(In |in |In:|in:)\s*/i, '');
			
			// Remove trailing metadata (like "arXiv preprint...")
			title = title.replace(/\s*(arxiv|arXiv|preprint|journal|conference|proceedings).*/i, '');
			
			// Remove page numbers at the end
			title = title.replace(/,?\s*(pages?|pp?\.?)\s*\d+[-–]\d+\.?$/i, '');
			
			result.title = title.trim();
		} else {
			// Pattern 3: Look for title-like patterns (capitalized phrases)
			// This is a fallback for edge cases
			const sentences = bibString.split(/[.!?]+/);
			for (const sentence of sentences) {
				// Skip sentences that look like metadata
				if (sentence.match(/\b(pages?|pp|arxiv|proceedings|conference|journal)\b/i)) {
					continue;
				}
				
				// Look for sentences with multiple capitalized words
				const words = sentence.trim().split(/\s+/);
				const capitalizedWords = words.filter(w => /^[A-Z]/.test(w));
				
				if (capitalizedWords.length >= 3 && words.length >= 5) {
					result.title = sentence.trim()
						.replace(/^.*?\d{4}[a-z]?\.\s*/i, '') // Remove author/year prefix
						.replace(/\s*(in|In)\s+.*/i, ''); // Remove "in Proceedings..." suffix
					break;
				}
			}
		}
	}
	
	// Clean up title if found
	if (result.title) {
		// Remove any remaining quotes
		result.title = result.title.replace(/^["']|["']$/g, '');
		
		// Normalize whitespace
		result.title = result.title.replace(/\s+/g, ' ').trim();
	}
	
	return result;
}