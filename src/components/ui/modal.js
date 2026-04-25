/**
 * Modal 组件 - 模态对话框
 * 支持自定义内容和操作
 */
(function() {
  'use strict';

  let activeModal = null;

  /**
   * 创建模态框
   * @param {Object} options - 模态框配置
   * @returns {Object} 模态框实例
   */
  function createModal(options) {
    options = options || {};
    
    // 创建遮罩层
    const overlay = document.createElement('div');
    overlay.className = 'wb-modal-overlay';
    
    // 创建模态框容器
    const modal = document.createElement('div');
    modal.className = 'wb-modal';
    
    // 添加尺寸类
    const size = options.size || 'md';
    modal.classList.add('wb-modal--' + size);
    
    // 创建头部
    if (options.title || options.closable !== false) {
      const header = document.createElement('div');
      header.className = 'wb-modal__header';
      
      if (options.title) {
        const title = document.createElement('h2');
        title.className = 'wb-modal__title';
        title.textContent = options.title;
        header.appendChild(title);
      }
      
      if (options.closable !== false) {
        const closeBtn = document.createElement('button');
        closeBtn.type = 'button';
        closeBtn.className = 'wb-modal__close';
        closeBtn.innerHTML = '×';
        closeBtn.addEventListener('click', function() {
          instance.close();
        });
        header.appendChild(closeBtn);
      }
      
      modal.appendChild(header);
    }
    
    // 创建内容区
    const content = document.createElement('div');
    content.className = 'wb-modal__content';
    if (options.content) {
      if (typeof options.content === 'string') {
        content.innerHTML = options.content;
      } else if (options.content instanceof HTMLElement) {
        content.appendChild(options.content);
      }
    }
    modal.appendChild(content);
    
    // 创建底部
    if (options.footer || options.confirmText || options.cancelText) {
      const footer = document.createElement('div');
      footer.className = 'wb-modal__footer';
      
      if (options.footer) {
        if (typeof options.footer === 'string') {
          footer.innerHTML = options.footer;
        } else if (options.footer instanceof HTMLElement) {
          footer.appendChild(options.footer);
        }
      } else {
        // 默认按钮
        if (options.cancelText !== false) {
          const cancelBtn = window.WBButton.create({
            text: options.cancelText || '取消',
            variant: 'secondary',
            onClick: function() {
              if (options.onCancel) {
                options.onCancel();
              }
              instance.close();
            }
          });
          footer.appendChild(cancelBtn);
        }
        
        if (options.confirmText !== false) {
          const confirmBtn = window.WBButton.create({
            text: options.confirmText || '确定',
            variant: options.danger ? 'danger' : 'primary',
            onClick: function() {
              if (options.onConfirm) {
                options.onConfirm();
              }
              if (options.closeOnConfirm !== false) {
                instance.close();
              }
            }
          });
          footer.appendChild(confirmBtn);
        }
      }
      
      modal.appendChild(footer);
    }
    
    overlay.appendChild(modal);
    
    // 点击遮罩关闭
    if (options.maskClosable !== false) {
      overlay.addEventListener('click', function(e) {
        if (e.target === overlay) {
          instance.close();
        }
      });
    }
    
    // 实例方法
    const instance = {
      open: function() {
        document.body.appendChild(overlay);
        activeModal = instance;
        
        // 触发动画
        requestAnimationFrame(function() {
          overlay.classList.add('wb-modal-overlay--show');
        });
        
        // 发布事件
        if (window.EventBus) {
          window.EventBus.emit('modal:opened', instance);
        }
      },
      
      close: function() {
        overlay.classList.remove('wb-modal-overlay--show');
        
        setTimeout(function() {
          if (overlay.parentNode) {
            overlay.parentNode.removeChild(overlay);
          }
          activeModal = null;
          
          // 发布事件
          if (window.EventBus) {
            window.EventBus.emit('modal:closed', instance);
          }
        }, 200);
      },
      
      getElement: function() {
        return modal;
      },
      
      getContent: function() {
        return content;
      }
    };
    
    return instance;
  }

  /**
   * 获取当前活动的模态框
   */
  function getActiveModal() {
    return activeModal;
  }

  // 暴露到全局
  window.WBModal = {
    create: createModal,
    getActive: getActiveModal
  };
})();
