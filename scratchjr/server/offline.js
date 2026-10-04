// Local ScratchJr server. It only reads files from this project and
// never contacts the network. Open http://127.0.0.1:8080
const http = require('http');
const fs = require('fs');
const path = require('path');
const {spawn, spawnSync} = require('child_process');

const root = path.join(__dirname, '..');
const webRoot = path.join(root, 'editions', 'free', 'src');
const bundlePath = path.join(root, 'src', 'build', 'bundles', 'app.bundle.js');
const bundleMapPath = path.join(root, 'src', 'build', 'bundles', 'app.bundle.js.map');
const port = Number(process.env.PORT) || 8080;

const types = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.mp3': 'audio/mpeg',
    '.wav': 'audio/wav',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
    '.ttf': 'font/ttf',
    '.txt': 'text/plain; charset=utf-8',
    '.map': 'application/json; charset=utf-8'
};

function sourceIsNewer (dir, stamp) {
    const names = fs.readdirSync(dir);
    for (let i = 0; i < names.length; i++) {
        if (names[i] === 'build') {
            continue;
        }
        const full = path.join(dir, names[i]);
        const stat = fs.statSync(full);
        if (stat.isDirectory()) {
            if (sourceIsNewer(full, stamp)) {
                return true;
            }
        } else if (stat.mtimeMs > stamp) {
            return true;
        }
    }
    return false;
}

function ensureBundle () {
    const stale = !fs.existsSync(bundlePath) ||
        sourceIsNewer(path.join(root, 'src'), fs.statSync(bundlePath).mtimeMs);
    if (!stale) {
        return;
    }
    const webpackBin = path.join(root, 'node_modules', 'webpack', 'bin', 'webpack.js');
    if (!fs.existsSync(webpackBin)) {
        console.error('Dependencies are missing. Run npm install once, then start the server again.');
        process.exit(1);
    }
    console.log('Building the ScratchJr bundle...');
    const env = Object.assign({}, process.env);
    const legacy = '--openssl-legacy-provider';
    env.NODE_OPTIONS = env.NODE_OPTIONS && env.NODE_OPTIONS.indexOf(legacy) !== -1
        ? env.NODE_OPTIONS
        : [env.NODE_OPTIONS, legacy].filter(Boolean).join(' ');
    const result = spawnSync(process.execPath, [webpackBin, '--mode=production'], {
        cwd: root,
        stdio: 'inherit',
        env: env
    });
    if (result.status !== 0 || !fs.existsSync(bundlePath)) {
        process.exit(result.status || 1);
    }
}

function safeFile (urlPath) {
    const decoded = decodeURIComponent(urlPath.split('?')[0]);
    const relative = decoded.replace(/^\/+/, '');
    if (relative === 'app.bundle.js') {
        return bundlePath;
    }
    if (relative === 'app.bundle.js.map') {
        return bundleMapPath;
    }
    const full = path.normalize(path.join(webRoot, relative));
    if (full !== webRoot && full.indexOf(webRoot + path.sep) !== 0) {
        return null;
    }
    return full;
}

function send (res, status, body, type) {
    res.writeHead(status, {
        'Content-Type': type || 'text/plain; charset=utf-8',
        'Cache-Control': 'no-cache'
    });
    res.end(body);
}

ensureBundle();

const server = http.createServer((req, res) => {
    const urlPath = req.url === '/' ? '/index.html' : req.url;
    const filePath = safeFile(urlPath);
    if (!filePath) {
        send(res, 403, 'Forbidden');
        return;
    }
    fs.stat(filePath, (err, stat) => {
        if (err || !stat.isFile()) {
            send(res, 404, 'Not found');
            return;
        }
        const type = types[path.extname(filePath).toLowerCase()] || 'application/octet-stream';
        res.writeHead(200, {
            'Content-Type': type,
            'Content-Length': stat.size,
            'Cache-Control': 'no-cache'
        });
        fs.createReadStream(filePath).pipe(res);
    });
});

server.listen(port, '127.0.0.1', () => {
    const address = 'http://127.0.0.1:' + port + '/';
    console.log('ScratchJr is running offline at ' + address);
    console.log('Leave this window open. No internet connection is required.');
    if (!process.env.SCRATCHJR_NO_OPEN && process.platform === 'win32') {
        spawn('cmd', ['/c', 'start', '', address], {detached: true, stdio: 'ignore'}).unref();
    }
});
