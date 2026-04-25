/**
 * 事件总线 - 用于模块间通信
 * 实现发布订阅模式
 */
(function() {
  'use strict';

  const events = {};

  /**
   * 订阅事件
   * @param {string} eventName - 事件名称
   * @param {Function} callback - 回调函数
   * @returns {Function} 取消订阅函数
   */
  function on(eventName, callback) {
    if (!events[eventName]) {
      events[eventName] = [];
    }
    events[eventName].push(callback);

    // 返回取消订阅函数
    return function off() {
      const index = events[eventName].indexOf(callback);
      if (index > -1) {
        events[eventName].splice(index, 1);
      }
    };
  }

  /**
   * 订阅一次性事件
   * @param {string} eventName - 事件名称
   * @param {Function} callback - 回调函数
   */
  function once(eventName, callback) {
    const wrapper = function(...args) {
      callback.apply(this, args);
      off();
    };
    const off = on(eventName, wrapper);
  }

  /**
   * 发布事件
   * @param {string} eventName - 事件名称
   * @param {*} data - 事件数据
   */
  function emit(eventName, data) {
    if (!events[eventName]) return;
    
    events[eventName].forEach(function(callback) {
      try {
        callback(data);
      } catch (error) {
        console.error('[EventBus] 事件处理错误:', eventName, error);
      }
    });
  }

  /**
   * 取消所有订阅
   * @param {string} eventName - 事件名称（可选，不传则清空所有）
   */
  function clear(eventName) {
    if (eventName) {
      delete events[eventName];
    } else {
      Object.keys(events).forEach(function(key) {
        delete events[key];
      });
    }
  }

  // 暴露到全局
  window.EventBus = {
    on: on,
    once: once,
    emit: emit,
    clear: clear
  };
})();
