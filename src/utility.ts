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
