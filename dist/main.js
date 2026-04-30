/**
 * Electron 主进程：内嵌 HTTP 服务 + 应用窗口，数据保存到用户可配置路径（重装后保留）
 */
const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const http = require('http');
const fs = require('fs');

const MAX_TREE_DEPTH = 10;
const OBSIDIAN_SYNC_FOLDER = 'WorkbenchSync';

let obsidianWatcher = null;
let obsidianNotifyTimer = null;

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
    if (cfg && typeof cfg === 'object') {
      return {
        dataPath: (typeof cfg.dataPath === 'string' && cfg.dataPath) ? cfg.dataPath : path.join(app.getPath('userData'), 'data'),
        obsidianVaultPath: typeof cfg.obsidianVaultPath === 'string' ? cfg.obsidianVaultPath : '',
        obsidianSyncFolder: (typeof cfg.obsidianSyncFolder === 'string' && cfg.obsidianSyncFolder.trim()) ? cfg.obsidianSyncFolder.trim() : OBSIDIAN_SYNC_FOLDER
      };
    }
  } catch (_) {}
  return {
    dataPath: path.join(app.getPath('userData'), 'data'),
    obsidianVaultPath: '',
    obsidianSyncFolder: OBSIDIAN_SYNC_FOLDER
  };
}

function setConfig(cfg) {
  const prev = getConfig();
  const next = {
    dataPath: (cfg && typeof cfg.dataPath === 'string' && cfg.dataPath) ? cfg.dataPath : prev.dataPath,
    obsidianVaultPath: (cfg && typeof cfg.obsidianVaultPath === 'string') ? cfg.obsidianVaultPath : prev.obsidianVaultPath,
    obsidianSyncFolder: (cfg && typeof cfg.obsidianSyncFolder === 'string' && cfg.obsidianSyncFolder.trim()) ? cfg.obsidianSyncFolder.trim() : (prev.obsidianSyncFolder || OBSIDIAN_SYNC_FOLDER)
  };
  const p = getConfigPath();
  const dir = path.dirname(p);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(p, JSON.stringify(next, null, 2), 'utf8');
  restartObsidianWatcher();
}

function ensureDir(dirPath) {
  if (!dirPath) return;
  if (!fs.existsSync(dirPath)) fs.mkdirSync(dirPath, { recursive: true });
}

function getObsidianSyncDir() {
  const cfg = getConfig();
  if (!cfg.obsidianVaultPath) return '';
  return path.join(cfg.obsidianVaultPath, cfg.obsidianSyncFolder || OBSIDIAN_SYNC_FOLDER);
}

