/**
 * Loading 加载组件
 * 支持局部加载、全屏加载、多种动画样式
 */
(function() {
  'use strict';

  var fullscreenInstance = null;

  /**
   * 创建 Loading 节点
   * @param {Object} options - 加载配置
   * @returns {HTMLElement} 加载元素
   */
  function createLoading(options) {
    options = options || {};

    var text = options.text || '加载中...';
    var type = options.type || 'spinner';
    var fullscreen = options.fullscreen || false;
    var overlay = options.overlay !== false;
    var size = options.size || 'md';

    var loading = document.createElement('div');
    loading.className = 'wb-loading';
    loading.classList.add('wb-loading--' + type);
    loading.classList.add('wb-loading--' + size);
    if (fullscreen) loading.classList.add('wb-loading--fullscreen');
    if (overlay) loading.classList.add('wb-loading--overlay');

    var content = document.createElement('div');
    content.className = 'wb-loading__content';

    var indicator = document.createElement('div');
    indicator.className = 'wb-loading__indicator';

    if (type === 'dots') {
      for (var i = 0; i < 3; i++) {
        var dot = document.createElement('span');
        dot.className = 'wb-loading__dot';
        indicator.appendChild(dot);
      }
    } else if (type === 'bar') {
      var bar = document.createElement('span');
      bar.className = 'wb-loading__bar';
      indicator.appendChild(bar);
    } else {
      var spinner = document.createElement('span');
      spinner.className = 'wb-loading__spinner';
      indicator.appendChild(spinner);
    }

    content.appendChild(indicator);

    if (text !== false) {
      var textEl = document.createElement('div');
      textEl.className = 'wb-loading__text';
      textEl.textContent = text;
      content.appendChild(textEl);
    }

    loading.appendChild(content);

    loading.close = function() {
      if (loading.parentNode) {
        loading.parentNode.removeChild(loading);
      }
      if (fullscreenInstance === loading) {
        fullscreenInstance = null;
      }
    };

    loading.setText = function(nextText) {
      var target = loading.querySelector('.wb-loading__text');
      if (target) target.textContent = nextText;
    };

    return loading;
  }

  /**
   * 显示局部 Loading
   * @param {HTMLElement|string} target - 目标容器或选择器
   * @param {Object} options - 配置
   * @returns {HTMLElement} Loading 实例
   */
  function show(target, options) {
    var container = typeof target === 'string' ? document.querySelector(target) : target;
    if (!container) {
      container = document.body;
    }

    options = options || {};
    var loading = createLoading(options);

    var computedStyle = window.getComputedStyle(container);
    if (computedStyle.position === 'static') {
      container.classList.add('wb-loading-parent--relative');
    }

    container.appendChild(loading);
    return loading;
  }

  /**
   * 显示全屏 Loading
   * @param {Object} options - 配置
   * @returns {HTMLElement} Loading 实例
   */
  function fullscreen(options) {
    if (fullscreenInstance) {
      fullscreenInstance.close();
    }

    options = Object.assign({}, options || {}, {
      fullscreen: true,
      overlay: true
    });

    fullscreenInstance = createLoading(options);
    document.body.appendChild(fullscreenInstance);
    return fullscreenInstance;
  }

  /**
   * 关闭全屏 Loading
   */
  function closeFullscreen() {
    if (fullscreenInstance) {
      fullscreenInstance.close();
    }
  }

  /**
   * 包装 Promise，自动展示/关闭 Loading
   * @param {Promise} promise - Promise 对象
   * @param {HTMLElement|string|Object} targetOrOptions - 目标或配置
   * @param {Object} options - 配置
   * @returns {Promise}
   */
  function withLoading(promise, targetOrOptions, options) {
    var loading;

    if (targetOrOptions instanceof HTMLElement || typeof targetOrOptions === 'string') {
      loading = show(targetOrOptions, options || {});
    } else {
      loading = fullscreen(targetOrOptions || {});
    }

    return Promise.resolve(promise).finally(function() {
      loading.close();
    });
  }

  window.WBLoading = {
    create: createLoading,
    show: show,
    fullscreen: fullscreen,
    closeFullscreen: closeFullscreen,
    withLoading: withLoading
  };
})();
