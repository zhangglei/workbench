(function () {
  'use strict';

  var STORAGE_STATE = 'workbench_state';
  var STORAGE_TODOS = 'workbench_todos';
  var STORAGE_USER = 'workbench_user';
  var STORAGE_KNOWLEDGE = 'workbench_knowledge';

  function $(id) {
    return document.getElementById(id);
  }

  function readJson(key, fallback) {
    try {
      var raw = localStorage.getItem(key);
      if (!raw) return fallback;
      var parsed = JSON.parse(raw);
      return parsed == null ? fallback : parsed;
    } catch (e) {
      return fallback;
    }
  }

  function escapeHtml(text) {
    return String(text == null ? '' : text)
      .replace(/&/g, '\x26amp;')
      .replace(/</g, '\x26lt;')
      .replace(/>/g, '\x26gt;')
      .replace(/"/g, '\x26quot;')
      .replace(/'/g, '\x26#39;');
  }

  function getState() {
    var state = readJson(STORAGE_STATE, {});
    return state && typeof state === 'object' ? state : {};
  }

  function getModules(state) {
    return Array.isArray(state.modules) ? state.modules : [];
  }

  function getTodos(state) {
    var fromState = Array.isArray(state.todos) ? state.todos : [];
    var fromStorage = readJson(STORAGE_TODOS, []);
    return fromState.length ? fromState : (Array.isArray(fromStorage) ? fromStorage : []);
  }

  function getNotes() {
    var notes = readJson(STORAGE_KNOWLEDGE, []);
    return Array.isArray(notes) ? notes : [];
  }

  function getModuleIcon(module) {
    return module && module.icon ? module.icon : 'ri-apps-2-line';
  }

  function setText(id, value) {
    var el = $(id);
    if (el) el.textContent = String(value);
  }

  function getTodayText() {
    var now = new Date();
    var weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
    return String(now.getMonth() + 1).padStart(2, '0') + '/' + String(now.getDate()).padStart(2, '0') + ' · ' + weekdays[now.getDay()];
  }

  function isTodoDone(todo) {
    return !!(todo && (todo.done || todo.completed || todo.status === 'done'));
  }

  function buildSearchItems(modules, notes) {
    var items = [];

    modules.forEach(function (mod) {
      var modName = mod && mod.name ? mod.name : '未命名模块';
      items.push({
        title: modName,
        type: '模块',
        href: 'index.html#dashboard',
        keywords: [modName, mod && mod.desc, '模块 工作台']
      });

      (Array.isArray(mod.items) ? mod.items : []).forEach(function (item) {
        var title = item && item.title ? item.title : '未命名内容';
        items.push({
          title: title,
          type: modName,
          href: item && item.url ? item.url : 'index.html#dashboard',
          external: !!(item && item.url),
          keywords: [title, modName, item && item.content, item && item.url, '内容 链接 附件']
        });
      });
    });

    notes.forEach(function (note) {
      var title = note && note.title ? note.title : '未命名笔记';
      items.push({
        title: title,
        type: '知识笔记',
        href: 'index.html#knowledge',
        keywords: [title, note && note.summary, note && note.content, Array.isArray(note.tags) ? note.tags.join(' ') : '']
      });
    });

    return items;
  }

  function renderMetrics(modules, todos, notes) {
    var itemCount = modules.reduce(function (sum, mod) {
      return sum + (Array.isArray(mod.items) ? mod.items.length : 0);
    }, 0);
    var activeTodos = todos.filter(function (todo) { return !isTodoDone(todo); }).length;
    var score = Math.max(62, Math.min(99, 72 + Math.min(modules.length, 10) + Math.min(notes.length, 12) - Math.min(activeTodos, 8)));

    setText('portalModuleCount', modules.length);
    setText('portalItemCount', itemCount);
    setText('portalNoteCount', notes.length);
    setText('portalTodoCount', activeTodos);
    setText('portalFocusScore', score);
    setText('portalTodayLabel', getTodayText());

    var focusText = '已收纳 ' + modules.length + ' 个模块、' + notes.length + ' 条知识笔记，当前还有 ' + activeTodos + ' 个待办可推进。';
    setText('portalFocusText', focusText);
  }

  function renderUser() {
    var user = '';
    try {
      user = localStorage.getItem(STORAGE_USER) || '';
    } catch (e) {}
    setText('portalUserLabel', user ? ('欢迎回来，' + user) : '轻奢玻璃工作入口');
  }

  function renderModules(modules) {
    var wrap = $('portalModuleList');
    if (!wrap) return;

    var selected = modules.slice(0, 6);
    if (!selected.length) {
      wrap.innerHTML = '<a class="portal-module-item" href="index.html#dashboard"><span class="portal-module-item-icon"><i class="ri-add-circle-line"></i></span><span><strong>暂无模块</strong><span>进入工作台创建你的第一个模块</span></span></a>';
      return;
    }

    wrap.innerHTML = selected.map(function (mod) {
      var name = mod && mod.name ? mod.name : '未命名模块';
      var count = Array.isArray(mod.items) ? mod.items.length : 0;
      return '<a class="portal-module-item" href="index.html#dashboard">'
        + '<span class="portal-module-item-icon"><i class="' + escapeHtml(getModuleIcon(mod)) + '"></i></span>'
        + '<span><strong>' + escapeHtml(name) + '</strong><span>' + count + ' 个内容入口</span></span>'
        + '</a>';
    }).join('');
  }

  function renderTimeline(modules, todos, notes) {
    var wrap = $('portalTimeline');
    if (!wrap) return;

    var activeTodos = todos.filter(function (todo) { return !isTodoDone(todo); }).length;
    var itemCount = modules.reduce(function (sum, mod) {
      return sum + (Array.isArray(mod.items) ? mod.items.length : 0);
    }, 0);
    var latestNote = notes.slice().sort(function (a, b) {
      return new Date(b.updatedAt || b.date || b.createdAt || 0).getTime() - new Date(a.updatedAt || a.date || a.createdAt || 0).getTime();
    })[0];

    var rows = [
      ['工作台已就绪', '当前可快速进入 ' + modules.length + ' 个模块和 ' + itemCount + ' 个内容入口。'],
      ['今日推进建议', activeTodos ? ('优先处理 ' + activeTodos + ' 个未完成待办。') : '当前没有未完成待办，可以直接进入知识库或模块。'],
      ['知识沉淀', latestNote ? ('最近笔记：' + (latestNote.title || '未命名笔记')) : '暂无知识笔记，进入知识库开始记录。']
    ];

    wrap.innerHTML = rows.map(function (row) {
      return '<div class="portal-timeline-item">'
        + '<span class="portal-timeline-dot"></span>'
        + '<div><strong>' + escapeHtml(row[0]) + '</strong><span>' + escapeHtml(row[1]) + '</span></div>'
        + '</div>';
    }).join('');
  }

  function bindSearch(items) {
    var input = $('portalSearchInput');
    var results = $('portalSearchResults');
    if (!input || !results) return;

    function render(query) {
      var q = query.trim().toLowerCase();
      if (!q) {
        results.classList.remove('is-visible');
        results.innerHTML = '';
        return [];
      }

      var matched = items.filter(function (item) {
        return item.keywords.join(' ').toLowerCase().indexOf(q) !== -1;
      }).slice(0, 5);

      if (!matched.length) {
        results.classList.add('is-visible');
        results.innerHTML = '<div class="portal-result-item"><span>没有找到匹配内容</span><em>换个关键词</em></div>';
        return [];
      }

      results.classList.add('is-visible');
      results.innerHTML = matched.map(function (item) {
        var target = item.external ? ' target="_blank" rel="noopener"' : '';
        return '<a class="portal-result-item" href="' + escapeHtml(item.href) + '"' + target + '>'
          + '<span>' + escapeHtml(item.title) + '</span><em>' + escapeHtml(item.type) + '</em>'
          + '</a>';
      }).join('');
      return matched;
    }

    input.addEventListener('input', function () {
      render(input.value);
    });

    input.addEventListener('keydown', function (event) {
      if (event.key !== 'Enter') return;
      var matched = render(input.value);
      if (!matched.length) return;
      event.preventDefault();
      if (matched[0].external) {
        window.open(matched[0].href, '_blank', 'noopener');
      } else {
        window.location.href = matched[0].href;
      }
    });
  }

  function init() {
    var state = getState();
    var modules = getModules(state);
    var todos = getTodos(state);
    var notes = getNotes();

    renderUser();
    renderMetrics(modules, todos, notes);
    renderModules(modules);
    renderTimeline(modules, todos, notes);
    bindSearch(buildSearchItems(modules, notes));
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
