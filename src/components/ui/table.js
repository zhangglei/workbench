/**
 * Table 表格组件
 * 支持列配置、排序、筛选、分页、行选择、空状态、加载状态
 */
(function() {
  'use strict';

  /**
   * 创建表格组件
   * @param {Object} options - 表格配置
   * @param {Array} options.columns - 列配置
   * @param {Array} options.data - 数据源
   * @param {string|Function} options.rowKey - 行唯一键字段
   * @param {boolean} options.striped - 是否斑马纹
   * @param {boolean} options.bordered - 是否显示边框
   * @param {boolean} options.hoverable - 是否启用悬停效果
   * @param {boolean} options.selectable - 是否启用行选择
   * @param {string} options.selectionType - 选择类型：multiple / single
   * @param {boolean} options.filterable - 是否启用关键字筛选
   * @param {string} options.filterKeyword - 初始筛选关键字
   * @param {string} options.filterPlaceholder - 筛选框占位文案
   * @param {Array<string>} options.filterFields - 参与筛选的字段列表
   * @param {Function} options.filterMethod - 自定义筛选方法
   * @param {boolean} options.pagination - 是否启用分页
   * @param {number} options.page - 当前页码
   * @param {number} options.pageSize - 每页条数
   * @param {Array<number>} options.pageSizes - 可选每页条数
   * @param {boolean} options.showSizeChanger - 是否显示每页条数切换
   * @param {boolean} options.showQuickJumper - 是否显示快速跳页
   * @param {boolean} options.showTotal - 是否显示总数
   * @param {number} options.maxPagerCount - 最大页码按钮数
   * @param {string} options.emptyText - 空状态文本
   * @param {boolean} options.loading - 是否加载中
   * @param {Function} options.onSort - 排序回调
   * @param {Function} options.onFilterChange - 筛选变化回调
   * @param {Function} options.onPageChange - 分页变化回调
   * @param {Function} options.onPageSizeChange - 每页条数变化回调
   * @param {Function} options.onRowClick - 行点击回调
   * @param {Function} options.onSelectionChange - 选择变化回调
   * @returns {HTMLElement} 表格容器元素
   */
  function createTable(options) {
    options = options || {};

    var columns = Array.isArray(options.columns) ? options.columns.slice() : [];
    var data = Array.isArray(options.data) ? options.data.slice() : [];
    var rowKey = options.rowKey || 'id';
    var striped = options.striped || false;
    var bordered = options.bordered !== false;
    var hoverable = options.hoverable !== false;
    var selectable = options.selectable || false;
    var selectionType = options.selectionType || 'multiple';
    var filterable = !!options.filterable;
    var filterKeyword = options.filterKeyword == null ? '' : String(options.filterKeyword);
    var filterPlaceholder = options.filterPlaceholder || '请输入关键字筛选';
    var filterFields = Array.isArray(options.filterFields) ? options.filterFields.slice() : null;
    var pagination = !!options.pagination;
    var page = normalizeNumber(options.page, 1, 1);
    var pageSize = normalizeNumber(options.pageSize, 10, 1);
    var pageSizes = Array.isArray(options.pageSizes) && options.pageSizes.length
      ? options.pageSizes.slice()
      : [10, 20, 50, 100];
    var showSizeChanger = options.showSizeChanger !== false;
    var showQuickJumper = !!options.showQuickJumper;
    var showTotal = options.showTotal !== false;
    var maxPagerCount = normalizeNumber(options.maxPagerCount, 7, 5);
    var emptyText = options.emptyText || '暂无数据';
    var loading = options.loading || false;

    var sortState = {
      field: null,
      order: null
    };

    var selectedKeyMap = {};

    var container = document.createElement('div');
    container.className = 'wb-table-wrapper';

    if (striped) {
      container.classList.add('wb-table-wrapper--striped');
    }
    if (bordered) {
      container.classList.add('wb-table-wrapper--bordered');
    }
    if (hoverable) {
      container.classList.add('wb-table-wrapper--hoverable');
    }
    if (loading) {
      container.classList.add('wb-table-wrapper--loading');
    }

    var toolbar = document.createElement('div');
    toolbar.className = 'wb-table-toolbar';
    if (!filterable) {
      toolbar.style.display = 'none';
    }
    container.appendChild(toolbar);

    var tableContainer = document.createElement('div');
    tableContainer.className = 'wb-table-container';

    var table = document.createElement('table');
    table.className = 'wb-table';

    var thead = document.createElement('thead');
    var tbody = document.createElement('tbody');

    table.appendChild(thead);
    table.appendChild(tbody);
    tableContainer.appendChild(table);
    container.appendChild(tableContainer);

    var stateWrap = document.createElement('div');
    stateWrap.className = 'wb-table-state';
    container.appendChild(stateWrap);

    var paginationWrap = document.createElement('div');
    paginationWrap.className = 'wb-table-pagination';
    paginationWrap.style.display = 'none';
    container.appendChild(paginationWrap);

    /**
     * 规范化数字，避免页码/页大小出现非法值。
     */
    function normalizeNumber(value, fallback, min) {
      var n = Number(value);
      if (!Number.isFinite(n)) {
        return fallback;
      }
      n = Math.floor(n);
      if (typeof min === 'number') {
        return Math.max(min, n);
      }
      return n;
    }

    /**
     * 获取行唯一键
     */
    function getRowKey(row, index) {
      if (typeof rowKey === 'function') {
        return rowKey(row, index);
      }
      if (row && row[rowKey] !== undefined && row[rowKey] !== null) {
        return row[rowKey];
      }
      return index;
    }

    /**
     * HTML 安全转义
     */
    function escapeHtml(value) {
      return String(value)
        .replace(/&/g, String.fromCharCode(38, 97, 109, 112, 59))
        .replace(/</g, String.fromCharCode(38, 108, 116, 59))
        .replace(/>/g, String.fromCharCode(38, 103, 116, 59))
        .replace(/"/g, String.fromCharCode(38, 113, 117, 111, 116, 59))
        .replace(/'/g, String.fromCharCode(38, 35, 51, 57, 59));
    }

    /**
     * 获取排序后的数据
     * 这里使用本地排序，便于组件独立运行。
     * 如果业务方传入 onSort，可在回调中接管排序逻辑。
     */
    function getSortedData() {
      var list = data.slice();

      if (!sortState.field || !sortState.order) {
        return list;
      }

      list.sort(function(a, b) {
        var valueA = a ? a[sortState.field] : undefined;
        var valueB = b ? b[sortState.field] : undefined;

        if (valueA === valueB) {
          return 0;
        }

        if (valueA === undefined || valueA === null) {
          return 1;
        }

        if (valueB === undefined || valueB === null) {
          return -1;
        }

        if (typeof valueA === 'number' && typeof valueB === 'number') {
          return sortState.order === 'asc' ? valueA - valueB : valueB - valueA;
        }

        var textA = String(valueA).toLowerCase();
        var textB = String(valueB).toLowerCase();

        if (textA < textB) {
          return sortState.order === 'asc' ? -1 : 1;
        }
        if (textA > textB) {
          return sortState.order === 'asc' ? 1 : -1;
        }
        return 0;
      });

      return list;
    }

    /**
     * 获取默认参与筛选的字段。
     * 未显式传入时，取列上的 dataIndex。
     */
    function getFilterFields() {
      if (filterFields && filterFields.length) {
        return filterFields;
      }

      return columns
        .map(function(column) {
          return column && column.dataIndex ? column.dataIndex : null;
        })
        .filter(function(field) {
          return !!field;
        });
    }

    /**
     * 判断单行是否匹配筛选。
     * 关键分支：支持自定义筛选逻辑，默认走字段模糊匹配。
     */
    function isRowMatched(row, rowIndex) {
      var keyword = String(filterKeyword || '').trim().toLowerCase();

      if (!filterable || !keyword) {
        return true;
      }

      if (typeof options.filterMethod === 'function') {
        return !!options.filterMethod(keyword, row, rowIndex);
      }

      var fields = getFilterFields();
      for (var i = 0; i < fields.length; i++) {
        var field = fields[i];
        var value = row && row[field] != null ? row[field] : '';
        if (String(value).toLowerCase().indexOf(keyword) !== -1) {
          return true;
        }
      }

      return false;
    }

    /**
     * 获取筛选后的数据
     */
    function getFilteredData() {
      var list = getSortedData();

      if (!filterable) {
        return list;
      }

      return list.filter(function(row, rowIndex) {
        return isRowMatched(row, rowIndex);
      });
    }

    /**
     * 获取总页数
     */
    function getPageCount(totalCount) {
      if (!pagination) {
        return 1;
      }
      return Math.max(1, Math.ceil(totalCount / pageSize));
    }

    /**
     * 修正页码到合法范围
     */
    function clampPage(nextPage, totalCount) {
      var maxPage = getPageCount(typeof totalCount === 'number' ? totalCount : getFilteredData().length);
      return Math.min(Math.max(1, normalizeNumber(nextPage, 1, 1)), maxPage);
    }

    /**
     * 获取当前页数据
     */
    function getPagedData(list) {
      if (!pagination) {
        return list.slice();
      }

      var safePage = clampPage(page, list.length);
      var start = (safePage - 1) * pageSize;
      return list.slice(start, start + pageSize);
    }

    /**
     * 获取当前可见数据。
     * 选择联动与表体渲染都基于这份结果，避免“跨页全选”误操作。
     */
    function getVisibleData() {
      var filteredData = getFilteredData();
      page = clampPage(page, filteredData.length);
      return getPagedData(filteredData);
    }

    /**
     * 渲染工具栏
     */
    function renderToolbar() {
      toolbar.innerHTML = '';

      if (!filterable) {
        toolbar.style.display = 'none';
        return;
      }

      toolbar.style.display = '';

      var filteredTotal = getFilteredData().length;
      var total = data.length;

      var filterWrap = document.createElement('div');
      filterWrap.className = 'wb-table__filter';

      var filterIcon = document.createElement('span');
      filterIcon.className = 'wb-table__filter-icon';
      filterIcon.innerHTML = '<i class="ri-search-line"></i>';
      filterWrap.appendChild(filterIcon);

      var input = document.createElement('input');
      input.type = 'text';
      input.className = 'wb-table__filter-input';
      input.placeholder = filterPlaceholder;
      input.value = filterKeyword;
      input.addEventListener('input', function() {
        filterKeyword = input.value || '';
        page = 1;
        render();
        emitFilterChange();
      });
      filterWrap.appendChild(input);

      if (filterKeyword) {
        var clearBtn = document.createElement('button');
        clearBtn.type = 'button';
        clearBtn.className = 'wb-table__filter-clear';
        clearBtn.innerHTML = '<i class="ri-close-line"></i>';
        clearBtn.addEventListener('click', function() {
          filterKeyword = '';
          page = 1;
          render();
          emitFilterChange();
        });
        filterWrap.appendChild(clearBtn);
      }

      var meta = document.createElement('div');
      meta.className = 'wb-table__meta';
      meta.textContent = filterKeyword
        ? ('匹配 ' + filteredTotal + ' / ' + total + ' 条')
        : ('共 ' + total + ' 条');

      toolbar.appendChild(filterWrap);
      toolbar.appendChild(meta);
    }

    /**
     * 渲染表头
     */
    function renderHeader() {
      thead.innerHTML = '';

      var tr = document.createElement('tr');

      if (selectable) {
        var selectionTh = document.createElement('th');
        selectionTh.className = 'wb-table__th wb-table__th--selection';

        if (selectionType === 'multiple') {
          var checkAll = document.createElement('input');
          checkAll.type = 'checkbox';
          checkAll.className = 'wb-table__checkbox';
          checkAll.checked = isAllSelected();
          checkAll.indeterminate = isPartiallySelected();
          checkAll.addEventListener('change', function() {
            toggleSelectAll(checkAll.checked);
          });
          selectionTh.appendChild(checkAll);
        }

        tr.appendChild(selectionTh);
      }

      columns.forEach(function(column) {
        var th = document.createElement('th');
        th.className = 'wb-table__th';

        if (column.width) {
          th.style.width = typeof column.width === 'number' ? column.width + 'px' : column.width;
        }
        if (column.align) {
          th.style.textAlign = column.align;
        }

        var title = document.createElement('div');
        title.className = 'wb-table__th-content';
        title.textContent = column.title || '';

        if (column.sortable) {
          th.classList.add('wb-table__th--sortable');

          var sortIcon = document.createElement('span');
          sortIcon.className = 'wb-table__sorter';
          sortIcon.innerHTML = '<i class="ri-arrow-up-s-line"></i><i class="ri-arrow-down-s-line"></i>';
          title.appendChild(sortIcon);

          if (sortState.field === column.dataIndex && sortState.order) {
            th.classList.add('wb-table__th--sorted-' + sortState.order);
          }

          th.addEventListener('click', function() {
            toggleSort(column);
          });
        }

        th.appendChild(title);
        tr.appendChild(th);
      });

      thead.appendChild(tr);
    }

    /**
     * 渲染表体
     */
    function renderBody() {
      tbody.innerHTML = '';

      var filteredData = getFilteredData();
      var visibleData = getPagedData(filteredData);
      page = clampPage(page, filteredData.length);

      if (loading) {
        renderState('loading', '加载中...');
        tableContainer.style.display = 'none';
        renderPagination(0, true);
        return;
      }

      if (!filteredData.length) {
        renderState('empty', emptyText);
        tableContainer.style.display = 'none';
        renderPagination(0, true);
        return;
      }

      hideState();
      tableContainer.style.display = '';

      visibleData.forEach(function(row, rowIndex) {
        var tr = document.createElement('tr');
        tr.className = 'wb-table__tr';

        var currentRowKey = getRowKey(row, rowIndex);

        if (selectedKeyMap[currentRowKey]) {
          tr.classList.add('wb-table__tr--selected');
        }

        if (selectable) {
          var selectionTd = document.createElement('td');
          selectionTd.className = 'wb-table__td wb-table__td--selection';

          var selector = document.createElement('input');
          selector.type = selectionType === 'single' ? 'radio' : 'checkbox';
          selector.name = selectionType === 'single' ? 'wb-table-selection-' + getTableId(container) : '';
          selector.className = 'wb-table__checkbox';
          selector.checked = !!selectedKeyMap[currentRowKey];

          selector.addEventListener('click', function(e) {
            e.stopPropagation();
          });

          selector.addEventListener('change', function() {
            toggleRowSelection(row, currentRowKey, selector.checked);
          });

          selectionTd.appendChild(selector);
          tr.appendChild(selectionTd);
        }

        columns.forEach(function(column) {
          var td = document.createElement('td');
          td.className = 'wb-table__td';

          if (column.align) {
            td.style.textAlign = column.align;
          }

          var cellValue = row ? row[column.dataIndex] : '';

          if (typeof column.render === 'function') {
            var rendered = column.render(cellValue, row, rowIndex);
            if (rendered instanceof HTMLElement) {
              td.appendChild(rendered);
            } else {
              td.innerHTML = rendered == null ? '' : String(rendered);
            }
          } else {
            td.innerHTML = cellValue == null ? '' : escapeHtml(cellValue);
          }

          tr.appendChild(td);
        });

        if (typeof options.onRowClick === 'function') {
          tr.style.cursor = 'pointer';
          tr.addEventListener('click', function() {
            options.onRowClick(row, rowIndex);
          });
        }

        tbody.appendChild(tr);
      });

      renderPagination(filteredData.length, false);
    }

    /**
     * 渲染分页区域
     */
    function renderPagination(filteredTotal, hidden) {
      paginationWrap.innerHTML = '';

      if (!pagination || hidden) {
        paginationWrap.style.display = 'none';
        return;
      }

      paginationWrap.style.display = '';

      if (window.WBPagination && typeof window.WBPagination.create === 'function') {
        var previousPageSize = pageSize;
        var pager = window.WBPagination.create({
          total: filteredTotal,
          page: page,
          pageSize: pageSize,
          pageSizes: pageSizes,
          showSizeChanger: showSizeChanger,
          showQuickJumper: showQuickJumper,
          showTotal: showTotal,
          maxPagerCount: maxPagerCount,
          onChange: function(state) {
            page = state.page;

            if (previousPageSize !== state.pageSize) {
              pageSize = state.pageSize;
              if (typeof options.onPageSizeChange === 'function') {
                options.onPageSizeChange(pageSize);
              }
            }

            if (typeof options.onPageChange === 'function') {
              options.onPageChange(state);
            }

            renderHeader();
            renderBody();
          }
        });

        paginationWrap.appendChild(pager);
        return;
      }

      var fallback = document.createElement('div');
      fallback.className = 'wb-table-pagination__fallback';
      fallback.textContent = '第 ' + page + ' / ' + getPageCount(filteredTotal) + ' 页，共 ' + filteredTotal + ' 条';
      paginationWrap.appendChild(fallback);
    }

    /**
     * 渲染状态
     */
    function renderState(type, text) {
      stateWrap.className = 'wb-table-state wb-table-state--' + type;
      stateWrap.innerHTML = '';

      var content = document.createElement('div');
      content.className = 'wb-table-state__content';

      var icon = document.createElement('i');
      icon.className = type === 'loading'
        ? 'ri-loader-4-line wb-table-state__icon wb-table-state__icon--loading'
        : 'ri-inbox-line wb-table-state__icon';
      content.appendChild(icon);

      var label = document.createElement('div');
      label.className = 'wb-table-state__text';
      label.textContent = text;
      content.appendChild(label);

      stateWrap.appendChild(content);
    }

    /**
     * 隐藏状态
     */
    function hideState() {
      stateWrap.className = 'wb-table-state';
      stateWrap.innerHTML = '';
    }

    /**
     * 切换排序
     */
    function toggleSort(column) {
      var field = column.dataIndex;

      if (sortState.field !== field) {
        sortState.field = field;
        sortState.order = 'asc';
      } else if (sortState.order === 'asc') {
        sortState.order = 'desc';
      } else if (sortState.order === 'desc') {
        sortState.order = null;
        sortState.field = null;
      } else {
        sortState.order = 'asc';
      }

      render();

      if (typeof options.onSort === 'function') {
        options.onSort({
          field: sortState.field,
          order: sortState.order,
          column: column
        });
      }
    }

    /**
     * 切换单行选择
     */
    function toggleRowSelection(row, key, checked) {
      if (selectionType === 'single') {
        selectedKeyMap = {};
      }

      if (checked) {
        selectedKeyMap[key] = true;
      } else {
        delete selectedKeyMap[key];
      }

      renderHeader();
      renderBody();
      emitSelectionChange();
    }

    /**
     * 全选/取消全选
     * 仅针对当前可见页，避免跨页误选。
     */
    function toggleSelectAll(checked) {
      var visibleData = getVisibleData();

      visibleData.forEach(function(row, index) {
        var key = getRowKey(row, index);
        if (checked) {
          selectedKeyMap[key] = true;
        } else {
          delete selectedKeyMap[key];
        }
      });

      renderHeader();
      renderBody();
      emitSelectionChange();
    }

    /**
     * 是否全选
     */
    function isAllSelected() {
      var visibleData = getVisibleData();
      if (!visibleData.length) {
        return false;
      }

      for (var i = 0; i < visibleData.length; i++) {
        if (!selectedKeyMap[getRowKey(visibleData[i], i)]) {
          return false;
        }
      }
      return true;
    }

    /**
     * 是否部分选中
     */
    function isPartiallySelected() {
      var visibleData = getVisibleData();
      if (!visibleData.length) {
        return false;
      }

      var count = 0;
      for (var i = 0; i < visibleData.length; i++) {
        if (selectedKeyMap[getRowKey(visibleData[i], i)]) {
          count++;
        }
      }

      return count > 0 && count < visibleData.length;
    }

    /**
     * 触发选择变化回调
     */
    function emitSelectionChange() {
      if (typeof options.onSelectionChange === 'function') {
        options.onSelectionChange(getSelectedRows(), getSelectedRowKeys());
      }
    }

    /**
     * 触发筛选变化回调
     */
    function emitFilterChange() {
      if (typeof options.onFilterChange === 'function') {
        options.onFilterChange({
          keyword: filterKeyword,
          total: data.length,
          filteredTotal: getFilteredData().length
        });
      }
    }

    /**
     * 获取选中行 key 列表
     */
    function getSelectedRowKeys() {
      return Object.keys(selectedKeyMap);
    }

    /**
     * 获取选中行数据
     */
    function getSelectedRows() {
      var map = selectedKeyMap;
      return data.filter(function(row, index) {
        return !!map[getRowKey(row, index)];
      });
    }

    /**
     * 生成表格唯一 id
     */
    function getTableId(element) {
      if (!element._wbTableId) {
        element._wbTableId = 'tb_' + Date.now() + '_' + Math.floor(Math.random() * 10000);
      }
      return element._wbTableId;
    }

    /**
     * 设置数据
     */
    function setData(newData) {
      data = Array.isArray(newData) ? newData.slice() : [];
      page = 1;
      render();
    }

    /**
     * 设置列配置
     */
    function setColumns(newColumns) {
      columns = Array.isArray(newColumns) ? newColumns.slice() : [];
      render();
    }

    /**
     * 设置加载状态
     */
    function setLoading(value) {
      loading = !!value;
      if (loading) {
        container.classList.add('wb-table-wrapper--loading');
      } else {
        container.classList.remove('wb-table-wrapper--loading');
      }
      render();
    }

    /**
     * 清空选择
     */
    function clearSelection() {
      selectedKeyMap = {};
      renderHeader();
      renderBody();
      emitSelectionChange();
    }

    /**
     * 设置选中 key
     */
    function setSelectedRowKeys(keys) {
      selectedKeyMap = {};
      (keys || []).forEach(function(key) {
        selectedKeyMap[key] = true;
      });
      renderHeader();
      renderBody();
      emitSelectionChange();
    }

    /**
     * 设置筛选关键字
     */
    function setFilterKeyword(keyword) {
      filterKeyword = keyword == null ? '' : String(keyword);
      page = 1;
      render();
      emitFilterChange();
    }

    /**
     * 设置页码
     */
    function setPage(nextPage) {
      if (!pagination) {
        return;
      }
      page = clampPage(nextPage);
      renderHeader();
      renderBody();
    }

    /**
     * 设置每页条数
     */
    function setPageSize(nextPageSize) {
      if (!pagination) {
        return;
      }
      pageSize = normalizeNumber(nextPageSize, pageSize, 1);
      page = 1;
      render();
      if (typeof options.onPageSizeChange === 'function') {
        options.onPageSizeChange(pageSize);
      }
    }

    /**
     * 获取当前数据
     */
    function getData() {
      return data.slice();
    }

    /**
     * 获取筛选关键字
     */
    function getFilterKeyword() {
      return filterKeyword;
    }

    /**
     * 获取排序状态
     */
    function getSortState() {
      return {
        field: sortState.field,
        order: sortState.order
      };
    }

    /**
     * 获取分页状态
     */
    function getPaginationState() {
      var filteredTotal = getFilteredData().length;
      return {
        enabled: pagination,
        page: clampPage(page, filteredTotal),
        pageSize: pageSize,
        total: filteredTotal,
        pageCount: getPageCount(filteredTotal)
      };
    }

    /**
     * 手动触发表格重绘
     */
    function render() {
      renderToolbar();
      renderHeader();
      renderBody();
    }

    container.setData = setData;
    container.setColumns = setColumns;
    container.setLoading = setLoading;
    container.clearSelection = clearSelection;
    container.setSelectedRowKeys = setSelectedRowKeys;
    container.getSelectedRowKeys = getSelectedRowKeys;
    container.getSelectedRows = getSelectedRows;
    container.setFilterKeyword = setFilterKeyword;
    container.getFilterKeyword = getFilterKeyword;
    container.setPage = setPage;
    container.setPageSize = setPageSize;
    container.getPaginationState = getPaginationState;
    container.getData = getData;
    container.getSortState = getSortState;
    container.renderTable = render;

    render();

    return container;
  }

  window.WBTable = {
    create: createTable
  };
})();
