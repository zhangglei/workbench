(function () {
  'use strict';

  var constants = window.WorkbenchConstants || {};
  var dateUtils = window.WorkbenchDateUtils || {};

  function addRecentActivity(type, id, title, meta, hooks) {
    var storage = window.WorkbenchStorageService;
    if (!storage || typeof storage.loadRecentActivity !== 'function') return [];

    var items = storage.loadRecentActivity();
    items = items.filter(function (item) {
      return !(item.type === type && item.id === id);
    });

    items.unshift({
      type: type,
      id: id,
      title: title,
      meta: meta || '',
      timestamp: Date.now()
    });

    var max = constants.MAX_RECENT_ITEMS || 20;
    if (items.length > max) items = items.slice(0, max);

    storage.saveRecentActivity(items);
    if (hooks && typeof hooks.onChange === 'function') hooks.onChange(items);
    return items;
  }

  function buildOverviewMetrics(state, knowledgeStats) {
    var todos = Array.isArray(state && state.todos) ? state.todos : [];
    var todayKey = typeof dateUtils.getDateKey === 'function' ? dateUtils.getDateKey(new Date()) : '';
    var todoToday = todos.filter(function (todo) {
      return todo && todo.date === todayKey;
    }).length;
    var todoActive = todos.filter(function (todo) {
      return todo && !todo.done;
    }).length;

    return {
      todoToday: todoToday,
      todoActive: todoActive,
      knowledgeCount: knowledgeStats && knowledgeStats.total ? knowledgeStats.total : 0,
      knowledgeWeek: knowledgeStats && knowledgeStats.week ? knowledgeStats.week : 0
    };
  }

  window.WorkbenchDashboardService = Object.assign({}, window.WorkbenchDashboardService, {
    addRecentActivity: addRecentActivity,
    buildOverviewMetrics: buildOverviewMetrics
  });
})();