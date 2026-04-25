/**
 * 模块配置
 * 定义工作台中的各个功能模块
 */
(function() {
  'use strict';

  /**
   * 模块配置列表
   * 每个模块包含：显示配置、权限配置、内容配置、样式配置、行为配置
   */
  const moduleConfigs = [
    // 示例：开发工具模块
    {
      id: 'dev-tools',
      name: '开发工具',
      icon: 'ri-code-box-line',
      type: 'builtin', // builtin | custom | iframe
      
      display: {
        mode: 'embedded',        // embedded | standalone | modal
        position: 'dashboard',   // dashboard | sidebar | fullscreen
        order: 1,
        visible: true,
        responsive: {
          mobile: 'collapsed',
          tablet: 'full',
          desktop: 'full'
        }
      },
      
      permissions: {
        view: ['admin', 'user', 'guest'],
        edit: ['admin', 'user'],
        delete: ['admin']
      },
      
      content: {
        source: 'local',  // local | remote | mapped
        items: []
      },
      
      style: {
        theme: 'default',
        layout: 'grid'    // grid | list | kanban
      },
      
      behavior: {
        collapsible: true,
        draggable: true,
        resizable: false,
        refreshable: false,
        searchable: true
      }
    }
  ];

  /**
   * 获取所有模块配置
   */
  function getAllModules() {
    return moduleConfigs.slice();
  }

  /**
   * 根据 ID 获取模块配置
   */
  function getModuleById(id) {
    return moduleConfigs.find(function(m) { return m.id === id; });
  }

  /**
   * 添加模块配置
   */
  function addModule(config) {
    if (!config.id) {
      config.id = 'module_' + Date.now();
    }
    moduleConfigs.push(config);
    saveModules();
    return config;
  }

  /**
   * 更新模块配置
   */
  function updateModule(id, updates) {
    const module = getModuleById(id);
    if (module) {
      Object.assign(module, updates);
      saveModules();
      return module;
    }
    return null;
  }

  /**
   * 删除模块配置
   */
  function deleteModule(id) {
    const index = moduleConfigs.findIndex(function(m) { return m.id === id; });
    if (index > -1) {
      moduleConfigs.splice(index, 1);
      saveModules();
      return true;
    }
    return false;
  }

  /**
   * 保存模块配置到状态管理器
   */
  function saveModules() {
    if (window.StateManager) {
      window.StateManager.setState('modules.list', moduleConfigs);
    }
  }

  /**
   * 从状态管理器加载模块配置
   */
  function loadModules() {
    if (window.StateManager) {
      const saved = window.StateManager.getState('modules.list');
      if (saved && saved.length > 0) {
        moduleConfigs.length = 0;
        moduleConfigs.push.apply(moduleConfigs, saved);
      }
    }
  }

  // 初始化时加载配置
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadModules);
  } else {
    loadModules();
  }

  // 暴露到全局
  window.ModuleConfig = {
    getAllModules: getAllModules,
    getModuleById: getModuleById,
    addModule: addModule,
    updateModule: updateModule,
    deleteModule: deleteModule
  };
})();
