const DEFAULT_SETTINGS = {
  apiKey: '',
  apiEndpoint: 'https://api.openai.com/v1/chat/completions',
  model: 'gpt-3.5-turbo',
  customCategories: [],
  autoOrganize: false,
  language: 'zh-CN',
  maxRootCategories: 10,
  ignoreFolders: []
};

export class StorageManager {
  async getSettings() {
    return new Promise((resolve) => {
      chrome.storage.sync.get('settings', (result) => {
        resolve({ ...DEFAULT_SETTINGS, ...result.settings });
      });
    });
  }

  async saveSettings(settings) {
    return new Promise((resolve) => {
      chrome.storage.sync.set({ settings }, () => {
        resolve();
      });
    });
  }

  async getSetting(key) {
    const settings = await this.getSettings();
    return settings[key];
  }

  async setSetting(key, value) {
    const settings = await this.getSettings();
    settings[key] = value;
    await this.saveSettings(settings);
  }
}
