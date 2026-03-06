/**
 * Electron 主进程：内嵌 HTTP 服务 + 应用窗口，数据保存到用户可配置路径（重装后保留）
 */
const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const http = require('http');
const fs = require('fs');

const MAX_TREE_DEPTH = 10;

function readDirTree(dirPath, depth) {
  if (depth <= 0) return [];
  try {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    return entries.map(ent => {
      const fullPath = path.join(dirPath, ent.name);
      const node = { name: ent.name, type: ent.isDirectory() ? 'folder' : 'file', path: fullPath };
      if (ent.isDirectory() && depth > 1) {
        try {
          node.children = readDirTree(fullPath, depth - 1);
        } catch (_) {
          node.children = [];
        }
      }
      return node;
    }).filter(n => n.name !== '.' && n.name !== '..');
  } catch (_) {
    return [];
  }
}

const PORT = 8765;
const ROOT = __dirname;

// 配置与数据路径：config 固定放在 userData，数据目录由用户设置（默认 userData/data）
function getConfigPath() {
  return path.join(app.getPath('userData'), 'config.json');
}

function getConfig() {
  try {
    const p = getConfigPath();
    const raw = fs.readFileSync(p, 'utf8');
    const cfg = JSON.parse(raw);
    if (cfg && typeof cfg.dataPath === 'string' && cfg.dataPath) return cfg;
  } catch (_) {}
  return { dataPath: path.join(app.getPath('userData'), 'data') };
}

function setConfig(cfg) {
  const p = getConfigPath();
  const dir = path.dirname(p);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(p, JSON.stringify({ dataPath: cfg.dataPath }, null, 2), 'utf8');
}

function getStatePath() {
  const cfg = getConfig();
  const dataDir = cfg.dataPath;
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
  return path.join(dataDir, 'state.json');
}

function loadState() {
  try {
    const p = getStatePath();
    const raw = fs.readFileSync(p, 'utf8');
    return JSON.parse(raw);
  } catch (_) {}
  return null;
}

function saveState(state) {
  try {
    const p = getStatePath();
    const dir = path.dirname(p);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(p, JSON.stringify(state, null, 2), 'utf8');
    return true;
  } catch (e) {
    console.error(e);
    return false;
  }
}

ipcMain.handle('workbench:getConfig', () => getConfig());
ipcMain.handle('workbench:setConfig', (_, cfg) => {
  if (cfg && typeof cfg.dataPath === 'string') setConfig(cfg);
});
ipcMain.handle('workbench:loadState', () => loadState());
ipcMain.handle('workbench:saveState', (_, state) => saveState(state));
ipcMain.handle('workbench:chooseDataPath', async () => {
  const win = BrowserWindow.getFocusedWindow();
  const result = await dialog.showOpenDialog(win || null, {
    properties: ['openDirectory', 'createDirectory'],
    title: '选择数据保存目录'
  });
  if (result.canceled || !result.filePaths.length) return null;
  return result.filePaths[0];
});

ipcMain.handle('workbench:getMappedFolderTree', (_, dirPath) => {
  if (!dirPath || typeof dirPath !== 'string') return [];
  const normalized = path.normalize(dirPath.trim());
  if (!fs.existsSync(normalized) || !fs.statSync(normalized).isDirectory()) return [];
  return readDirTree(normalized, MAX_TREE_DEPTH);
});

ipcMain.handle('workbench:openPath', (_, filePath) => {
  if (!filePath || typeof filePath !== 'string') return { error: 'invalid' };
  return shell.openPath(path.normalize(filePath));
});

const MIMES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.ico': 'image/x-icon',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.json': 'application/json',
  '.md': 'text/plain; charset=utf-8'
};

function createServer() {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      let url = req.url === '/' ? '/index.html' : path.normalize(req.url).replace(/^(\.\.(\/|\\|$))+/, '');
      const filePath = path.join(ROOT, url.split('?')[0]);
      if (!filePath.startsWith(ROOT)) {
        res.writeHead(403);
        res.end();
        return;
      }
      fs.readFile(filePath, (err, data) => {
        if (err) {
          res.writeHead(err.code === 'ENOENT' ? 404 : 500);
          res.end(err.code === 'ENOENT' ? 'Not Found' : 'Server Error');
          return;
        }
        const ext = path.extname(filePath);
        res.setHeader('Content-Type', MIMES[ext] || 'application/octet-stream');
        res.writeHead(200);
        res.end(data);
      });
    });
    server.listen(PORT, '0.0.0.0', () => resolve(server));
    server.on('error', reject);
  });
}

function createWindow(server) {
  const win = new BrowserWindow({
    width: 1000,
    height: 700,
    minWidth: 400,
    minHeight: 300,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },
    show: false
  });
  win.loadURL('http://localhost:' + PORT + '/');
  win.once('ready-to-show', () => win.show());
  win.on('closed', () => { if (server) server.close(); });
  return win;
}

let mainWindow = null;
let httpServer = null;

app.whenReady().then(async () => {
  try {
    httpServer = await createServer();
    mainWindow = createWindow(httpServer);
  } catch (e) {
    console.error(e);
    app.quit();
  }
});

app.on('window-all-closed', () => {
  if (httpServer) httpServer.close();
  app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createServer().then(s => {
      httpServer = s;
      mainWindow = createWindow(httpServer);
    });
  }
});
