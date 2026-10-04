# Setup and Running Guide

This project turns a plain-text file into a knowledge graph. Each row of the result is one directed relation: subject, relation, object. The run uses files already stored in this folder. It does not download models.

## What must be on the machine

Copy the whole project folder. These directories are required:

| Path | Role | Approx. size |
|---|---|---|
| `.python37` | Python 3.7 and the installed libraries | 2.7 GB |
| `models` | Local sentence-transformer model | 630 MB |
| `stanford-corenlp-4.2.0` | CoreNLP jars used for coreference and relations | 484 MB |
| `nltk_data` | Sentence splitter data | 49 MB |

Java 8 must be installed at:

`C:\Program Files\Java\jre1.8.0_471`

If Java is in another folder, change `JAVA_HOME` in `run.bat` before you start.

Do not copy `.downloads`. That folder is only the cache from the original download.

## Run the pipeline

Open a command prompt in this folder.

Sample text:

```bat
run.bat examples\input_text.txt
```

Your own text file, saved in this folder:

```bat
run.bat my_text.txt
```

`run.bat` with no argument uses `examples\input_text.txt`.

A full run takes several minutes. Success ends with:

```text
Wrote output_processed_neuralcoref_corenlp.csv
Done
```

Close that CSV in Excel or WPS before the next run. If the file is open, the new result is saved as `output_processed_neuralcoref_corenlp_YYYYMMDD_HHMMSS.csv`.

## Read the CSV

Columns:

| Column | Meaning |
|---|---|
| Entity1 | Source node |
| Relationship | Arrow label |
| Entity2 | Target node |

`Type1` and `Type2` are always `Node`.

## Open the graph

Leave the pipeline window closed, then start the browser from this folder:

```bat
.python37\python.exe graph_browser\server.py
```

Open http://127.0.0.1:8765/ and leave the command window open.

- The page loads the newest `output_processed_neuralcoref_corenlp*.csv`.
- Search a name to keep that entity and its neighbors.
- Click a circle to list its relations.
- Drag circles and scroll to zoom.
- **Show all** restores the full graph.

## What one run does

1. spaCy finds named entities.
2. Stanford CoreNLP and NeuralCoref replace pronouns with those names.
3. CoreNLP OpenIE extracts subject–relation–object triples.
4. The local model in `models/paraphrase-distilroberta-base-v1` merges similar names.
5. The CSV is written.

## Offline check

Disconnect the network, then run:

```bat
run.bat examples\input_text.txt
.python37\python.exe graph_browser\server.py
```

A correct offline run does not ask to download CoreNLP, spaCy, or a Hugging Face model. If a step fails, the message names the missing folder or the Java path.
