# coding: utf-8
"""Serve the knowledge-graph browser for the CSV written by text_to_graph.py."""

import csv
import glob
import json
import os
import webbrowser
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlparse

ROOT = os.path.dirname(os.path.abspath(__file__))
PROJECT = os.path.dirname(ROOT)
STATIC = os.path.join(ROOT, "static")
HOST = "127.0.0.1"
PORT = 8765


def latest_csv():
    matches = glob.glob(os.path.join(PROJECT, "output_processed_neuralcoref_corenlp*.csv"))
    if matches:
        return max(matches, key=os.path.getmtime)
    example = os.path.join(PROJECT, "examples", "output_processed.csv")
    if os.path.isfile(example):
        return example
    return None


def load_graph(path):
    nodes = {}
    links = []
    with open(path, "r", encoding="utf-8-sig", newline="") as handle:
        reader = csv.DictReader(handle)
        for row in reader:
            source = (row.get("Entity1") or "").strip()
            target = (row.get("Entity2") or "").strip()
            relation = (row.get("Relationship") or "").strip()
            if not source or not target:
                continue
            nodes.setdefault(source, {"id": source, "name": source, "degree": 0})
            nodes.setdefault(target, {"id": target, "name": target, "degree": 0})
            nodes[source]["degree"] += 1
            nodes[target]["degree"] += 1
            links.append({"source": source, "target": target, "rela": relation})
    return {
        "file": os.path.basename(path),
        "nodes": list(nodes.values()),
        "links": links,
    }


class Handler(BaseHTTPRequestHandler):
    def log_message(self, fmt, *args):
        print("[%s] %s" % (self.log_date_time_string(), fmt % args))

    def _send(self, code, body, content_type):
        data = body if isinstance(body, bytes) else body.encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(data)

    def do_GET(self):
        parsed = urlparse(self.path)
        if parsed.path == "/api/graph":
            path = latest_csv()
            if not path:
                self._send(404, json.dumps({"error": "No CSV output found."}), "application/json; charset=utf-8")
                return
            try:
                payload = load_graph(path)
            except OSError as exc:
                self._send(500, json.dumps({"error": str(exc)}), "application/json; charset=utf-8")
                return
            self._send(200, json.dumps(payload, ensure_ascii=False), "application/json; charset=utf-8")
            return

        if parsed.path == "/api/search":
            query = parse_qs(parsed.query).get("q", [""])[0].strip().lower()
            path = latest_csv()
            names = []
            if path and query:
                payload = load_graph(path)
                names = [node["name"] for node in payload["nodes"] if query in node["name"].lower()]
            self._send(200, json.dumps(names, ensure_ascii=False), "application/json; charset=utf-8")
            return

        rel = "index.html" if parsed.path in ("", "/") else parsed.path.lstrip("/")
        file_path = os.path.normpath(os.path.join(STATIC, rel))
        if not file_path.startswith(os.path.normpath(STATIC)) or not os.path.isfile(file_path):
            self._send(404, "Not found", "text/plain; charset=utf-8")
            return
        content_type = "text/html; charset=utf-8" if file_path.endswith(".html") else "application/octet-stream"
        with open(file_path, "rb") as handle:
            self._send(200, handle.read(), content_type)


def main():
    server = ThreadingHTTPServer((HOST, PORT), Handler)
    url = "http://%s:%s/" % (HOST, PORT)
    print("Graph browser: %s" % url)
    print("Reading the newest output_processed_neuralcoref_corenlp*.csv")
    webbrowser.open(url)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("Stopped.")
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
