class PopupController {
  constructor() {
    this.elements = {
      totalBookmarks: document.getElementById('totalBookmarks'),
      totalFolders: document.getElementById('totalFolders'),
      uncategorized: document.getElementById('uncategorized'),
      analyzeBtn: document.getElementById('analyzeBtn'),
      organizeBtn: document.getElementById('organizeBtn'),
      settingsBtn: document.getElementById('settingsBtn'),
      statusPanel: document.getElementById('statusPanel'),
      statusText: document.getElementById('statusText'),
      statusProgress: document.getElementById('statusProgress'),
      progressFill: document.getElementById('progressFill'),
      resultsPanel: document.getElementById('resultsPanel'),
      resultsSummary: document.getElementById('resultsSummary'),
      categoryList: document.getElementById('categoryList'),
      applyBtn: document.getElementById('applyBtn'),
      cancelBtn: document.getElementById('cancelBtn'),
      errorPanel: document.getElementById('errorPanel'),
      errorText: document.getElementById('errorText'),
      retryBtn: document.getElementById('retryBtn'),
      backupBtn: document.getElementById('backupBtn'),
      restoreBtn: document.getElementById('restoreBtn'),
      restoreFileInput: document.getElementById('restoreFileInput')
    };

    this.categorizedBookmarks = null;
    this.init();
  }

  async init() {
    this.bindEvents();
    await this.loadStats();
    await this.restoreAnalysisState();
  }

  async restoreAnalysisState() {
    try {
      const response = await chrome.runtime.sendMessage({ action: 'getAnalysisState' });
      if (response.success) {
        const state = response.data;
        
        if (state.status === 'running') {
          this.showStatus(state.progressText || '正在分析...', state.progress);
          this.setButtonsLoading(true);
        } else if (state.status === 'completed' && state.result) {
          this.categorizedBookmarks = state.result;
          this.showResults(state.result);
          this.elements.organizeBtn.disabled = false;
        } else if (state.status === 'error' && state.error) {
          this.showError(state.error);
        }
      }
    } catch (error) {
      console.error('Failed to restore analysis state:', error);
    }
  }

