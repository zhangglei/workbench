/**
 * 表单验证工具模块
 * 提供常用的表单验证功能
 */
(function() {
  'use strict';

  /**
   * 验证规则
   */
  var rules = {
    /**
     * 必填验证
     */
    required: function(value, message) {
      if (value === null || value === undefined || value === '') {
        return message || '此字段为必填项';
      }
      return true;
    },

    /**
     * 邮箱验证
     */
    email: function(value, message) {
      if (!value) return true;
      var pattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!pattern.test(value)) {
        return message || '请输入有效的邮箱地址';
      }
      return true;
    },

    /**
     * 手机号验证（中国大陆）
     */
    phone: function(value, message) {
      if (!value) return true;
      var pattern = /^1[3-9]\d{9}$/;
      if (!pattern.test(value)) {
        return message || '请输入有效的手机号码';
      }
      return true;
    },

    /**
     * URL 验证
     */
    url: function(value, message) {
      if (!value) return true;
      var pattern = /^(https?:\/\/)?([\da-z\.-]+)\.([a-z\.]{2,6})([\/\w \.-]*)*\/?$/;
      if (!pattern.test(value)) {
        return message || '请输入有效的 URL';
      }
      return true;
    },

    /**
     * 最小长度验证
     */
    minLength: function(value, length, message) {
      if (!value) return true;
      if (value.length < length) {
        return message || '最少需要 ' + length + ' 个字符';
      }
      return true;
    },

    /**
     * 最大长度验证
     */
    maxLength: function(value, length, message) {
      if (!value) return true;
      if (value.length > length) {
        return message || '最多允许 ' + length + ' 个字符';
      }
      return true;
    },

    /**
     * 数字验证
     */
    number: function(value, message) {
      if (!value) return true;
      if (isNaN(value)) {
        return message || '请输入有效的数字';
      }
      return true;
    },

    /**
     * 整数验证
     */
    integer: function(value, message) {
      if (!value) return true;
      if (!Number.isInteger(Number(value))) {
        return message || '请输入整数';
      }
      return true;
    },

    /**
     * 最小值验证
     */
    min: function(value, min, message) {
      if (!value) return true;
      if (Number(value) < min) {
        return message || '最小值为 ' + min;
      }
      return true;
    },

    /**
     * 最大值验证
     */
    max: function(value, max, message) {
      if (!value) return true;
      if (Number(value) > max) {
        return message || '最大值为 ' + max;
      }
      return true;
    },

    /**
     * 正则表达式验证
     */
    pattern: function(value, pattern, message) {
      if (!value) return true;
      var regex = typeof pattern === 'string' ? new RegExp(pattern) : pattern;
      if (!regex.test(value)) {
        return message || '格式不正确';
      }
      return true;
    },

    /**
     * 自定义验证函数
     */
    custom: function(value, validator, message) {
      var result = validator(value);
      if (result !== true) {
        return message || result || '验证失败';
      }
      return true;
    }
  };

  /**
   * 表单验证器
   */
  function FormValidator(form, config) {
    this.form = typeof form === 'string' ? document.querySelector(form) : form;
    this.config = config || {};
    this.errors = {};
    
    if (this.form) {
      this.bindEvents();
    }
  }

  FormValidator.prototype = {
    /**
     * 绑定事件
     */
    bindEvents: function() {
      var self = this;
      
      // 表单提交验证
      this.form.addEventListener('submit', function(e) {
        if (!self.validateAll()) {
          e.preventDefault();
          self.showErrors();
        }
      });

      // 实时验证
      if (this.config.realtime) {
        var inputs = this.form.querySelectorAll('input, textarea, select');
        inputs.forEach(function(input) {
          input.addEventListener('blur', function() {
            self.validateField(input.name);
            self.showFieldError(input.name);
          });
        });
      }
    },

    /**
     * 验证单个字段
     */
    validateField: function(fieldName) {
      var field = this.form.elements[fieldName];
      if (!field) return true;

      var value = field.value;
      var fieldRules = this.config[fieldName];
      
      if (!fieldRules) return true;

      delete this.errors[fieldName];

      for (var ruleName in fieldRules) {
        if (!fieldRules.hasOwnProperty(ruleName)) continue;
        
        var ruleConfig = fieldRules[ruleName];
        var ruleFunc = rules[ruleName];
        
        if (!ruleFunc) continue;

        var result;
        if (typeof ruleConfig === 'object') {
          result = ruleFunc(value, ruleConfig.value, ruleConfig.message);
        } else {
          result = ruleFunc(value, ruleConfig);
        }

        if (result !== true) {
          this.errors[fieldName] = result;
          return false;
        }
      }

      return true;
    },

    /**
     * 验证所有字段
     */
    validateAll: function() {
      this.errors = {};
      var isValid = true;

      for (var fieldName in this.config) {
        if (!this.config.hasOwnProperty(fieldName)) continue;
        if (!this.validateField(fieldName)) {
          isValid = false;
        }
      }

      return isValid;
    },

    /**
     * 显示字段错误
     */
    showFieldError: function(fieldName) {
      var field = this.form.elements[fieldName];
      if (!field) return;

      var errorElement = field.parentNode.querySelector('.error-message');
      
      if (this.errors[fieldName]) {
        field.classList.add('error');
        
        if (!errorElement) {
          errorElement = document.createElement('div');
          errorElement.className = 'error-message';
          errorElement.style.cssText = 'color: var(--color-danger); font-size: 0.875rem; margin-top: 4px;';
          field.parentNode.appendChild(errorElement);
        }
        
        errorElement.textContent = this.errors[fieldName];
      } else {
        field.classList.remove('error');
        if (errorElement) {
          errorElement.remove();
        }
      }
    },

    /**
     * 显示所有错误
     */
    showErrors: function() {
      for (var fieldName in this.errors) {
        if (this.errors.hasOwnProperty(fieldName)) {
          this.showFieldError(fieldName);
        }
      }

      // 滚动到第一个错误字段
      var firstErrorField = this.form.querySelector('.error');
      if (firstErrorField) {
        firstErrorField.scrollIntoView({ behavior: 'smooth', block: 'center' });
        firstErrorField.focus();
      }
    },

    /**
     * 清除所有错误
     */
    clearErrors: function() {
      this.errors = {};
      var errorElements = this.form.querySelectorAll('.error-message');
      errorElements.forEach(function(el) {
        el.remove();
      });
      
      var errorFields = this.form.querySelectorAll('.error');
      errorFields.forEach(function(field) {
        field.classList.remove('error');
      });
    },

    /**
     * 获取错误信息
     */
    getErrors: function() {
      return this.errors;
    }
  };

  // 暴露到全局
  window.WBValidator = {
    rules: rules,
    FormValidator: FormValidator,
    
    /**
     * 快速验证
     */
    validate: function(value, ruleName, ruleValue, message) {
      var ruleFunc = rules[ruleName];
      if (!ruleFunc) {
        console.warn('未找到验证规则:', ruleName);
        return true;
      }
      return ruleFunc(value, ruleValue, message);
    }
  };

  console.log('✅ 表单验证工具模块加载完成');
})();
