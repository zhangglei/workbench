(function () {
  'use strict';

  function pad2(n) {
    return String(n).padStart(2, '0');
  }

  function getDateKey(date) {
    return date.getFullYear() + '-' + pad2(date.getMonth() + 1) + '-' + pad2(date.getDate());
  }

  function parseDateKey(key) {
    if (!key || !/^\d{4}-\d{2}-\d{2}$/.test(key)) return null;
    var parts = key.split('-').map(function (part) { return parseInt(part, 10); });
    return new Date(parts[0], parts[1] - 1, parts[2]);
  }

  function formatDateKey(key) {
    var date = parseDateKey(key);
    if (!date) return '选择日期查看待办';
    return date.getFullYear() + ' 年 ' + (date.getMonth() + 1) + ' 月 ' + date.getDate() + ' 日';
  }

  function formatTimeAgo(timestamp) {
    var now = Date.now();
    var diff = now - timestamp;
    var seconds = Math.floor(diff / 1000);
    var minutes = Math.floor(seconds / 60);
    var hours = Math.floor(minutes / 60);
    var days = Math.floor(hours / 24);

    if (seconds < 60) return '刚刚';
    if (minutes < 60) return minutes + ' 分钟前';
    if (hours < 24) return hours + ' 小时前';
    if (days < 7) return days + ' 天前';

    var date = new Date(timestamp);
    return date.getFullYear() + '-' + pad2(date.getMonth() + 1) + '-' + pad2(date.getDate());
  }

  window.WorkbenchDateUtils = Object.assign({}, window.WorkbenchDateUtils, {
    pad2: pad2,
    getDateKey: getDateKey,
    parseDateKey: parseDateKey,
    formatDateKey: formatDateKey,
    formatTimeAgo: formatTimeAgo
  });
})();