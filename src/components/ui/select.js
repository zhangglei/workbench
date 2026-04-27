/**
 * Select 下拉选择组件
 * 支持单选、多选、搜索、分组、键盘导航和虚拟滚动
 */
(function() {
  'use strict';

  /**
   * 生成稳定的选项键
   * @param {string} path - 路径
   * @param {Object} option - 选项对象
   * @returns {string}
   */
  function createOptionKey(path, option) {
    if (option && option.value !== undefined && option.value !== null && option.value !== '') {
      return 'value-' + String(option.value);
    }
    return 'path-' + path;
  }

  /**
   * 规范化选项结构
   * @param {Array} sourceOptions - 原始选项
   * @returns {Array}
   */
  function normalizeOptions(sourceOptions) {
    function walk(list, parentPath) {
      return (Array.isArray(list) ? list : []).map(function(item, index) {
        var path = parentPath ? (parentPath + '-' + index) : String(index);

        if (item && Array.isArray(item.options)) {
          return {
            type: 'group',
            label: item.label || ('分组 ' + (index + 1)),
            key: 'group-' + path,
            options: walk(item.options, path)
          };
        }

        return {
          type: 'option',
          label: item && item.label !== undefined ? String(item.label) : '',
          value: item ? item.value : undefined,
          disabled: !!(item && item.disabled),
          key: createOptionKey(path, item || {}),
          raw: item || {}
        };
      });
    }

    return walk(sourceOptions, '');
  }

  /**
   * 创建 Select 组件
   * @param {Object} config - 配置对象
   * @param {Array} config.options - 选项数组 [{label, value, disabled}] / [{label, options: []}]
   * @param {string|number|Array} config.value - 初始选中值
   * @param {string} config.placeholder - 占位符文本
   * @param {string} config.size - 尺寸 (sm/md/lg)
   * @param {boolean} config.disabled - 是否禁用
   * @param {boolean} config.clearable - 是否可清除
   * @param {boolean} config.searchable - 是否可搜索
   * @param {boolean} config.multiple - 是否多选
   * @param {number} config.virtualThreshold - 启用虚拟滚动的选项数量阈值
   * @param {number} config.itemHeight - 选项高度
   * @param {number} config.groupHeight - 分组标题高度
   * @param {number} config.dropdownHeight - 下拉最大高度
   * @param {Function} config.onChange - 变更回调
   * @param {Function} config.onClear - 清除回调
   * @returns {HTMLElement} Select 容器元素
   */
  function createSelect(config) {
    config = config || {};

    var options = normalizeOptions(config.options || []);
    var multiple = !!config.multiple;
    var value = multiple
      ? (Array.isArray(config.value) ? config.value.slice() : [])
      : config.value;
    var placeholder = config.placeholder || '请选择';
    var size = config.size || 'md';
    var disabled = !!config.disabled;
    var clearable = config.clearable !== false;
    var searchable = !!config.searchable;
    var virtualThreshold = typeof config.virtualThreshold === 'number' ? config.virtualThreshold : 100;
    var itemHeight = typeof config.itemHeight === 'number' ? config.itemHeight : 36;
    var groupHeight = typeof config.groupHeight === 'number' ? config.groupHeight : 32;
    var dropdownHeight = typeof config.dropdownHeight === 'number' ? config.dropdownHeight : 256;
    var maxDisplayCount = typeof config.maxDisplayCount === 'number' ? config.maxDisplayCount : 2;

    var searchQuery = '';
    var highlightedIndex = -1;
    var visibleState = {
      items: [],
      selectableOptions: [],
      itemMeta: [],
      optionCount: 0,
      totalHeight: 0,
      keyMap: {}
    };

    // 创建容器
    var container = document.createElement('div');
    container.className = 'wb-select';
    container.classList.add('wb-select--' + size);
    if (disabled) container.classList.add('wb-select--disabled');
    if (multiple) container.classList.add('wb-select--multiple');

    // 创建选择框
    var selector = document.createElement('div');
    selector.className = 'wb-select-selector';
    container.appendChild(selector);

    // 显示文本
    var displayText = document.createElement('span');
    displayText.className = 'wb-select-text';
    selector.appendChild(displayText);

    // 清除按钮
    var clearBtn;
    if (clearable && !disabled) {
      clearBtn = document.createElement('i');
      clearBtn.className = 'wb-select-clear ri-close-circle-fill';
      clearBtn.style.display = 'none';
      selector.appendChild(clearBtn);

      clearBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        clearValue();
        if (config.onClear) {
          config.onClear();
        }
      });
    }

    // 下拉箭头
    var arrow = document.createElement('i');
    arrow.className = 'wb-select-arrow ri-arrow-down-s-line';
    selector.appendChild(arrow);

    // 下拉面板
    var dropdown = document.createElement('div');
    dropdown.className = 'wb-select-dropdown';
    dropdown.style.display = 'none';
    container.appendChild(dropdown);

    // 搜索框（如果可搜索）
    var searchInput;
    if (searchable) {
      var searchWrap = document.createElement('div');
      searchWrap.className = 'wb-select-search';

      searchInput = document.createElement('input');
      searchInput.type = 'text';
      searchInput.className = 'wb-select-search-input';
      searchInput.placeholder = '搜索...';
      searchWrap.appendChild(searchInput);

      dropdown.appendChild(searchWrap);

      searchInput.addEventListener('input', function(e) {
        searchQuery = e.target.value || '';
        highlightedIndex = -1;
        renderOptions();
      });

      searchInput.addEventListener('click', function(e) {
        e.stopPropagation();
      });
    }

    // 选项列表
    var optionsList = document.createElement('div');
    optionsList.className = 'wb-select-options';
    optionsList.style.maxHeight = dropdownHeight + 'px';
    dropdown.appendChild(optionsList);

    /**
     * 收集所有可选项
     * @param {Array} list - 选项树
     * @param {Array} result - 结果数组
     */
    function collectAllOptions(list, result) {
      (list || []).forEach(function(item) {
        if (!item) return;
        if (item.type === 'group') {
          collectAllOptions(item.options, result);
        } else {
          result.push(item);
        }
      });
    }

    /**
     * 查找选项
     * @param {Array} list - 选项树
     * @param {*} targetValue - 目标值
     * @returns {Object|null}
     */
    function findOptionByValue(list, targetValue) {
      var all = [];
      collectAllOptions(list, all);
      for (var i = 0; i < all.length; i++) {
        if (all[i].value === targetValue) {
          return all[i];
        }
      }
      return null;
    }

    /**
     * 当前值是否已选中
     * @param {Object} option - 选项
     * @returns {boolean}
     */
    function isSelected(option) {
      if (!option) return false;
      if (multiple) {
        return value.indexOf(option.value) !== -1;
      }
      return value === option.value;
    }

    /**
     * 构建可见选项
     * @param {Array} list - 选项树
     * @param {string} query - 搜索关键字
     * @returns {Object}
     */
    function buildVisibleState(list, query) {
      var keyword = String(query || '').trim().toLowerCase();
      var items = [];
      var selectableOptions = [];
      var itemMeta = [];
      var totalHeight = 0;
      var optionCount = 0;
      var keyMap = {};

      function matches(item, groupMatched) {
        if (!keyword) return true;
        if (groupMatched) return true;
        return String(item.label || '').toLowerCase().indexOf(keyword) !== -1;
      }

      function walk(currentList, groupLabel, groupMatched) {
        (currentList || []).forEach(function(item) {
          if (!item) return;

          if (item.type === 'group') {
            var childState = buildVisibleState(item.options, keyword || '');
            var currentGroupMatched = keyword && String(item.label || '').toLowerCase().indexOf(keyword) !== -1;
            var childItems = [];
            var childSelectable = [];

            if (currentGroupMatched) {
              childState = buildVisibleState(item.options, '');
            }

            childItems = childState.items;
            childSelectable = childState.selectableOptions;

            if (childItems.length > 0) {
              items.push({
                type: 'group',
                label: item.label,
                key: item.key
              });
              itemMeta.push({
                key: item.key,
                top: totalHeight,
                height: groupHeight,
                type: 'group'
              });
              totalHeight += groupHeight;

              childItems.forEach(function(childItem) {
                items.push(childItem);
                itemMeta.push({
                  key: childItem.key,
                  top: totalHeight,
                  height: childItem.type === 'group' ? groupHeight : itemHeight,
                  type: childItem.type
                });
                totalHeight += childItem.type === 'group' ? groupHeight : itemHeight;
                if (childItem.type === 'option') {
                  optionCount += 1;
                  selectableOptions.push(childItem);
                  keyMap[childItem.key] = childItem;
                }
              });

              childSelectable.forEach(function(child) {
                keyMap[child.key] = child;
              });
            }

            return;
          }

          if (!matches(item, groupMatched)) {
            return;
          }

          items.push({
            type: 'option',
            key: item.key,
            label: item.label,
            value: item.value,
            disabled: item.disabled,
            raw: item.raw,
            groupLabel: groupLabel || ''
          });
          selectableOptions.push(item);
          keyMap[item.key] = item;
          optionCount += 1;
        });
      }

      walk(list, '', false);

      if (totalHeight === 0) {
        totalHeight = items.reduce(function(sum, item) {
          return sum + (item.type === 'group' ? groupHeight : itemHeight);
        }, 0);
        if (itemMeta.length === 0 && items.length > 0) {
          var currentTop = 0;
          items.forEach(function(item) {
            var currentHeight = item.type === 'group' ? groupHeight : itemHeight;
            itemMeta.push({
              key: item.key,
              top: currentTop,
              height: currentHeight,
              type: item.type
            });
            currentTop += currentHeight;
          });
        }
      }

      return {
        items: items,
        selectableOptions: selectableOptions,
        itemMeta: itemMeta,
        optionCount: optionCount,
        totalHeight: totalHeight,
        keyMap: keyMap
      };
    }

    /**
     * 获取选中的选项对象
     * @returns {Array|Object|null}
     */
    function getSelectedOptions() {
      if (multiple) {
        return value.map(function(itemValue) {
          return findOptionByValue(options, itemValue);
        }).filter(Boolean);
      }
      return findOptionByValue(options, value);
    }

    /**
     * 更新显示文本
     */
    function updateDisplayText() {
      if (multiple) {
        var selected = getSelectedOptions();
        if (!selected.length) {
          displayText.textContent = placeholder;
          displayText.classList.add('wb-select-text--placeholder');
        } else {
          var labels = selected.map(function(item) { return item.label; });
          if (labels.length > maxDisplayCount) {
            displayText.textContent = labels.slice(0, maxDisplayCount).join('、') + ' 等' + labels.length + '项';
          } else {
            displayText.textContent = labels.join('、');
          }
          displayText.classList.remove('wb-select-text--placeholder');
        }

        if (clearBtn) {
          clearBtn.style.display = selected.length ? '' : 'none';
        }
        return;
      }

      var selectedOption = getSelectedOptions();
      if (selectedOption) {
        displayText.textContent = selectedOption.label;
        displayText.classList.remove('wb-select-text--placeholder');
        if (clearBtn) {
          clearBtn.style.display = '';
        }
      } else {
        displayText.textContent = placeholder;
        displayText.classList.add('wb-select-text--placeholder');
        if (clearBtn) {
          clearBtn.style.display = 'none';
        }
      }
    }

    /**
     * 触发变更回调
     * @param {Object|null} changedOption - 发生变化的选项
     */
    function emitChange(changedOption) {
      if (!config.onChange) {
        return;
      }

      if (multiple) {
        config.onChange(value.slice(), getSelectedOptions(), changedOption || null);
      } else {
        config.onChange(value, changedOption || getSelectedOptions() || null);
      }
    }

    /**
     * 清空选择
     * @param {boolean} silent - 是否静默
     */
    function clearValue(silent) {
      value = multiple ? [] : null;
      highlightedIndex = -1;
      updateDisplayText();
      renderOptions();

      if (!silent) {
        emitChange(null);
      }
    }

    /**
     * 滚动高亮项到可见区域
     */
    function ensureHighlightedVisible() {
      if (highlightedIndex < 0 || !visibleState.selectableOptions[highlightedIndex]) {
        return;
      }

      var targetKey = visibleState.selectableOptions[highlightedIndex].key;
      var virtualEnabled = visibleState.optionCount >= virtualThreshold;

      if (virtualEnabled) {
        var targetMeta = null;
        visibleState.itemMeta.forEach(function(meta) {
          if (!targetMeta && meta.key === targetKey) {
            targetMeta = meta;
          }
        });

        if (!targetMeta) {
          return;
        }

        var viewTop = optionsList.scrollTop;
        var viewBottom = viewTop + optionsList.clientHeight;
        if (targetMeta.top < viewTop) {
          optionsList.scrollTop = targetMeta.top;
        } else if (targetMeta.top + targetMeta.height > viewBottom) {
          optionsList.scrollTop = targetMeta.top + targetMeta.height - optionsList.clientHeight;
        }
        return;
      }

      var optionEl = optionsList.querySelector('[data-key="' + targetKey + '"]');
      if (optionEl && optionEl.scrollIntoView) {
        optionEl.scrollIntoView({ block: 'nearest' });
      }
    }

    /**
     * 设置高亮项
     * @param {number} nextIndex - 高亮索引
     */
    function highlightOption(nextIndex) {
      var enabledOptions = visibleState.selectableOptions.filter(function(item) {
        return !item.disabled;
      });

      if (!enabledOptions.length) {
        highlightedIndex = -1;
        renderOptions();
        return;
      }

      if (nextIndex < 0) nextIndex = 0;
      if (nextIndex >= enabledOptions.length) nextIndex = enabledOptions.length - 1;

      var target = enabledOptions[nextIndex];
      var realIndex = visibleState.selectableOptions.findIndex(function(item) {
        return item.key === target.key;
      });

      highlightedIndex = realIndex;
      renderOptions();
      ensureHighlightedVisible();
    }

    /**
     * 选择选项
     * @param {Object} option - 目标选项
     */
    function selectOption(option) {
      if (!option || option.disabled) {
        return;
      }

      if (multiple) {
        var existingIndex = value.indexOf(option.value);
        if (existingIndex === -1) {
          value.push(option.value);
        } else {
          value.splice(existingIndex, 1);
        }

        updateDisplayText();
        renderOptions();
        emitChange(option);
        return;
      }

      value = option.value;
      updateDisplayText();
      renderOptions();
      closeDropdown();
      emitChange(option);
    }

    /**
     * 创建分组节点
     * @param {Object} item - 分组项
     * @returns {HTMLElement}
     */
    function createGroupElement(item) {
      var groupEl = document.createElement('div');
      groupEl.className = 'wb-select-group';
      groupEl.textContent = item.label;
      groupEl.dataset.key = item.key;
      return groupEl;
    }

    /**
     * 创建选项节点
     * @param {Object} item - 选项项
     * @returns {HTMLElement}
     */
    function createOptionElement(item) {
      var optionEl = document.createElement('div');
      optionEl.className = 'wb-select-option';
      optionEl.dataset.key = item.key;

      if (item.disabled) {
        optionEl.classList.add('wb-select-option--disabled');
      }
      if (isSelected(item)) {
        optionEl.classList.add('wb-select-option--selected');
      }
      if (highlightedIndex >= 0 && visibleState.selectableOptions[highlightedIndex] && visibleState.selectableOptions[highlightedIndex].key === item.key) {
        optionEl.classList.add('wb-select-option--highlighted');
      }

      if (multiple) {
        var marker = document.createElement('span');
        marker.className = 'wb-select-option__marker';
        marker.textContent = isSelected(item) ? '✓' : '';
        optionEl.appendChild(marker);
      }

      var labelEl = document.createElement('span');
      labelEl.className = 'wb-select-option__label';
      labelEl.textContent = item.label;
      optionEl.appendChild(labelEl);

      if (!item.disabled) {
        optionEl.addEventListener('click', function(e) {
          e.stopPropagation();
          selectOption(item);
        });

        optionEl.addEventListener('mouseenter', function() {
          var targetIndex = visibleState.selectableOptions.findIndex(function(option) {
            return option.key === item.key;
          });
          if (targetIndex !== -1) {
            highlightedIndex = targetIndex;
            renderOptions();
          }
        });
      }

      return optionEl;
    }

    /**
     * 渲染普通列表
     */
    function renderNormalOptions() {
      optionsList.innerHTML = '';
      optionsList.classList.remove('wb-select-options--virtual');
      optionsList.onscroll = null;

      if (!visibleState.items.length) {
        var emptyEl = document.createElement('div');
        emptyEl.className = 'wb-select-empty';
        emptyEl.textContent = '暂无数据';
        optionsList.appendChild(emptyEl);
        return;
      }

      visibleState.items.forEach(function(item) {
        if (item.type === 'group') {
          optionsList.appendChild(createGroupElement(item));
        } else {
          optionsList.appendChild(createOptionElement(item));
        }
      });
    }

    /**
     * 渲染虚拟滚动列表
     */
    function renderVirtualOptions() {
      optionsList.innerHTML = '';
      optionsList.classList.add('wb-select-options--virtual');

      var spacer = document.createElement('div');
      spacer.className = 'wb-select-options-spacer';
      spacer.style.height = visibleState.totalHeight + 'px';

      var viewport = document.createElement('div');
      viewport.className = 'wb-select-options-viewport';

      optionsList.appendChild(spacer);
      optionsList.appendChild(viewport);

      function findRange() {
        var start = 0;
        var end = visibleState.itemMeta.length - 1;
        var scrollTop = optionsList.scrollTop;
        var buffer = itemHeight * 2;
        var viewTop = scrollTop - buffer;
        var viewBottom = scrollTop + optionsList.clientHeight + buffer;
        var i;

        for (i = 0; i < visibleState.itemMeta.length; i++) {
          if (visibleState.itemMeta[i].top + visibleState.itemMeta[i].height >= viewTop) {
            start = i;
            break;
          }
        }

        for (i = start; i < visibleState.itemMeta.length; i++) {
          if (visibleState.itemMeta[i].top > viewBottom) {
            end = i;
            break;
          }
        }

        return { start: start, end: end };
      }

      function renderViewport() {
        var range = findRange();
        viewport.innerHTML = '';

        if (!visibleState.items.length) {
          return;
        }

        viewport.style.transform = 'translateY(' + visibleState.itemMeta[range.start].top + 'px)';

        for (var i = range.start; i <= range.end && i < visibleState.items.length; i++) {
          var item = visibleState.items[i];
          var node = item.type === 'group'
            ? createGroupElement(item)
            : createOptionElement(item);
          viewport.appendChild(node);
        }
      }

      optionsList.onscroll = renderViewport;
      renderViewport();
    }

    /**
     * 重新渲染选项
     */
    function renderOptions() {
      visibleState = buildVisibleState(options, searchQuery);

      if (!visibleState.selectableOptions.length) {
        highlightedIndex = -1;
      } else if (highlightedIndex >= visibleState.selectableOptions.length) {
        highlightedIndex = visibleState.selectableOptions.length - 1;
      }

      if (visibleState.optionCount >= virtualThreshold) {
        renderVirtualOptions();
      } else {
        renderNormalOptions();
      }
    }

    /**
     * 打开下拉
     */
    function openDropdown() {
      if (disabled) return;

      dropdown.style.display = 'block';
      container.classList.add('wb-select--open');
      renderOptions();

      if (searchable && searchInput) {
        searchInput.focus();
      }

      if (highlightedIndex === -1) {
        var selectedOption = multiple ? null : getSelectedOptions();
        if (selectedOption) {
          highlightedIndex = visibleState.selectableOptions.findIndex(function(item) {
            return item.key === selectedOption.key;
          });
        }
      }

      if (highlightedIndex >= 0) {
        ensureHighlightedVisible();
      }
    }

    /**
     * 关闭下拉
     */
    function closeDropdown() {
      dropdown.style.display = 'none';
      container.classList.remove('wb-select--open');
      highlightedIndex = -1;

      if (searchable && searchInput) {
        searchInput.value = '';
        searchQuery = '';
      }

      renderOptions();
    }

    /**
     * 切换下拉
     */
    function toggleDropdown() {
      if (dropdown.style.display === 'none') {
        openDropdown();
      } else {
        closeDropdown();
      }
    }

    /**
     * 设置值
     * @param {*} newValue - 新值
     * @param {boolean} silent - 是否静默
     */
    function setValue(newValue, silent) {
      if (multiple) {
        value = Array.isArray(newValue) ? newValue.slice() : [];
      } else {
        value = newValue;
      }

      updateDisplayText();
      renderOptions();

      if (!silent) {
        emitChange(null);
      }
    }

    /**
     * 获取值
     * @returns {*}
     */
    function getValue() {
      return multiple ? value.slice() : value;
    }

    /**
     * 设置选项
     * @param {Array} newOptions - 新选项
     */
    function setOptions(newOptions) {
      options = normalizeOptions(newOptions || []);
      renderOptions();
      updateDisplayText();
    }

    /**
     * 设置禁用
     * @param {boolean} isDisabled - 是否禁用
     */
    function setDisabled(isDisabled) {
      disabled = !!isDisabled;
      if (disabled) {
        container.classList.add('wb-select--disabled');
        closeDropdown();
      } else {
        container.classList.remove('wb-select--disabled');
      }
      container.tabIndex = disabled ? -1 : 0;
    }

    // 点击选择框
    selector.addEventListener('click', function() {
      if (disabled) return;
      toggleDropdown();
    });

    // 键盘导航
    container.addEventListener('keydown', function(e) {
      if (disabled) return;

      var enabledOptions = visibleState.selectableOptions.filter(function(item) {
        return !item.disabled;
      });

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          if (dropdown.style.display === 'none') {
            openDropdown();
          } else if (enabledOptions.length) {
            if (highlightedIndex === -1) {
              highlightOption(0);
            } else {
              var currentEnabledIndex = enabledOptions.findIndex(function(item) {
                return visibleState.selectableOptions[highlightedIndex] && item.key === visibleState.selectableOptions[highlightedIndex].key;
              });
              highlightOption(currentEnabledIndex + 1);
            }
          }
          break;

        case 'ArrowUp':
          e.preventDefault();
          if (dropdown.style.display !== 'none' && enabledOptions.length) {
            if (highlightedIndex === -1) {
              highlightOption(enabledOptions.length - 1);
            } else {
              var currentIndex = enabledOptions.findIndex(function(item) {
                return visibleState.selectableOptions[highlightedIndex] && item.key === visibleState.selectableOptions[highlightedIndex].key;
              });
              highlightOption(currentIndex - 1);
            }
          }
          break;

        case 'Enter':
          e.preventDefault();
          if (dropdown.style.display !== 'none' && highlightedIndex >= 0 && visibleState.selectableOptions[highlightedIndex]) {
            selectOption(visibleState.selectableOptions[highlightedIndex]);
          } else {
            openDropdown();
          }
          break;

        case 'Escape':
          e.preventDefault();
          closeDropdown();
          break;
      }
    });

    // 点击外部关闭
    document.addEventListener('click', function(e) {
      if (!container.contains(e.target)) {
        closeDropdown();
      }
    });

    // 初始化
    updateDisplayText();
    renderOptions();

    // 暴露方法
    container.getValue = getValue;
    container.setValue = setValue;
    container.setOptions = setOptions;
    container.setDisabled = setDisabled;
    container.getSelectedOptions = getSelectedOptions;
    container.clear = clearValue;
    container.open = openDropdown;
    container.close = closeDropdown;

    // 使其可聚焦
    container.tabIndex = disabled ? -1 : 0;

    return container;
  }

  // 暴露到全局
  window.WBSelect = {
    create: createSelect
  };

  console.log('✅ Select 组件加载完成');
})();
