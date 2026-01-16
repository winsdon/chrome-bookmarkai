import { StorageManager } from './storageManager.js';

export class AIService {
  constructor() {
    this.storageManager = new StorageManager();
    this.config = null;
  }

  async getConfig() {
    if (!this.config) {
      this.config = await this.storageManager.getSettings();
    }
    return this.config;
  }

  updateConfig(newConfig) {
    this.config = newConfig;
  }

  async categorizeBookmarks(bookmarks) {
    const config = await this.getConfig();
    
    if (!config.apiKey) {
      throw new Error('请先在设置中配置API密钥');
    }

    if (bookmarks.length === 0) {
      return {};
    }

    const maxRootCategories = config.maxRootCategories || 10;
    const bookmarkData = bookmarks.map(b => ({
      id: b.id,
      title: b.title,
      url: b.url
    }));

    const hasCustomCategories = config.customCategories?.length > 0;
    const batchSize = 50;
    
    if (bookmarkData.length <= batchSize) {
      const prompt = this.buildPrompt(bookmarkData, config.customCategories, maxRootCategories);
      const response = await this.callAI(prompt, config);
      const parsed = this.parseResponse(response, bookmarks);
      return hasCustomCategories ? parsed : this.enforceMaxRootCategories(parsed, maxRootCategories);
    }

    const allCategories = {};
    for (let i = 0; i < bookmarkData.length; i += batchSize) {
      const batch = bookmarkData.slice(i, i + batchSize);
      const batchBookmarks = bookmarks.slice(i, i + batchSize);
      
      const prompt = this.buildPrompt(batch, config.customCategories, maxRootCategories);
      const response = await this.callAI(prompt, config);
      const batchResult = this.parseResponse(response, batchBookmarks);
      
      for (const [category, items] of Object.entries(batchResult)) {
        if (!allCategories[category]) {
          allCategories[category] = [];
        }
        allCategories[category].push(...items);
      }
    }
    
    return hasCustomCategories ? allCategories : this.enforceMaxRootCategories(allCategories, maxRootCategories);
  }

  enforceMaxRootCategories(categories, maxRootCategories) {
    const rootCounts = {};
    
    for (const path of Object.keys(categories)) {
      const rootCategory = path.split('/')[0];
      rootCounts[rootCategory] = (rootCounts[rootCategory] || 0) + 1;
    }

    const sortedRoots = Object.entries(rootCounts)
      .sort((a, b) => b[1] - a[1])
      .map(([name]) => name);

    if (sortedRoots.length <= maxRootCategories) {
      return categories;
    }

    const allowedRoots = new Set(sortedRoots.slice(0, maxRootCategories - 1));
    const result = {};

    for (const [path, bookmarks] of Object.entries(categories)) {
      const rootCategory = path.split('/')[0];
      
      if (allowedRoots.has(rootCategory)) {
        result[path] = bookmarks;
      } else {
        const newPath = '其他/' + path;
        if (!result[newPath]) {
          result[newPath] = [];
        }
        result[newPath].push(...bookmarks);
      }
    }

    return result;
  }

  buildPrompt(bookmarks, customCategories, maxRootCategories = 10) {
    const hasCustomCategories = customCategories?.length > 0;
    
    // 从自定义分类中提取一级分类（路径的第一部分）
    const rootCategories = hasCustomCategories 
      ? [...new Set(customCategories.map(c => c.split('/')[0].trim()))]
      : [];
    
    // 构建预设的分类路径示例
    const categoryPaths = hasCustomCategories 
      ? customCategories.map(c => `"${c}"`).join(', ')
      : '';

    const categoryInstruction = hasCustomCategories
      ? `**【强制要求 - 必须严格遵守】**
1. 一级分类只能使用以下名称：${rootCategories.join('、')}
2. 预设的分类路径参考：${categoryPaths}
3. 可以在预设路径下继续创建子分类，但一级分类名称不可更改
4. 只有实在无法归入任何预设分类的书签，才放入"其他"分类
5. **严禁创建预设之外的一级分类**`
      : `分类层级指南:
1. 第一层(大类): 技术开发、学习资源、新闻资讯、社交媒体、购物电商、影音娱乐、工作效率、生活服务、金融理财、设计创意、其他
2. 第二层(中类): 根据内容细分，如 技术开发 下可分为 前端、后端、数据库、DevOps、AI/ML 等
3. 第三层(小类): 可选，更具体的分类，如 前端 下可分为 React、Vue、CSS、工具 等`;

    const exampleJson = hasCustomCategories && rootCategories.length > 0
      ? `{
  "${rootCategories[0]}/子分类1": ["书签id1", "书签id2"],
  "${rootCategories[0]}/子分类2": ["书签id3"],
  "${rootCategories.length > 1 ? rootCategories[1] : rootCategories[0]}/子分类": ["书签id4", "书签id5"]
}`
      : `{
  "技术开发/前端/React": ["书签id1", "书签id2"],
  "技术开发/后端/Python": ["书签id3"],
  "学习资源/在线课程": ["书签id4", "书签id5"]
}`;

    return `你是一个专业的书签整理助手。请分析以下书签并创建合理的多层级分类结构。

${categoryInstruction}

书签列表:
${JSON.stringify(bookmarks, null, 2)}

请以JSON格式返回分类结果，使用路径格式表示层级（用"/"分隔），格式示例:
${exampleJson}

要求:
1. 层级深度2-3层为宜，不要超过3层
2. 每个书签必须属于且只属于一个分类路径
3. 分类名称简洁明了，使用中文
4. 同类书签数量少于3个时，可合并到上一层级
5. 根据URL域名和标题综合判断最合适的分类
${hasCustomCategories 
  ? `6. **【最重要】一级分类只能是：${rootCategories.join('、')}，严禁使用其他名称**`
  : `6. 根目录最多只能有 ${maxRootCategories} 个一级分类，超出的请合并到"其他"分类下`}
7. 只返回JSON，不要有其他文字`;
  }

  async callAI(prompt, config) {
    const apiUrl = config.apiEndpoint || 'https://api.openai.com/v1/chat/completions';
    const model = config.model || 'gpt-3.5-turbo';

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`
      },
      body: JSON.stringify({
        model: model,
        messages: [
          {
            role: 'system',
            content: '你是一个专业的书签整理助手，擅长对网页书签进行智能分类。'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.3,
        max_tokens: 4000
      })
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error?.message || `API请求失败: ${response.status}`);
    }

    const data = await response.json();
    return data.choices[0]?.message?.content || '';
  }

  parseResponse(responseText, bookmarks) {
    try {
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('无法解析AI响应');
      }

      const categoryMap = JSON.parse(jsonMatch[0]);
      const result = {};

      const bookmarkMap = new Map(bookmarks.map(b => [b.id, b]));

      for (const [category, ids] of Object.entries(categoryMap)) {
        result[category] = [];
        for (const id of ids) {
          const bookmark = bookmarkMap.get(id);
          if (bookmark) {
            result[category].push(bookmark);
          }
        }
      }

      return result;
    } catch (error) {
      console.error('Parse error:', error);
      throw new Error('解析AI响应失败，请重试');
    }
  }
}
