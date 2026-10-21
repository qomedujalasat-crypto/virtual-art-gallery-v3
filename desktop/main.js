const { app, BrowserWindow } = require('electron');
const http = require('http');
const fs = require('fs');
const path = require('path');

let server;
let mainWindow;

const galleryRoot = path.join(app.getAppPath(), 'gallery');
const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml'
};

function startLocalServer() {
  return new Promise((resolve, reject) => {
    server = http.createServer((req, res) => {
      let requestPath;
      try {
        requestPath = decodeURIComponent(new URL(req.url, 'http://127.0.0.1').pathname);
      } catch (_) {
        res.writeHead(400);
        res.end('Bad request');
        return;
      }

      if (requestPath === '/') requestPath = '/build.html';
      const filePath = path.resolve(galleryRoot, '.' + requestPath);
      if (filePath !== galleryRoot && !filePath.startsWith(galleryRoot + path.sep)) {
        res.writeHead(403);
        res.end('Forbidden');
        return;
      }

      fs.readFile(filePath, (error, data) => {
        if (error) {
          res.writeHead(error.code === 'ENOENT' ? 404 : 500);
          res.end('File unavailable');
          return;
        }
        res.writeHead(200, {
          'Content-Type': mimeTypes[path.extname(filePath).toLowerCase()] || 'application/octet-stream',
          'Cache-Control': 'no-store',
          'X-Content-Type-Options': 'nosniff'
        });
        res.end(data);
      });
    });

    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      resolve('http://127.0.0.1:' + address.port + '/build.html');
    });
  });
}

async function createWindow() {
  const url = await startLocalServer();
  mainWindow = new BrowserWindow({
    width: 1360,
    height: 850,
    minWidth: 900,
    minHeight: 600,
    show: false,
    backgroundColor: '#171717',
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  mainWindow.once('ready-to-show', () => mainWindow.show());
  mainWindow.on('closed', () => { mainWindow = null; });
  await mainWindow.loadURL(url);
}

app.whenReady().then(createWindow).catch(error => {
  console.error('Unable to start the offline gallery:', error);
  app.quit();
});

app.on('window-all-closed', () => {
  if (server) server.close();
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
  if (server) server.close();
});