  bindEvents() {
    this.elements.analyzeBtn.addEventListener('click', () => this.analyze());
    this.elements.organizeBtn.addEventListener('click', () => this.organize());
    this.elements.settingsBtn.addEventListener('click', () => this.openSettings());
    this.elements.applyBtn.addEventListener('click', () => this.applyCategories());
    this.elements.cancelBtn.addEventListener('click', () => this.cancelResults());
    this.elements.retryBtn.addEventListener('click', () => this.analyze());
    this.elements.backupBtn.addEventListener('click', () => this.backupBookmarks());
    this.elements.restoreBtn.addEventListener('click', () => this.elements.restoreFileInput.click());
    this.elements.restoreFileInput.addEventListener('change', (e) => this.restoreBookmarks(e));

    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      this.handleMessage(message);
    });
  }

  async loadStats() {
    try {
      const response = await chrome.runtime.sendMessage({ action: 'getStats' });
      if (response.success) {
        this.elements.totalBookmarks.textContent = response.data.totalBookmarks;
        this.elements.totalFolders.textContent = response.data.totalFolders;
        this.elements.uncategorized.textContent = response.data.uncategorized;
      }
    } catch (error) {
      console.error('Failed to load stats:', error);
    }
  }

  async analyze() {
    this.hideAllPanels();
    this.showStatus('正在分析书签...', 0);
    this.setButtonsLoading(true);

    try {
      const response = await chrome.runtime.sendMessage({ action: 'analyzeBookmarks' });
      
      if (response.success) {
        this.categorizedBookmarks = response.data;
        this.showResults(response.data);
        this.elements.organizeBtn.disabled = false;
      } else {
        this.showError(response.error || '分析失败，请检查API设置');
      }
    } catch (error) {
      this.showError(error.message || '发生未知错误');
    } finally {
      this.setButtonsLoading(false);
    }
  }

  async organize() {
    if (!this.categorizedBookmarks) {
      await this.analyze();
      return;
    }
    this.applyCategories();
  }

  async applyCategories() {
    if (!this.categorizedBookmarks) return;

    this.hideAllPanels();
    this.showStatus('正在整理书签...', 0);
    this.setButtonsLoading(true);

    try {
      const response = await chrome.runtime.sendMessage({
        action: 'organizeBookmarks',
        data: this.categorizedBookmarks
      });

      if (response.success) {
        this.showStatus('整理完成!', 100);
        await this.loadStats();
        this.categorizedBookmarks = null;
        this.elements.organizeBtn.disabled = true;
        
        setTimeout(() => {
          this.hideAllPanels();
        }, 2000);
      } else {
        this.showError(response.error || '整理失败');
      }
    } catch (error) {
      this.showError(error.message || '发生未知错误');
    } finally {
      this.setButtonsLoading(false);
    }
  }

  cancelResults() {
    this.hideAllPanels();
    this.categorizedBookmarks = null;
    chrome.runtime.sendMessage({ action: 'clearAnalysisState' }).catch(() => {});
  }

  openSettings() {
    chrome.runtime.openOptionsPage();
  }

  handleMessage(message) {
    switch (message.type) {
      case 'progress':
        this.showStatus(message.text, message.progress);
        break;
      case 'error':
        this.showError(message.error);
        break;
    }
  }

  showStatus(text, progress) {
    this.elements.statusPanel.classList.remove('hidden');
    this.elements.resultsPanel.classList.add('hidden');
    this.elements.errorPanel.classList.add('hidden');
    
    this.elements.statusText.textContent = text;
    this.elements.statusProgress.textContent = progress > 0 ? `${progress}%` : '';
    this.elements.progressFill.style.width = `${progress}%`;
  }

  showResults(categories) {
    this.hideAllPanels();
    this.elements.resultsPanel.classList.remove('hidden');
    
    const categoryList = this.elements.categoryList;
    categoryList.innerHTML = '';

    const totalPaths = Object.keys(categories).length;
    const totalBookmarks = Object.values(categories).flat().length;
    
    const tree = this.buildCategoryTree(categories);
    const topLevelCount = Object.keys(tree).length;
    
    this.elements.resultsSummary.textContent = `${topLevelCount} 个大类，${totalPaths} 个分类路径，共 ${totalBookmarks} 个书签`;

    this.renderCategoryTree(tree, categoryList, 0);
  }

  buildCategoryTree(categories) {
    const tree = {};
    
    for (const [path, bookmarks] of Object.entries(categories)) {
      const parts = path.split('/').map(p => p.trim());
      let current = tree;
      
      for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        if (!current[part]) {
          current[part] = { _children: {}, _bookmarks: [] };
        }
        if (i === parts.length - 1) {
          current[part]._bookmarks = bookmarks;
        }
        current = current[part]._children;
      }
    }
    
    return tree;
  }

  renderCategoryTree(tree, container, depth) {
    for (const [name, node] of Object.entries(tree)) {
      const hasChildren = Object.keys(node._children).length > 0;
      const hasBookmarks = node._bookmarks.length > 0;
      const totalInBranch = this.countBookmarksInBranch(node);
      
      const categoryItem = document.createElement('div');
      categoryItem.className = `category-item depth-${depth}`;
      categoryItem.style.marginLeft = `${depth * 16}px`;
      
      const header = document.createElement('div');
      header.className = 'category-header';
      
      const iconType = hasChildren ? 'folder-tree' : 'folder';
      header.innerHTML = `
        <div class="category-title">
          <svg class="expand-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="9 18 15 12 9 6"></polyline>
          </svg>
          <svg class="folder-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            ${iconType === 'folder-tree' 
              ? '<path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path><line x1="12" y1="11" x2="12" y2="17"></line><line x1="9" y1="14" x2="15" y2="14"></line>'
              : '<path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>'}
          </svg>
          <span class="category-name">${name}</span>
        </div>
        <span class="category-count">${totalInBranch} 个</span>
      `;
      
      header.addEventListener('click', () => {
        categoryItem.classList.toggle('expanded');
      });
      
      categoryItem.appendChild(header);
      
      const content = document.createElement('div');
      content.className = 'category-content';
      
      if (hasChildren) {
        const subContainer = document.createElement('div');
        subContainer.className = 'subcategory-list';
        this.renderCategoryTree(node._children, subContainer, depth + 1);
        content.appendChild(subContainer);
      }
      
      if (hasBookmarks) {
        const list = document.createElement('div');
        list.className = 'bookmark-list';
        
        node._bookmarks.forEach(bookmark => {
          const item = document.createElement('div');
          item.className = 'bookmark-item';
          
          const favicon = document.createElement('img');
          favicon.className = 'bookmark-favicon';
          try {
            favicon.src = `https://www.google.com/s2/favicons?domain=${new URL(bookmark.url).hostname}&sz=16`;
          } catch (e) {
            favicon.style.display = 'none';
          }
          favicon.onerror = () => { favicon.style.display = 'none'; };
          
          const text = document.createElement('span');
          text.className = 'bookmark-text';
          text.textContent = bookmark.title || bookmark.url;
          text.title = bookmark.url;
          
          item.appendChild(favicon);
          item.appendChild(text);
          list.appendChild(item);
        });
        
        content.appendChild(list);
      }
      
      categoryItem.appendChild(content);
      container.appendChild(categoryItem);
    }
  }

  countBookmarksInBranch(node) {
    let count = node._bookmarks.length;
    for (const child of Object.values(node._children)) {
      count += this.countBookmarksInBranch(child);
    }
    return count;
  }

  showError(message) {
    this.hideAllPanels();
    this.elements.errorPanel.classList.remove('hidden');
    this.elements.errorText.textContent = message;
  }

  hideAllPanels() {
    this.elements.statusPanel.classList.add('hidden');
    this.elements.resultsPanel.classList.add('hidden');
    this.elements.errorPanel.classList.add('hidden');
  }

  setButtonsLoading(loading) {
    this.elements.analyzeBtn.disabled = loading;
    if (loading) {
      this.elements.analyzeBtn.classList.add('loading');
    } else {
      this.elements.analyzeBtn.classList.remove('loading');
    }
  }

  async backupBookmarks() {
    this.showStatus('正在备份书签...', 50);
    
    try {
      const response = await chrome.runtime.sendMessage({ action: 'exportBackup' });
      
      if (response.success) {
        const backup = response.data;
        const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const timestamp = new Date().toISOString().slice(0, 10);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `bookmarks-backup-${timestamp}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        this.showStatus('备份完成!', 100);
        setTimeout(() => this.hideAllPanels(), 2000);
      } else {
        this.showError(response.error || '备份失败');
      }
    } catch (error) {
      this.showError(error.message || '备份失败');
    }
  }

  async restoreBookmarks(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    this.showStatus('正在恢复书签...', 50);
    
    try {
      const text = await file.text();
      const backup = JSON.parse(text);
      
      const response = await chrome.runtime.sendMessage({
        action: 'restoreBackup',
        data: backup
      });
      
      if (response.success) {
        this.showStatus('恢复完成!', 100);
        await this.loadStats();
        setTimeout(() => this.hideAllPanels(), 2000);
      } else {
        this.showError(response.error || '恢复失败');
      }
    } catch (error) {
      this.showError('无效的备份文件');
    }
    
    event.target.value = '';
  }
}

document.addEventListener('DOMContentLoaded', () => {
  new PopupController();
});
