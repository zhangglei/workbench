(function () {
  'use strict';

  const STORAGE_LAYOUT = 'workbench_layout';
  const STORAGE_BG = 'workbench_bg';
  const STORAGE_STATE = 'workbench_state';
  const STORAGE_USER = 'workbench_user';
  const STORAGE_USER_ROLE = 'workbench_user_role';

  const defaultLayout = { cols: 3, gap: 16, align: 'start' };
  const defaultBg = {
    type: 'color',
    color: '#1a1b26',
    image: '',
    gradient: 'linear-gradient(135deg, #1a1b26 0%, #24283b 100%)'
  };

  function id() {
    return 'id_' + Date.now() + '_' + Math.random().toString(36).slice(2, 9);
  }

  /** 将旧版 state（modules+links 扁平）转为新版（模块为基本，网页为模块下 items） */
  function migrateState(data) {
    if (!data) return { layout: defaultLayout, bg: defaultBg, modules: [], allowedUsers: '', guestUsers: '' };
    var layout = data.layout || defaultLayout;
    var bg = data.bg || defaultBg;
    var allowedUsers = data.allowedUsers || '';
    var guestUsers = data.guestUsers || '';
    var modules = [];
    var oldModules = data.modules || [];
    var oldLinks = data.links || [];
    if (oldModules.length || oldLinks.length) {
      var hasNewFormat = oldModules.length && oldModules[0].items !== undefined;
      if (!hasNewFormat) {
        var defaultModule = { id: id(), name: '默认', order: 0, visibleToAll: true, items: [] };
        oldModules.forEach(function (m) {
          defaultModule.items.push({
            id: id(),
            title: (m.alias || '').trim() || '未命名',
            url: '',
            content: (m.content || '').trim(),
            showContent: true,
            newTab: true,
            visibleToAll: true,
            comments: [],
            attachments: []
          });
        });
        oldLinks.forEach(function (l) {
          defaultModule.items.push({
            id: id(),
            title: (l.alias || '').trim() || '未命名',
            url: (l.url || '').trim(),
            content: '',
            showContent: true,
            newTab: l.newTab !== false,
            visibleToAll: true,
            comments: [],
            attachments: []
          });
        });
        modules = [defaultModule];
      } else {
        modules = oldModules.map(function (m) {
          return {
            id: m.id,
            name: (m.name || m.alias || '').trim() || '未命名',
            order: m.order != null ? m.order : 0,
            visibleToAll: m.visibleToAll !== false,
            mappedPath: m.mappedPath || undefined,
            items: (m.items || []).map(function (it) {
              return {
                id: it.id,
                title: (it.title || it.alias || '').trim() || '未命名',
            url: (it.url || '').trim(),
            content: (it.content || '').trim(),
                showContent: it.showContent !== false,
                newTab: it.newTab !== false,
                visibleToAll: it.visibleToAll !== false,
            comments: Array.isArray(it.comments) ? it.comments : [],
            attachments: Array.isArray(it.attachments) ? it.attachments : []
              };
            })
          };
        });
      }
    }
    return { layout: layout, bg: bg, modules: modules, allowedUsers: allowedUsers, guestUsers: guestUsers };
  }

  function load(key, fallback) {
    try {
      var s = localStorage.getItem(key);
      return s ? JSON.parse(s) : fallback;
    } catch (_) {
      return fallback;
    }
  }

  var state = migrateState(null);
  state.layout = load(STORAGE_LAYOUT, defaultLayout);
  state.bg = load(STORAGE_BG, defaultBg);
  state.allowedUsers = load('workbench_allowed_users', '');
  state.guestUsers = state.guestUsers || '';
  state.collapsedModules = state.collapsedModules || {};
  var raw = load(STORAGE_STATE, null);
  if (raw && raw.modules && raw.modules.length && raw.modules[0].items !== undefined) {
    state.modules = raw.modules;
    if (raw.collapsedModules) state.collapsedModules = raw.collapsedModules;
  } else if (raw) {
    state = migrateState({ layout: state.layout, bg: state.bg, modules: raw.modules || [], links: raw.links || [], allowedUsers: state.allowedUsers });
    state.collapsedModules = raw.collapsedModules || {};
  }
  var currentUser = localStorage.getItem(STORAGE_USER) || '';
  var currentRole = localStorage.getItem(STORAGE_USER_ROLE) || '';

  var CLOUD_STATE_URLS = [
    '/.netlify/functions/workbench-state',
    '/api/workbench-state'
  ];

  var lastCloudSyncError = '';

  async function fetchFirstOk(urls, init) {
    var lastErr = null;
    for (var i = 0; i < urls.length; i++) {
      try {
        var res = await fetch(urls[i], init);
        if (res && res.ok) {
          lastCloudSyncError = '';
          return { res: res, url: urls[i] };
        }
        lastErr = new Error('HTTP ' + (res ? res.status : 'unknown'));
      } catch (e) {
        lastErr = e;
      }
    }
    lastCloudSyncError = String(lastErr && lastErr.message ? lastErr.message : lastErr || '');
    throw lastErr || new Error('All endpoints failed');
  }

  function persistState() {
    var toSave = {
      layout: state.layout,
      bg: state.bg,
      modules: state.modules,
      allowedUsers: state.allowedUsers,
      guestUsers: state.guestUsers || '',
      collapsedModules: state.collapsedModules || {}
    };
    if (window.workbenchApi) {
      window.workbenchApi.saveState(toSave).catch(function (e) { console.error(e); });
    }
    try {
      localStorage.setItem('workbench_allowed_users', state.allowedUsers || '');
    } catch (_) {}
    if (!window.workbenchApi) {
      try {
        localStorage.setItem(STORAGE_LAYOUT, JSON.stringify(state.layout));
        localStorage.setItem(STORAGE_BG, JSON.stringify(state.bg));
        localStorage.setItem(STORAGE_STATE, JSON.stringify({ modules: state.modules, allowedUsers: state.allowedUsers, guestUsers: state.guestUsers || '', collapsedModules: state.collapsedModules || {} }));
      } catch (_) {}
      fetchFirstOk(CLOUD_STATE_URLS, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(toSave)
      }).catch(function (e) { console.warn('云端保存失败', e); });
    }
  }

  function canEdit() {
    return currentRole === 'admin';
  }

  function canComment() {
    return !!currentUser;
  }

  var mainGrid = document.getElementById('mainGrid');
  var searchInput = document.getElementById('searchInput');
  var headerTitle = document.getElementById('headerTitle');
  var userArea = document.getElementById('userArea');
  var footerBar = document.getElementById('footerBar');
  var appRoot = document.getElementById('app');
  var loginOverlay = document.getElementById('loginOverlay');

  var BG_LIBRARY = (function () {
    function svgDataUri(svg) {
      return 'data:image/svg+xml,' + encodeURIComponent(svg);
    }
    var w = 1920, h = 1080;
    function svg(body) {
      return '<svg xmlns="http://www.w3.org/2000/svg" width="' + w + '" height="' + h + '" viewBox="0 0 ' + w + ' ' + h + '">' + body + '</svg>';
    }
    function grad(id, stops) {
      var s = stops.map(function (x) { return '<stop offset="' + x[0] + '" stop-color="' + x[1] + '"/>'; }).join('');
      return '<defs><linearGradient id="' + id + '" x1="0%" y1="0%" x2="100%" y2="100%">' + s + '</linearGradient></defs><rect width="100%" height="100%" fill="url(#' + id + ')"/>';
    }
    return [
      { name: '深蓝夜', url: svgDataUri(svg(grad('g1', [['0%', '#0f0c29'], ['50%', '#302b63'], ['100%', '#24243e']]))) },
      { name: '湖蓝', url: svgDataUri(svg(grad('g2', [['0%', '#2193b0'], ['100%', '#6dd5ed']]))) },
      { name: '灰蓝', url: svgDataUri(svg(grad('g8', [['0%', '#1a1b26'], ['100%', '#414868']]))) }
    ];
  })();

  function applyLayout() {
    var l = state.layout;
    if (mainGrid) {
      mainGrid.style.setProperty('--layout-cols', String(l.cols));
      mainGrid.style.setProperty('--layout-gap', l.gap + 'px');
      mainGrid.style.setProperty('--layout-align', l.align);
    }
  }

  function applyBackground() {
    var b = state.bg;
    document.body.setAttribute('data-bg-type', b.type);
    document.body.style.setProperty('--bg-color', b.color);
    document.body.style.setProperty('--bg-image', b.image ? 'url(' + b.image + ')' : 'none');
    document.body.style.setProperty('--bg-gradient', b.gradient || defaultBg.gradient);
  }

  function escapeHtml(s) {
    var div = document.createElement('div');
    div.textContent = s == null ? '' : s;
    return div.innerHTML;
  }

  function linkify(s) {
    return String(s).replace(
      /(https?:\/\/[^\s<]+)/g,
      '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>'
    );
  }

  function getSearchText() {
    return (searchInput && searchInput.value) ? searchInput.value.trim().toLowerCase() : '';
  }

  function matchSearch(module, item) {
    var q = getSearchText();
    if (!q) return true;
    var text = (module.name + ' ' + (item ? (item.title + ' ' + (item.url || '') + ' ' + (item.content || '')) : '')).toLowerCase();
    return text.indexOf(q) !== -1;
  }

  function openModuleModal(module) {
    var titleEl = document.getElementById('moduleModalTitle');
    var idEl = document.getElementById('moduleId');
    var nameEl = document.getElementById('moduleName');
    var pathEl = document.getElementById('moduleMappedPath');
    var visibleEl = document.getElementById('moduleVisibleToAll');
    if (titleEl) titleEl.textContent = module ? '编辑模块' : '添加模块';
    if (idEl) idEl.value = module ? module.id : '';
    if (nameEl) nameEl.value = module ? (module.name || '') : '';
    if (pathEl) pathEl.value = module ? (module.mappedPath || '') : '';
    if (visibleEl) visibleEl.checked = module ? (module.visibleToAll !== false) : true;
    var modal = document.getElementById('moduleModal');
    if (modal) modal.classList.add('show');
  }

  function closeModuleModal() {
    var modal = document.getElementById('moduleModal');
    if (modal) modal.classList.remove('show');
  }

  var editingAttachments = [];

  function renderAttachmentsList() {
    var list = document.getElementById('itemAttachmentsList');
    if (!list) return;
    list.innerHTML = '';
    if (!editingAttachments || !editingAttachments.length) {
      list.innerHTML = '<p class="setting-hint">暂无已导入文件</p>';
      return;
    }
    editingAttachments.forEach(function (att) {
      var row = document.createElement('div');
      row.className = 'attachment-row';
      row.innerHTML =
        '<span class="attachment-name" title="' + escapeHtml(att.name || '') + '">' + escapeHtml(att.name || '') + '</span>' +
        '<button type="button" class="btn btn-secondary btn-sm btn-open-attachment" data-aid="' + escapeHtml(att.id) + '">查看/编辑</button>' +
        '<button type="button" class="btn btn-danger btn-sm btn-del-attachment" data-aid="' + escapeHtml(att.id) + '">删</button>';
      list.appendChild(row);
    });

    list.querySelectorAll('.btn-open-attachment').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var aid = btn.getAttribute('data-aid');
        var att = editingAttachments.find(function (x) { return x.id === aid; });
        if (att) openAttachmentWindow(att);
      });
    });
    list.querySelectorAll('.btn-del-attachment').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var aid = btn.getAttribute('data-aid');
        editingAttachments = editingAttachments.filter(function (x) { return x.id !== aid; });
        renderAttachmentsList();
      });
    });

  }

  function openAttachmentWindow(att) {
    var win = window.open('', '_blank');
    if (!win) return;
    var safeName = (att.name || '文件');
    var lang = (att.type || '').toLowerCase();
    var content = att.content || '';
    var html =
      '<!doctype html><html lang="zh-CN"><head><meta charset="utf-8">' +
      '<title>' + safeName + '</title>' +
      '<style>body{margin:0;font-family:system-ui,Segoe UI,Arial,sans-serif;background:#1a1b26;color:#c0caf5;}'+
      '.toolbar{display:flex;gap:8px;padding:8px 12px;border-bottom:1px solid #414868;background:#24283b;align-items:center;}'+
      '.toolbar input{flex:1;padding:4px 8px;border-radius:6px;border:1px solid #414868;background:#1a1b26;color:#c0caf5;}'+
      '.toolbar button{padding:6px 12px;border-radius:6px;border:none;background:#7aa2f7;color:#1a1b26;cursor:pointer;}'+
      '.toolbar span{font-size:0.85rem;color:#a9b1d6;margin-right:4px;}'+
      '.editor{padding:8px;}textarea,pre{width:100%;box-sizing:border-box;border-radius:8px;border:1px solid #414868;background:#1a1b26;color:#c0caf5;font-family:Consolas,monospace;font-size:13px;line-height:1.5;min-height:calc(100vh - 60px);}'+
      'table{border-collapse:collapse;width:100%;}td,th{border:1px solid #414868;padding:4px 6px;font-size:12px;}tr:nth-child(even){background:#1f2335;}</style></head>' +
      '<body><div class="toolbar"><span>' + safeName + '</span><input id="searchBox" placeholder="搜索…"><button id="btnSave">保存</button></div>' +
      '<div class="editor" id="editorWrap"></div>' +
      '<script>' +
      'var attId=' + JSON.stringify(att.id) + ';' +
      'var type=' + JSON.stringify(lang) + ';' +
      'var raw=' + JSON.stringify(content) + ';' +
      'var wrap=document.getElementById("editorWrap");' +
      'var isCsv=type==="csv";' +
      'if(isCsv){' +
        'var rows=raw.split(/\\r?\\n/).map(function(r){return r.split(",");});' +
        'var tbl=document.createElement("table");' +
        'rows.forEach(function(r){var tr=document.createElement("tr");r.forEach(function(c){var td=document.createElement("td");td.textContent=c;tr.appendChild(td);});tbl.appendChild(tr);});' +
        'wrap.appendChild(tbl);' +
      '}else{' +
        'var ta=document.createElement("textarea");ta.id="editor";ta.value=raw;wrap.appendChild(ta);' +
      '}' +
      'document.getElementById("btnSave").onclick=function(){' +
        'var data=isCsv?Array.from(wrap.querySelectorAll("tr")).map(function(tr){return Array.from(tr.cells).map(function(td){return td.textContent;}).join(",");}).join("\\n"):document.getElementById("editor").value;' +
        'if(window.opener && window.opener.workbenchUpdateAttachmentContent){window.opener.workbenchUpdateAttachmentContent(attId,data);}' +
        'alert("已保存");' +
      '};' +
      'document.getElementById("searchBox").oninput=function(){' +
        'var q=this.value.toLowerCase();' +
        'if(!isCsv){var ta=document.getElementById("editor");var text=ta.value;var idx=text.toLowerCase().indexOf(q);if(q && idx>=0){ta.focus();ta.setSelectionRange(idx,idx+q.length);}return;}' +
        'Array.from(wrap.querySelectorAll("tr")).forEach(function(tr){var t=tr.textContent.toLowerCase();tr.style.display=!q||t.indexOf(q)!==-1?"":"none";});' +
      '};' +
      '<\/script></body></html>';
    win.document.write(html);
    win.document.close();
  }

  function openAttachmentsModal(item) {
    var attachments = item.attachments || [];
    if (!attachments.length) return;
    var win = window.open('', '_blank');
    if (!win) return;
    var html = '<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><title>附件列表</title><style>body{font-family:sans-serif;margin:20px;}</style></head><body><h2>附件列表</h2><ul>';
    attachments.forEach(function(att) {
      html += '<li><strong>' + escapeHtml(att.name || '未命名') + '</strong> <a href="javascript:;" onclick="window.opener.openAttachmentWindow(' + JSON.stringify(att) + ')">查看/编辑</a></li>';
    });
    html += '</ul></body></html>';
    win.document.write(html);
    win.document.close();
  }

  function openItemModal(moduleId, item) {
    var titleEl = document.getElementById('itemModalTitle');
    var idEl = document.getElementById('itemId');
    var midEl = document.getElementById('itemModuleId');
    var titleInput = document.getElementById('itemTitle');
    var urlInput = document.getElementById('itemUrl');
    var contentInput = document.getElementById('itemContent');
    var newTabInput = document.getElementById('itemNewTab');
    if (titleEl) titleEl.textContent = item ? '编辑内容' : '添加内容';
    if (idEl) idEl.value = item ? item.id : '';
    if (midEl) midEl.value = moduleId || '';
    if (titleInput) titleInput.value = item ? (item.title || '') : '';
    if (urlInput) urlInput.value = item ? (item.url || '') : '';
    if (contentInput) contentInput.value = item ? (item.content || '') : '';
    if (newTabInput) newTabInput.checked = item ? item.newTab !== false : true;
    var itemShowContentEl = document.getElementById('itemShowContent');
    if (itemShowContentEl) itemShowContentEl.checked = item ? (item.showContent !== false) : true;
    var itemVisibleEl = document.getElementById('itemVisibleToAll');
    if (itemVisibleEl) itemVisibleEl.checked = item ? (item.visibleToAll !== false) : true;
    document.getElementById('itemImportFile').value = '';
    editingAttachments = (item && Array.isArray(item.attachments)) ? item.attachments : [];
    if (item && !Array.isArray(item.attachments)) item.attachments = editingAttachments;
    renderAttachmentsList();
    var modal = document.getElementById('itemModal');
    if (modal) modal.classList.add('show');
  }

  function closeItemModal() {
    var modal = document.getElementById('itemModal');
    if (modal) modal.classList.remove('show');
  }

  function openCommentsModal(item, moduleId) {
    window._commentsTarget = { item: item, moduleId: moduleId };
    var list = document.getElementById('commentsList');
    if (list) {
      list.innerHTML = '';
      (item.comments || []).forEach(function (c) {
        var div = document.createElement('div');
        div.className = 'comment-item';
        div.innerHTML =
          '<strong>' + escapeHtml(c.user || '') + '</strong> ' + escapeHtml(c.text || '') +
          ' <span class="comment-time">' + (c.time || '') + '</span>' +
          (canEdit() ? ' <button type="button" class="btn btn-icon small btn-danger btn-delete-comment" data-cid="' + escapeHtml(c.id) + '" title="删除">🗑️</button>' : '');
        list.appendChild(div);
      });
      list.querySelectorAll('.btn-delete-comment').forEach(function (btn) {
        btn.addEventListener('click', function () {
          var cid = btn.getAttribute('data-cid');
          item.comments = (item.comments || []).filter(function (x) { return x.id !== cid; });
          persistState();
          openCommentsModal(item, moduleId);
        });
      });
    }
    var input = document.getElementById('commentInput');
    if (input) input.value = '';
    var modal = document.getElementById('commentsModal');
    if (modal) modal.classList.add('show');
  }

  function closeCommentsModal() {
    var modal = document.getElementById('commentsModal');
    if (modal) modal.classList.remove('show');
  }

  function openLoginModal() {
    document.getElementById('loginUser').value = '';
    document.getElementById('loginPass').value = '';
    document.getElementById('loginHint').textContent = '';
    document.getElementById('loginModal').classList.add('show');
  }

  function closeLoginModal() {
    document.getElementById('loginModal').classList.remove('show');
  }

  function buildNormalModuleCard(mod) {
    var items = (mod.items || []).filter(function (it) { return (it.visibleToAll !== false || canEdit()) && matchSearch(mod, it); });
    var collapsed = state.collapsedModules[mod.id];
    var card = document.createElement('div');
    card.className = 'module-card card' + (collapsed ? ' collapsed' : '');
    card.dataset.moduleId = mod.id;
    card.draggable = canEdit();
    card.innerHTML =
      '<div class="card-header">' +
        '<button type="button" class="btn btn-icon btn-collapse" title="' + (collapsed ? '展开' : '收起') + '">' + (collapsed ? '▶' : '▼') + '</button>' +
        (canEdit() ? '<span class="drag-handle" title="拖动排序">⋮⋮</span>' : '') +
        '<span class="card-title">' + escapeHtml(mod.name || '未命名') + '</span>' +
        (canEdit() ? '<div class="card-actions">' +
          '<button type="button" class="btn btn-icon btn-edit-module" title="编辑">✏️</button>' +
          '<button type="button" class="btn btn-icon btn-danger btn-delete-module" title="删除模块">🗑️</button>' +
        '</div>' : '') +
      '</div>' +
      '<div class="module-items"></div>' +
      (canEdit() ? '<button type="button" class="btn btn-secondary btn-add-item">+ 添加内容</button>' : '');
    card.querySelector('.btn-collapse').addEventListener('click', function () {
      state.collapsedModules[mod.id] = !state.collapsedModules[mod.id];
      persistState();
      renderModules();
    });
    var itemsEl = card.querySelector('.module-items');
    items.forEach(function (it) {
      var hasUrl = !!(it.url && it.url.trim());
      var hasContent = !!(it.content && it.content.trim());
      var showContent = it.showContent !== false;
      var typeClass = hasUrl && hasContent ? 'item-type-both' : (hasUrl ? 'item-type-link' : 'item-type-text');
      var typeIcon = hasUrl && hasContent ? '🔗📄' : (hasUrl ? '🔗' : '📄');
      var row = document.createElement('div');
      row.className = 'module-item item-box ' + typeClass + (hasUrl ? ' has-link' : '');
      row.dataset.itemId = it.id;
      row.draggable = canEdit();
      var link = hasUrl ? ('<a href="' + escapeHtml(it.url) + '" target="_blank" rel="noopener">' + escapeHtml(it.title || '') + '</a>') : escapeHtml(it.title || '');
      var tooltipDesc = (hasContent && showContent) ? ('<span class="item-desc-tooltip">' + linkify(escapeHtml(it.content)) + '</span>') : '';
      var actionsHtml;
      var hasAttachments = it.attachments && it.attachments.length > 0;
      if (canEdit()) {
        actionsHtml =
          '<div class="item-actions">' +
            '<button type="button" class="btn btn-icon small btn-edit-item" title="编辑">✏️</button>' +
            '<button type="button" class="btn btn-icon small btn-comment-item" title="评论">💬</button>' +
            (hasAttachments ? '<button type="button" class="btn btn-icon small btn-attachment-item" title="附件">📎</button>' : '') +
            '<button type="button" class="btn btn-icon small btn-danger btn-delete-item" title="删除">🗑️</button>' +
          '</div>';
      } else {
        actionsHtml =
          '<div class="item-actions">' +
            '<button type="button" class="btn btn-icon small btn-comment-item" title="评论">💬</button>' +
            (hasAttachments ? '<button type="button" class="btn btn-icon small btn-attachment-item" title="附件">📎</button>' : '') +
            (it.comments && it.comments.length ? '<span class="comment-badge">' + it.comments.length + '</span>' : '') +
          '</div>';
      }
      row.innerHTML =
        '<span class="item-type-icon" title="' + (hasUrl ? '链接' : '正文') + '">' + typeIcon + '</span>' +
        (canEdit() ? '<span class="drag-handle small">⋮⋮</span>' : '') +
        '<span class="item-title-wrap"><span class="item-title">' + (hasUrl ? link : escapeHtml(it.title || '')) + '</span>' + tooltipDesc + '</span>' +
        actionsHtml;
      if (!hasUrl) {
        row.addEventListener('click', function (e) {
          if (e.target.closest('.item-actions')) return;
          if (canEdit()) openItemModal(mod.id, it);
          else openViewContentModal(it);
        });
      } else {
        row.querySelectorAll('a').forEach(function (a) { a.addEventListener('click', function (e) { e.stopPropagation(); }); });
      }
      row.querySelectorAll('.btn-edit-item').forEach(function (btn) {
        btn.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); openItemModal(mod.id, it); });
      });
      row.querySelectorAll('.btn-delete-item').forEach(function (btn) {
        btn.addEventListener('click', function (e) {
          e.preventDefault(); e.stopPropagation();
          if (confirm('确定删除该内容？')) {
            mod.items = (mod.items || []).filter(function (x) { return x.id !== it.id; });
            persistState();
            renderModules();
          }
        });
      });
      row.querySelectorAll('.btn-comment-item').forEach(function (btn) {
        btn.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); openCommentsModal(it, mod.id); });
      });
      row.querySelectorAll('.btn-attachment-item').forEach(function (btn) {
        btn.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); openAttachmentsModal(it); });
      });
      if (canEdit()) {
        row.addEventListener('dragstart', function (e) {
          e.stopPropagation();
          e.dataTransfer.setData('text/plain', 'item:' + mod.id + ':' + it.id);
          e.dataTransfer.effectAllowed = 'move';
        });
        row.addEventListener('dragover', function (e) {
          e.preventDefault();
          e.stopPropagation();
          e.dataTransfer.dropEffect = 'move';
          row.classList.add('drag-over');
        });
        row.addEventListener('dragleave', function () { row.classList.remove('drag-over'); });
        row.addEventListener('drop', function (e) {
          e.preventDefault();
          e.stopPropagation();
          row.classList.remove('drag-over');
          var raw = e.dataTransfer.getData('text/plain');
          if (!raw || raw.indexOf('item:') !== 0) return;
          var parts = raw.split(':');
          if (parts.length < 3) return;
          var fromModId = parts[1], fromItemId = parts[2];
          if (fromModId !== mod.id) return;
          var arr = mod.items || [];
          var fromIdx = arr.findIndex(function (x) { return x.id === fromItemId; });
          var toIdx = arr.findIndex(function (x) { return x.id === it.id; });
          if (fromIdx === -1 || toIdx === -1 || fromIdx === toIdx) return;
          var itm = arr.splice(fromIdx, 1)[0];
          arr.splice(toIdx, 0, itm);
          mod.items = arr;
          persistState();
          renderModules();
        });
      }
      itemsEl.appendChild(row);
    });
    card.querySelectorAll('.btn-edit-module').forEach(function (btn) {
      btn.addEventListener('click', function () { openModuleModal(mod); });
    });
    card.querySelectorAll('.btn-delete-module').forEach(function (btn) {
      btn.addEventListener('click', function () {
        if (confirm('确定删除整个模块？')) {
          state.modules = state.modules.filter(function (x) { return x.id !== mod.id; });
          persistState();
          renderModules();
        }
      });
    });
    card.querySelectorAll('.btn-add-item').forEach(function (btn) {
      btn.addEventListener('click', function () { openItemModal(mod.id, null); });
    });
    if (canEdit()) {
      card.addEventListener('dragstart', function (e) {
        e.dataTransfer.setData('text/plain', 'module:' + mod.id);
        e.dataTransfer.effectAllowed = 'move';
      });
      card.addEventListener('dragover', function (e) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        card.classList.add('drag-over');
      });
      card.addEventListener('dragleave', function () { card.classList.remove('drag-over'); });
      card.addEventListener('drop', function (e) {
        e.preventDefault();
        card.classList.remove('drag-over');
        var raw = e.dataTransfer.getData('text/plain');
        if (!raw) return;
        if (raw.indexOf('module:') === 0) {
          var fromId = raw.slice(7);
          var fromIdx = state.modules.findIndex(function (x) { return x.id === fromId; });
          var toIdx = state.modules.findIndex(function (x) { return x.id === mod.id; });
          if (fromIdx === -1 || toIdx === -1 || fromIdx === toIdx) return;
          var list = state.modules.slice();
          var item = list.splice(fromIdx, 1)[0];
          list.splice(toIdx, 0, item);
          state.modules = list;
          state.modules.forEach(function (m, i) { m.order = i; });
          persistState();
          renderModules();
        }
      });
    }
    return card;
  }

  function renderMappedTree(container, nodes, openPath) {
    if (!nodes || !nodes.length) return;
    nodes.forEach(function (node) {
      if (node.type === 'file') {
        var fileRow = document.createElement('div');
        fileRow.className = 'mapped-file';
        fileRow.title = node.path || node.name;
        fileRow.innerHTML = '<span class="file-icon">📄</span><span>' + escapeHtml(node.name) + '</span>';
        fileRow.addEventListener('click', function () {
          if (openPath && node.path) openPath(node.path);
        });
        container.appendChild(fileRow);
      } else {
        var folder = document.createElement('div');
        folder.className = 'mapped-folder';
        var children = document.createElement('div');
        children.className = 'mapped-folder-children';
        folder.appendChild(children);
        var nameRow = document.createElement('div');
        nameRow.className = 'mapped-folder-name';
        nameRow.innerHTML = '<span class="toggle">▼</span><span>' + escapeHtml(node.name) + '</span>';
        nameRow.addEventListener('click', function () {
          folder.classList.toggle('collapsed');
        });
        folder.insertBefore(nameRow, children);
        renderMappedTree(children, node.children || [], openPath);
        container.appendChild(folder);
      }
    });
  }

  function buildMappedModuleCard(mod, tree) {
    var collapsed = state.collapsedModules[mod.id];
    var card = document.createElement('div');
    card.className = 'module-card card' + (collapsed ? ' collapsed' : '');
    card.dataset.moduleId = mod.id;
    card.draggable = canEdit();
    card.innerHTML =
      '<div class="card-header">' +
        '<button type="button" class="btn btn-icon btn-collapse" title="' + (collapsed ? '展开' : '收起') + '">' + (collapsed ? '▶' : '▼') + '</button>' +
        (canEdit() ? '<span class="drag-handle" title="拖动排序">⋮⋮</span>' : '') +
        '<span class="card-title">' + escapeHtml(mod.name || '未命名') + '</span>' +
        (canEdit() ? '<div class="card-actions">' +
          '<button type="button" class="btn btn-icon btn-edit-module" title="编辑">✏️</button>' +
          '<button type="button" class="btn btn-icon btn-danger btn-delete-module" title="删除模块">🗑️</button>' +
        '</div>' : '') +
      '</div>' +
      '<div class="module-items mapped-tree"></div>';
    card.querySelector('.btn-collapse').addEventListener('click', function () {
      state.collapsedModules[mod.id] = !state.collapsedModules[mod.id];
      persistState();
      renderModules();
    });
    var openPathFn = window.workbenchApi && window.workbenchApi.openPath ? function (p) { window.workbenchApi.openPath(p); } : null;
    renderMappedTree(card.querySelector('.mapped-tree'), tree, openPathFn);
    card.querySelectorAll('.btn-edit-module').forEach(function (btn) {
      btn.addEventListener('click', function () { openModuleModal(mod); });
    });
    card.querySelectorAll('.btn-delete-module').forEach(function (btn) {
      btn.addEventListener('click', function () {
        if (confirm('确定删除整个模块？')) {
          state.modules = state.modules.filter(function (x) { return x.id !== mod.id; });
          persistState();
          renderModules();
        }
      });
    });
    if (canEdit()) {
      card.addEventListener('dragstart', function (e) {
        e.dataTransfer.setData('text/plain', 'module:' + mod.id);
        e.dataTransfer.effectAllowed = 'move';
      });
      card.addEventListener('dragover', function (e) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        card.classList.add('drag-over');
      });
      card.addEventListener('dragleave', function () { card.classList.remove('drag-over'); });
      card.addEventListener('drop', function (e) {
        e.preventDefault();
        card.classList.remove('drag-over');
        var raw = e.dataTransfer.getData('text/plain');
        if (!raw || raw.indexOf('module:') !== 0) return;
        var fromId = raw.slice(7);
        var fromIdx = state.modules.findIndex(function (x) { return x.id === fromId; });
        var toIdx = state.modules.findIndex(function (x) { return x.id === mod.id; });
        if (fromIdx === -1 || toIdx === -1 || fromIdx === toIdx) return;
        var list = state.modules.slice();
        var item = list.splice(fromIdx, 1)[0];
        list.splice(toIdx, 0, item);
        state.modules = list;
        state.modules.forEach(function (m, i) { m.order = i; });
        persistState();
        renderModules();
      });
    }
    return card;
  }

  function renderModules() {
    if (!mainGrid) return;
    var q = getSearchText();
    var sorted = state.modules.slice().sort(function (a, b) { return (a.order || 0) - (b.order || 0); });
    sorted = sorted.filter(function (mod) { return mod.visibleToAll !== false || canEdit(); });
    var hasMapped = window.workbenchApi && sorted.some(function (m) { return m.mappedPath; });

    if (!hasMapped) {
      mainGrid.innerHTML = '';
      if (sorted.length === 0 && !canEdit()) {
        var hint = document.createElement('p');
        hint.className = 'empty-hint';
        hint.textContent = '登录后可添加模块与内容';
        mainGrid.appendChild(hint);
        return;
      }
      sorted.forEach(function (mod) {
        var items = (mod.items || []).filter(function (it) { return (it.visibleToAll !== false || canEdit()) && matchSearch(mod, it); });
        var hideBySearch = q && !matchSearch(mod, null) && items.length === 0;
        if (hideBySearch) return;
        mainGrid.appendChild(buildNormalModuleCard(mod));
      });
      return;
    }

    var promises = sorted.map(function (mod) {
      if (mod.mappedPath && window.workbenchApi) {
        return window.workbenchApi.getMappedFolderTree(mod.mappedPath).then(function (tree) {
          return { mod: mod, tree: Array.isArray(tree) ? tree : null };
        }).catch(function () { return { mod: mod, tree: null }; });
      }
      return Promise.resolve({ mod: mod, tree: null });
    });
    Promise.all(promises).then(function (withTrees) {
      mainGrid.innerHTML = '';
      if (sorted.length === 0 && !canEdit()) {
        var hint = document.createElement('p');
        hint.className = 'empty-hint';
        hint.textContent = '登录后可添加模块与内容';
        mainGrid.appendChild(hint);
        return;
      }
      withTrees.forEach(function (pair) {
        var items = pair.tree ? [] : (pair.mod.items || []).filter(function (it) { return (it.visibleToAll !== false || canEdit()) && matchSearch(pair.mod, it); });
        var hideBySearch = q && !matchSearch(pair.mod, null) && items.length === 0 && (!pair.tree || pair.tree.length === 0);
        if (hideBySearch) return;
        if (pair.tree && pair.tree.length > 0) {
          mainGrid.appendChild(buildMappedModuleCard(pair.mod, pair.tree));
        } else {
          mainGrid.appendChild(buildNormalModuleCard(pair.mod));
        }
      });
    });
  }

  function bindModuleModal() {
    var btnAdd = document.getElementById('btnAddModule');
    if (btnAdd) btnAdd.addEventListener('click', function () { openModuleModal(null); });
    document.getElementById('btnCloseModuleModal').addEventListener('click', closeModuleModal);
    document.getElementById('btnCancelModule').addEventListener('click', closeModuleModal);
    document.getElementById('moduleModal').addEventListener('click', function (e) { if (e.target.id === 'moduleModal') closeModuleModal(); });
    document.getElementById('btnSaveModule').addEventListener('click', function () {
      var idVal = document.getElementById('moduleId').value;
      var nameVal = (document.getElementById('moduleName').value || '').trim() || '未命名';
      var mappedPath = (document.getElementById('moduleMappedPath').value || '').trim();
      var visibleToAll = document.getElementById('moduleVisibleToAll').checked;
      if (idVal) {
        var m = state.modules.find(function (x) { return x.id === idVal; });
        if (m) { m.name = nameVal; m.mappedPath = mappedPath || undefined; m.visibleToAll = visibleToAll; }
      } else {
        state.modules.push({
          id: id(),
          name: nameVal,
          order: state.modules.length,
          mappedPath: mappedPath || undefined,
          visibleToAll: visibleToAll,
          items: []
        });
      }
      persistState();
      renderModules();
      closeModuleModal();
    });
  }

  function bindItemModal() {
    document.getElementById('btnCloseItemModal').addEventListener('click', closeItemModal);
    document.getElementById('btnCancelItem').addEventListener('click', closeItemModal);
    document.getElementById('itemModal').addEventListener('click', function (e) { if (e.target.id === 'itemModal') closeItemModal(); });
    document.getElementById('btnSaveItem').addEventListener('click', function () {
      var itemId = document.getElementById('itemId').value;
      var moduleId = document.getElementById('itemModuleId').value;
      var title = (document.getElementById('itemTitle').value || '').trim() || '未命名';
      var url = (document.getElementById('itemUrl').value || '').trim();
      var content = (document.getElementById('itemContent').value || '').trim();
      var showContent = document.getElementById('itemShowContent').checked;
      var visibleToAll = document.getElementById('itemVisibleToAll').checked;
      var newTab = document.getElementById('itemNewTab').checked;
      var mod = state.modules.find(function (x) { return x.id === moduleId; });
      if (!mod) { closeItemModal(); return; }
      if (!mod.items) mod.items = [];
      if (itemId) {
        var it = mod.items.find(function (x) { return x.id === itemId; });
        if (it) { it.title = title; it.url = url; it.content = content; it.showContent = showContent; it.visibleToAll = visibleToAll; it.newTab = newTab; it.attachments = editingAttachments.slice(); }
      } else {
        mod.items.push({ id: id(), title: title, url: url, content: content, showContent: showContent, visibleToAll: visibleToAll, newTab: newTab, comments: [], attachments: editingAttachments.slice() });
      }
      persistState();
      renderModules();
      closeItemModal();
    });
    document.getElementById('btnImportContent').addEventListener('click', function () {
      document.getElementById('itemImportFile').click();
    });
    document.getElementById('itemImportFile').addEventListener('change', function () {
      var file = this.files && this.files[0];
      if (!file) return;
      var reader = new FileReader();
      reader.onload = function () {
        var add = typeof reader.result === 'string' ? reader.result : '';
        var extMatch = (file.name || '').split('.');
        var ext = extMatch.length > 1 ? extMatch.pop().toLowerCase() : '';
        editingAttachments = editingAttachments || [];
        editingAttachments.push({
          id: id(),
          name: file.name || ('文件.' + (ext || 'txt')),
          type: ext,
          content: add
        });
        renderAttachmentsList();
      };
      reader.readAsText(file, 'UTF-8');
      this.value = '';
    });

  }

  function bindCommentsModal() {
    document.getElementById('btnCloseCommentsModal').addEventListener('click', closeCommentsModal);
    document.getElementById('commentsModal').addEventListener('click', function (e) { if (e.target.id === 'commentsModal') closeCommentsModal(); });
    document.getElementById('btnAddComment').addEventListener('click', function () {
      var target = window._commentsTarget;
      if (!target) return;
      var input = document.getElementById('commentInput');
      var text = (input && input.value || '').trim();
      if (!text) return;
      var nick = (document.getElementById('commentNickname') && document.getElementById('commentNickname').value || '').trim() || '游客';
      if (currentUser) nick = currentUser;
      if (!canComment()) {
        alert('请先登录后再发表评论。');
        closeCommentsModal();
        openLoginModal();
        return;
      }
      target.item.comments = target.item.comments || [];
      target.item.comments.push({ id: id(), user: nick, text: text, time: new Date().toLocaleString() });
      persistState();
      openCommentsModal(target.item, target.moduleId);
    });
  }

  function bindViewContentModal() {
    document.getElementById('btnCloseViewContentModal').addEventListener('click', closeViewContentModal);
    document.getElementById('viewContentModal').addEventListener('click', function (e) { if (e.target.id === 'viewContentModal') closeViewContentModal(); });
  }

  function bindLoginModal() {
    document.getElementById('btnLogin').addEventListener('click', function () {
      if (currentUser) {
        currentUser = '';
        currentRole = '';
        localStorage.removeItem(STORAGE_USER);
        localStorage.removeItem(STORAGE_USER_ROLE);
        updateUserUI();
        renderModules();
      } else {
        openLoginModal();
      }
    });
    var overlayBtn = document.getElementById('btnOverlayLogin');
    if (overlayBtn) {
      overlayBtn.addEventListener('click', function () {
        openLoginModal();
      });
    }
    document.getElementById('btnCloseLoginModal').addEventListener('click', closeLoginModal);
    document.getElementById('loginModal').addEventListener('click', function (e) { if (e.target.id === 'loginModal') closeLoginModal(); });
    function performLogin() {
      var user = (document.getElementById('loginUser').value || '').trim();
      var pass = (document.getElementById('loginPass').value || '').trim();
      var guestList = (state.guestUsers || '').split('\n').map(function (line) {
        var parts = (line || '').trim().split(':');
        return { user: parts[0] || '', pass: parts[1] || '', role: 'guest' };
      }).filter(function (x) { return x.user && x.pass; });
      var adminList = (state.allowedUsers || '').split('\n').map(function (line) {
        var parts = (line || '').trim().split(':');
        return { user: parts[0] || '', pass: parts[1] || '', role: 'admin' };
      }).filter(function (x) { return x.user && x.pass; });
      if (guestList.length === 0 && adminList.length === 0) {
        guestList = [{ user: 'admin', pass: 'admin', role: 'guest' }];
        adminList = [{ user: '123', pass: '123', role: 'admin' }];
      }
      var all = guestList.concat(adminList);
      var matched = all.find(function (x) { return x.user === user && x.pass === pass; });
      if (matched) {
        currentUser = user;
        currentRole = matched.role || 'admin';
        localStorage.setItem(STORAGE_USER, user);
        localStorage.setItem(STORAGE_USER_ROLE, currentRole);
        closeLoginModal();
        updateUserUI();
        renderModules();
      } else {
        document.getElementById('loginHint').textContent = '用户名或密码错误，或未在设置中配置允许的用户。';
      }
    }
    document.getElementById('loginForm').addEventListener('submit', function (e) {
      e.preventDefault();
      performLogin();
    });
  }

  function updateUserUI() {
    // 更新标题
    var headerTitle = document.getElementById('headerTitle');
    if (headerTitle) {
      var customTitle = localStorage.getItem('workbench_custom_title');
      var titleText = customTitle || '我的工作台';
      headerTitle.textContent = titleText;
      // 如果是管理员，使标题可编辑
      if (canEdit() && !headerTitle.classList.contains('editable-setup')) {
        headerTitle.classList.add('editable-setup');
        // 创建可编辑的包装器
        var wrapper = document.createElement('span');
        wrapper.className = 'editable-title-wrapper';
        wrapper.innerHTML = '<span class="title-text">' + escapeHtml(titleText) + '</span> <button type="button" class="btn btn-icon small btn-edit-title" title="修改标题">✏️</button>';
        headerTitle.innerHTML = '';
        headerTitle.appendChild(wrapper);
        // 添加编辑事件
        wrapper.querySelector('.btn-edit-title').addEventListener('click', function() {
          var textSpan = wrapper.querySelector('.title-text');
          var currentText = textSpan.textContent;
          var input = document.createElement('input');
          input.type = 'text';
          input.value = currentText;
          input.className = 'title-edit-input';
          // 替换文本为输入框
          textSpan.replaceWith(input);
          input.focus();
          input.select();
          // 保存和取消处理
          function save() {
            var newText = input.value.trim();
            if (newText) {
              textSpan.textContent = newText;
              // 更新页面标题和存储
              document.title = newText + ' - 我的工作台';
              localStorage.setItem('workbench_custom_title', newText);
            }
            input.replaceWith(textSpan);
          }
          function cancel() {
            input.replaceWith(textSpan);
          }
          input.addEventListener('blur', save);
          input.addEventListener('keydown', function(e) {
            if (e.key === 'Enter') save();
            if (e.key === 'Escape') cancel();
          });
        });
      }
    }

    var btnSettings = document.getElementById('btnSettings');
    if (btnSettings) btnSettings.style.display = canEdit() ? '' : 'none';
    if (footerBar) footerBar.style.display = canEdit() ? '' : 'none';
    if (appRoot) appRoot.style.display = currentUser ? '' : 'none';
    if (loginOverlay) loginOverlay.style.display = currentUser ? 'none' : '';
    if (!userArea) return;
    if (currentUser) {
      userArea.innerHTML = '<span class="user-name">' + escapeHtml(currentUser) + '</span> <button type="button" class="btn btn-secondary btn-sm" id="btnLogout">退出</button>';
      var logout = document.getElementById('btnLogout');
      if (logout) logout.addEventListener('click', function () {
        currentUser = '';
        currentRole = '';
        localStorage.removeItem(STORAGE_USER);
        localStorage.removeItem(STORAGE_USER_ROLE);
        updateUserUI();
        renderModules();
      });
    } else {
      userArea.innerHTML = '<button type="button" class="btn btn-secondary btn-sm" id="btnLogin">登录</button>';
      var loginBtn = document.getElementById('btnLogin');
      if (loginBtn) loginBtn.addEventListener('click', openLoginModal);
    }
  }

  function openViewContentModal(item) {
    document.getElementById('viewContentTitle').textContent = item.title || '查看内容';
    document.getElementById('viewContentBody').innerHTML = '<div class="view-content-text">' + linkify(escapeHtml(item.content || '（无正文）')) + '</div>';
    document.getElementById('viewContentModal').classList.add('show');
  }

  function closeViewContentModal() {
    document.getElementById('viewContentModal').classList.remove('show');
  }

  if (searchInput) searchInput.addEventListener('input', function () { renderModules(); });
  if (footerBar) footerBar.style.display = canEdit() ? '' : 'none';

  var settingsPanel = document.getElementById('settingsPanel');
  var settingsOverlay = document.getElementById('settingsOverlay');
  function openSettings() {
    document.getElementById('layoutCols').value = state.layout.cols;
    document.getElementById('layoutGap').value = state.layout.gap;
    document.getElementById('layoutAlign').value = state.layout.align;
    document.getElementById('bgType').value = state.bg.type;
    document.getElementById('bgColor').value = state.bg.color;
    document.getElementById('bgImage').value = state.bg.image || '';
    document.getElementById('bgGradient').value = state.bg.gradient || '';
    document.getElementById('guestUsers').value = state.guestUsers || '';
    document.getElementById('adminUsers').value = state.allowedUsers || '';
    if (state.bg.image && state.bg.image.indexOf('data:') === 0) {
      document.getElementById('bgUploadHint').textContent = '当前使用本地上传的图片';
    } else {
      document.getElementById('bgUploadHint').textContent = '';
    }
    document.getElementById('bgImageFile').value = '';
    toggleBgInputs(state.bg.type);
    var gallery = document.getElementById('bgGallery');
    if (gallery) {
      gallery.innerHTML = '';
      BG_LIBRARY.forEach(function (item) {
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'bg-gallery-item' + (state.bg.type === 'image' && state.bg.image === item.url ? ' active' : '');
        btn.title = item.name;
        btn.innerHTML = '<img src="' + item.url + '" alt="">';
        btn.addEventListener('click', function () {
          state.bg.type = 'image';
          state.bg.image = item.url;
          persistState();
          applyBackground();
          openSettings();
        });
        gallery.appendChild(btn);
      });
    }
    if (window.workbenchApi) {
      document.getElementById('dataPathSection').style.display = '';
      window.workbenchApi.getConfig().then(function (cfg) {
        document.getElementById('dataPathInput').value = (cfg && cfg.dataPath) || '';
      });
    }
    settingsPanel.classList.add('open');
    settingsOverlay.classList.add('show');
  }
  function closeSettings() {
    settingsPanel.classList.remove('open');
    settingsOverlay.classList.remove('show');
  }
  function toggleBgInputs(type) {
    document.getElementById('bgColorWrap').classList.toggle('hidden', type !== 'color');
    document.getElementById('bgImageWrap').classList.toggle('hidden', type !== 'image');
    document.getElementById('bgGradientWrap').classList.toggle('hidden', type !== 'gradient');
  }
  document.getElementById('btnSettings').addEventListener('click', openSettings);
  document.getElementById('btnCloseSettings').addEventListener('click', closeSettings);
  settingsOverlay.addEventListener('click', closeSettings);
  document.getElementById('bgType').addEventListener('change', function () { toggleBgInputs(this.value); });
  document.getElementById('btnApplySettings').addEventListener('click', function () {
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
      gradient: (document.getElementById('bgGradient').value || '').trim() || defaultBg.gradient
    };
    state.guestUsers = (document.getElementById('guestUsers').value || '').trim();
    state.allowedUsers = (document.getElementById('adminUsers').value || '').trim();
    persistState();
    applyLayout();
    applyBackground();
    closeSettings();
  });
  document.getElementById('bgImageFile').addEventListener('change', function () {
    var file = this.files && this.files[0];
    if (!file || !file.type.match(/^image\//)) return;
    var hint = document.getElementById('bgUploadHint');
    hint.textContent = '处理中…';
    var img = new Image();
    var url = URL.createObjectURL(file);
    img.onload = function () {
      URL.revokeObjectURL(url);
      var w = img.width, h = img.height, maxW = 1920, maxH = 1080;
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
        persistState();
        applyBackground();
        hint.textContent = '已使用本地上传的图片';
      } catch (_) { hint.textContent = '上传失败'; }
      this.value = '';
    };
    img.onerror = function () { URL.revokeObjectURL(url); hint.textContent = '上传失败'; };
    img.src = url;
  });

  var btnExportState = document.getElementById('btnExportState');
  if (btnExportState) btnExportState.addEventListener('click', exportStateToFile);
  var btnImportState = document.getElementById('btnImportState');
  var importStateFile = document.getElementById('importStateFile');
  if (btnImportState && importStateFile) {
    btnImportState.addEventListener('click', function () { importStateFile.click(); });
    importStateFile.addEventListener('change', function () {
      var f = this.files && this.files[0];
      if (!f) return;
      importStateFromFile(f)
        .then(function () { alert('导入成功'); })
        .catch(function () { alert('导入失败：文件格式不正确'); })
        .finally(function () { importStateFile.value = ''; });
    });
  }

  bindModuleModal();
  bindItemModal();
  bindCommentsModal();
  bindViewContentModal();
  bindLoginModal();
  updateUserUI();
  applyLayout();
  applyBackground();
  renderModules();

  if (window.workbenchApi) {
    window.workbenchApi.getConfig().then(function (cfg) {
      if (document.getElementById('dataPathSection')) document.getElementById('dataPathSection').style.display = '';
      if (document.getElementById('dataPathInput') && cfg && cfg.dataPath) document.getElementById('dataPathInput').value = cfg.dataPath;
    });
    window.workbenchApi.loadState().then(function (data) {
      if (data) {
        state = migrateState(data);
        if (data.allowedUsers !== undefined) state.allowedUsers = data.allowedUsers;
        if (data.guestUsers !== undefined) state.guestUsers = data.guestUsers;
        if (data.collapsedModules) state.collapsedModules = data.collapsedModules;
      }
      applyLayout();
      applyBackground();
      renderModules();
    }).catch(function () {});
    var chooseBtn = document.getElementById('btnChooseDataPath');
    if (chooseBtn) chooseBtn.addEventListener('click', function () {
      window.workbenchApi.chooseDataPath().then(function (path) {
        if (!path) return;
        window.workbenchApi.setConfig({ dataPath: path });
        document.getElementById('dataPathInput').value = path;
        window.workbenchApi.loadState().then(function (data) {
          if (data) state = migrateState(data);
          renderModules();
        });
      });
    });
  } else {
    var rawState = load(STORAGE_STATE, null);
    if (rawState) {
      if (rawState.modules) state.modules = rawState.modules;
      if (rawState.allowedUsers !== undefined) state.allowedUsers = rawState.allowedUsers;
      if (rawState.collapsedModules) state.collapsedModules = rawState.collapsedModules;
    }
    if (typeof state.allowedUsers !== 'string') state.allowedUsers = '';
    fetchFirstOk(CLOUD_STATE_URLS, { method: 'GET' })
      .then(function (pair) { return pair.res.text(); })
      .then(function (text) {
        if (!text || text === 'null') return;
        var data = JSON.parse(text);
        if (data && (data.modules || data.layout || data.allowedUsers != null || data.guestUsers != null)) {
          state = migrateState(data);
          if (data.allowedUsers !== undefined) state.allowedUsers = data.allowedUsers;
          if (data.guestUsers !== undefined) state.guestUsers = data.guestUsers;
          if (data.collapsedModules) state.collapsedModules = data.collapsedModules || {};
          applyLayout();
          applyBackground();
          renderModules();
        }
      })
      .catch(function () { showCloudSyncUnavailable(); });
  }

  function showCloudSyncUnavailable() {
    // 黄色提示框已移除
  }

  // 供附件/外部窗口保存回写
  window.workbenchUpdateAttachmentContent = function (attId, newContent) {
    try {
      state.modules.forEach(function (m) {
        (m.items || []).forEach(function (it) {
          var list = it.attachments || [];
          var a = list.find(function (x) { return x.id === attId; });
          if (a) a.content = String(newContent == null ? '' : newContent);
        });
      });
      persistState();
    } catch (_) {}
  };
  window.openAttachmentWindow = openAttachmentWindow;

  function exportStateToFile() {
    var toSave = {
      layout: state.layout,
      bg: state.bg,
      modules: state.modules,
      allowedUsers: state.allowedUsers,
      guestUsers: state.guestUsers || '',
      collapsedModules: state.collapsedModules || {}
    };
    var blob = new Blob([JSON.stringify(toSave, null, 2)], { type: 'application/json;charset=utf-8' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'workbench-state.json';
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function importStateFromFile(file) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function () {
        try {
          var text = typeof reader.result === 'string' ? reader.result : '';
          var data = JSON.parse(text);
          state = migrateState(data);
          if (data.allowedUsers !== undefined) state.allowedUsers = data.allowedUsers;
          if (data.guestUsers !== undefined) state.guestUsers = data.guestUsers;
          if (data.collapsedModules) state.collapsedModules = data.collapsedModules || {};
          persistState();
          applyLayout();
          applyBackground();
          renderModules();
          resolve();
        } catch (e) {
          reject(e);
        }
      };
      reader.onerror = reject;
      reader.readAsText(file, 'UTF-8');
    });
  }
})();