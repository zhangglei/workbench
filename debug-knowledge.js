/**
 * 知识库调试脚本
 * 在浏览器控制台中运行此脚本以诊断问题
 */

(function() {
  console.log('========================================');
  console.log('知识库调试报告');
  console.log('========================================\n');

  // Step 3: 检查 KnowledgeBase 对象
  console.log('--- Step 3: 检查 KnowledgeBase 对象 ---');
  console.log('KnowledgeBase exists:', typeof window.KnowledgeBase);
  console.log('KnowledgeBase.init:', typeof window.KnowledgeBase?.init);
  console.log('kb-note-grid children:', document.getElementById('kb-note-grid')?.children.length);
  console.log('kb-new-btn display:', document.getElementById('kb-new-btn')?.style.display);
  console.log('kb-editor-modal exists:', !!document.getElementById('kb-editor-modal'));
  console.log('kb-editor-modal classes:', document.getElementById('kb-editor-modal')?.className);
  console.log('');

  // Step 5: 尝试初始化
  console.log('--- Step 5: 尝试运行 init() ---');
  try { 
    if (window.KnowledgeBase && window.KnowledgeBase.init) {
      window.KnowledgeBase.init(); 
      console.log('✓ init() succeeded');
    } else {
      console.error('✗ KnowledgeBase.init 不存在');
    }
  } catch(e) { 
    console.error('✗ init() error:', e.message);
    console.error('Stack trace:', e.stack); 
  }
  console.log('');

  // Step 7: 检查 localStorage
  console.log('--- Step 7: 检查 localStorage ---');
  var notes = localStorage.getItem('workbench_knowledge');
  if (notes) {
    console.log('stored notes (前200字符):', notes.substring(0, 200));
    try {
      var parsed = JSON.parse(notes);
      console.log('笔记数量:', parsed.length);
      console.log('第一条笔记标题:', parsed[0]?.title);
    } catch(e) {
      console.error('解析 localStorage 失败:', e.message);
    }
  } else {
    console.log('stored notes: NULL (localStorage 中没有数据)');
  }
  console.log('');

  // 额外检查: DOM 元素
  console.log('--- 额外检查: DOM 元素 ---');
  var elements = [
    'kb-list-view',
    'kb-detail-view', 
    'kb-tag-bar',
    'kb-note-grid',
    'kb-new-btn',
    'kb-search-input',
    'kb-editor-modal'
  ];
  
  elements.forEach(function(id) {
    var el = document.getElementById(id);
    if (el) {
      console.log('✓', id, '存在, display:', el.style.display || 'default');
    } else {
      console.error('✗', id, '不存在');
    }
  });
  console.log('');

  // 额外检查: 脚本加载
  console.log('--- 额外检查: 脚本加载 ---');
  var scripts = document.querySelectorAll('script[src*="knowledge"]');
  console.log('knowledge.js 脚本数量:', scripts.length);
  scripts.forEach(function(script, i) {
    console.log('  [' + i + ']', script.src);
  });
  console.log('');

  // 额外检查: 当前页面哈希
  console.log('--- 额外检查: 当前页面 ---');
  console.log('当前 hash:', window.location.hash);
  console.log('当前 URL:', window.location.href);
  console.log('');

  console.log('========================================');
  console.log('调试报告结束');
  console.log('========================================');

  // 返回诊断摘要
  return {
    knowledgeBaseExists: typeof window.KnowledgeBase !== 'undefined',
    initExists: typeof window.KnowledgeBase?.init === 'function',
    notesInGrid: document.getElementById('kb-note-grid')?.children.length || 0,
    hasLocalStorage: !!localStorage.getItem('workbench_knowledge'),
    currentHash: window.location.hash
  };
})();
