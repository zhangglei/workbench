/**
 * Toast 组件 - 消息提示
 * 用于显示操作反馈
 */
(function() {
  'use strict';

  const toastContainer = createContainer();
  const toasts = [];

  /**
   * 创建 Toast 容器
   */
  function createContainer() {
    let container = document.getElementById('wb-toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'wb-toast-container';
      container.className = 'wb-toast-container';
      document.body.appendChild(container);
    }
    return container;
  }

  /**
   * 显示 Toast
   * @param {Object} options - Toast 配置
   * @returns {Object} Toast 实例
   */
  function showToast(options) {
    if (typeof options === 'string') {
      options = { message: options };
    }
    
    options = options || {};
    
    // 创建 Toast 元素
    const toast = document.createElement('div');
    toast.className = 'wb-toast';
    
    // 添加类型类
    const type = options.type || 'info';
    toast.classList.add('wb-toast--' + type);
    
    // 添加图标
    const iconMap = {
      success: 'ri-checkbox-circle-line',
      error: 'ri-error-warning-line',
      warning: 'ri-alert-line',
      info: 'ri-information-line'
    };
    
    if (iconMap[type]) {
      const icon = document.createElement('i');
      icon.className = iconMap[type] + ' wb-toast__icon';
      toast.appendChild(icon);
    }
    
    // 添加消息
    const message = document.createElement('span');
    message.className = 'wb-toast__message';
    message.textContent = options.message || '';
    toast.appendChild(message);
    
    // 添加关闭按钮
    if (options.closable !== false) {
      const closeBtn = document.createElement('button');
      closeBtn.type = 'button';
      closeBtn.className = 'wb-toast__close';
      closeBtn.innerHTML = '×';
      closeBtn.addEventListener('click', function() {
        instance.close();
      });
      toast.appendChild(closeBtn);
    }
    
    // 添加到容器
    toastContainer.appendChild(toast);
    toasts.push(toast);
    
    // 触发动画
    requestAnimationFrame(function() {
      toast.classList.add('wb-toast--show');
    });
    
    // 自动关闭
    const duration = options.duration !== undefined ? options.duration : 3000;
    let timer = null;
    
    if (duration > 0) {
      timer = setTimeout(function() {
        instance.close();
      }, duration);
    }
    
    // 实例方法
    const instance = {
      close: function() {
        if (timer) {
          clearTimeout(timer);
        }
        
        toast.classList.remove('wb-toast--show');
        
        setTimeout(function() {
          if (toast.parentNode) {
            toast.parentNode.removeChild(toast);
          }
          
          const index = toasts.indexOf(toast);
          if (index > -1) {
            toasts.splice(index, 1);
          }
          
          if (options.onClose) {
            options.onClose();
          }
        }, 200);
      },
      
      getElement: function() {
        return toast;
      }
    };
    
    return instance;
  }

  /**
   * 快捷方法
   */
  function success(message, options) {
    return showToast(Object.assign({ message: message, type: 'success' }, options));
  }

  function error(message, options) {
    return showToast(Object.assign({ message: message, type: 'error' }, options));
  }

  function warning(message, options) {
    return showToast(Object.assign({ message: message, type: 'warning' }, options));
  }

  function info(message, options) {
    return showToast(Object.assign({ message: message, type: 'info' }, options));
  }

  /**
   * 清除所有 Toast
   */
  function clearAll() {
    toasts.slice().forEach(function(toast) {
      if (toast.parentNode) {
        toast.parentNode.removeChild(toast);
      }
    });
    toasts.length = 0;
  }

  // 暴露到全局
  window.WBToast = {
    show: showToast,
    success: success,
    error: error,
    warning: warning,
    info: info,
    clearAll: clearAll
  };
})();
