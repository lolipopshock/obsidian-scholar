# Obsidian Scholar

## Usage  

### Key Features

| Description                                                                                                                                                                                                                     | Demo                                               |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| 📚 Streamline Library Management | 
| **Add Paper from External Link** <br/> Upon seeing a paper on the web (Slack, Twitter, etc.), you can add the paper to your local library: running this tool can download the paper PDF, and create the corresponding paper note with paper metadata. | ![01-add-paper.gif](.github/demo/01-add-paper.gif) |
| **Search and Retrieval** <br/> You can quickly search and retrieve the papers in your library, as well as optionally query and find papers from SemanticScholar directly if they are not in your library. | ![02-search-paper.gif](.github/demo/02-search-paper.gif) |
| ✨ Enhance Paper Reading |
| **Check Reference** <br/> Obsidian Scholar allows you checking the details of the referred papers without leaving the tool. | ![03-search-paper.gif](.github/demo/03-check-paper-reference.gif) |
| **Copy Paper BibTex**  | ![04-copy-bibtex.gif](.github/demo/04-copy-bibtex.gif) |

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