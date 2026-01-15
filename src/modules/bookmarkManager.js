export class BookmarkManager {
  async getTree() {
    return new Promise((resolve) => {
      chrome.bookmarks.getTree((tree) => resolve(tree));
    });
  }

  async getAllBookmarks() {
    const tree = await this.getTree();
    const bookmarks = [];
    this.traverseTree(tree, bookmarks);
    return bookmarks;
  }

  traverseTree(nodes, bookmarks, depth = 0) {
    for (const node of nodes) {
      if (node.url) {
        bookmarks.push({
          id: node.id,
          title: node.title || '',
          url: node.url,
          parentId: node.parentId,
          dateAdded: node.dateAdded
        });
      }
      if (node.children) {
        this.traverseTree(node.children, bookmarks, depth + 1);
      }
    }
  }

  async getStats() {
    const tree = await this.getTree();
    let totalBookmarks = 0;
    let totalFolders = 0;
    let uncategorized = 0;

    const countNodes = (nodes, isRoot = true) => {
      for (const node of nodes) {
        if (node.url) {
          totalBookmarks++;
          if (isRoot || node.parentId === '1' || node.parentId === '2') {
            uncategorized++;
          }
        } else if (node.children) {
          if (!isRoot && node.id !== '0' && node.id !== '1' && node.id !== '2') {
            totalFolders++;
          }
          countNodes(node.children, false);
        }
      }
    };

    countNodes(tree);
    return { totalBookmarks, totalFolders, uncategorized };
  }

  async getUncategorizedBookmarks() {
    const tree = await this.getTree();
    const bookmarks = [];

    const findUncategorized = (nodes) => {
      for (const node of nodes) {
        if (node.url && (node.parentId === '1' || node.parentId === '2')) {
          bookmarks.push({
            id: node.id,
            title: node.title || '',
            url: node.url,
            parentId: node.parentId
          });
        }
        if (node.children) {
          findUncategorized(node.children);
        }
      }
    };

    findUncategorized(tree);
    return bookmarks;
  }

  async findOrCreateFolder(name, parentId = '1') {
    return new Promise((resolve) => {
      chrome.bookmarks.getChildren(parentId, (children) => {
        const existing = children?.find(c => !c.url && c.title === name);
        if (existing) {
          resolve(existing);
        } else {
          chrome.bookmarks.create({ parentId, title: name }, (folder) => {
            resolve(folder);
          });
        }
      });
    });
  }

  async findOrCreateNestedFolder(path, rootParentId = '1') {
    const parts = path.split('/').map(p => p.trim()).filter(p => p.length > 0);
    let currentParentId = rootParentId;
    let currentFolder = null;

    for (const folderName of parts) {
      currentFolder = await this.findOrCreateFolder(folderName, currentParentId);
      currentParentId = currentFolder.id;
    }

    return currentFolder;
  }

  async moveBookmark(bookmarkId, folderId) {
    return new Promise((resolve, reject) => {
      chrome.bookmarks.move(bookmarkId, { parentId: folderId }, (result) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve(result);
        }
      });
    });
  }

  async createBookmark(title, url, parentId) {
    return new Promise((resolve) => {
      chrome.bookmarks.create({ parentId, title, url }, (bookmark) => {
        resolve(bookmark);
      });
    });
  }

  async removeBookmark(bookmarkId) {
    return new Promise((resolve, reject) => {
      chrome.bookmarks.remove(bookmarkId, () => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve();
        }
      });
    });
  }

  async exportBackup() {
    const tree = await this.getTree();
    const backup = {
      version: '1.0',
      exportDate: new Date().toISOString(),
      bookmarks: this.serializeTree(tree)
    };
    return backup;
  }

  serializeTree(nodes) {
    return nodes.map(node => {
      const item = {
        title: node.title || '',
        dateAdded: node.dateAdded
      };
      
      if (node.url) {
        item.url = node.url;
      }
      
      if (node.children) {
        item.children = this.serializeTree(node.children);
      }
      
      return item;
    });
  }

  async restoreFromBackup(backup) {
    if (!backup?.bookmarks || !Array.isArray(backup.bookmarks)) {
      throw new Error('无效的备份文件格式');
    }

    const rootNodes = backup.bookmarks;
    
    for (const rootNode of rootNodes) {
      if (rootNode.children) {
        await this.restoreChildren(rootNode.children, '1');
      }
    }
  }

  async restoreChildren(children, parentId) {
    for (const child of children) {
      if (child.url) {
        const exists = await this.bookmarkExists(child.url);
        if (!exists) {
          await this.createBookmark(child.title, child.url, parentId);
        }
      } else if (child.children) {
        const folder = await this.findOrCreateFolder(child.title, parentId);
        await this.restoreChildren(child.children, folder.id);
      }
    }
  }

  async bookmarkExists(url) {
    return new Promise((resolve) => {
      chrome.bookmarks.search({ url }, (results) => {
        resolve(results.length > 0);
      });
    });
  }

  async clearAllFolders() {
    const tree = await this.getTree();
    const foldersToRemove = [];
    
    const collectFolders = (nodes) => {
      for (const node of nodes) {
        if (!node.url && node.id !== '0' && node.id !== '1' && node.id !== '2') {
          foldersToRemove.push(node.id);
        } else if (node.children) {
          collectFolders(node.children);
        }
      }
    };
    
    collectFolders(tree);
    
    for (const folderId of foldersToRemove) {
      await this.removeTree(folderId).catch(() => {});
    }
  }

  async removeTree(bookmarkId) {
    return new Promise((resolve, reject) => {
      chrome.bookmarks.removeTree(bookmarkId, () => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve();
        }
      });
    });
  }

  async moveAllBookmarksToRoot() {
    const allBookmarks = await this.getAllBookmarks();
    for (const bookmark of allBookmarks) {
      await this.moveBookmark(bookmark.id, '1').catch(() => {});
    }
    return allBookmarks;
  }

  async getAllFolders() {
    const tree = await this.getTree();
    const folders = [];
    
    const collectFolders = (nodes, path = '', depth = 0) => {
      for (const node of nodes) {
        if (!node.url && node.id !== '0' && node.id !== '1' && node.id !== '2') {
          const currentPath = path ? `${path}/${node.title}` : node.title;
          folders.push({
            id: node.id,
            title: node.title,
            path: currentPath,
            parentId: node.parentId,
            depth: depth,
            hasChildren: node.children?.some(c => !c.url) || false
          });
          if (node.children) {
            collectFolders(node.children, currentPath, depth + 1);
          }
        } else if (node.children) {
          collectFolders(node.children, path, depth);
        }
      }
    };
    
    collectFolders(tree);
    return folders;
  }

  async getFolderTree() {
    const tree = await this.getTree();
    
    const buildTree = (nodes) => {
      const result = [];
      for (const node of nodes) {
        if (!node.url && node.id !== '0' && node.id !== '1' && node.id !== '2') {
          result.push({
            id: node.id,
            title: node.title,
            parentId: node.parentId,
            children: node.children ? buildTree(node.children) : []
          });
        } else if (node.children) {
          result.push(...buildTree(node.children));
        }
      }
      return result;
    };
    
    return buildTree(tree);
  }

  async getBookmarksExcludingFolders(ignoreFolderIds = []) {
    const tree = await this.getTree();
    const bookmarks = [];
    const ignoreSet = new Set(ignoreFolderIds);
    
    const traverse = (nodes, isIgnored = false) => {
      for (const node of nodes) {
        if (!node.url && ignoreSet.has(node.id)) {
          continue;
        }
        
        if (node.url && !isIgnored) {
          bookmarks.push({
            id: node.id,
            title: node.title || '',
            url: node.url,
            parentId: node.parentId,
            dateAdded: node.dateAdded
          });
        }
        
        if (node.children) {
          traverse(node.children, isIgnored);
        }
      }
    };
    
    traverse(tree);
    return bookmarks;
  }

  async clearFoldersExcluding(ignoreFolderIds = []) {
    const tree = await this.getTree();
    const foldersToRemove = [];
    const ignoreSet = new Set(ignoreFolderIds);
    
    const collectFolders = (nodes) => {
      for (const node of nodes) {
        if (!node.url && node.id !== '0' && node.id !== '1' && node.id !== '2') {
          if (!ignoreSet.has(node.id)) {
            foldersToRemove.push(node.id);
          }
        } else if (node.children) {
          collectFolders(node.children);
        }
      }
    };
    
    collectFolders(tree);
    
    for (const folderId of foldersToRemove) {
      await this.removeTree(folderId).catch(() => {});
    }
  }

  async moveBookmarksToRootExcluding(ignoreFolderIds = []) {
    const tree = await this.getTree();
    const ignoreSet = new Set(ignoreFolderIds);
    const bookmarksToMove = [];
    
    const collectBookmarks = (nodes, inIgnoredFolder = false) => {
      for (const node of nodes) {
        const isIgnoredFolder = !node.url && ignoreSet.has(node.id);
        
        if (node.url && !inIgnoredFolder) {
          bookmarksToMove.push(node);
        }
        
        if (node.children) {
          collectBookmarks(node.children, inIgnoredFolder || isIgnoredFolder);
        }
      }
    };
    
    collectBookmarks(tree);
    
    for (const bookmark of bookmarksToMove) {
      await this.moveBookmark(bookmark.id, '1').catch(() => {});
    }
    
    return bookmarksToMove;
  }
}
