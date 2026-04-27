/**
 * Tabs 标签页组件
 * 支持标签切换、关闭、拖拽排序和滚动控制
 */
(function() {
  'use strict';

  /**
   * 创建稳定的标签 key
   * @param {Object} tab - 标签配置
   * @param {number} index - 索引
   * @returns {string}
   */
  function createTabKey(tab, index) {
    if (tab && tab.key !== undefined && tab.key !== null && tab.key !== '') {
      return String(tab.key);
    }
    return 'wb-tab-' + index;
  }

  /**
   * 规范化标签配置
   * @param {Array} tabs - 原始标签数组
   * @returns {Array}
   */
  function normalizeTabs(tabs) {
    return (Array.isArray(tabs) ? tabs : []).map(function(tab, index) {
      return {
        key: createTabKey(tab || {}, index),
        title: tab && tab.title !== undefined ? String(tab.title) : ('标签' + (index + 1)),
        content: tab ? tab.content : '',
        closable: !!(tab && tab.closable),
        disabled: !!(tab && tab.disabled),
        icon: tab && tab.icon ? String(tab.icon) : '',
        raw: tab || {}
      };
    });
  }

  /**
   * 获取首个可用标签 key
   * @param {Array} tabs - 标签列表
   * @returns {string}
   */
  function getFirstEnabledKey(tabs) {
    var target = (tabs || []).find(function(item) {
      return !item.disabled;
    });
    return target ? target.key : '';
  }

  /**
   * 创建 Tabs 组件
   * @param {Object} config - 配置对象
   * @param {Array} config.tabs - 标签数组
   * @param {string} config.activeKey - 当前激活 key
   * @param {string} config.size - 尺寸 sm/md/lg
   * @param {string} config.type - 风格 line/card
   * @param {boolean} config.closable - 是否默认可关闭
   * @param {boolean} config.draggable - 是否允许拖拽排序
   * @param {boolean} config.scrollable - 是否启用滚动控制
   * @param {Function} config.onChange - 切换回调
   * @param {Function} config.onClose - 关闭回调
   * @param {Function} config.onSort - 排序回调
   * @returns {HTMLElement} Tabs 容器元素
   */
  function createTabs(config) {
    config = config || {};

    var tabs = normalizeTabs(config.tabs || []);
    var activeKey = config.activeKey || getFirstEnabledKey(tabs);
    var size = config.size || 'md';
    var type = config.type || 'line';
    var defaultClosable = !!config.closable;
    var draggable = config.draggable !== false;
    var scrollable = config.scrollable !== false;
    var dragKey = '';

    var container = document.createElement('div');
    container.className = 'wb-tabs';
    container.classList.add('wb-tabs--' + size);
    container.classList.add('wb-tabs--' + type);
    if (scrollable) container.classList.add('wb-tabs--scrollable');

    var navWrap = document.createElement('div');
    navWrap.className = 'wb-tabs__nav-wrap';
    container.appendChild(navWrap);

    var prevBtn = document.createElement('button');
    prevBtn.type = 'button';
    prevBtn.className = 'wb-tabs__scroll wb-tabs__scroll--prev';
    prevBtn.setAttribute('aria-label', '向前滚动标签');
    prevBtn.innerHTML = '&#8249;';
    navWrap.appendChild(prevBtn);

    var nav = document.createElement('div');
    nav.className = 'wb-tabs__nav';
    nav.setAttribute('role', 'tablist');
    navWrap.appendChild(nav);

    var nextBtn = document.createElement('button');
    nextBtn.type = 'button';
    nextBtn.className = 'wb-tabs__scroll wb-tabs__scroll--next';
    nextBtn.setAttribute('aria-label', '向后滚动标签');
    nextBtn.innerHTML = '&#8250;';
    navWrap.appendChild(nextBtn);

    var panels = document.createElement('div');
    panels.className = 'wb-tabs__panels';
    container.appendChild(panels);

    function findTabByKey(key) {
      return tabs.find(function(item) {
        return item.key === key;
      }) || null;
    }

    function getTabIndexByKey(key) {
      return tabs.findIndex(function(item) {
        return item.key === key;
      });
    }

    function updateScrollButtons() {
      if (!scrollable) {
        prevBtn.style.display = 'none';
        nextBtn.style.display = 'none';
        return;
      }

      prevBtn.style.display = '';
      nextBtn.style.display = '';
      prevBtn.disabled = nav.scrollLeft <= 0;
      nextBtn.disabled = nav.scrollLeft + nav.clientWidth >= nav.scrollWidth - 1;
    }

    function scrollActiveTabIntoView() {
      var activeTabEl = nav.querySelector('.wb-tabs__tab--active');
      if (activeTabEl && activeTabEl.scrollIntoView) {
        activeTabEl.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      }
      updateScrollButtons();
    }

    function emitChange(tab) {
      if (config.onChange) {
        config.onChange(activeKey, tab || findTabByKey(activeKey));
      }
    }

    function setActiveKey(nextKey, silent) {
      var targetTab = findTabByKey(nextKey);
      if (!targetTab || targetTab.disabled) {
        return;
      }

      activeKey = targetTab.key;
      render();

      if (!silent) {
        emitChange(targetTab);
      }
    }

    function createPanelContent(tab) {
      if (typeof tab.content === 'string') {
        var wrapper = document.createElement('div');
        wrapper.innerHTML = tab.content;
        return wrapper;
      }

      if (tab.content instanceof HTMLElement) {
        return tab.content;
      }

      if (typeof tab.content === 'function') {
        return tab.content(tab);
      }

      return document.createTextNode('');
    }

    function moveTab(fromKey, toKey) {
      var fromIndex = getTabIndexByKey(fromKey);
      var toIndex = getTabIndexByKey(toKey);

      if (fromIndex === -1 || toIndex === -1 || fromIndex === toIndex) {
        return;
      }

      var moved = tabs.splice(fromIndex, 1)[0];
      tabs.splice(toIndex, 0, moved);
      render();

      if (config.onSort) {
        config.onSort(tabs.map(function(item) {
          return item.raw;
        }), tabs.slice(), moved);
      }
    }

    function removeTab(key, silent) {
      var index = getTabIndexByKey(key);
      if (index === -1) {
        return;
      }

      var removed = tabs.splice(index, 1)[0];

      if (activeKey === key) {
        var fallback = tabs[index] || tabs[index - 1] || null;
        activeKey = fallback ? fallback.key : '';
      }

      render();

      if (!silent && config.onClose) {
        config.onClose(removed, tabs.slice());
      }
    }

    function addTab(tab, autoActivate) {
      var normalized = normalizeTabs([tab])[0];
      tabs.push(normalized);
      if (autoActivate !== false && !normalized.disabled) {
        activeKey = normalized.key;
      }
      render();
    }

    function updateTabs(nextTabs, nextActiveKey, silent) {
      tabs = normalizeTabs(nextTabs || []);
      activeKey = nextActiveKey || activeKey || getFirstEnabledKey(tabs);

      if (!findTabByKey(activeKey)) {
        activeKey = getFirstEnabledKey(tabs);
      }

      render();

      if (!silent && activeKey) {
        emitChange(findTabByKey(activeKey));
      }
    }

    function renderNav() {
      nav.innerHTML = '';

      tabs.forEach(function(tab, index) {
        var tabEl = document.createElement('div');
        tabEl.className = 'wb-tabs__tab';
        tabEl.setAttribute('role', 'tab');
        tabEl.setAttribute('id', 'wb-tab-' + tab.key);
        tabEl.setAttribute('aria-controls', 'wb-tabpanel-' + tab.key);
        tabEl.setAttribute('tabindex', tab.key === activeKey ? '0' : '-1');
        tabEl.dataset.key = tab.key;

        if (tab.key === activeKey) {
          tabEl.classList.add('wb-tabs__tab--active');
          tabEl.setAttribute('aria-selected', 'true');
        } else {
          tabEl.setAttribute('aria-selected', 'false');
        }

        if (tab.disabled) {
          tabEl.classList.add('wb-tabs__tab--disabled');
        }

        if (draggable && !tab.disabled) {
          tabEl.draggable = true;
        }

        var labelWrap = document.createElement('span');
        labelWrap.className = 'wb-tabs__tab-label';

        if (tab.icon) {
          var iconEl = document.createElement('i');
          iconEl.className = 'wb-tabs__tab-icon ' + tab.icon;
          labelWrap.appendChild(iconEl);
        }

        var titleEl = document.createElement('span');
        titleEl.className = 'wb-tabs__tab-text';
        titleEl.textContent = tab.title;
        labelWrap.appendChild(titleEl);
        tabEl.appendChild(labelWrap);

        if (defaultClosable || tab.closable) {
          var closeBtn = document.createElement('button');
          closeBtn.type = 'button';
          closeBtn.className = 'wb-tabs__tab-close';
          closeBtn.setAttribute('aria-label', '关闭标签 ' + tab.title);
          closeBtn.innerHTML = '&times;';
          closeBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            removeTab(tab.key);
          });
          tabEl.appendChild(closeBtn);
        }

        if (!tab.disabled) {
          tabEl.addEventListener('click', function() {
            setActiveKey(tab.key);
          });

          tabEl.addEventListener('keydown', function(e) {
            var enabledTabs = tabs.filter(function(item) { return !item.disabled; });
            var currentEnabledIndex = enabledTabs.findIndex(function(item) { return item.key === tab.key; });
            var nextTab;

            switch (e.key) {
              case 'ArrowRight':
                e.preventDefault();
                nextTab = enabledTabs[currentEnabledIndex + 1] || enabledTabs[0];
                if (nextTab) setActiveKey(nextTab.key);
                break;
              case 'ArrowLeft':
                e.preventDefault();
                nextTab = enabledTabs[currentEnabledIndex - 1] || enabledTabs[enabledTabs.length - 1];
                if (nextTab) setActiveKey(nextTab.key);
                break;
              case 'Home':
                e.preventDefault();
                if (enabledTabs[0]) setActiveKey(enabledTabs[0].key);
                break;
              case 'End':
                e.preventDefault();
                if (enabledTabs[enabledTabs.length - 1]) setActiveKey(enabledTabs[enabledTabs.length - 1].key);
                break;
              case 'Delete':
                if (defaultClosable || tab.closable) {
                  e.preventDefault();
                  removeTab(tab.key);
                }
                break;
            }
          });

          if (draggable) {
            // 关键逻辑：仅记录 key，不直接搬移 DOM，最终以数据数组重排后统一 render，避免 DOM 与状态脱节
            tabEl.addEventListener('dragstart', function(e) {
              dragKey = tab.key;
              tabEl.classList.add('wb-tabs__tab--dragging');
              if (e.dataTransfer) {
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/plain', tab.key);
              }
            });

            tabEl.addEventListener('dragover', function(e) {
              e.preventDefault();
              if (dragKey && dragKey !== tab.key) {
                tabEl.classList.add('wb-tabs__tab--drag-over');
              }
            });

            tabEl.addEventListener('dragleave', function() {
              tabEl.classList.remove('wb-tabs__tab--drag-over');
            });

            tabEl.addEventListener('drop', function(e) {
              e.preventDefault();
              tabEl.classList.remove('wb-tabs__tab--drag-over');
              if (dragKey && dragKey !== tab.key) {
                moveTab(dragKey, tab.key);
              }
            });

            tabEl.addEventListener('dragend', function() {
              dragKey = '';
              nav.querySelectorAll('.wb-tabs__tab').forEach(function(item) {
                item.classList.remove('wb-tabs__tab--dragging');
                item.classList.remove('wb-tabs__tab--drag-over');
              });
            });
          }
        }

        nav.appendChild(tabEl);
      });

      updateScrollButtons();
    }

    function renderPanels() {
      panels.innerHTML = '';

      tabs.forEach(function(tab, index) {
        var panel = document.createElement('div');
        panel.className = 'wb-tabs__panel';
        panel.setAttribute('role', 'tabpanel');
        panel.setAttribute('id', 'wb-tabpanel-' + tab.key);
        panel.setAttribute('aria-labelledby', 'wb-tab-' + tab.key);
        panel.dataset.key = tab.key;
        panel.hidden = tab.key !== activeKey;

        if (tab.key === activeKey) {
          panel.classList.add('wb-tabs__panel--active');
        }

        var content = createPanelContent(tab);
        if (content instanceof Node) {
          panel.appendChild(content);
        } else {
          panel.textContent = '';
        }

        panels.appendChild(panel);
      });
    }

    function render() {
      if (!findTabByKey(activeKey)) {
        activeKey = getFirstEnabledKey(tabs);
      }

      renderNav();
      renderPanels();
      scrollActiveTabIntoView();
    }

    prevBtn.addEventListener('click', function() {
      nav.scrollBy({ left: -160, behavior: 'smooth' });
      window.setTimeout(updateScrollButtons, 200);
    });

    nextBtn.addEventListener('click', function() {
      nav.scrollBy({ left: 160, behavior: 'smooth' });
      window.setTimeout(updateScrollButtons, 200);
    });

    nav.addEventListener('scroll', updateScrollButtons);
    window.addEventListener('resize', updateScrollButtons);

    container.getTabs = function() {
      return tabs.slice();
    };
    container.setTabs = updateTabs;
    container.addTab = addTab;
    container.removeTab = removeTab;
    container.setActiveKey = setActiveKey;
    container.getActiveKey = function() {
      return activeKey;
    };
    container.getActiveTab = function() {
      return findTabByKey(activeKey);
    };
    container.scrollToActive = scrollActiveTabIntoView;
    container.renderTabs = render;

    render();
    return container;
  }

  window.WBTabs = {
    create: createTabs
  };
})();
