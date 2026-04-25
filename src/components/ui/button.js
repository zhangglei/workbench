/**
 * Button 组件 - 企业级按钮
 * 支持多种尺寸、样式和状态
 */
(function() {
  'use strict';

  /**
   * 创建按钮
   * @param {Object} options - 按钮配置
   * @returns {HTMLElement} 按钮元素
   */
  function createButton(options) {
    options = options || {};
    
    const button = document.createElement('button');
    button.type = options.type || 'button';
    button.className = 'wb-button';
    
    // 添加变体类
    const variant = options.variant || 'primary';
    button.classList.add('wb-button--' + variant);
    
    // 添加尺寸类
    const size = options.size || 'md';
    button.classList.add('wb-button--' + size);
    
    // 添加图标
    if (options.icon) {
      const icon = document.createElement('i');
      icon.className = options.icon;
      button.appendChild(icon);
    }
    
    // 添加文本
    if (options.text) {
      const text = document.createTextNode(options.text);
      button.appendChild(text);
    }
    
    // 禁用状态
    if (options.disabled) {
      button.disabled = true;
    }
    
    // 加载状态
    if (options.loading) {
      button.classList.add('wb-button--loading');
      button.disabled = true;
    }
    
    // 点击事件
    if (options.onClick) {
      button.addEventListener('click', options.onClick);
    }
    
    return button;
  }

  /**
   * 设置按钮加载状态
   */
  function setLoading(button, loading) {
    if (loading) {
      button.classList.add('wb-button--loading');
      button.disabled = true;
    } else {
      button.classList.remove('wb-button--loading');
      button.disabled = false;
    }
  }

  // 暴露到全局
  window.WBButton = {
    create: createButton,
    setLoading: setLoading
  };
})();
