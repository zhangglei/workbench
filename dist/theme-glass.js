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
