/**
 * Radio 单选框组件
 * 支持单项、组合、禁用和只读状态
 */
(function() {
  'use strict';

  /**
   * 创建 Radio 组件
   * @param {Object} config - 配置对象
   * @param {string} config.label - 标签文本
   * @param {boolean} config.checked - 是否选中
   * @param {boolean} config.disabled - 是否禁用
   * @param {boolean} config.readonly - 是否只读
   * @param {string} config.name - 输入框名称
   * @param {string|number|boolean} config.value - 选中值
   * @param {string} config.size - 尺寸 (sm/md/lg)
   * @param {Function} config.onChange - 变更回调
   * @returns {HTMLElement} Radio 容器元素
   */
  function createRadio(config) {
    config = config || {};

    var checked = !!config.checked;
    var disabled = !!config.disabled;
    var readonly = !!config.readonly;
    var size = config.size || 'md';
    var value = config.value;
    var label = config.label || '';

    var container = document.createElement('label');
    container.className = 'wb-radio';
    container.classList.add('wb-radio--' + size);

    if (checked) container.classList.add('wb-radio--checked');
    if (disabled) container.classList.add('wb-radio--disabled');
    if (readonly) container.classList.add('wb-radio--readonly');

    var input = document.createElement('input');
    input.type = 'radio';
    input.className = 'wb-radio__input';
    input.checked = checked;
    input.disabled = disabled;
    if (config.name) input.name = config.name;
    if (value !== undefined) input.value = value;

    var indicator = document.createElement('span');
    indicator.className = 'wb-radio__indicator';
    indicator.setAttribute('aria-hidden', 'true');

    var text = document.createElement('span');
    text.className = 'wb-radio__label';
    text.textContent = label;

    container.appendChild(input);
    container.appendChild(indicator);
    container.appendChild(text);

    function syncState() {
      container.classList.toggle('wb-radio--checked', !!input.checked);
      container.classList.toggle('wb-radio--disabled', !!input.disabled);
      container.classList.toggle('wb-radio--readonly', !!readonly);
      input.setAttribute('aria-checked', String(!!input.checked));
    }

    function setChecked(nextChecked, silent) {
      input.checked = !!nextChecked;
      syncState();

      if (!silent && config.onChange) {
        config.onChange(input.checked, value, input);
      }
    }

    function setDisabled(isDisabled) {
      input.disabled = !!isDisabled;
      syncState();
    }

    function setReadonly(isReadonly) {
      readonly = !!isReadonly;
      syncState();
    }

    input.addEventListener('change', function() {
      if (readonly) {
        input.checked = !input.checked;
        syncState();
        return;
      }

      syncState();

      if (config.onChange) {
        config.onChange(input.checked, value, input);
      }
    });

    input.addEventListener('click', function(e) {
      if (readonly) {
        e.preventDefault();
      }
    });

    container.getValue = function() {
      return input.checked ? value : null;
    };
    container.setValue = function(nextValue, silent) {
      setChecked(nextValue === value, silent);
    };
    container.isChecked = function() {
      return !!input.checked;
    };
    container.setChecked = setChecked;
    container.setDisabled = setDisabled;
    container.setReadonly = setReadonly;
    container.getInput = function() {
      return input;
    };
    container._input = input;

    syncState();
    return container;
  }

  /**
   * 创建 RadioGroup 组件
   * @param {Object} config - 配置对象
   * @param {Array} config.options - 选项数组 [{ label, value, disabled, readonly }]
   * @param {string|number|boolean} config.value - 当前选中值
   * @param {string} config.name - 输入框名称
   * @param {string} config.direction - 排列方向 horizontal/vertical
   * @param {string} config.size - 尺寸 (sm/md/lg)
   * @param {boolean} config.disabled - 是否整体禁用
   * @param {boolean} config.readonly - 是否整体只读
   * @param {Function} config.onChange - 变更回调
   * @returns {HTMLElement} RadioGroup 容器元素
   */
  function createGroup(config) {
    config = config || {};

    var options = config.options || [];
    var currentValue = config.value;
    var disabled = !!config.disabled;
    var readonly = !!config.readonly;
    var size = config.size || 'md';
    var direction = config.direction || 'horizontal';
    var radioItems = [];
    var groupName = config.name || ('wb-radio-group-' + Date.now() + '-' + Math.floor(Math.random() * 10000));

    var group = document.createElement('div');
    group.className = 'wb-radio-group';
    group.classList.add('wb-radio-group--' + direction);
    group.classList.add('wb-radio-group--' + size);
    if (disabled) group.classList.add('wb-radio-group--disabled');
    if (readonly) group.classList.add('wb-radio-group--readonly');

    function emitChange(changedValue) {
      if (config.onChange) {
        config.onChange(currentValue, changedValue);
      }
    }

    function updateValue(nextValue, silent) {
      currentValue = nextValue;

      radioItems.forEach(function(item) {
        item.radio.setChecked(item.option.value === currentValue, true);
      });

      if (!silent) {
        emitChange(currentValue);
      }
    }

    function render() {
      group.innerHTML = '';
      radioItems = [];

      options.forEach(function(option) {
        var radio = createRadio({
          label: option.label,
          value: option.value,
          checked: option.value === currentValue,
          disabled: disabled || !!option.disabled,
          readonly: readonly || !!option.readonly,
          size: size,
          name: groupName,
          onChange: function(isChecked, changedValue) {
            if (!isChecked) {
              return;
            }

            currentValue = changedValue;
            radioItems.forEach(function(item) {
              item.radio.setChecked(item.option.value === currentValue, true);
            });
            emitChange(changedValue);
          }
        });

        radioItems.push({
          option: option,
          radio: radio
        });

        group.appendChild(radio);
      });
    }

    group.getValue = function() {
      return currentValue;
    };
    group.setValue = updateValue;
    group.setDisabled = function(isDisabled) {
      disabled = !!isDisabled;
      group.classList.toggle('wb-radio-group--disabled', disabled);
      render();
    };
    group.setReadonly = function(isReadonly) {
      readonly = !!isReadonly;
      group.classList.toggle('wb-radio-group--readonly', readonly);
      render();
    };
    group.setOptions = function(nextOptions) {
      options = Array.isArray(nextOptions) ? nextOptions.slice() : [];
      render();
    };
    group.getOptions = function() {
      return options.slice();
    };

    render();
    return group;
  }

  window.WBRadio = {
    create: createRadio,
    createGroup: createGroup
  };
})();
