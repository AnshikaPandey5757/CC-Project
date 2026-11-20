/* ==========================================================================
   Travel Optimizer - Node.js Backend Server
   ========================================================================== */

const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const PORT = process.env.PORT || 3000;
const BACKEND_EXE = path.join(__dirname, 'TravelOptimizerBackend.exe');

// Helper to determine mime type
const MIME_TYPES = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'application/javascript',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ttf': 'font/ttf',
    '.ico': 'image/x-icon'
};

// Static File Server Logic
function serveStaticFile(reqPath, res) {
    // Default to index.html for root requests
    let filePath = reqPath === '/' ? './index.html' : '.' + reqPath;
    filePath = path.join(__dirname, filePath);

    // Safeguard directory traversal
    if (!filePath.startsWith(__dirname)) {
        res.writeHead(403, { 'Content-Type': 'text/plain' });
        res.end('Forbidden');
        return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    fs.readFile(filePath, (err, content) => {
        if (err) {
            if (err.code === 'ENOENT') {
                res.writeHead(404, { 'Content-Type': 'text/plain' });
                res.end('File Not Found');
            } else {
                res.writeHead(500, { 'Content-Type': 'text/plain' });
                res.end(`Server Error: ${err.code}`);
            }
        } else {
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(content, 'utf-8');
        }
    });
}

// REST API Request Handler (Dijkstra calculations run in C++)
function handleOptimizeRequest(req, res) {
    let body = '';
    req.on('data', chunk => {
        body += chunk;
    });

    req.on('end', () => {
        try {
            const data = JSON.parse(body);
            const { cities, roads, startCityId, endCityId } = data;

            if (!cities || !roads || startCityId === null || endCityId === null) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Missing required parameters' }));
                return;
            }

            // Format graph inputs for C++ stdin:
            // Line 1: [num_cities] [num_roads]
            // Line 2: [cityId1] [cityId2] ... [cityIdN]
            // Next M lines: [fromId] [toId] [distance]
            // Last line: [startId] [endId]
            let cppInput = `${cities.length} ${roads.length}\n`;
            cppInput += cities.map(c => c.id).join(' ') + '\n';
            roads.forEach(r => {
                cppInput += `${r.fromId} ${r.toId} ${r.distance}\n`;
            });
            cppInput += `${startCityId} ${endCityId}\n`;

            console.log(`[Server] Routing request: ${startCityId} ➔ ${endCityId}`);
            console.log(`[Server] Piping input to C++:\n${cppInput.trim()}`);

            // Spawn the C++ headless compiler executable
            const child = spawn(BACKEND_EXE);

            let stdoutData = '';
            let stderrData = '';

            child.stdout.on('data', (data) => {
                stdoutData += data.toString();
            });

            child.stderr.on('data', (data) => {
                stderrData += data.toString();
            });

            child.on('error', (err) => {
                console.error('[C++ Error]', err);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Failed to start C++ pathfinder executable' }));
            });

            child.on('close', (code) => {
                if (code !== 0) {
                    console.error(`[C++ Exit Code] ${code}`, stderrData);
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'C++ calculation process exited with error' }));
                    return;
                }

                console.log(`[C++ Output]:\n${stdoutData.trim()}`);

                // Parse C++ output lines
                const lines = stdoutData.split('\n');
                let status = '';
                let distance = 0;
                let pathList = [];

                lines.forEach(line => {
                    const trimmed = line.trim();
                    if (trimmed.startsWith('STATUS:')) {
                        status = trimmed.substring(7).trim();
                    } else if (trimmed.startsWith('DISTANCE:')) {
                        distance = parseFloat(trimmed.substring(9).trim());
                    } else if (trimmed.startsWith('PATH:')) {
                        const pathStr = trimmed.substring(5).trim();
                        if (pathStr) {
                            pathList = pathStr.split(/\s+/).map(Number);
                        }
                    }
                });

                if (status === 'Success') {
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({
                        success: true,
                        distance: distance,
                        path: pathList
                    }));
                } else if (status === 'No Path Found') {
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({
                        success: false,
                        error: 'No Path Found'
                    }));
                } else {
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({
                        success: false,
                        error: status || 'Dijkstra execution failed'
                    }));
                }
            });

            // Write formatted text data and close stream input
            child.stdin.write(cppInput);
            child.stdin.end();

        } catch (e) {
            console.error('[Server Request Parse Error]', e);
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Invalid JSON request payload' }));
        }
    });
}

// Create Http Server Instance
const server = http.createServer((req, res) => {
    const parsedUrl = new URL(req.url, `http://${req.headers.host}`);
    
    // Route API request
    if (parsedUrl.pathname === '/api/optimize' && req.method === 'POST') {
        handleOptimizeRequest(req, res);
    } else if (req.method === 'GET') {
        serveStaticFile(parsedUrl.pathname, res);
    } else {
        res.writeHead(405, { 'Content-Type': 'text/plain' });
        res.end('Method Not Allowed');
    }
});

// Start Server Listen Loop
server.listen(PORT, () => {
    console.log(`========================================================`);
    console.log(`🚀 Travel Optimizer Server running at http://localhost:${PORT}`);
    console.log(`🖥️  Executing C++ calculations via: ${BACKEND_EXE}`);
    console.log(`========================================================`);
});
