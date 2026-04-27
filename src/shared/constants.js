(function () {
  'use strict';

  window.WorkbenchConstants = Object.assign({}, window.WorkbenchConstants, {
    STORAGE_LAYOUT: 'workbench_layout',
    STORAGE_BG: 'workbench_bg',
    STORAGE_STATE: 'workbench_state',
    STORAGE_TODOS: 'workbench_todos',
    STORAGE_TODO_UI: 'workbench_todo_ui',
    STORAGE_USER: 'workbench_user',
    STORAGE_USER_ROLE: 'workbench_user_role',
    STORAGE_ALLOWED_USERS: 'workbench_allowed_users',
    STORAGE_RECENT_ACTIVITY: 'workbench_recent_activity',
    MAX_RECENT_ITEMS: 20,
    CLOUD_STATE_URLS: [
      '/api/workbench-state',
      '/.netlify/functions/workbench-state'
    ],
    defaultLayout: { cols: 3, gap: 16, align: 'start' },
    defaultBg: {
      type: 'color',
      color: '#1a1b26',
      image: '',
      gradient: 'linear-gradient(135deg, #1a1b26 0%, #24283b 100%)'
    }
  });
})();