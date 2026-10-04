#coding=utf-8
"""Search the bundled legal graph the same way ResultSearcher/flask/main.cpp does."""
import os
import re

BASE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(BASE, 'data')

EDGE_MATRIX = [
    ["相等", "NULL", "NULL", "NULL", "NULL", "NULL", "NULL", "NULL"],
    ["当事人", "当事人", "律师", "代表人", "代理人", "审判长", "审判员", "法院"],
    ["被诉", "起诉", "NULL", "NULL", "NULL", "NULL", "NULL", "NULL"],
    ["被辩护", "辩护", "NULL", "NULL", "NULL", "NULL", "NULL", "NULL"],
    ["被代表", "代表", "委托（被代理）", "被委托（代理）", "NULL", "NULL", "NULL", "NULL"],
    ["审判长", "审判员", "NULL", "NULL", "NULL", "NULL", "NULL", "NULL"],
    ["住所地", "出生地", "户籍地", "NULL", "NULL", "NULL", "NULL", "NULL"],
    ["出生日期", "判决日期", "NULL", "NULL", "NULL", "NULL", "NULL", "NULL"],
    ["性别", "民族", "机构社会编号", "律所", "律师执业证号", "NULL", "NULL", "NULL"],
]

GRAPH_FILES = [
    "case_graph.txt", "loco_graph.txt", "time_graph.txt", "person_graph.txt",
    "inst_graph.txt", "gender_graph.txt", "ethic_graph.txt", "social_graph.txt",
    "lawyer_graph.txt", "lawfirm_graph.txt", "lawyernum_graph.txt",
    "lawworker_graph.txt", "court_graph.txt",
]
MAP_FILES = [
    "case_map.txt", "loco_map.txt", "time_map.txt", "person_map.txt",
    "inst_map.txt", "gender_map.txt", "ethic_map.txt", "social_map.txt",
    "lawyer_map.txt", "lawfirm_map.txt", "lawyernum_map.txt",
    "lawworker_map.txt", "court_map.txt",
]
SEARCH_FILES = ["single_search_map.txt", "duplicate_search_map.txt"]

# time, gender, ethic, social, and lawyer-number files are not walked.
BANNED_FILES = [0, 0, 1, 0, 0, 1, 1, 1, 0, 0, 1, 0, 0]
# case, place, time, org, party, lawyer, firm, staff, court, attribute
BANNED_NODES = [5, 0, 0, 5, 5, 5, 0, 0, 0, 0]
DEFAULT_EDGE = "-1"
MISSING_NAME = "NULL"
# case_graph.txt has no newline after the count, so the header and the
# first id share one line: "Total vertices: 101" + "0_8".
GLUED_HEADER = re.compile(r"Total vertices:\s*\d+([0-9]_\d+)$")
ROLE_BY_PREFIX = {
    "0": "案件",
    "1": "地区",
    "2": "时间",
    "3": "机构",
    "4": "当事人",
    "5": "律师",
    "6": "律所",
    "7": "审判人员",
    "8": "法院",
    "9": "属性",
}

_nodes_graph = None
_nodes_map = None
_search_map = None
_names = None


def _records(filename):
    path = os.path.join(DATA, filename)
    with open(path, "r", encoding="utf-8", errors="ignore") as handle:
        lines = handle.read().splitlines()
    if not lines:
        return
    first = lines[0]
    if "&" in first:
        left, right = first.split("&", 1)
        match = GLUED_HEADER.search(left)
        if match:
            yield match.group(1), right
    for line in lines[1:]:
        if "&" not in line:
            continue
        key, value = line.split("&", 1)
        if key:
            yield key, value


def _insert_first(store, key, value):
    if key not in store:
        store[key] = value


def load():
    global _nodes_graph, _nodes_map, _search_map, _names
    if _nodes_graph is not None:
        return
    _nodes_graph = {}
    _nodes_map = {}
    _search_map = {}
    for index, filename in enumerate(GRAPH_FILES):
        if BANNED_FILES[index] == 0:
            for key, value in _records(filename):
                _insert_first(_nodes_graph, key, value)
    for index, filename in enumerate(MAP_FILES):
        if BANNED_FILES[index] == 0:
            for key, value in _records(filename):
                _insert_first(_nodes_map, key, value)
    for filename in SEARCH_FILES:
        for key, value in _records(filename):
            _insert_first(_search_map, key, value)
    _names = [name for name in _search_map if name and name != MISSING_NAME]


