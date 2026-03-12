/**
 * knowledge.js — 知识库 / 笔记系统
 * ─────────────────────────────────────────────────────────────────
 * 功能：
 *   1. 内置 Mock 数据（可随时替换为 API）
 *   2. 标签过滤 + 全文搜索
 *   3. 笔记列表卡片渲染
 *   4. 笔记详情页（Markdown 渲染 + 代码高亮）
 *   5. SPA 切换（与 Dashboard 共存于同一页面）
 *   6. 笔记创建 / 编辑（管理员权限）
 *   7. localStorage 持久化（增删改数据）
 * ─────────────────────────────────────────────────────────────────
 * 依赖：
 *   - Remix Icon（已在 index.html 引入）
 *   - markdown-it（CDN，懒加载）
 *   - highlight.js（CDN，懒加载）
 * ─────────────────────────────────────────────────────────────────
 */
(function () {
  'use strict';

  /* ================================================================
     §1  常量 & 存储键
     ================================================================ */
  var STORAGE_KEY = 'workbench_knowledge';

  /* ================================================================
     §2  内置 Mock 数据
     ================================================================ */
  var DEFAULT_NOTES = [
    {
      id: 'note_001',
      title: 'Linux OOM 分析与排查',
      category: 'Linux',
      tags: ['Linux', '运维'],
      summary: '当系统内存不足时，OOM Killer 会自动终止进程。本文介绍如何通过 dmesg、/proc 等工具定位 OOM 根因，制定优化方案。',
      author: 'Admin',
      date: '2024-12-01',
      views: 328,
      pinned: false,
      content: `# Linux OOM 分析与排查

## 什么是 OOM？

OOM (Out Of Memory) 是 Linux 内核在物理内存耗尽时触发的机制，内核会选择性地杀死进程以释放内存。

## 查看 OOM 日志

\`\`\`bash
# 查看内核日志中的 OOM 记录
dmesg | grep -i oom

# 查看系统日志（systemd）
journalctl -k | grep -i "out of memory"

# 查看具体被杀进程
dmesg | grep -i "killed process"
\`\`\`

## 分析内存使用

\`\`\`bash
# 查看当前内存使用
free -h

# 查看进程内存排行
ps aux --sort=-%mem | head -20

# 查看 /proc/meminfo 详细信息
cat /proc/meminfo | grep -E "MemTotal|MemFree|MemAvailable|Cached|SwapTotal|SwapFree"
\`\`\`

## OOM Score 机制

每个进程都有一个 \`oom_score\`，值越高越容易被 OOM Killer 选中：

\`\`\`bash
# 查看进程的 OOM 分数
cat /proc/<PID>/oom_score

# 调整 OOM 优先级（-1000 表示永不被杀）
echo -1000 > /proc/<PID>/oom_score_adj
\`\`\`

## 预防措施

- 合理设置 \`vm.overcommit_memory\`
- 配置足够的 Swap 空间
- 监控内存使用趋势，设置告警阈值
- 对关键服务设置 \`oom_score_adj = -500\` 或更低
`
    },
    {
      id: 'note_002',
      title: 'Git 分支管理策略（GitFlow）',
      category: 'Git',
      tags: ['Git', '开发'],
      summary: '本文介绍 GitFlow 工作流，包括 main、develop、feature、release、hotfix 分支的创建、合并规范，以及团队协作最佳实践。',
      author: 'Admin',
      date: '2024-11-20',
      views: 512,
      pinned: true,
      content: `# Git 分支管理策略（GitFlow）

## 分支模型

\`\`\`
main ─────────────────────────────────── 生产稳定版本
  └─ develop ──────────────────────────── 开发主线
       ├─ feature/login ──────────────── 功能分支
       ├─ feature/dashboard ──────────── 功能分支
       └─ release/v1.2.0 ─────────────── 发布分支
            └─ hotfix/fix-crash ──────── 热修复分支
\`\`\`

## 常用命令

\`\`\`bash
# 创建功能分支
git checkout develop
git checkout -b feature/my-feature

# 完成功能，合并回 develop
git checkout develop
git merge --no-ff feature/my-feature
git branch -d feature/my-feature

# 创建发布分支
git checkout -b release/v1.2.0 develop

# 发布完成，合并到 main 和 develop
git checkout main
git merge --no-ff release/v1.2.0
git tag -a v1.2.0

git checkout develop
git merge --no-ff release/v1.2.0
\`\`\`

## 提交规范（Conventional Commits）

\`\`\`
feat: 添加用户登录功能
fix: 修复首页加载闪烁问题
docs: 更新 API 文档
style: 格式化代码
refactor: 重构数据层逻辑
test: 添加单元测试
chore: 更新依赖版本
\`\`\`

## 代码审查要点

- PR/MR 大小控制在 **400 行**以内
- 每次提交只做**一件事**
- 分支命名：\`feature/\`、\`fix/\`、\`docs/\`、\`refactor/\`
`
    },
    {
      id: 'note_003',
      title: 'BSP 开发：设备树（Device Tree）入门',
      category: 'BSP',
      tags: ['BSP', '嵌入式'],
      summary: '设备树（DTS）是描述硬件拓扑的数据结构，ARM 平台的标准配置方式。本文介绍 DTS 基础语法、节点属性、常见外设配置示例。',
      author: 'Admin',
      date: '2024-11-10',
      views: 189,
      pinned: false,
      content: `# BSP 开发：设备树（Device Tree）入门

## 什么是设备树？

设备树（Device Tree Source, DTS）用于描述硬件配置，让内核在不同硬件平台上复用同一份驱动代码。

## 基本语法

\`\`\`dts
/ {
    model = "My Board";
    compatible = "vendor,myboard";

    cpus {
        cpu@0 {
            compatible = "arm,cortex-a53";
            device_type = "cpu";
            reg = <0>;
        };
    };

    memory@80000000 {
        device_type = "memory";
        reg = <0x80000000 0x40000000>; /* 1GB */
    };
};
\`\`\`

## 常用属性

| 属性 | 说明 |
|------|------|
| \`compatible\` | 驱动匹配字符串 |
| \`reg\` | 寄存器地址和大小 |
| \`interrupts\` | 中断号 |
| \`clocks\` | 时钟引用 |
| \`status\` | \`okay\` 或 \`disabled\` |

## UART 配置示例

\`\`\`dts
uart0: serial@11002000 {
    compatible = "mediatek,mt6577-uart";
    reg = <0 0x11002000 0 0x400>;
    interrupts = <GIC_SPI 91 IRQ_TYPE_LEVEL_LOW>;
    clocks = <&pericfg CLK_PERI_UART0>;
    clock-names = "baud";
    status = "okay";
};
\`\`\`

## 编译命令

\`\`\`bash
# 编译 DTS 为 DTB
dtc -I dts -O dtb -o output.dtb input.dts

# 反编译 DTB
dtc -I dtb -O dts -o output.dts input.dtb
\`\`\`
`
    },
    {
      id: 'note_004',
      title: 'Docker 容器化部署实践',
      category: '服务器',
      tags: ['服务器', '运维', 'Docker'],
      summary: 'Docker 容器化可以解决"在我机器上能运行"问题。本文涵盖 Dockerfile 编写、镜像优化、docker-compose 多容器编排等实用技巧。',
      author: 'Admin',
      date: '2024-10-28',
      views: 445,
      pinned: false,
      content: `# Docker 容器化部署实践

## Dockerfile 最佳实践

\`\`\`dockerfile
# 使用具体版本号，避免 latest 带来的不确定性
FROM node:20-alpine

# 设置工作目录
WORKDIR /app

# 先复制依赖文件，利用构建缓存
COPY package*.json ./
RUN npm ci --only=production

# 再复制源码
COPY . .

# 非 root 用户运行（安全最佳实践）
RUN addgroup -g 1001 -S nodejs && adduser -S nextjs -u 1001
USER nextjs

EXPOSE 3000
CMD ["node", "server.js"]
\`\`\`

## 镜像瘦身技巧

\`\`\`bash
# 多阶段构建（Multi-stage Build）
FROM golang:1.21 AS builder
WORKDIR /app
COPY . .
RUN CGO_ENABLED=0 go build -o main .

FROM alpine:3.19
COPY --from=builder /app/main /main
CMD ["/main"]
\`\`\`

## docker-compose 多服务编排

\`\`\`yaml
version: '3.8'
services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - DATABASE_URL=postgres://user:pass@db:5432/mydb
    depends_on:
      db:
        condition: service_healthy

  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: mydb
      POSTGRES_USER: user
      POSTGRES_PASSWORD: pass
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U user"]
      interval: 10s
      timeout: 5s
      retries: 5

volumes:
  pgdata:
\`\`\`

## 常用命令

\`\`\`bash
# 构建并启动
docker compose up -d --build

# 查看日志
docker compose logs -f app

# 进入容器
docker exec -it <container_id> sh

# 清理悬空镜像
docker image prune -f
\`\`\`
`
    },
    {
      id: 'note_005',
      title: 'Shell 自动化脚本：批量服务器巡检',
      category: '自动化测试',
      tags: ['自动化测试', 'Linux', 'Shell'],
      summary: '编写可靠的 Shell 脚本实现多台服务器批量巡检：CPU/内存/磁盘监控、服务健康检查、结果汇总报告生成。',
      author: 'Admin',
      date: '2024-10-15',
      views: 267,
      pinned: false,
      content: [
        '# Shell 自动化脚本：批量服务器巡检',
        '',
        '## 脚本结构',
        '',
        '```bash',
        '#!/bin/bash',
        'set -euo pipefail',
        '',
        '# 颜色定义',
        "RED='\\033[0;31m'",
        "GREEN='\\033[0;32m'",
        "YELLOW='\\033[1;33m'",
        "NC='\\033[0m' # No Color",
        '',
        '# 服务器列表',
        'SERVERS=(',
        '    "192.168.1.10"',
        '    "192.168.1.11"',
        '    "192.168.1.12"',
        ')',
        '',
        '# 巡检函数',
        'check_server() {',
        '    local host=$1',
        '    echo -e "\\n${YELLOW}=== 巡检: $host ===${NC}"',
        '',
        '    # CPU 使用率',
        '    cpu=$(ssh "$host" "top -bn1 | grep \'Cpu(s)\' | awk \'{print $2}\' | cut -d\'%\' -f1")',
        '    echo "CPU 使用率: ${cpu}%"',
        '',
        '    # 内存使用率',
        '    mem=$(ssh "$host" "free | grep Mem | awk \'{printf \\"%.1f\\", $3/$2 * 100}\'")',
        '    echo "内存使用率: ${mem}%"',
        '',
        '    # 磁盘使用率',
        '    disk=$(ssh "$host" "df -h / | awk \'NR==2{print $5}\'")',
        '    echo "磁盘使用率: $disk"',
        '',
        '    # 检查关键服务',
        '    for service in nginx mysql redis; do',
        '        if ssh "$host" "systemctl is-active $service" &>/dev/null; then',
        '            echo -e "服务 $service: ${GREEN}运行中${NC}"',
        '        else',
        '            echo -e "服务 $service: ${RED}停止${NC}"',
        '        fi',
        '    done',
        '}',
        '',
        '# 主循环',
        'for server in "${SERVERS[@]}"; do',
        '    check_server "$server" 2>/dev/null || echo -e "${RED}无法连接: $server${NC}"',
        'done',
        '```',
        '',
        '## 告警阈值设置',
        '',
        '```bash',
        '# CPU 超过 80% 发送告警',
        'if (( $(echo "$cpu > 80" | bc -l) )); then',
        '    echo "【告警】$host CPU 过高: ${cpu}%" | mail -s "服务器告警" admin@example.com',
        'fi',
        '```',
      ].join('\n')
    },
    {
      id: 'note_006',
      title: 'Fanvil IP 话机固件升级指南',
      category: '资源',
      tags: ['资源', '服务器'],
      summary: '详细介绍 Fanvil X 系列 IP 话机通过 Web 界面和 TFTP 两种方式进行固件升级的操作步骤，及常见问题排查。',
      author: 'Admin',
      date: '2024-09-30',
      views: 156,
      pinned: false,
      content: `# Fanvil IP 话机固件升级指南

## 升级前准备

1. 备份当前配置（Web → Maintenance → Auto Provision → Export）
2. 确认固件版本与话机型号匹配
3. 确保网络稳定，升级过程中不要断电

## 方式一：Web 界面升级

1. 浏览器访问话机 IP 地址
2. 进入 **Maintenance → Upgrade**
3. 点击 **Browse**，选择固件文件（.z 格式）
4. 点击 **Upgrade** 开始升级
5. 等待话机自动重启（约 2-3 分钟）

## 方式二：TFTP 批量升级

### 搭建 TFTP 服务器

\`\`\`bash
# Ubuntu 安装 TFTP
sudo apt install tftpd-hpa

# 配置文件 /etc/default/tftpd-hpa
TFTP_USERNAME="tftp"
TFTP_DIRECTORY="/srv/tftp"
TFTP_ADDRESS=":69"
TFTP_OPTIONS="--secure"

# 复制固件到 TFTP 目录
cp X4U-2.10.2.6610.z /srv/tftp/
\`\`\`

### 话机配置

进入 Web → Auto Provision：

\`\`\`
Protocol: TFTP
Server Address: 192.168.1.100
File Name: X4U-2.10.2.6610.z
\`\`\`

## 常见问题

| 问题 | 原因 | 解决方案 |
|------|------|----------|
| 升级失败 | 固件与型号不匹配 | 确认话机型号后重新下载 |
| 无法访问 Web | IP 地址变更 | 按 \`*#\` 查询当前 IP |
| 话机无法注册 | 升级后配置丢失 | 导入备份配置文件 |
`
    }
  ];

  /* ================================================================
     §3  数据持久化
     ================================================================ */
  function loadNotes() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        var parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {}
    return DEFAULT_NOTES.map(function (n) { return Object.assign({}, n); });
  }

  function saveNotes(notes) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(notes)); } catch (e) {}
  }

  /* ================================================================
     §4  状态
     ================================================================ */
  var state = {
    notes: loadNotes(),
    activeTag: '全部',
    searchQ: '',
    currentNoteId: null,  /* 当前详情页 */
    editingNoteId: null   /* 编辑弹窗 */
  };

  /* 所有分类标签（动态从数据中提取） */
  function getAllTags() {
    var set = { '全部': true };
    state.notes.forEach(function (n) {
      (n.tags || []).forEach(function (t) { set[t] = true; });
      if (n.category) set[n.category] = true;
    });
    return Object.keys(set);
  }

  /* 过滤后的笔记列表 */
  function getFilteredNotes() {
    return state.notes.filter(function (n) {
      var tagOk = state.activeTag === '全部' ||
        (n.tags || []).indexOf(state.activeTag) !== -1 ||
        n.category === state.activeTag;
      var q = (state.searchQ || '').trim().toLowerCase();
      var searchOk = !q ||
        (n.title || '').toLowerCase().indexOf(q) !== -1 ||
        (n.summary || '').toLowerCase().indexOf(q) !== -1 ||
        (n.content || '').toLowerCase().indexOf(q) !== -1 ||
        (n.category || '').toLowerCase().indexOf(q) !== -1 ||
        (n.tags || []).some(function (t) { return t.toLowerCase().indexOf(q) !== -1; });
      return tagOk && searchOk;
    });
  }

  /* ================================================================
     §5  工具函数
     ================================================================ */
  function escHtml(s) {
    return String(s || '')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function genId() {
    return 'note_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
  }

  function formatDate(d) {
    if (!d) return '';
    return String(d).replace(/-/g, '/');
  }

  /* 判断是否为管理员（复用 app.js 逻辑） */
  function isAdmin() {
    try { return localStorage.getItem('workbench_user_role') === 'admin'; } catch (e) { return false; }
  }

  /* 类别对应颜色 */
  var CATEGORY_COLOR = {
    'Linux':    { bg: 'rgba(251,191,36,0.15)',  color: '#fbbf24' },
    'Git':      { bg: 'rgba(248,113,113,0.15)', color: '#f87171' },
    'BSP':      { bg: 'rgba(192,132,252,0.15)', color: '#c084fc' },
    '服务器':   { bg: 'rgba(110,231,183,0.15)', color: '#6ee7b7' },
    '自动化测试':{ bg: 'rgba(96,165,250,0.15)', color: '#60a5fa' },
    '资源':     { bg: 'rgba(251,146,60,0.15)',  color: '#fb923c' },
    '开发':     { bg: 'rgba(128,184,255,0.15)', color: '#80B8FF' },
    '嵌入式':   { bg: 'rgba(244,114,182,0.15)', color: '#f472b6' },
    'Docker':   { bg: 'rgba(36,150,237,0.15)',  color: '#2496ED' },
    'Shell':    { bg: 'rgba(34,211,238,0.15)',  color: '#22d3ee' },
    '运维':     { bg: 'rgba(74,222,128,0.15)',  color: '#4ade80' },
  };

  function getCatStyle(cat) {
    var c = CATEGORY_COLOR[cat] || { bg: 'rgba(148,163,184,0.15)', color: '#94a3b8' };
    return 'background:' + c.bg + ';color:' + c.color + ';border-color:' + c.color + '44;';
  }

  /* ================================================================
     §6  Markdown 渲染（懒加载 CDN）
     ================================================================ */
  var _md = null;
  var _mdLoading = false;
  var _mdQueue = [];

  function renderMarkdown(content, cb) {
    if (_md) { cb(_md.render(content)); return; }
    _mdQueue.push({ content: content, cb: cb });
    if (_mdLoading) return;
    _mdLoading = true;

    /* 加载 markdown-it */
    var s1 = document.createElement('script');
    s1.src = 'https://cdn.jsdelivr.net/npm/markdown-it@14/dist/markdown-it.min.js';
    s1.onload = function () {
      /* 加载 highlight.js */
      var link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = 'https://cdn.jsdelivr.net/npm/highlight.js@11/styles/atom-one-dark.min.css';
      document.head.appendChild(link);

      var s2 = document.createElement('script');
      s2.src = 'https://cdn.jsdelivr.net/npm/highlight.js@11/lib/highlight.min.js';
      s2.onload = function () {
        _md = window.markdownit({
          html: false,
          linkify: true,
          typographer: true,
          highlight: function (str, lang) {
            if (lang && window.hljs && window.hljs.getLanguage(lang)) {
              try { return '<pre class="kb-code-block"><code class="hljs language-' + lang + '">' + window.hljs.highlight(str, { language: lang }).value + '</code></pre>'; } catch (e) {}
            }
            return '<pre class="kb-code-block"><code>' + escHtml(str) + '</code></pre>';
          }
        });
        _mdLoading = false;
        _mdQueue.forEach(function (item) { item.cb(_md.render(item.content)); });
        _mdQueue = [];
      };
      document.head.appendChild(s2);
    };
    document.head.appendChild(s1);
  }

  /* ================================================================
     §7  渲染：标签过滤栏
     ================================================================ */
  function renderTagBar() {
    var bar = document.getElementById('kb-tag-bar');
    if (!bar) return;
    var tags = getAllTags();
    bar.innerHTML = tags.map(function (t) {
      var active = t === state.activeTag ? ' kb-tag--active' : '';
      return '<button type="button" class="kb-tag' + active + '" data-tag="' + escHtml(t) + '">' + escHtml(t) + '</button>';
    }).join('');
    bar.querySelectorAll('.kb-tag').forEach(function (btn) {
      btn.addEventListener('click', function () {
        state.activeTag = btn.dataset.tag;
        renderTagBar();
        renderNoteList();
      });
    });
  }

  /* ================================================================
     §8  渲染：笔记列表
     ================================================================ */
  function renderNoteList() {
    var grid = document.getElementById('kb-note-grid');
    var empty = document.getElementById('kb-empty');
    if (!grid) return;

    var notes = getFilteredNotes();
    /* 置顶排前 */
    notes = notes.slice().sort(function (a, b) { return (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0); });

    if (notes.length === 0) {
      grid.innerHTML = '';
      if (empty) empty.style.display = 'flex';
      return;
    }
    if (empty) empty.style.display = 'none';

    grid.innerHTML = notes.map(function (n) {
      var catStyle = getCatStyle(n.category);
      var pinned = n.pinned ? '<span class="kb-card-pin" title="置顶"><i class="ri-pushpin-line"></i></span>' : '';
      var tags = (n.tags || []).map(function (t) {
        return '<span class="kb-card-tag-sm">' + escHtml(t) + '</span>';
      }).join('');
      return '<article class="kb-card" data-note-id="' + escHtml(n.id) + '" tabindex="0">' +
        '<div class="kb-card-header">' +
          '<span class="kb-card-cat" style="' + catStyle + '">' + escHtml(n.category) + '</span>' +
          pinned +
        '</div>' +
        '<h3 class="kb-card-title">' + escHtml(n.title) + '</h3>' +
        '<p class="kb-card-summary">' + escHtml(n.summary) + '</p>' +
        '<div class="kb-card-tags">' + tags + '</div>' +
        '<div class="kb-card-footer">' +
          '<span class="kb-card-meta"><i class="ri-user-line"></i>' + escHtml(n.author) + '</span>' +
          '<span class="kb-card-meta"><i class="ri-calendar-line"></i>' + formatDate(n.date) + '</span>' +
          '<span class="kb-card-meta"><i class="ri-eye-line"></i>' + (n.views || 0) + '</span>' +
          (isAdmin() ? '<span class="kb-card-actions">' +
            '<button type="button" class="kb-btn-icon kb-edit-btn" data-id="' + escHtml(n.id) + '" title="编辑"><i class="ri-edit-line"></i></button>' +
            '<button type="button" class="kb-btn-icon kb-del-btn" data-id="' + escHtml(n.id) + '" title="删除"><i class="ri-delete-bin-line"></i></button>' +
          '</span>' : '') +
        '</div>' +
      '</article>';
    }).join('');

    /* 点击卡片 → 详情 */
    grid.querySelectorAll('.kb-card').forEach(function (card) {
      card.addEventListener('click', function (e) {
        if (e.target.closest('.kb-edit-btn') || e.target.closest('.kb-del-btn')) return;
        openNoteDetail(card.dataset.noteId);
      });
      card.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') openNoteDetail(card.dataset.noteId);
      });
    });

    /* 编辑按钮 */
    grid.querySelectorAll('.kb-edit-btn').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        openNoteEditor(btn.dataset.id);
      });
    });

    /* 删除按钮 */
    grid.querySelectorAll('.kb-del-btn').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        if (!confirm('确定删除这篇笔记？')) return;
        state.notes = state.notes.filter(function (n) { return n.id !== btn.dataset.id; });
        saveNotes(state.notes);
        renderTagBar();
        renderNoteList();
      });
    });
  }

  /* ================================================================
     §9  笔记详情页
     ================================================================ */
  function openNoteDetail(noteId) {
    var note = state.notes.find(function (n) { return n.id === noteId; });
    if (!note) return;
    /* 阅读量 +1 */
    note.views = (note.views || 0) + 1;
    saveNotes(state.notes);

    state.currentNoteId = noteId;

    var listView = document.getElementById('kb-list-view');
    var detailView = document.getElementById('kb-detail-view');
    if (listView) listView.style.display = 'none';
    if (detailView) detailView.style.display = 'block';

    /* 填充头部信息 */
    var titleEl = document.getElementById('kb-detail-title');
    var metaEl  = document.getElementById('kb-detail-meta');
    var bodyEl  = document.getElementById('kb-detail-body');
    if (titleEl) titleEl.textContent = note.title;
    if (metaEl) {
      var catStyle = getCatStyle(note.category);
      metaEl.innerHTML =
        '<span class="kb-card-cat" style="' + catStyle + '">' + escHtml(note.category) + '</span>' +
        '<span class="kb-card-meta"><i class="ri-user-line"></i>' + escHtml(note.author) + '</span>' +
        '<span class="kb-card-meta"><i class="ri-calendar-line"></i>' + formatDate(note.date) + '</span>' +
        '<span class="kb-card-meta"><i class="ri-eye-line"></i>' + note.views + ' 阅读</span>' +
        (isAdmin() ? '<button type="button" class="kb-btn-sm kb-detail-edit-btn"><i class="ri-edit-line"></i> 编辑</button>' : '');
      var editBtn = metaEl.querySelector('.kb-detail-edit-btn');
      if (editBtn) editBtn.addEventListener('click', function () { openNoteEditor(noteId); });
    }
    if (bodyEl) {
      bodyEl.innerHTML = '<div class="kb-loading"><i class="ri-loader-4-line kb-spin"></i> 渲染中…</div>';
      renderMarkdown(note.content || '', function (html) {
        bodyEl.innerHTML = html;
      });
    }
  }

  function closeNoteDetail() {
    state.currentNoteId = null;
    var listView = document.getElementById('kb-list-view');
    var detailView = document.getElementById('kb-detail-view');
    if (listView) listView.style.display = '';
    if (detailView) detailView.style.display = 'none';
    renderNoteList(); /* 刷新阅读量 */
  }

  /* ================================================================
     §10  笔记编辑器弹窗
     ================================================================ */
  function openNoteEditor(noteId) {
    var note = noteId ? state.notes.find(function (n) { return n.id === noteId; }) : null;
    state.editingNoteId = noteId || null;

    var modal = document.getElementById('kb-editor-modal');
    if (!modal) { console.error('[KB] #kb-editor-modal not found'); return; }

    /* 防御性赋值：任何字段找不到只跳过，不中断 */
    function setVal(id, val) {
      var el = document.getElementById(id);
      if (el) el.value = val;
      else console.warn('[KB] field not found:', id);
    }
    function setChecked(id, val) {
      var el = document.getElementById(id);
      if (el) el.checked = val;
    }

    setVal('kb-edit-title',    note ? (note.title || '')    : '');
    setVal('kb-edit-category', note ? (note.category || '') : '');
    setVal('kb-edit-tags',     note ? (note.tags || []).join(', ') : '');
    setVal('kb-edit-summary',  note ? (note.summary || '')  : '');
    setVal('kb-edit-content',  note ? (note.content || '')  : '');
    setVal('kb-edit-author',   note ? (note.author || '')   : (localStorage.getItem('workbench_user') || 'Admin'));
    setChecked('kb-edit-pinned', note ? !!note.pinned : false);

    modal.classList.add('show');
  }

  function closeNoteEditor() {
    var modal = document.getElementById('kb-editor-modal');
    if (modal) modal.classList.remove('show');
    state.editingNoteId = null;
  }

  function saveNote() {
    var title    = (document.getElementById('kb-edit-title').value || '').trim();
    var category = (document.getElementById('kb-edit-category').value || '').trim();
    var tagsRaw  = (document.getElementById('kb-edit-tags').value || '').trim();
    var summary  = (document.getElementById('kb-edit-summary').value || '').trim();
    var content  = document.getElementById('kb-edit-content').value || '';
    var author   = (document.getElementById('kb-edit-author').value || '').trim() || 'Admin';
    var pinned   = document.getElementById('kb-edit-pinned').checked;

    if (!title) { alert('请填写标题'); return; }

    var tags = tagsRaw ? tagsRaw.split(',').map(function (t) { return t.trim(); }).filter(Boolean) : [];
    if (category && tags.indexOf(category) === -1) tags.unshift(category);

    if (state.editingNoteId) {
      var note = state.notes.find(function (n) { return n.id === state.editingNoteId; });
      if (note) {
        note.title = title; note.category = category; note.tags = tags;
        note.summary = summary; note.content = content;
        note.author = author; note.pinned = pinned;
      }
    } else {
      state.notes.unshift({
        id: genId(), title: title, category: category, tags: tags,
        summary: summary, content: content, author: author,
        date: new Date().toISOString().slice(0, 10),
        views: 0, pinned: pinned
      });
    }
    saveNotes(state.notes);
    closeNoteEditor();
    renderTagBar();
    renderNoteList();
    /* 若在详情页编辑，刷新详情 */
    if (state.currentNoteId) openNoteDetail(state.currentNoteId);
  }

  /* ================================================================
     §11  搜索框
     ================================================================ */
  function bindKbSearch() {
    var input = document.getElementById('kb-search-input');
    if (!input) return;
    var timer;
    input.addEventListener('input', function () {
      clearTimeout(timer);
      var val = this.value;
      timer = setTimeout(function () {
        state.searchQ = val;
        renderNoteList();
      }, 180);
    });
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        this.value = '';
        state.searchQ = '';
        renderNoteList();
      }
    });
  }

  /* ================================================================
     §12  全局绑定（事件委托，避免 DOM 时序问题）
     ================================================================ */
  function bindAll() {
    /* 用事件委托挂在 document 上，无论按钮何时出现都能响应 */
    document.addEventListener('click', function (e) {
      var target = e.target;

      /* 向上查找最近的带 id 的祖先按钮 */
      var btn = target.closest
        ? target.closest('[id]')
        : (function () {
            var el = target;
            while (el && !el.id) el = el.parentElement;
            return el;
          })();

      if (!btn) return;

      switch (btn.id) {
        case 'kb-new-btn':
          openNoteEditor(null);
          break;
        case 'kb-back-btn':
          closeNoteDetail();
          break;
        case 'kb-editor-close':
        case 'kb-editor-cancel':
          closeNoteEditor();
          break;
        case 'kb-editor-save':
          saveNote();
          break;
        case 'kb-editor-modal':
          /* 点击遮罩层本身（不是内容区）则关闭 */
          if (e.target === btn) closeNoteEditor();
          break;
      }
    });

    /* Esc 关闭 */
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        var modal = document.getElementById('kb-editor-modal');
        if (modal && modal.classList.contains('show')) {
          closeNoteEditor(); return;
        }
        if (state.currentNoteId) closeNoteDetail();
      }
    });

    bindKbSearch();
  }

  /* ================================================================
     §13  初始化（由 SPA router 在切换到知识库时调用）
     ================================================================ */
  function initKnowledge() {
    /* 确保详情页隐藏、列表页可见 */
    var listView = document.getElementById('kb-list-view');
    var detailView = document.getElementById('kb-detail-view');
    if (listView) listView.style.display = '';
    if (detailView) detailView.style.display = 'none';

    /* 每次切入时重载数据（防止 IIFE 初始化时 localStorage 不同步） */
    state.notes = loadNotes();
    state.searchQ = '';
    state.activeTag = '全部';
    state.currentNoteId = null;

    var searchInput = document.getElementById('kb-search-input');
    if (searchInput) searchInput.value = '';

    bindKbSearch();
    renderTagBar();
    renderNoteList();

    /* 根据角色决定新建按钮可见性 */
    var newBtn = document.getElementById('kb-new-btn');
    if (newBtn) {
      var role = '';
      try { role = localStorage.getItem('workbench_user_role'); } catch (e) {}
      /* 管理员显示，其余人隐藏 */
      newBtn.style.display = role === 'admin' ? '' : 'none';
    }
  }

  /* 暴露给 router 使用 */
  window.KnowledgeBase = {
    init: initKnowledge,
    bindAll: bindAll
  };

  /* DOM 就绪后绑定事件（事件只绑定一次，渲染按需触发） */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      bindAll();
    });
  } else {
    bindAll();
  }

})();
