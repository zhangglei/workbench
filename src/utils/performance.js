/**
 * 性能优化工具模块
 * 提供防抖、节流、懒加载等性能优化功能
 */
(function() {
  'use strict';

  /**
   * 防抖函数 - 延迟执行，多次触发只执行最后一次
   * @param {Function} func - 要执行的函数
   * @param {number} wait - 延迟时间（毫秒）
   * @param {boolean} immediate - 是否立即执行
   * @returns {Function} 防抖后的函数
   */
  function debounce(func, wait, immediate) {
    var timeout;
    return function() {
      var context = this;
      var args = arguments;
      var later = function() {
        timeout = null;
        if (!immediate) func.apply(context, args);
      };
      var callNow = immediate && !timeout;
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
      if (callNow) func.apply(context, args);
    };
  }

  /**
   * 节流函数 - 限制执行频率
   * @param {Function} func - 要执行的函数
   * @param {number} wait - 间隔时间（毫秒）
   * @returns {Function} 节流后的函数
   */
  function throttle(func, wait) {
    var timeout;
    var previous = 0;
    return function() {
      var context = this;
      var args = arguments;
      var now = Date.now();
      var remaining = wait - (now - previous);
      
      if (remaining <= 0 || remaining > wait) {
        if (timeout) {
          clearTimeout(timeout);
          timeout = null;
        }
        previous = now;
        func.apply(context, args);
      } else if (!timeout) {
        timeout = setTimeout(function() {
          previous = Date.now();
          timeout = null;
          func.apply(context, args);
        }, remaining);
      }
    };
  }

  /**
   * 懒加载图片
   * @param {string} selector - 图片选择器
   * @param {Object} options - 配置选项
   */
  function lazyLoadImages(selector, options) {
    var config = Object.assign({
      rootMargin: '50px',
      threshold: 0.01
    }, options || {});

    if (!('IntersectionObserver' in window)) {
      // 不支持 IntersectionObserver，直接加载所有图片
      var images = document.querySelectorAll(selector);
      images.forEach(function(img) {
        if (img.dataset.src) {
          img.src = img.dataset.src;
        }
      });
      return;
    }

    var observer = new IntersectionObserver(function(entries) {
      entries.forEach(function(entry) {
        if (entry.isIntersecting) {
          var img = entry.target;
          if (img.dataset.src) {
            img.src = img.dataset.src;
            img.removeAttribute('data-src');
            observer.unobserve(img);
          }
        }
      });
    }, config);

    var images = document.querySelectorAll(selector);
    images.forEach(function(img) {
      observer.observe(img);
    });
  }

  /**
   * 虚拟滚动 - 只渲染可见区域的元素
   * @param {Object} config - 配置对象
   */
  function createVirtualScroll(config) {
    var container = config.container;
    var items = config.items || [];
    var itemHeight = config.itemHeight || 50;
    var renderItem = config.renderItem;
    var buffer = config.buffer || 5;

    var scrollContainer = document.createElement('div');
    scrollContainer.style.cssText = 'overflow-y: auto; height: 100%;';
    
    var contentContainer = document.createElement('div');
    contentContainer.style.position = 'relative';
    contentContainer.style.height = (items.length * itemHeight) + 'px';
    
    scrollContainer.appendChild(contentContainer);
    container.appendChild(scrollContainer);

    var visibleItems = [];

    function render() {
      var scrollTop = scrollContainer.scrollTop;
      var containerHeight = scrollContainer.clientHeight;
      
      var startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - buffer);
      var endIndex = Math.min(
        items.length,
        Math.ceil((scrollTop + containerHeight) / itemHeight) + buffer
      );

      // 清空现有元素
      visibleItems.forEach(function(item) {
        if (item.element && item.element.parentNode) {
          item.element.parentNode.removeChild(item.element);
        }
      });
      visibleItems = [];

      // 渲染可见元素
      for (var i = startIndex; i < endIndex; i++) {
        var element = renderItem(items[i], i);
        element.style.position = 'absolute';
        element.style.top = (i * itemHeight) + 'px';
        element.style.width = '100%';
        element.style.height = itemHeight + 'px';
        contentContainer.appendChild(element);
        visibleItems.push({ index: i, element: element });
      }
    }

    scrollContainer.addEventListener('scroll', throttle(render, 16));
    render();

    return {
      update: function(newItems) {
        items = newItems;
        contentContainer.style.height = (items.length * itemHeight) + 'px';
        render();
      },
      destroy: function() {
        if (scrollContainer.parentNode) {
          scrollContainer.parentNode.removeChild(scrollContainer);
        }
      }
    };
  }

  /**
   * 批量处理任务 - 避免长时间阻塞主线程
   * @param {Array} tasks - 任务数组
   * @param {Function} processor - 处理函数
   * @param {number} batchSize - 每批处理数量
   * @returns {Promise} 完成 Promise
   */
  function batchProcess(tasks, processor, batchSize) {
    batchSize = batchSize || 10;
    var index = 0;

    return new Promise(function(resolve, reject) {
      function processBatch() {
        var batch = tasks.slice(index, index + batchSize);
        
        try {
          batch.forEach(function(task, i) {
            processor(task, index + i);
          });
        } catch (error) {
          reject(error);
          return;
        }

        index += batchSize;

        if (index < tasks.length) {
          setTimeout(processBatch, 0);
        } else {
          resolve();
        }
      }

      processBatch();
    });
  }

  /**
   * 缓存函数结果
   * @param {Function} func - 要缓存的函数
   * @param {Function} keyGenerator - 生成缓存键的函数
   * @returns {Function} 带缓存的函数
   */
  function memoize(func, keyGenerator) {
    var cache = {};
    
    return function() {
      var key = keyGenerator ? keyGenerator.apply(this, arguments) : JSON.stringify(arguments);
      
      if (cache.hasOwnProperty(key)) {
        return cache[key];
      }
      
      var result = func.apply(this, arguments);
      cache[key] = result;
      return result;
    };
  }

  /**
   * 性能监控
   */
  var PerformanceMonitor = {
    marks: {},
    
    /**
     * 标记开始时间
     */
    mark: function(name) {
      this.marks[name] = performance.now();
    },
    
    /**
     * 测量耗时
     */
    measure: function(name) {
      if (!this.marks[name]) {
        console.warn('未找到标记:', name);
        return 0;
      }
      var duration = performance.now() - this.marks[name];
      delete this.marks[name];
      return duration;
    },
    
    /**
     * 测量并输出
     */
    measureAndLog: function(name, label) {
      var duration = this.measure(name);
      console.log((label || name) + ':', duration.toFixed(2) + 'ms');
      return duration;
    }
  };

  // 暴露到全局
  window.WBPerformance = {
    debounce: debounce,
    throttle: throttle,
    lazyLoadImages: lazyLoadImages,
    createVirtualScroll: createVirtualScroll,
    batchProcess: batchProcess,
    memoize: memoize,
    monitor: PerformanceMonitor
  };

  console.log('✅ 性能优化工具模块加载完成');
})();
