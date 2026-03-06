/**
 * 工作台 HTTP 服务器 - 长时间后台运行，供本机与局域网内他人访问
 * 运行：node server.js  或  npm start
 * 绑定 0.0.0.0，可用本机 IP 访问，建议在路由器或系统中为该设备设置固定 IP 以保持地址不变
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

const PORT = parseInt(process.env.PORT, 10) || 8765;
const ROOT = path.resolve(__dirname);

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
