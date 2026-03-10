/**
 * theme-glass.js — Glass UI 增强层
 * ─────────────────────────────────────────────────────────────────
 * 策略：
 *   1. 不修改、不删除任何现有 JS 逻辑。
 *   2. 监听 DOM 变化，在模块卡片渲染后自动注入：
 *      - 关键词标签（.mod-tag）
 *      - 拖拽中的 .dragging 视觉反馈
 *   3. 所有逻辑封装在 IIFE 中，避免全局变量污染。
 * ─────────────────────────────────────────────────────────────────
 */
(function () {
  'use strict';

  /* ================================================================
     §A  模块名 → 标签映射规则
     ----------------------------------------------------------------
     根据模块名称中的关键字自动匹配标签类型和文案。
     可自由扩展此对象以添加更多分类。
     ================================================================ */
  var TAG_RULES = [
    /* AI 工具（优先级最高，避免被 tools 截获） */
    { pattern: /ai|gpt|llm|copilot|claude|gemini|智能|大模型/i, type: 'ai',    label: 'AI' },
    /* 服务器 / 运维 */
    { pattern: /server|服务器|运维|nginx|apache|linux|ssh|内网|ops|k8s|kubernetes|docker|部署/i, type: 'server', label: 'SERVER' },
    /* 代码 / 协作 */
    { pattern: /git|代码|开发|code|ci|cd|jenkins|jira|confluence|repo|svn|review|dev/i, type: 'dev', label: 'DEV' },
    /* 文档 / 知识库 */
    { pattern: /doc|文档|wiki|notion|知识|笔记|手册|readme/i, type: 'docs', label: 'DOCS' },
    /* 工具 / 效率 */
    { pattern: /tool|工具|效率|监控|任务|管理|dashboard|面板|系统/i, type: 'tools', label: 'TOOLS' },
  ];

  /**
   * 根据模块名称返回匹配的标签对象，无匹配则返回 null。
   * @param {string} name — 模块名称
   * @returns {{ type: string, label: string }|null}
   */
  function resolveTag(name) {
    if (!name) return null;
    for (var i = 0; i < TAG_RULES.length; i++) {
      if (TAG_RULES[i].pattern.test(name)) {
        return { type: TAG_RULES[i].type, label: TAG_RULES[i].label };
      }
    }
    return null;
  }

  /**
   * 向卡片头部的 .card-title 注入标签 .mod-tag（如尚未注入）。
   * @param {HTMLElement} card — .module-card 元素
   */
  function injectTag(card) {
    /* 获取模块名：优先从 .card-title 文本取，其次 data-moduleId 对应 */
    var titleEl = card.querySelector('.card-title');
    if (!titleEl) return;

    /* 避免重复注入 */
    if (titleEl.querySelector('.mod-tag')) return;

    /* 取纯文本（去掉 <mark> 之类的子标签影响） */
    var name = titleEl.textContent || titleEl.innerText || '';
    name = name.trim();

    var tag = resolveTag(name);
    if (!tag) return;

    /* 创建标签元素 */
    var tagEl = document.createElement('span');
    tagEl.className = 'mod-tag';
    tagEl.setAttribute('data-type', tag.type);
    tagEl.textContent = tag.label;
    tagEl.title = '模块分类：' + tag.label;

    /* 追加到标题右侧 */
    titleEl.appendChild(tagEl);
  }

  /**
   * 遍历主网格中所有模块卡片，执行标签注入。
   */
  function injectAllTags() {
    var cards = document.querySelectorAll('#mainGrid .module-card');
    cards.forEach(function (card) {
      injectTag(card);
    });
  }

  /* ================================================================
     §B  拖拽视觉反馈
     ----------------------------------------------------------------
     监听 dragstart / dragend，为被拖拽的卡片添加 .dragging 类。
     CSS 中 .dragging 定义了 opacity + scale 降低效果（见 theme-glass.css §5）。
     不干扰原有的拖拽排序逻辑。
     ================================================================ */

  /**
   * 当前被拖拽的卡片元素，拖拽结束后清空。
   * @type {HTMLElement|null}
   */
  var _draggingEl = null;

  /**
   * 委托监听主网格的 dragstart 事件。
   * 找到最近的 .module-card 或 .module-item，添加 .dragging 类。
   */
  function onDragStart(e) {
    var target = e.target;
    /* 向上查找最近的可拖拽容器 */
    var el = target.closest('.module-card') || target.closest('.module-item');
    if (!el) return;
    _draggingEl = el;
    /* 使用 rAF 延迟添加类，避免 Chrome 截图时显示异常 */
    requestAnimationFrame(function () {
      if (_draggingEl) _draggingEl.classList.add('dragging');
    });
  }

  /**
   * 委托监听主网格的 dragend 事件，移除 .dragging 类。
   */
  function onDragEnd() {
    if (_draggingEl) {
      _draggingEl.classList.remove('dragging');
      _draggingEl = null;
    }
  }

  /* ================================================================
     §E  模块卡片搜索过滤（卡片级别的显示/隐藏）
     ----------------------------------------------------------------
     app.js 自带的搜索逻辑过滤的是条目（item），本功能在此基础上
     额外实现"整张卡片"的实时显示/隐藏，并在无结果时显示提示。
     不修改 app.js 的任何逻辑，仅监听搜索框 input 事件。
     ================================================================ */

  /**
   * 对 #mainGrid 中所有 .module-card 执行关键字过滤。
   * 匹配规则：模块标题文本（忽略大小写）包含关键字则显示，否则隐藏。
   * @param {string} keyword — 搜索关键字（已 trim）
   */
  function filterCards(keyword) {
    var grid = document.getElementById('mainGrid');
    if (!grid) return;

    var cards = grid.querySelectorAll('.module-card');
    var visibleCount = 0;

    cards.forEach(function (card) {
      /* 取模块标题纯文本（排除 .mod-tag 等子元素的干扰） */
      var titleEl = card.querySelector('.card-title');
      var titleText = titleEl ? (titleEl.textContent || titleEl.innerText || '') : '';
      /* 同时也匹配条目标题，让搜索更实用 */
      var itemsText = card.querySelector('.module-items')
        ? (card.querySelector('.module-items').textContent || '') : '';
      var fullText = (titleText + ' ' + itemsText).toLowerCase();

      if (!keyword || fullText.indexOf(keyword.toLowerCase()) !== -1) {
        card.classList.remove('glass-hidden');
        visibleCount++;
      } else {
        card.classList.add('glass-hidden');
      }
    });

    /* 无结果提示 */
    var noResult = document.getElementById('glass-no-result');
    if (keyword && visibleCount === 0) {
      if (!noResult) {
        noResult = document.createElement('div');
        noResult.id = 'glass-no-result';
        noResult.innerHTML =
          '<span class="glass-no-result-icon">🔍</span>' +
          '<span>没有找到包含 "<strong>' + escapeForDisplay(keyword) + '</strong>" 的模块</span>';
        grid.appendChild(noResult);
      } else {
        /* 更新关键字文本 */
        var strong = noResult.querySelector('strong');
        if (strong) strong.textContent = keyword;
        noResult.style.display = '';
      }
    } else if (noResult) {
      noResult.style.display = 'none';
    }
  }

  /**
   * 简单 HTML 转义，防止搜索关键字中含有特殊字符时 XSS。
   * @param {string} str
   * @returns {string}
   */
  function escapeForDisplay(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /**
   * 绑定搜索框的 input 事件（委托到 document，兼容动态渲染的搜索框）。
   */
  function bindSearchFilter() {
    var searchInput = document.getElementById('searchInput');
    if (!searchInput) return;

    /* 防抖：用户停止输入 120ms 后再执行过滤，减少重排次数 */
    var _filterTimer = null;
    searchInput.addEventListener('input', function () {
      clearTimeout(_filterTimer);
      var keyword = (this.value || '').trim();
      _filterTimer = setTimeout(function () {
        filterCards(keyword);
      }, 120);
    });

    /* 清空搜索时立即恢复所有卡片 */
    searchInput.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        this.value = '';
        filterCards('');
      }
    });
  }


  /* ================================================================
     §F  卡片进入动画
     ----------------------------------------------------------------
     每次 renderModules() 重新渲染后，Observer 回调中为新卡片添加
     .glass-animated 类，触发 CSS §28 定义的错落出现动画。
     ================================================================ */

  /**
   * 为所有尚未添加动画类的 .module-card 添加 .glass-animated，
   * 并按顺序错落延迟（每张卡片延迟 40ms）。
   */
  function animateNewCards() {
    var cards = document.querySelectorAll('#mainGrid .module-card:not(.glass-animated)');
    cards.forEach(function (card, i) {
      /* 错落延迟：第 i 张卡片延迟 i * 40ms */
      card.style.animationDelay = (i * 40) + 'ms';
      card.classList.add('glass-animated');
    });
  }


  /* ================================================================
     §G  条目数量角标（折叠状态下显示模块内容数）
     ----------------------------------------------------------------
     在 .card-title 上设置 data-count 属性，CSS §29 通过 ::after
     伪元素将其显示为角标。
     ================================================================ */

  /**
   * 遍历所有模块卡片，统计条目数量并写入 data-count 属性。
   */
  function updateItemCounts() {
    var cards = document.querySelectorAll('#mainGrid .module-card');
    cards.forEach(function (card) {
      var titleEl = card.querySelector('.card-title');
      if (!titleEl) return;
      /* 统计 .module-items 下的直接子条目数 */
      var itemsEl = card.querySelector('.module-items');
      var count = itemsEl ? itemsEl.children.length : 0;
      if (count > 0) {
        titleEl.setAttribute('data-count', count);
      } else {
        titleEl.removeAttribute('data-count');
      }
    });
  }


  /* ================================================================
     §C  MutationObserver — 监听主网格 DOM 变化（升级版）
     ================================================================ */

  var mainGrid = null;
  var observer = null;

  function getMainGrid() {
    return document.getElementById('mainGrid');
  }

  function startObserver() {
    mainGrid = getMainGrid();
    if (!mainGrid) return;

    /* 绑定拖拽事件（委托到 mainGrid，只绑定一次） */
    mainGrid.addEventListener('dragstart', onDragStart);
    mainGrid.addEventListener('dragend', onDragEnd);

    observer = new MutationObserver(function (mutations) {
      var hasChildChanges = mutations.some(function (m) {
        return m.type === 'childList' && m.addedNodes.length > 0;
      });
      if (!hasChildChanges) return;

      /* 短暂延迟，确保 app.js 渲染完毕 */
      setTimeout(function () {
        injectAllTags();    /* §A：注入分类标签 */
        animateNewCards();  /* §F：卡片进入动画 */
        updateItemCounts(); /* §G：条目数量角标 */
      }, 60);
    });

    observer.observe(mainGrid, {
      childList: true,
      subtree: false
    });

    /* 首次立即执行 */
    injectAllTags();
    animateNewCards();
    updateItemCounts();
  }


  /* ================================================================
     §D  初始化入口
     ================================================================ */

  function init() {
    startObserver();
    bindSearchFilter();   /* §E：绑定搜索过滤 */

    if (!mainGrid) {
      var retries = 0;
      var timer = setInterval(function () {
        retries++;
        if (getMainGrid()) {
          clearInterval(timer);
          startObserver();
        } else if (retries > 40) {
          clearInterval(timer);
        }
      }, 100);
    }
  }

  /* DOMContentLoaded 可能已触发，使用 readyState 判断 */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    requestAnimationFrame(init);
  }

})();


