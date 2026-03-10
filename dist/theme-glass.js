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
     §C  MutationObserver — 监听主网格 DOM 变化
     ----------------------------------------------------------------
     当 app.js 的 renderModules() 重新渲染卡片后，
     Observer 回调中重新执行标签注入和事件绑定。
     ================================================================ */

  var mainGrid = null;   /* 主网格容器，延迟获取 */
  var observer = null;   /* MutationObserver 实例 */

  /**
   * 获取主网格容器（#mainGrid），不存在则返回 null。
   */
  function getMainGrid() {
    return document.getElementById('mainGrid');
  }

  /**
   * 启动 Observer，监听 #mainGrid 的子树变化。
   */
  function startObserver() {
    mainGrid = getMainGrid();
    if (!mainGrid) return;

    /* 绑定拖拽事件（委托到 mainGrid，只绑定一次） */
    mainGrid.addEventListener('dragstart', onDragStart);
    mainGrid.addEventListener('dragend', onDragEnd);

    observer = new MutationObserver(function (mutations) {
      /* 仅在有子节点变化时处理（忽略属性变化减少开销） */
      var hasChildChanges = mutations.some(function (m) {
        return m.type === 'childList' && m.addedNodes.length > 0;
      });
      if (!hasChildChanges) return;

      /* 短暂延迟，确保 app.js 渲染完毕 */
      setTimeout(injectAllTags, 60);
    });

    observer.observe(mainGrid, {
      childList: true,   /* 监听直接子节点增删 */
      subtree: false      /* 不监听子树，减少回调频率 */
    });

    /* 首次立即注入（页面已完成初始渲染时） */
    injectAllTags();
  }

  /* ================================================================
     §D  初始化入口
     ----------------------------------------------------------------
     等待 DOM 就绪后启动，兼容 DOMContentLoaded 已触发的情况。
     ================================================================ */

  function init() {
    startObserver();

    /* 若 #mainGrid 尚未挂载（极端情况），轮询等待 */
    if (!mainGrid) {
      var retries = 0;
      var timer = setInterval(function () {
        retries++;
        if (getMainGrid()) {
          clearInterval(timer);
          startObserver();
        } else if (retries > 40) {
          /* 超过 4 秒仍未找到，放弃轮询 */
          clearInterval(timer);
        }
      }, 100);
    }
  }

  /* DOMContentLoaded 可能已触发，使用 readyState 判断 */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    /* 页面已就绪，延迟一帧确保 app.js 初始化完成 */
    requestAnimationFrame(init);
  }

})();
