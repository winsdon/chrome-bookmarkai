import { BookmarkManager } from './modules/bookmarkManager.js';
import { AIService } from './modules/aiService.js';
import { StorageManager } from './modules/storageManager.js';

class BackgroundService {
  constructor() {
    this.bookmarkManager = new BookmarkManager();
    this.aiService = new AIService();
    this.storageManager = new StorageManager();
    this.analysisState = {
      status: 'idle',
      progress: 0,
      progressText: '',
      result: null,
      error: null
    };
    this.init();
  }

  init() {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      this.handleMessage(message, sender, sendResponse);
      return true;
    });
  }

  async handleMessage(message, sender, sendResponse) {
    try {
      switch (message.action) {
        case 'getStats':
          const stats = await this.bookmarkManager.getStats();
          sendResponse({ success: true, data: stats });
          break;

        case 'getAnalysisState':
          sendResponse({ success: true, data: this.analysisState });
          break;

        case 'clearAnalysisState':
          this.analysisState = {
            status: 'idle',
            progress: 0,
            progressText: '',
            result: null,
            error: null
          };
          sendResponse({ success: true });
          break;

        case 'analyzeBookmarks':
          this.runAnalysis().then(result => {
            sendResponse({ success: true, data: result });
          }).catch(error => {
            sendResponse({ success: false, error: error.message });
          });
          return;

        case 'organizeBookmarks':
          await this.organizeBookmarks(message.data);
          this.analysisState = {
            status: 'idle',
            progress: 0,
            progressText: '',
            result: null,
            error: null
          };
          sendResponse({ success: true });
          break;

        case 'getSettings':
          const settings = await this.storageManager.getSettings();
          sendResponse({ success: true, data: settings });
          break;

        case 'saveSettings':
          await this.storageManager.saveSettings(message.data);
          this.aiService.updateConfig(message.data);
          sendResponse({ success: true });
          break;

        case 'exportBackup':
          const backup = await this.bookmarkManager.exportBackup();
          sendResponse({ success: true, data: backup });
          break;

        case 'restoreBackup':
          await this.bookmarkManager.restoreFromBackup(message.data);
          sendResponse({ success: true });
          break;

        case 'getFolders':
          const folders = await this.bookmarkManager.getAllFolders();
          sendResponse({ success: true, data: folders });
          break;

        default:
          sendResponse({ success: false, error: 'Unknown action' });
      }
    } catch (error) {
      console.error('Background error:', error);
      sendResponse({ success: false, error: error.message });
    }
  }

  async organizeBookmarks(categories) {
    const settings = await this.storageManager.getSettings();
    const ignoreFolders = settings.ignoreFolders || [];
    
    const total = Object.values(categories).flat().length;
    let processed = 0;

    this.sendProgress('正在清理旧文件夹结构...', 5);
    
    await this.bookmarkManager.moveBookmarksToRootExcluding(ignoreFolders);
    
    this.sendProgress('正在删除旧文件夹...', 10);
    await this.bookmarkManager.clearFoldersExcluding(ignoreFolders);

    for (const [categoryPath, bookmarks] of Object.entries(categories)) {
      if (bookmarks.length === 0) continue;

      const folder = await this.bookmarkManager.findOrCreateNestedFolder(categoryPath);
      
      for (const bookmark of bookmarks) {
        await this.bookmarkManager.moveBookmark(bookmark.id, folder.id);
        processed++;
        const progress = 10 + Math.round((processed / total) * 90);
        this.sendProgress(`正在移动书签... (${processed}/${total})`, progress);
      }
    }

    this.sendProgress('整理完成!', 100);
  }

  async runAnalysis() {
    if (this.analysisState.status === 'running') {
      return this.analysisState.result;
    }

    const settings = await this.storageManager.getSettings();
    const ignoreFolders = settings.ignoreFolders || [];

    this.analysisState = {
      status: 'running',
      progress: 10,
      progressText: '正在获取所有书签...',
      result: null,
      error: null
    };
    this.sendProgress('正在获取所有书签...', 10);

    try {
      const allBookmarks = await this.bookmarkManager.getBookmarksExcludingFolders(ignoreFolders);
      
      if (allBookmarks.length === 0) {
        throw new Error('没有找到书签');
      }

      this.analysisState.progress = 30;
      this.analysisState.progressText = `正在分析 ${allBookmarks.length} 个书签...`;
      this.sendProgress(`正在分析 ${allBookmarks.length} 个书签...`, 30);

      const categories = await this.aiService.categorizeBookmarks(allBookmarks);

      this.analysisState = {
        status: 'completed',
        progress: 100,
        progressText: '分析完成!',
        result: categories,
        error: null
      };
      this.sendProgress('分析完成!', 100);

      return categories;
    } catch (error) {
      this.analysisState = {
        status: 'error',
        progress: 0,
        progressText: '',
        result: null,
        error: error.message
      };
      throw error;
    }
  }

  sendProgress(text, progress) {
    this.analysisState.progress = progress;
    this.analysisState.progressText = text;
    chrome.runtime.sendMessage({
      type: 'progress',
      text,
      progress
    }).catch(() => {});
  }
}

new BackgroundService();