/* ================================================================
   登录遮罩增强模块（独立 IIFE，不影响主模块）
   ----------------------------------------------------------------
   功能：
   1. 在 .login-overlay-inner 中注入完整的用户名/密码表单，
      替代原来只有一个"登录"按钮的简陋布局。
   2. 表单提交时调用 app.js 原有的 performLogin 逻辑（通过触发
      loginForm 的 submit 事件，完全复用原有验证代码）。
   3. 修复登录后遮罩不消失的问题：监听 #loginOverlay 的
      display 属性变化，确保遮罩能被正确隐藏。
   ================================================================ */
(function () {
  'use strict';

  /**
   * 增强登录遮罩：注入完整表单 UI。
   * 原始 HTML 中只有 h2、p、btnOverlayLogin 三个元素，
   * 此函数在其后插入用户名/密码输入框，并接管提交逻辑。
   */
  function enhanceLoginOverlay() {
    var overlay = document.getElementById('loginOverlay');
    var inner   = overlay && overlay.querySelector('.login-overlay-inner');
    if (!inner) return;

    /* 避免重复注入 */
    if (inner.querySelector('.login-overlay-form')) return;

    /* ── 构建表单 DOM ── */
    var form = document.createElement('form');
    form.className = 'login-overlay-form';
    form.setAttribute('autocomplete', 'on');
    /* 阻止 form 默认提交（由 JS 接管） */
    form.addEventListener('submit', function (e) { e.preventDefault(); doLogin(); });

    /* 用户名字段 */
    var userField = document.createElement('div');
    userField.className = 'login-field';
    userField.innerHTML =
      '<label for="overlayLoginUser">用户名</label>' +
      '<input type="text" id="overlayLoginUser" placeholder="请输入用户名" autocomplete="username" spellcheck="false">';

    /* 密码字段 */
    var passField = document.createElement('div');
    passField.className = 'login-field';
    passField.innerHTML =
      '<label for="overlayLoginPass">密码</label>' +
      '<input type="password" id="overlayLoginPass" placeholder="请输入密码" autocomplete="current-password">';

    form.appendChild(userField);
    form.appendChild(passField);

    /* 错误提示行 */
    var errorEl = document.createElement('p');
    errorEl.className = 'login-overlay-error';
    errorEl.id = 'overlayLoginError';

    /* 提交按钮 */
    var submitBtn = document.createElement('button');
    submitBtn.type = 'submit';
    submitBtn.className = 'btn-overlay-submit';
    submitBtn.textContent = '登 录';

    /* 将表单、错误提示、按钮插入 inner（在原有 hint p 之前） */
    var hint = inner.querySelector('.login-overlay-hint');
    inner.insertBefore(form, hint);
    inner.insertBefore(errorEl, hint);
    inner.insertBefore(submitBtn, hint);

    /* 自动聚焦用户名输入框 */
    setTimeout(function () {
      var userInput = document.getElementById('overlayLoginUser');
      if (userInput) userInput.focus();
    }, 100);
  }

  /**
   * 执行登录：
   * 将遮罩表单的值同步到 app.js 的 #loginUser / #loginPass，
   * 然后触发 loginForm 的 submit 事件，复用 app.js 原有验证逻辑。
   * 同时监听登录结果（通过检测 loginOverlay 是否被隐藏）。
   */
  function doLogin() {
    var overlayUser = document.getElementById('overlayLoginUser');
    var overlayPass = document.getElementById('overlayLoginPass');
    var errorEl     = document.getElementById('overlayLoginError');
    var submitBtn   = document.querySelector('.login-overlay-inner .btn-overlay-submit');

    if (!overlayUser || !overlayPass) return;

    var username = overlayUser.value.trim();
    var password = overlayPass.value;

    /* 基础校验 */
    if (!username) {
      showOverlayError('请输入用户名');
      overlayUser.focus();
      return;
    }
    if (!password) {
      showOverlayError('请输入密码');
      overlayPass.focus();
      return;
    }

    /* 清除旧错误 */
    if (errorEl) errorEl.textContent = '';

    /* 加载状态 */
    if (submitBtn) submitBtn.classList.add('loading');

    /* 同步值到 app.js 的隐藏表单 */
    var appUser = document.getElementById('loginUser');
    var appPass = document.getElementById('loginPass');
    if (appUser) appUser.value = username;
    if (appPass) appPass.value = password;

    /* 触发 app.js 的登录表单提交（复用原有验证逻辑） */
    var loginForm = document.getElementById('loginForm');
    if (loginForm) {
      loginForm.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    }

    /* 延迟检查登录结果：
       app.js 登录成功后会调用 updateUserUI()，
       updateUserUI() 会设置 loginOverlay.style.display = 'none'。
       若登录失败，loginHint 会有错误文字。 */
    setTimeout(function () {
      if (submitBtn) submitBtn.classList.remove('loading');

      var overlay = document.getElementById('loginOverlay');
      var isHidden = overlay &&
        (overlay.style.display === 'none' || getComputedStyle(overlay).display === 'none');

      if (!isHidden) {
        /* 登录失败：读取 app.js 写入的错误提示 */
        var appHint = document.getElementById('loginHint');
        var msg = (appHint && appHint.textContent) || '用户名或密码错误';
        showOverlayError(msg);
        /* 清空密码框，聚焦 */
        overlayPass.value = '';
        overlayPass.focus();
        /* 抖动动画 */
        shakeCard();
      }
    }, 80);
  }

  /**
   * 在遮罩表单上显示错误信息。
   * @param {string} msg
   */
  function showOverlayError(msg) {
    var errorEl = document.getElementById('overlayLoginError');
    if (errorEl) {
      errorEl.textContent = msg;
    }
  }

  /**
   * 登录失败时对卡片执行抖动动画（CSS keyframe）。
   */
  function shakeCard() {
    var inner = document.querySelector('.login-overlay-inner');
    if (!inner) return;
    inner.classList.remove('glass-shake');
    /* 强制回流触发重新动画 */
    void inner.offsetWidth;
    inner.classList.add('glass-shake');
    inner.addEventListener('animationend', function onEnd() {
      inner.classList.remove('glass-shake');
      inner.removeEventListener('animationend', onEnd);
    });
  }

  /**
   * 监听 Enter 键：在遮罩表单的输入框中按 Enter 触发登录。
   */
  function bindOverlayEnter() {
    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Enter') return;
      var overlay = document.getElementById('loginOverlay');
      /* 仅在遮罩可见时响应 */
      if (!overlay || overlay.style.display === 'none') return;
      var active = document.activeElement;
      if (active && (active.id === 'overlayLoginUser' || active.id === 'overlayLoginPass')) {
        doLogin();
      }
    });
  }

  /* ── 初始化 ── */
  function initLoginOverlay() {
    enhanceLoginOverlay();
    bindOverlayEnter();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initLoginOverlay);
  } else {
    /* app.js 在 DOMContentLoaded 后执行，需等一帧确保 DOM 就绪 */
    requestAnimationFrame(initLoginOverlay);
  }

})();


