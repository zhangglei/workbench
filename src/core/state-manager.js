/**
 * 状态管理器 - 集中式状态管理
 * 提供响应式状态更新和持久化
 */
(function() {
  'use strict';

  // 状态树
  let state = {
    app: {
      initialized: false,
      loading: false,
      error: null,
      version: '2.0.0'
    },
    
    user: {
      id: '',
      name: '',
      role: 'guest', // guest | user | admin
      preferences: {}
    },
    
    layout: {
      cols: 3,
      gap: 24,
      align: 'start',
      responsive: true,
      current: 'default'
    },
    
    theme: {
      current: 'default',
      mode: 'auto', // light | dark | auto
      customColors: {}
    },
    
    modules: {
      list: [],
      active: null,
      collapsed: {},
      order: []
    },
    
    ui: {
      sidebar: { open: false },
      modal: { open: false, content: null },
      toast: { messages: [] },
      commandPalette: { open: false }
    }
  };

  // 状态监听器
  const watchers = {};

  /**
   * 获取状态
   * @param {string} path - 状态路径，如 'user.name'
   * @returns {*} 状态值
   */
  function getState(path) {
    if (!path) return state;
    
    return path.split('.').reduce(function(obj, key) {
      return obj ? obj[key] : undefined;
    }, state);
  }

  /**
   * 设置状态
   * @param {string} path - 状态路径
   * @param {*} value - 新值
   * @param {boolean} persist - 是否持久化
   */
  function setState(path, value, persist) {
    const keys = path.split('.');
    const lastKey = keys.pop();
    const target = keys.reduce(function(obj, key) {
      if (!obj[key]) obj[key] = {};
      return obj[key];
    }, state);
    
    const oldValue = target[lastKey];
    target[lastKey] = value;

    // 触发监听器
    notifyWatchers(path, value, oldValue);

    // 持久化
    if (persist !== false) {
      persistState(path);
    }

    // 发布状态变更事件
    if (window.EventBus) {
      window.EventBus.emit('state:changed', { path: path, value: value, oldValue: oldValue });
    }
  }

  /**
   * 监听状态变化
   * @param {string} path - 状态路径
   * @param {Function} callback - 回调函数
   * @returns {Function} 取消监听函数
   */
  function watch(path, callback) {
    if (!watchers[path]) {
      watchers[path] = [];
    }
    watchers[path].push(callback);

    return function unwatch() {
      const index = watchers[path].indexOf(callback);
      if (index > -1) {
        watchers[path].splice(index, 1);
      }
    };
  }

  /**
   * 通知监听器
   */
  function notifyWatchers(path, newValue, oldValue) {
    if (watchers[path]) {
      watchers[path].forEach(function(callback) {
        try {
          callback(newValue, oldValue);
        } catch (error) {
          console.error('[StateManager] 监听器错误:', path, error);
        }
      });
    }
  }

  /**
   * 持久化状态
   */
  function persistState(path) {
    try {
      const key = 'workbench_v2_' + path.replace(/\./g, '_');
      const value = getState(path);
      localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      console.error('[StateManager] 持久化失败:', path, error);
    }
  }

  /**
   * 从本地存储恢复状态
   */
  function restoreState() {
    try {
      // 恢复用户信息
      const userStr = localStorage.getItem('workbench_v2_user');
      if (userStr) {
        state.user = JSON.parse(userStr);
      }

      // 恢复布局配置
      const layoutStr = localStorage.getItem('workbench_v2_layout');
      if (layoutStr) {
        state.layout = Object.assign(state.layout, JSON.parse(layoutStr));
      }

      // 恢复主题配置
      const themeStr = localStorage.getItem('workbench_v2_theme');
      if (themeStr) {
        state.theme = Object.assign(state.theme, JSON.parse(themeStr));
      }

      // 恢复模块配置
      const modulesStr = localStorage.getItem('workbench_v2_modules');
      if (modulesStr) {
        state.modules = Object.assign(state.modules, JSON.parse(modulesStr));
      }
    } catch (error) {
      console.error('[StateManager] 恢复状态失败:', error);
    }
  }

  /**
   * 重置状态
   * @param {string} path - 状态路径（可选）
   */
  function resetState(path) {
    if (path) {
      // 重置特定路径
      const keys = path.split('.');
      const lastKey = keys.pop();
      const target = keys.reduce(function(obj, key) {
        return obj ? obj[key] : undefined;
      }, state);
      
      if (target && target[lastKey] !== undefined) {
        // 这里需要默认值，暂时设为 null
        target[lastKey] = null;
        notifyWatchers(path, null, target[lastKey]);
      }
    } else {
      // 重置所有状态
      Object.keys(state).forEach(function(key) {
        state[key] = {};
      });
    }
  }

  // 初始化：恢复状态
  restoreState();

  // 暴露到全局
  window.StateManager = {
    getState: getState,
    setState: setState,
    watch: watch,
    resetState: resetState,
    state: state // 只读访问
  };
})();
