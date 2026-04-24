/**
 * 笔记模板模块
 * 提供预设模板快速创建笔记
 */
(function () {
  'use strict';

  /* 预设模板 */
  var NOTE_TEMPLATES = {
    technical: {
      name: '技术笔记',
      icon: '💻',
      category: '技术',
      tags: ['技术'],
      content: `# {{标题}}

## 问题描述

在什么场景下遇到了什么问题？

## 解决方案

### 方案一

\`\`\`bash
# 命令或代码
\`\`\`

### 方案二（可选）

\`\`\`bash
# 备选方案
\`\`\`

## 原理分析

为什么这个方案有效？底层原理是什么？

## 参考资料

- [文档链接](https://example.com)
- [相关文章](https://example.com)

## 注意事项

- 注意点1
- 注意点2
`
    },
    meeting: {
      name: '会议记录',
      icon: '📝',
      category: '会议',
      tags: ['会议'],
      content: `# {{标题}}

**时间**：{{日期}}  
**地点**：  
**参会人**：  
**记录人**：

## 会议议题

1. 议题一
2. 议题二

## 讨论内容

### 议题一：

**讨论要点**：

**决议**：

### 议题二：

**讨论要点**：

**决议**：

## 待办事项

- [ ] 任务1 - 负责人：XXX - 截止日期：
- [ ] 任务2 - 负责人：XXX - 截止日期：

## 下次会议

**时间**：  
**议题**：
`
    },
    learning: {
      name: '学习笔记',
      icon: '📚',
      category: '学习',
      tags: ['学习'],
      content: `# {{标题}}

**学习日期**：{{日期}}  
**学习来源**：（书籍/课程/文章）  
**难度等级**：⭐⭐⭐☆☆

## 核心概念

### 概念一

定义：

示例：

### 概念二

定义：

示例：

## 重点内容

1. 要点一
2. 要点二
3. 要点三

## 代码示例

\`\`\`javascript
// 示例代码
\`\`\`

## 个人理解

我的理解和思考...

## 延伸阅读

- 相关主题1
- 相关主题2

## 实践计划

- [ ] 实践任务1
- [ ] 实践任务2
`
    },
    troubleshooting: {
      name: '问题排查',
      icon: '🔧',
      category: '故障排查',
      tags: ['故障', '排查'],
      content: `# {{标题}}

**发生时间**：{{日期}}  
**影响范围**：  
**严重程度**：🔴 高 / 🟡 中 / 🟢 低

## 问题现象

详细描述问题的表现...

## 环境信息

- 操作系统：
- 软件版本：
- 相关配置：

## 排查过程

### 步骤1：初步检查

\`\`\`bash
# 执行的命令
\`\`\`

**结果**：

### 步骤2：深入分析

\`\`\`bash
# 执行的命令
\`\`\`

**结果**：

### 步骤3：定位根因

**根本原因**：

## 解决方案

\`\`\`bash
# 修复命令或配置
\`\`\`

## 验证结果

- [ ] 问题已解决
- [ ] 功能正常
- [ ] 无副作用

## 预防措施

1. 措施一
2. 措施二

## 相关问题

- 类似问题链接
`
    },
    weekly: {
      name: '周报总结',
      icon: '📊',
      category: '总结',
      tags: ['周报', '总结'],
      content: `# 周报 - {{标题}}

**时间范围**：{{日期}} ~ 

## 本周完成

### 主要工作

1. **项目A**
   - 完成功能X开发
   - 修复Bug Y
   - 进度：80%

2. **项目B**
   - 完成需求评审
   - 进度：30%

### 数据指标

- 完成任务数：X个
- 代码提交：X次
- Bug修复：X个

## 遇到的问题

1. **问题1**
   - 描述：
   - 影响：
   - 解决方案：

## 下周计划

- [ ] 任务1
- [ ] 任务2
- [ ] 任务3

## 学习与成长

本周学到的新知识或技能...

## 其他事项

需要协调或反馈的事项...
`
    },
    quicknote: {
      name: '快速笔记',
      icon: '⚡',
      category: '笔记',
      tags: ['笔记'],
      content: `# {{标题}}

**创建时间**：{{日期}}

## 内容

在这里快速记录想法、灵感或临时信息...

## 标签

#标签1 #标签2

## 相关链接

- [链接1](https://example.com)
`
    }
  };

  /**
   * 应用模板到笔记数据
   * @param {string} templateKey - 模板键名
   * @param {Object} customData - 自定义数据（标题、日期等）
   * @returns {Object} 笔记数据对象
   */
  function applyTemplate(templateKey, customData) {
    var template = NOTE_TEMPLATES[templateKey];
    if (!template) {
      return null;
    }

    var now = new Date();
    var dateStr = now.getFullYear() + '-' + 
      String(now.getMonth() + 1).padStart(2, '0') + '-' + 
      String(now.getDate()).padStart(2, '0');

    var title = (customData && customData.title) || '新笔记';
    var content = template.content
      .replace(/\{\{标题\}\}/g, title)
      .replace(/\{\{日期\}\}/g, dateStr);

    return {
      title: title,
      category: template.category,
      tags: template.tags.slice(),
      content: content,
      author: (customData && customData.author) || 'Admin',
      date: dateStr,
      summary: '',
      pinned: false,
      views: 0
    };
  }

  /**
   * 获取所有模板列表
   * @returns {Array} 模板列表
   */
  function getTemplateList() {
    return Object.keys(NOTE_TEMPLATES).map(function(key) {
      var template = NOTE_TEMPLATES[key];
      return {
        key: key,
        name: template.name,
        icon: template.icon,
        category: template.category
      };
    });
  }

  /**
   * 获取模板预览
   * @param {string} templateKey - 模板键名
   * @returns {string} 模板内容预览
   */
  function getTemplatePreview(templateKey) {
    var template = NOTE_TEMPLATES[templateKey];
    if (!template) return '';
    
    return template.content
      .replace(/\{\{标题\}\}/g, '示例标题')
      .replace(/\{\{日期\}\}/g, '2024-12-01');
  }

  // 暴露给全局
  window.NoteTemplates = {
    templates: NOTE_TEMPLATES,
    applyTemplate: applyTemplate,
    getTemplateList: getTemplateList,
    getTemplatePreview: getTemplatePreview
  };
})();
