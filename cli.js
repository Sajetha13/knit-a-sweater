#!/usr/bin/env node

const http = require('http');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

const PREFERRED_PORT = Number(process.env.PORT) || 3000;

const mimeTypes = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.ico': 'image/x-icon',
    '.json': 'application/json'
};

const server = http.createServer((req, res) => {
    const cleanUrl = (req.url || '/').split('?')[0];
    const relPath = cleanUrl === '/' ? 'index.html' : cleanUrl.replace(/^\/+/, '');
    const publicDir = path.join(__dirname, 'public');
    const filePath = path.join(publicDir, relPath);

    if (!filePath.startsWith(publicDir)) {
        res.writeHead(403);
        res.end('Forbidden');
        return;
    }

    const extname = path.extname(filePath).toLowerCase();
    const contentType = mimeTypes[extname] || 'application/octet-stream';

    fs.readFile(filePath, (error, content) => {
        if (error) {
            res.writeHead(404, { 'Content-Type': 'text/plain' });
            res.end('File not found');
        } else {
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(content);
        }
    });
});

function openBrowser(url) {
    const start =
        process.platform === 'darwin'
            ? 'open'
            : process.platform === 'win32'
              ? 'start ""'
              : 'xdg-open';
    exec(`${start} ${url}`);
}

server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
        server.listen(0);
    } else {
        console.error('Server error:', err);
        process.exit(1);
    }
});

server.on('listening', () => {
    const actualPort = server.address().port;
    const url = `http://localhost:${actualPort}`;
    console.log(`\nKnit-A-Sweater is running at ${url}`);
    console.log('Press Ctrl+C to stop the server.\n');
    if (!process.env.NO_OPEN) {
        openBrowser(url);
    }
});

server.listen(PREFERRED_PORT);
