# 当前工程优化优先级计划

## 1. 评估口径

本计划按两个维度排序：

| 维度 | 说明 | 高分含义 |
|---|---|---|
| 重要程度 | 对功能可用性、安全、数据可靠性、发布稳定性的影响 | 不处理可能导致安装包不可用、数据被覆盖、安全暴露或启动失败 |
| 优化收益 | 对性能、体验、维护成本、后续扩展的提升幅度 | 处理后能明显减少卡顿、降低维护复杂度、减少线上问题 |

综合排序规则：

1. 先处理会导致功能不可用、数据风险、安全风险的问题。
2. 再处理能明显改善首屏性能和用户体验的问题。
3. 最后处理架构治理、代码安全分级、长期可维护性问题。

---

## 2. 总体优先级总览

| 优先级 | 优化项 | 重要程度 | 优化收益 | 推荐顺序 | 主要涉及文件 |
|---|---|---:|---:|---:|---|
| P0 | Electron 打包资源清单补全 | 5 | 5 | 1 | [`package.json`](../package.json:18)、[`index.html`](../index.html:504) |
| P0 | 局域网 API 鉴权与请求体限制 | 5 | 4 | 2 | [`server.js`](../server.js:31)、[`server.js`](../server.js:77)、[`server.js`](../server.js:162) |
| P1 | Electron 固定端口冲突处理 | 4 | 4 | 3 | [`main.js`](../main.js:36)、[`main.js`](../main.js:391) |
| P1 | 数据持久化原子写与版本校验 | 5 | 3 | 4 | [`modules/workbench-persist.js`](../modules/workbench-persist.js:93)、[`main.js`](../main.js:284)、[`knowledge.js`](../knowledge.js:601) |
| P1 | 首屏脚本延迟加载与入口瘦身 | 4 | 5 | 5 | [`index.html`](../index.html:504)、[`app.js`](../app.js)、[`knowledge.js`](../knowledge.js) |
| P2 | 新旧架构边界梳理与收敛 | 3 | 5 | 6 | [`src/core/app.js`](../src/core/app.js:11)、[`app.js`](../app.js)、[`modules/state.js`](../modules/state.js:10) |
| P2 | [`innerHTML`](../app.js:729) 安全分级与 Markdown 白名单 | 4 | 3 | 7 | [`app.js`](../app.js:729)、[`knowledge.js`](../knowledge.js:1116)、[`knowledge.js`](../knowledge.js:1223) |
| P2 | 构建目录与安装包输出目录拆分 | 3 | 4 | 8 | [`copy-static.js`](../copy-static.js:4)、[`package.json`](../package.json:17)、[`dist`](../dist) |
| P3 | Obsidian 同步改为异步队列 | 3 | 3 | 9 | [`main.js`](../main.js:196)、[`main.js`](../main.js:210)、[`knowledge.js`](../knowledge.js:601) |
| P3 | 调试日志开关与生产日志收敛 | 2 | 2 | 10 | [`src/core/app.js`](../src/core/app.js:12)、[`src/utils/storage.js`](../src/utils/storage.js:296) |

---

## 3. P0 必须优先处理

### 3.1 Electron 打包资源清单补全

#### 现状

[`index.html`](../index.html:504) 实际加载大量资源，包括：

- [`src/core/event-bus.js`](../src/core/event-bus.js)
- [`src/core/state-manager.js`](../src/core/state-manager.js)
- [`src/core/router.js`](../src/core/router.js)
- [`src/components/ui/button.js`](../src/components/ui/button.js)
- [`modules/workbench-persist.js`](../modules/workbench-persist.js)
- [`knowledge.js`](../knowledge.js)
- [`ui-enhancements.js`](../ui-enhancements.js)
- [`theme-glass.css`](../theme-glass.css)
- [`theme-glass.js`](../theme-glass.js)

但 [`package.json`](../package.json:18) 当前 Electron 打包清单只包含少量核心文件，缺少 [`src`](../src)、[`modules`](../modules)、[`knowledge.js`](../knowledge.js)、[`theme-glass.css`](../theme-glass.css)、[`theme-glass.js`](../theme-glass.js)、[`ui-enhancements.js`](../ui-enhancements.js) 等。

#### 风险

- 开发环境正常，安装包运行缺样式或缺脚本。
- 知识库、主题增强、V2 组件可能在安装包内失效。
- 后续修 Bug 可能误判为运行时问题，实际是资源未打包。

#### 建议方案

补全 [`package.json`](../package.json:18) 的 Electron 打包资源清单，至少包含：

