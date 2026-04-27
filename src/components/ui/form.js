/**
 * Form 表单组件
 * 提供表单容器、布局管理和验证集成
 */
(function() {
  'use strict';

  /**
   * 生成稳定的字段 DOM id，便于 label 关联输入元素。
   */
  function createFieldId(name) {
    return 'wb-form-field-' + (name || 'anonymous') + '-' + Date.now() + '-' + Math.floor(Math.random() * 10000);
  }

  /**
   * 规范化校验触发器配置。
   */
  function normalizeTriggers(trigger) {
    if (Array.isArray(trigger)) {
      return trigger.slice();
    }
    if (typeof trigger === 'string' && trigger) {
      return [trigger];
    }
    return ['blur', 'change'];
  }

  /**
   * 创建 Form 组件
   * @param {Object} config - 配置对象
   * @param {string} config.layout - 布局方式：horizontal / vertical / inline
   * @param {number} config.labelWidth - 标签宽度（水平布局时）
   * @param {string} config.labelAlign - 标签对齐：left / right / center
   * @param {Object} config.rules - 验证规则
   * @param {Object} config.data - 初始表单值
   * @param {boolean} config.disabled - 是否整体禁用
   * @param {string|Array<string>} config.validateTrigger - 默认验证触发时机
   * @param {Function} config.onSubmit - 提交回调
   * @param {Function} config.onReset - 重置回调
   * @param {Function} config.onValidate - 验证回调
   * @returns {HTMLElement} Form 元素
   */
  function createForm(config) {
    config = config || {};

    var layout = config.layout || 'vertical';
    var labelWidth = typeof config.labelWidth === 'number' ? config.labelWidth : 100;
    var labelAlign = config.labelAlign || 'right';
    var rules = config.rules || {};
    var initialFormData = config.data || {};
    var defaultValidateTrigger = normalizeTriggers(config.validateTrigger);
    var formDisabled = !!config.disabled;

    var form = document.createElement('form');
    form.className = 'wb-form wb-form--' + layout;
    form.noValidate = true;

    if (config.className) {
      form.className += ' ' + config.className;
    }
    if (formDisabled) {
      form.classList.add('wb-form--disabled');
    }

    var formItems = [];
    var fieldMap = {};
    var errors = {};

    /**
     * 获取验证规则集合。
     */
    function getValidatorRules() {
      return window.WBValidator && window.WBValidator.rules ? window.WBValidator.rules : {};
    }

    /**
     * 尝试获取组件内部的主输入元素。
     */
    function getPrimaryInput(component) {
      if (!component) {
        return null;
      }

      if (component._input) {
        return component._input;
      }
      if (component._textarea) {
        return component._textarea;
      }
      if (typeof component.getInput === 'function') {
        return component.getInput();
      }
      if (component.tagName === 'INPUT' || component.tagName === 'TEXTAREA' || component.tagName === 'SELECT') {
        return component;
      }
      if (typeof component.querySelector === 'function') {
        return component.querySelector('input, textarea, select');
      }
      return null;
    }

    /**
     * 获取组件内全部可绑定验证事件的输入元素。
     */
    function getFieldInputs(component) {
      if (!component) {
        return [];
      }

      if (component.tagName === 'INPUT' || component.tagName === 'TEXTAREA' || component.tagName === 'SELECT') {
        return [component];
      }

      if (typeof component.querySelectorAll === 'function') {
        return Array.prototype.slice.call(component.querySelectorAll('input, textarea, select'));
      }

      return [];
    }

    /**
     * 读取组件值。
     */
    function getComponentValue(component) {
      if (!component) {
        return undefined;
      }

      if (typeof component.getValue === 'function') {
        return component.getValue();
      }

      if (component.value !== undefined) {
        return component.value;
      }

      var input = getPrimaryInput(component);
      if (!input) {
        return undefined;
      }

      if (input.type === 'checkbox') {
        return !!input.checked;
      }

      if (input.type === 'radio') {
        return input.checked ? input.value : null;
      }

      return input.value;
    }

    /**
     * 写入组件值。
     * 关键分支：优先复用组件自身 setValue，避免破坏内部状态同步逻辑。
     */
    function setComponentValue(component, value, silent) {
      if (!component) {
        return;
      }

      if (typeof component.setValue === 'function') {
        try {
          component.setValue(value, !!silent);
        } catch (err) {
          component.setValue(value);
        }
        return;
      }

      if (component.value !== undefined) {
        component.value = value == null ? '' : value;
        return;
      }

      var input = getPrimaryInput(component);
      if (!input) {
        return;
      }

      if (input.type === 'checkbox') {
        input.checked = !!value;
      } else if (input.type === 'radio') {
        input.checked = input.value === value;
      } else {
        input.value = value == null ? '' : value;
      }
    }

    /**
     * 设置组件禁用状态。
     */
    function setComponentDisabled(component, isDisabled) {
      if (!component) {
        return;
      }

      if (typeof component.setDisabled === 'function') {
        component.setDisabled(isDisabled);
        return;
      }

      var inputs = getFieldInputs(component);
      inputs.forEach(function(input) {
        input.disabled = !!isDisabled;
      });
    }

    /**
     * 判断字段当前是否禁用。
     */
    function isFieldDisabled(fieldData) {
      if (!fieldData) {
        return false;
      }

      if (fieldData.disabled || formDisabled) {
        return true;
      }

      var input = getPrimaryInput(fieldData.component);
      return !!(input && input.disabled);
    }

    /**
     * 渲染字段错误状态。
     */
    function renderFieldError(fieldData, message) {
      if (!fieldData) {
        return;
      }

      var contentEl = fieldData.content;
      var formItem = fieldData.element;
      var hasError = !!message;
      var errorEl = fieldData.errorElement;

      formItem.classList.toggle('wb-form-item--error', hasError);

      if (fieldData.component && typeof fieldData.component.setError === 'function') {
        fieldData.component.setError(hasError, message || '');
      }

      if (hasError) {
        if (!errorEl) {
          errorEl = document.createElement('div');
          errorEl.className = 'wb-form-error';
          contentEl.appendChild(errorEl);
          fieldData.errorElement = errorEl;
        }
        errorEl.textContent = message;
      } else if (errorEl) {
        errorEl.remove();
        fieldData.errorElement = null;
      }
    }

    /**
     * 设置字段错误。
     */
    function setFieldError(fieldName, message) {
      if (!fieldName || !fieldMap[fieldName]) {
        return;
      }

      if (message) {
        errors[fieldName] = message;
      } else {
        delete errors[fieldName];
      }

      renderFieldError(fieldMap[fieldName], message || '');
    }

    /**
     * 清除字段错误。
     */
    function clearFieldError(fieldName) {
      if (!fieldName || !fieldMap[fieldName]) {
        return;
      }

      delete errors[fieldName];
      renderFieldError(fieldMap[fieldName], '');
    }

    /**
     * 获取最新表单值。
     */
    function getFormData() {
      var data = {};

      formItems.forEach(function(item) {
        if (!item.name) {
          return;
        }
        data[item.name] = getComponentValue(item.component);
      });

      return data;
    }

    /**
     * 执行单条规则验证。
     * 这里直接复用 [`WBValidator.rules`](src/utils/validator.js:11) 的规则定义，保证规则口径一致。
     */
    function runRule(ruleName, ruleConfig, value, fieldData) {
      var validatorRules = getValidatorRules();
      var ruleFunc = validatorRules[ruleName];

      if (typeof ruleFunc !== 'function') {
        return true;
      }

      var allValues = getFormData();

      if (ruleName === 'custom') {
        if (typeof ruleConfig === 'function') {
          return validatorRules.custom(value, function(currentValue) {
            return ruleConfig(currentValue, allValues, fieldData);
          });
        }

        if (ruleConfig && typeof ruleConfig === 'object') {
          return validatorRules.custom(value, function(currentValue) {
            var validator = typeof ruleConfig.validator === 'function' ? ruleConfig.validator : ruleConfig.value;
            if (typeof validator !== 'function') {
              return true;
            }
            return validator(currentValue, allValues, fieldData);
          }, ruleConfig.message);
        }

        return true;
      }

      if (ruleName === 'required') {
        if (ruleConfig === true) {
          return validatorRules.required(value);
        }
        if (ruleConfig && typeof ruleConfig === 'object') {
          return validatorRules.required(value, ruleConfig.message);
        }
        return validatorRules.required(value, typeof ruleConfig === 'string' ? ruleConfig : undefined);
      }

      if (ruleName === 'email' || ruleName === 'phone' || ruleName === 'url' || ruleName === 'number' || ruleName === 'integer') {
        if (ruleConfig === true) {
          return ruleFunc(value);
        }
        if (ruleConfig && typeof ruleConfig === 'object') {
          return ruleFunc(value, ruleConfig.message);
        }
        return ruleFunc(value, typeof ruleConfig === 'string' ? ruleConfig : undefined);
      }

      if (ruleName === 'minLength' || ruleName === 'maxLength' || ruleName === 'min' || ruleName === 'max') {
        if (ruleConfig && typeof ruleConfig === 'object') {
          return ruleFunc(value, ruleConfig.value, ruleConfig.message);
        }
        return ruleFunc(value, ruleConfig);
      }

      if (ruleName === 'pattern') {
        if (ruleConfig && typeof ruleConfig === 'object') {
          return validatorRules.pattern(value, ruleConfig.pattern || ruleConfig.value, ruleConfig.message);
        }
        return validatorRules.pattern(value, ruleConfig);
      }

      if (ruleConfig && typeof ruleConfig === 'object') {
        return ruleFunc(value, ruleConfig.value, ruleConfig.message);
      }

      return ruleFunc(value, ruleConfig);
    }

    /**
     * 验证单个字段。
     */
    function validateField(fieldName, silent) {
      var fieldData = fieldMap[fieldName];
      if (!fieldData) {
        return true;
      }

      if (isFieldDisabled(fieldData)) {
        clearFieldError(fieldName);
        return true;
      }

      var fieldRules = rules[fieldName];
      if (!fieldRules) {
        clearFieldError(fieldName);
        return true;
      }

      var value = getComponentValue(fieldData.component);
      var isValid = true;
      var message = '';

      for (var ruleName in fieldRules) {
        if (!fieldRules.hasOwnProperty(ruleName)) {
          continue;
        }

        var result = runRule(ruleName, fieldRules[ruleName], value, fieldData);
        if (result !== true) {
          isValid = false;
          message = result;
          break;
        }
      }

      if (isValid) {
        clearFieldError(fieldName);
      } else if (!silent) {
        setFieldError(fieldName, message);
      } else {
        errors[fieldName] = message;
      }

      return isValid;
    }

    /**
     * 验证所有字段。
     */
    function validate(silent) {
      var isValid = true;
      var nextErrors = {};

      for (var fieldName in rules) {
        if (!rules.hasOwnProperty(fieldName)) {
          continue;
        }

        var fieldValid = validateField(fieldName, true);
        if (!fieldValid) {
          isValid = false;
          nextErrors[fieldName] = errors[fieldName];
        }
      }

      errors = nextErrors;

      formItems.forEach(function(item) {
        if (!item.name) {
          return;
        }
        renderFieldError(item, errors[item.name] || '');
      });

      if (!silent && typeof config.onValidate === 'function') {
        config.onValidate(isValid, getErrors());
      }

      return isValid;
    }

    /**
     * 获取错误集合副本。
     */
    function getErrors() {
      var cloned = {};
      for (var key in errors) {
        if (errors.hasOwnProperty(key)) {
          cloned[key] = errors[key];
        }
      }
      return cloned;
    }

    /**
     * 清除所有错误。
     */
    function clearErrors() {
      errors = {};
      formItems.forEach(function(item) {
        if (item.name) {
          renderFieldError(item, '');
        }
      });
    }

    /**
     * 绑定字段验证事件。
     */
    function bindFieldValidation(fieldData, itemConfig) {
      var fieldName = fieldData.name;
      if (!fieldName || !rules[fieldName]) {
        return;
      }

      var inputs = getFieldInputs(fieldData.component);
      var triggers = normalizeTriggers(itemConfig.validateTrigger || defaultValidateTrigger);

      inputs.forEach(function(input) {
        if (triggers.indexOf('blur') !== -1) {
          input.addEventListener('blur', function() {
            validateField(fieldName);
          });
        }

        if (triggers.indexOf('change') !== -1) {
          input.addEventListener('change', function() {
            validateField(fieldName);
          });
        }

        if (triggers.indexOf('input') !== -1) {
          input.addEventListener('input', function() {
            validateField(fieldName);
          });
        }
      });
    }

    /**
     * 设置字段值。
     */
    function setFieldValue(fieldName, value, silent) {
      var fieldData = fieldMap[fieldName];
      if (!fieldData) {
        return;
      }

      setComponentValue(fieldData.component, value, silent);

      if (!silent && rules[fieldName]) {
        validateField(fieldName);
      }
    }

    /**
     * 获取字段值。
     */
    function getFieldValue(fieldName) {
      var fieldData = fieldMap[fieldName];
      return fieldData ? getComponentValue(fieldData.component) : undefined;
    }

    /**
     * 设置字段禁用状态。
     */
    function setFieldDisabled(fieldName, isDisabled) {
      var fieldData = fieldMap[fieldName];
      if (!fieldData) {
        return;
      }

      fieldData.disabled = !!isDisabled;
      fieldData.element.classList.toggle('wb-form-item--disabled', fieldData.disabled || formDisabled);
      setComponentDisabled(fieldData.component, fieldData.disabled || formDisabled);

      if (fieldData.disabled) {
        clearFieldError(fieldName);
      }
    }

    /**
     * 获取字段配置与引用。
     */
    function getField(fieldName) {
      return fieldMap[fieldName] || null;
    }

    /**
     * 添加表单项
     * @param {Object} itemConfig - 表单项配置
     * @returns {HTMLElement} 表单项元素
     */
    function addItem(itemConfig) {
      itemConfig = itemConfig || {};

      var label = itemConfig.label;
      var name = itemConfig.name;
      var required = !!itemConfig.required;
      var help = itemConfig.help;
      var component = itemConfig.component;
      var extra = itemConfig.extra;
      var disabled = !!itemConfig.disabled;

      if (typeof component === 'function') {
        component = component();
      }

      var formItem = document.createElement('div');
      formItem.className = 'wb-form-item';
      if (required) formItem.classList.add('wb-form-item--required');
      if (disabled || formDisabled) formItem.classList.add('wb-form-item--disabled');
      if (itemConfig.className) formItem.className += ' ' + itemConfig.className;

      var labelEl = null;
      if (label) {
        labelEl = document.createElement('label');
        labelEl.className = 'wb-form-label';
        labelEl.textContent = label;

        if (layout === 'horizontal') {
          labelEl.style.width = labelWidth + 'px';
          labelEl.style.textAlign = labelAlign;
        }

        formItem.appendChild(labelEl);
      }

      var contentEl = document.createElement('div');
      contentEl.className = 'wb-form-content';

      if (component) {
        var input = getPrimaryInput(component);
        if (input) {
          if (name && !input.name) {
            input.name = name;
          }
          if (!input.id) {
            input.id = createFieldId(name);
          }
          if (labelEl) {
            labelEl.setAttribute('for', input.id);
          }
        }

        if ((disabled || formDisabled) && component) {
          setComponentDisabled(component, true);
        }

        contentEl.appendChild(component);
      }

      if (help) {
        var helpEl = document.createElement('div');
        helpEl.className = 'wb-form-help';
        helpEl.textContent = help;
        contentEl.appendChild(helpEl);
      }

      if (extra) {
        var extraEl = document.createElement('div');
        extraEl.className = 'wb-form-extra';
        if (typeof extra === 'string') {
          extraEl.innerHTML = extra;
        } else {
          extraEl.appendChild(extra);
        }
        contentEl.appendChild(extraEl);
      }

      formItem.appendChild(contentEl);
      form.appendChild(formItem);

      var initialValue;
      if (name && Object.prototype.hasOwnProperty.call(initialFormData, name)) {
        initialValue = initialFormData[name];
        setComponentValue(component, initialValue, true);
      } else {
        initialValue = getComponentValue(component);
      }

      var itemData = {
        element: formItem,
        label: labelEl,
        content: contentEl,
        name: name,
        component: component,
        help: help,
        disabled: disabled,
        errorElement: null,
        initialValue: initialValue,
        reset: function() {
          setComponentValue(component, initialValue, true);
          renderFieldError(itemData, '');
        }
      };

      formItems.push(itemData);
      if (name) {
        fieldMap[name] = itemData;
      }

      bindFieldValidation(itemData, itemConfig);
      return formItem;
    }

    /**
     * 添加表单操作按钮
     * @param {Object} actionsConfig - 操作配置
     */
    function addActions(actionsConfig) {
      actionsConfig = actionsConfig || {};

      var submitText = actionsConfig.submitText || '提交';
      var resetText = actionsConfig.resetText || '重置';
      var showReset = actionsConfig.showReset !== false;
      var align = actionsConfig.align || 'left';

      var actionsEl = document.createElement('div');
      actionsEl.className = 'wb-form-actions wb-form-actions--' + align;

      if (layout === 'horizontal' && labelWidth) {
        actionsEl.style.marginLeft = labelWidth + 'px';
      }

      function createFallbackButton(text, type, className) {
        var button = document.createElement('button');
        button.type = type;
        button.textContent = text;
        button.className = className;
        return button;
      }

      if (window.WBButton && typeof window.WBButton.create === 'function') {
        actionsEl.appendChild(window.WBButton.create({
          text: submitText,
          variant: 'primary',
          type: 'submit',
          disabled: formDisabled
        }));

        if (showReset) {
          actionsEl.appendChild(window.WBButton.create({
            text: resetText,
            variant: 'secondary',
            type: 'reset',
            disabled: formDisabled
          }));
        }
      } else {
        actionsEl.appendChild(createFallbackButton(submitText, 'submit', 'wb-button wb-button--primary'));
        if (showReset) {
          actionsEl.appendChild(createFallbackButton(resetText, 'reset', 'wb-button wb-button--secondary'));
        }
      }

      if (Array.isArray(actionsConfig.extraActions)) {
        actionsConfig.extraActions.forEach(function(action) {
          var button;
          if (action instanceof HTMLElement) {
            button = action;
          } else if (window.WBButton && typeof window.WBButton.create === 'function') {
            button = window.WBButton.create({
              text: action.text || '按钮',
              variant: action.variant || 'secondary',
              type: action.type || 'button',
              disabled: !!action.disabled || formDisabled,
              onClick: action.onClick
            });
          } else {
            button = createFallbackButton(action.text || '按钮', action.type || 'button', 'wb-button wb-button--secondary');
            if (typeof action.onClick === 'function') {
              button.addEventListener('click', action.onClick);
            }
          }
          actionsEl.appendChild(button);
        });
      }

      form.appendChild(actionsEl);
      return actionsEl;
    }

    /**
     * 设置表单数据
     * @param {Object} data - 数据对象
     */
    function setFormData(data, silent) {
      data = data || {};

      formItems.forEach(function(item) {
        if (!item.name || !Object.prototype.hasOwnProperty.call(data, item.name)) {
          return;
        }
        setFieldValue(item.name, data[item.name], silent);
      });
    }

    /**
     * 重置表单
     */
    function resetForm() {
      clearErrors();
      formItems.forEach(function(item) {
        if (typeof item.reset === 'function') {
          item.reset();
        }
      });

      if (typeof config.onReset === 'function') {
        config.onReset(getFormData());
      }
    }

    /**
     * 触发表单提交
     */
    function submitForm() {
      var submitEvent = new Event('submit', {
        bubbles: true,
        cancelable: true
      });
      form.dispatchEvent(submitEvent);
    }

    form.addEventListener('submit', function(e) {
      e.preventDefault();

      var isValid = validate();
      if (!isValid) {
        var firstErrorName = Object.keys(errors)[0];
        var firstField = firstErrorName ? fieldMap[firstErrorName] : null;
        var firstInput = firstField ? getPrimaryInput(firstField.component) : null;

        if (firstInput && typeof firstInput.focus === 'function') {
          firstInput.focus();
        }
        return;
      }

      if (typeof config.onSubmit === 'function') {
        config.onSubmit(getFormData(), e);
      }
    });

    form.addEventListener('reset', function(e) {
      e.preventDefault();
      resetForm();
    });

    form.addItem = addItem;
    form.addActions = addActions;
    form.getFormData = getFormData;
    form.setFormData = setFormData;
    form.setFieldValue = setFieldValue;
    form.getFieldValue = getFieldValue;
    form.getField = getField;
    form.setFieldDisabled = setFieldDisabled;
    form.setFieldError = setFieldError;
    form.clearFieldError = clearFieldError;
    form.validate = validate;
    form.validateField = validateField;
    form.getErrors = getErrors;
    form.clearErrors = clearErrors;
    form.resetForm = resetForm;
    form.submitForm = submitForm;
    form.reset = resetForm;
    form.submit = submitForm;
    form._fields = fieldMap;

    return form;
  }

  /**
   * 创建表单项（独立使用）
   * @param {Object} config - 配置对象
   * @returns {HTMLElement} 表单项元素
   */
  function createFormItem(config) {
    config = config || {};

    var label = config.label;
    var required = !!config.required;
    var help = config.help;
    var error = !!config.error;
    var errorMessage = config.errorMessage;
    var content = config.content;
    var extra = config.extra;

    var formItem = document.createElement('div');
    formItem.className = 'wb-form-item';
    if (required) formItem.classList.add('wb-form-item--required');
    if (error) formItem.classList.add('wb-form-item--error');
    if (config.className) formItem.className += ' ' + config.className;

    if (label) {
      var labelEl = document.createElement('label');
      labelEl.className = 'wb-form-label';
      labelEl.textContent = label;
      formItem.appendChild(labelEl);
    }

    var contentEl = document.createElement('div');
    contentEl.className = 'wb-form-content';

    if (content) {
      if (typeof content === 'string') {
        contentEl.innerHTML = content;
      } else {
        contentEl.appendChild(content);
      }
    }

    if (help) {
      var helpEl = document.createElement('div');
      helpEl.className = 'wb-form-help';
      helpEl.textContent = help;
      contentEl.appendChild(helpEl);
    }

    if (extra) {
      var extraEl = document.createElement('div');
      extraEl.className = 'wb-form-extra';
      if (typeof extra === 'string') {
        extraEl.innerHTML = extra;
      } else {
        extraEl.appendChild(extra);
      }
      contentEl.appendChild(extraEl);
    }

    if (error && errorMessage) {
      var errorEl = document.createElement('div');
      errorEl.className = 'wb-form-error';
      errorEl.textContent = errorMessage;
      contentEl.appendChild(errorEl);
    }

    formItem.appendChild(contentEl);
    return formItem;
  }

  // 暴露到全局
  window.WBForm = {
    create: createForm,
    createItem: createFormItem
  };

  console.log('✅ Form 组件加载完成');
})();
