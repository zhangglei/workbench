# Cloudflare Pages 部署指南

## 部署步骤

### 1. 本地测试构建（可选）
```bash
npm install
npm run build
```

### 2. 推送代码到 GitHub/GitLab/Bitbucket
确保以下文件已提交：
- `wrangler.toml` ✓ 构建配置
- `package.json` ✓ 依赖和脚本
- `copy-static.js` ✓ 构建脚本
- `.gitignore` ✓ 忽略不必要的文件

### 3. 在 Cloudflare Dashboard 配置

**关键配置（已自动处理）：**
- **Build command**: `npm install && npm run build`
- **Build output directory**: `dist`
- **Root directory**: `/`

### 4. 分支设置

推荐配置：
- **Production branch**: `main`（自动部署）
- **Preview branches**: 其他分支（用于预览）

### 5. 自动构建

提交代码后，Cloudflare Pages 会自动：
1. 运行 `npm install` 安装依赖
2. 运行 `npm run build` 执行构建脚本
3. 将 `dist` 目录内容部署为静态网站

## 故障排除

### 问题：构建失败
- 检查 Cloudflare Dashboard 的 Deployments → Build logs
- 确保 `copy-static.js` 没有错误
- 验证所有必需的文件都已上传

### 问题：缺少文件
- 确保 `wrangler.toml`、`package.json`、`copy-static.js` 在根目录
- 检查 `.gitignore` 是否排除了重要文件

### 问题：404 错误
- 确保 `index.html` 在 `dist` 目录中
- 检查 `publish` 字段指向正确的目录（应为 `dist`）

## 环境变量（如需要）

在 Cloudflare Dashboard 的 Settings → Environment variables 中添加：
```
CF_PAGES=1
```

## 更新依赖

如果需要更新依赖的安全漏洞，建议：
```bash
npm audit fix
# 测试无误后再提交
git push
```

## 本地开发

- **开发服务器**: `npm run serve`
- **Electron 应用**: `npm start`
- **桌面应用打包**: `npm run build:win`

---

新配置已优化，应该能直接部署到 Cloudflare Pages ✓
