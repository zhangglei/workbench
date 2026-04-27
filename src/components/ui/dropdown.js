/**
 * Dropdown 下拉菜单组件
 * 支持菜单项、分组、分隔线、子菜单、图标和快捷键信息
 */
(function() {
  'use strict';

  var activeDropdown = null;
  var dropdownSeed = 0;

  function createDropdown(options) {
    options = options || {};

    var items = Array.isArray(options.items) ? options.items.slice() : [];
    var disabled = !!options.disabled;
    var placement = options.placement || 'bottom-start';
    var triggerMode = options.trigger || 'click';
    var hideOnClick = options.hideOnClick !== false;
    var submenuOpenDelay = typeof options.submenuOpenDelay === 'number' ? options.submenuOpenDelay : 120;
    var submenuCloseDelay = typeof options.submenuCloseDelay === 'number' ? options.submenuCloseDelay : 180;
    var dropdownId = 'wb-dropdown-' + (++dropdownSeed);
    var submenuTimers = [];

    var container = document.createElement('div');
    container.className = 'wb-dropdown';
    container.dataset.placement = placement;
    container.tabIndex = disabled ? -1 : 0;

    if (disabled) {
      container.classList.add('wb-dropdown--disabled');
    }

    var triggerEl = createTrigger(options);
    triggerEl.classList.add('wb-dropdown__trigger');
    triggerEl.setAttribute('aria-haspopup', 'menu');
    triggerEl.setAttribute('aria-expanded', 'false');
    triggerEl.setAttribute('aria-controls', dropdownId);

    var menu = document.createElement('div');
    menu.className = 'wb-dropdown__menu';
    menu.id = dropdownId;
    menu.setAttribute('role', 'menu');
    menu.style.display = 'none';

    container.appendChild(triggerEl);
    container.appendChild(menu);

    function clearSubmenuTimers() {
      while (submenuTimers.length) {
        clearTimeout(submenuTimers.pop());
      }
    }

    function closeSiblingSubmenus(parentElement, keepElement) {
      if (!parentElement) return;
      var children = parentElement.children;
      for (var i = 0; i < children.length; i++) {
        var child = children[i];
        if (child !== keepElement && child.classList.contains('wb-dropdown__item--submenu-open')) {
          child.classList.remove('wb-dropdown__item--submenu-open');
        }
      }
    }

    function closeAllSubmenus(root) {
      var scope = root || menu;
      var opened = scope.querySelectorAll('.wb-dropdown__item--submenu-open');
      for (var i = 0; i < opened.length; i++) {
        opened[i].classList.remove('wb-dropdown__item--submenu-open');
      }
    }

    function emitEvent(name, detail) {
      if (typeof options[name] === 'function') {
        options[name](detail);
      }

      if (window.EventBus) {
        window.EventBus.emit('dropdown:' + name, detail);
      }
    }

    function isOpen() {
      return container.classList.contains('wb-dropdown--open');
    }

    function open(silent) {
      if (disabled || isOpen()) return;

      if (activeDropdown && activeDropdown !== instance) {
        activeDropdown.close(true);
      }

      activeDropdown = instance;
      menu.style.display = 'block';
      container.classList.add('wb-dropdown--open');
      triggerEl.setAttribute('aria-expanded', 'true');

      if (!silent) {
        emitEvent('onOpen', {
          instance: instance,
          items: items.slice()
        });
      }
    }

    function close(silent) {
      if (!isOpen()) return;

      clearSubmenuTimers();
      closeAllSubmenus();
      menu.style.display = 'none';
      container.classList.remove('wb-dropdown--open');
      triggerEl.setAttribute('aria-expanded', 'false');

      if (activeDropdown === instance) {
        activeDropdown = null;
      }

      if (!silent) {
        emitEvent('onClose', {
          instance: instance,
          items: items.slice()
        });
      }
    }

    function toggle() {
      if (isOpen()) {
        close();
      } else {
        open();
      }
    }

    function createTrigger(config) {
      if (config.triggerElement instanceof HTMLElement) {
        return config.triggerElement;
      }

      if (window.WBButton && typeof window.WBButton.create === 'function') {
        return window.WBButton.create({
          text: config.text || '更多操作',
          icon: config.icon || 'ri-arrow-down-s-line',
          variant: config.variant || 'secondary',
          size: config.size || 'md'
        });
      }

      var button = document.createElement('button');
      button.type = 'button';
      button.className = 'wb-dropdown__trigger-fallback';
      button.textContent = config.text || '更多操作';
      return button;
    }

    function createLabel(item) {
      var label = document.createElement('span');
      label.className = 'wb-dropdown__item-label';
      label.textContent = item.label || '';
      return label;
    }

    function createMeta(item) {
      var fragment = document.createDocumentFragment();

      if (item.icon) {
        var icon = document.createElement('i');
        icon.className = 'wb-dropdown__item-icon ' + item.icon;
        icon.setAttribute('aria-hidden', 'true');
        fragment.appendChild(icon);
      } else {
        var iconPlaceholder = document.createElement('span');
        iconPlaceholder.className = 'wb-dropdown__item-icon wb-dropdown__item-icon--placeholder';
        iconPlaceholder.setAttribute('aria-hidden', 'true');
        fragment.appendChild(iconPlaceholder);
      }

      fragment.appendChild(createLabel(item));

      if (item.shortcut) {
        var shortcut = document.createElement('span');
        shortcut.className = 'wb-dropdown__item-shortcut';
        shortcut.textContent = item.shortcut;
        fragment.appendChild(shortcut);
      }

      return fragment;
    }

    function createGroup(group) {
      var wrapper = document.createElement('div');
      wrapper.className = 'wb-dropdown__group';

      if (group.label) {
        var title = document.createElement('div');
        title.className = 'wb-dropdown__group-title';
        title.textContent = group.label;
        wrapper.appendChild(title);
      }

      var children = Array.isArray(group.children) ? group.children : [];
      for (var i = 0; i < children.length; i++) {
        var childNode = createItem(children[i], wrapper);
        if (childNode) {
          wrapper.appendChild(childNode);
        }
      }

      return wrapper;
    }

    function bindSubmenu(itemEl, submenuEl, parentElement) {
      function showSubmenu() {
        clearSubmenuTimers();
        closeSiblingSubmenus(parentElement, itemEl);
        itemEl.classList.add('wb-dropdown__item--submenu-open');
      }

      function hideSubmenu() {
        clearSubmenuTimers();
        itemEl.classList.remove('wb-dropdown__item--submenu-open');
      }

      itemEl.addEventListener('mouseenter', function() {
        submenuTimers.push(setTimeout(showSubmenu, submenuOpenDelay));
      });

      itemEl.addEventListener('mouseleave', function() {
        submenuTimers.push(setTimeout(hideSubmenu, submenuCloseDelay));
      });

      itemEl.addEventListener('click', function(event) {
        event.preventDefault();
        event.stopPropagation();
        if (itemEl.classList.contains('wb-dropdown__item--submenu-open')) {
          hideSubmenu();
        } else {
          showSubmenu();
        }
      });

      submenuEl.addEventListener('click', function(event) {
        event.stopPropagation();
      });
    }

    function createItem(item, parentElement) {
      if (!item || typeof item !== 'object') {
        return null;
      }

      if (item.type === 'divider') {
        var divider = document.createElement('div');
        divider.className = 'wb-dropdown__divider';
        divider.setAttribute('role', 'separator');
        return divider;
      }

      if (item.type === 'group') {
        return createGroup(item);
      }

      var itemEl = document.createElement('button');
      itemEl.type = 'button';
      itemEl.className = 'wb-dropdown__item';
      itemEl.setAttribute('role', 'menuitem');
      itemEl.dataset.key = item.key || item.value || item.label || '';

      if (item.danger) {
        itemEl.classList.add('wb-dropdown__item--danger');
      }

      if (item.disabled) {
        itemEl.classList.add('wb-dropdown__item--disabled');
        itemEl.disabled = true;
      }

      itemEl.appendChild(createMeta(item));

      var children = Array.isArray(item.children) ? item.children : [];
      if (children.length) {
        itemEl.classList.add('wb-dropdown__item--has-children');
        itemEl.setAttribute('aria-haspopup', 'menu');
        itemEl.setAttribute('aria-expanded', 'false');

        var arrow = document.createElement('i');
        arrow.className = 'wb-dropdown__item-arrow ri-arrow-right-s-line';
        arrow.setAttribute('aria-hidden', 'true');
        itemEl.appendChild(arrow);

        var submenu = document.createElement('div');
        submenu.className = 'wb-dropdown__submenu';
        submenu.setAttribute('role', 'menu');

        for (var i = 0; i < children.length; i++) {
          var childNode = createItem(children[i], submenu);
          if (childNode) {
            submenu.appendChild(childNode);
          }
        }

        itemEl.appendChild(submenu);
        bindSubmenu(itemEl, submenu, parentElement);
        itemEl.addEventListener('mouseenter', function() {
          itemEl.setAttribute('aria-expanded', 'true');
        });
        itemEl.addEventListener('mouseleave', function() {
          itemEl.setAttribute('aria-expanded', 'false');
        });
        return itemEl;
      }

      itemEl.addEventListener('click', function(event) {
        event.preventDefault();
        event.stopPropagation();

        if (item.disabled) {
          return;
        }

        emitEvent('onSelect', {
          key: item.key,
          value: item.value,
          item: item,
          instance: instance,
          triggerEvent: event
        });

        if (typeof item.onClick === 'function') {
          item.onClick({
            key: item.key,
            value: item.value,
            item: item,
            instance: instance,
            triggerEvent: event
          });
        }

        if (hideOnClick) {
          close();
        }
      });

      return itemEl;
    }

    function render() {
      menu.innerHTML = '';

      if (!items.length) {
        var empty = document.createElement('div');
        empty.className = 'wb-dropdown__empty';
        empty.textContent = options.emptyText || '暂无操作项';
        menu.appendChild(empty);
        return;
      }

      for (var i = 0; i < items.length; i++) {
        var node = createItem(items[i], menu);
        if (node) {
          menu.appendChild(node);
        }
      }
    }

    function setItems(nextItems) {
      items = Array.isArray(nextItems) ? nextItems.slice() : [];
      close(true);
      render();
    }

    function setDisabled(isDisabled) {
      disabled = !!isDisabled;
      if (disabled) {
        container.classList.add('wb-dropdown--disabled');
        container.tabIndex = -1;
        close(true);
      } else {
        container.classList.remove('wb-dropdown--disabled');
        container.tabIndex = 0;
      }
    }

    function handleDocumentClick(event) {
      if (!container.contains(event.target)) {
        close(true);
      }
    }

    function handleKeydown(event) {
      if (disabled) return;

      if (event.key === 'Escape') {
        close();
        triggerEl.focus();
        return;
      }

      if (event.key === 'Enter' || event.key === ' ') {
        if (event.target === container || event.target === triggerEl) {
          event.preventDefault();
          toggle();
        }
      }
    }

    if (triggerMode === 'hover') {
      container.addEventListener('mouseenter', function() {
        open();
      });
      container.addEventListener('mouseleave', function() {
        close(true);
      });
    } else {
      triggerEl.addEventListener('click', function(event) {
        event.preventDefault();
        event.stopPropagation();
        toggle();
      });
    }

    container.addEventListener('keydown', handleKeydown);
    document.addEventListener('click', handleDocumentClick);

    render();

    var instance = {
      open: open,
      close: close,
      toggle: toggle,
      render: render,
      isOpen: isOpen,
      setItems: setItems,
      getItems: function() {
        return items.slice();
      },
      setDisabled: setDisabled,
      getElement: function() {
        return container;
      },
      getMenu: function() {
        return menu;
      },
      getTrigger: function() {
        return triggerEl;
      },
      destroy: function() {
        close(true);
        document.removeEventListener('click', handleDocumentClick);
        clearSubmenuTimers();
        if (container.parentNode) {
          container.parentNode.removeChild(container);
        }
      }
    };

    container.open = open;
    container.close = close;
    container.toggle = toggle;
    container.renderDropdown = render;
    container.isOpen = isOpen;
    container.setItems = setItems;
    container.getItems = function() {
      return items.slice();
    };
    container.setDisabled = setDisabled;
    container.getMenu = function() {
      return menu;
    };
    container.getTrigger = function() {
      return triggerEl;
    };
    container.destroy = instance.destroy;
    container._instance = instance;

    return container;
  }

  function getActiveDropdown() {
    return activeDropdown;
  }

  window.WBDropdown = {
    create: createDropdown,
    getActive: getActiveDropdown
  };
})();
