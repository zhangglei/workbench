/**
 * 工作台 HTTP 服务器 - 长时间后台运行，供本机与局域网内他人访问
 * 运行：node server.js  或  npm start
 * 绑定 0.0.0.0，可用本机 IP 访问，建议在路由器或系统中为该设备设置固定 IP 以保持地址不变
 *
 * API 接口（供多设备数据同步）：
 *   GET  /api/workbench-state    — 读取工作台状态
 *   POST /api/workbench-state    — 保存工作台状态
 *   GET  /api/knowledge-state    — 读取知识库笔记
 *   POST /api/knowledge-state    — 保存知识库笔记
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

const PORT = parseInt(process.env.PORT, 10) || 8765;
const ROOT = path.resolve(__dirname);

/* 数据文件存储目录（与 server.js 同级的 data/ 目录） */
const DATA_DIR = path.join(ROOT, 'data');
const WORKBENCH_STATE_FILE = path.join(DATA_DIR, 'workbench-state.json');
const KNOWLEDGE_STATE_FILE = path.join(DATA_DIR, 'knowledge-state.json');

/* 确保 data 目录存在 */
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const CORS_HEADERS = {
  'Content-Type': 'application/json; charset=utf-8',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
};

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

function getLocalIPs() {
  const ifaces = os.networkInterfaces();
  const ips = [];
  for (const name of Object.keys(ifaces)) {
    for (const iface of ifaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) ips.push(iface.address);
    }
  }
  return ips;
}

/* 读取 JSON 数据文件，失败返回 null */
function readDataFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(content);
  } catch (_) {
    return null;
  }
}

/* 写入 JSON 数据文件 */
function writeDataFile(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data), 'utf-8');
}

/* 收集 POST 请求体 */
function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', chunk => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
    req.on('error', reject);
  });
}

/* 处理 API 请求，返回 true 表示已处理 */
async function handleApi(req, res) {
  const urlPath = req.url.split('?')[0];
  const method = req.method.toUpperCase();

  /* CORS 预检 */
  if (method === 'OPTIONS') {
    res.writeHead(204, CORS_HEADERS);
    res.end();
    return true;
  }

  let dataFile = null;
  if (urlPath === '/api/workbench-state') dataFile = WORKBENCH_STATE_FILE;
  else if (urlPath === '/api/knowledge-state') dataFile = KNOWLEDGE_STATE_FILE;

  if (!dataFile) return false;

  if (method === 'GET') {
    const data = readDataFile(dataFile);
    res.writeHead(200, CORS_HEADERS);
    res.end(JSON.stringify(data || {}));
    return true;
  }

  if (method === 'POST') {
    try {
      const body = await readBody(req);
      const data = JSON.parse(body);
      writeDataFile(dataFile, data);
      res.writeHead(200, CORS_HEADERS);
      res.end(JSON.stringify({ success: true }));
    } catch (e) {
      res.writeHead(400, CORS_HEADERS);
      res.end(JSON.stringify({ error: String(e.message || e) }));
    }
    return true;
  }

  res.writeHead(405, CORS_HEADERS);
  res.end(JSON.stringify({ error: 'Method not allowed' }));
  return true;
}

const server = http.createServer(async (req, res) => {
  /* 优先处理 API 请求 */
  if (await handleApi(req, res)) return;

  let url = req.url === '/' ? '/index.html' : path.normalize(req.url).replace(/^(\.\.(\/|\\|$))+/, '');
  const filePath = path.join(ROOT, url.split('?')[0]);

  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403);
    res.end();
    return;
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      if (err.code === 'ENOENT') {
        res.writeHead(404);
        res.end('Not Found');
        return;
      }
      res.writeHead(500);
      res.end('Server Error');
      return;
    }
    const ext = path.extname(filePath);
    const contentType = MIMES[ext] || 'application/octet-stream';
    res.setHeader('Content-Type', contentType);
    res.writeHead(200);
    res.end(data);
  });
});

server.listen(PORT, '0.0.0.0', () => {
  const ips = getLocalIPs();
  console.log('');
  console.log('  工作台已启动，可长期在后台运行');
  console.log('  本机访问:  http://localhost:' + PORT);
  if (ips.length) {
    console.log('  局域网访问（他人可访问）:');
    ips.forEach(ip => console.log('    http://' + ip + ':' + PORT));
    console.log('');
    console.log('  建议在路由器中为本机设置「固定 IP / DHCP 保留」，这样上述地址不会变。');
  }
  console.log('  按 Ctrl+C 停止服务');
  console.log('');
});

server.on('error', err => {
  if (err.code === 'EADDRINUSE') {
    console.error('端口 ' + PORT + ' 已被占用，可设置环境变量 PORT 换端口，例如: set PORT=9000 && node server.js');
  } else {
    console.error(err);
  }
  process.exit(1);
});
