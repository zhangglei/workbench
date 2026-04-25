/**
 * 应用配置
 * 定义应用的全局设置
 */
(function() {
  'use strict';

  const appConfig = {
    // 应用信息
    app: {
      name: '我的工作台',
      version: '2.0.0',
      description: '企业级工作台系统',
      homepage: 'https://workbench.example.com'
    },

    // 功能开关
    features: {
      enableDarkMode: true,
      enableOfflineMode: true,
      enableCloudSync: true,
      enableNotifications: true,
      enableAnalytics: false,
      enableDebugMode: false
    },

    // 默认设置
    defaults: {
      theme: 'default',
      layout: 'default',
      language: 'zh-CN',
      timezone: 'Asia/Shanghai'
    },

    // 存储配置
    storage: {
      prefix: 'workbench_v2_',
      version: '2.0',
      keys: {
        user: 'user',
        theme: 'theme',
        layout: 'layout',
        modules: 'modules',
        settings: 'settings'
      }
    },

    // API 配置
    api: {
      baseURL: '/api',
      timeout: 10000,
      endpoints: {
        auth: '/auth',
        modules: '/modules',
        sync: '/sync',
        upload: '/upload'
      }
    },

    // 性能配置
    performance: {
      enableLazyLoad: true,
      enableCodeSplitting: true,
      enableCaching: true,
      cacheExpiry: 3600000,  // 1小时
      maxCacheSize: 50       // MB
    },

    // 安全配置
    security: {
      enableCSRF: true,
      enableXSS: true,
      sessionTimeout: 1800000,  // 30分钟
      maxLoginAttempts: 5
    },

    // UI 配置
    ui: {
      animationDuration: 200,
      toastDuration: 3000,
      modalCloseDelay: 300,
      debounceDelay: 300
    }
  };

  /**
   * 获取配置值
   * @param {string} path - 配置路径，如 'app.name'
   */
  function getConfig(path) {
    if (!path) return appConfig;
    
    return path.split('.').reduce(function(obj, key) {
      return obj ? obj[key] : undefined;
    }, appConfig);
  }

  /**
   * 设置配置值
   * @param {string} path - 配置路径
   * @param {*} value - 新值
   */
  function setConfig(path, value) {
    const keys = path.split('.');
    const lastKey = keys.pop();
    const target = keys.reduce(function(obj, key) {
      if (!obj[key]) obj[key] = {};
      return obj[key];
    }, appConfig);
    
    if (target) {
      target[lastKey] = value;
    }
  }

  // 暴露到全局
  window.AppConfig = {
    getConfig: getConfig,
    setConfig: setConfig,
    config: appConfig
  };
})();