def names():
    load()
    return _names


def _firm_name(node_id):
    edge_line = _nodes_graph.get(node_id, "")
    for edge in edge_line.split(" "):
        if ":" not in edge:
            continue
        other_id, code = edge.split(":", 1)
        if code != "8_3":
            continue
        firm = _nodes_map.get(other_id, "")
        firm = firm.lstrip("，, ")
        if firm and firm != MISSING_NAME:
            return firm
    return ""


def _display_name(node_id):
    """The extractor stored the literal NULL when a lawyer name was missing."""
    name = _nodes_map.get(node_id, "")
    if name and name != MISSING_NAME:
        return name
    role = ROLE_BY_PREFIX.get(node_id.split("_", 1)[0], "实体")
    firm = _firm_name(node_id)
    if firm:
        return "%s（%s）" % (role, firm)
    return "未署名%s" % role


def _js_string(text):
    return text.replace("\\", "\\\\").replace('"', '\\"')


def _relation(code):
    parts = code.split("_")
    if len(parts) != 2:
        return "", 0
    row, col = int(parts[0]), int(parts[1])
    if 0 <= row < len(EDGE_MATRIX) and 0 <= col < len(EDGE_MATRIX[row]):
        return EDGE_MATRIX[row][col], row
    return "", row


def _query(node_id, distance=2):
    limits = list(BANNED_NODES)
    layers = [[] for _ in range(distance + 1)]
    worked = []
    working = [node_id]
    edge_line = _nodes_graph.get(node_id)
    if edge_line is None or edge_line == DEFAULT_EDGE:
        return layers
    layers[0].append(node_id + " " + edge_line)
    for step in range(distance):
        temp = []
        for node in working:
            if node in worked:
                continue
            current = _nodes_graph.get(node)
            if current is None or current == DEFAULT_EDGE:
                continue
            for edge in current.split(" "):
                if not edge or ":" not in edge:
                    continue
                target_id = edge.split(":", 1)[0]
                if target_id in temp or target_id in working or target_id in worked:
                    continue
                target_line = _nodes_graph.get(target_id)
                if target_line is None or target_line == DEFAULT_EDGE:
                    continue
                prefix = target_id.split("_", 1)[0]
                if not prefix.isdigit():
                    continue
                index = int(prefix)
                if index >= len(limits):
                    continue
                if limits[index] > 0:
                    temp.append(target_id)
                    limits[index] -= 1
                    layers[step + 1].append(target_id + " " + target_line)
                else:
                    layers[step + 1].append(target_id + " " + DEFAULT_EDGE)
        worked.extend(working)
        working = temp
    return layers


def _search_one(group, node_id, step=2):
    layers = _query(node_id, step)
    if not layers or not layers[0]:
        return ""
    pieces = []
    for index in range(step + 1):
        layer = layers[index]
        layer_next = layers[index + 1] if index < step else []
        for position, record in enumerate(layer):
            info = record.split(" ")
            if len(info) < 2:
                continue
            source_id = info[0]
            edges = info[1:]
            if edges[0] == DEFAULT_EDGE:
                continue
            source_name = _display_name(source_id)
            targets = layer[position + 1:] + layer_next
            for target in targets:
                target_id = target.split(" ", 1)[0]
                for edge in edges:
                    if not edge or ":" not in edge:
                        continue
                    other_id, code = edge.split(":", 1)
                    if other_id != target_id:
                        continue
                    label, color = _relation(code)
                    target_name = _display_name(target_id)
                    pieces.append(
                        '{source:"%s", source_id:"%s", target:"%s", target_id:"%s", rela:"%s", edge_color:%s, group:%s}, '
                        % (
                            _js_string(source_name),
                            _js_string(source_id),
                            _js_string(target_name),
                            _js_string(target_id),
                            _js_string(label),
                            color,
                            group,
                        )
                    )
    return "".join(pieces)


def search_graph(keyword):
    load()
    keyword = (keyword or "").strip()
    if not keyword or keyword == MISSING_NAME or keyword not in _search_map:
        return "[]"
    ids = [item for item in _search_map[keyword].split(" ") if item]
    body = []
    for group, node_id in enumerate(ids):
        body.append(_search_one(group, node_id, 2))
    text = "".join(body)
    if text.endswith(", "):
        text = text[:-2]
    return "[" + text + "]"
