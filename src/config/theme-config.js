/**
 * 主题配置
 * 定义应用的视觉主题
 */
(function() {
  'use strict';

  /**
   * 主题配置对象
   */
  const themeConfigs = {
    // 默认主题
    default: {
      id: 'default',
      name: '默认主题',
      colors: {
        primary: '#2196F3',
        primaryHover: '#1976D2',
        secondary: '#FF9800',
        success: '#4CAF50',
        warning: '#FF9800',
        error: '#F44336',
        info: '#2196F3',
        textPrimary: '#212121',
        textSecondary: '#757575',
        bgBase: '#FFFFFF',
        bgSubtle: '#FAFAFA',
        borderLight: '#EEEEEE'
      },
      shadows: {
        sm: '0 1px 2px rgba(0, 0, 0, 0.05)',
        md: '0 4px 6px rgba(0, 0, 0, 0.07)',
        lg: '0 10px 15px rgba(0, 0, 0, 0.1)',
        xl: '0 20px 25px rgba(0, 0, 0, 0.15)'
      },
      radius: {
        xs: '4px',
        sm: '6px',
        md: '8px',
        lg: '12px',
        xl: '16px',
        full: '9999px'
      }
    },

    // 暗色主题
    dark: {
      id: 'dark',
      name: '暗色主题',
      colors: {
        primary: '#64B5F6',
        primaryHover: '#42A5F5',
        secondary: '#FFB74D',
        success: '#66BB6A',
        warning: '#FFA726',
        error: '#EF5350',
        info: '#42A5F5',
        textPrimary: '#E0E0E0',
        textSecondary: '#ADADAD',
        bgBase: '#121212',
        bgSubtle: '#1E1E1E',
        borderLight: '#2D2D2D'
      },
      shadows: {
        sm: '0 1px 2px rgba(0, 0, 0, 0.3)',
        md: '0 4px 6px rgba(0, 0, 0, 0.4)',
        lg: '0 10px 15px rgba(0, 0, 0, 0.5)',
        xl: '0 20px 25px rgba(0, 0, 0, 0.6)'
      },
      radius: {
        xs: '4px',
        sm: '6px',
        md: '8px',
        lg: '12px',
        xl: '16px',
        full: '9999px'
      }
    },

    // 企业主题
    enterprise: {
      id: 'enterprise',
      name: '企业主题',
      colors: {
        primary: '#1E40AF',
        primaryHover: '#1E3A8A',
        secondary: '#059669',
        success: '#10B981',
        warning: '#F59E0B',
        error: '#EF4444',
        info: '#3B82F6',
        textPrimary: '#111827',
        textSecondary: '#4B5563',
        bgBase: '#FFFFFF',
        bgSubtle: '#F9FAFB',
        borderLight: '#E5E7EB'
      },
      shadows: {
        sm: '0 1px 2px rgba(0, 0, 0, 0.05)',
        md: '0 4px 6px rgba(0, 0, 0, 0.07)',
        lg: '0 10px 15px rgba(0, 0, 0, 0.1)',
        xl: '0 20px 25px rgba(0, 0, 0, 0.15)'
      },
      radius: {
        xs: '2px',
        sm: '4px',
        md: '6px',
        lg: '8px',
        xl: '12px',
        full: '9999px'
      }
    }
  };

  let currentTheme = 'default';

  /**
   * 获取所有主题
   */
  function getAllThemes() {
    return Object.keys(themeConfigs).map(function(key) {
      return {
        id: themeConfigs[key].id,
        name: themeConfigs[key].name
      };
    });
  }

  /**
   * 获取当前主题
   */
  function getCurrentTheme() {
    return currentTheme;
  }

  /**
   * 切换主题
   */
  function setTheme(themeId) {
    if (themeConfigs[themeId]) {
      currentTheme = themeId;
      applyTheme(themeConfigs[themeId]);
      
      // 保存到状态管理器
      if (window.StateManager) {
        window.StateManager.setState('theme.current', themeId);
      }
      
      // 发布主题变更事件
      if (window.EventBus) {
        window.EventBus.emit('theme:changed', themeId);
      }
    }
  }

  /**
   * 应用主题
   */
  function applyTheme(theme) {
    const root = document.documentElement;
    
    // 应用颜色变量
    Object.keys(theme.colors).forEach(function(key) {
      root.style.setProperty('--color-' + key, theme.colors[key]);
    });
    
    // 应用阴影变量
    Object.keys(theme.shadows).forEach(function(key) {
      root.style.setProperty('--shadow-' + key, theme.shadows[key]);
    });
    
    // 应用圆角变量
    Object.keys(theme.radius).forEach(function(key) {
      root.style.setProperty('--radius-' + key, theme.radius[key]);
    });
  }

  /**
   * 初始化主题
   */
  function initTheme() {
    // 从状态管理器恢复主题
    if (window.StateManager) {
      const saved = window.StateManager.getState('theme.current');
      if (saved && themeConfigs[saved]) {
        currentTheme = saved;
      }
    }
    
    // 应用主题
    applyTheme(themeConfigs[currentTheme]);
  }

  // 初始化
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initTheme);
  } else {
    initTheme();
  }

  // 暴露到全局
  window.ThemeConfig = {
    getAllThemes: getAllThemes,
    getCurrentTheme: getCurrentTheme,
    setTheme: setTheme
  };
})();
