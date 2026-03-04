# 我的工作台

在电脑和手机上均可使用的网页工作台，支持自定义排版、添加模块、添加网页、配置别名和更换背景。  
**可部署到公网：一个地址一直在线，无需本地安装、无需本机后台运行。**

---

## 一、公网部署（推荐：地址一直在线，无需本地安装与后台）

把工作台放到公网后，**任意设备**用浏览器打开该地址即可使用，不依赖您本机是否开机、是否安装软件或是否在后台运行。

| 特点 | 说明 |
|------|------|
| 一直在线 | 由托管平台（如 GitHub / Netlify）提供，不依赖您电脑 |
| 无需本地安装 | 不装 exe、不装 Node，浏览器打开即用 |
| 无需后台运行 | 本机不用开任何程序，手机/别处电脑也能访问 |

**需要上传的文件**：  
- **Netlify（推荐）**：整份项目（含 `netlify.toml`、`netlify/functions/`、`package.json`），数据会同步到云端，**任意设备、任意网段**打开同一地址都能看到同一份工作台内容。  
- **其他静态托管**：仅需 `index.html`、`styles.css`、`app.js`、`manifest.json`（可选：`icon-192.png`、`icon-512.png`），数据仅保存在当前浏览器本地（localStorage），换设备会看不到。

**数据说明**：  
- **部署在 Netlify 且包含 Functions**：数据会保存到 Netlify Blobs，本机添加的模块/网页在所有设备、所有网段打开该网页都能访问到。  
- **仅静态页（GitHub Pages、本地打开 index.html 等）**：数据只在当前浏览器本地（localStorage），换设备或换浏览器会看到空白。

### 方式 1：GitHub Pages（免费）

