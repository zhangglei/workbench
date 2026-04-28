(function () {
  'use strict';

  var state = null;
  var defaultBg;
  var DEFAULT_GUEST_ACCOUNTS = [{ user: 'admin', pass: 'admin' }];
  var DEFAULT_ADMIN_ACCOUNTS = [{ user: 'root', pass: 'root' }];

  function showToast(message, type) {
    var el = document.getElementById('settingsToast');
    if (!el) {
      if (type === 'error') window.alert(message);
      return;
    }
    el.textContent = message;
    el.className = 'show ' + (type === 'error' ? 'error' : 'success');
    el.style.display = 'block';
    clearTimeout(showToast._t);
    showToast._t = setTimeout(function () {
      el.className = '';
      el.style.display = 'none';
    }, 2800);
  }

  function pad2(n) {
    return String(n).padStart(2, '0');
  }

  function toggleBgInputs(type) {
    document.getElementById('bgColorWrap').classList.toggle('hidden', type !== 'color');
    document.getElementById('bgImageWrap').classList.toggle('hidden', type !== 'image');
    document.getElementById('bgGradientWrap').classList.toggle('hidden', type !== 'gradient');
  }

  function notifyWorkbenchSettingsSaved() {
    try {
      if (window.opener && !window.opener.closed && typeof window.opener.postMessage === 'function') {
        window.opener.postMessage({ type: 'workbench-settings-saved' }, '*');
      }
    } catch (_) {}
  }

  function goBackToWorkbench() {
    notifyWorkbenchSettingsSaved();
    try {
      if (window.opener && !window.opener.closed) {
        window.opener.focus();
        // 独立设置窗口返回时直接关闭，避免重新加载工作台导致卡顿。
        window.close();
        return;
      }
    } catch (_) {}
    window.location.replace('./index.html');
  }

  function cloneAccounts(list) {
    return list.map(function (item) {
      return { user: item.user, pass: item.pass };
    });
  }

  function parseAccountText(text, fallback) {
    var rows = (text || '')
      .split('\n')
      .map(function (line) {
        var raw = (line || '').trim();
        if (!raw) return null;
        var idx = raw.indexOf(':');
        if (idx < 0) return null;
        var user = raw.slice(0, idx).trim();
        var pass = raw.slice(idx + 1).trim();
        return user && pass ? { user: user, pass: pass } : null;
      })
      .filter(Boolean);
    return rows.length ? rows : cloneAccounts(fallback);
  }

  function serializeAccounts(rows, fallback) {
    rows = rows || [];
    var valid = rows.filter(function (row) {
      return row.user && row.pass;
    });
    if (!valid.length) valid = cloneAccounts(fallback);
    return valid.map(function (row) {
      return row.user + ':' + row.pass;
    }).join('\n');
  }

  function readAccountsFromTable(tableId, fallback) {
    var table = document.getElementById(tableId);
    if (!table) return cloneAccounts(fallback);
    var rows = [];
    table.querySelectorAll('tr').forEach(function (tr) {
      var userInput = tr.querySelector('[data-field="user"]');
      var passInput = tr.querySelector('[data-field="pass"]');
      rows.push({
        user: ((userInput && userInput.value) || '').trim(),
        pass: ((passInput && passInput.value) || '').trim()
      });
    });
    return rows;
  }

  function syncAccountRawInputs() {
    document.getElementById('guestUsers').value = serializeAccounts(
      readAccountsFromTable('guestUsersTable', DEFAULT_GUEST_ACCOUNTS),
      DEFAULT_GUEST_ACCOUNTS
    );
    document.getElementById('adminUsers').value = serializeAccounts(
      readAccountsFromTable('adminUsersTable', DEFAULT_ADMIN_ACCOUNTS),
      DEFAULT_ADMIN_ACCOUNTS
    );
  }

  function appendAccountRow(tableId, account) {
    var table = document.getElementById(tableId);
    if (!table) return;
    var tr = document.createElement('tr');
    var userTd = document.createElement('td');
    var passTd = document.createElement('td');
    var actionTd = document.createElement('td');
    var userInput = document.createElement('input');
    var passInput = document.createElement('input');
    var removeBtn = document.createElement('button');

    userInput.type = 'text';
    userInput.dataset.field = 'user';
    userInput.placeholder = '用户名';
    userInput.value = (account && account.user) || '';
    passInput.type = 'text';
    passInput.dataset.field = 'pass';
    passInput.placeholder = '密码';
    passInput.value = (account && account.pass) || '';
    removeBtn.type = 'button';
    removeBtn.className = 'btn btn-secondary btn-sm account-remove-btn';
    removeBtn.textContent = '删除';
    removeBtn.addEventListener('click', function () {
      tr.remove();
      syncAccountRawInputs();
    });
    userInput.addEventListener('input', syncAccountRawInputs);
    passInput.addEventListener('input', syncAccountRawInputs);

    userTd.appendChild(userInput);
    passTd.appendChild(passInput);
    actionTd.appendChild(removeBtn);
    tr.appendChild(userTd);
    tr.appendChild(passTd);
    tr.appendChild(actionTd);
    table.appendChild(tr);
  }

  function renderAccountTable(tableId, rows, fallback) {
    var table = document.getElementById(tableId);
    if (!table) return;
    table.innerHTML = '';
    (rows && rows.length ? rows : cloneAccounts(fallback)).forEach(function (row) {
      appendAccountRow(tableId, row);
    });
  }

  function ensureAdminDefaultAccount() {
    var rows = parseAccountText(state && state.allowedUsers || '', DEFAULT_ADMIN_ACCOUNTS);
    var hasRoot = rows.some(function (row) {
      return row.user === 'root' && row.pass === 'root';
    });
    if (!hasRoot) {
      rows.unshift({ user: 'root', pass: 'root' });
      state.allowedUsers = serializeAccounts(rows, DEFAULT_ADMIN_ACCOUNTS);
    }
  }

  function readFormIntoState() {
    if (!state) return;
    var def = defaultBg;
    syncAccountRawInputs();
    state.layout = {
      cols: Math.max(1, Math.min(6, parseInt(document.getElementById('layoutCols').value, 10) || 3)),
      gap: Math.max(0, Math.min(48, parseInt(document.getElementById('layoutGap').value, 10) || 16)),
      align: document.getElementById('layoutAlign').value
    };
    var urlInput = (document.getElementById('bgImage').value || '').trim();
    var keepUploaded = !urlInput && state.bg.image && state.bg.image.indexOf('data:') === 0;
    state.bg = {
      type: document.getElementById('bgType').value,
      color: document.getElementById('bgColor').value,
      image: urlInput || (keepUploaded ? state.bg.image : ''),
      gradient: (document.getElementById('bgGradient').value || '').trim() || def.gradient
    };
    state.guestUsers = document.getElementById('guestUsers').value;
    state.allowedUsers = document.getElementById('adminUsers').value;
  }

  function fillFormFromState() {
    if (!state) return;
    document.getElementById('layoutCols').value = state.layout.cols;
    document.getElementById('layoutGap').value = state.layout.gap;
    document.getElementById('layoutAlign').value = state.layout.align;
    document.getElementById('bgType').value = state.bg.type;
    document.getElementById('bgColor').value = state.bg.color;
    document.getElementById('bgImage').value = state.bg.image || '';
    document.getElementById('bgGradient').value = state.bg.gradient || '';
    ensureAdminDefaultAccount();
    renderAccountTable('guestUsersTable', parseAccountText(state.guestUsers || '', DEFAULT_GUEST_ACCOUNTS), DEFAULT_GUEST_ACCOUNTS);
    renderAccountTable('adminUsersTable', parseAccountText(state.allowedUsers || '', DEFAULT_ADMIN_ACCOUNTS), DEFAULT_ADMIN_ACCOUNTS);
    syncAccountRawInputs();
    if (state.bg.image && state.bg.image.indexOf('data:') === 0) {
      document.getElementById('bgUploadHint').textContent = '当前使用本地上传的图片';
    } else {
      document.getElementById('bgUploadHint').textContent = '';
    }
    document.getElementById('bgImageFile').value = '';
    toggleBgInputs(state.bg.type);
  }

  function renderThemeSelector() {
    var themeSelector = document.getElementById('themeSelector');
    if (!themeSelector || !window.ThemeSystem) return;
    var currentTheme = window.ThemeSystem.getCurrentTheme();
    var themes = window.ThemeSystem.getThemeList();
    themeSelector.innerHTML = themes
      .map(function (theme) {
        return (
          '<button type="button" class="theme-card' +
          (theme.key === currentTheme ? ' active' : '') +
          '" data-theme="' +
          theme.key +
          '">' +
          '<div class="theme-card-icon">' +
          theme.icon +
          '</div>' +
          '<div class="theme-card-name">' +
          theme.name +
          '</div></button>'
        );
      })
      .join('');
    themeSelector.querySelectorAll('.theme-card').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var themeKey = btn.dataset.theme;
        window.ThemeSystem.applyTheme(themeKey);
        themeSelector.querySelectorAll('.theme-card').forEach(function (b) {
          b.classList.toggle('active', b.dataset.theme === themeKey);
        });
        showToast('主题已切换', 'success');
      });
    });
  }

  function renderBgGallery() {
    var gallery = document.getElementById('bgGallery');
    if (!gallery || !window.WorkbenchBgLibrary) return;
    gallery.innerHTML = '';
    window.WorkbenchBgLibrary.forEach(function (item) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className =
        'bg-gallery-item' + (state.bg.type === 'image' && state.bg.image === item.url ? ' active' : '');
      btn.title = item.name;
      btn.innerHTML = '<img src="' + item.url + '" alt="">';
      btn.addEventListener('click', function () {
        state.bg.type = 'image';
        state.bg.image = item.url;
        window.WorkbenchPersist.persistState(state);
        fillFormFromState();
        renderBgGallery();
        showToast('背景已更新', 'success');
      });
      gallery.appendChild(btn);
    });
  }

  function exportStateToFile() {
    readFormIntoState();
    var toSave = {
      layout: state.layout,
      bg: state.bg,
      modules: state.modules,
      todos: state.todos || [],
      allowedUsers: state.allowedUsers,
      guestUsers: state.guestUsers || '',
      collapsedModules: state.collapsedModules || {},
      exportTime: new Date().toISOString(),
      version: '1.0'
    };
    var blob = new Blob([JSON.stringify(toSave, null, 2)], { type: 'application/json;charset=utf-8' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    var now = new Date();
    var timestamp =
      now.getFullYear() +
      pad2(now.getMonth() + 1) +
      pad2(now.getDate()) +
      '_' +
      pad2(now.getHours()) +
      pad2(now.getMinutes()) +
      pad2(now.getSeconds());
    a.download = 'workbench-export-' + timestamp + '.json';
    a.click();
    URL.revokeObjectURL(a.href);
    showToast('数据已导出', 'success');
  }

  function importStateFromFile(file) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function () {
        try {
          var text = typeof reader.result === 'string' ? reader.result : '';
          var data = JSON.parse(text);
          var S = window.WorkbenchState;
          state = S.migrateState(data);
          if (data.allowedUsers !== undefined) state.allowedUsers = data.allowedUsers;
          if (data.guestUsers !== undefined) state.guestUsers = data.guestUsers;
          state.todos = S.normalizeTodos(Array.isArray(data.todos) ? data.todos : []);
          if (data.collapsedModules) state.collapsedModules = data.collapsedModules || {};
          window.WorkbenchPersist.persistState(state);
          fillFormFromState();
          renderBgGallery();
          renderThemeSelector();
          showToast('导入成功', 'success');
          resolve();
        } catch (e) {
          reject(e);
        }
      };
      reader.onerror = reject;
      reader.readAsText(file, 'UTF-8');
    });
  }

  function init() {
    defaultBg = window.WorkbenchState.defaultBg;
    state = window.WorkbenchPersist.loadMergedStateFromLocalStorage();

    fillFormFromState();
    renderThemeSelector();
    renderBgGallery();

    document.getElementById('bgType').addEventListener('change', function () {
      toggleBgInputs(this.value);
    });

    document.getElementById('btnApplySettings').addEventListener('click', function () {
      readFormIntoState();
      window.WorkbenchPersist.persistState(state);
      if (window.workbenchApi) {
        window.workbenchApi.setConfig({
          dataPath: (document.getElementById('dataPathInput').value || '').trim(),
          obsidianVaultPath: (document.getElementById('obsidianVaultPathInput') ? document.getElementById('obsidianVaultPathInput').value : '').trim(),
          obsidianSyncFolder: (document.getElementById('obsidianSyncFolderInput') ? document.getElementById('obsidianSyncFolderInput').value : 'WorkbenchSync').trim() || 'WorkbenchSync'
        });
      }
      notifyWorkbenchSettingsSaved();
      showToast('设置已保存', 'success');
    });

    document.getElementById('btnBackToWorkbench').addEventListener('click', goBackToWorkbench);
    document.getElementById('btnAddGuestUser').addEventListener('click', function () {
      appendAccountRow('guestUsersTable', { user: '', pass: '' });
    });
    document.getElementById('btnAddAdminUser').addEventListener('click', function () {
      appendAccountRow('adminUsersTable', { user: '', pass: '' });
    });
    syncAccountRawInputs();

    document.getElementById('bgImageFile').addEventListener('change', function () {
      var file = this.files && this.files[0];
      if (!file || !file.type.match(/^image\//)) return;
      var hint = document.getElementById('bgUploadHint');
      hint.textContent = '处理中…';
      var img = new Image();
      var url = URL.createObjectURL(file);
      img.onload = function () {
        URL.revokeObjectURL(url);
        var w = img.width;
        var h = img.height;
        var maxW = 1920;
        var maxH = 1080;
        if (w > maxW || h > maxH) {
          var r = Math.min(maxW / w, maxH / h);
          w = Math.round(w * r);
          h = Math.round(h * r);
        }
        var canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        try {
          state.bg.type = 'image';
          state.bg.image = canvas.toDataURL('image/jpeg', 0.85);
          window.WorkbenchPersist.persistState(state);
          hint.textContent = '已使用本地上传的图片';
          fillFormFromState();
          renderBgGallery();
        } catch (_) {
          hint.textContent = '上传失败';
        }
        document.getElementById('bgImageFile').value = '';
      };
      img.onerror = function () {
        URL.revokeObjectURL(url);
        hint.textContent = '上传失败';
      };
      img.src = url;
    });

    document.getElementById('btnExportState').addEventListener('click', exportStateToFile);

    var importInput = document.getElementById('importStateFile');
    document.getElementById('btnImportState').addEventListener('click', function () {
      importInput.click();
    });
    importInput.addEventListener('change', function () {
      var f = this.files && this.files[0];
      if (!f) return;
      importStateFromFile(f)
        .catch(function () {
          showToast('导入失败：文件格式不正确', 'error');
        })
        .finally(function () {
          importInput.value = '';
        });
    });

    if (window.workbenchApi) {
      document.getElementById('dataPathSection').style.display = '';
      if (document.getElementById('obsidianPathSection')) document.getElementById('obsidianPathSection').style.display = '';
      window.workbenchApi.getConfig().then(function (cfg) {
        document.getElementById('dataPathInput').value = (cfg && cfg.dataPath) || '';
        if (document.getElementById('obsidianVaultPathInput')) {
          document.getElementById('obsidianVaultPathInput').value = (cfg && cfg.obsidianVaultPath) || '';
        }
        if (document.getElementById('obsidianSyncFolderInput')) {
          document.getElementById('obsidianSyncFolderInput').value = (cfg && cfg.obsidianSyncFolder) || 'WorkbenchSync';
        }
      }).catch(function () {});

      var chooseBtn = document.getElementById('btnChooseDataPath');
      if (chooseBtn) {
        chooseBtn.addEventListener('click', function () {
          window.workbenchApi.chooseDataPath().then(function (path) {
            if (!path) return;
            window.workbenchApi.setConfig({ dataPath: path });
            document.getElementById('dataPathInput').value = path;
          });
        });
      }

      var chooseObsidianBtn = document.getElementById('btnChooseObsidianVaultPath');
      if (chooseObsidianBtn) {
        chooseObsidianBtn.addEventListener('click', function () {
          window.workbenchApi.chooseObsidianVaultPath().then(function (vaultPath) {
            if (!vaultPath) return;
            var syncFolderInput = document.getElementById('obsidianSyncFolderInput');
            var syncFolder = ((syncFolderInput && syncFolderInput.value) || 'WorkbenchSync').trim() || 'WorkbenchSync';
            window.workbenchApi.setConfig({ obsidianVaultPath: vaultPath, obsidianSyncFolder: syncFolder });
            document.getElementById('obsidianVaultPathInput').value = vaultPath;
          });
        });
      }
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
