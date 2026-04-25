/**
 * 动画工具模块
 * 提供常用的动画效果和缓动函数
 */
(function() {
  'use strict';

  /**
   * 缓动函数
   */
  var easings = {
    linear: function(t) { return t; },
    easeInQuad: function(t) { return t * t; },
    easeOutQuad: function(t) { return t * (2 - t); },
    easeInOutQuad: function(t) { return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t; },
    easeInCubic: function(t) { return t * t * t; },
    easeOutCubic: function(t) { return (--t) * t * t + 1; },
    easeInOutCubic: function(t) { return t < 0.5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1; },
    easeInQuart: function(t) { return t * t * t * t; },
    easeOutQuart: function(t) { return 1 - (--t) * t * t * t; },
    easeInOutQuart: function(t) { return t < 0.5 ? 8 * t * t * t * t : 1 - 8 * (--t) * t * t * t; },
    easeInQuint: function(t) { return t * t * t * t * t; },
    easeOutQuint: function(t) { return 1 + (--t) * t * t * t * t; },
    easeInOutQuint: function(t) { return t < 0.5 ? 16 * t * t * t * t * t : 1 + 16 * (--t) * t * t * t * t; }
  };

  /**
   * 动画类
   */
  function Animation(config) {
    this.element = config.element;
    this.from = config.from || {};
    this.to = config.to || {};
    this.duration = config.duration || 300;
    this.easing = easings[config.easing] || easings.easeInOutQuad;
    this.onUpdate = config.onUpdate;
    this.onComplete = config.onComplete;
    this.startTime = null;
    this.rafId = null;
  }

  Animation.prototype = {
    /**
     * 开始动画
     */
    start: function() {
      var self = this;
      this.startTime = performance.now();

      function animate(currentTime) {
        var elapsed = currentTime - self.startTime;
        var progress = Math.min(elapsed / self.duration, 1);
        var easedProgress = self.easing(progress);

        // 更新属性
        for (var prop in self.to) {
          if (self.to.hasOwnProperty(prop)) {
            var from = self.from[prop] || 0;
            var to = self.to[prop];
            var current = from + (to - from) * easedProgress;

            if (self.element) {
              if (prop === 'scrollTop' || prop === 'scrollLeft') {
                self.element[prop] = current;
              } else {
                self.element.style[prop] = current + (typeof to === 'number' ? 'px' : '');
              }
            }

            if (self.onUpdate) {
              self.onUpdate(prop, current, easedProgress);
            }
          }
        }

        if (progress < 1) {
          self.rafId = requestAnimationFrame(animate);
        } else {
          if (self.onComplete) {
            self.onComplete();
          }
        }
      }

      this.rafId = requestAnimationFrame(animate);
      return this;
    },

    /**
     * 停止动画
     */
    stop: function() {
      if (this.rafId) {
        cancelAnimationFrame(this.rafId);
        this.rafId = null;
      }
      return this;
    }
  };

  /**
   * 淡入效果
   */
  function fadeIn(element, duration, callback) {
    element.style.opacity = '0';
    element.style.display = '';

    return new Animation({
      element: element,
      from: { opacity: 0 },
      to: { opacity: 1 },
      duration: duration || 300,
      onUpdate: function(prop, value) {
        element.style.opacity = value;
      },
      onComplete: callback
    }).start();
  }

  /**
   * 淡出效果
   */
  function fadeOut(element, duration, callback) {
    return new Animation({
      element: element,
      from: { opacity: 1 },
      to: { opacity: 0 },
      duration: duration || 300,
      onUpdate: function(prop, value) {
        element.style.opacity = value;
      },
      onComplete: function() {
        element.style.display = 'none';
        if (callback) callback();
      }
    }).start();
  }

  /**
   * 滑入效果
   */
  function slideDown(element, duration, callback) {
    var height = element.scrollHeight;
    element.style.height = '0';
    element.style.overflow = 'hidden';
    element.style.display = '';

    return new Animation({
      element: element,
      from: { height: 0 },
      to: { height: height },
      duration: duration || 300,
      onUpdate: function(prop, value) {
        element.style.height = value + 'px';
      },
      onComplete: function() {
        element.style.height = '';
        element.style.overflow = '';
        if (callback) callback();
      }
    }).start();
  }

  /**
   * 滑出效果
   */
  function slideUp(element, duration, callback) {
    var height = element.scrollHeight;
    element.style.height = height + 'px';
    element.style.overflow = 'hidden';

    return new Animation({
      element: element,
      from: { height: height },
      to: { height: 0 },
      duration: duration || 300,
      onUpdate: function(prop, value) {
        element.style.height = value + 'px';
      },
      onComplete: function() {
        element.style.display = 'none';
        element.style.height = '';
        element.style.overflow = '';
        if (callback) callback();
      }
    }).start();
  }

  /**
   * 平滑滚动
   */
  function smoothScroll(element, to, duration, callback) {
    var from = element.scrollTop;

    return new Animation({
      element: element,
      from: { scrollTop: from },
      to: { scrollTop: to },
      duration: duration || 300,
      onComplete: callback
    }).start();
  }

  /**
   * 数字动画
   */
  function animateNumber(element, from, to, duration, callback) {
    return new Animation({
      from: { value: from },
      to: { value: to },
      duration: duration || 1000,
      onUpdate: function(prop, value) {
        element.textContent = Math.round(value);
      },
      onComplete: callback
    }).start();
  }

  /**
   * 抖动效果
   */
  function shake(element, intensity, duration) {
    intensity = intensity || 10;
    duration = duration || 500;
    
    var originalTransform = element.style.transform;
    var startTime = performance.now();

    function animate(currentTime) {
      var elapsed = currentTime - startTime;
      var progress = elapsed / duration;

      if (progress < 1) {
        var offset = Math.sin(progress * 10 * Math.PI) * intensity * (1 - progress);
        element.style.transform = 'translateX(' + offset + 'px)';
        requestAnimationFrame(animate);
      } else {
        element.style.transform = originalTransform;
      }
    }

    requestAnimationFrame(animate);
  }

  /**
   * 脉冲效果
   */
  function pulse(element, scale, duration) {
    scale = scale || 1.1;
    duration = duration || 300;

    var originalTransform = element.style.transform;

    return new Animation({
      from: { scale: 1 },
      to: { scale: scale },
      duration: duration / 2,
      easing: 'easeInOutQuad',
      onUpdate: function(prop, value) {
        element.style.transform = 'scale(' + value + ')';
      },
      onComplete: function() {
        new Animation({
          from: { scale: scale },
          to: { scale: 1 },
          duration: duration / 2,
          easing: 'easeInOutQuad',
          onUpdate: function(prop, value) {
            element.style.transform = 'scale(' + value + ')';
          },
          onComplete: function() {
            element.style.transform = originalTransform;
          }
        }).start();
      }
    }).start();
  }

  /**
   * 弹跳效果
   */
  function bounce(element, height, duration) {
    height = height || 20;
    duration = duration || 600;

    var originalTransform = element.style.transform;
    var startTime = performance.now();

    function animate(currentTime) {
      var elapsed = currentTime - startTime;
      var progress = elapsed / duration;

      if (progress < 1) {
        var bounceProgress = Math.abs(Math.sin(progress * Math.PI * 2));
        var offset = bounceProgress * height * (1 - progress);
        element.style.transform = 'translateY(-' + offset + 'px)';
        requestAnimationFrame(animate);
      } else {
        element.style.transform = originalTransform;
      }
    }

    requestAnimationFrame(animate);
  }

  // 暴露到全局
  window.WBAnimation = {
    Animation: Animation,
    easings: easings,
    
    // 预设动画
    fadeIn: fadeIn,
    fadeOut: fadeOut,
    slideDown: slideDown,
    slideUp: slideUp,
    smoothScroll: smoothScroll,
    animateNumber: animateNumber,
    shake: shake,
    pulse: pulse,
    bounce: bounce,

    /**
     * 创建自定义动画
     */
    create: function(config) {
      return new Animation(config);
    }
  };

  console.log('✅ 动画工具模块加载完成');
})();
