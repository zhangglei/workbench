/**
 * 工作台持久化：与 app.js 共用同一套 localStorage / 云端写入契约。
 * 依赖：先加载 modules/state.js（window.WorkbenchState）
 */
(function () {
  'use strict';

  var WS = function () {
    return window.WorkbenchState;
  };

  var CLOUD_STATE_URLS = ['/api/workbench-state', '/.netlify/functions/workbench-state'];

  var lastCloudSyncError = '';
  var lastStateChangeAt = 0;
  var lastPersistedStateAt = 0;

  function loadStringStorage(key, fallback) {
    try {
      var s = localStorage.getItem(key);
      if (s == null || s === '') return fallback;
      try {
        var parsed = JSON.parse(s);
        return typeof parsed === 'string' ? parsed : fallback;
      } catch (_) {
        // 兼容旧版本直接写入纯文本账号列表的情况。
        return s;
      }
    } catch (_) {
      return fallback;
    }
  }

  function getStateUpdatedAt(data) {
    var updatedAt = Number(data && data.updatedAt);
    return Number.isFinite(updatedAt) && updatedAt > 0 ? updatedAt : 0;
  }

  function hasFreshLocalState(incomingUpdatedAt) {
    return lastPersistedStateAt > 0 && (!incomingUpdatedAt || incomingUpdatedAt <= lastPersistedStateAt);
  }

  function markStateChanged() {
    lastStateChangeAt = Date.now();
    return lastStateChangeAt;
  }

  function buildStateSnapshot(state, updatedAt) {
    var S = WS();
    return {
      layout: state.layout,
      bg: state.bg,
      modules: state.modules,
      todos: state.todos || [],
      allowedUsers: S.ensureDefaultAdminAccount(state.allowedUsers || ''),
      guestUsers: state.guestUsers || '',
      collapsedModules: state.collapsedModules || {},
      updatedAt: updatedAt || 0
    };
  }

  function syncLocalStateCache(snapshot) {
    var S = WS();
    var defaultLayout = S.defaultLayout;
    var defaultBg = S.defaultBg;
    try {
      localStorage.setItem('workbench_allowed_users', JSON.stringify(S.ensureDefaultAdminAccount(snapshot && snapshot.allowedUsers ? snapshot.allowedUsers : '')));
      localStorage.setItem(S.STORAGE_LAYOUT, JSON.stringify(snapshot ? snapshot.layout : defaultLayout));
      localStorage.setItem(S.STORAGE_BG, JSON.stringify(snapshot ? snapshot.bg : defaultBg));
      localStorage.setItem(S.STORAGE_TODOS, JSON.stringify(snapshot && snapshot.todos ? snapshot.todos : []));
      localStorage.setItem(S.STORAGE_STATE, JSON.stringify(snapshot));
    } catch (_) {}
  }

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

  function persistState(state) {
    var updatedAt = markStateChanged();
    lastPersistedStateAt = updatedAt;
    var toSave = buildStateSnapshot(state, updatedAt);
    syncLocalStateCache(toSave);

    if (window.workbenchApi) {
      window.workbenchApi.saveState(toSave).catch(function (e) {
        console.error(e);
      });
      return;
    }

    fetchFirstOk(CLOUD_STATE_URLS, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(toSave)
    }).catch(function (e) {
      console.warn('云端保存失败', e);
    });
  }

  /**
   * 从 localStorage 合并出与 app.js 启动时一致的 state（不含 todoFilter、accordionMode 等 UI 字段）。
   */
  function loadMergedStateFromLocalStorage() {
    var S = WS();
    var migrateState = S.migrateState;
    var load = S.load;
    var state = migrateState(null);
    state.layout = load(S.STORAGE_LAYOUT, S.defaultLayout);
    state.bg = load(S.STORAGE_BG, S.defaultBg);
    state.allowedUsers = S.ensureDefaultAdminAccount(loadStringStorage('workbench_allowed_users', ''));
    state.guestUsers = state.guestUsers || '';
    state.todos = S.normalizeTodos(load(S.STORAGE_TODOS, state.todos || []));
    state.collapsedModules = state.collapsedModules || {};
    var raw = load(S.STORAGE_STATE, null);
    if (raw && raw.modules && raw.modules.length && raw.modules[0].items !== undefined) {
      state.modules = raw.modules;
      if (raw.allowedUsers !== undefined) state.allowedUsers = raw.allowedUsers;
      if (Array.isArray(raw.todos)) state.todos = S.normalizeTodos(raw.todos);
      if (raw.collapsedModules) state.collapsedModules = raw.collapsedModules;
    } else if (raw) {
      state = migrateState({
        layout: state.layout,
        bg: state.bg,
        modules: raw.modules || [],
        links: raw.links || [],
        allowedUsers: state.allowedUsers
      });
      if (Array.isArray(raw.todos)) state.todos = S.normalizeTodos(raw.todos);
      state.collapsedModules = raw.collapsedModules || {};
    }
    state.allowedUsers = S.ensureDefaultAdminAccount(state.allowedUsers);
    if (raw && raw.guestUsers !== undefined) {
      state.guestUsers = raw.guestUsers;
    }
    return state;
  }

  /** 将本地快照合并进已有 state 对象（用于其它标签页修改后的同步）。 */
  function refreshAppStateFromLocalStorage(state) {
    var merged = loadMergedStateFromLocalStorage();
    state.layout = merged.layout;
    state.bg = merged.bg;
    state.modules = merged.modules;
    state.allowedUsers = merged.allowedUsers;
    state.guestUsers = merged.guestUsers;
    state.todos = merged.todos;
    state.collapsedModules = merged.collapsedModules || {};
  }

  function bumpLastPersistedAtFromData(data) {
    var t = getStateUpdatedAt(data);
    if (t > 0) lastPersistedStateAt = Math.max(lastPersistedStateAt, t);
  }

  window.WorkbenchPersist = {
    CLOUD_STATE_URLS: CLOUD_STATE_URLS,
    getStateUpdatedAt: getStateUpdatedAt,
    hasFreshLocalState: hasFreshLocalState,
    getLastStateChangeAt: function () {
      return lastStateChangeAt;
    },
    getLastPersistedStateAt: function () {
      return lastPersistedStateAt;
    },
    setLastPersistedStateAt: function (v) {
      lastPersistedStateAt = v;
    },
    bumpLastPersistedAtFromData: bumpLastPersistedAtFromData,
    buildStateSnapshot: buildStateSnapshot,
    syncLocalStateCache: syncLocalStateCache,
    fetchFirstOk: fetchFirstOk,
    persistState: persistState,
    loadMergedStateFromLocalStorage: loadMergedStateFromLocalStorage,
    refreshAppStateFromLocalStorage: refreshAppStateFromLocalStorage,
    getLastCloudSyncError: function () {
      return lastCloudSyncError;
    }
  };
})();
