// Browser stand-in for the iOS/Android tablet bridge.
// Installed only when this page is served without a native WebView.
// Projects and media stay in IndexedDB, so the app keeps working offline.

const DB_NAME = 'scratchjr-offline';
const DB_VERSION = 1;

let dbPromise = null;
let ready = null;
let state = null;
const fileCache = new Map();
const mediaChunks = new Map();
const sounds = new Map();

function openDb () {
    if (!dbPromise) {
        dbPromise = new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION);
            request.onupgradeneeded = () => {
                const db = request.result;
                if (!db.objectStoreNames.contains('kv')) {
                    db.createObjectStore('kv');
                }
            };
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }
    return dbPromise;
}

function idbGet (key) {
    return openDb().then((db) => new Promise((resolve, reject) => {
        const tx = db.transaction('kv', 'readonly');
        const request = tx.objectStore('kv').get(key);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    }));
}

function idbSet (key, value) {
    return openDb().then((db) => new Promise((resolve, reject) => {
        const tx = db.transaction('kv', 'readwrite');
        tx.objectStore('kv').put(value, key);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    }));
}

function emptyState () {
    return {
        tables: {
            projects: [],
            usershapes: [],
            userbkgs: []
        },
        seq: {
            projects: 1,
            usershapes: 1,
            userbkgs: 1
        }
    };
}

function loadState () {
    if (ready) {
        return ready;
    }
    ready = idbGet('state').then((saved) => {
        state = saved && saved.tables ? saved : emptyState();
        return state;
    }).catch((err) => {
        console.log('ScratchJr offline store unavailable, using memory only', err); // eslint-disable-line no-console
        state = emptyState();
        return state;
    });
    return ready;
}

function saveState () {
    return idbSet('state', state).catch((err) => {
        console.log('Could not persist ScratchJr projects', err); // eslint-disable-line no-console
    });
}

function table (name) {
    const key = String(name || '').toLowerCase();
    if (!state.tables[key]) {
        state.tables[key] = [];
    }
    if (state.seq[key] == null) {
        state.seq[key] = 1;
    }
    return state.tables[key];
}

function isBlank (value) {
    return value === undefined || value === null || value === '';
}

function matches (row, cond, values) {
    let index = 0;
    const clauses = cond.split(/\s+AND\s+/i);
    for (let i = 0; i < clauses.length; i++) {
        const clause = clauses[i].trim();
        let found = /^(\w+)\s+IS\s+NULL$/i.exec(clause);
        if (found) {
            if (!isBlank(row[found[1].toLowerCase()])) {
                return false;
            }
            continue;
        }
        found = /^(\w+)\s+IS\s+NOT\s+NULL$/i.exec(clause);
        if (found) {
            if (isBlank(row[found[1].toLowerCase()])) {
                return false;
            }
            continue;
        }
        found = /^(\w+)\s*(=|!=|<>)\s*\?$/i.exec(clause);
        if (found) {
            const same = String(row[found[1].toLowerCase()]) === String(values[index]);
            index += 1;
            if (found[2] === '=' ? !same : same) {
                return false;
            }
            continue;
        }
    }
    return true;
}

function projectRow (row, columns) {
    const copy = {};
    const names = columns === '*' ? Object.keys(row) : columns;
    for (let i = 0; i < names.length; i++) {
        const name = String(names[i]).trim().toLowerCase();
        if (!isBlank(row[name])) {
            copy[name] = String(row[name]);
        }
    }
    return copy;
}

function runQuery (stmt, values) {
    const select = /^select\s+(.+)\s+from\s+(\w+)\s+where\s+(.+?)(?:\s+order\s+by\s+(.+))?$/i.exec(stmt.trim());
    if (!select) {
        return [];
    }
    const columns = select[1].trim() === '*' ? '*' : select[1].split(',');
    const rows = table(select[2]).filter((row) => matches(row, select[3], values || []));
    const order = select[4] ? select[4].trim().split(/\s+/) : null;
    if (order) {
        const field = order[0].toLowerCase();
        const desc = (order[1] || '').toLowerCase() === 'desc';
        rows.sort((a, b) => {
            const left = String(a[field] || '');
            const right = String(b[field] || '');
            if (left === right) {
                return 0;
            }
            const cmp = left < right ? -1 : 1;
            return desc ? -cmp : cmp;
        });
    }
    return rows.map((row) => projectRow(row, columns));
}

