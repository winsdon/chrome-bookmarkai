class OptionsController {
  constructor() {
    this.elements = {
      form: document.getElementById('settingsForm'),
      apiKey: document.getElementById('apiKey'),
      apiEndpoint: document.getElementById('apiEndpoint'),
      model: document.getElementById('model'),
      customModelGroup: document.getElementById('customModelGroup'),
      customModel: document.getElementById('customModel'),
      categoryTemplate: document.getElementById('categoryTemplate'),
      maxRootCategories: document.getElementById('maxRootCategories'),
      customCategories: document.getElementById('customCategories'),
      ignoreFoldersContainer: document.getElementById('ignoreFoldersContainer'),
      autoOrganize: document.getElementById('autoOrganize'),
      testBtn: document.getElementById('testBtn'),
      toast: document.getElementById('toast')
    };

    this.folders = [];
    this.selectedIgnoreFolders = [];

    this.templates = {
      developer: [
        '技术开发/前端',
        '技术开发/后端',
        '技术开发/移动端',
        '技术开发/数据库',
        '技术开发/DevOps',
        '技术开发/AI与机器学习',
        '技术开发/工具与效率',
        '开源项目',
        '技术文档',
        '技术博客',
        '代码托管',
        '学习资源/教程',
        '学习资源/视频课程',
        '社区论坛',
        '求职招聘',
        '其他'
      ],
      product: [
        '产品设计/原型工具',
        '产品设计/需求文档',
        '产品设计/竞品分析',
        '用户研究/数据分析',
        '用户研究/用户反馈',
        '项目管理/协作工具',
        '项目管理/进度跟踪',
        '行业资讯',
        '产品案例',
        '学习资源',
        '职业发展',
        '其他'
      ],
      designer: [
        '设计工具/UI设计',
        '设计工具/原型设计',
        '设计工具/图片处理',
        '设计素材/图标',
        '设计素材/图片',
        '设计素材/字体',
        '设计素材/配色',
        '设计灵感/Dribbble',
        '设计灵感/Behance',
        '设计灵感/网站收集',
        '设计规范',
        '学习资源',
        '设计社区',
        '其他'
      ],
      researcher: [
        '学术论文/数据库',
        '学术论文/预印本',
        '学术论文/已读文献',
        '研究工具/文献管理',
        '研究工具/数据分析',
        '研究工具/写作工具',
        '学术会议',
        '研究课题',
        '合作机构',
        '基金项目',
        '学术社交',
        '新闻资讯',
        '其他'
      ],
      marketer: [
        '营销工具/SEO',
        '营销工具/SEM',
        '营销工具/社媒管理',
        '营销工具/邮件营销',
        '数据分析/流量分析',
        '数据分析/用户分析',
        '内容创作/文案',
        '内容创作/图片视频',
        '竞品监控',
        '行业报告',
        '营销案例',
        '学习资源',
        '其他'
      ],
      student: [
        '课程学习/在线课程',
        '课程学习/学校课程',
        '课程学习/考试复习',
        '学习工具/笔记',
        '学习工具/思维导图',
        '学习工具/翻译词典',
        '论文写作',
        '求职实习',
        '校园生活',
        '兴趣爱好',
        '影音娱乐',
        '购物',
        '其他'
      ],
      general: [
        '工作效率',
        '学习资源',
        '新闻资讯',
        '社交媒体',
        '影音娱乐',
        '购物电商',
        '生活服务',
        '金融理财',
        '旅行出行',
        '健康医疗',
        '其他'
      ]
    };

    this.init();
  }

  async init() {
    await this.loadFolders();
    await this.loadSettings();
    this.bindEvents();
  }

  async loadFolders() {
    try {
      const response = await chrome.runtime.sendMessage({ action: 'getFolders' });
      if (response.success) {
        this.folders = response.data;
      }
    } catch (error) {
      console.error('Failed to load folders:', error);
    }
  }

  renderFolderCheckboxes(ignoreFolders = []) {
    const container = this.elements.ignoreFoldersContainer;
    
    if (this.folders.length === 0) {
      container.innerHTML = '<p class="hint">暂无文件夹</p>';
      return;
    }

    container.innerHTML = '';
    this.selectedIgnoreFolders = [...ignoreFolders];

    const tree = this.buildFolderTree(this.folders);
    this.renderFolderTree(tree, container, ignoreFolders);
  }

  buildFolderTree(folders) {
    const map = new Map();
    const roots = [];

    folders.forEach(folder => {
      map.set(folder.id, { ...folder, children: [] });
    });

    folders.forEach(folder => {
      const node = map.get(folder.id);
      const parent = map.get(folder.parentId);
      if (parent) {
        parent.children.push(node);
      } else {
        roots.push(node);
      }
    });

    return roots;
  }

  renderFolderTree(nodes, container, ignoreFolders, depth = 0) {
    nodes.forEach(node => {
      const item = document.createElement('div');
      item.className = 'folder-tree-item';
      item.style.paddingLeft = `${depth * 20}px`;

      const label = document.createElement('label');
      label.className = 'folder-checkbox';

      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.value = node.id;
      checkbox.checked = ignoreFolders.includes(node.id);
      checkbox.addEventListener('change', () => {
        if (checkbox.checked) {
          if (!this.selectedIgnoreFolders.includes(node.id)) {
            this.selectedIgnoreFolders.push(node.id);
          }
        } else {
          this.selectedIgnoreFolders = this.selectedIgnoreFolders.filter(id => id !== node.id);
        }
      });

      const hasChildren = node.children && node.children.length > 0;
      
      const expandBtn = document.createElement('span');
      expandBtn.className = 'folder-expand-btn';
      if (hasChildren) {
        expandBtn.textContent = '▶';
        expandBtn.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          const childContainer = item.querySelector('.folder-children');
          const isExpanded = childContainer.style.display !== 'none';
          childContainer.style.display = isExpanded ? 'none' : 'block';
          expandBtn.textContent = isExpanded ? '▶' : '▼';
        });
      } else {
        expandBtn.textContent = '  ';
      }

      const icon = document.createElement('span');
      icon.className = 'folder-icon-small';
      icon.textContent = hasChildren ? '📂' : '📁';

      const text = document.createElement('span');
      text.className = 'folder-name';
      text.textContent = node.title;

      label.appendChild(checkbox);
      label.appendChild(expandBtn);
      label.appendChild(icon);
      label.appendChild(text);
      item.appendChild(label);

      if (hasChildren) {
        const childContainer = document.createElement('div');
        childContainer.className = 'folder-children';
        childContainer.style.display = 'none';
        this.renderFolderTree(node.children, childContainer, ignoreFolders, depth + 1);
        item.appendChild(childContainer);
      }

      container.appendChild(item);
    });
  }

  bindEvents() {
    this.elements.form.addEventListener('submit', (e) => this.handleSubmit(e));
    this.elements.testBtn.addEventListener('click', () => this.testConnection());
    this.elements.model.addEventListener('change', () => this.handleModelChange());
    this.elements.categoryTemplate.addEventListener('change', () => this.handleTemplateChange());
  }

  handleTemplateChange() {
    const templateKey = this.elements.categoryTemplate.value;
    if (templateKey && this.templates[templateKey]) {
      this.elements.customCategories.value = this.templates[templateKey].join('\n');
      this.showToast('已应用模板: ' + this.elements.categoryTemplate.selectedOptions[0].text, 'success');
    }
  }

  async loadSettings() {
    try {
      const response = await chrome.runtime.sendMessage({ action: 'getSettings' });
      if (response.success) {
        const settings = response.data;
        this.elements.apiKey.value = settings.apiKey || '';
        this.elements.apiEndpoint.value = settings.apiEndpoint || '';
        
        const modelSelect = this.elements.model;
        const modelExists = Array.from(modelSelect.options).some(opt => opt.value === settings.model);
        
        if (modelExists) {
          modelSelect.value = settings.model;
        } else if (settings.model) {
          modelSelect.value = 'custom';
          this.elements.customModel.value = settings.model;
          this.elements.customModelGroup.classList.remove('hidden');
        }
        
        this.elements.customCategories.value = (settings.customCategories || []).join('\n');
        this.elements.maxRootCategories.value = settings.maxRootCategories || 10;
        this.elements.autoOrganize.checked = settings.autoOrganize || false;
        
        this.renderFolderCheckboxes(settings.ignoreFolders || []);
      }
    } catch (error) {
      console.error('Failed to load settings:', error);
    }
  }

  handleModelChange() {
    const isCustom = this.elements.model.value === 'custom';
    this.elements.customModelGroup.classList.toggle('hidden', !isCustom);
  }

  async handleSubmit(e) {
    e.preventDefault();
    
    const model = this.elements.model.value === 'custom' 
      ? this.elements.customModel.value 
      : this.elements.model.value;

    const settings = {
      apiKey: this.elements.apiKey.value.trim(),
      apiEndpoint: this.elements.apiEndpoint.value.trim() || 'https://api.openai.com/v1/chat/completions',
      model: model,
      customCategories: this.elements.customCategories.value
        .split('\n')
        .map(c => c.trim())
        .filter(c => c.length > 0),
      maxRootCategories: parseInt(this.elements.maxRootCategories.value) || 10,
      ignoreFolders: this.selectedIgnoreFolders,
      autoOrganize: this.elements.autoOrganize.checked
    };

    try {
      const response = await chrome.runtime.sendMessage({
        action: 'saveSettings',
        data: settings
      });

      if (response.success) {
        this.showToast('设置已保存', 'success');
      } else {
        this.showToast('保存失败: ' + response.error, 'error');
      }
    } catch (error) {
      this.showToast('保存失败: ' + error.message, 'error');
    }
  }

  async testConnection() {
    const apiKey = this.elements.apiKey.value.trim();
    const apiEndpoint = this.elements.apiEndpoint.value.trim() || 'https://api.openai.com/v1/chat/completions';
    const model = this.elements.model.value === 'custom' 
      ? this.elements.customModel.value 
      : this.elements.model.value;

    if (!apiKey) {
      this.showToast('请先输入API密钥', 'error');
      return;
    }

    this.elements.testBtn.disabled = true;
    this.elements.testBtn.textContent = '测试中...';

    try {
      const response = await fetch(apiEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: model,
          messages: [{ role: 'user', content: 'Hello' }],
          max_tokens: 5
        })
      });

      if (response.ok) {
        this.showToast('连接成功！', 'success');
      } else {
        const error = await response.json().catch(() => ({}));
        this.showToast('连接失败: ' + (error.error?.message || response.status), 'error');
      }
    } catch (error) {
      this.showToast('连接失败: ' + error.message, 'error');
    } finally {
      this.elements.testBtn.disabled = false;
      this.elements.testBtn.textContent = '测试连接';
    }
  }

  showToast(message, type) {
    const toast = this.elements.toast;
    toast.textContent = message;
    toast.className = `toast ${type}`;
    
    setTimeout(() => {
      toast.classList.add('hidden');
    }, 3000);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  new OptionsController();
});
