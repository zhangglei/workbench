(function () {
  'use strict';

  const STORAGE_LAYOUT = 'workbench_layout';
  const STORAGE_BG = 'workbench_bg';
  const STORAGE_STATE = 'workbench_state';
  const STORAGE_TODOS = 'workbench_todos';
  const STORAGE_TODO_UI = 'workbench_todo_ui';
  const STORAGE_USER = 'workbench_user';
  const STORAGE_USER_ROLE = 'workbench_user_role';

  const defaultLayout = { cols: 3, gap: 16, align: 'start' };
  const defaultBg = {
    type: 'color',
    color: '#1a1b26',
    image: '',
    gradient: 'linear-gradient(135deg, #1a1b26 0%, #24283b 100%)'
  };

  function id() {
    return 'id_' + Date.now() + '_' + Math.random().toString(36).slice(2, 9);
  }

  /** 将旧版 state（modules+links 扁平）转为新版（模块为基本，网页为模块下 items） */
  function migrateState(data) {
    if (!data) return { layout: defaultLayout, bg: defaultBg, modules: [], allowedUsers: '', guestUsers: '', todos: [] };
    var layout = data.layout || defaultLayout;
    var bg = data.bg || defaultBg;
    var allowedUsers = data.allowedUsers || '';
    var guestUsers = data.guestUsers || '';
    var todos = Array.isArray(data.todos) ? data.todos : [];
    var modules = [];
    var oldModules = data.modules || [];
    var oldLinks = data.links || [];
    if (oldModules.length || oldLinks.length) {
      var hasNewFormat = oldModules.length && oldModules[0].items !== undefined;
      if (!hasNewFormat) {
        var defaultModule = { id: id(), name: '默认', order: 0, visibleToAll: true, items: [] };
        oldModules.forEach(function (m) {
          defaultModule.items.push({
            id: id(),
            title: (m.alias || '').trim() || '未命名',
            url: '',
            content: (m.content || '').trim(),
            showContent: true,
            newTab: true,
            visibleToAll: true,
            comments: [],
            attachments: []
          });
        });
        oldLinks.forEach(function (l) {
          defaultModule.items.push({
            id: id(),
            title: (l.alias || '').trim() || '未命名',
            url: (l.url || '').trim(),
            content: '',
            showContent: true,
            newTab: l.newTab !== false,
            visibleToAll: true,
            comments: [],
            attachments: []
          });
        });
        modules = [defaultModule];
      } else {
        modules = oldModules.map(function (m) {
          return {
            id: m.id,
            name: (m.name || m.alias || '').trim() || '未命名',
            order: m.order != null ? m.order : 0,
            visibleToAll: m.visibleToAll !== false,
            mappedPath: m.mappedPath || undefined,
            items: (m.items || []).map(function (it) {
              return {
                id: it.id,
                title: (it.title || it.alias || '').trim() || '未命名',
            url: (it.url || '').trim(),
            content: (it.content || '').trim(),
                showContent: it.showContent !== false,
                newTab: it.newTab !== false,
                visibleToAll: it.visibleToAll !== false,
            comments: Array.isArray(it.comments) ? it.comments : [],
            attachments: Array.isArray(it.attachments) ? it.attachments : []
              };
            })
          };
        });
      }
    }
    return { layout: layout, bg: bg, modules: modules, allowedUsers: allowedUsers, guestUsers: guestUsers, todos: todos };
  }

  function load(key, fallback) {
    try {
      var s = localStorage.getItem(key);
      return s ? JSON.parse(s) : fallback;
    } catch (_) {
      return fallback;
    }
  }

  function pad2(n) {
    return String(n).padStart(2, '0');
  }

  function getDateKey(date) {
    return date.getFullYear() + '-' + pad2(date.getMonth() + 1) + '-' + pad2(date.getDate());
  }

  function parseDateKey(key) {
    if (!key || !/^\d{4}-\d{2}-\d{2}$/.test(key)) return null;
    var parts = key.split('-').map(function (part) { return parseInt(part, 10); });
    return new Date(parts[0], parts[1] - 1, parts[2]);
  }

  function formatDateKey(key) {
    var date = parseDateKey(key);
    if (!date) return '选择日期查看待办';
    return date.getFullYear() + ' 年 ' + (date.getMonth() + 1) + ' 月 ' + date.getDate() + ' 日';
  }

  function normalizeTodos(list) {
    return (Array.isArray(list) ? list : []).map(function (item) {
      var createdAt = Number(item && item.createdAt);
      if (!Number.isFinite(createdAt) || createdAt <= 0) createdAt = Date.now();
      return Object.assign({}, item, {
        createdAt: createdAt,
        createdAtText: item && item.createdAtText ? item.createdAtText : new Date(createdAt).toLocaleString()
      });
    });
  }

  function loadTodoUI() {
    var raw = load(STORAGE_TODO_UI, null) || {};
    var monthStr = typeof raw.calendarMonth === 'string' ? raw.calendarMonth + '-01' : '';
    var monthDate = parseDateKey(monthStr) || new Date();
    return {
      todoView: raw.todoView === 'calendar' ? 'calendar' : 'list',
      selectedDate: parseDateKey(raw.selectedDate) ? raw.selectedDate : '',
      calendarMonth: new Date(monthDate.getFullYear(), monthDate.getMonth(), 1)
    };
  }

  function persistTodoUI() {
    try {
      localStorage.setItem(STORAGE_TODO_UI, JSON.stringify({
        todoView: state.todoView || 'list',
        selectedDate: state.todoSelectedDate || '',
        calendarMonth: state.todoCalendarMonth
          ? (state.todoCalendarMonth.getFullYear() + '-' + pad2(state.todoCalendarMonth.getMonth() + 1))
          : ''
      }));
    } catch (_) {}
  }

  /* 最近使用记录管理 */
  var STORAGE_RECENT_ACTIVITY = 'workbench_recent_activity';
  var MAX_RECENT_ITEMS = 20;

  function loadRecentActivity() {
    return load(STORAGE_RECENT_ACTIVITY, []);
  }

  function saveRecentActivity(items) {
    try {
      localStorage.setItem(STORAGE_RECENT_ACTIVITY, JSON.stringify(items));
    } catch (_) {}
  }

  function addRecentActivity(type, id, title, meta) {
    var items = loadRecentActivity();
    /* 去重：移除已存在的相同条目 */
    items = items.filter(function (item) {
      return !(item.type === type && item.id === id);
    });
    /* 添加到开头 */
    items.unshift({
      type: type,
      id: id,
      title: title,
      meta: meta || '',
      timestamp: Date.now()
    });
    /* 限制数量 */
    if (items.length > MAX_RECENT_ITEMS) {
      items = items.slice(0, MAX_RECENT_ITEMS);
    }
    saveRecentActivity(items);
    renderRecentActivity();
  }

  var state = migrateState(null);
  state.layout = load(STORAGE_LAYOUT, defaultLayout);
  state.bg = load(STORAGE_BG, defaultBg);
  state.allowedUsers = load('workbench_allowed_users', '');
  state.guestUsers = state.guestUsers || '';
  state.todos = normalizeTodos(load(STORAGE_TODOS, state.todos || []));
  state.collapsedModules = state.collapsedModules || {};
  var raw = load(STORAGE_STATE, null);
  if (raw && raw.modules && raw.modules.length && raw.modules[0].items !== undefined) {
    state.modules = raw.modules;
    if (Array.isArray(raw.todos)) state.todos = normalizeTodos(raw.todos);
    if (raw.collapsedModules) state.collapsedModules = raw.collapsedModules;
  } else if (raw) {
    state = migrateState({ layout: state.layout, bg: state.bg, modules: raw.modules || [], links: raw.links || [], allowedUsers: state.allowedUsers });
    if (Array.isArray(raw.todos)) state.todos = normalizeTodos(raw.todos);
    state.collapsedModules = raw.collapsedModules || {};
  }
  state.todoFilter = 'all';
  state.todoTagFilter = 'all'; /* 标签筛选状态 */
  var todoUIState = loadTodoUI();
  state.todoView = todoUIState.todoView;
  state.todoSelectedDate = todoUIState.selectedDate;
  state.todoCalendarMonth = todoUIState.calendarMonth;
  var currentUser = localStorage.getItem(STORAGE_USER) || '';
  var currentRole = localStorage.getItem(STORAGE_USER_ROLE) || '';

  var CLOUD_STATE_URLS = [
    '/api/workbench-state',
    '/.netlify/functions/workbench-state'
  ];

  var lastCloudSyncError = '';

  async function fetchFirstOk(urls, init) {
    var lastErr = null;
    for (var i = 0; i < urls.length; i++) {
      try {
        var res = await fetch(urls[i], init);
        if (res && res.ok) {
          lastCloudSyncError = '';
          return { res: res, url: urls[i] };
        }
        lastErr = new Error('HTTP ' + (res ? res.status : 'unknown'));
      } catch (e) {
        lastErr = e;
      }
    }
    lastCloudSyncError = String(lastErr && lastErr.message ? lastErr.message : lastErr || '');
    throw lastErr || new Error('All endpoints failed');
  }

  function persistState() {
    var toSave = {
      layout: state.layout,
      bg: state.bg,
      modules: state.modules,
      todos: state.todos || [],
      allowedUsers: state.allowedUsers,
      guestUsers: state.guestUsers || '',
      collapsedModules: state.collapsedModules || {}
    };
    if (window.workbenchApi) {
      window.workbenchApi.saveState(toSave).catch(function (e) { console.error(e); });
    }
    try {
      localStorage.setItem('workbench_allowed_users', state.allowedUsers || '');
    } catch (_) {}
    if (!window.workbenchApi) {
      try {
        localStorage.setItem(STORAGE_LAYOUT, JSON.stringify(state.layout));
        localStorage.setItem(STORAGE_BG, JSON.stringify(state.bg));
        localStorage.setItem(STORAGE_TODOS, JSON.stringify(state.todos || []));
        localStorage.setItem(STORAGE_STATE, JSON.stringify({ modules: state.modules, todos: state.todos || [], allowedUsers: state.allowedUsers, guestUsers: state.guestUsers || '', collapsedModules: state.collapsedModules || {} }));
      } catch (_) {}
      fetchFirstOk(CLOUD_STATE_URLS, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(toSave)
      })
        .catch(function (e) { console.warn('云端保存失败', e); });
    }
  }

  function canEdit() {
    return currentRole === 'admin';
  }

  function canComment() {
    return !!currentUser;
  }

  var mainGrid = document.getElementById('mainGrid');
  var searchInput = document.getElementById('searchInput');
  var headerTitle = document.getElementById('headerTitle');
  var userArea = document.getElementById('userArea');
  var footerBar = document.getElementById('footerBar');
  var appRoot = document.getElementById('app');
  var loginOverlay = document.getElementById('loginOverlay');
  var todoForm = document.getElementById('todoForm');
  var todoInput = document.getElementById('todoInput');
  var todoTags = document.getElementById('todoTags');
  var todoPriority = document.getElementById('todoPriority');
  var todoList = document.getElementById('todoList');
  var todoSummary = document.getElementById('todoSummary');
  var todoEmpty = document.getElementById('todoEmpty');
  var todoFilter = document.getElementById('todoFilter');
  var btnTodoClearDone = document.getElementById('btnTodoClearDone');
  var todoViewSwitch = document.getElementById('todoViewSwitch');
  var todoCalendar = document.getElementById('todoCalendar');
  var todoCalendarGrid = document.getElementById('todoCalendarGrid');
  var todoCalendarTitle = document.getElementById('todoCalendarTitle');
  var todoCalendarSubtitle = document.getElementById('todoCalendarSubtitle');
  var todoCalendarDetailTitle = document.getElementById('todoCalendarDetailTitle');
  var todoCalendarDetailCount = document.getElementById('todoCalendarDetailCount');
  var todoCalendarDetailEmpty = document.getElementById('todoCalendarDetailEmpty');
  var todoCalendarDetailList = document.getElementById('todoCalendarDetailList');
  var btnTodoPrevMonth = document.getElementById('btnTodoPrevMonth');
  var btnTodoNextMonth = document.getElementById('btnTodoNextMonth');
  var btnCommandPalette = document.getElementById('btnCommandPalette');
  var commandPalette = document.getElementById('commandPalette');
  var commandPaletteInput = document.getElementById('commandPaletteInput');
  var commandPaletteResults = document.getElementById('commandPaletteResults');
  /* 概览卡片 DOM */
  var overviewTodoToday = document.getElementById('overviewTodoToday');
  var overviewTodoActive = document.getElementById('overviewTodoActive');
  var overviewKnowledgeCount = document.getElementById('overviewKnowledgeCount');
  var overviewKnowledgeWeek = document.getElementById('overviewKnowledgeWeek');
  /* 最近使用 DOM */
  var recentActivityEmpty = document.getElementById('recentActivityEmpty');
  var recentActivityList = document.getElementById('recentActivityList');

  var BG_LIBRARY = (function () {
    function svgDataUri(svg) {
      return 'data:image/svg+xml,' + encodeURIComponent(svg);
    }
    var w = 1920, h = 1080;
    function svg(body) {
      return '<svg xmlns="http://www.w3.org/2000/svg" width="' + w + '" height="' + h + '" viewBox="0 0 ' + w + ' ' + h + '">' + body + '</svg>';
    }
    function grad(id, stops) {
      var s = stops.map(function (x) { return '<stop offset="' + x[0] + '" stop-color="' + x[1] + '"/>'; }).join('');
      return '<defs><linearGradient id="' + id + '" x1="0%" y1="0%" x2="100%" y2="100%">' + s + '</linearGradient></defs><rect width="100%" height="100%" fill="url(#' + id + ')"/>';
    }
    return [
      { name: '深蓝夜', url: svgDataUri(svg(grad('g1', [['0%', '#0f0c29'], ['50%', '#302b63'], ['100%', '#24243e']]))) },
      { name: '湖蓝', url: svgDataUri(svg(grad('g2', [['0%', '#2193b0'], ['100%', '#6dd5ed']]))) },
      { name: '灰蓝', url: svgDataUri(svg(grad('g8', [['0%', '#1a1b26'], ['100%', '#414868']]))) }
    ];
  })();

  function applyLayout() {
    var l = state.layout;
    if (mainGrid) {
      mainGrid.style.setProperty('--layout-cols', String(l.cols));
      mainGrid.style.setProperty('--layout-gap', l.gap + 'px');
      mainGrid.style.setProperty('--layout-align', l.align);
    }
  }

  function applyBackground() {
    var b = state.bg;
    document.body.setAttribute('data-bg-type', b.type);
    document.body.style.setProperty('--bg-color', b.color);
    document.body.style.setProperty('--bg-image', b.image ? 'url(' + b.image + ')' : 'none');
    document.body.style.setProperty('--bg-gradient', b.gradient || defaultBg.gradient);
  }

  function escapeHtml(s) {
    var div = document.createElement('div');
    div.textContent = s == null ? '' : s;
    return div.innerHTML;
  }

  function stripHtml(s) {
    var div = document.createElement('div');
    div.innerHTML = s == null ? '' : String(s);
    return (div.textContent || div.innerText || '').trim();
  }

  function linkify(s) {
    return String(s).replace(
      /(https?:\/\/[^\s<]+)/g,
      '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>'
    );
  }

  function getSearchText() {
    return (searchInput && searchInput.value) ? searchInput.value.trim().toLowerCase() : '';
  }

  function getCurrentView() {
    return typeof window._currentView === 'function' ? window._currentView() : 'dashboard';
  }

  var commandPaletteState = {
    open: false,
    items: [],
    activeIndex: -1,
    query: ''
  };

  function getCommandPaletteEmptyHtml(message) {
    return '<div class="cmdk-empty">' + escapeHtml(message || '没有找到匹配项') + '</div>';
  }

  function getCommandPaletteHint(text) {
    return '<span class="cmdk-hint">' + escapeHtml(text || '') + '</span>';
  }

  function normalizeCommandKeywords(list) {
    return (Array.isArray(list) ? list : []).filter(Boolean).join(' ').toLowerCase();
  }

  function createCommandPaletteItem(type, title, meta, hint, keywords, run) {
    return {
      id: id(),
      type: type,
      title: title,
      meta: meta || '',
      hint: hint || '',
      keywords: normalizeCommandKeywords(keywords),
      run: run
    };
  }

  function openCommandPalette(initialQuery) {
    if (!commandPalette || !commandPaletteInput) return;
    commandPaletteState.open = true;
    commandPalette.classList.add('show');
    commandPalette.setAttribute('aria-hidden', 'false');
    commandPaletteInput.value = initialQuery != null ? String(initialQuery) : '';
    renderCommandPalette(commandPaletteInput.value);
    setTimeout(function () {
      commandPaletteInput.focus();
      commandPaletteInput.select();
    }, 0);
  }

  function closeCommandPalette() {
    if (!commandPalette) return;
    commandPaletteState.open = false;
    commandPalette.classList.remove('show');
    commandPalette.setAttribute('aria-hidden', 'true');
    commandPaletteState.items = [];
    commandPaletteState.activeIndex = -1;
  }

  function activateCommandPaletteItem(nextIndex) {
    if (!commandPaletteResults) return;
    if (!commandPaletteState.items.length) {
      commandPaletteState.activeIndex = -1;
      return;
    }
    if (nextIndex < 0) nextIndex = commandPaletteState.items.length - 1;
    if (nextIndex >= commandPaletteState.items.length) nextIndex = 0;
    commandPaletteState.activeIndex = nextIndex;
    var nodes = commandPaletteResults.querySelectorAll('.cmdk-item');
    nodes.forEach(function (node, idx) {
      node.classList.toggle('active', idx === nextIndex);
    });
    if (nodes[nextIndex] && typeof nodes[nextIndex].scrollIntoView === 'function') {
      nodes[nextIndex].scrollIntoView({ block: 'nearest' });
    }
  }

  function getCommandPaletteItems(query) {
    var q = String(query || '').trim().toLowerCase();
    var items = [];
    var currentView = getCurrentView();

    items.push(createCommandPaletteItem(
      'action',
      '切换到工作台',
      '视图',
      currentView === 'dashboard' ? '当前视图' : '切换到 Dashboard',
      ['dashboard', '工作台', '主页', 'home'],
      function () {
        if (typeof window.showView === 'function') window.showView('dashboard');
      }
    ));
    items.push(createCommandPaletteItem(
      'action',
      '切换到知识库',
      '视图',
      currentView === 'knowledge' ? '当前视图' : '切换到 Knowledge',
      ['knowledge', '知识库', '笔记'],
      function () {
        if (typeof window.showView === 'function') window.showView('knowledge');
        if (window.KnowledgeBase && typeof window.KnowledgeBase.init === 'function') {
          window.KnowledgeBase.init();
        }
      }
    ));
    items.push(createCommandPaletteItem(
      'action',
      '打开设置',
      '系统',
      '布局、背景、账号与同步设置',
      ['settings', '设置', '配置'],
      function () { openSettings(); }
    ));

    if (canEdit()) {
      items.push(createCommandPaletteItem(
        'action',
        '新建模块',
        '快捷操作',
        '添加一个新的工作台模块',
        ['添加模块', '新建模块', 'module'],
        function () {
          if (typeof window.showView === 'function') window.showView('dashboard');
          openModuleModal(null);
        }
      ));
      items.push(createCommandPaletteItem(
        'action',
        '新建内容',
        '快捷操作',
        state.modules.length ? '默认添加到第一个模块' : '当前没有模块，将先创建模块',
        ['添加内容', '新建内容', '网页', 'item'],
        function () {
          if (typeof window.showView === 'function') window.showView('dashboard');
          if (state.modules.length > 0) openItemModal(state.modules[0].id, null);
          else openModuleModal(null);
        }
      ));
      items.push(createCommandPaletteItem(
        'action',
        '新建知识笔记',
        '快捷操作',
        '打开知识库编辑器',
        ['新建笔记', '知识库', 'note', 'kb'],
        function () {
          if (typeof window.showView === 'function') window.showView('knowledge');
          if (window.KnowledgeBase && typeof window.KnowledgeBase.openEditor === 'function') {
            window.KnowledgeBase.openEditor(null);
          }
        }
      ));
    }

    items.push(createCommandPaletteItem(
      'action',
      '搜索工作台内容',
      '搜索',
      q ? ('应用关键词：' + q) : '把关键词同步到顶部搜索框',
      ['搜索', '模块', '内容', 'search'],
      function () {
        if (typeof window.showView === 'function') window.showView('dashboard');
        if (searchInput) {
          searchInput.value = commandPaletteState.query || '';
          renderModules();
          searchInput.focus();
          searchInput.select();
        }
      }
    ));
    items.push(createCommandPaletteItem(
      'action',
      '搜索知识库笔记',
      '搜索',
      q ? ('应用关键词：' + q) : '把关键词同步到知识库搜索框',
      ['搜索', '知识库', '笔记', 'knowledge', 'note'],
      function () {
        if (typeof window.showView === 'function') window.showView('knowledge');
        if (window.KnowledgeBase && typeof window.KnowledgeBase.setSearch === 'function') {
          window.KnowledgeBase.setSearch(commandPaletteState.query || '');
        }
      }
    ));

    (state.todos || []).forEach(function (todo) {
      var text = String((todo && (todo.text || todo.title || todo.content)) || '').trim();
      if (!text) return;
      items.push(createCommandPaletteItem(
        'todo',
        text,
        todo.done ? '待办 · 已完成' : '待办 · 进行中',
        todo.dateKey ? ('日期：' + todo.dateKey) : getTodoPriorityText(todo.priority),
        [text, todo.priority, todo.dateKey, todo.done ? 'done completed 已完成' : 'active 进行中', 'todo 待办'],
        function () {
          if (typeof window.showView === 'function') window.showView('dashboard');
          var panel = document.getElementById('todoPanel');
          if (panel && typeof panel.scrollIntoView === 'function') panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      ));
    });

    state.modules.forEach(function (mod) {
      var modName = (mod && mod.name) ? mod.name : '未命名模块';
      items.push(createCommandPaletteItem(
        'module',
        modName,
        '模块',
        (mod.items || []).length + ' 项内容',
        [modName, '模块 module'],
        function () {
          if (typeof window.showView === 'function') window.showView('dashboard');
          var node = document.querySelector('[data-module-id="' + mod.id + '"]');
          if (node && typeof node.scrollIntoView === 'function') {
            node.scrollIntoView({ behavior: 'smooth', block: 'center' });
            node.classList.add('module-card-flash');
            setTimeout(function () { node.classList.remove('module-card-flash'); }, 1200);
          }
        }
      ));

      (mod.items || []).forEach(function (it) {
        var contentText = stripHtml(linkify(it.content || ''));
        var itemTitle = (it && it.title) ? it.title : '未命名内容';
        items.push(createCommandPaletteItem(
          'item',
          itemTitle,
          modName,
          (it.url && it.content) ? '链接 + 正文' : (it.url ? '链接' : '正文'),
          [itemTitle, modName, it.url, it.content, '内容 item link'],
          function () {
            if (typeof window.showView === 'function') window.showView('dashboard');
            openItemModal(mod.id, it);
          }
        ));
        if (contentText) {
          items[items.length - 1].excerpt = contentText.slice(0, 80);
        }
      });
    });

    if (window.KnowledgeBase && typeof window.KnowledgeBase.getNotes === 'function') {
      (window.KnowledgeBase.getNotes() || []).forEach(function (note) {
        var title = String((note && note.title) || '未命名笔记');
        var summary = String((note && note.summary) || '').trim();
        items.push(createCommandPaletteItem(
          'note',
          title,
          note.category || '知识库',
          summary || '打开笔记详情',
          [title, note.category, summary, note.content, (note.tags || []).join(' '), '知识库 笔记 note'],
          function () {
            if (typeof window.showView === 'function') window.showView('knowledge');
            if (window.KnowledgeBase && typeof window.KnowledgeBase.openNote === 'function') {
              window.KnowledgeBase.openNote(note.id);
            }
          }
        ));
      });
    }

    if (!q) return items.slice(0, 40);
    return items.filter(function (item) {
      return item.title.toLowerCase().indexOf(q) !== -1 ||
        item.meta.toLowerCase().indexOf(q) !== -1 ||
        item.hint.toLowerCase().indexOf(q) !== -1 ||
        (item.excerpt && item.excerpt.toLowerCase().indexOf(q) !== -1) ||
        item.keywords.indexOf(q) !== -1;
    }).slice(0, 50);
  }

  function renderCommandPalette(query) {
    if (!commandPaletteResults) return;
    commandPaletteState.query = String(query || '').trim();
    commandPaletteState.items = getCommandPaletteItems(commandPaletteState.query);
    
    /* 统计搜索结果分类 */
    var stats = { action: 0, module: 0, item: 0, todo: 0, note: 0 };
    commandPaletteState.items.forEach(function (item) {
      if (stats[item.type] !== undefined) stats[item.type]++;
    });
    
    if (!commandPaletteState.items.length) {
      var emptyMsg = commandPaletteState.query
        ? '没有找到相关命令或内容 · 全局搜索支持：工作台模块、条目、待办、知识库笔记'
        : '输入关键词进行全局搜索 · 支持：工作台模块、条目、待办、知识库笔记';
      commandPaletteResults.innerHTML = getCommandPaletteEmptyHtml(emptyMsg);
      commandPaletteState.activeIndex = -1;
      return;
    }
    commandPaletteResults.innerHTML = commandPaletteState.items.map(function (item, idx) {
      return '<button type="button" class="cmdk-item' + (idx === 0 ? ' active' : '') + '" data-cmdk-index="' + idx + '">' +
        '<span class="cmdk-item-main">' +
          '<span class="cmdk-item-title">' + escapeHtml(item.title) + '</span>' +
          '<span class="cmdk-item-desc">' + escapeHtml(item.meta) + '</span>' +
        '</span>' +
        '<span class="cmdk-item-side">' +
          (item.hint ? getCommandPaletteHint(item.hint) : '') +
        '</span>' +
      '</button>';
    }).join('');
    
    /* 更新搜索统计提示 */
    var metaEl = document.querySelector('.cmdk-meta span:first-child');
    if (metaEl && commandPaletteState.query) {
      var parts = [];
      if (stats.item > 0) parts.push(stats.item + ' 个工作台条目');
      if (stats.note > 0) parts.push(stats.note + ' 篇知识库笔记');
      if (stats.module > 0) parts.push(stats.module + ' 个模块');
      if (stats.todo > 0) parts.push(stats.todo + ' 项待办');
      if (stats.action > 0) parts.push(stats.action + ' 个命令');
      
      if (parts.length > 0) {
        metaEl.textContent = '找到：' + parts.join('、');
      } else {
        metaEl.textContent = '全局搜索';
      }
    } else if (metaEl) {
      metaEl.textContent = '全局命令面板';
    }
    
    commandPaletteResults.querySelectorAll('.cmdk-item').forEach(function (node) {
      node.addEventListener('click', function () {
        var idx = parseInt(node.getAttribute('data-cmdk-index'), 10);
        var item = commandPaletteState.items[idx];
        if (!item) return;
        closeCommandPalette();
        item.run();
      });
    });
    commandPaletteState.activeIndex = 0;
  }

  function bindCommandPalette() {
    if (btnCommandPalette) {
      btnCommandPalette.addEventListener('click', function () {
        openCommandPalette('');
      });
    }
    if (commandPalette) {
      commandPalette.addEventListener('click', function (e) {
        if (e.target === commandPalette) closeCommandPalette();
      });
    }
    if (commandPaletteInput) {
      commandPaletteInput.addEventListener('input', function () {
        renderCommandPalette(this.value);
      });
      commandPaletteInput.addEventListener('keydown', function (e) {
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          activateCommandPaletteItem(commandPaletteState.activeIndex + 1);
          return;
        }
        if (e.key === 'ArrowUp') {
          e.preventDefault();
          activateCommandPaletteItem(commandPaletteState.activeIndex - 1);
          return;
        }
        if (e.key === 'Enter') {
          e.preventDefault();
          var item = commandPaletteState.items[commandPaletteState.activeIndex];
          if (item) {
            closeCommandPalette();
            item.run();
          }
        }
      });
    }
  }

  function getTodoPriorityText(priority) {
    if (priority === 'high') return '高优先级';
    if (priority === 'low') return '低优先级';
    return '中优先级';
  }

  /* 收集所有待办标签并去重 */
  function getAllTodoTags() {
    var tags = [];
    (state.todos || []).forEach(function (todo) {
      if (todo.tags && Array.isArray(todo.tags)) {
        todo.tags.forEach(function (tag) {
          if (tags.indexOf(tag) === -1) tags.push(tag);
        });
      }
    });
    return tags.sort();
  }

  function getFilteredTodos() {
    var list = Array.isArray(state.todos) ? state.todos.slice() : [];
    
    /* 按状态筛选 */
    if (state.todoFilter === 'active') {
      list = list.filter(function (item) { return !item.done; });
    } else if (state.todoFilter === 'done') {
      list = list.filter(function (item) { return !!item.done; });
    }
    
    /* 按标签筛选 */
    if (state.todoTagFilter && state.todoTagFilter !== 'all') {
      list = list.filter(function (item) {
        return item.tags && item.tags.indexOf(state.todoTagFilter) !== -1;
      });
    }
    
    return list;
  }

  function getTodosByDateKey(dateKey) {
    return getFilteredTodos().filter(function (item) {
      return getDateKey(new Date(item.createdAt || Date.now())) === dateKey;
    });
  }

  /* 渲染概览卡片统计 */
  function renderOverviewMetrics() {
    if (!overviewTodoToday || !overviewTodoActive || !overviewKnowledgeCount || !overviewKnowledgeWeek) return;
    
    var todos = state.todos || [];
    var today = getDateKey(new Date());
    
    /* 今日待办：今天创建的待办数 */
    var todayTodos = todos.filter(function (t) {
      var createdDate = new Date(t.createdAt);
      return getDateKey(createdDate) === today;
    });
    overviewTodoToday.textContent = String(todayTodos.length);
    
    /* 进行中：未完成的待办数 */
    var activeTodos = todos.filter(function (t) { return !t.done; });
    overviewTodoActive.textContent = String(activeTodos.length);
    
    /* 知识库笔记总数 */
    var notes = window.KnowledgeBase && window.KnowledgeBase.getNotes ? window.KnowledgeBase.getNotes() : [];
    overviewKnowledgeCount.textContent = String(notes.length);
    
    /* 本周新增笔记：最近7天创建的笔记数 */
    var weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    var weekNotes = notes.filter(function (n) {
      var noteDate = new Date(n.date || n.createdAt);
      return noteDate.getTime() >= weekAgo;
    });
    overviewKnowledgeWeek.textContent = String(weekNotes.length);
  }

  /* 渲染最近使用列表 */
  function renderRecentActivity() {
    if (!recentActivityEmpty || !recentActivityList) return;
    
    var items = loadRecentActivity();
    
    if (items.length === 0) {
      recentActivityEmpty.classList.remove('hidden');
      recentActivityList.innerHTML = '';
      return;
    }
    
    recentActivityEmpty.classList.add('hidden');
    
    recentActivityList.innerHTML = items.map(function (item) {
      var typeClass = item.type === 'module' ? 'recent-activity-type--module' : 'recent-activity-type--knowledge';
      var typeIcon = item.type === 'module' ? '<i class="ri-dashboard-line"></i>' : '<i class="ri-book-line"></i>';
      var typeLabel = item.type === 'module' ? '工作台' : '知识库';
      
      var timeAgo = formatTimeAgo(item.timestamp);
      
      return '<button type="button" class="recent-activity-item" data-type="' + escapeHtml(item.type) + '" data-id="' + escapeHtml(item.id) + '">' +
        '<div class="recent-activity-item-main">' +
          '<div class="recent-activity-item-top">' +
            '<h4 class="recent-activity-item-title">' + escapeHtml(item.title) + '</h4>' +
            '<span class="recent-activity-type ' + typeClass + '">' + typeIcon + typeLabel + '</span>' +
          '</div>' +
          (item.meta ? '<p class="recent-activity-item-meta">' + escapeHtml(item.meta) + '</p>' : '') +
          '<p class="recent-activity-item-time">' + timeAgo + '</p>' +
        '</div>' +
        '<span class="recent-activity-item-arrow"><i class="ri-arrow-right-s-line"></i></span>' +
      '</button>';
    }).join('');
    
    /* 绑定点击事件 */
    recentActivityList.querySelectorAll('.recent-activity-item').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var type = btn.dataset.type;
        var id = btn.dataset.id;
        
        if (type === 'module') {
          /* 跳转到工作台视图并打开对应条目 */
          var found = false;
          state.modules.forEach(function (mod) {
            var item = (mod.items || []).find(function (it) { return it.id === id; });
            if (item) {
              found = true;
              /* 确保在 dashboard 视图 */
              var dashboardView = document.getElementById('dashboard-view');
              var knowledgeView = document.getElementById('knowledge-view');
              if (dashboardView) dashboardView.style.display = '';
              if (knowledgeView) knowledgeView.style.display = 'none';
              
              /* 打开条目 */
              if (item.url && item.url.trim()) {
                window.open(item.url, item.newTab !== false ? '_blank' : '_self');
              } else if (canEdit()) {
                openItemModal(mod.id, item);
              } else {
                openViewContentModal(item);
              }
            }
          });
          if (!found) {
            showToast('条目不存在或已删除', 'warning');
          }
        } else if (type === 'knowledge') {
          /* 跳转到知识库视图并打开笔记 */
          var dashboardView = document.getElementById('dashboard-view');
          var knowledgeView = document.getElementById('knowledge-view');
          if (dashboardView) dashboardView.style.display = 'none';
          if (knowledgeView) knowledgeView.style.display = '';
          
          if (window.KnowledgeBase && window.KnowledgeBase.openNote) {
            window.KnowledgeBase.openNote(id);
          }
        }
      });
    });
  }

  /* 格式化时间为相对时间 */
  function formatTimeAgo(timestamp) {
    var now = Date.now();
    var diff = now - timestamp;
    var seconds = Math.floor(diff / 1000);
    var minutes = Math.floor(seconds / 60);
    var hours = Math.floor(minutes / 60);
    var days = Math.floor(hours / 24);
    
    if (seconds < 60) return '刚刚';
    if (minutes < 60) return minutes + ' 分钟前';
    if (hours < 24) return hours + ' 小时前';
    if (days < 7) return days + ' 天前';
    
    var date = new Date(timestamp);
    return date.getFullYear() + '-' + pad2(date.getMonth() + 1) + '-' + pad2(date.getDate());
  }

  function updateTodoSummary() {
    if (!todoSummary) return;
    var all = Array.isArray(state.todos) ? state.todos : [];
    var done = all.filter(function (item) { return !!item.done; }).length;
    var active = all.length - done;
    if (!all.length) {
      todoSummary.textContent = '把今天要做的事先记下来';
      return;
    }
    todoSummary.textContent = '共 ' + all.length + ' 项，进行中 ' + active + ' 项，已完成 ' + done + ' 项';
  }

  function syncTodoViewUI(items) {
    var isCalendar = state.todoView === 'calendar';
    if (todoList) todoList.classList.toggle('hidden', isCalendar);
    if (todoCalendar) todoCalendar.classList.toggle('hidden', !isCalendar);
    if (todoFilter) todoFilter.classList.toggle('hidden', isCalendar);
    if (todoEmpty) todoEmpty.classList.toggle('hidden', isCalendar || (items && items.length > 0));
    if (todoViewSwitch) {
      todoViewSwitch.querySelectorAll('.todo-view-btn').forEach(function (btn) {
        btn.classList.toggle('todo-view-btn--active', btn.dataset.view === state.todoView);
      });
    }
  }

  function renderTodoCalendarDetail() {
    if (!todoCalendarDetailList || !todoCalendarDetailTitle || !todoCalendarDetailEmpty) return;
    var selectedDate = state.todoSelectedDate;
    var items = selectedDate ? getTodosByDateKey(selectedDate) : [];
    todoCalendarDetailTitle.textContent = formatDateKey(selectedDate);
    if (todoCalendarDetailCount) {
      todoCalendarDetailCount.textContent = selectedDate ? ('共 ' + items.length + ' 项') : '';
    }
    todoCalendarDetailList.innerHTML = '';
    todoCalendarDetailEmpty.classList.toggle('hidden', !selectedDate || items.length > 0);
    if (!selectedDate || !items.length) return;

    items.forEach(function (item) {
      var row = document.createElement('div');
      row.className = 'todo-calendar-entry' + (item.done ? ' is-done' : '');
      row.innerHTML = '' +
        '<label class="todo-calendar-entry-main">' +
          '<input class="todo-check" type="checkbox" ' + (item.done ? 'checked' : '') + ' aria-label="切换完成状态">' +
          '<span class="todo-calendar-entry-text"></span>' +
        '</label>' +
        '<div class="todo-calendar-entry-meta">' +
          '<span class="todo-badge todo-badge--' + escapeHtml(item.priority || 'medium') + '">' + escapeHtml(getTodoPriorityText(item.priority)) + '</span>' +
          '<button type="button" class="todo-icon-btn" data-action="delete" title="删除待办" aria-label="删除待办">🗑</button>' +
        '</div>';
      row.querySelector('.todo-calendar-entry-text').textContent = item.text || '';
      row.querySelector('.todo-check').addEventListener('change', function () {
        item.done = !item.done;
        item.doneAt = item.done ? Date.now() : null;
        persistState();
        renderTodos();
      });
      row.querySelector('[data-action="delete"]').addEventListener('click', function () {
        state.todos = (state.todos || []).filter(function (x) { return x.id !== item.id; });
        persistState();
        renderTodos();
        showToast('待办已删除', 'success');
      });
      todoCalendarDetailList.appendChild(row);
    });
  }

  function renderTodoCalendar() {
    if (!todoCalendarGrid || !todoCalendar) return;
    var month = state.todoCalendarMonth instanceof Date ? state.todoCalendarMonth : new Date();
    var firstDay = new Date(month.getFullYear(), month.getMonth(), 1);
    var startWeekday = (firstDay.getDay() + 6) % 7;
    var daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
    var todayKey = getDateKey(new Date());
    var monthPrefix = month.getFullYear() + '-' + pad2(month.getMonth() + 1);
    var counts = {};

    getFilteredTodos().forEach(function (item) {
      var key = getDateKey(new Date(item.createdAt || Date.now()));
      counts[key] = (counts[key] || 0) + 1;
    });

    if (todoCalendarTitle) {
      todoCalendarTitle.textContent = month.getFullYear() + ' 年 ' + (month.getMonth() + 1) + ' 月';
    }
    if (todoCalendarSubtitle) {
      var total = Object.keys(counts).reduce(function (sum, key) {
        return key.indexOf(monthPrefix) === 0 ? sum + counts[key] : sum;
      }, 0);
      todoCalendarSubtitle.textContent = total ? ('本月共有 ' + total + ' 项待办') : '点击日期查看当天待办';
    }

    todoCalendarGrid.innerHTML = '';
    for (var i = 0; i < startWeekday; i++) {
      var blank = document.createElement('div');
      blank.className = 'todo-calendar-cell todo-calendar-cell--blank';
      todoCalendarGrid.appendChild(blank);
    }

    for (var day = 1; day <= daysInMonth; day++) {
      (function (d) {
        var date = new Date(month.getFullYear(), month.getMonth(), d);
        var key = getDateKey(date);
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'todo-calendar-cell';
        if (key === todayKey) btn.classList.add('is-today');
        if (key === state.todoSelectedDate) btn.classList.add('is-selected');
        if (counts[key]) btn.classList.add('has-items');
        btn.innerHTML = '' +
          '<span class="todo-calendar-day-num">' + d + '</span>' +
          '<span class="todo-calendar-day-count">' + (counts[key] ? (counts[key] + ' 项') : '') + '</span>';
        btn.addEventListener('click', function () {
          state.todoSelectedDate = key;
          persistTodoUI();
          renderTodos();
        });
        todoCalendarGrid.appendChild(btn);
      })(day);
    }

    renderTodoCalendarDetail();
  }

  function renderTodos() {
    if (!todoList) return;
    var items = getFilteredTodos();
    todoList.innerHTML = '';
    if (todoEmpty) todoEmpty.classList.toggle('hidden', state.todoView === 'calendar' || items.length > 0);
    
    /* 渲染状态筛选按钮 */
    if (todoFilter) {
      todoFilter.querySelectorAll('.todo-filter-btn').forEach(function (btn) {
        btn.classList.toggle('todo-filter-btn--active', btn.dataset.filter === state.todoFilter);
      });
    }
    
    /* 动态渲染标签筛选按钮 */
    var tagFilterContainer = document.getElementById('todoTagFilter');
    if (tagFilterContainer) {
      var allTags = getAllTodoTags();
      if (allTags.length > 0) {
        tagFilterContainer.innerHTML = '<span class="todo-tag-filter-label">标签：</span>' +
          '<button type="button" class="todo-tag-filter-btn' + (state.todoTagFilter === 'all' ? ' todo-tag-filter-btn--active' : '') + '" data-tag="all">全部</button>' +
          allTags.map(function (tag) {
            return '<button type="button" class="todo-tag-filter-btn' + (state.todoTagFilter === tag ? ' todo-tag-filter-btn--active' : '') + '" data-tag="' + escapeHtml(tag) + '">' + escapeHtml(tag) + '</button>';
          }).join('');
        tagFilterContainer.classList.remove('hidden');
      } else {
        tagFilterContainer.innerHTML = '';
        tagFilterContainer.classList.add('hidden');
      }
    }
    items.forEach(function (item) {
      var row = document.createElement('div');
      row.className = 'todo-item' + (item.done ? ' is-done' : '');
      
      /* 渲染标签 */
      var tagsHtml = '';
      if (item.tags && item.tags.length > 0) {
        tagsHtml = '<div class="todo-tags">' +
          item.tags.map(function (tag) {
            return '<span class="todo-tag">' + escapeHtml(tag) + '</span>';
          }).join('') +
        '</div>';
      }
      
      row.innerHTML = '' +
        '<input class="todo-check" type="checkbox" ' + (item.done ? 'checked' : '') + ' aria-label="切换完成状态">' +
        '<div class="todo-content">' +
          '<p class="todo-text"></p>' +
          tagsHtml +
          '<div class="todo-meta">' +
            '<span class="todo-badge todo-badge--' + escapeHtml(item.priority || 'medium') + '">' + escapeHtml(getTodoPriorityText(item.priority)) + '</span>' +
            '<span class="todo-time">创建于 ' + escapeHtml(item.createdAtText || '') + '</span>' +
          '</div>' +
        '</div>' +
        '<div class="todo-actions">' +
          '<button type="button" class="todo-icon-btn" data-action="delete" title="删除待办" aria-label="删除待办">🗑</button>' +
        '</div>';
      row.querySelector('.todo-text').textContent = item.text || '';
      row.querySelector('.todo-check').addEventListener('change', function () {
        item.done = !item.done;
        item.doneAt = item.done ? Date.now() : null;
        persistState();
        renderTodos();
      });
      row.querySelector('[data-action="delete"]').addEventListener('click', function () {
        state.todos = (state.todos || []).filter(function (x) { return x.id !== item.id; });
        persistState();
        renderTodos();
        renderOverviewMetrics();
        showToast('待办已删除', 'success');
      });
      todoList.appendChild(row);
    });
    updateTodoSummary();
    syncTodoViewUI(items);
    renderTodoCalendar();
    /* 更新概览统计 */
    renderOverviewMetrics();
  }

  function bindTodoPanel() {
    if (todoForm && todoForm.dataset.boundTodo !== '1') {
      todoForm.dataset.boundTodo = '1';
      todoForm.addEventListener('submit', function () {
        var text = todoInput ? todoInput.value.trim() : '';
        if (!text) {
          showToast('请输入待办内容', 'warning');
          if (todoInput) todoInput.focus();
          return;
        }
        /* 解析标签：用空格分隔 */
        var tagsText = todoTags ? todoTags.value.trim() : '';
        var tags = tagsText ? tagsText.split(/\s+/).filter(function (t) { return t.length > 0; }) : [];
        
        state.todos = state.todos || [];
        state.todos.unshift({
          id: id(),
          text: text,
          tags: tags,
          priority: todoPriority ? todoPriority.value : 'medium',
          done: false,
          createdAt: Date.now(),
          createdAtText: new Date().toLocaleString()
        });
        state.todoCalendarMonth = new Date();
        state.todoSelectedDate = getDateKey(new Date());
        persistState();
        persistTodoUI();
        renderTodos();
        if (todoInput) todoInput.value = '';
        if (todoTags) todoTags.value = '';
        if (todoPriority) todoPriority.value = 'medium';
        showToast('待办已添加', 'success');
      });
    }

    if (todoFilter && todoFilter.dataset.boundTodo !== '1') {
      todoFilter.dataset.boundTodo = '1';
      todoFilter.addEventListener('click', function (event) {
        var btn = event.target.closest('.todo-filter-btn');
        if (!btn) return;
        state.todoFilter = btn.dataset.filter || 'all';
        renderTodos();
      });
    }

    /* 绑定标签筛选按钮点击事件 */
    document.addEventListener('click', function (event) {
      var tagBtn = event.target.closest('.todo-tag-filter-btn');
      if (!tagBtn) return;
      state.todoTagFilter = tagBtn.dataset.tag || 'all';
      renderTodos();
    });

    if (todoViewSwitch && todoViewSwitch.dataset.boundTodo !== '1') {
      todoViewSwitch.dataset.boundTodo = '1';
      todoViewSwitch.addEventListener('click', function (event) {
        var btn = event.target.closest('.todo-view-btn');
        if (!btn) return;
        state.todoView = btn.dataset.view === 'calendar' ? 'calendar' : 'list';
        if (!state.todoSelectedDate && state.todos && state.todos.length) {
          state.todoSelectedDate = getDateKey(new Date(state.todos[0].createdAt || Date.now()));
        }
        persistTodoUI();
        renderTodos();
      });
    }

    if (btnTodoPrevMonth && btnTodoPrevMonth.dataset.boundTodo !== '1') {
      btnTodoPrevMonth.dataset.boundTodo = '1';
      btnTodoPrevMonth.addEventListener('click', function () {
        state.todoCalendarMonth = new Date(state.todoCalendarMonth.getFullYear(), state.todoCalendarMonth.getMonth() - 1, 1);
        persistTodoUI();
        renderTodoCalendar();
      });
    }

    if (btnTodoNextMonth && btnTodoNextMonth.dataset.boundTodo !== '1') {
      btnTodoNextMonth.dataset.boundTodo = '1';
      btnTodoNextMonth.addEventListener('click', function () {
        state.todoCalendarMonth = new Date(state.todoCalendarMonth.getFullYear(), state.todoCalendarMonth.getMonth() + 1, 1);
        persistTodoUI();
        renderTodoCalendar();
      });
    }

    if (btnTodoClearDone && btnTodoClearDone.dataset.boundTodo !== '1') {
      btnTodoClearDone.dataset.boundTodo = '1';
      btnTodoClearDone.addEventListener('click', function () {
        var before = (state.todos || []).length;
        state.todos = (state.todos || []).filter(function (item) { return !item.done; });
        if (state.todos.length === before) {
          showToast('没有可清除的已完成待办', 'info');
          return;
        }
        persistState();
        renderTodos();
        showToast('已清除完成项', 'success');
      });
    }
  }

  function matchSearch(module, item) {
    var q = getSearchText();
    if (!q) return true;
    
    /* 使用高级搜索模块 */
    if (window.AdvancedSearch) {
      var searchCriteria = window.AdvancedSearch.parseSearchQuery(q);
      
      if (item) {
        /* 条目匹配：使用高级搜索 */
        return window.AdvancedSearch.matchesSearchCriteria(item, searchCriteria);
      } else {
        /* 模块名匹配：仅检查文本 */
        if (searchCriteria.text) {
          return (module.name || '').toLowerCase().indexOf(searchCriteria.text) !== -1;
        }
        return true;
      }
    }
    
    /* 降级：使用简单搜索 */
    if (item) {
      var attNames = (Array.isArray(item.attachments) ? item.attachments : [])
        .map(function (a) { return a.name || ''; }).join(' ');
      var text = (item.title + ' ' + (item.url || '') + ' ' + (item.content || '') + ' ' + attNames).toLowerCase();
      return text.indexOf(q) !== -1;
    } else {
      return (module.name || '').toLowerCase().indexOf(q) !== -1;
    }
  }

  /**
   * 判断搜索词是否命中模块名（用于决定是否整体展示该模块）
   */
  function matchModuleName(module) {
    var q = getSearchText();
    if (!q) return true;
    return (module.name || '').toLowerCase().indexOf(q) !== -1;
  }

  /**
   * 在 str 中高亮所有 q 出现的位置，返回带 <mark> 的 HTML 字符串。
   * str 应是已 escapeHtml 过的安全 HTML 文本。
   */
    function highlightMatch(str, q) {
    if (!q || !str) return str;
    var escaped = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return str.replace(new RegExp('(' + escaped + ')', 'gi'), '<mark>$1</mark>');
  }

  function showToast(message, type) {
    if (window.WorkbenchUI && typeof window.WorkbenchUI.showToast === 'function') {
      window.WorkbenchUI.showToast(message, type || 'success');
    }
  }

    function confirmAction(message, onConfirm, options) {
    if (window.WorkbenchUI && typeof window.WorkbenchUI.confirm === 'function') {
      window.WorkbenchUI.confirm({
        title: (options && options.title) || '请确认操作',
        message: message || '确认继续吗？',
        confirmText: (options && options.confirmText) || '确定',
        cancelText: (options && options.cancelText) || '取消',
        danger: !options || options.danger !== false
      }).then(function (ok) {
        if (ok && typeof onConfirm === 'function') onConfirm();
      });
      return;
    }
    showToast('确认弹窗不可用，请刷新页面后重试', 'error');
  }


  function openModuleModal(module) {

    var titleEl = document.getElementById('moduleModalTitle');
    var idEl = document.getElementById('moduleId');
    var nameEl = document.getElementById('moduleName');
    var pathEl = document.getElementById('moduleMappedPath');
    var visibleEl = document.getElementById('moduleVisibleToAll');
    if (titleEl) titleEl.textContent = module ? '编辑模块' : '添加模块';
    if (idEl) idEl.value = module ? module.id : '';
    if (nameEl) nameEl.value = module ? (module.name || '') : '';
    if (pathEl) pathEl.value = module ? (module.mappedPath || '') : '';
    if (visibleEl) visibleEl.checked = module ? (module.visibleToAll !== false) : true;
    var modal = document.getElementById('moduleModal');
    if (modal) modal.classList.add('show');
  }

  function closeModuleModal() {
    var modal = document.getElementById('moduleModal');
    if (modal) modal.classList.remove('show');
  }

  var editingAttachments = [];

  function renderAttachmentsList() {
    var list = document.getElementById('itemAttachmentsList');
    if (!list) return;
    list.innerHTML = '';
    if (!editingAttachments || !editingAttachments.length) {
      list.innerHTML = '<p class="setting-hint">暂无已导入文件</p>';
      return;
    }
    editingAttachments.forEach(function (att) {
      var row = document.createElement('div');
      row.className = 'attachment-row';
      row.innerHTML =
        '<span class="attachment-name" title="' + escapeHtml(att.name || '') + '">' + escapeHtml(att.name || '') + '</span>' +
        '<button type="button" class="btn btn-info btn-sm btn-view-attachment" data-aid="' + escapeHtml(att.id) + '">查看</button>' +
        '<button type="button" class="btn btn-secondary btn-sm btn-edit-attachment" data-aid="' + escapeHtml(att.id) + '">编辑</button>' +
        '<button type="button" class="btn btn-danger btn-sm btn-del-attachment" data-aid="' + escapeHtml(att.id) + '">删</button>';
      list.appendChild(row);
    });

    list.querySelectorAll('.btn-view-attachment').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var aid = btn.getAttribute('data-aid');
        var att = editingAttachments.find(function (x) { return x.id === aid; });
        if (att) openAttachmentViewWindow(att);
      });
    });
    list.querySelectorAll('.btn-edit-attachment').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var aid = btn.getAttribute('data-aid');
        var att = editingAttachments.find(function (x) { return x.id === aid; });
        if (att) openAttachmentEditWindow(att, function (newContent) {
          att.content = newContent;
        });
      });
    });
    list.querySelectorAll('.btn-del-attachment').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var aid = btn.getAttribute('data-aid');
        editingAttachments = editingAttachments.filter(function (x) { return x.id !== aid; });
        renderAttachmentsList();
      });
    });

  }



  function buildAttachmentViewHtml(att) {
    var name = att.name || '未命名';
    var content = att.content || '';
    var ext = (att.type || '').toLowerCase();
    var bodyHtml = '';

    if (ext === 'md') {
      // Markdown：简单规则渲染
      function mdToHtml(md) {
        var lines = md.split('\n');
        var out = [];
        var inCode = false;
        var inTable = false;
        lines.forEach(function(line) {
          if (line.startsWith('```')) {
            if (inCode) { out.push('</code></pre>'); inCode = false; }
            else { out.push('<pre><code>'); inCode = true; }
            return;
          }
          if (inCode) { out.push(escapeHtml(line)); return; }
          // table
          if (/^\|/.test(line)) {
            if (!inTable) { out.push('<table>'); inTable = true; }
            var cells = line.replace(/^\||\|$/g, '').split('|');
            if (/^[\s\|\-:]+$/.test(line)) { return; }
            out.push('<tr>' + cells.map(function(c){ return '<td>' + escapeHtml(c.trim()) + '</td>'; }).join('') + '</tr>');
            return;
          } else if (inTable) { out.push('</table>'); inTable = false; }
          // headings
          var hm = line.match(/^(#{1,6})\s+(.*)/);
          if (hm) { var lv = hm[1].length; out.push('<h' + lv + '>' + escapeHtml(hm[2]) + '</h' + lv + '>'); return; }
          // hr
          if (/^---+$/.test(line.trim())) { out.push('<hr>'); return; }
          // blockquote
          var bqm = line.match(/^>\s?(.*)/);
          if (bqm) { out.push('<blockquote>' + escapeHtml(bqm[1]) + '</blockquote>'); return; }
          // list
          var ulm = line.match(/^[\-\*\+]\s+(.*)/);
          if (ulm) { out.push('<li>' + escapeHtml(ulm[1]) + '</li>'); return; }
          var olm = line.match(/^\d+\.\s+(.*)/);
          if (olm) { out.push('<li>' + escapeHtml(olm[1]) + '</li>'); return; }
          // empty
          if (!line.trim()) { out.push('<br>'); return; }
          // inline: bold, italic, code, link
          var p = escapeHtml(line)
            .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.+?)\*/g, '<em>$1</em>')
            .replace(/`(.+?)`/g, '<code>$1</code>')
            .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>');
          out.push('<p>' + p + '</p>');
        });
        if (inCode) out.push('</code></pre>');
        if (inTable) out.push('</table>');
        return out.join('\n');
      }
      bodyHtml = '<article class="md-body">' + mdToHtml(content) + '</article>';
    } else if (ext === 'csv') {
      // CSV：渲染为表格
      var rows = content.split('\n').filter(function(r){ return r.trim(); });
      var tableRows = rows.map(function(row, i) {
        var tag = i === 0 ? 'th' : 'td';
        var cells = row.split(',').map(function(c){ return '<' + tag + '>' + escapeHtml(c.trim().replace(/^"|"$/g,'')) + '</' + tag + '>'; }).join('');
        return '<tr>' + cells + '</tr>';
      }).join('');
      bodyHtml = '<div class="csv-wrap"><table class="csv-table">' + tableRows + '</table></div>';
    } else if (ext === 'json') {
      // JSON：高亮显示
      var formatted = content;
      try { formatted = JSON.stringify(JSON.parse(content), null, 2); } catch(e) {}
      function jsonHighlight(str) {
        return escapeHtml(str).replace(
          /("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g,
          function(match) {
            var cls = 'json-num';
            if (/^"/.test(match)) cls = /:$/.test(match) ? 'json-key' : 'json-str';
            else if (/true|false/.test(match)) cls = 'json-bool';
            else if (/null/.test(match)) cls = 'json-null';
            return '<span class="' + cls + '">' + match + '</span>';
          }
        );
      }
      bodyHtml = '<pre class="json-pre">' + jsonHighlight(formatted) + '</pre>';
    } else {
      // txt / 其他：原文等宽
      bodyHtml = '<pre class="txt-pre">' + escapeHtml(content) + '</pre>';
    }

    var extLabel = ext === 'md' ? 'Markdown' : ext === 'csv' ? 'CSV' : ext === 'json' ? 'JSON' : ext ? ext.toUpperCase() : 'TXT';
    return '<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
      '<title>' + escapeHtml(name) + '</title>' +
      '<style>' +
        /* ── 全局 ── */
        '*{box-sizing:border-box;}' +
        'body{font-family:system-ui,-apple-system,sans-serif;margin:0;background:#0d1117;color:#e2e8f0;min-height:100vh;line-height:1.6;}' +
        /* ── 顶栏 ── */
        '.toolbar{display:flex;align-items:center;gap:10px;padding:0 24px;height:52px;' +
          'background:rgba(10,12,20,0.92);border-bottom:1px solid rgba(255,255,255,0.08);' +
          'position:sticky;top:0;z-index:100;backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);}' +
        '.toolbar::before{content:"";position:absolute;top:0;left:0;right:0;height:2px;' +
          'background:linear-gradient(90deg,#80B8FF 0%,#b96eff 50%,#66D1FF 100%);}' +
        '.toolbar-icon{font-size:1.1rem;flex-shrink:0;}' +
        '.toolbar-title{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;' +
          'font-size:0.9rem;font-weight:600;color:#fff;letter-spacing:0.01em;}' +
        '.toolbar-badge{font-size:0.7rem;font-weight:700;padding:2px 7px;border-radius:5px;' +
          'background:rgba(128,184,255,0.18);color:#80B8FF;border:1px solid rgba(128,184,255,0.25);' +
          'text-transform:uppercase;letter-spacing:0.06em;flex-shrink:0;}' +
        '.btn{cursor:pointer;border:none;border-radius:8px;padding:6px 16px;font-size:0.82rem;' +
          'font-family:inherit;font-weight:600;transition:filter .15s,transform .1s;}' +
        '.btn:active{transform:scale(0.94);}' +
        '.btn-export{background:linear-gradient(135deg,#80B8FF,#4096FF);color:#fff;' +
          'box-shadow:0 2px 10px rgba(64,150,255,0.35);}' +
        '.btn-export:hover{filter:brightness(1.1);}' +
        /* ── 内容区 ── */
        '.content{padding:32px 40px;max-width:960px;margin:0 auto;}' +
        '@media(max-width:640px){.content{padding:20px 16px;}}' +
        /* ── Markdown ── */
        '.md-body{font-size:.95rem;}' +
        '.md-body h1{font-size:1.8rem;border-bottom:1px solid rgba(255,255,255,0.1);padding-bottom:.4em;}' +
        '.md-body h2{font-size:1.4rem;border-bottom:1px solid rgba(255,255,255,0.07);padding-bottom:.3em;}' +
        '.md-body h1,.md-body h2,.md-body h3,.md-body h4,.md-body h5,.md-body h6{color:#80B8FF;margin-top:1.4em;margin-bottom:.5em;font-weight:600;}' +
        '.md-body p{line-height:1.85;margin:.7em 0;color:#e2e8f0;}' +
        '.md-body a{color:#66D1FF;text-decoration:underline;text-underline-offset:3px;}' +
        '.md-body a:hover{color:#80B8FF;}' +
        '.md-body code{background:rgba(255,255,255,0.08);padding:2px 7px;border-radius:5px;font-family:"Cascadia Code",Consolas,monospace;font-size:.88em;color:#c084fc;}' +
        '.md-body pre{background:#161b27;padding:18px 20px;border-radius:10px;overflow-x:auto;border:1px solid rgba(255,255,255,0.08);}' +
        '.md-body pre code{background:none;padding:0;color:#e2e8f0;font-size:.88rem;}' +
        '.md-body blockquote{border-left:3px solid #80B8FF;margin:1em 0;padding:8px 18px;background:rgba(128,184,255,0.06);border-radius:0 8px 8px 0;color:#94a3b8;}' +
        '.md-body table{border-collapse:collapse;width:100%;margin:1.2em 0;font-size:.9rem;}' +
        '.md-body td,.md-body th{border:1px solid rgba(255,255,255,0.1);padding:8px 14px;}' +
        '.md-body th{background:rgba(128,184,255,0.1);color:#80B8FF;font-weight:600;}' +
        '.md-body tr:hover td{background:rgba(255,255,255,0.03);}' +
        '.md-body hr{border:none;border-top:1px solid rgba(255,255,255,0.1);margin:2em 0;}' +
        '.md-body li{margin:.4em 0;line-height:1.75;}' +
        '.md-body ul,.md-body ol{padding-left:1.5em;}' +
        /* ── CSV ── */
        '.csv-wrap{overflow-x:auto;border-radius:10px;border:1px solid rgba(255,255,255,0.1);}' +
        '.csv-table{border-collapse:collapse;width:100%;font-size:.88rem;}' +
        '.csv-table th{background:rgba(128,184,255,0.12);color:#80B8FF;padding:10px 16px;' +
          'border:1px solid rgba(255,255,255,0.1);text-align:left;font-weight:600;font-size:.8rem;letter-spacing:.04em;}' +
        '.csv-table td{padding:8px 16px;border:1px solid rgba(255,255,255,0.07);color:#e2e8f0;}' +
        '.csv-table tr:nth-child(even) td{background:rgba(255,255,255,0.02);}' +
        '.csv-table tr:hover td{background:rgba(128,184,255,0.06);}' +
        /* ── JSON ── */
        '.json-pre{background:#161b27;padding:24px;border-radius:10px;overflow-x:auto;' +
          'line-height:1.65;font-size:.87rem;font-family:"Cascadia Code",Consolas,monospace;' +
          'border:1px solid rgba(255,255,255,0.08);}' +
        '.json-key{color:#80B8FF;}.json-str{color:#6ee7b7;}.json-num{color:#fbbf24;}.json-bool{color:#c084fc;}.json-null{color:#f87171;}' +
        /* ── TXT ── */
        '.txt-pre{background:#161b27;padding:24px;border-radius:10px;overflow-x:auto;' +
          'white-space:pre-wrap;word-break:break-word;line-height:1.75;font-size:.87rem;' +
          'font-family:"Cascadia Code",Consolas,monospace;border:1px solid rgba(255,255,255,0.08);}' +
      '</style></head><body>' +
      '<div class="toolbar">' +
        '<span class="toolbar-icon">📄</span>' +
        '<span class="toolbar-title">' + escapeHtml(name) + '</span>' +
        '<span class="toolbar-badge">' + extLabel + '</span>' +
        '<button class="btn btn-export" onclick="doExport()">⬇ 导出</button>' +
      '</div>' +
      '<div class="content">' + bodyHtml + '</div>' +
      '<script>' +
        'var _attContent=' + JSON.stringify(content) + ';' +
        'var _attName=' + JSON.stringify(att.name || 'file.txt') + ';' +
        'var _attMime=' + JSON.stringify(
          ext === 'csv' ? 'text/csv' :
          ext === 'md' ? 'text/markdown' :
          ext === 'json' ? 'application/json' :
          ext === 'html' ? 'text/html' : 'text/plain'
        ) + ';' +
        'function doExport(){' +
          'var blob=new Blob([_attContent],{type:_attMime+";charset=utf-8"});' +
          'var a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=_attName;a.click();' +
        '}' +
      '<\/script>' +
      '</body></html>';
  }

  function buildAttachmentEditHtml(att) {
    var name = att.name || '未命名';
    var content = att.content || '';
    var ext = (att.type || '').toLowerCase();
    var mode = (ext === 'json' || ext === 'js' || ext === 'html' || ext === 'css') ? ext : 'text';

    var extLabel2 = ext === 'md' ? 'Markdown' : ext === 'csv' ? 'CSV' : ext === 'json' ? 'JSON' : ext ? ext.toUpperCase() : 'TXT';
    return '<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
      '<title>编辑：' + escapeHtml(name) + '</title>' +
      '<style>' +
        '*{box-sizing:border-box;}' +
        'body{font-family:system-ui,-apple-system,sans-serif;margin:0;background:#0d1117;color:#e2e8f0;height:100vh;display:flex;flex-direction:column;}' +
        /* 顶栏 */
        '.toolbar{display:flex;align-items:center;gap:10px;padding:0 20px;height:52px;flex-shrink:0;position:relative;' +
          'background:rgba(10,12,20,0.96);border-bottom:1px solid rgba(255,255,255,0.08);}' +
        '.toolbar::before{content:"";position:absolute;top:0;left:0;right:0;height:2px;' +
          'background:linear-gradient(90deg,#80B8FF 0%,#b96eff 50%,#66D1FF 100%);}' +
        '.toolbar-icon{font-size:1.1rem;flex-shrink:0;}' +
        '.toolbar-title{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;' +
          'font-size:0.88rem;font-weight:600;color:#fff;letter-spacing:0.01em;}' +
        '.toolbar-badge{font-size:0.7rem;font-weight:700;padding:2px 7px;border-radius:5px;' +
          'background:rgba(128,184,255,0.18);color:#80B8FF;border:1px solid rgba(128,184,255,0.25);' +
          'text-transform:uppercase;letter-spacing:0.06em;flex-shrink:0;}' +
        '.status{font-size:.78rem;color:#6ee7b7;display:none;flex-shrink:0;font-weight:500;}' +
        '.status.show{display:inline;}' +
        '.hint{font-size:.72rem;color:#64748b;flex-shrink:0;}' +
        /* 按钮 */
        '.btn{cursor:pointer;border:none;border-radius:8px;padding:6px 14px;font-size:0.82rem;' +
          'font-family:inherit;font-weight:600;transition:filter .15s,transform .1s;flex-shrink:0;}' +
        '.btn:active{transform:scale(0.94);}' +
        '.btn-save{background:linear-gradient(135deg,#80B8FF,#4096FF);color:#fff;' +
          'box-shadow:0 2px 10px rgba(64,150,255,0.35);}' +
        '.btn-save:hover{filter:brightness(1.1);}' +
        '.btn-cancel{background:rgba(255,255,255,0.08);color:#94a3b8;border:1px solid rgba(255,255,255,0.12);}' +
        '.btn-cancel:hover{background:rgba(255,255,255,0.13);color:#e2e8f0;}' +
        /* 编辑器 */
        '#editor{flex:1;width:100%;background:#0d1117;color:#e2e8f0;border:none;' +
          'padding:24px 32px;font-family:"Cascadia Code",Consolas,monospace;font-size:.9rem;' +
          'line-height:1.75;resize:none;outline:none;tab-size:2;}' +
        '#editor::selection{background:rgba(128,184,255,0.25);}' +
        /* 状态栏 */
        '.statusbar{flex-shrink:0;height:28px;display:flex;align-items:center;gap:16px;' +
          'padding:0 24px;background:rgba(10,12,20,0.8);border-top:1px solid rgba(255,255,255,0.06);' +
          'font-size:.72rem;color:#475569;}' +
        '.statusbar span{display:flex;align-items:center;gap:4px;}' +
      '</style></head><body>' +
      '<div class="toolbar">' +
        '<span class="toolbar-icon">✏️</span>' +
        '<span class="toolbar-title">编辑：' + escapeHtml(name) + '</span>' +
        '<span class="toolbar-badge">' + extLabel2 + '</span>' +
        '<span class="hint">Ctrl+S 保存</span>' +
        '<span class="status" id="statusMsg">✓ 已同步到工作台</span>' +
        '<button class="btn btn-cancel" onclick="window.close()">关闭</button>' +
        '<button class="btn btn-save" onclick="doSave()">保存到工作台</button>' +
      '</div>' +
      '<textarea id="editor" spellcheck="false">' + escapeHtml(content) + '</textarea>' +
      '<div class="statusbar">' +
        '<span id="sbLines">行数：-</span>' +
        '<span id="sbChars">字符：-</span>' +
        '<span>UTF-8</span>' +
      '</div>' +
      '<script>' +
        'var _attId=' + JSON.stringify(att.id || '') + ';' +
        'var ed=document.getElementById("editor");' +
        'function updateStatusBar(){' +
          'var lines=ed.value.split("\\n").length;' +
          'var chars=ed.value.length;' +
          'document.getElementById("sbLines").textContent="行数："+lines;' +
          'document.getElementById("sbChars").textContent="字符："+chars;' +
        '}' +
        'updateStatusBar();' +
        'ed.addEventListener("input",updateStatusBar);' +
        'function doSave(){' +
          'var val=ed.value;' +
          'if(window.opener&&window.opener.updateAttachmentContent){' +
            'window.opener.updateAttachmentContent(_attId,val);' +
            'var s=document.getElementById("statusMsg");' +
            's.classList.add("show");' +
            'setTimeout(function(){s.classList.remove("show");},2500);' +
                                        '}else if(window.opener&&window.opener.WorkbenchUI&&window.opener.WorkbenchUI.showToast){window.opener.WorkbenchUI.showToast("无法连接到工作台窗口，请确认原窗口未关闭。","error");}else{var s=document.getElementById("statusMsg");if(s){s.textContent="无法连接到工作台窗口，请确认原窗口未关闭。";s.classList.add("show");}}' +


        '}' +
        'ed.addEventListener("keydown",function(e){' +
          'if((e.ctrlKey||e.metaKey)&&e.key==="s"){e.preventDefault();doSave();}' +
          /* Tab 键插入两个空格 */
          'if(e.key==="Tab"){e.preventDefault();' +
            'var s=ed.selectionStart,en=ed.selectionEnd;' +
            'ed.value=ed.value.substring(0,s)+"  "+ed.value.substring(en);' +
            'ed.selectionStart=ed.selectionEnd=s+2;}' +
        '});' +
      '<\/script>' +
      '</body></html>';
  }

    function openAttachmentViewWindow(att) {
    var win = window.open('', '_blank');
    if (!win) {
      showToast('弹出窗口被阻止，请允许弹出窗口后重试。', 'warning');
      return;
    }
    win.document.write(buildAttachmentViewHtml(att));
    win.document.close();
  }


    function openAttachmentEditWindow(att, onSave) {
    window._updateAttachmentCallbacks = window._updateAttachmentCallbacks || {};
    window._updateAttachmentCallbacks[att.id] = onSave;
    var win = window.open('', '_blank');
    if (!win) {
      showToast('弹出窗口被阻止，请允许弹出窗口后重试。', 'warning');
      return;
    }
    win.document.write(buildAttachmentEditHtml(att));
    win.document.close();
  }


  window.updateAttachmentContent = function(attId, newContent) {
    var cb = (window._updateAttachmentCallbacks || {})[attId];
    if (typeof cb === 'function') {
      cb(newContent);
      delete window._updateAttachmentCallbacks[attId];
    }
  };

  function openAttachmentsModal(item) {
    var attachments = item.attachments || [];
    if (!attachments.length) return;
    window._currentAttachmentsItem = item;
    var modal = document.getElementById('attachmentsListModal');
    if (modal) {
      var listEl = document.getElementById('attachmentsListBody');
      if (listEl) {
        listEl.innerHTML = '';
        attachments.forEach(function (att) {
          var row = document.createElement('div');
          row.className = 'attachment-row';
          row.innerHTML =
            '<span class="attachment-name" title="' + escapeHtml(att.name || '') + '">' + escapeHtml(att.name || '') + '</span>' +
            '<button type="button" class="btn btn-info btn-sm btn-view-att-list" data-aid="' + escapeHtml(att.id) + '">查看</button>' +
            '<button type="button" class="btn btn-secondary btn-sm btn-export-att-list" data-aid="' + escapeHtml(att.id) + '">导出</button>';
          listEl.appendChild(row);
        });
        listEl.querySelectorAll('.btn-view-att-list').forEach(function (btn) {
          btn.addEventListener('click', function () {
            var aid = btn.getAttribute('data-aid');
            var att = attachments.find(function (x) { return x.id === aid; });
            if (att) openAttachmentViewWindow(att);
          });
        });
        listEl.querySelectorAll('.btn-export-att-list').forEach(function (btn) {
          btn.addEventListener('click', function () {
            var aid = btn.getAttribute('data-aid');
            var att = attachments.find(function (x) { return x.id === aid; });
            if (att) exportAttachment(att);
          });
        });
      }
      modal.classList.add('show');
      return;
    }
    // 降级：新窗口打开附件列表
        var win = window.open('', '_blank');
    if (!win) {
      showToast('弹出窗口被阻止，无法打开附件查看器。请允许弹出窗口。', 'warning');
      return;
    }

    window._currentAttachments = attachments;
    function encodeAttr(str) {
      return String(str).replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }
    var html = '<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><title>附件列表</title>' +
      '<style>body{font-family:system-ui,sans-serif;margin:0;background:#1a1b26;color:#c0caf5;}' +
      'h2{margin:0;padding:16px 24px;background:#16161e;border-bottom:1px solid #2a2b3d;font-size:1.1rem;color:#7aa2f7;}' +
      'ul{list-style:none;padding:16px 24px;margin:0;}' +
      'li{display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid #2a2b3d;}' +
      'strong{flex:1;font-weight:normal;}' +
      'a{cursor:pointer;padding:4px 12px;border-radius:6px;font-size:.85rem;text-decoration:none;font-weight:600;}' +
      '.a-view{background:#7aa2f7;color:#1a1b26;}.a-export{background:#9ece6a;color:#1a1b26;}' +
      '</style></head><body>' +
      '<h2>附件列表</h2><ul>';
    attachments.forEach(function(att) {
      var encodedId = encodeAttr(att.id || '');
      html += '<li><strong>' + escapeHtml(att.name || '未命名') + '</strong>' +
        '<a class="a-view" href="javascript:;" onclick="if(window.opener&&window.opener.viewAttachmentById){window.opener.viewAttachmentById(\'' + encodedId + '\');}">查看</a>' +
        '<a class="a-export" href="javascript:;" onclick="if(window.opener&&window.opener.exportAttachmentById){window.opener.exportAttachmentById(\'' + encodedId + '\');}">导出</a>' +
        '</li>';
    });
    html += '</ul></body></html>';
    win.document.write(html);
    win.document.close();
  }

  // 解码HTML实体
  function decodeHtmlEntities(str) {
    var textarea = document.createElement('textarea');
    textarea.innerHTML = str;
    return textarea.value;
  }

  window.openAttachmentById = function(attId) {
    try {
      var decodedId = decodeHtmlEntities(attId);
      var attachments = window._currentAttachments || [];
      var att = attachments.find(function(a) { return a.id === decodedId; });
      if (att) {
        openAttachmentWindow(att);
      } else {
        console.error('未找到附件，ID:', decodedId);
      }
    } catch (err) {
      console.error('openAttachmentById 出错:', err.message);
    }
  };

  window.exportAttachmentById = function(attId) {
    var decodedId = decodeHtmlEntities(attId);
    var attachments = window._currentAttachments || [];
    var att = attachments.find(function(a) { return a.id === decodedId; });
    if (att) exportAttachment(att);
  };

  window.viewAttachmentById = function(attId) {
    var decodedId = decodeHtmlEntities(attId);
    var attachments = window._currentAttachments || [];
    var att = attachments.find(function(a) { return a.id === decodedId; });
    if (att) openAttachmentViewWindow(att);
  };

    function exportAttachment(att) {
    if (!att || !att.content) {
      showToast('附件内容为空，无法导出', 'warning');
      return;
    }

    
    var content = att.content;
    var filename = att.name || 'exported_file.txt';
    var mimeType = 'text/plain';
    
    // 根据文件类型设置不同的MIME类型
    var ext = (att.type || '').toLowerCase();
    switch(ext) {
      case 'csv':
        mimeType = 'text/csv';
        break;
      case 'md':
        mimeType = 'text/markdown';
        break;
      case 'html':
        mimeType = 'text/html';
        break;
      case 'json':
        mimeType = 'application/json';
        break;
      default:
        mimeType = 'text/plain';
    }
    
    // 创建Blob对象
    var blob = new Blob([content], { type: mimeType + ';charset=utf-8' });
    
    // 创建下载链接
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.style.display = 'none';
    
    // 添加到DOM并触发点击
    document.body.appendChild(a);
    a.click();
    
    // 清理
    setTimeout(function() {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 100);
  }

  function openItemModal(moduleId, item) {
    var titleEl = document.getElementById('itemModalTitle');
    var idEl = document.getElementById('itemId');
    var midEl = document.getElementById('itemModuleId');
    var titleInput = document.getElementById('itemTitle');
    var urlInput = document.getElementById('itemUrl');
    var contentInput = document.getElementById('itemContent');
    var newTabInput = document.getElementById('itemNewTab');
    if (titleEl) titleEl.textContent = item ? '编辑内容' : '添加内容';
    if (idEl) idEl.value = item ? item.id : '';
    if (midEl) midEl.value = moduleId || '';
    if (titleInput) titleInput.value = item ? (item.title || '') : '';
    if (urlInput) urlInput.value = item ? (item.url || '') : '';
    if (contentInput) contentInput.value = item ? (item.content || '') : '';
    if (newTabInput) newTabInput.checked = item ? item.newTab !== false : true;
    var itemShowContentEl = document.getElementById('itemShowContent');
    if (itemShowContentEl) itemShowContentEl.checked = item ? (item.showContent !== false) : true;
    var itemVisibleEl = document.getElementById('itemVisibleToAll');
    if (itemVisibleEl) itemVisibleEl.checked = item ? (item.visibleToAll !== false) : true;
    /* 图标字段：回填当前 icon，更新预览 */
    var iconInput = document.getElementById('itemIcon');
    if (iconInput) {
      iconInput.value = (item && item.icon) ? item.icon : '';
      updateIconPreview((item && item.icon) || '');
    }
    document.getElementById('itemImportFile').value = '';
    editingAttachments = (item && Array.isArray(item.attachments)) ? item.attachments : [];
    if (item && !Array.isArray(item.attachments)) item.attachments = editingAttachments;
    renderAttachmentsList();
    var modal = document.getElementById('itemModal');
    if (modal) modal.classList.add('show');
  }

  function closeItemModal() {
    var modal = document.getElementById('itemModal');
    if (modal) modal.classList.remove('show');
  }

  function openCommentsModal(item, moduleId) {
    window._commentsTarget = { item: item, moduleId: moduleId };
    var list = document.getElementById('commentsList');
    if (list) {
      list.innerHTML = '';
      (item.comments || []).forEach(function (c) {
        var div = document.createElement('div');
        div.className = 'comment-item';
        div.innerHTML =
          '<strong>' + escapeHtml(c.user || '') + '</strong> ' + escapeHtml(c.text || '') +
          ' <span class="comment-time">' + (c.time || '') + '</span>' +
          (canEdit() ? ' <button type="button" class="btn btn-icon small btn-danger btn-delete-comment" data-cid="' + escapeHtml(c.id) + '" title="删除">🗑️</button>' : '');
        list.appendChild(div);
      });
            list.querySelectorAll('.btn-delete-comment').forEach(function (btn) {
        btn.addEventListener('click', function () {
          var cid = btn.getAttribute('data-cid');
          confirmAction('确定删除这条评论？', function () {
            item.comments = (item.comments || []).filter(function (x) { return x.id !== cid; });
            persistState();
            openCommentsModal(item, moduleId);
            showToast('评论已删除', 'success');
          }, { title: '删除评论', confirmText: '删除', danger: true });
        });
      });

    }
    var input = document.getElementById('commentInput');
    if (input) input.value = '';
    var modal = document.getElementById('commentsModal');
    if (modal) modal.classList.add('show');
  }

  function closeCommentsModal() {
    var modal = document.getElementById('commentsModal');
    if (modal) modal.classList.remove('show');
  }

  function openLoginModal() {
    document.getElementById('loginUser').value = '';
    document.getElementById('loginPass').value = '';
    document.getElementById('loginHint').textContent = '';
    document.getElementById('loginModal').classList.add('show');
  }

  function closeLoginModal() {
    document.getElementById('loginModal').classList.remove('show');
  }

  function buildNormalModuleCard(mod, itemsToShow, forceExpand) {
    /* itemsToShow：外部传入的已过滤条目列表；forceExpand：搜索时强制展开 */
    var items = itemsToShow !== undefined
      ? itemsToShow
      : (mod.items || []).filter(function (it) { return (it.visibleToAll !== false || canEdit()) && matchSearch(mod, it); });
    var collapsed = forceExpand ? false : !!state.collapsedModules[mod.id];
    var card = document.createElement('div');
    card.className = 'module-card card' + (collapsed ? ' collapsed' : '');
    card.dataset.moduleId = mod.id;
    card.draggable = canEdit();
    var q = getSearchText();
    var modNameHtml = highlightMatch(escapeHtml(mod.name || '未命名'), q);
    card.innerHTML =
      '<div class="card-header">' +
        '<button type="button" class="btn btn-icon btn-collapse" title="' + (collapsed ? '展开' : '收起') + '">' + (collapsed ? '▶' : '▼') + '</button>' +
        (canEdit() ? '<span class="drag-handle" title="拖动排序">⋮⋮</span>' : '') +
        '<span class="card-title">' + modNameHtml + '</span>' +
        (canEdit() ? '<div class="card-actions">' +
          '<button type="button" class="btn btn-icon btn-edit-module" title="编辑">✏️</button>' +
          '<button type="button" class="btn btn-icon btn-danger btn-delete-module" title="删除模块">🗑️</button>' +
        '</div>' : '') +
      '</div>' +
      '<div class="module-items"></div>' +
      (canEdit() ? '<button type="button" class="btn btn-secondary btn-add-item">+ 添加内容</button>' : '');
    card.querySelector('.btn-collapse').addEventListener('click', function () {
      var nowCollapsed = !state.collapsedModules[mod.id];
      state.collapsedModules[mod.id] = nowCollapsed;
      persistState();
      /* 只更新当前卡片 class/按钮，避免整个 grid 重渲染引起视觉跳动 */
      card.classList.toggle('collapsed', nowCollapsed);
      var btn = card.querySelector('.btn-collapse');
      btn.title = nowCollapsed ? '展开' : '收起';
      btn.textContent = nowCollapsed ? '▶' : '▼';
    });
    var itemsEl = card.querySelector('.module-items');
    items.forEach(function (it) {
      var hasUrl = !!(it.url && it.url.trim());
      var hasContent = !!(it.content && it.content.trim());
      var showContent = it.showContent !== false;
      var typeClass = hasUrl && hasContent ? 'item-type-both' : (hasUrl ? 'item-type-link' : 'item-type-text');
      /* 图标：优先用用户选择的 Remix Icon，格式 "ri-xxx-line|#color" 或旧版 "ri-xxx-line" */
      var customIcon = (it.icon && it.icon.trim()) ? it.icon : '';
      var typeIconHtml;
      if (customIcon) {
        var iconParts = customIcon.split('|');
        var iconCls   = iconParts[0] || '';
        var iconColor = iconParts[1] || '#80B8FF';
        typeIconHtml = '<i class="' + escapeHtml(iconCls) + ' item-iconfont-icon" style="color:' + escapeHtml(iconColor) + '"></i>';
      } else {
        typeIconHtml = hasUrl
          ? '<span class="item-emoji-icon">🔗</span>'
          : '<span class="item-emoji-icon">📄</span>';
      }
            var row = document.createElement('div');
      row.className = 'module-item item-box ' + typeClass + (hasUrl ? ' has-link' : '') + ((hasContent && showContent) ? ' has-tooltip' : '');
      row.dataset.itemId = it.id;
      row.draggable = canEdit();

      var titleHtml = highlightMatch(escapeHtml(it.title || ''), q);
      var link = hasUrl ? ('<a href="' + escapeHtml(it.url) + '" target="_blank" rel="noopener">' + titleHtml + '</a>') : titleHtml;
      var hoverText = (hasContent && showContent) ? String(it.content || '').replace(/\s+/g, ' ').trim() : '';
      var tooltipDesc = (hasContent && showContent) ? ('<span class="item-desc-tooltip">' + linkify(highlightMatch(escapeHtml(it.content), q)) + '</span>') : '';
      if (hoverText) row.title = hoverText;


      /* 搜索命中附件文件名时，在条目下方显示命中的附件名高亮 */

      var hasAttachments = it.attachments && it.attachments.length > 0;
      var attHitHtml = '';
      if (q && hasAttachments) {
        var hitAtts = it.attachments.filter(function (a) {
          return (a.name || '').toLowerCase().indexOf(q) !== -1;
        });
        if (hitAtts.length > 0) {
          attHitHtml = '<span class="item-att-hit">' +
            hitAtts.map(function (a) {
              return '<i class="ri-attachment-line"></i>' + highlightMatch(escapeHtml(a.name || ''), q);
            }).join('') +
          '</span>';
        }
      }
      var actionsHtml;
      if (canEdit()) {
        actionsHtml =
          '<div class="item-actions">' +
            '<button type="button" class="btn btn-icon small btn-edit-item" title="编辑">✏️</button>' +
            '<button type="button" class="btn btn-icon small btn-comment-item" title="评论">💬</button>' +
            (hasAttachments ? '<button type="button" class="btn btn-icon small btn-attachment-item" title="附件">📎</button>' : '') +
            '<button type="button" class="btn btn-icon small btn-danger btn-delete-item" title="删除">🗑️</button>' +
          '</div>';
      } else {
        actionsHtml =
          '<div class="item-actions">' +
            '<button type="button" class="btn btn-icon small btn-comment-item" title="评论">💬</button>' +
            (hasAttachments ? '<button type="button" class="btn btn-icon small btn-attachment-item" title="附件">📎</button>' : '') +
            (it.comments && it.comments.length ? '<span class="comment-badge">' + it.comments.length + '</span>' : '') +
          '</div>';
      }
            row.innerHTML =
        '<span class="item-type-icon" title="' + (hasUrl ? '链接' : '正文') + '">' + typeIconHtml + '</span>' +
        (canEdit() ? '<span class="drag-handle small">⋮⋮</span>' : '') +
        '<span class="item-title-wrap"><span class="item-title">' + (hasUrl ? link : titleHtml) + '</span>' + tooltipDesc + attHitHtml + '</span>' +
                actionsHtml;


      if (!hasUrl) {
        row.addEventListener('click', function (e) {
          if (e.target.closest('.item-actions')) return;
          /* 记录最近使用 */
          addRecentActivity('module', it.id, it.title || '未命名', mod.name || '');
          if (canEdit()) openItemModal(mod.id, it);
          else openViewContentModal(it);
        });
      } else {
        row.querySelectorAll('a').forEach(function (a) {
          a.addEventListener('click', function (e) {
            e.stopPropagation();
            /* 记录最近使用 */
            addRecentActivity('module', it.id, it.title || '未命名', mod.name || '');
          });
        });
      }
      row.querySelectorAll('.btn-edit-item').forEach(function (btn) {
        btn.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); openItemModal(mod.id, it); });
      });
      row.querySelectorAll('.btn-delete-item').forEach(function (btn) {
        btn.addEventListener('click', function (e) {
                    e.preventDefault(); e.stopPropagation();
          confirmAction('确定删除该内容？', function () {
            mod.items = (mod.items || []).filter(function (x) { return x.id !== it.id; });
            persistState();
            renderModules();
            showToast('内容已删除', 'success');
          }, { title: '删除内容', confirmText: '删除', danger: true });

        });
      });
      row.querySelectorAll('.btn-comment-item').forEach(function (btn) {
        btn.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); openCommentsModal(it, mod.id); });
      });
      row.querySelectorAll('.btn-attachment-item').forEach(function (btn) {
        btn.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); openAttachmentsModal(it); });
      });
      if (canEdit()) {
        row.addEventListener('dragstart', function (e) {
          e.stopPropagation();
          e.dataTransfer.setData('text/plain', 'item:' + mod.id + ':' + it.id);
          e.dataTransfer.effectAllowed = 'move';
        });
        row.addEventListener('dragover', function (e) {
          e.preventDefault();
          e.stopPropagation();
          e.dataTransfer.dropEffect = 'move';
          row.classList.add('drag-over');
        });
        row.addEventListener('dragleave', function () { row.classList.remove('drag-over'); });
        row.addEventListener('drop', function (e) {
          e.preventDefault();
          e.stopPropagation();
          row.classList.remove('drag-over');
          var raw = e.dataTransfer.getData('text/plain');
          if (!raw || raw.indexOf('item:') !== 0) return;
          var parts = raw.split(':');
          if (parts.length < 3) return;
          var fromModId = parts[1], fromItemId = parts[2];
          if (fromModId !== mod.id) return;
          var arr = mod.items || [];
          var fromIdx = arr.findIndex(function (x) { return x.id === fromItemId; });
          var toIdx = arr.findIndex(function (x) { return x.id === it.id; });
          if (fromIdx === -1 || toIdx === -1 || fromIdx === toIdx) return;
          var itm = arr.splice(fromIdx, 1)[0];
          arr.splice(toIdx, 0, itm);
          mod.items = arr;
          persistState();
          renderModules();
        });
      }
      itemsEl.appendChild(row);
    });
    card.querySelectorAll('.btn-edit-module').forEach(function (btn) {
      btn.addEventListener('click', function () { openModuleModal(mod); });
    });
    card.querySelectorAll('.btn-delete-module').forEach(function (btn) {
            btn.addEventListener('click', function () {
        confirmAction('确定删除整个模块？模块下内容也会一起删除。', function () {
          state.modules = state.modules.filter(function (x) { return x.id !== mod.id; });
          persistState();
          renderModules();
          showToast('模块已删除', 'success');
        }, { title: '删除模块', confirmText: '删除', danger: true });
      });

    });
    card.querySelectorAll('.btn-add-item').forEach(function (btn) {
      btn.addEventListener('click', function () { openItemModal(mod.id, null); });
    });
    if (canEdit()) {
      card.addEventListener('dragstart', function (e) {
        e.dataTransfer.setData('text/plain', 'module:' + mod.id);
        e.dataTransfer.effectAllowed = 'move';
      });
      card.addEventListener('dragover', function (e) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        card.classList.add('drag-over');
      });
      card.addEventListener('dragleave', function () { card.classList.remove('drag-over'); });
      card.addEventListener('drop', function (e) {
        e.preventDefault();
        card.classList.remove('drag-over');
        var raw = e.dataTransfer.getData('text/plain');
        if (!raw) return;
        if (raw.indexOf('module:') === 0) {
          var fromId = raw.slice(7);
          var fromIdx = state.modules.findIndex(function (x) { return x.id === fromId; });
          var toIdx = state.modules.findIndex(function (x) { return x.id === mod.id; });
          if (fromIdx === -1 || toIdx === -1 || fromIdx === toIdx) return;
          var list = state.modules.slice();
          var item = list.splice(fromIdx, 1)[0];
          list.splice(toIdx, 0, item);
          state.modules = list;
          state.modules.forEach(function (m, i) { m.order = i; });
          persistState();
          renderModules();
        }
      });
    }
    return card;
  }

  function renderMappedTree(container, nodes, openPath) {
    if (!nodes || !nodes.length) return;
    nodes.forEach(function (node) {
      if (node.type === 'file') {
        var fileRow = document.createElement('div');
        fileRow.className = 'mapped-file';
        fileRow.title = node.path || node.name;
        fileRow.innerHTML = '<span class="file-icon">📄</span><span>' + escapeHtml(node.name) + '</span>';
        fileRow.addEventListener('click', function () {
          if (openPath && node.path) openPath(node.path);
        });
        container.appendChild(fileRow);
      } else {
        var folder = document.createElement('div');
        folder.className = 'mapped-folder';
        var children = document.createElement('div');
        children.className = 'mapped-folder-children';
        folder.appendChild(children);
        var nameRow = document.createElement('div');
        nameRow.className = 'mapped-folder-name';
        nameRow.innerHTML = '<span class="toggle">▼</span><span>' + escapeHtml(node.name) + '</span>';
        nameRow.addEventListener('click', function () {
          folder.classList.toggle('collapsed');
        });
        folder.insertBefore(nameRow, children);
        renderMappedTree(children, node.children || [], openPath);
        container.appendChild(folder);
      }
    });
  }

  function buildMappedModuleCard(mod, tree) {
    var collapsed = state.collapsedModules[mod.id];
    var card = document.createElement('div');
    card.className = 'module-card card' + (collapsed ? ' collapsed' : '');
    card.dataset.moduleId = mod.id;
    card.draggable = canEdit();
    card.innerHTML =
      '<div class="card-header">' +
        '<button type="button" class="btn btn-icon btn-collapse" title="' + (collapsed ? '展开' : '收起') + '">' + (collapsed ? '▶' : '▼') + '</button>' +
        (canEdit() ? '<span class="drag-handle" title="拖动排序">⋮⋮</span>' : '') +
        '<span class="card-title">' + escapeHtml(mod.name || '未命名') + '</span>' +
        (canEdit() ? '<div class="card-actions">' +
          '<button type="button" class="btn btn-icon btn-edit-module" title="编辑">✏️</button>' +
          '<button type="button" class="btn btn-icon btn-danger btn-delete-module" title="删除模块">🗑️</button>' +
        '</div>' : '') +
      '</div>' +
      '<div class="module-items mapped-tree"></div>';
    card.querySelector('.btn-collapse').addEventListener('click', function () {
      state.collapsedModules[mod.id] = !state.collapsedModules[mod.id];
      persistState();
      renderModules();
    });
    var openPathFn = window.workbenchApi && window.workbenchApi.openPath ? function (p) { window.workbenchApi.openPath(p); } : null;
    renderMappedTree(card.querySelector('.mapped-tree'), tree, openPathFn);
    card.querySelectorAll('.btn-edit-module').forEach(function (btn) {
      btn.addEventListener('click', function () { openModuleModal(mod); });
    });
    card.querySelectorAll('.btn-delete-module').forEach(function (btn) {
            btn.addEventListener('click', function () {
        confirmAction('确定删除整个模块？模块下内容也会一起删除。', function () {
          state.modules = state.modules.filter(function (x) { return x.id !== mod.id; });
          persistState();
          renderModules();
          showToast('模块已删除', 'success');
        }, { title: '删除模块', confirmText: '删除', danger: true });
      });

    });
    if (canEdit()) {
      card.addEventListener('dragstart', function (e) {
        e.dataTransfer.setData('text/plain', 'module:' + mod.id);
        e.dataTransfer.effectAllowed = 'move';
      });
      card.addEventListener('dragover', function (e) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        card.classList.add('drag-over');
      });
      card.addEventListener('dragleave', function () { card.classList.remove('drag-over'); });
      card.addEventListener('drop', function (e) {
        e.preventDefault();
        card.classList.remove('drag-over');
        var raw = e.dataTransfer.getData('text/plain');
        if (!raw || raw.indexOf('module:') !== 0) return;
        var fromId = raw.slice(7);
        var fromIdx = state.modules.findIndex(function (x) { return x.id === fromId; });
        var toIdx = state.modules.findIndex(function (x) { return x.id === mod.id; });
        if (fromIdx === -1 || toIdx === -1 || fromIdx === toIdx) return;
        var list = state.modules.slice();
        var item = list.splice(fromIdx, 1)[0];
        list.splice(toIdx, 0, item);
        state.modules = list;
        state.modules.forEach(function (m, i) { m.order = i; });
        persistState();
        renderModules();
      });
    }
    return card;
  }

  function renderModules() {
    if (!mainGrid) return;
    var q = getSearchText();
    var sorted = state.modules.slice().sort(function (a, b) { return (a.order || 0) - (b.order || 0); });
    sorted = sorted.filter(function (mod) { return mod.visibleToAll !== false || canEdit(); });
    var hasMapped = window.workbenchApi && sorted.some(function (m) { return m.mappedPath; });

    if (!hasMapped) {
      mainGrid.innerHTML = '';
      if (sorted.length === 0 && !canEdit()) {
        var hint = document.createElement('p');
        hint.className = 'empty-hint';
        hint.textContent = '登录后可添加模块与内容';
        mainGrid.appendChild(hint);
        return;
      }
      sorted.forEach(function (mod) {
        var modNameHit = q && matchModuleName(mod);
        /* 可见条目 */
        var visibleItems = (mod.items || []).filter(function (it) {
          return it.visibleToAll !== false || canEdit();
        });
        /* 搜索命中的条目（标题/URL/正文/附件名） */
        var matchedItems = q
          ? visibleItems.filter(function (it) { return matchSearch(mod, it); })
          : visibleItems;

        /* 隐藏规则：有搜索词 且 模块名不匹配 且 没有任何条目命中 */
        if (q && !modNameHit && matchedItems.length === 0) return;

        /* 搜索时：模块名命中 → 显示全部条目；条目命中 → 只显示命中条目 */
        var itemsToShow = q && !modNameHit ? matchedItems : visibleItems;

        /* 有搜索词时强制展开（不受 collapsedModules 影响） */
        var forceExpand = !!q;

        mainGrid.appendChild(buildNormalModuleCard(mod, itemsToShow, forceExpand));
      });
      return;
    }

    var promises = sorted.map(function (mod) {
      if (mod.mappedPath && window.workbenchApi) {
        return window.workbenchApi.getMappedFolderTree(mod.mappedPath).then(function (tree) {
          return { mod: mod, tree: Array.isArray(tree) ? tree : null };
        }).catch(function () { return { mod: mod, tree: null }; });
      }
      return Promise.resolve({ mod: mod, tree: null });
    });
    Promise.all(promises).then(function (withTrees) {
      mainGrid.innerHTML = '';
      if (sorted.length === 0 && !canEdit()) {
        var hint = document.createElement('p');
        hint.className = 'empty-hint';
        hint.textContent = '登录后可添加模块与内容';
        mainGrid.appendChild(hint);
        return;
      }
      withTrees.forEach(function (pair) {
        var modNameHit2 = q && matchModuleName(pair.mod);
        var visibleItems2 = pair.tree ? [] : (pair.mod.items || []).filter(function (it) { return it.visibleToAll !== false || canEdit(); });
        var matchedItems2 = q ? visibleItems2.filter(function (it) { return matchSearch(pair.mod, it); }) : visibleItems2;
        var hideBySearch = q && !modNameHit2 && matchedItems2.length === 0 && (!pair.tree || pair.tree.length === 0);
        if (hideBySearch) return;
        var itemsToShow2 = q && !modNameHit2 ? matchedItems2 : visibleItems2;
        var forceExpand2 = !!q;
        if (pair.tree && pair.tree.length > 0) {
          mainGrid.appendChild(buildMappedModuleCard(pair.mod, pair.tree));
        } else {
          mainGrid.appendChild(buildNormalModuleCard(pair.mod, itemsToShow2, forceExpand2));
        }
      });
    });
  }

  function bindModuleModal() {
    var btnAdd = document.getElementById('btnAddModule');
    if (btnAdd) btnAdd.addEventListener('click', function () { openModuleModal(null); });
    document.getElementById('btnCloseModuleModal').addEventListener('click', closeModuleModal);
    document.getElementById('btnCancelModule').addEventListener('click', closeModuleModal);
    document.getElementById('moduleModal').addEventListener('click', function (e) { if (e.target.id === 'moduleModal') closeModuleModal(); });
    document.getElementById('btnSaveModule').addEventListener('click', function () {
      var idVal = document.getElementById('moduleId').value;
      var nameVal = (document.getElementById('moduleName').value || '').trim() || '未命名';
      var mappedPath = (document.getElementById('moduleMappedPath').value || '').trim();
      var visibleToAll = document.getElementById('moduleVisibleToAll').checked;
      if (idVal) {
        var m = state.modules.find(function (x) { return x.id === idVal; });
        if (m) { m.name = nameVal; m.mappedPath = mappedPath || undefined; m.visibleToAll = visibleToAll; }
      } else {
        state.modules.push({
          id: id(),
          name: nameVal,
          order: state.modules.length,
          mappedPath: mappedPath || undefined,
          visibleToAll: visibleToAll,
          items: []
        });
      }
            persistState();
      renderModules();
      closeModuleModal();
      showToast(idVal ? '模块已更新' : '模块已创建', 'success');
    });

  }

  function bindItemModal() {
    document.getElementById('btnCloseItemModal').addEventListener('click', closeItemModal);
    document.getElementById('btnCancelItem').addEventListener('click', closeItemModal);
    document.getElementById('itemModal').addEventListener('click', function (e) { if (e.target.id === 'itemModal') closeItemModal(); });
    document.getElementById('btnSaveItem').addEventListener('click', function () {
      var itemId = document.getElementById('itemId').value;
      var moduleId = document.getElementById('itemModuleId').value;
      var title = (document.getElementById('itemTitle').value || '').trim() || '未命名';
      var url = (document.getElementById('itemUrl').value || '').trim();
      var content = (document.getElementById('itemContent').value || '').trim();
      var showContent = document.getElementById('itemShowContent').checked;
      var visibleToAll = document.getElementById('itemVisibleToAll').checked;
      var newTab = document.getElementById('itemNewTab').checked;
      var iconVal = (document.getElementById('itemIcon') && document.getElementById('itemIcon').value) || '';
      var mod = state.modules.find(function (x) { return x.id === moduleId; });
      if (!mod) { closeItemModal(); return; }
      if (!mod.items) mod.items = [];
      if (itemId) {
        var it = mod.items.find(function (x) { return x.id === itemId; });
        if (it) { it.title = title; it.url = url; it.content = content; it.showContent = showContent; it.visibleToAll = visibleToAll; it.newTab = newTab; it.icon = iconVal; it.attachments = editingAttachments.slice(); }
      } else {
        mod.items.push({ id: id(), title: title, url: url, content: content, showContent: showContent, visibleToAll: visibleToAll, newTab: newTab, icon: iconVal, comments: [], attachments: editingAttachments.slice() });
      }
            persistState();
      renderModules();
      closeItemModal();
      showToast(itemId ? '内容已更新' : '内容已创建', 'success');
    });

    document.getElementById('btnImportContent').addEventListener('click', function () {
      document.getElementById('itemImportFile').click();
    });
    document.getElementById('itemImportFile').addEventListener('change', function () {
      var file = this.files && this.files[0];
      if (!file) return;
      var reader = new FileReader();
      reader.onload = function () {
        var add = typeof reader.result === 'string' ? reader.result : '';
        var extMatch = (file.name || '').split('.');
        var ext = extMatch.length > 1 ? extMatch.pop().toLowerCase() : '';
        editingAttachments = editingAttachments || [];
        editingAttachments.push({
          id: id(),
          name: file.name || ('文件.' + (ext || 'txt')),
          type: ext,
          content: add
        });
                renderAttachmentsList();
        showToast('文件已导入到附件列表', 'success');
      };

      reader.readAsText(file, 'UTF-8');
      this.value = '';
    });

  }

  function bindCommentsModal() {
    document.getElementById('btnCloseCommentsModal').addEventListener('click', closeCommentsModal);
    document.getElementById('commentsModal').addEventListener('click', function (e) { if (e.target.id === 'commentsModal') closeCommentsModal(); });
    document.getElementById('btnAddComment').addEventListener('click', function () {
      var target = window._commentsTarget;
      if (!target) return;
      var input = document.getElementById('commentInput');
      var text = (input && input.value || '').trim();
      if (!text) return;
      var nick = (document.getElementById('commentNickname') && document.getElementById('commentNickname').value || '').trim() || '游客';
      if (currentUser) nick = currentUser;
            if (!canComment()) {
        showToast('请先登录后再发表评论', 'warning');
        closeCommentsModal();
        openLoginModal();
        return;
      }

      target.item.comments = target.item.comments || [];
      var commentId = id();
            target.item.comments.push({ id: commentId, user: nick, text: text, time: new Date().toLocaleString() });
      persistState();
      openCommentsModal(target.item, target.moduleId);
      showToast('评论已发送', 'success');
    });

  }

  // 发送评论邮件通知


  function bindViewContentModal() {
    document.getElementById('btnCloseViewContentModal').addEventListener('click', closeViewContentModal);
    document.getElementById('viewContentModal').addEventListener('click', function (e) { if (e.target.id === 'viewContentModal') closeViewContentModal(); });
  }

  function bindAttachmentModals() {
    var listModal = document.getElementById('attachmentsListModal');
    if (listModal) {
      document.getElementById('btnCloseAttachmentsListModal').addEventListener('click', function () { listModal.classList.remove('show'); });
      listModal.addEventListener('click', function (e) { if (e.target.id === 'attachmentsListModal') listModal.classList.remove('show'); });
    }
  }

  function bindLoginModal() {
    document.getElementById('btnLogin').addEventListener('click', function () {
      if (currentUser) {
        currentUser = '';
        currentRole = '';
        localStorage.removeItem(STORAGE_USER);
        localStorage.removeItem(STORAGE_USER_ROLE);
        updateUserUI();
        renderModules();
      } else {
        openLoginModal();
      }
    });
    var overlayBtn = document.getElementById('btnOverlayLogin');
    if (overlayBtn) {
      overlayBtn.addEventListener('click', function () {
        openLoginModal();
      });
    }
    document.getElementById('btnCloseLoginModal').addEventListener('click', closeLoginModal);
    document.getElementById('loginModal').addEventListener('click', function (e) { if (e.target.id === 'loginModal') closeLoginModal(); });
    function performLogin() {
      var user = (document.getElementById('loginUser').value || '').trim();
      var pass = (document.getElementById('loginPass').value || '').trim();
      var guestList = (state.guestUsers || '').split('\n').map(function (line) {
        var parts = (line || '').trim().split(':');
        return { user: parts[0] || '', pass: parts[1] || '', role: 'guest' };
      }).filter(function (x) { return x.user && x.pass; });
      var adminList = (state.allowedUsers || '').split('\n').map(function (line) {
        var parts = (line || '').trim().split(':');
        return { user: parts[0] || '', pass: parts[1] || '', role: 'admin' };
      }).filter(function (x) { return x.user && x.pass; });
      if (guestList.length === 0 && adminList.length === 0) {
        guestList = [{ user: 'admin', pass: 'admin', role: 'guest' }];
        adminList = [{ user: '123', pass: '123', role: 'admin' }];
      }
      var all = guestList.concat(adminList);
      var matched = all.find(function (x) { return x.user === user && x.pass === pass; });
            if (matched) {
        currentUser = user;
        currentRole = matched.role || 'admin';
        localStorage.setItem(STORAGE_USER, user);
        localStorage.setItem(STORAGE_USER_ROLE, currentRole);
        closeLoginModal();
        updateUserUI();
        renderModules();
        showToast(currentRole === 'admin' ? '管理员登录成功' : '登录成功', 'success');
      } else {
        document.getElementById('loginHint').textContent = '用户名或密码错误，或未在设置中配置允许的用户。';
        showToast('登录失败，请检查账号密码', 'error');
      }

    }
    document.getElementById('loginForm').addEventListener('submit', function (e) {
      e.preventDefault();
      performLogin();
    });
  }

  function updateUserUI() {
    // 更新标题
    var headerTitle = document.getElementById('headerTitle');
    if (headerTitle) {
      var customTitle = localStorage.getItem('workbench_custom_title');
      var titleText = customTitle || '我的工作台';
      headerTitle.textContent = titleText;
      // 如果是管理员，使标题可编辑
      if (canEdit() && !headerTitle.classList.contains('editable-setup')) {
        headerTitle.classList.add('editable-setup');
        // 创建可编辑的包装器
        var wrapper = document.createElement('span');
        wrapper.className = 'editable-title-wrapper';
        wrapper.innerHTML = '<span class="title-text">' + escapeHtml(titleText) + '</span> <button type="button" class="btn btn-icon small btn-edit-title" title="修改标题">✏️</button>';
        headerTitle.innerHTML = '';
        headerTitle.appendChild(wrapper);
        // 添加编辑事件
        wrapper.querySelector('.btn-edit-title').addEventListener('click', function() {
          var textSpan = wrapper.querySelector('.title-text');
          var currentText = textSpan.textContent;
          var input = document.createElement('input');
          input.type = 'text';
          input.value = currentText;
          input.className = 'title-edit-input';
          // 替换文本为输入框
          textSpan.replaceWith(input);
          input.focus();
          input.select();
          // 保存和取消处理
          function save() {
            var newText = input.value.trim();
            if (newText) {
              textSpan.textContent = newText;
              // 更新页面标题和存储
              document.title = newText + ' - 我的工作台';
              localStorage.setItem('workbench_custom_title', newText);
            }
            input.replaceWith(textSpan);
          }
          function cancel() {
            input.replaceWith(textSpan);
          }
          input.addEventListener('blur', save);
          input.addEventListener('keydown', function(e) {
            if (e.key === 'Enter') save();
            if (e.key === 'Escape') cancel();
          });
        });
      }
    }

        var btnSettings = document.getElementById('btnSettings');
    if (btnSettings) btnSettings.style.display = canEdit() ? '' : 'none';
    /* footer 由 _syncFooter 统一控制，避免各处覆盖 */
    _syncFooter();
    if (window.WorkbenchUI && typeof window.WorkbenchUI.refreshUI === 'function') {
      window.WorkbenchUI.refreshUI();
    }
    if (appRoot) appRoot.style.display = currentUser ? '' : 'none';

    if (loginOverlay) loginOverlay.style.display = currentUser ? 'none' : '';
    if (!userArea) return;
    if (currentUser) {
      userArea.innerHTML = '<span class="user-name">' + escapeHtml(currentUser) + '</span> <button type="button" class="btn btn-secondary btn-sm" id="btnLogout">退出</button>';
      var logout = document.getElementById('btnLogout');
      if (logout) logout.addEventListener('click', function () {
        currentUser = '';
        currentRole = '';
        localStorage.removeItem(STORAGE_USER);
        localStorage.removeItem(STORAGE_USER_ROLE);
        updateUserUI();
        renderModules();
      });
    } else {
      userArea.innerHTML = '<button type="button" class="btn btn-secondary btn-sm" id="btnLogin">登录</button>';
      var loginBtn = document.getElementById('btnLogin');
      if (loginBtn) loginBtn.addEventListener('click', openLoginModal);
    }
  }

  function openViewContentModal(item) {
    document.getElementById('viewContentTitle').textContent = item.title || '查看内容';
    document.getElementById('viewContentBody').innerHTML = '<div class="view-content-text">' + linkify(escapeHtml(item.content || '（无正文）')) + '</div>';
    document.getElementById('viewContentModal').classList.add('show');
  }

  function closeViewContentModal() {
    document.getElementById('viewContentModal').classList.remove('show');
  }

  /* 搜索防抖优化：避免频繁渲染 + 高级搜索提示 */
  var searchDebounceTimer;
  if (searchInput) {
    searchInput.addEventListener('input', function () {
      clearTimeout(searchDebounceTimer);
      searchDebounceTimer = setTimeout(function () {
        renderModules();
        updateSearchHint();
      }, 300);
    });
  }
  
  /* 更新搜索提示 */
  function updateSearchHint() {
    var searchHintEl = document.getElementById('searchHint');
    if (!searchHintEl) return;
    
    var q = getSearchText();
    if (!q || !window.AdvancedSearch) {
      searchHintEl.style.display = 'none';
      return;
    }
    
    var searchCriteria = window.AdvancedSearch.parseSearchQuery(q);
    var hint = window.AdvancedSearch.getSearchHint(searchCriteria);
    
    if (hint) {
      searchHintEl.textContent = hint;
      searchHintEl.style.display = 'block';
    } else {
      searchHintEl.style.display = 'none';
    }
  }
  /* 暴露给 theme-glass.js 的 filterCards 调用 */
  window._appRenderModules = renderModules;

  /* footer 显示规则：管理员 + dashboard 视图时才显示（用 class 控制，因为 theme-glass.css 有 !important） */
    function _syncFooter() {
    if (!footerBar) return;
    footerBar.classList.add('hidden');
  }

  _syncFooter();

  /* showView 切换视图时触发同步，防止被 updateUserUI 覆盖 */
  window._onViewChange = function (viewName) {
    _syncFooter();
  };

  var settingsPanel = document.getElementById('settingsPanel');
  var settingsOverlay = document.getElementById('settingsOverlay');
  function openSettings() {
    document.getElementById('layoutCols').value = state.layout.cols;
    document.getElementById('layoutGap').value = state.layout.gap;
    document.getElementById('layoutAlign').value = state.layout.align;
    document.getElementById('bgType').value = state.bg.type;
    document.getElementById('bgColor').value = state.bg.color;
    document.getElementById('bgImage').value = state.bg.image || '';
    document.getElementById('bgGradient').value = state.bg.gradient || '';
    document.getElementById('guestUsers').value = state.guestUsers || '';
    document.getElementById('adminUsers').value = state.allowedUsers || '';

    if (state.bg.image && state.bg.image.indexOf('data:') === 0) {
      document.getElementById('bgUploadHint').textContent = '当前使用本地上传的图片';
    } else {
      document.getElementById('bgUploadHint').textContent = '';
    }
    document.getElementById('bgImageFile').value = '';
    toggleBgInputs(state.bg.type);
    var gallery = document.getElementById('bgGallery');
    if (gallery) {
      gallery.innerHTML = '';
      BG_LIBRARY.forEach(function (item) {
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'bg-gallery-item' + (state.bg.type === 'image' && state.bg.image === item.url ? ' active' : '');
        btn.title = item.name;
        btn.innerHTML = '<img src="' + item.url + '" alt="">';
        btn.addEventListener('click', function () {
          state.bg.type = 'image';
          state.bg.image = item.url;
          persistState();
          applyBackground();
          openSettings();
        });
        gallery.appendChild(btn);
      });
    }
    /* 初始化主题选择器 */
    var themeSelector = document.getElementById('themeSelector');
    if (themeSelector && window.ThemeSystem) {
      var currentTheme = window.ThemeSystem.getCurrentTheme();
      var themes = window.ThemeSystem.getThemeList();
      themeSelector.innerHTML = themes.map(function(theme) {
        return '<button type="button" class="theme-card' + (theme.key === currentTheme ? ' active' : '') + '" data-theme="' + theme.key + '">' +
          '<div class="theme-card-icon">' + theme.icon + '</div>' +
          '<div class="theme-card-name">' + theme.name + '</div>' +
        '</button>';
      }).join('');
      
      /* 绑定主题切换事件 */
      themeSelector.querySelectorAll('.theme-card').forEach(function(btn) {
        btn.addEventListener('click', function() {
          var themeKey = btn.dataset.theme;
          window.ThemeSystem.applyTheme(themeKey);
          /* 更新激活状态 */
          themeSelector.querySelectorAll('.theme-card').forEach(function(b) {
            b.classList.toggle('active', b.dataset.theme === themeKey);
          });
          showToast('主题已切换', 'success');
        });
      });
    }
    
    if (window.workbenchApi) {
      document.getElementById('dataPathSection').style.display = '';
      if (document.getElementById('obsidianPathSection')) document.getElementById('obsidianPathSection').style.display = '';
      window.workbenchApi.getConfig().then(function (cfg) {
        document.getElementById('dataPathInput').value = (cfg && cfg.dataPath) || '';
        if (document.getElementById('obsidianVaultPathInput')) document.getElementById('obsidianVaultPathInput').value = (cfg && cfg.obsidianVaultPath) || '';
        if (document.getElementById('obsidianSyncFolderInput')) document.getElementById('obsidianSyncFolderInput').value = (cfg && cfg.obsidianSyncFolder) || 'WorkbenchSync';
      });
    }
    settingsPanel.classList.add('open');
    settingsOverlay.classList.add('show');
  }
  function closeSettings() {
    settingsPanel.classList.remove('open');
    settingsOverlay.classList.remove('show');
  }
  function toggleBgInputs(type) {
    document.getElementById('bgColorWrap').classList.toggle('hidden', type !== 'color');
    document.getElementById('bgImageWrap').classList.toggle('hidden', type !== 'image');
    document.getElementById('bgGradientWrap').classList.toggle('hidden', type !== 'gradient');
  }
  document.getElementById('btnSettings').addEventListener('click', openSettings);
  document.getElementById('btnCloseSettings').addEventListener('click', closeSettings);
  settingsOverlay.addEventListener('click', closeSettings);
  document.getElementById('bgType').addEventListener('change', function () { toggleBgInputs(this.value); });
  document.getElementById('btnApplySettings').addEventListener('click', function () {
    state.layout = {
      cols: Math.max(1, Math.min(6, parseInt(document.getElementById('layoutCols').value, 10) || 3)),
      gap: Math.max(0, Math.min(48, parseInt(document.getElementById('layoutGap').value, 10) || 16)),
      align: document.getElementById('layoutAlign').value
    };
    var urlInput = (document.getElementById('bgImage').value || '').trim();
    var keepUploaded = !urlInput && state.bg.image && state.bg.image.indexOf('data:') === 0;
    state.bg = {
      type: document.getElementById('bgType').value,
      color: document.getElementById('bgColor').value,
      image: urlInput || (keepUploaded ? state.bg.image : ''),
      gradient: (document.getElementById('bgGradient').value || '').trim() || defaultBg.gradient
    };
    state.guestUsers = (document.getElementById('guestUsers').value || '').trim();
    state.allowedUsers = (document.getElementById('adminUsers').value || '').trim();

    persistState();
    if (window.workbenchApi) {
      window.workbenchApi.setConfig({
        dataPath: (document.getElementById('dataPathInput').value || '').trim(),
        obsidianVaultPath: (document.getElementById('obsidianVaultPathInput') ? document.getElementById('obsidianVaultPathInput').value : '').trim(),
        obsidianSyncFolder: (document.getElementById('obsidianSyncFolderInput') ? document.getElementById('obsidianSyncFolderInput').value : 'WorkbenchSync').trim() || 'WorkbenchSync'
      });
    }
    applyLayout();
    applyBackground();
    closeSettings();
  });
  document.getElementById('bgImageFile').addEventListener('change', function () {
    var file = this.files && this.files[0];
    if (!file || !file.type.match(/^image\//)) return;
    var hint = document.getElementById('bgUploadHint');
    hint.textContent = '处理中…';
    var img = new Image();
    var url = URL.createObjectURL(file);
    img.onload = function () {
      URL.revokeObjectURL(url);
      var w = img.width, h = img.height, maxW = 1920, maxH = 1080;
      if (w > maxW || h > maxH) {
        var r = Math.min(maxW / w, maxH / h);
        w = Math.round(w * r);
        h = Math.round(h * r);
      }
      var canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      canvas.getContext('2d').drawImage(img, 0, 0, w, h);
      try {
        state.bg.type = 'image';
        state.bg.image = canvas.toDataURL('image/jpeg', 0.85);
        persistState();
        applyBackground();
        hint.textContent = '已使用本地上传的图片';
      } catch (_) { hint.textContent = '上传失败'; }
      this.value = '';
    };
    img.onerror = function () { URL.revokeObjectURL(url); hint.textContent = '上传失败'; };
    img.src = url;
  });

    var btnExportState = document.getElementById('btnExportState');
    if (btnExportState) btnExportState.addEventListener('click', function () {
      exportStateToFile(false);
      showToast('数据已导出', 'success');
    });

  var btnImportState = document.getElementById('btnImportState');
  var importStateFile = document.getElementById('importStateFile');
  if (btnImportState && importStateFile) {
    btnImportState.addEventListener('click', function () { importStateFile.click(); });
    importStateFile.addEventListener('change', function () {
      var f = this.files && this.files[0];
      if (!f) return;
            importStateFromFile(f)
        .then(function () { showToast('导入成功', 'success'); })
        .catch(function () { showToast('导入失败：文件格式不正确', 'error'); })
        .finally(function () { importStateFile.value = ''; });

    });
  }

  if (window.workbenchApi) {
    window.workbenchApi.getConfig().then(function (cfg) {
      if (document.getElementById('dataPathSection')) document.getElementById('dataPathSection').style.display = '';
      if (document.getElementById('obsidianPathSection')) document.getElementById('obsidianPathSection').style.display = '';
      if (document.getElementById('dataPathInput') && cfg && cfg.dataPath) document.getElementById('dataPathInput').value = cfg.dataPath;
      if (document.getElementById('obsidianVaultPathInput')) document.getElementById('obsidianVaultPathInput').value = (cfg && cfg.obsidianVaultPath) || '';
      if (document.getElementById('obsidianSyncFolderInput')) document.getElementById('obsidianSyncFolderInput').value = (cfg && cfg.obsidianSyncFolder) || 'WorkbenchSync';
    }).catch(function () {});

    var chooseBtn = document.getElementById('btnChooseDataPath');
    if (chooseBtn) chooseBtn.addEventListener('click', function () {
      window.workbenchApi.chooseDataPath().then(function (path) {
        if (!path) return;
        window.workbenchApi.setConfig({ dataPath: path });
        document.getElementById('dataPathInput').value = path;
      });
    });

    var chooseObsidianBtn = document.getElementById('btnChooseObsidianVaultPath');
    if (chooseObsidianBtn) chooseObsidianBtn.addEventListener('click', function () {
      window.workbenchApi.chooseObsidianVaultPath().then(function (vaultPath) {
        if (!vaultPath) return;
        var syncFolderInput = document.getElementById('obsidianSyncFolderInput');
        var syncFolder = ((syncFolderInput && syncFolderInput.value) || 'WorkbenchSync').trim() || 'WorkbenchSync';
        window.workbenchApi.setConfig({ obsidianVaultPath: vaultPath, obsidianSyncFolder: syncFolder });
        document.getElementById('obsidianVaultPathInput').value = vaultPath;
      });
    });
  }

  bindModuleModal();
  bindItemModal();
  bindCommentsModal();
  bindViewContentModal();
  bindAttachmentModals();
  bindLoginModal();
  bindTodoPanel();
  bindCommandPalette();
  updateUserUI();
  applyLayout();
  applyBackground();
  renderTodos();
  renderModules();
  /* 初始化概览卡片和最近使用 */
  renderOverviewMetrics();
  renderRecentActivity();
  
  /* 检查是否需要备份提醒 */
  checkBackupReminder();

  /* 暴露全局函数供 knowledge.js 调用 */
  window.addRecentActivity = addRecentActivity;
  window.renderOverviewMetrics = renderOverviewMetrics;

  /* ── 全局快捷键 ──────────────────────────────────────────
   * Ctrl+K        → 打开命令面板
   * Ctrl+N        → 新建内容（管理员）
   * Ctrl+F        → 聚焦搜索框
   * Ctrl+B        → 立即备份数据
   * Ctrl+,        → 打开设置
   * Ctrl+Shift+T  → 新建待办
   * Ctrl+Shift+N  → 新建笔记（管理员）
   * Ctrl+Shift+F  → 打开命令面板（全局搜索）
   * Esc           → 关闭弹窗/清空搜索
   * ──────────────────────────────────────────────────────── */
  document.addEventListener('keydown', function (e) {
    var tag = (document.activeElement && document.activeElement.tagName) || '';
    var inInput = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';

    // Ctrl+K / Cmd+K：打开命令面板
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
      e.preventDefault();
      openCommandPalette(getCurrentView() === 'dashboard' && searchInput ? searchInput.value : '');
      return;
    }

    // Ctrl+F / Cmd+F：聚焦搜索框
    if ((e.ctrlKey || e.metaKey) && e.key === 'f' && !inInput) {
      e.preventDefault();
      if (getCurrentView() === 'dashboard' && searchInput) {
        searchInput.focus();
        searchInput.select();
      } else if (getCurrentView() === 'knowledge') {
        var kbSearch = document.getElementById('kb-search-input');
        if (kbSearch) {
          kbSearch.focus();
          kbSearch.select();
        }
      }
      return;
    }

    // Ctrl+B / Cmd+B：立即备份数据
    if ((e.ctrlKey || e.metaKey) && e.key === 'b' && !inInput) {
      e.preventDefault();
      if (window.workbenchBackup) {
        window.workbenchBackup();
      }
      return;
    }

    // Ctrl+, / Cmd+,：打开设置
    if ((e.ctrlKey || e.metaKey) && e.key === ',') {
      e.preventDefault();
      if (canEdit()) {
        openSettings();
      }
      return;
    }

    // Ctrl+Shift+T：新建待办
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'T') {
      e.preventDefault();
      if (getCurrentView() === 'dashboard' && todoInput) {
        todoInput.focus();
        todoInput.select();
      }
      return;
    }

    // Ctrl+Shift+N：新建笔记（管理员）
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'N') {
      e.preventDefault();
      if (canEdit()) {
        if (typeof window.showView === 'function') window.showView('knowledge');
        if (window.KnowledgeBase && typeof window.KnowledgeBase.openEditor === 'function') {
          window.KnowledgeBase.openEditor(null);
        }
      }
      return;
    }

    // Ctrl+Shift+F：打开命令面板（全局搜索）
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'F') {
      e.preventDefault();
      openCommandPalette('');
      return;
    }

    // Ctrl+N / Cmd+N：新建内容（管理员）
    if ((e.ctrlKey || e.metaKey) && e.key === 'n' && !e.shiftKey) {
      e.preventDefault();
      if (canEdit() && state.modules.length > 0) {
        openItemModal(state.modules[0].id, null);
      } else if (canEdit()) {
        openModuleModal(null);
      }
      return;
    }

    // Esc：关闭弹窗 → 关闭设置面板 → 清空搜索
    if (e.key === 'Escape') {
      // 已在输入框内且有值时先 blur，防止误关弹窗
      if (commandPaletteState.open) {
        closeCommandPalette();
        return;
      }
      var modals = ['itemModal', 'moduleModal', 'commentsModal', 'viewContentModal',
                    'loginModal', 'attachmentsListModal'];
      var closed = false;
      for (var mi = 0; mi < modals.length; mi++) {
        var m = document.getElementById(modals[mi]);
        if (m && m.classList.contains('show')) {
          m.classList.remove('show');
          closed = true;
          break;
        }
      }
      if (!closed && settingsPanel && settingsPanel.classList.contains('open')) {
        closeSettings();
        closed = true;
      }
      if (!closed && searchInput && searchInput.value) {
        searchInput.value = '';
        renderModules();
        searchInput.blur();
      }
      return;
    }
  });

  if (window.workbenchApi) {
    window.workbenchApi.loadState().then(function (data) {
      if (data) {
        state = migrateState(data);
        if (data.allowedUsers !== undefined) state.allowedUsers = data.allowedUsers;
        if (data.guestUsers !== undefined) state.guestUsers = data.guestUsers;
        state.todos = normalizeTodos(Array.isArray(data.todos) ? data.todos : (state.todos || []));
        if (data.collapsedModules) state.collapsedModules = data.collapsedModules;
      }
      applyLayout();
      applyBackground();
      renderTodos();
      renderModules();
    }).catch(function () {});
  } else {
    var rawState = load(STORAGE_STATE, null);
    if (rawState) {
      if (rawState.modules) state.modules = rawState.modules;
      if (rawState.allowedUsers !== undefined) state.allowedUsers = rawState.allowedUsers;
      if (Array.isArray(rawState.todos)) state.todos = normalizeTodos(rawState.todos);
      if (rawState.collapsedModules) state.collapsedModules = rawState.collapsedModules;
    }
    if (typeof state.allowedUsers !== 'string') state.allowedUsers = '';
    fetchFirstOk(CLOUD_STATE_URLS, { method: 'GET' })
      .then(function (pair) { 
        return pair.res.text(); 
      })
      .then(function (text) {
        if (!text || text === 'null') {
          return;
        }
        var data = JSON.parse(text);
        if (data && (data.modules || data.layout || data.allowedUsers != null || data.guestUsers != null)) {
          state = migrateState(data);
          if (data.allowedUsers !== undefined) state.allowedUsers = data.allowedUsers;
          if (data.guestUsers !== undefined) state.guestUsers = data.guestUsers;
          state.todos = normalizeTodos(Array.isArray(data.todos) ? data.todos : (state.todos || []));
          if (data.collapsedModules) state.collapsedModules = data.collapsedModules || {};
          applyLayout();
          applyBackground();
          renderTodos();
          renderModules();
        }
      })
      .catch(function (e) { 
        console.warn('云端加载失败', e);
        showCloudSyncUnavailable(); 
      });
  }

  function showCloudSyncUnavailable() {
    // 黄色提示框已移除
  }

  // 供附件/外部窗口保存回写
  window.workbenchUpdateAttachmentContent = function (attId, newContent) {
    try {
      state.modules.forEach(function (m) {
        (m.items || []).forEach(function (it) {
          var list = it.attachments || [];
          var a = list.find(function (x) { return x.id === attId; });
          if (a) a.content = String(newContent == null ? '' : newContent);
        });
      });
      persistState();
    } catch (_) {}
  };


  function exportStateToFile(autoBackup) {
    var toSave = {
      layout: state.layout,
      bg: state.bg,
      modules: state.modules,
      todos: state.todos || [],
      allowedUsers: state.allowedUsers,
      guestUsers: state.guestUsers || '',
      collapsedModules: state.collapsedModules || {},
      exportTime: new Date().toISOString(),
      version: '1.0'
    };
    var blob = new Blob([JSON.stringify(toSave, null, 2)], { type: 'application/json;charset=utf-8' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    
    /* 生成带时间戳的文件名 */
    var now = new Date();
    var timestamp = now.getFullYear() +
      pad2(now.getMonth() + 1) +
      pad2(now.getDate()) + '_' +
      pad2(now.getHours()) +
      pad2(now.getMinutes()) +
      pad2(now.getSeconds());
    
    a.download = autoBackup
      ? 'workbench-backup-' + timestamp + '.json'
      : 'workbench-export-' + timestamp + '.json';
    
    a.click();
    URL.revokeObjectURL(a.href);
    
    /* 记录最后备份时间 */
    if (autoBackup) {
      try {
        localStorage.setItem('workbench_last_backup', now.toISOString());
      } catch (_) {}
    }
  }

  function importStateFromFile(file) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function () {
        try {
          var text = typeof reader.result === 'string' ? reader.result : '';
          var data = JSON.parse(text);
          state = migrateState(data);
          if (data.allowedUsers !== undefined) state.allowedUsers = data.allowedUsers;
          if (data.guestUsers !== undefined) state.guestUsers = data.guestUsers;
          state.todos = normalizeTodos(Array.isArray(data.todos) ? data.todos : []);
          if (data.collapsedModules) state.collapsedModules = data.collapsedModules || {};
          persistState();
          applyLayout();
          applyBackground();
          renderTodos();
          renderModules();
          resolve();
        } catch (e) {
          reject(e);
        }
      };
      reader.onerror = reject;
      reader.readAsText(file, 'UTF-8');
    });
  }
/* 备份提醒功能 */
function checkBackupReminder() {
  try {
    var lastBackup = localStorage.getItem('workbench_last_backup');
    var backupInterval = 7 * 24 * 60 * 60 * 1000; // 7天
    
    if (!lastBackup || (Date.now() - new Date(lastBackup).getTime() > backupInterval)) {
      /* 7天未备份，显示提醒 */
      setTimeout(function() {
        if (window.WorkbenchUI && typeof window.WorkbenchUI.confirm === 'function') {
          window.WorkbenchUI.confirm({
            title: '数据备份提醒',
            message: '您已经超过7天未备份数据，建议立即备份以防数据丢失。',
            confirmText: '立即备份',
            cancelText: '稍后提醒',
            danger: false
          }).then(function(ok) {
            if (ok) {
              exportStateToFile(true);
              showToast('备份已保存', 'success');
            }
          });
        }
      }, 3000); // 3秒后显示提醒
    }
  } catch (_) {}
}

/* 暴露备份函数供外部调用 */
window.workbenchBackup = function() {
  exportStateToFile(true);
  showToast('备份已保存', 'success');
};

})();