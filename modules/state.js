/**
 * 状态管理模块
 * 负责：数据持久化、状态迁移、云端同步
 */
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

  function ensureDefaultAdminAccount(text) {
    var current = (text || '').trim();
    var rows = current ? current.split('\n') : [];
    var hasRoot = rows.some(function (line) {
      return (line || '').trim() === 'root:root';
    });
    if (!hasRoot) rows.unshift('root:root');
    return rows.filter(Boolean).join('\n');
  }

  /** 将旧版 state 转为新版 */
  function migrateState(data) {
    if (!data) return { layout: defaultLayout, bg: defaultBg, modules: [], allowedUsers: 'root:root', guestUsers: '', todos: [] };
    var layout = data.layout || defaultLayout;
    var bg = data.bg || defaultBg;
    var allowedUsers = ensureDefaultAdminAccount(data.allowedUsers || '');
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

  // 暴露给全局
  window.WorkbenchState = {
    STORAGE_LAYOUT: STORAGE_LAYOUT,
    STORAGE_BG: STORAGE_BG,
    STORAGE_STATE: STORAGE_STATE,
    STORAGE_TODOS: STORAGE_TODOS,
    STORAGE_TODO_UI: STORAGE_TODO_UI,
    STORAGE_USER: STORAGE_USER,
    STORAGE_USER_ROLE: STORAGE_USER_ROLE,
    defaultLayout: defaultLayout,
    defaultBg: defaultBg,
    id: id,
    load: load,
    pad2: pad2,
    getDateKey: getDateKey,
    normalizeTodos: normalizeTodos,
    ensureDefaultAdminAccount: ensureDefaultAdminAccount,
    migrateState: migrateState
  };
})();
