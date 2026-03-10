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
    '/api/workbench-state',
    '/.netlify/functions/workbench-state'
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
      })
        .catch(function (e) { console.warn('云端保存失败', e); });
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
        '<button type="button" class="btn btn-info btn-sm btn-view-attachment" data-aid="' + escapeHtml(att.id) + '">查看</button>' +
        '<button type="button" class="btn btn-secondary btn-sm btn-edit-attachment" data-aid="' + escapeHtml(att.id) + '">编辑</button>' +
        '<button type="button" class="btn btn-danger btn-sm btn-del-attachment" data-aid="' + escapeHtml(att.id) + '">删</button>';
      list.appendChild(row);
    });

    list.querySelectorAll('.btn-view-attachment').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var aid = btn.getAttribute('data-aid');
        var att = editingAttachments.find(function (x) { return x.id === aid; });
        if (att) openAttachmentViewWindow(att);
      });
    });
    list.querySelectorAll('.btn-edit-attachment').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var aid = btn.getAttribute('data-aid');
        var att = editingAttachments.find(function (x) { return x.id === aid; });
        if (att) openAttachmentEditWindow(att, function (newContent) {
          att.content = newContent;
        });
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



  function buildAttachmentViewHtml(att) {
    var name = att.name || '未命名';
    var content = att.content || '';
    var ext = (att.type || '').toLowerCase();
    var bodyHtml = '';

    if (ext === 'md') {
      // Markdown：简单规则渲染
      function mdToHtml(md) {
        var lines = md.split('\n');
        var out = [];
        var inCode = false;
        var inTable = false;
        lines.forEach(function(line) {
          if (line.startsWith('```')) {
            if (inCode) { out.push('</code></pre>'); inCode = false; }
            else { out.push('<pre><code>'); inCode = true; }
            return;
          }
          if (inCode) { out.push(escapeHtml(line)); return; }
          // table
          if (/^\|/.test(line)) {
            if (!inTable) { out.push('<table>'); inTable = true; }
            var cells = line.replace(/^\||\|$/g, '').split('|');
            if (/^[\s\|\-:]+$/.test(line)) { return; }
            out.push('<tr>' + cells.map(function(c){ return '<td>' + escapeHtml(c.trim()) + '</td>'; }).join('') + '</tr>');
            return;
          } else if (inTable) { out.push('</table>'); inTable = false; }
          // headings
          var hm = line.match(/^(#{1,6})\s+(.*)/);
          if (hm) { var lv = hm[1].length; out.push('<h' + lv + '>' + escapeHtml(hm[2]) + '</h' + lv + '>'); return; }
          // hr
          if (/^---+$/.test(line.trim())) { out.push('<hr>'); return; }
          // blockquote
          var bqm = line.match(/^>\s?(.*)/);
          if (bqm) { out.push('<blockquote>' + escapeHtml(bqm[1]) + '</blockquote>'); return; }
          // list
          var ulm = line.match(/^[\-\*\+]\s+(.*)/);
          if (ulm) { out.push('<li>' + escapeHtml(ulm[1]) + '</li>'); return; }
          var olm = line.match(/^\d+\.\s+(.*)/);
          if (olm) { out.push('<li>' + escapeHtml(olm[1]) + '</li>'); return; }
          // empty
          if (!line.trim()) { out.push('<br>'); return; }
          // inline: bold, italic, code, link
          var p = escapeHtml(line)
            .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.+?)\*/g, '<em>$1</em>')
            .replace(/`(.+?)`/g, '<code>$1</code>')
            .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>');
          out.push('<p>' + p + '</p>');
        });
        if (inCode) out.push('</code></pre>');
        if (inTable) out.push('</table>');
        return out.join('\n');
      }
      bodyHtml = '<article class="md-body">' + mdToHtml(content) + '</article>';
    } else if (ext === 'csv') {
      // CSV：渲染为表格
      var rows = content.split('\n').filter(function(r){ return r.trim(); });
      var tableRows = rows.map(function(row, i) {
        var tag = i === 0 ? 'th' : 'td';
        var cells = row.split(',').map(function(c){ return '<' + tag + '>' + escapeHtml(c.trim().replace(/^"|"$/g,'')) + '</' + tag + '>'; }).join('');
        return '<tr>' + cells + '</tr>';
      }).join('');
      bodyHtml = '<div class="csv-wrap"><table class="csv-table">' + tableRows + '</table></div>';
    } else if (ext === 'json') {
      // JSON：高亮显示
      var formatted = content;
      try { formatted = JSON.stringify(JSON.parse(content), null, 2); } catch(e) {}
      function jsonHighlight(str) {
        return escapeHtml(str).replace(
          /("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g,
          function(match) {
            var cls = 'json-num';
            if (/^"/.test(match)) cls = /:$/.test(match) ? 'json-key' : 'json-str';
            else if (/true|false/.test(match)) cls = 'json-bool';
            else if (/null/.test(match)) cls = 'json-null';
            return '<span class="' + cls + '">' + match + '</span>';
          }
        );
      }
      bodyHtml = '<pre class="json-pre">' + jsonHighlight(formatted) + '</pre>';
    } else {
      // txt / 其他：原文等宽
      bodyHtml = '<pre class="txt-pre">' + escapeHtml(content) + '</pre>';
    }

    return '<!doctype html><html lang="zh-CN"><head><meta charset="utf-8">' +
      '<title>' + escapeHtml(name) + '</title>' +
      '<style>' +
        'body{font-family:system-ui,sans-serif;margin:0;background:#1a1b26;color:#c0caf5;min-height:100vh;}' +
        '.toolbar{display:flex;align-items:center;gap:12px;padding:10px 20px;background:#16161e;border-bottom:1px solid #2a2b3d;position:sticky;top:0;z-index:10;}' +
        '.toolbar h1{margin:0;font-size:1rem;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#7aa2f7;}' +
        '.btn{cursor:pointer;border:none;border-radius:6px;padding:5px 14px;font-size:0.85rem;font-family:inherit;}' +
        '.btn-export{background:#9ece6a;color:#1a1b26;font-weight:600;}' +
        '.btn-export:hover{background:#b9f27c;}' +
        '.content{padding:24px 32px;max-width:1000px;margin:0 auto;}' +
        /* markdown */
        '.md-body h1,.md-body h2,.md-body h3,.md-body h4,.md-body h5,.md-body h6{color:#7aa2f7;margin-top:1.2em;margin-bottom:.4em;}' +
        '.md-body p{line-height:1.8;margin:.6em 0;}' +
        '.md-body a{color:#73daca;text-decoration:underline;}' +
        '.md-body code{background:#24283b;padding:2px 6px;border-radius:4px;font-family:monospace;font-size:.9em;}' +
        '.md-body pre{background:#24283b;padding:14px;border-radius:8px;overflow-x:auto;}' +
        '.md-body pre code{background:none;padding:0;}' +
        '.md-body blockquote{border-left:3px solid #7aa2f7;margin:0;padding:4px 16px;color:#a9b1d6;}' +
        '.md-body table{border-collapse:collapse;width:100%;margin:1em 0;}' +
        '.md-body td,.md-body th{border:1px solid #2a2b3d;padding:6px 12px;}' +
        '.md-body th{background:#24283b;color:#7aa2f7;}' +
        '.md-body hr{border:none;border-top:1px solid #2a2b3d;margin:1.5em 0;}' +
        '.md-body li{margin:.3em 0;line-height:1.7;}' +
        /* csv */
        '.csv-wrap{overflow-x:auto;}' +
        '.csv-table{border-collapse:collapse;width:100%;font-size:.88rem;}' +
        '.csv-table th{background:#24283b;color:#7aa2f7;padding:8px 14px;border:1px solid #2a2b3d;text-align:left;}' +
        '.csv-table td{padding:7px 14px;border:1px solid #2a2b3d;}' +
        '.csv-table tr:hover td{background:rgba(122,162,247,.08);}' +
        /* json */
        '.json-pre{background:#24283b;padding:20px;border-radius:8px;overflow-x:auto;line-height:1.6;font-size:.88rem;font-family:"Cascadia Code",Consolas,monospace;}' +
        '.json-key{color:#7aa2f7;}.json-str{color:#9ece6a;}.json-num{color:#ff9e64;}.json-bool{color:#bb9af7;}.json-null{color:#f7768e;}' +
        /* txt */
        '.txt-pre{background:#24283b;padding:20px;border-radius:8px;overflow-x:auto;white-space:pre-wrap;word-break:break-word;line-height:1.7;font-size:.88rem;font-family:"Cascadia Code",Consolas,monospace;}' +
      '</style></head><body>' +
      '<div class="toolbar"><h1>' + escapeHtml(name) + '</h1>' +
      '<button class="btn btn-export" onclick="doExport()">导出</button>' +
      '</div>' +
      '<div class="content">' + bodyHtml + '</div>' +
      '<script>' +
        'var _attContent=' + JSON.stringify(content) + ';' +
        'var _attName=' + JSON.stringify(att.name || 'file.txt') + ';' +
        'var _attMime=' + JSON.stringify(
          ext === 'csv' ? 'text/csv' :
          ext === 'md' ? 'text/markdown' :
          ext === 'json' ? 'application/json' :
          ext === 'html' ? 'text/html' : 'text/plain'
        ) + ';' +
        'function doExport(){' +
          'var blob=new Blob([_attContent],{type:_attMime+";charset=utf-8"});' +
          'var a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=_attName;a.click();' +
        '}' +
      '<\/script>' +
      '</body></html>';
  }

  function buildAttachmentEditHtml(att) {
    var name = att.name || '未命名';
    var content = att.content || '';
    var ext = (att.type || '').toLowerCase();
    var mode = (ext === 'json' || ext === 'js' || ext === 'html' || ext === 'css') ? ext : 'text';

    return '<!doctype html><html lang="zh-CN"><head><meta charset="utf-8">' +
      '<title>编辑：' + escapeHtml(name) + '</title>' +
      '<style>' +
        'body{font-family:system-ui,sans-serif;margin:0;background:#1a1b26;color:#c0caf5;height:100vh;display:flex;flex-direction:column;}' +
        '.toolbar{display:flex;align-items:center;gap:12px;padding:10px 20px;background:#16161e;border-bottom:1px solid #2a2b3d;flex-shrink:0;}' +
        '.toolbar h1{margin:0;font-size:1rem;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#7aa2f7;}' +
        '.btn{cursor:pointer;border:none;border-radius:6px;padding:5px 14px;font-size:0.85rem;font-family:inherit;font-weight:600;}' +
        '.btn-save{background:#7aa2f7;color:#1a1b26;}.btn-save:hover{background:#89b4ff;}' +
        '.btn-cancel{background:#414868;color:#c0caf5;}.btn-cancel:hover{background:#555878;}' +
        '.status{font-size:.8rem;color:#9ece6a;display:none;}' +
        'textarea{flex:1;width:100%;box-sizing:border-box;background:#24283b;color:#c0caf5;border:none;padding:20px 24px;font-family:"Cascadia Code",Consolas,monospace;font-size:.9rem;line-height:1.7;resize:none;outline:none;}' +
      '</style></head><body>' +
      '<div class="toolbar"><h1>编辑：' + escapeHtml(name) + '</h1>' +
      '<span class="status" id="statusMsg">✓ 已保存</span>' +
      '<button class="btn btn-cancel" onclick="window.close()">关闭</button>' +
      '<button class="btn btn-save" onclick="doSave()">保存到工作台</button>' +
      '</div>' +
      '<textarea id="editor" spellcheck="false">' + escapeHtml(content) + '</textarea>' +
      '<script>' +
        'var _attId=' + JSON.stringify(att.id || '') + ';' +
        'function doSave(){' +
          'var val=document.getElementById("editor").value;' +
          'if(window.opener&&window.opener.updateAttachmentContent){' +
            'window.opener.updateAttachmentContent(_attId,val);' +
            'var s=document.getElementById("statusMsg");s.style.display="inline";setTimeout(function(){s.style.display="none";},2000);' +
          '}else{alert("无法连接到工作台窗口，请确认原窗口未关闭。");}' +
        '}' +
        'document.getElementById("editor").addEventListener("keydown",function(e){' +
          'if((e.ctrlKey||e.metaKey)&&e.key==="s"){e.preventDefault();doSave();}' +
        '});' +
      '<\/script>' +
      '</body></html>';
  }

  function openAttachmentViewWindow(att) {
    var win = window.open('', '_blank');
    if (!win) { alert('弹出窗口被阻止，请允许弹出窗口后重试。'); return; }
    win.document.write(buildAttachmentViewHtml(att));
    win.document.close();
  }

  function openAttachmentEditWindow(att, onSave) {
    window._updateAttachmentCallbacks = window._updateAttachmentCallbacks || {};
    window._updateAttachmentCallbacks[att.id] = onSave;
    var win = window.open('', '_blank');
    if (!win) { alert('弹出窗口被阻止，请允许弹出窗口后重试。'); return; }
    win.document.write(buildAttachmentEditHtml(att));
    win.document.close();
  }

  window.updateAttachmentContent = function(attId, newContent) {
    var cb = (window._updateAttachmentCallbacks || {})[attId];
    if (typeof cb === 'function') {
      cb(newContent);
      delete window._updateAttachmentCallbacks[attId];
    }
  };

  function openAttachmentsModal(item) {
    var attachments = item.attachments || [];
    if (!attachments.length) return;
    window._currentAttachmentsItem = item;
    var modal = document.getElementById('attachmentsListModal');
    if (modal) {
      var listEl = document.getElementById('attachmentsListBody');
      if (listEl) {
        listEl.innerHTML = '';
        attachments.forEach(function (att) {
          var row = document.createElement('div');
          row.className = 'attachment-row';
          row.innerHTML =
            '<span class="attachment-name" title="' + escapeHtml(att.name || '') + '">' + escapeHtml(att.name || '') + '</span>' +
            '<button type="button" class="btn btn-info btn-sm btn-view-att-list" data-aid="' + escapeHtml(att.id) + '">查看</button>' +
            '<button type="button" class="btn btn-secondary btn-sm btn-export-att-list" data-aid="' + escapeHtml(att.id) + '">导出</button>';
          listEl.appendChild(row);
        });
        listEl.querySelectorAll('.btn-view-att-list').forEach(function (btn) {
          btn.addEventListener('click', function () {
            var aid = btn.getAttribute('data-aid');
            var att = attachments.find(function (x) { return x.id === aid; });
            if (att) openAttachmentViewWindow(att);
          });
        });
        listEl.querySelectorAll('.btn-export-att-list').forEach(function (btn) {
          btn.addEventListener('click', function () {
            var aid = btn.getAttribute('data-aid');
            var att = attachments.find(function (x) { return x.id === aid; });
            if (att) exportAttachment(att);
          });
        });
      }
      modal.classList.add('show');
      return;
    }
    // 降级：新窗口打开附件列表
    var win = window.open('', '_blank');
    if (!win) {
      console.warn('弹出窗口被阻止，无法打开附件查看器。请允许弹出窗口。');
      return;
    }
    window._currentAttachments = attachments;
    function encodeAttr(str) {
      return String(str).replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }
    var html = '<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><title>附件列表</title>' +
      '<style>body{font-family:system-ui,sans-serif;margin:0;background:#1a1b26;color:#c0caf5;}' +
      'h2{margin:0;padding:16px 24px;background:#16161e;border-bottom:1px solid #2a2b3d;font-size:1.1rem;color:#7aa2f7;}' +
      'ul{list-style:none;padding:16px 24px;margin:0;}' +
      'li{display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid #2a2b3d;}' +
      'strong{flex:1;font-weight:normal;}' +
      'a{cursor:pointer;padding:4px 12px;border-radius:6px;font-size:.85rem;text-decoration:none;font-weight:600;}' +
      '.a-view{background:#7aa2f7;color:#1a1b26;}.a-export{background:#9ece6a;color:#1a1b26;}' +
      '</style></head><body>' +
      '<h2>附件列表</h2><ul>';
    attachments.forEach(function(att) {
      var encodedId = encodeAttr(att.id || '');
      html += '<li><strong>' + escapeHtml(att.name || '未命名') + '</strong>' +
        '<a class="a-view" href="javascript:;" onclick="if(window.opener&&window.opener.viewAttachmentById){window.opener.viewAttachmentById(\'' + encodedId + '\');}">查看</a>' +
        '<a class="a-export" href="javascript:;" onclick="if(window.opener&&window.opener.exportAttachmentById){window.opener.exportAttachmentById(\'' + encodedId + '\');}">导出</a>' +
        '</li>';
    });
    html += '</ul></body></html>';
    win.document.write(html);
    win.document.close();
  }

  // 解码HTML实体
  function decodeHtmlEntities(str) {
    var textarea = document.createElement('textarea');
    textarea.innerHTML = str;
    return textarea.value;
  }

  window.openAttachmentById = function(attId) {
    try {
      var decodedId = decodeHtmlEntities(attId);
      var attachments = window._currentAttachments || [];
      var att = attachments.find(function(a) { return a.id === decodedId; });
      if (att) {
        openAttachmentWindow(att);
      } else {
        console.error('未找到附件，ID:', decodedId);
      }
    } catch (err) {
      console.error('openAttachmentById 出错:', err.message);
    }
  };

  window.exportAttachmentById = function(attId) {
    var decodedId = decodeHtmlEntities(attId);
    var attachments = window._currentAttachments || [];
    var att = attachments.find(function(a) { return a.id === decodedId; });
    if (att) exportAttachment(att);
  };

  window.viewAttachmentById = function(attId) {
    var decodedId = decodeHtmlEntities(attId);
    var attachments = window._currentAttachments || [];
    var att = attachments.find(function(a) { return a.id === decodedId; });
    if (att) openAttachmentViewWindow(att);
  };

  function exportAttachment(att) {
    if (!att || !att.content) {
      alert('附件内容为空，无法导出');
      return;
    }
    
    var content = att.content;
    var filename = att.name || 'exported_file.txt';
    var mimeType = 'text/plain';
    
    // 根据文件类型设置不同的MIME类型
    var ext = (att.type || '').toLowerCase();
    switch(ext) {
      case 'csv':
        mimeType = 'text/csv';
        break;
      case 'md':
        mimeType = 'text/markdown';
        break;
      case 'html':
        mimeType = 'text/html';
        break;
      case 'json':
        mimeType = 'application/json';
        break;
      default:
        mimeType = 'text/plain';
    }
    
    // 创建Blob对象
    var blob = new Blob([content], { type: mimeType + ';charset=utf-8' });
    
    // 创建下载链接
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.style.display = 'none';
    
    // 添加到DOM并触发点击
    document.body.appendChild(a);
    a.click();
    
    // 清理
    setTimeout(function() {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 100);
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
      var commentId = id();
      target.item.comments.push({ id: commentId, user: nick, text: text, time: new Date().toLocaleString() });
      persistState();
      openCommentsModal(target.item, target.moduleId);
    });
  }

  // 发送评论邮件通知


  function bindViewContentModal() {
    document.getElementById('btnCloseViewContentModal').addEventListener('click', closeViewContentModal);
    document.getElementById('viewContentModal').addEventListener('click', function (e) { if (e.target.id === 'viewContentModal') closeViewContentModal(); });
  }

  function bindAttachmentModals() {
    var listModal = document.getElementById('attachmentsListModal');
    if (listModal) {
      document.getElementById('btnCloseAttachmentsListModal').addEventListener('click', function () { listModal.classList.remove('show'); });
      listModal.addEventListener('click', function (e) { if (e.target.id === 'attachmentsListModal') listModal.classList.remove('show'); });
    }
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
  bindAttachmentModals();
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
      .then(function (pair) { 
        return pair.res.text(); 
      })
      .then(function (text) {
        if (!text || text === 'null') {
          return;
        }
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
      .catch(function (e) { 
        console.warn('云端加载失败', e);
        showCloudSyncUnavailable(); 
      });
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