/**
 * 路由管理器 - 基于 Hash 的 SPA 路由
 * 支持动态路由和路由守卫
 */
(function() {
  'use strict';

  const routes = {};
  let currentRoute = null;
  const guards = {
    before: [],
    after: []
  };

  /**
   * 注册路由
   * @param {string} path - 路由路径，如 '#/dashboard' 或 '#/module/:id'
   * @param {Function} handler - 路由处理函数
   */
  function register(path, handler) {
    routes[path] = handler;
  }

  /**
   * 批量注册路由
   * @param {Object} routeMap - 路由映射对象
   */
  function registerRoutes(routeMap) {
    Object.keys(routeMap).forEach(function(path) {
      register(path, routeMap[path]);
    });
  }

  /**
   * 解析路由参数
   * @param {string} pattern - 路由模式
   * @param {string} path - 实际路径
   * @returns {Object|null} 参数对象
   */
  function parseParams(pattern, path) {
    const patternParts = pattern.split('/');
    const pathParts = path.split('/');

    if (patternParts.length !== pathParts.length) {
      return null;
    }

    const params = {};
    for (let i = 0; i < patternParts.length; i++) {
      if (patternParts[i].startsWith(':')) {
        const paramName = patternParts[i].slice(1);
        params[paramName] = pathParts[i];
      } else if (patternParts[i] !== pathParts[i]) {
        return null;
      }
    }

    return params;
  }

  /**
   * 匹配路由
   * @param {string} path - 路径
   * @returns {Object|null} 匹配结果
   */
  function matchRoute(path) {
    // 精确匹配
    if (routes[path]) {
      return { handler: routes[path], params: {} };
    }

    // 参数匹配
    for (let pattern in routes) {
      if (pattern.indexOf(':') !== -1) {
        const params = parseParams(pattern, path);
        if (params) {
          return { handler: routes[pattern], params: params };
        }
      }
    }

    return null;
  }

  /**
   * 导航到指定路由
   * @param {string} path - 路由路径
   * @param {Object} options - 选项
   */
  function navigate(path, options) {
    options = options || {};
    
    // 确保路径以 # 开头
    if (!path.startsWith('#')) {
      path = '#' + path;
    }

    // 执行前置守卫
    for (let i = 0; i < guards.before.length; i++) {
      const result = guards.before[i](path, currentRoute);
      if (result === false) {
        return; // 阻止导航
      }
    }

    // 更新 hash
    if (!options.replace) {
      window.location.hash = path;
    } else {
      window.history.replaceState(null, '', path);
    }
  }

  /**
   * 处理路由变化
   */
  function handleRouteChange() {
    const hash = window.location.hash || '#/dashboard';
    const path = hash.slice(1); // 移除 #

    const match = matchRoute(hash);
    
    if (match) {
      const oldRoute = currentRoute;
      currentRoute = { path: path, params: match.params };

      try {
        match.handler(match.params);
        
        // 执行后置守卫
        guards.after.forEach(function(guard) {
          guard(currentRoute, oldRoute);
        });

        // 发布路由变更事件
        if (window.EventBus) {
          window.EventBus.emit('route:changed', currentRoute);
        }
      } catch (error) {
        console.error('[Router] 路由处理错误:', path, error);
      }
    } else {
      console.warn('[Router] 未找到路由:', hash);
      // 重定向到默认路由
      navigate('#/dashboard', { replace: true });
    }
  }

  /**
   * 添加路由守卫
   * @param {string} type - 守卫类型：'before' | 'after'
   * @param {Function} guard - 守卫函数
   */
  function addGuard(type, guard) {
    if (guards[type]) {
      guards[type].push(guard);
    }
  }

  /**
   * 获取当前路由
   * @returns {Object} 当前路由信息
   */
  function getCurrentRoute() {
    return currentRoute;
  }

  /**
   * 初始化路由
   */
  function init() {
    // 监听 hash 变化
    window.addEventListener('hashchange', handleRouteChange);
    
    // 处理初始路由
    handleRouteChange();
  }

  // 暴露到全局
  window.Router = {
    register: register,
    registerRoutes: registerRoutes,
    navigate: navigate,
    addGuard: addGuard,
    getCurrentRoute: getCurrentRoute,
    init: init
  };
})();
