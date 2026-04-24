/**
 * 高级搜索模块
 * 支持语法：tag:Linux date:2024-12 author:Admin "精确匹配"
 */
(function () {
  'use strict';

  /**
   * 解析搜索查询，提取过滤条件
   * @param {string} query - 搜索查询字符串
   * @returns {Object} 解析后的搜索条件
   */
  function parseSearchQuery(query) {
    if (!query || typeof query !== 'string') {
      return { text: '', filters: {} };
    }

    var filters = {};
    var remainingText = query;

    // 提取精确匹配（引号包裹）
    var exactMatches = [];
    remainingText = remainingText.replace(/"([^"]+)"/g, function(match, content) {
      exactMatches.push(content);
      return '';
    });

    // 提取过滤条件：tag:xxx, category:xxx, date:xxx, author:xxx
    var filterPatterns = [
      { key: 'tag', pattern: /tag:([^\s]+)/gi },
      { key: 'category', pattern: /category:([^\s]+)/gi },
      { key: 'date', pattern: /date:([^\s]+)/gi },
      { key: 'author', pattern: /author:([^\s]+)/gi },
      { key: 'priority', pattern: /priority:(high|medium|low)/gi }
    ];

    filterPatterns.forEach(function(filter) {
      var matches = [];
      var match;
      while ((match = filter.pattern.exec(remainingText)) !== null) {
        matches.push(match[1]);
      }
      if (matches.length > 0) {
        filters[filter.key] = matches;
        remainingText = remainingText.replace(filter.pattern, '');
      }
    });

    // 剩余文本作为普通搜索词
    var text = remainingText.trim().toLowerCase();
    
    return {
      text: text,
      exactMatches: exactMatches,
      filters: filters
    };
  }

  /**
   * 检查项目是否匹配搜索条件
   * @param {Object} item - 待检查的项目（模块、待办、笔记等）
   * @param {Object} searchCriteria - 搜索条件
   * @returns {boolean} 是否匹配
   */
  function matchesSearchCriteria(item, searchCriteria) {
    if (!item || !searchCriteria) return true;

    var text = searchCriteria.text;
    var exactMatches = searchCriteria.exactMatches || [];
    var filters = searchCriteria.filters || {};

    // 1. 检查精确匹配
    if (exactMatches.length > 0) {
      var itemText = getItemSearchableText(item).toLowerCase();
      var allExactMatch = exactMatches.every(function(exact) {
        return itemText.indexOf(exact.toLowerCase()) !== -1;
      });
      if (!allExactMatch) return false;
    }

    // 2. 检查普通文本匹配
    if (text) {
      var searchableText = getItemSearchableText(item).toLowerCase();
      if (searchableText.indexOf(text) === -1) return false;
    }

    // 3. 检查标签过滤
    if (filters.tag && filters.tag.length > 0) {
      var itemTags = getItemTags(item);
      var hasMatchingTag = filters.tag.some(function(filterTag) {
        return itemTags.some(function(itemTag) {
          return itemTag.toLowerCase().indexOf(filterTag.toLowerCase()) !== -1;
        });
      });
      if (!hasMatchingTag) return false;
    }

    // 4. 检查分类过滤
    if (filters.category && filters.category.length > 0) {
      var itemCategory = (item.category || '').toLowerCase();
      var hasMatchingCategory = filters.category.some(function(cat) {
        return itemCategory.indexOf(cat.toLowerCase()) !== -1;
      });
      if (!hasMatchingCategory) return false;
    }

    // 5. 检查日期过滤
    if (filters.date && filters.date.length > 0) {
      var itemDate = getItemDate(item);
      var hasMatchingDate = filters.date.some(function(dateFilter) {
        return itemDate.indexOf(dateFilter) !== -1;
      });
      if (!hasMatchingDate) return false;
    }

    // 6. 检查作者过滤
    if (filters.author && filters.author.length > 0) {
      var itemAuthor = (item.author || '').toLowerCase();
      var hasMatchingAuthor = filters.author.some(function(author) {
        return itemAuthor.indexOf(author.toLowerCase()) !== -1;
      });
      if (!hasMatchingAuthor) return false;
    }

    // 7. 检查优先级过滤（待办）
    if (filters.priority && filters.priority.length > 0) {
      var itemPriority = (item.priority || 'medium').toLowerCase();
      var hasMatchingPriority = filters.priority.some(function(priority) {
        return itemPriority === priority.toLowerCase();
      });
      if (!hasMatchingPriority) return false;
    }

    return true;
  }

  /**
   * 获取项目的可搜索文本
   */
  function getItemSearchableText(item) {
    var parts = [
      item.title || '',
      item.name || '',
      item.text || '',
      item.content || '',
      item.summary || '',
      item.url || ''
    ];
    
    // 添加附件文件名
    if (Array.isArray(item.attachments)) {
      item.attachments.forEach(function(att) {
        parts.push(att.name || '');
      });
    }
    
    return parts.join(' ');
  }

  /**
   * 获取项目的标签列表
   */
  function getItemTags(item) {
    if (Array.isArray(item.tags)) {
      return item.tags.map(function(tag) {
        return String(tag || '');
      });
    }
    return [];
  }

  /**
   * 获取项目的日期字符串
   */
  function getItemDate(item) {
    var date = item.date || item.createdAt || item.updatedAt;
    if (!date) return '';
    
    if (typeof date === 'number') {
      date = new Date(date);
    }
    
    if (date instanceof Date) {
      return date.toISOString().slice(0, 10);
    }
    
    return String(date);
  }

  /**
   * 生成搜索提示文本
   */
  function getSearchHint(searchCriteria) {
    if (!searchCriteria || (!searchCriteria.text && Object.keys(searchCriteria.filters || {}).length === 0)) {
      return '';
    }

    var hints = [];
    
    if (searchCriteria.text) {
      hints.push('关键词: ' + searchCriteria.text);
    }
    
    if (searchCriteria.exactMatches && searchCriteria.exactMatches.length > 0) {
      hints.push('精确匹配: "' + searchCriteria.exactMatches.join('", "') + '"');
    }
    
    var filters = searchCriteria.filters || {};
    if (filters.tag) {
      hints.push('标签: ' + filters.tag.join(', '));
    }
    if (filters.category) {
      hints.push('分类: ' + filters.category.join(', '));
    }
    if (filters.date) {
      hints.push('日期: ' + filters.date.join(', '));
    }
    if (filters.author) {
      hints.push('作者: ' + filters.author.join(', '));
    }
    if (filters.priority) {
      hints.push('优先级: ' + filters.priority.join(', '));
    }
    
    return hints.join(' | ');
  }

  // 暴露给全局
  window.AdvancedSearch = {
    parseSearchQuery: parseSearchQuery,
    matchesSearchCriteria: matchesSearchCriteria,
    getSearchHint: getSearchHint
  };
})();
