/**
 * Input 输入框组件
 * 支持前缀/后缀图标、清除按钮、多种状态和尺寸
 */
(function() {
  'use strict';

  /**
   * 创建 Input 组件
   * @param {Object} config - 配置对象
   * @param {string} config.type - 输入类型 (text/password/email/number/tel/url)
   * @param {string} config.value - 初始值
   * @param {string} config.placeholder - 占位符文本
   * @param {string} config.size - 尺寸 (sm/md/lg)
   * @param {string} config.prefixIcon - 前缀图标类名
   * @param {string} config.suffixIcon - 后缀图标类名
   * @param {boolean} config.clearable - 是否显示清除按钮
   * @param {boolean} config.disabled - 是否禁用
   * @param {boolean} config.readonly - 是否只读
   * @param {boolean} config.error - 是否显示错误状态
   * @param {string} config.errorMessage - 错误提示信息
   * @param {number} config.maxLength - 最大长度
   * @param {Function} config.onInput - 输入事件回调
   * @param {Function} config.onChange - 变更事件回调
   * @param {Function} config.onFocus - 获得焦点回调
   * @param {Function} config.onBlur - 失去焦点回调
   * @param {Function} config.onClear - 清除回调
   * @returns {HTMLElement} Input 容器元素
   */
  function createInput(config) {
    config = config || {};
    
    var type = config.type || 'text';
    var value = config.value || '';
    var placeholder = config.placeholder || '';
    var size = config.size || 'md';
    var prefixIcon = config.prefixIcon;
    var suffixIcon = config.suffixIcon;
    var clearable = config.clearable !== false; // 默认显示清除按钮
    var disabled = config.disabled || false;
    var readonly = config.readonly || false;
    var error = config.error || false;
    var errorMessage = config.errorMessage || '';
    var maxLength = config.maxLength;

    // 创建容器
    var container = document.createElement('div');
    container.className = 'wb-input-wrapper';
    if (size) container.classList.add('wb-input-wrapper--' + size);
    if (disabled) container.classList.add('wb-input-wrapper--disabled');
    if (readonly) container.classList.add('wb-input-wrapper--readonly');
    if (error) container.classList.add('wb-input-wrapper--error');

    // 创建输入框容器
    var inputContainer = document.createElement('div');
    inputContainer.className = 'wb-input-container';

    // 前缀图标
    if (prefixIcon) {
      var prefixEl = document.createElement('i');
      prefixEl.className = 'wb-input-prefix ' + prefixIcon;
      inputContainer.appendChild(prefixEl);
      inputContainer.classList.add('wb-input-container--prefix');
    }

    // 创建输入框
    var input = document.createElement('input');
    input.type = type;
    input.className = 'wb-input';
    input.value = value;
    input.placeholder = placeholder;
    input.disabled = disabled;
    input.readOnly = readonly;
    if (maxLength) input.maxLength = maxLength;

    inputContainer.appendChild(input);

    // 清除按钮
    var clearBtn;
    if (clearable && !disabled && !readonly) {
      clearBtn = document.createElement('i');
      clearBtn.className = 'wb-input-clear ri-close-circle-fill';
      clearBtn.style.display = value ? '' : 'none';
      inputContainer.appendChild(clearBtn);
      inputContainer.classList.add('wb-input-container--clearable');

      // 清除按钮点击事件
      clearBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        input.value = '';
        clearBtn.style.display = 'none';
        input.focus();
        
        if (config.onClear) {
          config.onClear();
        }
        if (config.onChange) {
          config.onChange('');
        }
      });
    }

    // 后缀图标
    if (suffixIcon) {
      var suffixEl = document.createElement('i');
      suffixEl.className = 'wb-input-suffix ' + suffixIcon;
      inputContainer.appendChild(suffixEl);
      inputContainer.classList.add('wb-input-container--suffix');
    }

    container.appendChild(inputContainer);

    // 错误提示
    var errorEl;
    if (error && errorMessage) {
      errorEl = document.createElement('div');
      errorEl.className = 'wb-input-error';
      errorEl.textContent = errorMessage;
      container.appendChild(errorEl);
    }

    // 输入事件
    input.addEventListener('input', function(e) {
      var val = e.target.value;
      
      // 更新清除按钮显示
      if (clearBtn) {
        clearBtn.style.display = val ? '' : 'none';
      }

      if (config.onInput) {
        config.onInput(val, e);
      }
    });

    // 变更事件
    input.addEventListener('change', function(e) {
      if (config.onChange) {
        config.onChange(e.target.value, e);
      }
    });

    // 焦点事件
    input.addEventListener('focus', function(e) {
      container.classList.add('wb-input-wrapper--focused');
      if (config.onFocus) {
        config.onFocus(e);
      }
    });

    input.addEventListener('blur', function(e) {
      container.classList.remove('wb-input-wrapper--focused');
      if (config.onBlur) {
        config.onBlur(e);
      }
    });

    // 暴露方法
    container._input = input;
    container.getValue = function() {
      return input.value;
    };
    container.setValue = function(val) {
      input.value = val;
      if (clearBtn) {
        clearBtn.style.display = val ? '' : 'none';
      }
    };
    container.focus = function() {
      input.focus();
    };
    container.blur = function() {
      input.blur();
    };
    container.setError = function(hasError, message) {
      if (hasError) {
        container.classList.add('wb-input-wrapper--error');
        if (message) {
          if (!errorEl) {
            errorEl = document.createElement('div');
            errorEl.className = 'wb-input-error';
            container.appendChild(errorEl);
          }
          errorEl.textContent = message;
        }
      } else {
        container.classList.remove('wb-input-wrapper--error');
        if (errorEl) {
          errorEl.remove();
          errorEl = null;
        }
      }
    };
    container.setDisabled = function(isDisabled) {
      input.disabled = isDisabled;
      if (isDisabled) {
        container.classList.add('wb-input-wrapper--disabled');
      } else {
        container.classList.remove('wb-input-wrapper--disabled');
      }
    };

    return container;
  }

  /**
   * 创建 Textarea 组件
   * @param {Object} config - 配置对象
   * @returns {HTMLElement} Textarea 容器元素
   */
  function createTextarea(config) {
    config = config || {};
    
    var value = config.value || '';
    var placeholder = config.placeholder || '';
    var rows = config.rows || 3;
    var disabled = config.disabled || false;
    var readonly = config.readonly || false;
    var error = config.error || false;
    var errorMessage = config.errorMessage || '';
    var maxLength = config.maxLength;
    var showCount = config.showCount || false;

    // 创建容器
    var container = document.createElement('div');
    container.className = 'wb-textarea-wrapper';
    if (disabled) container.classList.add('wb-textarea-wrapper--disabled');
    if (readonly) container.classList.add('wb-textarea-wrapper--readonly');
    if (error) container.classList.add('wb-textarea-wrapper--error');

    // 创建文本域
    var textarea = document.createElement('textarea');
    textarea.className = 'wb-textarea';
    textarea.value = value;
    textarea.placeholder = placeholder;
    textarea.rows = rows;
    textarea.disabled = disabled;
    textarea.readOnly = readonly;
    if (maxLength) textarea.maxLength = maxLength;

    container.appendChild(textarea);

    // 字符计数
    var countEl;
    if (showCount && maxLength) {
      countEl = document.createElement('div');
      countEl.className = 'wb-textarea-count';
      countEl.textContent = value.length + ' / ' + maxLength;
      container.appendChild(countEl);
    }

    // 错误提示
    var errorEl;
    if (error && errorMessage) {
      errorEl = document.createElement('div');
      errorEl.className = 'wb-textarea-error';
      errorEl.textContent = errorMessage;
      container.appendChild(errorEl);
    }

    // 输入事件
    textarea.addEventListener('input', function(e) {
      var val = e.target.value;
      
      // 更新字符计数
      if (countEl) {
        countEl.textContent = val.length + ' / ' + maxLength;
      }

      if (config.onInput) {
        config.onInput(val, e);
      }
    });

    // 变更事件
    textarea.addEventListener('change', function(e) {
      if (config.onChange) {
        config.onChange(e.target.value, e);
      }
    });

    // 焦点事件
    textarea.addEventListener('focus', function(e) {
      container.classList.add('wb-textarea-wrapper--focused');
      if (config.onFocus) {
        config.onFocus(e);
      }
    });

    textarea.addEventListener('blur', function(e) {
      container.classList.remove('wb-textarea-wrapper--focused');
      if (config.onBlur) {
        config.onBlur(e);
      }
    });

    // 暴露方法
    container._textarea = textarea;
    container.getValue = function() {
      return textarea.value;
    };
    container.setValue = function(val) {
      textarea.value = val;
      if (countEl) {
        countEl.textContent = val.length + ' / ' + maxLength;
      }
    };
    container.focus = function() {
      textarea.focus();
    };
    container.blur = function() {
      textarea.blur();
    };
    container.setError = function(hasError, message) {
      if (hasError) {
        container.classList.add('wb-textarea-wrapper--error');
        if (message) {
          if (!errorEl) {
            errorEl = document.createElement('div');
            errorEl.className = 'wb-textarea-error';
            container.appendChild(errorEl);
          }
          errorEl.textContent = message;
        }
      } else {
        container.classList.remove('wb-textarea-wrapper--error');
        if (errorEl) {
          errorEl.remove();
          errorEl = null;
        }
      }
    };

    return container;
  }

  // 暴露到全局
  window.WBInput = {
    create: createInput,
    createTextarea: createTextarea
  };

  console.log('✅ Input 组件加载完成');
})();