- [`modules/**/*`](../modules)
- [`src/**/*`](../src)
- [`knowledge.js`](../knowledge.js)
- [`ui-enhancements.js`](../ui-enhancements.js)
- [`theme-glass.css`](../theme-glass.css)
- [`theme-glass.js`](../theme-glass.js)
- [`settings.html`](../settings.html)
- [`settings-page.js`](../settings-page.js)
- [`settings.css`](../settings.css)

#### 验收标准

- 安装包内能正常打开首页。
- 安装包内知识库可打开。
- 安装包内主题样式正常。
- 控制台不再出现本地资源 404。

---

### 3.2 局域网 API 鉴权与请求体限制

#### 现状

[`server.js`](../server.js:162) 监听局域网地址，且 [`server.js`](../server.js:31) 设置跨域开放。接口包括：

- [`/api/workbench-state`](../server.js:99)
- [`/api/knowledge-state`](../server.js:100)

[`server.js`](../server.js:77) 读取请求体时没有大小限制。

#### 风险

- 局域网内任意设备可能读写工作台数据。
- 恶意页面可能利用跨源策略写入数据。
- 大请求体可能造成内存压力。

#### 建议方案

1. 增加简单访问令牌。
2. 写接口要求请求头携带令牌。
3. 请求体增加最大大小限制。
4. 默认只监听本机，需要共享时再显式开启局域网模式。

#### 验收标准

- 未携带令牌时写接口返回拒绝。
- 超过请求体大小限制时返回拒绝。
- 本机正常读写不受影响。

---

## 4. P1 高收益优化

### 4.1 Electron 固定端口冲突处理

#### 现状

[`main.js`](../main.js:36) 固定使用端口，窗口加载地址位于 [`main.js`](../main.js:391)。

#### 风险

- 端口被占用时应用启动失败。
- 多开应用时容易失败。
- 用户只能看到应用退出，缺少明确提示。

#### 建议方案

优先级从低侵入到高改造：

1. 启动失败时弹出明确错误提示。
2. 端口被占用时自动尝试下一个端口。
3. 长期可考虑改为本地文件加载，减少内置 HTTP 服务依赖。

#### 验收标准

- 端口被占用时不直接静默退出。
- 自动换端口后应用可正常打开。

---

### 4.2 数据持久化原子写与版本校验

#### 现状

状态保存分布在：

- [`modules/workbench-persist.js`](../modules/workbench-persist.js:93)
- [`main.js`](../main.js:284)
- [`knowledge.js`](../knowledge.js:601)

#### 风险

- 多窗口或多设备写入可能互相覆盖。
- 直接写文件时异常中断可能产生损坏文件。
- 同步失败多数只写日志，用户无感知。

#### 建议方案

1. 文件写入改为临时文件再重命名。
2. 保存前比较版本时间戳。
3. 旧数据覆盖新数据时拒绝或提示冲突。
4. 同步失败时在 UI 上显示状态。

#### 验收标准

- 异常中断不产生半截 JSON。
- 旧状态不会覆盖新状态。
- 用户能看到同步失败提示。

---

### 4.3 首屏脚本延迟加载与入口瘦身

#### 现状

[`index.html`](../index.html:504) 到 [`index.html`](../index.html:556) 同步加载大量脚本。当前首页刷新性能问题已经修过一部分，但入口仍然较重。

#### 风险

- 首屏解析和执行耗时偏高。
- 未进入知识库时也会加载知识库逻辑。
- V2 组件库脚本可能有部分未使用。

#### 建议方案

1. 知识库脚本按需加载或延迟初始化。
2. 非首屏 UI 组件延迟加载。
3. 保留当前最小稳定入口，避免一次性大重构。
4. 后续再考虑构建合并压缩。

#### 验收标准

- 首屏脚本数量减少。
- 刷新后首屏可交互时间缩短。
- 知识库切换后功能仍正常。

---

## 5. P2 架构和安全治理

### 5.1 新旧架构边界梳理与收敛

#### 现状

当前同时存在：

- [`src/core/app.js`](../src/core/app.js:11)
- [`src/core/router.js`](../src/core/router.js)
- [`src/core/state-manager.js`](../src/core/state-manager.js)
- [`app.js`](../app.js)
- [`knowledge.js`](../knowledge.js)
- [`modules/state.js`](../modules/state.js:10)

#### 风险

- 状态入口多。
- 事件链路不清晰。
- 新功能不知道该接入新架构还是旧架构。

#### 建议方案

先文档化边界，再逐步收敛：

