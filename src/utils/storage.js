/**
 * 存储工具模块
 * 提供增强的 localStorage 和 sessionStorage 功能
 */
(function() {
  'use strict';

  /**
   * 存储适配器基类
   */
  function StorageAdapter(storage) {
    this.storage = storage;
  }

  StorageAdapter.prototype = {
    /**
     * 设置数据
     */
    set: function(key, value, options) {
      try {
        var data = {
          value: value,
          timestamp: Date.now()
        };

        // 添加过期时间
        if (options && options.expires) {
          data.expires = Date.now() + options.expires;
        }

        this.storage.setItem(key, JSON.stringify(data));
        return true;
      } catch (error) {
        console.error('存储失败:', error);
        return false;
      }
    },

    /**
     * 获取数据
     */
    get: function(key, defaultValue) {
      try {
        var item = this.storage.getItem(key);
        if (!item) return defaultValue;

        var data = JSON.parse(item);

        // 检查是否过期
        if (data.expires && Date.now() > data.expires) {
          this.remove(key);
          return defaultValue;
        }

        return data.value;
      } catch (error) {
        console.error('读取失败:', error);
        return defaultValue;
      }
    },

    /**
     * 移除数据
     */
    remove: function(key) {
      try {
        this.storage.removeItem(key);
        return true;
      } catch (error) {
        console.error('删除失败:', error);
        return false;
      }
    },

    /**
     * 清空所有数据
     */
    clear: function() {
      try {
        this.storage.clear();
        return true;
      } catch (error) {
        console.error('清空失败:', error);
        return false;
      }
    },

    /**
     * 检查键是否存在
     */
    has: function(key) {
      return this.storage.getItem(key) !== null;
    },

    /**
     * 获取所有键
     */
    keys: function() {
      var keys = [];
      for (var i = 0; i < this.storage.length; i++) {
        keys.push(this.storage.key(i));
      }
      return keys;
    },

    /**
     * 获取存储大小（字节）
     */
    size: function() {
      var size = 0;
      for (var i = 0; i < this.storage.length; i++) {
        var key = this.storage.key(i);
        var value = this.storage.getItem(key);
        size += key.length + value.length;
      }
      return size;
    },

    /**
     * 批量设置
     */
    setMultiple: function(items, options) {
      var success = true;
      for (var key in items) {
        if (items.hasOwnProperty(key)) {
          if (!this.set(key, items[key], options)) {
            success = false;
          }
        }
      }
      return success;
    },

    /**
     * 批量获取
     */
    getMultiple: function(keys, defaultValue) {
      var result = {};
      keys.forEach(function(key) {
        result[key] = this.get(key, defaultValue);
      }, this);
      return result;
    },

    /**
     * 批量删除
     */
    removeMultiple: function(keys) {
      var success = true;
      keys.forEach(function(key) {
        if (!this.remove(key)) {
          success = false;
        }
      }, this);
      return success;
    }
  };

  /**
   * 命名空间存储
   */
  function NamespacedStorage(storage, namespace) {
    this.storage = storage;
    this.namespace = namespace;
    this.prefix = namespace + ':';
  }

  NamespacedStorage.prototype = Object.create(StorageAdapter.prototype);

  NamespacedStorage.prototype._getKey = function(key) {
    return this.prefix + key;
  };

  NamespacedStorage.prototype.set = function(key, value, options) {
    return StorageAdapter.prototype.set.call(this, this._getKey(key), value, options);
  };

  NamespacedStorage.prototype.get = function(key, defaultValue) {
    return StorageAdapter.prototype.get.call(this, this._getKey(key), defaultValue);
  };

  NamespacedStorage.prototype.remove = function(key) {
    return StorageAdapter.prototype.remove.call(this, this._getKey(key));
  };

  NamespacedStorage.prototype.keys = function() {
    var allKeys = StorageAdapter.prototype.keys.call(this);
    var namespaceKeys = [];
    var prefixLength = this.prefix.length;
    
    allKeys.forEach(function(key) {
      if (key.indexOf(this.prefix) === 0) {
        namespaceKeys.push(key.substring(prefixLength));
      }
    }, this);
    
    return namespaceKeys;
  };

  NamespacedStorage.prototype.clear = function() {
    var keys = this.keys();
    return this.removeMultiple(keys);
  };

  /**
   * 缓存管理器
   */
  var CacheManager = {
    storage: new StorageAdapter(localStorage),
    prefix: 'cache:',

    /**
     * 设置缓存
     */
    set: function(key, value, ttl) {
      return this.storage.set(this.prefix + key, value, {
        expires: ttl || 3600000 // 默认 1 小时
      });
    },

    /**
     * 获取缓存
     */
    get: function(key, defaultValue) {
      return this.storage.get(this.prefix + key, defaultValue);
    },

    /**
     * 删除缓存
     */
    remove: function(key) {
      return this.storage.remove(this.prefix + key);
    },

    /**
     * 清空所有缓存
     */
    clear: function() {
      var keys = this.storage.keys();
      keys.forEach(function(key) {
        if (key.indexOf(this.prefix) === 0) {
          this.storage.remove(key);
        }
      }, this);
    },

    /**
     * 记忆化函数（带缓存）
     */
    remember: function(key, ttl, factory) {
      var cached = this.get(key);
      if (cached !== undefined) {
        return Promise.resolve(cached);
      }

      return Promise.resolve(factory()).then(function(value) {
        this.set(key, value, ttl);
        return value;
      }.bind(this));
    }
  };

  // 创建全局实例
  var local = new StorageAdapter(localStorage);
  var session = new StorageAdapter(sessionStorage);

  // 暴露到全局
  window.WBStorage = {
    local: local,
    session: session,
    cache: CacheManager,
    
    /**
     * 创建命名空间存储
     */
    namespace: function(name, useSession) {
      var storage = useSession ? sessionStorage : localStorage;
      return new NamespacedStorage(storage, name);
    },

    /**
     * 检查存储是否可用
     */
    isAvailable: function() {
      try {
        var test = '__storage_test__';
        localStorage.setItem(test, test);
        localStorage.removeItem(test);
        return true;
      } catch (error) {
        return false;
      }
    }
  };

  console.log('✅ 存储工具模块加载完成');
})();