/* ================================================================
   图标选择器模块（Icon Picker）
   ----------------------------------------------------------------
   功能：
   1. 内置常用 iconfont class 名称库（开发/服务器/工具/文档/AI 等分类）
   2. 搜索框实时过滤，网格展示匹配图标
   3. 点击图标 → 写入 #itemIcon 隐藏字段 + 更新预览
   4. 清除按钮 → 清空选择
   5. 暴露 window.updateIconPreview 供 app.js 回填图标时调用
   ================================================================ */
(function () {
  'use strict';

  /*
   * 图标库：使用 Remix Icon（remixicon.com）
   * 每项：{ cls, kw, color }
   * color 会同时用于：选择器网格预览色 + 条目列表图标色
   */
  var ICON_LIST = [
    /* ── 开发 / 代码  蓝紫色系 ── */
    { cls: 'ri-git-branch-line',        kw: 'git branch 分支 代码 版本',    color: '#F05033' },
    { cls: 'ri-git-commit-line',        kw: 'git commit 提交 代码',          color: '#F05033' },
    { cls: 'ri-git-merge-line',         kw: 'git merge 合并',                color: '#9B59B6' },
    { cls: 'ri-git-pull-request-line',  kw: 'pull request pr 代码审查',      color: '#3498DB' },
    { cls: 'ri-github-line',            kw: 'github 代码 仓库',              color: '#E2E8F0' },
    { cls: 'ri-gitlab-line',            kw: 'gitlab 代码 仓库',              color: '#FC6D26' },
    { cls: 'ri-code-line',              kw: 'code 代码 编程',                color: '#80B8FF' },
    { cls: 'ri-code-s-slash-line',      kw: 'code slash 代码 编程',          color: '#80B8FF' },
    { cls: 'ri-terminal-line',          kw: 'terminal 终端 命令行 shell bash',color: '#6EE7B7' },
    { cls: 'ri-terminal-box-line',      kw: 'terminal box 终端 命令',        color: '#6EE7B7' },
    { cls: 'ri-bug-line',               kw: 'bug 缺陷 调试 debug',           color: '#F87171' },
    { cls: 'ri-bug-2-line',             kw: 'bug 缺陷 调试',                 color: '#F87171' },
    { cls: 'ri-braces-line',            kw: 'braces json 代码 对象',         color: '#FBBF24' },
    { cls: 'ri-brackets-line',          kw: 'brackets 数组 代码',            color: '#FBBF24' },
    { cls: 'ri-html5-line',             kw: 'html html5 前端 网页',          color: '#E44D26' },
    { cls: 'ri-css3-line',              kw: 'css css3 样式 前端',            color: '#264DE4' },
    { cls: 'ri-javascript-line',        kw: 'javascript js 前端 脚本',       color: '#F7DF1E' },
    { cls: 'ri-reactjs-line',           kw: 'react 前端 框架',               color: '#61DAFB' },
    { cls: 'ri-vuejs-line',             kw: 'vue 前端 框架',                 color: '#42B883' },
    { cls: 'ri-angularjs-line',         kw: 'angular 前端 框架',             color: '#DD0031' },
    { cls: 'ri-python-line',            kw: 'python 脚本 编程',              color: '#3776AB' },
    { cls: 'ri-database-line',          kw: 'database 数据库 db',            color: '#4DB6AC' },
    { cls: 'ri-database-2-line',        kw: 'database 数据库',               color: '#4DB6AC' },
    { cls: 'ri-table-line',             kw: 'table 表格 数据库',             color: '#81C784' },
    /* ── 服务器 / 运维  绿青色系 ── */
    { cls: 'ri-server-line',            kw: 'server 服务器 主机',            color: '#6EE7B7' },
    { cls: 'ri-server-2-line',          kw: 'server 服务器',                 color: '#6EE7B7' },
    { cls: 'ri-hard-drive-line',        kw: 'hard drive 硬盘 存储',          color: '#94A3B8' },
    { cls: 'ri-hard-drive-2-line',      kw: 'hard drive 硬盘',               color: '#94A3B8' },
    { cls: 'ri-cpu-line',               kw: 'cpu 处理器 性能',               color: '#A78BFA' },
    { cls: 'ri-ram-line',               kw: 'ram memory 内存',               color: '#A78BFA' },
    { cls: 'ri-cloud-line',             kw: 'cloud 云 服务器',               color: '#60A5FA' },
    { cls: 'ri-cloud-fill',             kw: 'cloud 云',                      color: '#60A5FA' },
    { cls: 'ri-cloud-upload-line',      kw: 'cloud upload 上传 云',          color: '#34D399' },
    { cls: 'ri-cloud-download-line',    kw: 'cloud download 下载 云',        color: '#34D399' },
    { cls: 'ri-computer-line',          kw: 'computer 电脑 桌面',            color: '#94A3B8' },
    { cls: 'ri-monitor-line',           kw: 'monitor 显示器 监控',           color: '#94A3B8' },
    { cls: 'ri-router-line',            kw: 'router 路由器 网络',            color: '#FBBF24' },
    { cls: 'ri-wifi-line',              kw: 'wifi 无线 网络',                color: '#38BDF8' },
    { cls: 'ri-signal-wifi-line',       kw: 'wifi signal 信号 网络',         color: '#38BDF8' },
    { cls: 'ri-global-line',            kw: 'global 全球 网络 地球 internet',color: '#66D1FF' },
    { cls: 'ri-earth-line',             kw: 'earth 地球 全球 网络',          color: '#66D1FF' },
    { cls: 'ri-network-line',           kw: 'network 网络 局域网',           color: '#38BDF8' },
    { cls: 'ri-docker-line',            kw: 'docker 容器 部署',              color: '#2496ED' },
    { cls: 'ri-ubuntu-line',            kw: 'ubuntu linux 系统',             color: '#E95420' },
    { cls: 'ri-centos-line',            kw: 'centos linux 系统',             color: '#932279' },
    { cls: 'ri-windows-line',           kw: 'windows 系统 微软',             color: '#0078D4' },
    { cls: 'ri-apple-line',             kw: 'apple mac macos 苹果 系统',     color: '#E2E8F0' },
    { cls: 'ri-android-line',           kw: 'android 安卓 手机',             color: '#3DDC84' },
    { cls: 'ri-linux-line',             kw: 'linux 系统 运维',               color: '#FBBF24' },
    /* ── 工具 / 应用  橙黄色系 ── */
    { cls: 'ri-tools-line',             kw: 'tools 工具 设置',               color: '#FBBF24' },
    { cls: 'ri-settings-line',          kw: 'settings 设置 配置',            color: '#94A3B8' },
    { cls: 'ri-settings-2-line',        kw: 'settings 设置',                 color: '#94A3B8' },
    { cls: 'ri-settings-3-line',        kw: 'settings 设置 齿轮',            color: '#94A3B8' },
    { cls: 'ri-search-line',            kw: 'search 搜索 查找',              color: '#80B8FF' },
    { cls: 'ri-home-line',              kw: 'home 首页 主页',                color: '#6EE7B7' },
    { cls: 'ri-home-2-line',            kw: 'home 首页',                     color: '#6EE7B7' },
    { cls: 'ri-dashboard-line',         kw: 'dashboard 仪表盘 工作台',       color: '#A78BFA' },
    { cls: 'ri-apps-line',              kw: 'apps 应用 工作台',              color: '#F472B6' },
    { cls: 'ri-layout-grid-line',       kw: 'layout grid 布局 网格',         color: '#80B8FF' },
    { cls: 'ri-calendar-line',          kw: 'calendar 日历 计划 日程',       color: '#F87171' },
    { cls: 'ri-calendar-2-line',        kw: 'calendar 日历',                 color: '#F87171' },
    { cls: 'ri-time-line',              kw: 'time 时间 时钟',                color: '#FBBF24' },
    { cls: 'ri-timer-line',             kw: 'timer 计时器 时间',             color: '#FBBF24' },
    { cls: 'ri-mail-line',              kw: 'mail email 邮件 邮箱',          color: '#60A5FA' },
    { cls: 'ri-mail-send-line',         kw: 'mail send 发送 邮件',           color: '#60A5FA' },
    { cls: 'ri-message-line',           kw: 'message 消息 聊天',             color: '#34D399' },
    { cls: 'ri-message-2-line',         kw: 'message 消息',                  color: '#34D399' },
    { cls: 'ri-chat-1-line',            kw: 'chat 聊天 消息',                color: '#34D399' },
    { cls: 'ri-notification-line',      kw: 'notification 通知 提醒',        color: '#FB923C' },
    { cls: 'ri-bell-line',              kw: 'bell 铃铛 通知',                color: '#FB923C' },
    { cls: 'ri-user-line',              kw: 'user 用户 账号 人',             color: '#80B8FF' },
    { cls: 'ri-user-2-line',            kw: 'user 用户',                     color: '#80B8FF' },
    { cls: 'ri-team-line',              kw: 'team 团队 协作 群组',           color: '#A78BFA' },
    { cls: 'ri-group-line',             kw: 'group 群组 团队',               color: '#A78BFA' },
    { cls: 'ri-lock-line',              kw: 'lock 锁 安全',                  color: '#F87171' },
    { cls: 'ri-lock-2-line',            kw: 'lock 锁',                       color: '#F87171' },
    { cls: 'ri-key-line',               kw: 'key 密钥 安全 密码',            color: '#FBBF24' },
    { cls: 'ri-key-2-line',             kw: 'key 密钥',                      color: '#FBBF24' },
    { cls: 'ri-shield-line',            kw: 'shield 盾牌 安全 防护',         color: '#34D399' },
    { cls: 'ri-link',                   kw: 'link 链接 网址 url',            color: '#60A5FA' },
    { cls: 'ri-external-link-line',     kw: 'external link 外链 跳转',       color: '#60A5FA' },
    { cls: 'ri-chrome-line',            kw: 'chrome 浏览器',                 color: '#FBBF24' },
    { cls: 'ri-firefox-line',           kw: 'firefox 浏览器',                color: '#FF9500' },
    { cls: 'ri-edge-line',              kw: 'edge 浏览器 微软',              color: '#0078D4' },
    /* ── 文件 / 文档  紫色系 ── */
    { cls: 'ri-file-line',              kw: 'file 文件',                     color: '#94A3B8' },
    { cls: 'ri-file-2-line',            kw: 'file 文件',                     color: '#94A3B8' },
    { cls: 'ri-file-text-line',         kw: 'file text 文本 文档 txt',       color: '#E2E8F0' },
    { cls: 'ri-file-code-line',         kw: 'file code 代码文件',            color: '#80B8FF' },
    { cls: 'ri-file-pdf-line',          kw: 'pdf 文档',                      color: '#F87171' },
    { cls: 'ri-file-excel-line',        kw: 'excel 表格 csv xls',            color: '#21A366' },
    { cls: 'ri-file-word-line',         kw: 'word 文档 doc',                 color: '#2B579A' },
    { cls: 'ri-file-ppt-line',          kw: 'ppt 演示 幻灯片',               color: '#D24726' },
    { cls: 'ri-file-zip-line',          kw: 'zip 压缩 归档',                 color: '#FBBF24' },
    { cls: 'ri-file-image-line',        kw: 'image 图片 图像',               color: '#F472B6' },
    { cls: 'ri-file-music-line',        kw: 'music 音乐 音频',               color: '#A78BFA' },
    { cls: 'ri-file-video-line',        kw: 'video 视频',                    color: '#FB923C' },
    { cls: 'ri-folder-line',            kw: 'folder 文件夹 目录',            color: '#FBBF24' },
    { cls: 'ri-folder-2-line',          kw: 'folder 文件夹',                 color: '#FBBF24' },
    { cls: 'ri-folder-open-line',       kw: 'folder open 打开 文件夹',       color: '#FB923C' },
    { cls: 'ri-book-line',              kw: 'book 书 文档 知识库',           color: '#C084FC' },
    { cls: 'ri-book-2-line',            kw: 'book 书',                       color: '#C084FC' },
    { cls: 'ri-book-open-line',         kw: 'book open 阅读 文档',           color: '#C084FC' },
    { cls: 'ri-article-line',           kw: 'article 文章 文档',             color: '#E2E8F0' },
    { cls: 'ri-markdown-line',          kw: 'markdown md 文档',              color: '#80B8FF' },
    { cls: 'ri-edit-line',              kw: 'edit 编辑 修改',                color: '#6EE7B7' },
    { cls: 'ri-edit-2-line',            kw: 'edit 编辑',                     color: '#6EE7B7' },
    { cls: 'ri-pencil-line',            kw: 'pencil 铅笔 编辑',              color: '#FBBF24' },
    { cls: 'ri-clipboard-line',         kw: 'clipboard 剪贴板 复制',         color: '#94A3B8' },
    { cls: 'ri-file-copy-line',         kw: 'copy 复制 文件',                color: '#94A3B8' },
    { cls: 'ri-download-line',          kw: 'download 下载',                 color: '#34D399' },
    { cls: 'ri-upload-line',            kw: 'upload 上传',                   color: '#60A5FA' },
    { cls: 'ri-save-line',              kw: 'save 保存 存储',                color: '#6EE7B7' },
    /* ── AI / 数据  玫红色系 ── */
    { cls: 'ri-robot-line',             kw: 'robot ai 机器人 人工智能',      color: '#F472B6' },
    { cls: 'ri-robot-2-line',           kw: 'robot ai 机器人',               color: '#F472B6' },
    { cls: 'ri-brain-line',             kw: 'brain 大脑 ai 智能',            color: '#C084FC' },
    { cls: 'ri-openai-line',            kw: 'openai chatgpt ai',             color: '#E2E8F0' },
    { cls: 'ri-bard-line',              kw: 'bard gemini google ai',         color: '#4285F4' },
    { cls: 'ri-flask-line',             kw: 'flask 实验 测试 烧瓶',          color: '#A78BFA' },
    { cls: 'ri-test-tube-line',         kw: 'test tube 测试 实验',           color: '#A78BFA' },
    { cls: 'ri-bar-chart-line',         kw: 'bar chart 柱状图 数据 统计',    color: '#60A5FA' },
    { cls: 'ri-bar-chart-2-line',       kw: 'bar chart 柱状图',              color: '#60A5FA' },
    { cls: 'ri-pie-chart-line',         kw: 'pie chart 饼图 数据',           color: '#F472B6' },
    { cls: 'ri-pie-chart-2-line',       kw: 'pie chart 饼图',                color: '#F472B6' },
    { cls: 'ri-line-chart-line',        kw: 'line chart 折线图 趋势',        color: '#34D399' },
    { cls: 'ri-donut-chart-line',       kw: 'donut chart 环形图',            color: '#FBBF24' },
    { cls: 'ri-data-line',              kw: 'data 数据 分析',                color: '#80B8FF' },
    { cls: 'ri-flow-chart',             kw: 'flow chart 流程图 流程',        color: '#FB923C' },
    { cls: 'ri-mind-map',               kw: 'mind map 思维导图',             color: '#C084FC' },
    /* ── 媒体 / 通讯 ── */
    { cls: 'ri-video-line',             kw: 'video 视频 媒体',               color: '#F87171' },
    { cls: 'ri-video-chat-line',        kw: 'video chat 视频会议',           color: '#60A5FA' },
    { cls: 'ri-camera-line',            kw: 'camera 相机 截图',              color: '#94A3B8' },
    { cls: 'ri-image-line',             kw: 'image 图片 图像',               color: '#F472B6' },
    { cls: 'ri-gallery-line',           kw: 'gallery 图库 相册',             color: '#F472B6' },
    { cls: 'ri-music-line',             kw: 'music 音乐 音频',               color: '#A78BFA' },
    { cls: 'ri-headphone-line',         kw: 'headphone 耳机 音频',           color: '#A78BFA' },
    { cls: 'ri-phone-line',             kw: 'phone 电话 手机',               color: '#34D399' },
    { cls: 'ri-smartphone-line',        kw: 'smartphone 手机 移动',          color: '#94A3B8' },
    { cls: 'ri-tv-line',                kw: 'tv 电视 显示器',                color: '#60A5FA' },
    { cls: 'ri-printer-line',           kw: 'printer 打印机',                color: '#94A3B8' },
    { cls: 'ri-scan-line',              kw: 'scan 扫描 二维码',              color: '#FBBF24' },
    { cls: 'ri-qr-code-line',           kw: 'qr code 二维码',               color: '#E2E8F0' },
    /* ── 协作 / 项目管理 ── */
    { cls: 'ri-task-line',              kw: 'task 任务 待办',                color: '#60A5FA' },
    { cls: 'ri-todo-line',              kw: 'todo 待办 任务',                color: '#60A5FA' },
    { cls: 'ri-checkbox-line',          kw: 'checkbox 复选框 完成',          color: '#34D399' },
    { cls: 'ri-list-check',             kw: 'list check 清单 任务',          color: '#34D399' },
    { cls: 'ri-kanban-view',            kw: 'kanban 看板 项目',              color: '#A78BFA' },
    { cls: 'ri-roadmap-line',           kw: 'roadmap 路线图 计划',           color: '#FB923C' },
    { cls: 'ri-focus-line',             kw: 'focus 专注 目标',               color: '#F87171' },
    { cls: 'ri-flag-line',              kw: 'flag 旗 标记 里程碑',           color: '#F87171' },
    { cls: 'ri-flag-2-line',            kw: 'flag 旗 标记',                  color: '#F87171' },
    { cls: 'ri-slack-line',             kw: 'slack 聊天 协作',               color: '#4A154B' },
    { cls: 'ri-notion-line',            kw: 'notion 笔记 文档',              color: '#E2E8F0' },
    { cls: 'ri-figma-line',             kw: 'figma 设计 ui',                 color: '#F24E1E' },
    { cls: 'ri-trello-line',            kw: 'trello 看板 项目管理',          color: '#0052CC' },
    { cls: 'ri-confluence-line',        kw: 'confluence 文档 wiki',          color: '#0052CC' },
    { cls: 'ri-zoom-line',              kw: 'zoom 会议 视频会议',            color: '#2D8CFF' },
    { cls: 'ri-microsoft-line',         kw: 'microsoft 微软 office',         color: '#F25022' },
    { cls: 'ri-google-line',            kw: 'google 谷歌',                   color: '#4285F4' },
    /* ── 常用操作 / 通用 ── */
    { cls: 'ri-star-line',              kw: 'star 星 收藏 重要 喜欢',        color: '#FBBF24' },
    { cls: 'ri-heart-line',             kw: 'heart 心 喜欢 收藏',            color: '#F87171' },
    { cls: 'ri-bookmark-line',          kw: 'bookmark 书签 收藏',            color: '#FB923C' },
    { cls: 'ri-tag-line',               kw: 'tag 标签',                      color: '#A78BFA' },
    { cls: 'ri-price-tag-line',         kw: 'price tag 价格 标签',           color: '#34D399' },
    { cls: 'ri-share-line',             kw: 'share 分享',                    color: '#60A5FA' },
    { cls: 'ri-share-forward-line',     kw: 'share forward 分享 转发',       color: '#60A5FA' },
    { cls: 'ri-delete-bin-line',        kw: 'delete bin 删除 垃圾桶',        color: '#F87171' },
    { cls: 'ri-add-line',               kw: 'add plus 添加 新建 加号',       color: '#34D399' },
    { cls: 'ri-subtract-line',          kw: 'subtract minus 减少',           color: '#94A3B8' },
    { cls: 'ri-check-line',             kw: 'check 完成 确认 勾选',          color: '#34D399' },
    { cls: 'ri-close-line',             kw: 'close 关闭 取消 叉',            color: '#F87171' },
    { cls: 'ri-information-line',       kw: 'info information 信息 提示',    color: '#60A5FA' },
    { cls: 'ri-error-warning-line',     kw: 'warning error 警告 注意',       color: '#FBBF24' },
    { cls: 'ri-question-line',          kw: 'question 问题 帮助 疑问',       color: '#A78BFA' },
    { cls: 'ri-refresh-line',           kw: 'refresh 刷新 重载',             color: '#34D399' },
    { cls: 'ri-loop-left-line',         kw: 'loop sync 同步 循环',           color: '#60A5FA' },
    { cls: 'ri-arrow-right-line',       kw: 'arrow right 箭头 跳转',         color: '#80B8FF' },
    { cls: 'ri-arrow-left-line',        kw: 'arrow left 返回 箭头',          color: '#80B8FF' },
    { cls: 'ri-arrow-up-line',          kw: 'arrow up 向上 箭头',            color: '#80B8FF' },
    { cls: 'ri-arrow-down-line',        kw: 'arrow down 向下 箭头',          color: '#80B8FF' },
    { cls: 'ri-more-line',              kw: 'more 更多 菜单',                color: '#94A3B8' },
    { cls: 'ri-more-2-line',            kw: 'more 更多',                     color: '#94A3B8' },
    { cls: 'ri-menu-line',              kw: 'menu 菜单 导航',                color: '#94A3B8' },
    { cls: 'ri-grid-line',              kw: 'grid 网格 布局',                color: '#80B8FF' },
    { cls: 'ri-list-unordered',         kw: 'list 列表 无序',                color: '#94A3B8' },
    { cls: 'ri-eye-line',               kw: 'eye 眼睛 查看 可见',            color: '#60A5FA' },
    { cls: 'ri-eye-off-line',           kw: 'eye off 隐藏 不可见',           color: '#94A3B8' },
    { cls: 'ri-thumb-up-line',          kw: 'thumb up 点赞 好评',            color: '#FBBF24' },
    { cls: 'ri-map-pin-line',           kw: 'map pin 地图 位置 定位',        color: '#F87171' },
    { cls: 'ri-compass-line',           kw: 'compass 指南针 导航',           color: '#34D399' },
    { cls: 'ri-speed-line',             kw: 'speed 速度 性能',               color: '#FB923C' },
    { cls: 'ri-pulse-line',             kw: 'pulse 脉冲 监控 健康',          color: '#F87171' },
  ];

  var currentIconCls   = '';  /* 当前选中的 icon class */
  var currentIconColor = '';  /* 当前选中的 icon color */

  /**
   * 根据 class 查找对应颜色。
   * @param {string} cls
   * @returns {string} hex color 或 ''
   */
  function getIconColor(cls) {
    if (!cls) return '';
    var found = ICON_LIST.find(function (ic) { return ic.cls === cls; });
    return found ? (found.color || '') : '';
  }

  /**
   * 更新预览区域，并将 "cls|color" 写入隐藏字段。
   * @param {string} cls    Remix Icon class，空字符串表示清除
   * @param {string} [color] 颜色，不传则自动从 ICON_LIST 查找
   */
  function updateIconPreview(cls, color) {
    var wrap      = document.getElementById('iconPreviewWrap');
    var iconEl    = document.getElementById('iconPreviewEl');
    var iconInput = document.getElementById('itemIcon');
    if (!wrap) return;

    currentIconCls   = cls || '';
    currentIconColor = color || getIconColor(cls) || '#80B8FF';

    if (cls) {
      iconEl.className  = 'icon-preview-icon ' + cls;
      iconEl.style.color = currentIconColor;
      wrap.classList.add('has-icon');
    } else {
      iconEl.className  = 'icon-preview-icon';
      iconEl.style.color = '';
      wrap.classList.remove('has-icon');
      currentIconColor = '';
    }

    /* 存储格式："ri-xxx-line|#RRGGBB"，兼容旧数据（无颜色部分） */
    if (iconInput) {
      iconInput.value = cls ? (cls + '|' + currentIconColor) : '';
    }

    /* 同步网格选中状态 */
    var grid = document.getElementById('iconPickerGrid');
    if (grid) {
      grid.querySelectorAll('.icon-picker-item').forEach(function (btn) {
        btn.classList.toggle('selected', btn.dataset.cls === cls);
      });
    }
  }

  /* 暴露给 app.js 调用（openItemModal 回填图标时使用）
     app.js 存的 item.icon 格式可能是 "ri-xxx|#color" 或旧的 "ri-xxx" */
  window.updateIconPreview = function (iconValue) {
    if (!iconValue) { updateIconPreview('', ''); return; }
    var parts = iconValue.split('|');
    updateIconPreview(parts[0] || '', parts[1] || '');
  };

  /**
   * 渲染图标网格（彩色版）。
   * @param {string} keyword  搜索关键词
   */
  function renderIconGrid(keyword) {
    var grid = document.getElementById('iconPickerGrid');
    if (!grid) return;

    var kw = (keyword || '').trim().toLowerCase();
    var filtered = kw
      ? ICON_LIST.filter(function (ic) {
          return ic.cls.indexOf(kw) !== -1 || ic.kw.indexOf(kw) !== -1;
        })
      : ICON_LIST;

    grid.innerHTML = '';

    if (filtered.length === 0) {
      var empty = document.createElement('div');
      empty.className = 'icon-picker-empty';
      empty.textContent = '未找到匹配图标，试试其他关键词';
      grid.appendChild(empty);
      return;
    }

    filtered.forEach(function (ic) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'icon-picker-item' + (ic.cls === currentIconCls ? ' selected' : '');
      btn.dataset.cls   = ic.cls;
      btn.dataset.color = ic.color || '#80B8FF';
      btn.title = ic.cls.replace('ri-', '').replace(/-line$/, '') + '  |  ' + ic.kw;

      /* 图标用对应颜色渲染 */
      btn.innerHTML = '<i class="' + ic.cls + '" style="color:' + (ic.color || '#80B8FF') + '"></i>';

      /* 选中时边框也用该颜色 */
      if (ic.cls === currentIconCls) {
        btn.style.borderColor = ic.color || '#80B8FF';
        btn.style.background  = (ic.color || '#80B8FF') + '22';
      }

      btn.addEventListener('click', function () {
        var newCls = (currentIconCls === ic.cls) ? '' : ic.cls;
        updateIconPreview(newCls, newCls ? (ic.color || '#80B8FF') : '');
        /* 更新所有按钮边框状态 */
        grid.querySelectorAll('.icon-picker-item').forEach(function (b) {
          var isSelected = b.dataset.cls === newCls;
          b.classList.toggle('selected', isSelected);
          b.style.borderColor = isSelected ? (b.dataset.color || '') : '';
          b.style.background  = isSelected ? ((b.dataset.color || '#80B8FF') + '22') : '';
        });
      });

      grid.appendChild(btn);
    });
  }

  /**
   * 绑定图标选择器所有交互事件。
   * 在 itemModal 每次打开时调用，确保 DOM 已存在。
   */
  function bindIconPicker() {
    var searchInput = document.getElementById('iconSearchInput');
    var clearBtn    = document.getElementById('btnClearIcon');
    var previewWrap = document.getElementById('iconPreviewWrap');
    var grid        = document.getElementById('iconPickerGrid');

    if (!searchInput || !grid) return;
    if (searchInput._iconPickerBound) return;  /* 防止重复绑定 */
    searchInput._iconPickerBound = true;

    /* 搜索框输入 → 过滤网格 */
    var debounceTimer;
    searchInput.addEventListener('input', function () {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(function () {
        renderIconGrid(searchInput.value);
      }, 150);
    });

    /* 搜索框聚焦 → 展开网格（如果为空则渲染全部） */
    searchInput.addEventListener('focus', function () {
      if (!grid.children.length) {
        renderIconGrid(searchInput.value);
      }
    });

    /* 清除按钮 */
    if (clearBtn) {
      clearBtn.addEventListener('click', function () {
        updateIconPreview('');
        searchInput.value = '';
        renderIconGrid('');
      });
    }

    /* 点击预览区 → 聚焦搜索框 */
    if (previewWrap) {
      previewWrap.addEventListener('click', function () {
        searchInput.focus();
        if (!grid.children.length) renderIconGrid('');
      });
    }
  }

  /**
   * 监听 itemModal 打开，初始化图标选择器。
   * 使用 MutationObserver 监听 class 变化。
   */
  function watchItemModal() {
    var modal = document.getElementById('itemModal');
    if (!modal) return;

    var obs = new MutationObserver(function (mutations) {
      mutations.forEach(function (m) {
        if (m.type === 'attributes' && m.attributeName === 'class') {
          if (modal.classList.contains('show')) {
            /* 弹窗打开：初始化绑定 + 清空搜索框 + 重置网格 */
            bindIconPicker();
            var searchInput = document.getElementById('iconSearchInput');
            if (searchInput) searchInput.value = '';
            renderIconGrid('');
          }
        }
      });
    });

    obs.observe(modal, { attributes: true });
  }

  /* ── 初始化 ── */
  function initIconPicker() {
    watchItemModal();
    /* 如果 itemModal 已经是 show 状态（极少情况），立即初始化 */
    var modal = document.getElementById('itemModal');
    if (modal && modal.classList.contains('show')) {
      bindIconPicker();
      renderIconGrid('');
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initIconPicker);
  } else {
    requestAnimationFrame(initIconPicker);
  }

})();