function sanitizeFileName(name) {
  return String(name || 'untitled')
    .replace(/[\\/:*?"<>|]/g, '_')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120) || 'untitled';
}

function normalizeLineEndings(text) {
  return String(text || '').replace(/\r\n/g, '\n');
}

function stripFrontmatter(markdown) {
  const normalized = normalizeLineEndings(markdown);
  if (!normalized.startsWith('---\n')) return normalized;
  const end = normalized.indexOf('\n---\n', 4);
  if (end === -1) return normalized;
  return normalized.slice(end + 5);
}

function parseScalar(value) {
  const raw = String(value == null ? '' : value).trim();
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  if (raw === 'null') return null;
  if (/^-?\d+(\.\d+)?$/.test(raw)) return Number(raw);
  return raw.replace(/^['"]|['"]$/g, '');
}

function parseFrontmatter(markdown) {
  const normalized = normalizeLineEndings(markdown);
  if (!normalized.startsWith('---\n')) return { attrs: {}, body: normalized };
  const end = normalized.indexOf('\n---\n', 4);
  if (end === -1) return { attrs: {}, body: normalized };
  const header = normalized.slice(4, end).split('\n');
  const body = normalized.slice(end + 5);
  const attrs = {};
  let currentKey = '';
  header.forEach(line => {
    if (/^\s*-\s+/.test(line) && currentKey) {
      if (!Array.isArray(attrs[currentKey])) attrs[currentKey] = [];
      attrs[currentKey].push(parseScalar(line.replace(/^\s*-\s+/, '')));
      return;
    }
    const match = line.match(/^([A-Za-z0-9_\-]+):\s*(.*)$/);
    if (!match) return;
    currentKey = match[1];
    const rest = match[2];
    if (!rest) {
      attrs[currentKey] = [];
      return;
    }
    attrs[currentKey] = parseScalar(rest);
  });
  return { attrs, body };
}

function noteToFrontmatterMarkdown(note) {
  const tags = Array.isArray(note.tags) ? note.tags.filter(Boolean) : [];
  const lines = [
    '---',
    'id: ' + String(note.id || ''),
    'source: workbench',
    'title: ' + String(note.title || ''),
    'category: ' + String(note.category || ''),
    'author: ' + String(note.author || ''),
    'date: ' + String(note.date || ''),
    'pinned: ' + String(!!note.pinned),
    'views: ' + String(note.views || 0),
    'summary: ' + JSON.stringify(String(note.summary || '')),
    'updatedAt: ' + String(note.updatedAt || new Date().toISOString()),
    'tags:'
  ];
  tags.forEach(tag => lines.push('  - ' + String(tag)));
  lines.push('---', '');
  const body = stripFrontmatter(note.content || '');
  return lines.join('\n') + body;
}

function noteFromMarkdown(filePath, markdown, stat) {
  const parsed = parseFrontmatter(markdown);
  const attrs = parsed.attrs || {};
  const body = parsed.body || '';
  const title = String(attrs.title || '').trim() || path.basename(filePath, '.md');
  const id = String(attrs.id || ('obsidian_' + path.basename(filePath, '.md'))).trim();
  const tags = Array.isArray(attrs.tags)
    ? attrs.tags.map(v => String(v).trim()).filter(Boolean)
    : [];
  const category = String(attrs.category || '').trim() || (tags[0] || '未分类');
  return {
    id,
    title,
    category,
    tags,
    summary: String(attrs.summary || '').trim() || body.split('\n').find(Boolean) || '',
    author: String(attrs.author || 'Obsidian').trim(),
    date: String(attrs.date || new Date((stat && stat.mtimeMs) || Date.now()).toISOString().slice(0, 10)).trim(),
    views: Number(attrs.views || 0) || 0,
    pinned: !!attrs.pinned,
    content: body,
    updatedAt: String(attrs.updatedAt || new Date((stat && stat.mtimeMs) || Date.now()).toISOString()),
    obsidianPath: filePath,
    obsidianMtime: (stat && stat.mtimeMs) || Date.now(),
    obsidianSource: true
  };
}

function readObsidianNotes() {
  const syncDir = getObsidianSyncDir();
  if (!syncDir) return [];
  if (!fs.existsSync(syncDir) || !fs.statSync(syncDir).isDirectory()) return [];
  const files = fs.readdirSync(syncDir, { withFileTypes: true })
    .filter(ent => ent.isFile() && path.extname(ent.name).toLowerCase() === '.md');
  return files.map(ent => {
    const filePath = path.join(syncDir, ent.name);
    const stat = fs.statSync(filePath);
    const markdown = fs.readFileSync(filePath, 'utf8');
    return noteFromMarkdown(filePath, markdown, stat);
  });
}

function writeObsidianNotes(notes) {
  const syncDir = getObsidianSyncDir();
  if (!syncDir) return { success: false, reason: 'not_configured' };
  ensureDir(syncDir);
  const list = Array.isArray(notes) ? notes : [];
  const usedNames = new Set();
  list.forEach(note => {
    if (!note || !note.id) return;
    let fileName = sanitizeFileName(note.title || note.id) + '.md';
    while (usedNames.has(fileName)) {
      fileName = sanitizeFileName((note.title || note.id) + '-' + note.id) + '.md';
    }
    usedNames.add(fileName);
    const filePath = path.join(syncDir, fileName);
    fs.writeFileSync(filePath, noteToFrontmatterMarkdown(note), 'utf8');
  });
  return { success: true, count: list.length, syncDir };
}

function sendObsidianChanged() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  const notes = readObsidianNotes();
  mainWindow.webContents.send('workbench:obsidianChanged', {
    notes,
    ts: Date.now(),
    syncDir: getObsidianSyncDir()
  });
}

function scheduleObsidianChanged() {
  if (obsidianNotifyTimer) clearTimeout(obsidianNotifyTimer);
  obsidianNotifyTimer = setTimeout(() => {
    obsidianNotifyTimer = null;
    try {
      sendObsidianChanged();
    } catch (e) {
      console.error('[Obsidian] notify failed', e);
    }
  }, 350);
}

function restartObsidianWatcher() {
  if (obsidianWatcher) {
    try { obsidianWatcher.close(); } catch (_) {}
    obsidianWatcher = null;
  }
  const syncDir = getObsidianSyncDir();
  if (!syncDir) return;
  ensureDir(syncDir);
  try {
    obsidianWatcher = fs.watch(syncDir, { persistent: false }, () => {
      scheduleObsidianChanged();
    });
  } catch (e) {
    console.error('[Obsidian] watch failed', e);
  }
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
  if (cfg && typeof cfg === 'object') setConfig(cfg);
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
ipcMain.handle('workbench:chooseObsidianVaultPath', async () => {
  const win = BrowserWindow.getFocusedWindow();
  const result = await dialog.showOpenDialog(win || null, {
    properties: ['openDirectory', 'createDirectory'],
    title: '选择 Obsidian Vault 目录'
  });
  if (result.canceled || !result.filePaths.length) return null;
  return result.filePaths[0];
});
ipcMain.handle('workbench:obsidianReadNotes', () => {
  const notes = readObsidianNotes();
  return { notes, ts: Date.now(), syncDir: getObsidianSyncDir() };
});
ipcMain.handle('workbench:obsidianWriteNotes', (_, notes) => writeObsidianNotes(notes));

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
      const rawUrl = req.url || '/';
      const requestPath = rawUrl.split('?')[0] || '/';
      // 默认进入更亮眼的 Portal，保留 /workbench 直达原工作台，降低用户操作成本。
      let url = requestPath === '/' ? '/portal.html' : requestPath;
      if (url === '/portal') url = '/portal.html';
      if (url === '/workbench') url = '/index.html';
      const safePath = path.normalize(url).replace(/^(\.\.(\/|\\|$))+/, '');
      const filePath = path.join(ROOT, safePath);
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
  win.loadURL('http://localhost:' + PORT + '/portal.html');
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
    restartObsidianWatcher();
  } catch (e) {
    console.error(e);
    app.quit();
  }
});

app.on('window-all-closed', () => {
  if (obsidianWatcher) {
    try { obsidianWatcher.close(); } catch (_) {}
    obsidianWatcher = null;
  }
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
