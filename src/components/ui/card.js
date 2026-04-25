/**
 * Card 组件 - 卡片容器
 * 用于展示模块、内容等
 */
(function() {
  'use strict';

  /**
   * 创建卡片
   * @param {Object} options - 卡片配置
   * @returns {HTMLElement} 卡片元素
   */
  function createCard(options) {
    options = options || {};
    
    const card = document.createElement('div');
    card.className = 'wb-card';
    
    // 添加变体类
    if (options.variant) {
      card.classList.add('wb-card--' + options.variant);
    }
    
    // 添加悬停效果
    if (options.hoverable) {
      card.classList.add('wb-card--hoverable');
    }
    
    // 创建头部
    if (options.title || options.actions) {
      const header = document.createElement('div');
      header.className = 'wb-card__header';
      
      if (options.title) {
        const title = document.createElement('h3');
        title.className = 'wb-card__title';
        title.textContent = options.title;
        header.appendChild(title);
      }
      
      if (options.actions) {
        const actions = document.createElement('div');
        actions.className = 'wb-card__actions';
        if (typeof options.actions === 'string') {
          actions.innerHTML = options.actions;
        } else if (options.actions instanceof HTMLElement) {
          actions.appendChild(options.actions);
        }
        header.appendChild(actions);
      }
      
      card.appendChild(header);
    }
    
    // 创建内容区
    if (options.content) {
      const content = document.createElement('div');
      content.className = 'wb-card__content';
      if (typeof options.content === 'string') {
        content.innerHTML = options.content;
      } else if (options.content instanceof HTMLElement) {
        content.appendChild(options.content);
      }
      card.appendChild(content);
    }
    
    // 创建底部
    if (options.footer) {
      const footer = document.createElement('div');
      footer.className = 'wb-card__footer';
      if (typeof options.footer === 'string') {
        footer.innerHTML = options.footer;
      } else if (options.footer instanceof HTMLElement) {
        footer.appendChild(options.footer);
      }
      card.appendChild(footer);
    }
    
    // 点击事件
    if (options.onClick) {
      card.style.cursor = 'pointer';
      card.addEventListener('click', options.onClick);
    }
    
    return card;
  }

  // 暴露到全局
  window.WBCard = {
    create: createCard
  };
})();
