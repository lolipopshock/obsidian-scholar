/* eslint-disable */

// URLs 
export const ARXIV_BIBTEX_API = "https://arxiv.org/bibtex/";
export const ARXIV_REST_API = "https://export.arxiv.org/api/query?id_list=";
export const ARXIV_URL_SUFFIX_ON_S2 = "arXiv:";
export const ACL_ANTHOLOGY_URL_SUFFIX_ON_S2 = "ACL:";
export const SEMANTIC_SCHOLAR_FIELDS = "fields=authors,title,abstract,url,venue,year,publicationDate,externalIds,isOpenAccess,openAccessPdf,citationStyles&limit=5";
export const SEMANTIC_SCHOLAR_API = "https://api.semanticscholar.org/graph/v1/paper/";
export const SEMANTIC_SCHOLAR_SEARCH_API = "https://api.semanticscholar.org/graph/v1/paper/search/?query=";
export const SEMANTIC_SCHOLAR_REFERENCE_SEARCH_FIELDS = "/references?fields=authors,title,abstract,url,venue,year,publicationDate,externalIds,isOpenAccess,openAccessPdf,citationStyles&limit=50"


// Commands and Messages 
export const COMMAND_PAPER_NOTE_ID = "create-paper-note-from-url";
export const COMMAND_PAPER_NOTE_NAME = "Add paper to Library";
export const COMMAND_PAPER_MODAL_TITLE = "Enter a Paper URL";
export const COMMAND_PAPER_MODAL_PLACEHOLDERS = [
    "https://arxiv.org/abs/xxxx.xxxx",
    "https://aclanthology.org/2022.acl-long.1/",
    "https://www.semanticscholar.org/paper/some-text/xxxx"
]
export const COMMAND_PAPER_MODAL_DESC = "Right now we support paper URLs from arXiv, Semantic Scholar, and ACL Anthology.";

export const COMMAND_SEARCH_PAPER = "search-paper";
export const COMMAND_SEARCH_PAPER_NAME = "Search Paper";

export const COMMAND_COPY_PAPER_BIBTEX = "copy-paper-bibtex";
export const COMMAND_COPY_PAPER_BIBTEX_NAME = "Copy Paper BibTeX";

export const COMMAND_SEARCH_PAPER_REFERENCES = "search-paper-references";
export const COMMAND_SEARCH_PAPER_REFERENCES_NAME = "Search Paper References";

export const COMMAND_REMOVE_PAPER = "remove-paper";
export const COMMAND_REMOVE_PAPER_NAME = "Remove Paper from Library";

export const COMMAND_OPEN_PDF_IN_SYSTEM_APP = "open-pdf-in-system-app";
export const COMMAND_OPEN_PDF_IN_SYSTEM_APP_NAME = "Open PDF in System App";

export const COMMAND_ADD_PAPER_PDF = "add-paper-pdf";
export const COMMAND_ADD_PAPER_PDF_NAME = "Add Paper PDF";


// Settings 
export const SETTING_GENERAL_HEADER = "Library Settings";

export const SETTING_NOTE_FOLDER_NAME = "Note folder";
export const SETTING_NOTE_FOLDER_DESC = "Folder to create paper notes in.";
export const SETTING_NOTE_FOLDER_DEFAULT = "(root of the vault)";

export const SETTING_PDF_DOWNLOAD_NAME = "PDF folder";
export const SETTING_PDF_DOWNLOAD_DESC = "Choose the path to download the PDF to.";
export const SETTING_PDF_DOWNLOAD_FOLDER_DEFAULT = "(root of the vault)";

export const SETTING_IS_OPEN_PDF_WITH_NOTE_NAME = "Open PDF with note?";
export const SETTING_IS_OPEN_PDF_WITH_NOTE_DESC = "Whether to open the PDF alongside the note.";

export const SETTING_IS_ADD_TO_BIB_FILE_NAME = "Save paper BibTeX to a .bib file?";
export const SETTING_IS_ADD_TO_BIB_FILE_DESC = "If disabled, you cannot execute the \"Copy Paper BibTeX\" command.";

