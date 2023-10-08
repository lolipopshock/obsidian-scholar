# Obsidian Scholar

## Usage  

### A typical pipeline 

| Description                                                                                                                                                                                                                     | Demo                                               |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| **Add Paper** <br/> Upon seeing a paper on the web (Slack, Twitter, etc.), you can add the paper to your local library: running this tool can download the paper PDF, and create the corresponding paper note with paper metadata. | ![01-add-paper.gif](.github/demo/01-add-paper.gif) |
| **Search and Retrieval** <br/> You can quickly search and retrieve the papers in your library, as well as optionally search and add papers from SemanticScholar directly (use shift ↵ to search on SemanticScholar). | ![02-search-paper.gif](.github/demo/02-search-paper.gif) |

<!-- | **Reading and Note-taking** <br/> Read the paper in place, as well as taking notes.                                                                                                                                             |
| **Synthesize and Research** <br/> Easy reference to the papers in your library, ...                                                                                                                                             | -->

### Basic Functionality 

| Function           | Description                                                                              | Status |
| ------------------ | ---------------------------------------------------------------------------------------- | ------ |
| Paper Download     | Instantly download the paper PDF and add paper note to the library given paper URL/title |
| Quick Paper Search | Quick search of papers and metadata                                                      |
| Fetch Citations    | Search for papers that cite the current paper                                            |

### Retrieval and Filtering 

| Scenario                 | Description                                                                                                              | Status |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------ | ------ |
| arXiv Feed               | Browse daily arXiv papers, filtered by the interest, specified by either a json or based on your previous paper interest |
| Proceeding Browsing Mode | Browse papers in a proceeding (venue), filtered by keywords indicated by interest.                                       |
| Literature Review Mode   | Given a set of constraints (keywords, venue, search query), find and filter a list of papers.                            |

<!-- ### LLM based Summarization and Retrieval  -->

<!-- - Instantly download the paper PDF and add paper note to the library given paper URL/title. 
    - The paper URL can be either the arXiv/ACL/SemanticScholar link.
    - [Optional] Or alternatively you can feed in the paper title
    - Configurable paper note template.

- Paper feed
    - Browse daily arXiv papers

- Quick search for papers in the library
- [Optional] Quick search for papers on semantic scholar 
- [Optional] Annotation and highlights 
-  -->

### Use with other tools

#### Paper querying with `dataview` 

## Motivation and Acknowledgement 

The goal of *Obsidian Scholar* is to create a smooth experience that spans from paper reading, note taking, and reflection and synthesis. 
The construction is based on two powerful ideas. 
- **[Annotated Bibliography](https://owl.purdue.edu/owl/general_writing/common_writing_assignments/annotated_bibliographies/annotated_bibliography_samples.html)** that takes short notes for papers and summarizes the key points in your personal bibliography.
- **[Zettlekasten](https://zettelkasten.de/)** note taking system that aims to take atomic and short notes and link them together. 

In *Obsidian Scholar*, we treat each paper as an individual note---we make it painless to ingest the paper PDF and create the note file---and the Obsidian app makes it easy to link paper notes and helps you to reflect and synthesize the knowledge. 

The development of the tools are inspired by many predecessors that are implemented in EMACS. 
- [citar](https://github.com/emacs-citar/citar): A reference manager work in EMACS. 
- [elfeed](https://github.com/skeeto/elfeed): A RSS reader in EMACS.
- [elfeed-score](https://github.com/sp1ff/elfeed-score): A RSS reader with scoring function in EMACS.

Also thanks the following people for their excellent blogposts and tutorials illustrating their paper reading workflow:
- [Managing a research workflow (bibliographies, note-taking, and arXiv)](https://emacsconf.org/2021/talks/research/) by [Ahmed Khaled](https://www.akhaled.org)
- [Managing ArXiv RSS Feeds in Emacs](https://cundy.me/post/elfeed/) by [Chris Cundy](https://cundy.me)

Some of the code is based on a previous project called [paper-note-filer](https://github.com/chauff/paper-note-filler) by [Claudia Hauff](https://chauff.github.io). 