const fs = require('fs');
const path = require('path');

const srcDir = __dirname;
const destDir = path.join(srcDir, 'dist');

// 确保 dist 目录存在
if (!fs.existsSync(destDir)) {
  fs.mkdirSync(destDir, { recursive: true });
}

// 要复制的文件列表
const filesToCopy = [
  'index.html',
  'app.js',
  'styles.css',
  'manifest.json',
  'preload.js',
  'main.js',
  'server.js',
  'server.py',
  'start.bat',
  'start.vbs',
  'stop-server.bat',
  'install-autostart.bat',
  'uninstall-autostart.bat',
  '构建安装包.bat',
  'netlify.toml',
  'README.md',
  'wrangler.toml'
];

// 图标文件
const iconFiles = ['icon-192.png', 'icon-512.png'];
iconFiles.forEach(icon => {
  if (fs.existsSync(path.join(srcDir, icon))) {
    filesToCopy.push(icon);
  }
});

// 复制文件
filesToCopy.forEach(file => {
  const src = path.join(srcDir, file);
  const dest = path.join(destDir, file);
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, dest);
    console.log(`Copied ${file}`);
  } else {
    console.warn(`File ${file} does not exist, skipping`);
  }
});

// 复制 api 目录（如果存在）
const apiDir = path.join(srcDir, 'api');
if (fs.existsSync(apiDir)) {
  const destApiDir = path.join(destDir, 'api');
  copyDirRecursive(apiDir, destApiDir);
}

// 复制 netlify/functions 目录（如果存在）
// 如果是 Cloudflare Pages 部署，跳过复制函数目录
if (!process.env.CF_PAGES && !process.env.CLOUDFLARE_PAGES) {
  const netlifyFunctionsDir = path.join(srcDir, 'netlify', 'functions');
  if (fs.existsSync(netlifyFunctionsDir)) {
    const destNetlifyFunctionsDir = path.join(destDir, 'netlify', 'functions');
    copyDirRecursive(netlifyFunctionsDir, destNetlifyFunctionsDir);
  }
}

console.log('Build completed!');

// 递归复制目录
function copyDirRecursive(src, dest) {
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirRecursive(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}