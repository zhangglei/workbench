/**
 * 工作台 v2.0 主入口文件
 * 新架构入口，与旧系统并存
 */
(function() {
  'use strict';

  /**
   * 初始化新架构
   */
  function initV2() {
    console.log('[Workbench v2.0] 初始化新架构...');

    // 1. 初始化核心模块
    if (window.EventBus) {
      console.log('[Workbench v2.0] ✓ 事件总线已加载');
    }

    if (window.StateManager) {
      console.log('[Workbench v2.0] ✓ 状态管理器已加载');
      window.StateManager.setState('app.initialized', true);
    }

    if (window.Router) {
      console.log('[Workbench v2.0] ✓ 路由系统已加载');
    }

    // 2. 初始化配置系统
    if (window.AppConfig) {
      console.log('[Workbench v2.0] ✓ 应用配置已加载');
    }

    if (window.ModuleConfig) {
      console.log('[Workbench v2.0] ✓ 模块配置已加载');
    }

    if (window.ThemeConfig) {
      console.log('[Workbench v2.0] ✓ 主题配置已加载');
    }

    // 3. 注册全局事件监听
    registerGlobalEvents();

    // 4. 标记新架构已就绪
    window.WorkbenchV2 = {
      version: '2.0.0',
      ready: true,
      StateManager: window.StateManager,
      EventBus: window.EventBus,
      Router: window.Router,
      AppConfig: window.AppConfig,
      ModuleConfig: window.ModuleConfig,
      ThemeConfig: window.ThemeConfig
    };

    console.log('[Workbench v2.0] ✅ 新架构初始化完成');
    
    // 发布初始化完成事件
    if (window.EventBus) {
      window.EventBus.emit('v2:initialized');
    }
  }

  /**
   * 注册全局事件监听
   */
  function registerGlobalEvents() {
    if (!window.EventBus) return;

    // 监听状态变化
    window.EventBus.on('state:changed', function(data) {
      console.log('[Workbench v2.0] 状态变更:', data.path, data.value);
    });

    // 监听路由变化
    window.EventBus.on('route:changed', function(route) {
      console.log('[Workbench v2.0] 路由变更:', route.path);
    });

    // 监听主题变化
    window.EventBus.on('theme:changed', function(themeId) {
      console.log('[Workbench v2.0] 主题变更:', themeId);
    });
  }

  /**
   * 检查依赖是否加载完成
   */
  function checkDependencies() {
    const required = [
      'EventBus',
      'StateManager',
      'Router',
      'AppConfig',
      'ModuleConfig',
      'ThemeConfig'
    ];

    const missing = required.filter(function(dep) {
      return !window[dep];
    });

    if (missing.length > 0) {
      console.error('[Workbench v2.0] 缺少依赖:', missing.join(', '));
      return false;
    }

    return true;
  }

  /**
   * 启动新架构
   */
  function bootstrap() {
    // 检查依赖
    if (!checkDependencies()) {
      console.error('[Workbench v2.0] 依赖检查失败，无法启动');
      return;
    }

    // 初始化
    initV2();

    // 在控制台显示欢迎信息
    console.log('%c工作台 v2.0', 'color: #2196F3; font-size: 20px; font-weight: bold;');
    console.log('%c新架构已就绪 🚀', 'color: #4CAF50; font-size: 14px;');
    console.log('使用 window.WorkbenchV2 访问新架构 API');
  }

  // 等待 DOM 加载完成后启动
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootstrap);
  } else {
    bootstrap();
  }
})();
