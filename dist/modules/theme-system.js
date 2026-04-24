/**
 * 主题系统模块
 * 支持多套主题切换：暖橙浅青、暗黑模式、护眼绿、高对比
 */
(function () {
  'use strict';

  var STORAGE_THEME = 'workbench_theme';

  /* 预设主题配置 */
  var THEMES = {
    default: {
      name: '暖橙浅青',
      icon: '🌅',
      colors: {
        '--c-orange': '#FF9A66',
        '--c-cyan': '#66D1FF',
        '--c-orange-dark': '#e8834a',
        '--c-cyan-dark': '#44b8e8',
        '--c-text-title': '#333333',
        '--c-text-body': '#555555',
        '--c-text-muted': '#888888',
        '--c-text-inverse': '#ffffff',
        '--c-card-bg': 'rgba(255, 255, 255, 0.82)',
        '--c-card-border': 'rgba(255, 154, 102, 0.18)',
        '--c-input-bg': 'rgba(255, 255, 255, 0.9)',
        '--c-input-border': 'rgba(255, 154, 102, 0.3)',
        '--c-overlay': 'rgba(0, 0, 0, 0.22)'
      }
    },
    dark: {
      name: '暗黑模式',
      icon: '🌙',
      colors: {
        '--c-orange': '#FF9A66',
        '--c-cyan': '#66D1FF',
        '--c-orange-dark': '#ffb088',
        '--c-cyan-dark': '#88ddff',
        '--c-text-title': '#e2e8f0',
        '--c-text-body': '#cbd5e1',
        '--c-text-muted': '#94a3b8',
        '--c-text-inverse': '#1e293b',
        '--c-card-bg': 'rgba(30, 41, 59, 0.85)',
        '--c-card-border': 'rgba(255, 154, 102, 0.25)',
        '--c-input-bg': 'rgba(51, 65, 85, 0.9)',
        '--c-input-border': 'rgba(255, 154, 102, 0.4)',
        '--c-overlay': 'rgba(0, 0, 0, 0.5)'
      },
      bodyBg: '#0f172a'
    },
    green: {
      name: '护眼绿',
      icon: '🌿',
      colors: {
        '--c-orange': '#6EB56E',
        '--c-cyan': '#4ECDC4',
        '--c-orange-dark': '#5a9d5a',
        '--c-cyan-dark': '#3ab8af',
        '--c-text-title': '#2d3748',
        '--c-text-body': '#4a5568',
        '--c-text-muted': '#718096',
        '--c-text-inverse': '#ffffff',
        '--c-card-bg': 'rgba(245, 250, 245, 0.9)',
        '--c-card-border': 'rgba(110, 181, 110, 0.2)',
        '--c-input-bg': 'rgba(255, 255, 255, 0.95)',
        '--c-input-border': 'rgba(110, 181, 110, 0.35)',
        '--c-overlay': 'rgba(0, 0, 0, 0.18)'
      },
      bodyBg: '#e8f5e8'
    },
    contrast: {
      name: '高对比',
      icon: '⚡',
      colors: {
        '--c-orange': '#FF6B00',
        '--c-cyan': '#00A8E8',
        '--c-orange-dark': '#cc5500',
        '--c-cyan-dark': '#0086ba',
        '--c-text-title': '#000000',
        '--c-text-body': '#1a1a1a',
        '--c-text-muted': '#4a4a4a',
        '--c-text-inverse': '#ffffff',
        '--c-card-bg': 'rgba(255, 255, 255, 0.95)',
        '--c-card-border': 'rgba(0, 0, 0, 0.3)',
        '--c-input-bg': 'rgba(255, 255, 255, 1)',
        '--c-input-border': 'rgba(0, 0, 0, 0.4)',
        '--c-overlay': 'rgba(0, 0, 0, 0.35)'
      },
      bodyBg: '#f0f0f0'
    }
  };

  /**
   * 应用主题
   * @param {string} themeKey - 主题键名
   */
  function applyTheme(themeKey) {
    var theme = THEMES[themeKey];
    if (!theme) {
      console.warn('主题不存在:', themeKey);
      return;
    }

    var root = document.documentElement;
    
    /* 应用 CSS 变量 */
    Object.keys(theme.colors).forEach(function(key) {
      root.style.setProperty(key, theme.colors[key]);
    });

    /* 应用 body 背景色（如果有） */
    if (theme.bodyBg) {
      document.body.style.backgroundColor = theme.bodyBg;
    } else {
      document.body.style.backgroundColor = '';
    }

    /* 保存当前主题 */
    try {
      localStorage.setItem(STORAGE_THEME, themeKey);
    } catch (_) {}

    /* 触发主题变更事件 */
    if (typeof window.CustomEvent === 'function') {
      var event = new CustomEvent('themeChanged', { detail: { theme: themeKey } });
      window.dispatchEvent(event);
    }
  }

  /**
   * 获取当前主题
   * @returns {string} 主题键名
   */
  function getCurrentTheme() {
    try {
      return localStorage.getItem(STORAGE_THEME) || 'default';
    } catch (_) {
      return 'default';
    }
  }

  /**
   * 获取所有主题列表
   * @returns {Array} 主题列表
   */
  function getThemeList() {
    return Object.keys(THEMES).map(function(key) {
      return {
        key: key,
        name: THEMES[key].name,
        icon: THEMES[key].icon
      };
    });
  }

  /**
   * 初始化主题（应用保存的主题）
   */
  function initTheme() {
    var savedTheme = getCurrentTheme();
    applyTheme(savedTheme);
  }

  /* 页面加载时自动初始化 */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initTheme);
  } else {
    initTheme();
  }

  /* 暴露给全局 */
  window.ThemeSystem = {
    themes: THEMES,
    applyTheme: applyTheme,
    getCurrentTheme: getCurrentTheme,
    getThemeList: getThemeList,
    initTheme: initTheme
  };
})();
