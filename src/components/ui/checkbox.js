/**
 * Checkbox 复选框组件
 * 支持单项、组合、禁用、只读和半选状态
 */
(function() {
  'use strict';

  /**
   * 创建 Checkbox 组件
   * @param {Object} config - 配置对象
   * @param {string} config.label - 标签文本
   * @param {boolean} config.checked - 是否选中
   * @param {boolean} config.indeterminate - 是否半选
   * @param {boolean} config.disabled - 是否禁用
   * @param {boolean} config.readonly - 是否只读
   * @param {string} config.name - 输入框名称
   * @param {string|number|boolean} config.value - 选中值
   * @param {string} config.size - 尺寸 (sm/md/lg)
   * @param {Function} config.onChange - 变更回调
   * @returns {HTMLElement} Checkbox 容器元素
   */
  function createCheckbox(config) {
    config = config || {};

    var checked = !!config.checked;
    var disabled = !!config.disabled;
    var readonly = !!config.readonly;
    var indeterminate = !!config.indeterminate;
    var size = config.size || 'md';
    var value = config.value;
    var label = config.label || '';

    var container = document.createElement('label');
    container.className = 'wb-checkbox';
    container.classList.add('wb-checkbox--' + size);

    if (checked) container.classList.add('wb-checkbox--checked');
    if (disabled) container.classList.add('wb-checkbox--disabled');
    if (readonly) container.classList.add('wb-checkbox--readonly');
    if (indeterminate) container.classList.add('wb-checkbox--indeterminate');

    var input = document.createElement('input');
    input.type = 'checkbox';
    input.className = 'wb-checkbox__input';
    input.checked = checked;
    input.disabled = disabled;
    if (config.name) input.name = config.name;
    if (value !== undefined) input.value = value;

    var indicator = document.createElement('span');
    indicator.className = 'wb-checkbox__indicator';
    indicator.setAttribute('aria-hidden', 'true');

    var text = document.createElement('span');
    text.className = 'wb-checkbox__label';
    text.textContent = label;

    container.appendChild(input);
    container.appendChild(indicator);
    container.appendChild(text);

    function syncState() {
      container.classList.toggle('wb-checkbox--checked', !!input.checked);
      container.classList.toggle('wb-checkbox--disabled', !!input.disabled);
      container.classList.toggle('wb-checkbox--readonly', !!readonly);
      container.classList.toggle('wb-checkbox--indeterminate', !!input.indeterminate);
      input.setAttribute('aria-checked', input.indeterminate ? 'mixed' : String(!!input.checked));
    }

    function setChecked(nextChecked, silent) {
      input.checked = !!nextChecked;
      input.indeterminate = false;
      syncState();

      if (!silent && config.onChange) {
        config.onChange(input.checked, value, input);
      }
    }

    function setIndeterminate(nextIndeterminate) {
      input.indeterminate = !!nextIndeterminate;
      syncState();
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
        // 只读状态需要阻止用户修改，同时恢复到变更前状态
        input.checked = !input.checked;
        syncState();
        return;
      }

      input.indeterminate = false;
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
      return !!input.checked;
    };
    container.setValue = setChecked;
    container.isChecked = function() {
      return !!input.checked;
    };
    container.setChecked = setChecked;
    container.setIndeterminate = setIndeterminate;
    container.setDisabled = setDisabled;
    container.setReadonly = setReadonly;
    container.getInput = function() {
      return input;
    };
    container._input = input;

    input.indeterminate = indeterminate;
    syncState();

    return container;
  }

  /**
   * 创建 CheckboxGroup 组件
   * @param {Object} config - 配置对象
   * @param {Array} config.options - 选项数组 [{ label, value, disabled, readonly }]
   * @param {Array} config.value - 当前选中值数组
   * @param {string} config.name - 输入框名称
   * @param {string} config.direction - 排列方向 horizontal/vertical
   * @param {string} config.size - 尺寸 (sm/md/lg)
   * @param {boolean} config.disabled - 是否整体禁用
   * @param {boolean} config.readonly - 是否整体只读
   * @param {Function} config.onChange - 变更回调
   * @returns {HTMLElement} CheckboxGroup 容器元素
   */
  function createGroup(config) {
    config = config || {};

    var options = config.options || [];
    var selectedValues = Array.isArray(config.value) ? config.value.slice() : [];
    var disabled = !!config.disabled;
    var readonly = !!config.readonly;
    var size = config.size || 'md';
    var direction = config.direction || 'horizontal';
    var checkboxItems = [];

    var group = document.createElement('div');
    group.className = 'wb-checkbox-group';
    group.classList.add('wb-checkbox-group--' + direction);
    group.classList.add('wb-checkbox-group--' + size);
    if (disabled) group.classList.add('wb-checkbox-group--disabled');
    if (readonly) group.classList.add('wb-checkbox-group--readonly');

    function emitChange(changedValue, checked) {
      if (config.onChange) {
        config.onChange(selectedValues.slice(), changedValue, checked);
      }
    }

    function updateValue(nextValues, silent) {
      selectedValues = Array.isArray(nextValues) ? nextValues.slice() : [];

      checkboxItems.forEach(function(item) {
        item.checkbox.setChecked(selectedValues.indexOf(item.option.value) !== -1, true);
      });

      if (!silent) {
        emitChange(null, null);
      }
    }

    function render() {
      group.innerHTML = '';
      checkboxItems = [];

      options.forEach(function(option) {
        var checkbox = createCheckbox({
          label: option.label,
          value: option.value,
          checked: selectedValues.indexOf(option.value) !== -1,
          disabled: disabled || !!option.disabled,
          readonly: readonly || !!option.readonly,
          size: size,
          name: config.name,
          onChange: function(isChecked, changedValue) {
            var index = selectedValues.indexOf(changedValue);

            if (isChecked && index === -1) {
              selectedValues.push(changedValue);
            } else if (!isChecked && index !== -1) {
              selectedValues.splice(index, 1);
            }

            emitChange(changedValue, isChecked);
          }
        });

        checkboxItems.push({
          option: option,
          checkbox: checkbox
        });

        group.appendChild(checkbox);
      });
    }

    group.getValue = function() {
      return selectedValues.slice();
    };
    group.setValue = updateValue;
    group.setDisabled = function(isDisabled) {
      disabled = !!isDisabled;
      group.classList.toggle('wb-checkbox-group--disabled', disabled);
      render();
    };
    group.setReadonly = function(isReadonly) {
      readonly = !!isReadonly;
      group.classList.toggle('wb-checkbox-group--readonly', readonly);
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

  window.WBCheckbox = {
    create: createCheckbox,
    createGroup: createGroup
  };
})();
