# Legal-Document-Knowledge-Graph-Generator

This is the research project at NLP Lab of Tsinghua University.

The aim of this project is to provide an efficient pipeline for generating knowledge graphs from Chinese legal documents and provide a searchable toolkit.

DocumentParser preprocesses raw documents into clean, structured text. Run the scripts in `DocumentParser/pre_processing` in filename order (`1_` through `7_`).

KnowledgeGraphBuilder maps that text into a directed graph of entities and relations. The core builder is C++. The Python scripts write the search indexes.

## Environment

Python 3 must be installed and available as `python` on PATH.

`run.bat` creates a virtual environment at `.venv` and installs the search page dependency from `ResultSearcher/flask/requirements.txt` (Flask only). The first run needs a network connection so pip can download Flask. Later runs reuse `.venv`.

## Run

From this folder, double-click `run.bat` or run:

```bat
run.bat
```

Leave that window open. After a short pause the browser opens http://127.0.0.1:5000/

## How to use the graph

1. On **法律检索**, type a person, company, lawyer, or case name into **搜索人名/公司名/律师名/判决文书件名**.
2. Matching names appear under the box. Click one to fill the field. If nothing matches, the list says `not found`.
3. Submit. The next page is titled **搜索结果** plus your query.
4. Circles are entities. Arrows are relations, labeled on the line. Drag a circle to move it.
5. Click a circle to thicken only the relations connected to it.
6. If the query has no links, the page says **未找到相关实体**.

Arrow colors: orange is a party or court role, black is sue / sued, red is defense, green is representation, blue is place, purple is time, brown is an attribute such as gender or law firm.
