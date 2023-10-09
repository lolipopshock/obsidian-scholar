/* eslint-disable */

// URLs 
export const ARXIV_BIBTEX_API = "https://arxiv.org/bibtex/";
export const ARXIV_REST_API = "https://export.arxiv.org/api/query?id_list=";
export const ARXIV_URL_SUFFIX_ON_S2 = "arXiv:";
export const ACL_ANTHOLOGY_URL_SUFFIX_ON_S2 = "ACL:";
export const SEMANTIC_SCHOLAR_FIELDS = "fields=authors,title,abstract,url,venue,year,publicationDate,externalIds,isOpenAccess,openAccessPdf,citationStyles";
export const SEMANTIC_SCHOLAR_API = "https://api.semanticscholar.org/graph/v1/paper/";
export const SEMANTIC_SCHOLAR_SEARCH_API = "https://api.semanticscholar.org/graph/v1/paper/search/?query=";
export const SEMANTIC_SCHOLAR_REFERENCE_SEARCH_FIELDS = "/references?fields=authors,title,abstract,url,venue,year,publicationDate,externalIds,isOpenAccess,openAccessPdf,citationStyles&limit=50"


// Commands and Messages 
export const COMMAND_PAPER_NOTE_ID = "create-paper-note-from-url";
export const COMMAND_PAPER_NOTE_NAME = "Download paper and Create Note";
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
export const COMMAND_SEARCH_PAPER_REFERENCES_NAME = "Search Papers References";


// Settings 
export const SETTING_HEADER = "ObScholar Settings";

export const SETTING_NOTE_FOLDER_NAME = "Note folder";
export const SETTING_NOTE_FOLDER_DESC = "Folder to create paper notes in.";
export const SETTING_NOTE_FOLDER_DEFAULT = "(root of the vault)";

export const SETTING_NOTE_NAME = "Note naming";
export const SETTING_NOTE_DESC = "Method to name the note.";

export const SETTING_TEMPLATE_NAME = "Template";
export const SETTING_TEMPLATE_DESC = "Use the default paper template or you own template.";
export const SETTING_TEMPLATE_FOLDER_DEFAULT = "template";

export const SETTING_PDF_DOWNLOAD_NAME = "PDF folder";
export const SETTING_PDF_DOWNLOAD_DESC = "Choose the path to download the PDF to.";
export const SETTING_PDF_DOWNLOAD_FOLDER_DEFAULT = "(root of the vault)";

export const SETTING_IS_OPEN_PDF_WITH_NOTE_NAME = "Open PDF with note?";
export const SETTING_IS_OPEN_PDF_WITH_NOTE_DESC = "Whether to open the PDF after paper download or search.";

export const SETTING_IS_ADD_TO_BIB_FILE_NAME = "Save paper BibTex to a .bib file?";
export const SETTING_IS_ADD_TO_BIB_FILE_DESC = "If disabled, you cannot execute the \"Copy Paper BibTeX\" command.";

export const SETTING_ADD_TO_BIB_FILE_NAME = "Save the BibTeX to";
export const SETTING_ADD_TO_BIB_FILE_DESC = "Choose the .bib file to save the BibTeX to.";
export const SETTING_ADD_TO_BIB_FILE_TARGET = "";

// NOTICES 
export const NOTICE_RETRIEVING_ARXIV = "Retrieving paper information from arXiv API.";
export const NOTICE_RETRIEVING_S2 = "Retrieving paper information from Semantic Scholar API.";
export const NOTICE_NOT_BIB_FILE = "The file you selected is not a .bib file.";
export const NOTICE_NO_BIB_FILE_SELECTED = "No .bib file is selected. Please create one first.";
export const NOTICE_PAPER_NOTE_DOWNLOAD_ERROR = "Something went wrong. Check the Obsidian console if the error persists.";
export const UNSUPPORTED_URL = "This URL is not supported. You tried to enter: ";
export const FILE_ALREADY_EXISTS = "Unable to create note. File already exists. Opening existing file.";
export const NOTICE_SEARCH_BIBTEX_NOT_FOUND = "The BibTeX for this paper is not found. You might search the bibtext file manually.";
export const NOTICE_SEARCH_BIBTEX_ERROR = "The BibTeX for this paper is not found. You might search the bibtext file manually.";

// TEMPLATE
export const NOTE_TEMPLATE_DEFAULT = `---
title: "{{title}}"
added: "{{date}}"
authors: "{{authors}}"
tags: 
url: "{{url}}"
pdf: "{{pdf}}"
citekey: "{{citekey}}"
abstract: "{{abstract}}"
---

`;
/* eslint-enable */