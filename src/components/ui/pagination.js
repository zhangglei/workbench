/**
 * Pagination 分页组件
 * 支持页码切换、每页条数选择、快速跳转、总数展示
 */
(function() {
  'use strict';

  /**
   * 创建分页组件
   * @param {Object} options - 分页配置
   * @param {number} options.total - 数据总数
   * @param {number} options.page - 当前页码，从 1 开始
   * @param {number} options.pageSize - 每页条数
   * @param {Array<number>} options.pageSizes - 可选每页条数
   * @param {boolean} options.showSizeChanger - 是否显示每页条数选择
   * @param {boolean} options.showQuickJumper - 是否显示快速跳转
   * @param {boolean} options.showTotal - 是否显示总数
   * @param {number} options.maxPagerCount - 最多显示页码按钮数量
   * @param {Function} options.onChange - 页码/页大小变化回调
   * @param {Function} options.onPageSizeChange - 每页条数变化回调
   * @returns {HTMLElement} 分页容器
   */
  function createPagination(options) {
    options = options || {};

    var total = normalizeNumber(options.total, 0);
    var page = normalizeNumber(options.page, 1);
    var pageSize = normalizeNumber(options.pageSize, 10);
    var pageSizes = Array.isArray(options.pageSizes) && options.pageSizes.length ? options.pageSizes : [10, 20, 50, 100];
    var showSizeChanger = options.showSizeChanger !== false;
    var showQuickJumper = options.showQuickJumper || false;
    var showTotal = options.showTotal !== false;
    var maxPagerCount = normalizeNumber(options.maxPagerCount, 7);

    var container = document.createElement('div');
    container.className = 'wb-pagination';

    function normalizeNumber(value, fallback) {
      var n = Number(value);
      if (!Number.isFinite(n)) return fallback;
      return Math.max(0, Math.floor(n));
    }

    function getPageCount() {
      if (pageSize <= 0) return 1;
      return Math.max(1, Math.ceil(total / pageSize));
    }

    function clampPage(value) {
      var pageCount = getPageCount();
      return Math.min(Math.max(1, normalizeNumber(value, 1)), pageCount);
    }

    function createButton(text, disabled, active, onClick, className) {
      var button = document.createElement('button');
      button.type = 'button';
      button.className = 'wb-pagination__btn';
      if (className) button.classList.add(className);
      if (active) button.classList.add('wb-pagination__btn--active');
      if (disabled) button.disabled = true;
      button.innerHTML = text;
      if (!disabled && typeof onClick === 'function') {
        button.addEventListener('click', onClick);
      }
      return button;
    }

    /**
     * 计算要展示的页码，包含省略号占位。
     * 关键分支：页数较多时保留首尾页，并围绕当前页显示窗口。
     */
    function getPagerItems() {
      var pageCount = getPageCount();
      var items = [];

      if (pageCount <= maxPagerCount) {
        for (var i = 1; i <= pageCount; i++) items.push(i);
        return items;
      }

      var sideCount = Math.max(1, Math.floor((maxPagerCount - 3) / 2));
      var left = Math.max(2, page - sideCount);
      var right = Math.min(pageCount - 1, page + sideCount);

      if (page <= sideCount + 3) {
        left = 2;
        right = Math.min(pageCount - 1, maxPagerCount - 2);
      }

      if (page >= pageCount - sideCount - 2) {
        left = Math.max(2, pageCount - maxPagerCount + 3);
        right = pageCount - 1;
      }

      items.push(1);
      if (left > 2) items.push('prev-ellipsis');
      for (var j = left; j <= right; j++) items.push(j);
      if (right < pageCount - 1) items.push('next-ellipsis');
      items.push(pageCount);

      return items;
    }

    function emitChange() {
      if (typeof options.onChange === 'function') {
        options.onChange({
          page: page,
          pageSize: pageSize,
          total: total,
          pageCount: getPageCount()
        });
      }
    }

    function changePage(nextPage) {
      var normalized = clampPage(nextPage);
      if (normalized === page) return;
      page = normalized;
      render();
      emitChange();
    }

    function changePageSize(nextPageSize) {
      var normalized = normalizeNumber(nextPageSize, pageSize);
      if (normalized <= 0 || normalized === pageSize) return;
      pageSize = normalized;
      page = clampPage(page);
      render();
      if (typeof options.onPageSizeChange === 'function') {
        options.onPageSizeChange(pageSize);
      }
      emitChange();
    }

    function renderTotal() {
      var totalEl = document.createElement('div');
      totalEl.className = 'wb-pagination__total';
      totalEl.textContent = '共 ' + total + ' 条';
      container.appendChild(totalEl);
    }

    function renderPager() {
      var pager = document.createElement('div');
      pager.className = 'wb-pagination__pager';

      var pageCount = getPageCount();

      pager.appendChild(createButton('<i class="ri-arrow-left-s-line"></i>', page <= 1, false, function() {
        changePage(page - 1);
      }, 'wb-pagination__btn--nav'));

      getPagerItems().forEach(function(item) {
        if (typeof item === 'string') {
          var ellipsis = document.createElement('span');
          ellipsis.className = 'wb-pagination__ellipsis';
          ellipsis.textContent = '...';
          pager.appendChild(ellipsis);
          return;
        }

        pager.appendChild(createButton(String(item), false, item === page, function() {
          changePage(item);
        }));
      });

      pager.appendChild(createButton('<i class="ri-arrow-right-s-line"></i>', page >= pageCount, false, function() {
        changePage(page + 1);
      }, 'wb-pagination__btn--nav'));

      container.appendChild(pager);
    }

    function renderSizeChanger() {
      var wrap = document.createElement('div');
      wrap.className = 'wb-pagination__size';

      var select = document.createElement('select');
      select.className = 'wb-pagination__size-select';

      pageSizes.forEach(function(size) {
        var option = document.createElement('option');
        option.value = size;
        option.textContent = size + ' 条/页';
        option.selected = Number(size) === pageSize;
        select.appendChild(option);
      });

      select.addEventListener('change', function() {
        changePageSize(select.value);
      });

      wrap.appendChild(select);
      container.appendChild(wrap);
    }

    function renderQuickJumper() {
      var wrap = document.createElement('div');
      wrap.className = 'wb-pagination__jumper';

      var label = document.createElement('span');
      label.textContent = '跳至';
      wrap.appendChild(label);

      var input = document.createElement('input');
      input.type = 'number';
      input.min = '1';
      input.max = String(getPageCount());
      input.value = String(page);
      input.className = 'wb-pagination__jumper-input';

      function applyJump() {
        changePage(input.value);
      }

      input.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') applyJump();
      });
      input.addEventListener('blur', applyJump);

      wrap.appendChild(input);

      var suffix = document.createElement('span');
      suffix.textContent = '页';
      wrap.appendChild(suffix);

      container.appendChild(wrap);
    }

    function render() {
      page = clampPage(page);
      container.innerHTML = '';

      if (showTotal) renderTotal();
      renderPager();
      if (showSizeChanger) renderSizeChanger();
      if (showQuickJumper) renderQuickJumper();
    }

    container.setTotal = function(nextTotal) {
      total = normalizeNumber(nextTotal, 0);
      page = clampPage(page);
      render();
    };

    container.setPage = function(nextPage) {
      changePage(nextPage);
    };

    container.setPageSize = function(nextPageSize) {
      changePageSize(nextPageSize);
    };

    container.getState = function() {
      return {
        total: total,
        page: page,
        pageSize: pageSize,
        pageCount: getPageCount()
      };
    };

    container.renderPagination = render;

    render();

    return container;
  }

  window.WBPagination = {
    create: createPagination
  };
})();