function runStmt (stmt, values) {
    const list = values || [];
    const insert = /^insert\s+into\s+(\w+)\s*\(([^)]+)\)\s*values\s*\(([^)]+)\)/i.exec(stmt.trim());
    if (insert) {
        const name = insert[1].toLowerCase();
        table(name);
        const cols = insert[2].split(',');
        const row = {id: String(state.seq[name] || 1)};
        state.seq[name] = Number(row.id) + 1;
        let valueIndex = 0;
        for (let i = 0; i < cols.length; i++) {
            const col = cols[i].trim().toLowerCase();
            if (insert[3].split(',')[i].trim() === '?') {
                row[col] = list[valueIndex] == null ? '' : String(list[valueIndex]);
                valueIndex += 1;
            }
        }
        if (!row.ctime) {
            row.ctime = String(Date.now());
        }
        table(name).push(row);
        return row.id;
    }
    const update = /^update\s+(\w+)\s+set\s+(.+)\s+where\s+id\s*=\s*(\d+)\s*$/i.exec(stmt.trim());
    if (update) {
        const rows = table(update[1]);
        const id = update[3];
        const assignments = update[2].match(/(\w+)\s*=\s*\?/g) || [];
        for (let i = 0; i < rows.length; i++) {
            if (String(rows[i].id) !== id) {
                continue;
            }
            for (let a = 0; a < assignments.length; a++) {
                const col = assignments[a].split('=')[0].trim().toLowerCase();
                rows[i][col] = list[a] == null ? '' : String(list[a]);
            }
        }
        return id;
    }
    const remove = /^delete\s+from\s+(\w+)\s+where\s+id\s*=\s*\?/i.exec(stmt.trim());
    if (remove) {
        const name = remove[1].toLowerCase();
        state.tables[name] = table(name).filter((row) => String(row.id) !== String(list[0]));
        return String(list[0]);
    }
    return 'success';
}

