# Setup and running guide

This repository is a research pipeline from the NLP Lab at Tsinghua University. It turns Chinese court documents into a knowledge graph of people, companies, courts, lawyers, and cases, then lets you search those entities and see how they are connected.

The part you run locally is the search page in `ResultSearcher/flask`. It serves a small bundled index (about 900 names) and draws a relation graph in the browser. It does not download the full court corpus, and it does not call an external search API.

## What you need

- Windows
- Python 3 on `PATH` (`python --version` should print 3.x)
- A free local port **5000**

The first run also needs a network connection so `pip` can install Flask. After that, the search page, fonts, graph library, and case data are all on disk and work offline.

## Start the search page

From the project folder, double-click `run.bat`, or in a command prompt:

```bat
run.bat
```

`run.bat` does four things:

1. Checks that `python` is on `PATH`.
2. Creates a virtual environment at `.venv` if it does not exist yet.
3. Installs Flask from `ResultSearcher/flask/requirements.txt` into that environment.
4. Starts the page at http://127.0.0.1:5000/ and opens it in the browser after a short pause.

Leave the command window open. Closing it stops the server.

To stop the server, focus that window and press `Ctrl+C`.

## Use the search page

1. The home page is **法律检索**. Type a person, company, lawyer, or case name into **搜索人名/公司名/律师名/判决文书件名**.
2. Matching names appear under the box. Click one so the field is filled with the full name. If nothing matches, the list says `not found`.
3. Submit the form. The next page is titled **搜索结果** plus the name you searched.
4. Circles are entities. Arrows are relations such as 起诉 (sue), 代表 (represent), 委托 (entrust), and 审判长 (presiding judge). Drag a circle to move it. Click a circle to thicken only the lines connected to it.
5. A name that is not in the index shows **未找到相关实体**.

Example names that are in the bundled index: `李妍`, `曾新华`, `丰田汽车金融（中国）有限公司`, `广东`.

Arrow colors:

| Color | Relation |
| --- | --- |
| Orange | Party or court role (当事人, 律师, 法院, 审判长, 审判员) |
| Black | Sue / sued (起诉, 被诉) |
| Red | Defense (辩护, 被辩护) |
| Green | Representation or entrustment (代表, 委托) |
| Blue | Place (住所地, 出生地, 户籍地) |
| Purple | Time (出生日期, 判决日期) |
| Brown | Attribute (性别, 民族, 律所, 律师执业证号) |

Submit the full name from the suggestion list. A short fragment such as `李` finds several people and is not itself a graph key, so the result page will say the entity was not found.

## Start it without run.bat

From the project folder:

```bat
python -m venv .venv
.venv\Scripts\python.exe -m pip install -r ResultSearcher\flask\requirements.txt
cd ResultSearcher\flask
..\..\.venv\Scripts\python.exe backend.py
```

Then open http://127.0.0.1:5000/.

## Offline use

The first `pip install` needs the network. Later runs do not. Fonts, D3, icons, and the graph data are files inside this folder. The page does not call Google Fonts or any other website while you search.

## If it does not start

- **`Python 3 is not on PATH`** — Install Python 3 from [python.org](https://www.python.org/downloads/windows/) and enable “Add python.exe to PATH”, then run `run.bat` again.
- **`pip` fails** — Check the network, then run `run.bat` again. The virtual environment is reused.
- **The browser shows another site, or the page never loads** — Something else is already using port 5000. Stop that program, then run `run.bat` again.
- **Suggestions work, but the graph says 未找到相关实体** — The typed text is not an exact name in the index. Click a suggestion, then submit.

## What the rest of the repository is

You do not need these folders to use the search page. They are the original research steps, written for Python 2, and the raw court files they expect are not in this checkout.

- `DocumentParser/pre_processing` — scripts `1_` through `7_` clean judgment text and build structured entities.
- `KnowledgeGraphBuilder` — turns those entities into graph and index files. The heavy builder is C++.
- `ResultSearcher/flask/data` — the indexes the running page already searches.
- `ResultSearcher/flask/main.cpp` — the original C++ search. The page uses the same two-step walk in `ResultSearcher/flask/graph_search.py`, so you do not need to compile the C++ library.