1. 明确当前主运行入口仍是 [`app.js`](../app.js)。
2. 标注 [`src`](../src) 中哪些文件已真实参与运行。
3. 后续新功能统一接入一个状态与事件体系。

#### 验收标准

- 开发者能明确知道功能入口。
- 新增功能不再重复接入两套状态系统。

---

### 5.2 [`innerHTML`](../app.js:729) 安全分级与 Markdown 白名单

#### 现状

多个位置使用 HTML 字符串拼接：

- [`renderCommandPalette()`](../app.js:710)
- [`renderRecentActivity()`](../app.js:887)
- [`renderNoteList()`](../knowledge.js:1088)
- [`bodyEl.innerHTML`](../knowledge.js:1223)

部分位置已经使用 [`escapeHtml()`](../app.js:386)，但建议统一分级。

#### 风险

- 用户输入、Markdown、模板字符串混合时容易遗漏转义。
- 后续新增字段时可能引入 XSS 风险。

#### 建议方案

1. 对所有 HTML 写入点标注来源。
2. 用户输入必须统一转义。
3. Markdown 渲染结果增加白名单清洗。
4. 高频列表逐步改为 DOM API 或安全模板函数。

#### 验收标准

- 用户输入不会直接进入 HTML。
- Markdown 危险标签被过滤。
- 新增 HTML 写入点有统一规范。

---

### 5.3 构建目录与安装包输出目录拆分

#### 现状

[`copy-static.js`](../copy-static.js:4) 复制到 [`dist`](../dist)，而 [`package.json`](../package.json:17) 也把 Electron 输出目录设为 [`dist`](../dist)。

#### 风险

- 静态 Web 产物和安装包产物混在一起。
- 搜索结果中 [`dist/app.js`](../dist/app.js) 与 [`app.js`](../app.js) 同时出现，容易误改。
- 构建时可能覆盖手工修改。

#### 建议方案

1. Web 静态产物输出到 `build`。
2. Electron 安装包输出到 `release`。
3. 搜索、格式化、检查默认排除 [`dist`](../dist)。

#### 验收标准

- 源码、Web 构建产物、安装包产物边界清楚。
- 搜索结果不再被构建产物干扰。

---

## 6. P3 长期优化

### 6.1 Obsidian 同步改为异步队列

#### 现状

[`main.js`](../main.js:196) 和 [`main.js`](../main.js:210) 使用同步文件 API 读取和写入 Obsidian 笔记。

#### 风险

- 笔记多时可能阻塞主进程。
- 快速连续变更时可能频繁同步。

#### 建议方案

1. 改用异步文件 API。
2. 增加同步队列。
3. 对连续文件变更做合并处理。

#### 验收标准

- 大量笔记同步时主窗口不卡死。
- 多次快速变更只触发合并同步。

---

### 6.2 调试日志开关与生产日志收敛

#### 现状

多个 V2 文件存在初始化日志，例如 [`src/core/app.js`](../src/core/app.js:12)、[`src/utils/storage.js`](../src/utils/storage.js:296)。

#### 风险

- 生产环境控制台噪音多。
- 真正错误不容易定位。

#### 建议方案

增加统一调试开关，默认关闭开发日志。

#### 验收标准

- 生产环境控制台只保留错误和关键警告。
- 开发调试时可以一键开启详细日志。

---

## 7. 推荐实施批次

### 第一批：立即处理

1. 补全 [`package.json`](../package.json:18) 打包清单。
2. 增加 [`server.js`](../server.js:77) 请求体大小限制。
3. 增加 [`server.js`](../server.js:31) API 最小鉴权。
4. 处理 [`main.js`](../main.js:36) 固定端口冲突。

### 第二批：体验优化

1. 延迟加载 [`knowledge.js`](../knowledge.js)。
2. 梳理 [`index.html`](../index.html:504) 的 V2 脚本加载必要性。
3. 减少首屏同步脚本数量。

### 第三批：架构治理

1. 明确 [`app.js`](../app.js) 与 [`src/core/app.js`](../src/core/app.js:11) 的边界。
2. 建立统一事件机制。
3. 收敛持久化和同步策略。
4. 处理 [`innerHTML`](../app.js:729) 安全分级。

---

## 8. 最推荐的下一步

优先执行第一批第 1 项：补全 [`package.json`](../package.json:18) 的 Electron 打包资源清单。

原因：

- 重要程度最高。
- 优化收益最高。
- 改动范围小。
- 不涉及业务逻辑。
- 能直接避免安装包缺资源、样式丢失、知识库不可用等发布问题。
