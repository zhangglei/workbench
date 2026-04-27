(function () {
  'use strict';

  var constants = window.WorkbenchConstants || {};

  function readJson(key, fallback) {
    try {
      var raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (_) {
      return fallback;
    }
  }

  function writeJson(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (_) {
      return false;
    }
  }

  function loadTodoUI(state) {
    var dateUtils = window.WorkbenchDateUtils || {};
    var pad2 = dateUtils.pad2 || function (n) { return String(n).padStart(2, '0'); };
    var parseDateKey = dateUtils.parseDateKey || function (key) {
      if (!key || !/^\d{4}-\d{2}-\d{2}$/.test(key)) return null;
      var parts = key.split('-').map(function (part) { return parseInt(part, 10); });
      return new Date(parts[0], parts[1] - 1, parts[2]);
    };

    var raw = readJson(constants.STORAGE_TODO_UI || 'workbench_todo_ui', null) || {};
    var monthStr = typeof raw.calendarMonth === 'string' ? raw.calendarMonth + '-01' : '';
    var monthDate = parseDateKey(monthStr) || new Date();

    return {
      todoView: raw.todoView === 'calendar' ? 'calendar' : 'list',
      selectedDate: parseDateKey(raw.selectedDate) ? raw.selectedDate : '',
      calendarMonth: new Date(monthDate.getFullYear(), monthDate.getMonth(), 1),
      calendarMonthText: monthDate.getFullYear() + '-' + pad2(monthDate.getMonth() + 1)
    };
  }

  function persistTodoUI(state) {
    return writeJson(constants.STORAGE_TODO_UI || 'workbench_todo_ui', {
      todoView: state && state.todoView ? state.todoView : 'list',
      selectedDate: state && state.todoSelectedDate ? state.todoSelectedDate : '',
      calendarMonth: state && state.todoCalendarMonth
        ? state.todoCalendarMonth.getFullYear() + '-' + String(state.todoCalendarMonth.getMonth() + 1).padStart(2, '0')
        : ''
    });
  }

  function loadRecentActivity() {
    return readJson(constants.STORAGE_RECENT_ACTIVITY || 'workbench_recent_activity', []);
  }

  function saveRecentActivity(items) {
    return writeJson(constants.STORAGE_RECENT_ACTIVITY || 'workbench_recent_activity', items);
  }

  window.WorkbenchStorageService = Object.assign({}, window.WorkbenchStorageService, {
    readJson: readJson,
    writeJson: writeJson,
    loadTodoUI: loadTodoUI,
    persistTodoUI: persistTodoUI,
    loadRecentActivity: loadRecentActivity,
    saveRecentActivity: saveRecentActivity
  });
})();