function md5 (text) {
    function cmn (q, a, b, x, s, t) {
        a = (a + q + x + t) | 0;
        return (((a << s) | (a >>> (32 - s))) + b) | 0;
    }
    function ff (a, b, c, d, x, s, t) {
        return cmn((b & c) | (~b & d), a, b, x, s, t);
    }
    function gg (a, b, c, d, x, s, t) {
        return cmn((b & d) | (c & ~d), a, b, x, s, t);
    }
    function hh (a, b, c, d, x, s, t) {
        return cmn(b ^ c ^ d, a, b, x, s, t);
    }
    function ii (a, b, c, d, x, s, t) {
        return cmn(c ^ (b | ~d), a, b, x, s, t);
    }
    function toBlocks (str) {
        const nblk = ((str.length + 8) >> 6) + 1;
        const blks = new Array(nblk * 16);
        for (let i = 0; i < blks.length; i++) {
            blks[i] = 0;
        }
        for (let i = 0; i < str.length; i++) {
            blks[i >> 2] |= str.charCodeAt(i) << ((i % 4) * 8);
        }
        blks[str.length >> 2] |= 0x80 << ((str.length % 4) * 8);
        blks[nblk * 16 - 2] = str.length * 8;
        return blks;
    }
    const x = toBlocks(unescape(encodeURIComponent(text)));
    let a = 1732584193;
    let b = -271733879;
    let c = -1732584194;
    let d = 271733878;
    for (let i = 0; i < x.length; i += 16) {
        const olda = a;
        const oldb = b;
        const oldc = c;
        const oldd = d;
        a = ff(a, b, c, d, x[i + 0], 7, -680876936);
        d = ff(d, a, b, c, x[i + 1], 12, -389564586);
        c = ff(c, d, a, b, x[i + 2], 17, 606105819);
        b = ff(b, c, d, a, x[i + 3], 22, -1044525330);
        a = ff(a, b, c, d, x[i + 4], 7, -176418897);
        d = ff(d, a, b, c, x[i + 5], 12, 1200080426);
        c = ff(c, d, a, b, x[i + 6], 17, -1473231341);
        b = ff(b, c, d, a, x[i + 7], 22, -45705983);
        a = ff(a, b, c, d, x[i + 8], 7, 1770035416);
        d = ff(d, a, b, c, x[i + 9], 12, -1958414417);
        c = ff(c, d, a, b, x[i + 10], 17, -42063);
        b = ff(b, c, d, a, x[i + 11], 22, -1990404162);
        a = ff(a, b, c, d, x[i + 12], 7, 1804603682);
        d = ff(d, a, b, c, x[i + 13], 12, -40341101);
        c = ff(c, d, a, b, x[i + 14], 17, -1502002290);
        b = ff(b, c, d, a, x[i + 15], 22, 1236535329);
        a = gg(a, b, c, d, x[i + 1], 5, -165796510);
        d = gg(d, a, b, c, x[i + 6], 9, -1069501632);
        c = gg(c, d, a, b, x[i + 11], 14, 643717713);
        b = gg(b, c, d, a, x[i + 0], 20, -373897302);
        a = gg(a, b, c, d, x[i + 5], 5, -701558691);
        d = gg(d, a, b, c, x[i + 10], 9, 38016083);
        c = gg(c, d, a, b, x[i + 15], 14, -660478335);
        b = gg(b, c, d, a, x[i + 4], 20, -405537848);
        a = gg(a, b, c, d, x[i + 9], 5, 568446438);
        d = gg(d, a, b, c, x[i + 14], 9, -1019803690);
        c = gg(c, d, a, b, x[i + 3], 14, -187363961);
        b = gg(b, c, d, a, x[i + 8], 20, 1163531501);
        a = gg(a, b, c, d, x[i + 13], 5, -1444681467);
        d = gg(d, a, b, c, x[i + 2], 9, -51403784);
        c = gg(c, d, a, b, x[i + 7], 14, 1735328473);
        b = gg(b, c, d, a, x[i + 12], 20, -1926607734);
        a = hh(a, b, c, d, x[i + 5], 4, -378558);
        d = hh(d, a, b, c, x[i + 8], 11, -2022574463);
        c = hh(c, d, a, b, x[i + 11], 16, 1839030562);
        b = hh(b, c, d, a, x[i + 14], 23, -35309556);
        a = hh(a, b, c, d, x[i + 1], 4, -1530992060);
        d = hh(d, a, b, c, x[i + 4], 11, 1272893353);
        c = hh(c, d, a, b, x[i + 7], 16, -155497632);
        b = hh(b, c, d, a, x[i + 10], 23, -1094730640);
        a = hh(a, b, c, d, x[i + 13], 4, 681279174);
        d = hh(d, a, b, c, x[i + 0], 11, -358537222);
        c = hh(c, d, a, b, x[i + 3], 16, -722521979);
        b = hh(b, c, d, a, x[i + 6], 23, 76029189);
        a = hh(a, b, c, d, x[i + 9], 4, -640364487);
        d = hh(d, a, b, c, x[i + 12], 11, -421815835);
        c = hh(c, d, a, b, x[i + 15], 16, 530742520);
        b = hh(b, c, d, a, x[i + 2], 23, -995338651);
        a = ii(a, b, c, d, x[i + 0], 6, -198630844);
        d = ii(d, a, b, c, x[i + 7], 10, 1126891415);
        c = ii(c, d, a, b, x[i + 14], 15, -1416354905);
        b = ii(b, c, d, a, x[i + 5], 21, -57434055);
        a = ii(a, b, c, d, x[i + 12], 6, 1700485571);
        d = ii(d, a, b, c, x[i + 3], 10, -1894986606);
        c = ii(c, d, a, b, x[i + 10], 15, -1051523);
        b = ii(b, c, d, a, x[i + 1], 21, -2054922799);
        a = ii(a, b, c, d, x[i + 8], 6, 1873313359);
        d = ii(d, a, b, c, x[i + 15], 10, -30611744);
        c = ii(c, d, a, b, x[i + 6], 15, -1560198380);
        b = ii(b, c, d, a, x[i + 13], 21, 1309151649);
        a = ii(a, b, c, d, x[i + 4], 6, -145523070);
        d = ii(d, a, b, c, x[i + 11], 10, -1120210379);
        c = ii(c, d, a, b, x[i + 2], 15, 718787259);
        b = ii(b, c, d, a, x[i + 9], 21, -343485551);
        a = (a + olda) | 0;
        b = (b + oldb) | 0;
        c = (c + oldc) | 0;
        d = (d + oldd) | 0;
    }
    function hex (n) {
        let out = '';
        for (let i = 0; i < 4; i++) {
            out += ('0' + ((n >> (i * 8)) & 0xff).toString(16)).slice(-2);
        }
        return out;
    }
    return hex(a) + hex(b) + hex(c) + hex(d);
}

function soundUrl (dir, name) {
    let url = String(dir || '') + String(name || '');
    if (url.indexOf('HTML5/') === 0) {
        url = url.substring('HTML5/'.length);
    }
    return url;
}