export const SETTING_ADD_TO_BIB_FILE_NAME = "Save the BibTeX to";
export const SETTING_ADD_TO_BIB_FILE_DESC = "Choose the .bib file to save the BibTeX to.";
export const SETTING_ADD_TO_BIB_FILE_TARGET = "";

export const SETTING_SYS_SEP = "System path separator";
export const SETTING_SYS_SEP_DESC = "Used in the paper pdf path. Default is /; For Windows, use \\\\. Restart Obsidian after changing.";

export const SETTING_NOTE_HEADER = "Note Settings";

export const SETTING_FRONTMATTER_ADD_ALIASES_NAME = "Add aliases key in the note frontmatter?";
export const SETTING_FRONTMATTER_ADD_ALIASES_DESC = "If enabled, it will add the @{{citeky}} as an alias to the note.";

export const SETTING_FRONTMATTER_ADD_ANNOTATION_NAME = "Add annotation key in the note frontmatter?";
export const SETTING_FRONTMATTER_ADD_ANNOTATION_DESC = "If enabled, it will add the annotation-target key; use with the Annotator plugin.";

export const SETTING_NOTE_NAME = "Note naming";
export const SETTING_NOTE_DESC = "Method to name the note.";

export const SETTING_TEMPLATE_NAME = "Note Template";
export const SETTING_TEMPLATE_DESC = "If set, we will use you own template for the paper note.";
export const SETTING_TEMPLATE_FOLDER_DEFAULT = "template";

export const SETTING_S2API_NAME = "Semantic Scholar API Key";
export const SETTING_S2API_DESC = "Provide an Semantic Scholar API key can help you avoid rate limits when calling the API. You can obtain an API key from https://api.semanticscholar.org/.";

export const SETTING_PDF_OVERRIDE_NAME = "Override existing PDFs";
export const SETTING_PDF_OVERRIDE_DESC = "If enabled, adding a new PDF will replace the existing one. If disabled, the existing PDF will be renamed as a backup with timestamp.";

// NOTICES 
export const NOTICE_RETRIEVING_ARXIV = "Retrieving paper information from arXiv API.";
export const NOTICE_RETRIEVING_S2 = "Retrieving paper information from Semantic Scholar API.";
export const NOTICE_DOWNLOADING_S2 = "Downloading Paper From S2";

export const NOTICE_NOT_BIB_FILE = "The file you selected is not a .bib file.";
export const NOTICE_NO_BIB_FILE_SELECTED = "No .bib file is selected. Please create one first.";
export const NOTICE_PAPER_NOTE_DOWNLOAD_ERROR = "Something went wrong. Check the Obsidian console if the error persists.";
export const UNSUPPORTED_URL = "This URL is not supported. You tried to enter: ";
export const FILE_ALREADY_EXISTS = "Unable to create note. File already exists. Opening existing file.";
export const NOTICE_SEARCH_BIBTEX_NOT_FOUND = "The BibTeX for this paper is not found. You might search the bibtext file manually.";
export const NOTICE_SEARCH_BIBTEX_ERROR = "The BibTeX for this paper is not found. You might search the bibtext file manually.";
export const NOTICE_SEARCH_BIBTEX_COPIED = "The BibTeX of this paper is copied to the clipboard.";

// TEMPLATE
export const NOTE_FRONTMATTER_DEFAULT = `title: "{{title}}"
added: "{{date}}"
authors: "{{authors}}"
tags: 
url: "{{url}}"
pdf: "{{pdf}}"
citekey: "{{citekey}}"
year: "{{publicationDate:YYYY}}"
abstract: "{{abstract}}"`;

export const NOTE_FRONTMATTER_ALIASES = `aliases: "@{{citekey}}"`;
export const NOTE_FRONTMATTER_ANNOTATION = `annotation-target: "{{pdf}}"`;
/* eslint-enable */