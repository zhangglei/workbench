/**
 * 工具函数模块
 * 负责：HTML 转义、搜索高亮、Toast 提示等
 */
(function () {
  'use strict';

  function escapeHtml(s) {
    var div = document.createElement('div');
    div.textContent = s == null ? '' : s;
    return div.innerHTML;
  }

  function stripHtml(s) {
    var div = document.createElement('div');
    div.innerHTML = s == null ? '' : String(s);
    return (div.textContent || div.innerText || '').trim();
  }

  function linkify(s) {
    return String(s).replace(
      /(https?:\/\/[^\s<]+)/g,
      '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>'
    );
  }

  /**
   * 在 str 中高亮所有 q 出现的位置
   * str 应是已 escapeHtml 过的安全 HTML 文本
   */
  function highlightMatch(str, q) {
    if (!q || !str) return str;
    var escaped = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return str.replace(new RegExp('(' + escaped + ')', 'gi'), '<mark>$1</mark>');
  }

  function showToast(message, type) {
    if (window.WorkbenchUI && typeof window.WorkbenchUI.showToast === 'function') {
      window.WorkbenchUI.showToast(message, type || 'success');
    }
  }

  function confirmAction(message, onConfirm, options) {
    if (window.WorkbenchUI && typeof window.WorkbenchUI.confirm === 'function') {
      window.WorkbenchUI.confirm({
        title: (options && options.title) || '请确认操作',
        message: message || '确认继续吗？',
        confirmText: (options && options.confirmText) || '确定',
        cancelText: (options && options.cancelText) || '取消',
        danger: !options || options.danger !== false
      }).then(function (ok) {
        if (ok && typeof onConfirm === 'function') onConfirm();
      });
      return;
    }
    showToast('确认弹窗不可用，请刷新页面后重试', 'error');
  }

  // 暴露给全局
  window.WorkbenchUtils = {
    escapeHtml: escapeHtml,
    stripHtml: stripHtml,
    linkify: linkify,
    highlightMatch: highlightMatch,
    showToast: showToast,
    confirmAction: confirmAction
  };
})();
