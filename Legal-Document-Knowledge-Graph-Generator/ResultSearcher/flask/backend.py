#coding=utf-8
import json
import os

from flask import Flask
from flask import request
from flask import render_template
from flask import send_from_directory

from graph_search import names
from graph_search import search_graph

app = Flask(__name__)
BASE = os.path.dirname(os.path.abspath(__file__))
LAST_GRAPH = None


@app.route('/d3/<path:filename>')
def d3_file(filename):
    return send_from_directory(os.path.join(BASE, 'supports', 'd3'), filename)


@app.route('/')
def main():
    print("I worked!")
    return render_template('index.html')


@app.route('/search', methods=['GET', 'POST'])
def search():
    global LAST_GRAPH
    if request.method == 'POST':
        quest = request.form.get('quest', '')
        LAST_GRAPH = search_graph(quest)
        return render_template('result.html', keyword=quest)
    keyword = request.args.get('keyword', '')
    if keyword:
        hits = [name for name in names() if keyword in name][:8]
        return json.dumps(hits, ensure_ascii=False)
    return '[]'


@app.route('/result')
def result():
    if LAST_GRAPH is not None:
        return LAST_GRAPH
    path = os.path.join(BASE, 'resources', 'result.txt')
    with open(path, 'r', encoding='utf-8', errors='ignore') as handle:
        return handle.readline()


if __name__ == '__main__':
    app.run(host='127.0.0.1', port=5000, debug=True)