1. 在 [GitHub](https://github.com) 新建仓库（如 `workbench`），把上述文件推上去（或只上传这几个文件）。
2. 仓库 **Settings → Pages**：Source 选 **Deploy from a branch**，Branch 选 `main`，目录选 `/ (root)`，保存。
3. 几分钟后访问：**https://你的用户名.github.io/workbench/**（若仓库名为 `workbench`）。

### 方式 2：Netlify（免费，推荐：支持云端同步，多设备共享数据）

**重要**：**只有用「从 Git 部署」才会发布云端接口**；用拖拽更新只会更新网页文件，其他电脑/网段仍然看不到你添加的数据。若你当前是拖拽部署，请按下面「启用云端同步」改为 Git 部署。

1. 打开 [Netlify](https://www.netlify.com) 并登录。
2. **启用云端同步（必须用 Git）**：  
   - 在 [GitHub](https://github.com) 或 GitLab 新建仓库，把**整个项目**（含 `netlify.toml`、`netlify/functions/`、`package.json`、`index.html`、`app.js`、`styles.css` 等）推上去。  
   - Netlify 中：**Add new site → Import an existing project**，选择该 Git 仓库。  
   - **Build command**：留空。  
   - **Publish directory**：填 **`.`**（根目录）。  
   - 保存并部署。  
3. 部署完成后，打开你的 **https://xxx.netlify.app**，**任意设备、任意网段**都会看到同一份工作台数据。  
   **若站点之前是拖拽创建的**：在 Netlify 里进入该站点 → **Site configuration → Build & deploy → Link repository**，关联你的 GitHub/GitLab 仓库并保存，再在 **Deploys** 里点 **Trigger deploy**，即可在不改网址的前提下启用云端同步。  
   若页面上出现「当前为本地模式」的提示，说明云端接口未生效：请确认已用 Git 关联、仓库中包含 `netlify/functions/workbench-state.mjs`（云端使用 Netlify Functions 2.0 + Blobs，该格式下 Blobs 会自动配置），并在 Netlify 的 **Functions** 页查看该函数是否部署成功。

### 方式 3：Vercel（免费）

1. 打开 [Vercel](https://vercel.com) 并登录，选择 “Add New Project”。
2. 导入你的 Git 仓库（或用 Vercel CLI 在项目目录执行 `vercel` 上传）。
3. 若为纯静态：Build 命令留空，输出目录填 `.` 或留空，部署即可。
4. 会得到 **https://xxx.vercel.app** 这样的公网地址。

### 方式 4：Cloudflare Pages（免费）

1. 打开 [Cloudflare Pages](https://pages.cloudflare.com)，Create a project → 选择 “Direct Upload”。
2. 打包当前项目里上述静态文件为一个 zip，上传。
3. 部署完成后得到 **https://xxx.pages.dev**，即为公网入口。

部署完成后，用手机或任意电脑浏览器打开该地址即可使用，无需在本机安装程序或保持后台运行。

---

## 二、Windows 安装（无需执行命令）

### 使用安装包

- 若已有 **`我的工作台 Setup 1.0.0.exe`**（在 `dist` 文件夹内），**双击该文件**即可安装，无需打开命令行或输入任何命令。
- 安装完成后，从开始菜单或桌面快捷方式打开「我的工作台」。

### 自己生成安装包

- 在本项目文件夹中**双击运行「构建安装包.bat」**，等待完成即可（首次会下载依赖，无需手动执行 npm 命令）。
- 完成后会在 **`dist`** 文件夹内生成：
  - **我的工作台 Setup 1.0.0.exe** — 安装版，双击安装；
  - **我的工作台 1.0.0.exe** — 便携版，无需安装，直接运行。

> 生成安装包前需在本机安装 [Node.js](https://nodejs.org)，仅构建时需要，安装后的用户无需安装。

---

## 三、数据保存路径与重装保留

- 安装版/便携版运行后，**所有修改（排版、背景、模块、网页）都会保存到您自己配置的目录**，重装软件后只要仍使用同一目录，内容会保留。
- **配置方式**：打开工作台 → 右上角 **⚙️ 设置** → 底部 **「数据保存路径」**：
  - 可查看当前数据目录；
  - 点击 **「选择文件夹」** 可改为其他目录（如 `D:\工作台数据`），确定后数据将保存到新目录，下次重装时选择同一目录即可恢复。
- **默认路径**：未修改时，数据保存在系统用户目录下（如 `%APPDATA%\workbench\data`），重装后默认会继续使用该路径，因此**不修改路径时重装也会保留数据**。

---

## 四、手机安装（PWA）

- **若已公网部署**：在手机浏览器打开你的公网地址（如 `https://xxx.netlify.app`），再选择「添加到主屏幕」即可，无需电脑在线。
- **若用本机服务**：在电脑上先运行工作台（桌面版或 **`start.vbs`**），手机与电脑同一 WiFi，浏览器访问 **http://电脑的IP:8765**，再「添加到主屏幕」。

---

## 五、可执行程序（仅 Windows 后台运行）

不需要桌面窗口、只要后台服务时：

| 操作 | 做法 |
|------|------|
| 启动服务（后台无窗口） | 双击 **`start.vbs`** |
| 停止服务 | 双击 **`stop-server.bat`** |
| 安装“上电自启动” | 双击 **`install-autostart.bat`** |
| 取消开机自启 | 双击 **`uninstall-autostart.bat`** |

本机访问 **http://localhost:8765**；他人同一 WiFi 下访问 **http://本机IP:8765**。

---

## 六、网页功能说明

| 功能 | 说明 |
|------|------|
| 排版 | 右上角 ⚙️ → 排版：列数(1–6)、间距、对齐 |
| 背景 | 设置 → 背景：纯色 / 图片（资源库、本地上传、自定义地址）/ 渐变 |
| 数据保存路径 | 设置 → 数据保存路径（仅桌面版可见）：查看或选择文件夹，重装后从该目录恢复 |
| 添加模块 / 网页 | 底部「+ 添加模块」「+ 添加网页」；卡片上 ✏️ 编辑、🗑️ 删除 |

桌面版数据保存在您配置的目录；**Netlify 部署且含 Functions** 时，浏览器访问的数据会同步到云端（所有设备共享）；仅静态页或本地打开时，数据保存在浏览器本地（localStorage）。

---

## 七、仅本机打开（不对外提供访问）

若不需要他人访问，只在本机用浏览器打开 **`index.html`** 即可，无需运行服务器。
