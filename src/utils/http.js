/**
 * HTTP 请求工具模块
 * 提供简化的 HTTP 请求功能，支持拦截器、重试等
 */
(function() {
  'use strict';

  /**
   * HTTP 客户端
   */
  function HttpClient(config) {
    this.config = Object.assign({
      baseURL: '',
      timeout: 30000,
      headers: {},
      withCredentials: false
    }, config || {});

    this.interceptors = {
      request: [],
      response: []
    };
  }

  HttpClient.prototype = {
    /**
     * 发送请求
     */
    request: function(config) {
      var self = this;
      
      // 合并配置
      config = Object.assign({}, this.config, config);
      config.headers = Object.assign({}, this.config.headers, config.headers || {});

      // 构建完整 URL
      var url = config.baseURL ? config.baseURL + config.url : config.url;

      // 应用请求拦截器
      var promise = Promise.resolve(config);
      this.interceptors.request.forEach(function(interceptor) {
        promise = promise.then(interceptor.fulfilled, interceptor.rejected);
      });

      // 发送请求
      promise = promise.then(function(finalConfig) {
        return self._sendRequest(url, finalConfig);
      });

      // 应用响应拦截器
      this.interceptors.response.forEach(function(interceptor) {
        promise = promise.then(interceptor.fulfilled, interceptor.rejected);
      });

      return promise;
    },

    /**
     * 实际发送请求
     */
    _sendRequest: function(url, config) {
      return new Promise(function(resolve, reject) {
        var xhr = new XMLHttpRequest();
        var method = (config.method || 'GET').toUpperCase();

        // 处理查询参数
        if (config.params) {
          var queryString = Object.keys(config.params)
            .map(function(key) {
              return encodeURIComponent(key) + '=' + encodeURIComponent(config.params[key]);
            })
            .join('&');
          url += (url.indexOf('?') === -1 ? '?' : '&') + queryString;
        }

        xhr.open(method, url, true);

        // 设置超时
        if (config.timeout) {
          xhr.timeout = config.timeout;
        }

        // 设置请求头
        for (var header in config.headers) {
          if (config.headers.hasOwnProperty(header)) {
            xhr.setRequestHeader(header, config.headers[header]);
          }
        }

        // 设置凭证
        if (config.withCredentials) {
          xhr.withCredentials = true;
        }

        // 处理响应
        xhr.onload = function() {
          var response = {
            data: xhr.response,
            status: xhr.status,
            statusText: xhr.statusText,
            headers: parseHeaders(xhr.getAllResponseHeaders()),
            config: config,
            request: xhr
          };

          // 尝试解析 JSON
          if (xhr.getResponseHeader('Content-Type') &&
              xhr.getResponseHeader('Content-Type').indexOf('application/json') !== -1) {
            try {
              response.data = JSON.parse(xhr.response);
            } catch (e) {
              // 保持原始响应
            }
          }

          if (xhr.status >= 200 && xhr.status < 300) {
            resolve(response);
          } else {
            reject(createError('Request failed with status ' + xhr.status, config, xhr, response));
          }
        };

        xhr.onerror = function() {
          reject(createError('Network Error', config, xhr));
        };

        xhr.ontimeout = function() {
          reject(createError('Timeout of ' + config.timeout + 'ms exceeded', config, xhr));
        };

        // 发送请求
        var data = config.data;
        if (data && typeof data === 'object' && !(data instanceof FormData)) {
          data = JSON.stringify(data);
          xhr.setRequestHeader('Content-Type', 'application/json');
        }

        xhr.send(data || null);
      });
    },

    /**
     * GET 请求
     */
    get: function(url, config) {
      return this.request(Object.assign({ method: 'GET', url: url }, config || {}));
    },

    /**
     * POST 请求
     */
    post: function(url, data, config) {
      return this.request(Object.assign({ method: 'POST', url: url, data: data }, config || {}));
    },

    /**
     * PUT 请求
     */
    put: function(url, data, config) {
      return this.request(Object.assign({ method: 'PUT', url: url, data: data }, config || {}));
    },

    /**
     * DELETE 请求
     */
    delete: function(url, config) {
      return this.request(Object.assign({ method: 'DELETE', url: url }, config || {}));
    },

    /**
     * PATCH 请求
     */
    patch: function(url, data, config) {
      return this.request(Object.assign({ method: 'PATCH', url: url, data: data }, config || {}));
    }
  };

  /**
   * 解析响应头
   */
  function parseHeaders(headerStr) {
    var headers = {};
    if (!headerStr) return headers;

    headerStr.split('\r\n').forEach(function(line) {
      var parts = line.split(': ');
      var key = parts[0];
      var value = parts[1];
      if (key) {
        headers[key.toLowerCase()] = value;
      }
    });

    return headers;
  }

  /**
   * 创建错误对象
   */
  function createError(message, config, request, response) {
    var error = new Error(message);
    error.config = config;
    error.request = request;
    error.response = response;
    return error;
  }

  /**
   * 请求重试包装器
   */
  function withRetry(httpClient, retries, delay) {
    retries = retries || 3;
    delay = delay || 1000;

    return {
      request: function(config) {
        var attempt = 0;

        function tryRequest() {
          return httpClient.request(config).catch(function(error) {
            attempt++;
            if (attempt < retries) {
              return new Promise(function(resolve) {
                setTimeout(function() {
                  resolve(tryRequest());
                }, delay * attempt);
              });
            }
            throw error;
          });
        }

        return tryRequest();
      }
    };
  }

  /**
   * 并发请求控制
   */
  function createConcurrencyManager(limit) {
    var queue = [];
    var running = 0;

    function run() {
      if (running >= limit || queue.length === 0) return;

      running++;
      var task = queue.shift();

      task.fn().then(task.resolve, task.reject).finally(function() {
        running--;
        run();
      });
    }

    return function(fn) {
      return new Promise(function(resolve, reject) {
        queue.push({ fn: fn, resolve: resolve, reject: reject });
        run();
      });
    };
  }

  // 创建默认实例
  var defaultClient = new HttpClient();

  // 暴露到全局
  window.WBHttp = {
    HttpClient: HttpClient,
    
    // 默认实例方法
    request: defaultClient.request.bind(defaultClient),
    get: defaultClient.get.bind(defaultClient),
    post: defaultClient.post.bind(defaultClient),
    put: defaultClient.put.bind(defaultClient),
    delete: defaultClient.delete.bind(defaultClient),
    patch: defaultClient.patch.bind(defaultClient),

    // 工具方法
    withRetry: withRetry,
    createConcurrencyManager: createConcurrencyManager,

    /**
     * 创建新实例
     */
    create: function(config) {
      return new HttpClient(config);
    },

    /**
     * 添加请求拦截器
     */
    addRequestInterceptor: function(fulfilled, rejected) {
      defaultClient.interceptors.request.push({
        fulfilled: fulfilled,
        rejected: rejected
      });
    },

    /**
     * 添加响应拦截器
     */
    addResponseInterceptor: function(fulfilled, rejected) {
      defaultClient.interceptors.response.push({
        fulfilled: fulfilled,
        rejected: rejected
      });
    }
  };

  console.log('✅ HTTP 请求工具模块加载完成');
})();
