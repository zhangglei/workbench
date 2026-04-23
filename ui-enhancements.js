(function () {
  'use strict';

  var TOAST_DURATION = 2600;

  function $(id) {
    return document.getElementById(id);
  }

  function getRole() {
    try { return localStorage.getItem('workbench_user_role') || ''; } catch (e) { return ''; }
  }

  function getCurrentView() {
    return typeof window._currentView === 'function' ? window._currentView() : 'dashboard';
  }

  function updateSearchVisibility() {
    var wrap = $('headerSearchWrap');
    if (!wrap) return;
    wrap.classList.toggle('hidden', getCurrentView() === 'knowledge');
  }

  function updateFabVisibility() {
    var fab = $('fabAddModule');
    var footer = $('footerBar');
    var visible = getCurrentView() === 'dashboard' && getRole() === 'admin';
    if (fab) fab.classList.toggle('hidden', !visible);
    if (footer) footer.classList.add('hidden');
  }

  function updateSyncStatus() {
    var el = $('syncStatus');
    if (!el) return;
    el.textContent = window.workbenchApi ? '桌面版数据' : '浏览器本地数据';
    el.title = window.workbenchApi ? '当前数据保存到桌面版目录' : '当前数据保存在浏览器本地';
  }

  function showToast(message, type) {
    var stack = $('toastStack');
    if (!stack || !message) return;
    var toast = document.createElement('div');
    toast.className = 'toast toast-' + (type || 'info');
    toast.textContent = String(message);
    stack.appendChild(toast);
    requestAnimationFrame(function () {
      toast.classList.add('show');
    });
    window.setTimeout(function () {
      toast.classList.remove('show');
      window.setTimeout(function () {
        if (toast.parentNode) toast.parentNode.removeChild(toast);
      }, 220);
    }, TOAST_DURATION);
  }

  function closeConfirmModal(result) {
    var modal = $('confirmModal');
    if (!modal) return;
    modal.classList.remove('show');
    var resolver = modal._resolver;
    modal._resolver = null;
    if (typeof resolver === 'function') resolver(!!result);
  }

  function confirmAction(options) {
    var modal = $('confirmModal');
    var title = $('confirmModalTitle');
    var message = $('confirmModalMessage');
    var ok = $('btnConfirmModalOk');
    var cancel = $('btnCancelConfirmModal');
    var close = $('btnCloseConfirmModal');
    if (!modal || !title || !message || !ok || !cancel || !close) {
      showToast('确认弹窗不可用，请刷新页面后重试', 'error');
      return Promise.resolve(false);
    }
    title.textContent = (options && options.title) || '请确认操作';
    message.textContent = (options && options.message) || '确认继续吗？';
    ok.textContent = (options && options.confirmText) || '确定';
    cancel.textContent = (options && options.cancelText) || '取消';
    ok.classList.toggle('btn-danger', !!(options && options.danger));
    ok.classList.toggle('btn-primary', !(options && options.danger));
    modal.classList.add('show');
    return new Promise(function (resolve) {
      modal._resolver = resolve;
    });
  }

  function bindConfirmModal() {
    var modal = $('confirmModal');
    var ok = $('btnConfirmModalOk');
    var cancel = $('btnCancelConfirmModal');
    var close = $('btnCloseConfirmModal');
    if (!modal || modal.dataset.boundConfirm === '1') return;
    modal.dataset.boundConfirm = '1';
    if (ok) ok.addEventListener('click', function () { closeConfirmModal(true); });
    if (cancel) cancel.addEventListener('click', function () { closeConfirmModal(false); });
    if (close) close.addEventListener('click', function () { closeConfirmModal(false); });
  }

  function bindFab() {
    var fab = $('fabAddModule');
    if (!fab || fab.dataset.bound === '1') return;
    fab.dataset.bound = '1';
    fab.addEventListener('click', function () {
      var btn = $('btnAddModule');
      if (btn) btn.click();
    });
  }

  function bindModalBehavior() {
    var modalSelector = '.modal';
    document.querySelectorAll(modalSelector).forEach(function (modal) {
      if (modal.dataset.enhancedModal === '1') return;
      modal.dataset.enhancedModal = '1';
      modal.addEventListener('click', function (event) {
        if (event.target !== modal) return;
        if (modal.id === 'confirmModal') closeConfirmModal(false);
        else modal.classList.remove('show');
      });
    });

    document.addEventListener('keydown', function (event) {
      if (event.key !== 'Escape') return;
      var openModals = Array.prototype.slice.call(document.querySelectorAll('.modal.show'));
      if (!openModals.length) return;
      var activeModal = openModals[openModals.length - 1];
      if (activeModal.id === 'confirmModal') closeConfirmModal(false);
      else activeModal.classList.remove('show');
    });
  }

  function bindInputToasts() {
    var watched = [
      ['btnApplySettings', '设置已应用'],
      ['kb-editor-save', '笔记已保存']
    ];

    watched.forEach(function (item) {
      var el = $(item[0]);
      if (!el || el.dataset.toastBound === '1') return;
      el.dataset.toastBound = '1';
      el.addEventListener('click', function () {
        showToast(item[1], 'success');
      });
    });
  }

  function refreshUI() {
    updateSearchVisibility();
    updateFabVisibility();
    updateSyncStatus();
    bindFab();
    bindInputToasts();
    bindConfirmModal();
  }

  var originalOnViewChange = window._onViewChange;
  window._onViewChange = function (name) {
    if (typeof originalOnViewChange === 'function') originalOnViewChange(name);
    refreshUI();
  };

  window.WorkbenchUI = window.WorkbenchUI || {};
  window.WorkbenchUI.showToast = showToast;
  window.WorkbenchUI.confirm = confirmAction;
  window.WorkbenchUI.refreshUI = refreshUI;

  document.addEventListener('DOMContentLoaded', function () {
    refreshUI();
    bindModalBehavior();
  });
})();
