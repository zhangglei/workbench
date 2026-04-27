/**
 * DatePicker 日期选择组件
 * 支持单日期、日期范围、快捷选择和格式化显示
 */
(function() {
  'use strict';

  var DATE_WEEK_LABELS = ['日', '一', '二', '三', '四', '五', '六'];

  function pad2(n) {
    return String(n).padStart(2, '0');
  }

  function createDate(year, month, date) {
    return new Date(year, month, date, 0, 0, 0, 0);
  }

  function cloneDate(date) {
    return date ? createDate(date.getFullYear(), date.getMonth(), date.getDate()) : null;
  }

  function parseDateValue(value) {
    if (!value || typeof value !== 'string') {
      return null;
    }

    var match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) {
      return null;
    }

    var year = parseInt(match[1], 10);
    var month = parseInt(match[2], 10) - 1;
    var day = parseInt(match[3], 10);
    var date = createDate(year, month, day);

    if (date.getFullYear() !== year || date.getMonth() !== month || date.getDate() !== day) {
      return null;
    }

    return date;
  }

  function formatDateValue(date, format) {
    if (!date) {
      return '';
    }

    var tokens = {
      YYYY: String(date.getFullYear()),
      MM: pad2(date.getMonth() + 1),
      DD: pad2(date.getDate())
    };

    return (format || 'YYYY-MM-DD')
      .replace(/YYYY/g, tokens.YYYY)
      .replace(/MM/g, tokens.MM)
      .replace(/DD/g, tokens.DD);
  }

  function getMonthStart(date) {
    return createDate(date.getFullYear(), date.getMonth(), 1);
  }

  function getMonthEnd(date) {
    return createDate(date.getFullYear(), date.getMonth() + 1, 0);
  }

  function getMonthDays(date) {
    var firstDay = getMonthStart(date);
    var firstWeekDay = firstDay.getDay();
    var monthEnd = getMonthEnd(date);
    var totalDays = monthEnd.getDate();
    var days = [];
    var i;

    for (i = 0; i < firstWeekDay; i++) {
      days.push(null);
    }

    for (i = 1; i <= totalDays; i++) {
      days.push(createDate(date.getFullYear(), date.getMonth(), i));
    }

    while (days.length % 7 !== 0) {
      days.push(null);
    }

    return days;
  }

  function getWeekRange(date) {
    var current = cloneDate(date || new Date());
    var start = cloneDate(current);
    var end = cloneDate(current);
    var day = current.getDay();

    start.setDate(current.getDate() - day);
    end.setDate(start.getDate() + 6);

    return {
      start: cloneDate(start),
      end: cloneDate(end)
    };
  }

  function getMonthRange(date) {
    var current = cloneDate(date || new Date());
    return {
      start: getMonthStart(current),
      end: getMonthEnd(current)
    };
  }

  function isSameDate(dateA, dateB) {
    return !!dateA && !!dateB &&
      dateA.getFullYear() === dateB.getFullYear() &&
      dateA.getMonth() === dateB.getMonth() &&
      dateA.getDate() === dateB.getDate();
  }

  function isBeforeDate(dateA, dateB) {
    return !!dateA && !!dateB && dateA.getTime() < dateB.getTime();
  }

  function isAfterDate(dateA, dateB) {
    return !!dateA && !!dateB && dateA.getTime() > dateB.getTime();
  }

  function isDateInRange(date, start, end) {
    if (!date || !start || !end) {
      return false;
    }

    var time = date.getTime();
    return time >= start.getTime() && time <= end.getTime();
  }

  /**
   * 创建 DatePicker 组件
   * @param {Object} config - 配置对象
   * @param {boolean} config.range - 是否范围选择
   * @param {string} config.value - 单日期值 YYYY-MM-DD
   * @param {Object|Array} config.valueRange - 范围值 {start, end} 或 [start, end]
   * @param {string} config.placeholder - 占位文本
   * @param {string} config.rangeSeparator - 范围分隔符
   * @param {string} config.format - 展示格式
   * @param {boolean} config.clearable - 是否显示清除按钮
   * @param {boolean} config.disabled - 是否禁用
   * @param {boolean} config.readonly - 是否只读
   * @param {boolean} config.showShortcuts - 是否显示快捷操作
   * @param {string} config.size - 尺寸 sm/md/lg
   * @param {Function} config.onChange - 值变化回调
   * @returns {HTMLElement} DatePicker 容器元素
   */
  function createDatePicker(config) {
    config = config || {};

    var isRange = !!config.range;
    var placeholder = config.placeholder || (isRange ? '请选择日期范围' : '请选择日期');
    var format = config.format || 'YYYY-MM-DD';
    var rangeSeparator = config.rangeSeparator || ' 至 ';
    var clearable = config.clearable !== false;
    var disabled = !!config.disabled;
    var readonly = !!config.readonly;
    var showShortcuts = config.showShortcuts !== false;
    var size = config.size || 'md';
    var isOpen = false;
    var selectingRange = false;

    var selectedStart = null;
    var selectedEnd = null;

    if (isRange) {
      if (Array.isArray(config.valueRange)) {
        selectedStart = parseDateValue(config.valueRange[0]);
        selectedEnd = parseDateValue(config.valueRange[1]);
      } else if (config.valueRange && typeof config.valueRange === 'object') {
        selectedStart = parseDateValue(config.valueRange.start);
        selectedEnd = parseDateValue(config.valueRange.end);
      }
    } else {
      selectedStart = parseDateValue(config.value);
    }

    var panelMonth = cloneDate(selectedStart || new Date());
    panelMonth = getMonthStart(panelMonth);

    var container = document.createElement('div');
    container.className = 'wb-datepicker';
    container.classList.add('wb-datepicker--' + size);
    if (disabled) container.classList.add('wb-datepicker--disabled');
    if (readonly) container.classList.add('wb-datepicker--readonly');

    var trigger = document.createElement('button');
    trigger.type = 'button';
    trigger.className = 'wb-datepicker__trigger';
    trigger.disabled = disabled;

    var text = document.createElement('span');
    text.className = 'wb-datepicker__text';

    var actions = document.createElement('span');
    actions.className = 'wb-datepicker__actions';

    var clearBtn = document.createElement('button');
    clearBtn.type = 'button';
    clearBtn.className = 'wb-datepicker__clear';
    clearBtn.setAttribute('aria-label', '清除日期');
    clearBtn.innerHTML = '&times;';

    var icon = document.createElement('span');
    icon.className = 'wb-datepicker__icon';
    icon.innerHTML = '&#128197;';

    actions.appendChild(clearBtn);
    actions.appendChild(icon);
    trigger.appendChild(text);
    trigger.appendChild(actions);
    container.appendChild(trigger);

    var panel = document.createElement('div');
    panel.className = 'wb-datepicker__panel';
    panel.style.display = 'none';
    container.appendChild(panel);

    var header = document.createElement('div');
    header.className = 'wb-datepicker__header';

    var prevBtn = document.createElement('button');
    prevBtn.type = 'button';
    prevBtn.className = 'wb-datepicker__nav wb-datepicker__nav--prev';
    prevBtn.innerHTML = '&#8249;';

    var title = document.createElement('div');
    title.className = 'wb-datepicker__title';

    var nextBtn = document.createElement('button');
    nextBtn.type = 'button';
    nextBtn.className = 'wb-datepicker__nav wb-datepicker__nav--next';
    nextBtn.innerHTML = '&#8250;';

    header.appendChild(prevBtn);
    header.appendChild(title);
    header.appendChild(nextBtn);
    panel.appendChild(header);

    var shortcutWrap = document.createElement('div');
    shortcutWrap.className = 'wb-datepicker__shortcuts';
    if (showShortcuts) {
      panel.appendChild(shortcutWrap);
    }

    var weekHeader = document.createElement('div');
    weekHeader.className = 'wb-datepicker__weekdays';
    DATE_WEEK_LABELS.forEach(function(label) {
      var item = document.createElement('span');
      item.className = 'wb-datepicker__weekday';
      item.textContent = label;
      weekHeader.appendChild(item);
    });
    panel.appendChild(weekHeader);

    var body = document.createElement('div');
    body.className = 'wb-datepicker__body';
    panel.appendChild(body);

    function getSingleValue() {
      return selectedStart ? formatDateValue(selectedStart, 'YYYY-MM-DD') : '';
    }

    function getRangeValue() {
      return {
        start: selectedStart ? formatDateValue(selectedStart, 'YYYY-MM-DD') : '',
        end: selectedEnd ? formatDateValue(selectedEnd, 'YYYY-MM-DD') : ''
      };
    }

    function getDisplayText() {
      if (isRange) {
        if (selectedStart && selectedEnd) {
          return formatDateValue(selectedStart, format) + rangeSeparator + formatDateValue(selectedEnd, format);
        }
        if (selectedStart && selectingRange) {
          return formatDateValue(selectedStart, format) + rangeSeparator + '结束日期';
        }
        return placeholder;
      }

      return selectedStart ? formatDateValue(selectedStart, format) : placeholder;
    }

    function syncDisplay() {
      var displayText = getDisplayText();
      text.textContent = displayText;
      text.classList.toggle('wb-datepicker__text--placeholder', displayText === placeholder);

      if (!clearable || disabled || readonly) {
        clearBtn.style.display = 'none';
      } else if (isRange) {
        clearBtn.style.display = selectedStart || selectedEnd ? '' : 'none';
      } else {
        clearBtn.style.display = selectedStart ? '' : 'none';
      }
    }

    function emitChange() {
      if (!config.onChange) {
        return;
      }

      if (isRange) {
        config.onChange(getRangeValue(), {
          startDate: cloneDate(selectedStart),
          endDate: cloneDate(selectedEnd)
        });
      } else {
        config.onChange(getSingleValue(), cloneDate(selectedStart));
      }
    }

    function closePanel() {
      isOpen = false;
      panel.style.display = 'none';
      container.classList.remove('wb-datepicker--open');
    }

    function openPanel() {
      if (disabled || readonly) {
        return;
      }

      isOpen = true;
      panel.style.display = 'block';
      container.classList.add('wb-datepicker--open');
      renderPanel();
    }

    function togglePanel() {
      if (isOpen) {
        closePanel();
      } else {
        openPanel();
      }
    }

    function setPanelMonth(date) {
      panelMonth = getMonthStart(date || new Date());
      renderPanel();
    }

    function setRangeValue(start, end, silent) {
      selectedStart = parseDateValue(start);
      selectedEnd = parseDateValue(end);

      // 关键分支：如果用户传入反向区间，这里自动纠正，避免外部状态不一致
      if (selectedStart && selectedEnd && isAfterDate(selectedStart, selectedEnd)) {
        var temp = selectedStart;
        selectedStart = selectedEnd;
        selectedEnd = temp;
      }

      selectingRange = false;
      if (selectedStart) {
        panelMonth = getMonthStart(selectedStart);
      }
      syncDisplay();
      renderPanel();

      if (!silent) {
        emitChange();
      }
    }

    function setSingleValue(value, silent) {
      selectedStart = parseDateValue(value);
      if (selectedStart) {
        panelMonth = getMonthStart(selectedStart);
      }
      syncDisplay();
      renderPanel();

      if (!silent) {
        emitChange();
      }
    }

    function clearValue(silent) {
      selectedStart = null;
      selectedEnd = null;
      selectingRange = false;
      syncDisplay();
      renderPanel();

      if (!silent) {
        emitChange();
      }
    }

    function applyShortcut(type) {
      var today = cloneDate(new Date());
      var range;

      if (type === 'today') {
        if (isRange) {
          setRangeValue(formatDateValue(today, 'YYYY-MM-DD'), formatDateValue(today, 'YYYY-MM-DD'));
        } else {
          setSingleValue(formatDateValue(today, 'YYYY-MM-DD'));
          closePanel();
        }
        return;
      }

      if (type === 'week') {
        range = getWeekRange(today);
      } else {
        range = getMonthRange(today);
      }

      setRangeValue(formatDateValue(range.start, 'YYYY-MM-DD'), formatDateValue(range.end, 'YYYY-MM-DD'));
    }

    function renderShortcuts() {
      if (!showShortcuts) {
        return;
      }

      shortcutWrap.innerHTML = '';

      var shortcuts = [
        { key: 'today', label: '今天' },
        { key: 'week', label: '本周', rangeOnly: true },
        { key: 'month', label: '本月', rangeOnly: true }
      ];

      shortcuts.forEach(function(item) {
        if (item.rangeOnly && !isRange) {
          return;
        }

        var button = document.createElement('button');
        button.type = 'button';
        button.className = 'wb-datepicker__shortcut';
        button.textContent = item.label;
        button.addEventListener('click', function(e) {
          e.stopPropagation();
          applyShortcut(item.key);
        });
        shortcutWrap.appendChild(button);
      });
    }

    function createCell(date) {
      var cell = document.createElement('button');
      cell.type = 'button';
      cell.className = 'wb-datepicker__cell';

      if (!date) {
        cell.classList.add('wb-datepicker__cell--empty');
        cell.disabled = true;
        return cell;
      }

      var today = cloneDate(new Date());
      var isSelected = isRange ? (isSameDate(date, selectedStart) || isSameDate(date, selectedEnd)) : isSameDate(date, selectedStart);
      var isInRange = isRange && selectedStart && selectedEnd && isDateInRange(date, selectedStart, selectedEnd);

      cell.textContent = date.getDate();
      if (isSelected) {
        cell.classList.add('wb-datepicker__cell--selected');
      }
      if (isInRange) {
        cell.classList.add('wb-datepicker__cell--in-range');
      }
      if (isSameDate(date, today)) {
        cell.classList.add('wb-datepicker__cell--today');
      }

      cell.addEventListener('click', function(e) {
        e.stopPropagation();

        if (isRange) {
          // 关键分支：范围选择采用“先起后止”的交互，第二次点击若早于开始日期则自动交换
          if (!selectedStart || (selectedStart && selectedEnd) || !selectingRange) {
            selectedStart = cloneDate(date);
            selectedEnd = null;
            selectingRange = true;
            syncDisplay();
            renderPanel();
            return;
          }

          if (isBeforeDate(date, selectedStart)) {
            selectedEnd = cloneDate(selectedStart);
            selectedStart = cloneDate(date);
          } else {
            selectedEnd = cloneDate(date);
          }

          selectingRange = false;
          syncDisplay();
          renderPanel();
          emitChange();
          closePanel();
          return;
        }

        selectedStart = cloneDate(date);
        syncDisplay();
        renderPanel();
        emitChange();
        closePanel();
      });

      return cell;
    }

    function renderPanel() {
      title.textContent = panelMonth.getFullYear() + ' 年 ' + (panelMonth.getMonth() + 1) + ' 月';
      body.innerHTML = '';
      renderShortcuts();

      getMonthDays(panelMonth).forEach(function(date) {
        body.appendChild(createCell(date));
      });
    }

    prevBtn.addEventListener('click', function(e) {
      e.stopPropagation();
      setPanelMonth(createDate(panelMonth.getFullYear(), panelMonth.getMonth() - 1, 1));
    });

    nextBtn.addEventListener('click', function(e) {
      e.stopPropagation();
      setPanelMonth(createDate(panelMonth.getFullYear(), panelMonth.getMonth() + 1, 1));
    });

    trigger.addEventListener('click', function(e) {
      e.stopPropagation();
      togglePanel();
    });

    clearBtn.addEventListener('click', function(e) {
      e.stopPropagation();
      clearValue();
    });

    document.addEventListener('click', function(e) {
      if (!container.contains(e.target)) {
        closePanel();
      }
    });

    container.getValue = function() {
      return isRange ? getRangeValue() : getSingleValue();
    };
    container.setValue = function(value) {
      if (isRange) {
        if (Array.isArray(value)) {
          setRangeValue(value[0], value[1]);
        } else if (value && typeof value === 'object') {
          setRangeValue(value.start, value.end);
        } else {
          clearValue();
        }
      } else {
        setSingleValue(value);
      }
    };
    container.clear = clearValue;
    container.open = openPanel;
    container.close = closePanel;
    container.setDisabled = function(isDisabled) {
      disabled = !!isDisabled;
      trigger.disabled = disabled;
      container.classList.toggle('wb-datepicker--disabled', disabled);
      if (disabled) {
        closePanel();
      }
      syncDisplay();
    };
    container.setReadonly = function(isReadonly) {
      readonly = !!isReadonly;
      container.classList.toggle('wb-datepicker--readonly', readonly);
      if (readonly) {
        closePanel();
      }
      syncDisplay();
    };
    container.getDate = function() {
      return cloneDate(selectedStart);
    };
    container.getRange = function() {
      return {
        startDate: cloneDate(selectedStart),
        endDate: cloneDate(selectedEnd)
      };
    };

    syncDisplay();
    renderPanel();
    return container;
  }

  window.WBDatePicker = {
    create: createDatePicker,
    parseDate: parseDateValue,
    formatDate: formatDateValue
  };
})();