function audioFor (name, url) {
    let audio = sounds.get(name);
    if (!audio) {
        audio = new Audio(url || name);
        sounds.set(name, audio);
    }
    return audio;
}

function parseJsonParam (value) {
    if (typeof value !== 'string') {
        return value || {};
    }
    try {
        return JSON.parse(value);
    } catch (err) {
        return {};
    }
}

function handle (method, params) {
    const args = params || [];
    switch (method) {
    case 'database_stmt': {
        const json = parseJsonParam(args[0]);
        const id = runStmt(json.stmt || '', json.values || []);
        return saveState().then(() => id);
    }
    case 'database_query': {
        const json = parseJsonParam(args[0]);
        return runQuery(json.stmt || '', json.values || []);
    }
    case 'io_getsettings':
        return ',,NO,NO';
    case 'io_getmd5':
        return md5(String(args[0] == null ? '' : args[0]));
    case 'io_setfile':
        fileCache.set(args[0], args[1] || '');
        return idbSet('file:' + args[0], args[1] || '').then(() => args[0]);
    case 'io_getfile':
        if (fileCache.has(args[0])) {
            return fileCache.get(args[0]) || btoa('0');
        }
        return idbGet('file:' + args[0]).then((value) => {
            const stored = value || btoa('0');
            fileCache.set(args[0], stored);
            return stored;
        });
    case 'io_setmedia': {
        const body = args[0] || '';
        const filename = md5(body) + '.' + args[1];
        fileCache.set(filename, body);
        return idbSet('file:' + filename, body).then(() => filename);
    }
    case 'io_setmedianame': {
        const filename = args[1] + '.' + args[2];
        fileCache.set(filename, args[0] || '');
        return idbSet('file:' + filename, args[0] || '').then(() => filename);
    }
    case 'io_getmedialen':
        return idbGet('file:' + args[0]).then((value) => {
            const body = fileCache.get(args[0]) || value || '';
            fileCache.set(args[0], body);
            mediaChunks.set(String(args[1]), body);
            return String(body.length);
        });
    case 'io_getmediadata': {
        const body = mediaChunks.get(String(args[0])) || '';
        const offset = Number(args[1]) || 0;
        const len = Number(args[2]) || 0;
        return body.substring(offset, offset + len);
    }
    case 'io_getmediadone':
        mediaChunks.delete(String(args[0]));
        return 'ok';
    case 'io_remove':
        fileCache.delete(args[0]);
        return idbSet('file:' + args[0], '').then(() => 'ok');
    case 'io_cleanassets':
        return 'ok';
    case 'io_registersound': {
        const name = args[1];
        audioFor(name, soundUrl(args[0], name));
        return name + ',1';
    }
    case 'io_playsound': {
        const audio = sounds.get(args[0]);
        if (audio) {
            audio.currentTime = 0;
            const played = audio.play();
            if (played && played.catch) {
                played.catch(() => {});
            }
        }
        return 'ok';
    }
    case 'io_stopsound': {
        const audio = sounds.get(args[0]);
        if (audio) {
            audio.pause();
            audio.currentTime = 0;
        }
        return 'ok';
    }
    case 'scratchjr_cameracheck':
        return false;
    case 'deviceName':
        return 'Browser';
    case 'hideSplash':
    case 'askForPermission':
    case 'analyticsEvent':
    case 'setAnalyticsPlacePref':
    case 'setAnalyticsPref':
    case 'recordsound_recordstart':
    case 'recordsound_recordstop':
    case 'recordsound_volume':
    case 'recordsound_startplay':
    case 'recordsound_stopplay':
    case 'recordsound_recordclose':
    case 'scratchjr_startfeed':
    case 'scratchjr_stopfeed':
    case 'scratchjr_choosecamera':
    case 'scratchjr_captureimage':
    case 'createZipForProject':
    case 'sendSjrUsingShareDialog':
        return 'ok';
    default:
        return '';
    }
}

function installWebTablet () {
    if (typeof AndroidInterface !== 'undefined' || typeof window.tablet === 'object') {
        return;
    }
    window.tablet = {
        postMessage (message) {
            loadState().then(() => handle(message.method, message.params)).then((result) => {
                if (window.iOS && message.id) {
                    window.iOS.resolve(message.id, result);
                }
            }).catch((err) => {
                console.log(err); // eslint-disable-line no-console
                if (window.iOS && message.id) {
                    window.iOS.resolve(message.id, '');
                }
            });
        }
    };
}

installWebTablet();
