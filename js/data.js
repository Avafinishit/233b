const DataManager = {
    formatBytes(bytes) {
        const safeBytes = Number(bytes) || 0;

        if (safeBytes >= 1024 * 1024) {
            return (safeBytes / 1024 / 1024).toFixed(2) + ' MB';
        }

        if (safeBytes >= 1024) {
            return (safeBytes / 1024).toFixed(2) + ' KB';
        }

        return safeBytes.toFixed(0) + ' B';
    },

    estimateStringBytes(value) {
        return String(value || '').length * 2;
    },

    estimateDataUrlBytes(dataUrl) {
        if (typeof dataUrl !== 'string' || !dataUrl) return 0;

        const parts = dataUrl.split(',');
        const base64 = parts[1] || '';
        if (!base64) {
            return this.estimateStringBytes(dataUrl);
        }

        const padding = (base64.match(/=+$/) || [''])[0].length;
        return Math.max(0, Math.floor(base64.length * 3 / 4) - padding);
    },

    // 计算 localStorage 空间（按类别）
    calculateLocalStorage() {
        const storage = {
            chatHistory: 0,
            notes: 0,
            musicData: 0,
            apiSettings: 0,
            wallpaper: 0,
            appearance: 0,
            cache: 0,
            other: 0
        };

        const details = [];
        let total = 0;

        for (let key in localStorage) {
            if (!Object.prototype.hasOwnProperty.call(localStorage, key)) continue;

            const rawValue = localStorage.getItem(key) || '';
            const size = this.estimateStringBytes(rawValue);
            total += size;

            if (key.includes('chat') || key === 'chatHistory' || key.startsWith('roleChat_') || key.startsWith('roleSharedEvents_')) {
                storage.chatHistory += size;
            } else if (key === 'notes') {
                storage.notes += size;
            } else if (key.includes('music') || key.includes('Music')) {
                storage.musicData += size;
            } else if (key === 'apiSettings') {
                storage.apiSettings += size;
            } else if (key.includes('wallpaper') || key.includes('momentsBackground')) {
                storage.wallpaper += size;
            } else if (key.includes('appearance')) {
                storage.appearance += size;
            } else if (key.includes('cache')) {
                storage.cache += size;
            } else {
                storage.other += size;
            }

            details.push({
                key,
                size
            });
        }

        return {
            breakdown: storage,
            total,
            details
        };
    },

    async calculateIndexedDBStorage() {
        try {
            const mediaRecords = await this.readAllMediaRecords();
            let mediaSize = 0;

            mediaRecords.forEach((record) => {
                if (record?.dataUrl) {
                    mediaSize += this.estimateDataUrlBytes(record.dataUrl);
                } else {
                    mediaSize += this.estimateStringBytes(JSON.stringify(record || {}));
                }
            });

            return {
                breakdown: {
                    mediaImages: mediaSize
                },
                total: mediaSize,
                details: [
                    {
                        key: 'indexedDB.chatMediaDB.images',
                        size: mediaSize
                    }
                ],
                recordCount: mediaRecords.length
            };
        } catch (error) {
            console.warn('统计 IndexedDB 存储空间失败:', error);
            return {
                breakdown: {
                    mediaImages: 0
                },
                total: 0,
                details: [],
                recordCount: 0
            };
        }
    },

    async calculateStorage() {
        const localInfo = this.calculateLocalStorage();
        const indexedDbInfo = await this.calculateIndexedDBStorage();

        const mergedBreakdown = {
            ...localInfo.breakdown,
            mediaImages: indexedDbInfo.breakdown.mediaImages || 0
        };

        return {
            breakdown: mergedBreakdown,
            totalUsed: localInfo.total + indexedDbInfo.total,
            localStorageUsed: localInfo.total,
            indexedDBUsed: indexedDbInfo.total,
            details: [...localInfo.details, ...indexedDbInfo.details],
            mediaRecordCount: indexedDbInfo.recordCount || 0
        };
    },

    toggleStorageEstimateUI(hasRealEstimate) {
        const bar = document.getElementById('storageBar');
        const barWrapper = bar ? bar.parentElement : null;
        const freeText = document.getElementById('freeSize');
        const freeRow = freeText ? freeText.closest('div') : null;

        if (barWrapper) {
            barWrapper.style.display = hasRealEstimate ? '' : 'none';
        }

        if (freeRow) {
            freeRow.style.display = hasRealEstimate ? '' : 'none';
        }
    },

    buildStorageListHTML() {
        return '';
    },

    // 更新存储显示
    async updateStorageDisplay() {
        const bar = document.getElementById('storageBar');
        const usedText = document.getElementById('usedSize');
        const freeText = document.getElementById('freeSize');
        const list = document.getElementById('storageList');
        const settingText = document.getElementById('storageText');

        const info = await this.calculateStorage();

        if (usedText) {
            usedText.textContent = this.formatBytes(info.totalUsed);
        }

        if (settingText) {
            settingText.textContent = '本地已用 ' + this.formatBytes(info.totalUsed);
        }

        if (bar) {
            bar.style.width = '0%';
        }
        this.toggleStorageEstimateUI(false);

        if (list) {
            list.innerHTML = this.buildStorageListHTML(info);
        }
    },
    
    openMediaDB() {
        return new Promise((resolve, reject) => {
            if (!window.indexedDB) {
                reject(new Error('当前浏览器不支持 IndexedDB'));
                return;
            }

            const request = window.indexedDB.open('chatMediaDB', 1);

            request.onupgradeneeded = () => {
                const db = request.result;
                if (!db.objectStoreNames.contains('images')) {
                    db.createObjectStore('images', { keyPath: 'id' });
                }
            };

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error || new Error('打开媒体数据库失败'));
        });
    },

    readAllMediaRecords() {
        return new Promise(async (resolve, reject) => {
            try {
                const db = await this.openMediaDB();
                const tx = db.transaction('images', 'readonly');
                const store = tx.objectStore('images');
                const request = store.getAll();

                request.onsuccess = () => {
                    db.close();
                    resolve(Array.isArray(request.result) ? request.result : []);
                };
                request.onerror = () => {
                    db.close();
                    reject(request.error || new Error('读取媒体数据失败'));
                };
            } catch (error) {
                reject(error);
            }
        });
    },

    clearAndRestoreMediaRecords(records = []) {
        return new Promise(async (resolve, reject) => {
            try {
                const db = await this.openMediaDB();
                const tx = db.transaction('images', 'readwrite');
                const store = tx.objectStore('images');

                store.clear();

                for (const record of records) {
                    if (record && record.id) {
                        store.put(record);
                    }
                }

                tx.oncomplete = () => {
                    db.close();
                    resolve();
                };
                tx.onerror = () => {
                    db.close();
                    reject(tx.error || new Error('写入媒体数据失败'));
                };
            } catch (error) {
                reject(error);
            }
        });
    },

    getChatRelatedStorageKeys() {
        const staticKeys = [
            'wechatRoles',
            'wechatUser',
            'userMasks',
            'currentMaskId',
            'chatHistory'
        ];

        const dynamicKeys = [];

        for (let index = 0; index < localStorage.length; index += 1) {
            const key = localStorage.key(index);
            if (!key) continue;

            if (
                key.startsWith('roleChat_')
                || key.startsWith('roleSharedEvents_')
            ) {
                dynamicKeys.push(key);
            }
        }

        return Array.from(new Set([...staticKeys, ...dynamicKeys]));
    },

    readStorageValue(key) {
        const rawValue = localStorage.getItem(key);
        if (rawValue === null) return null;

        try {
            return JSON.parse(rawValue);
        } catch (error) {
            return rawValue;
        }
    },

    buildChatExportPayload(localData, mediaRecords) {
        return {
            type: 'chat-history-export',
            version: 1,
            exportedAt: new Date().toISOString(),
            app: 'bht-phone',
            chatData: {
                localStorage: localData,
                indexedDB: {
                    chatMediaDB: {
                        images: Array.isArray(mediaRecords) ? mediaRecords : []
                    }
                }
            }
        };
    },

    getChatImportContent(data) {
        if (!data || typeof data !== 'object') {
            throw new Error('导入文件内容为空或格式无效');
        }

        if (data.type === 'chat-history-export' && data.chatData) {
            return data.chatData;
        }

        if (data.localStorage || data.indexedDB) {
            return data;
        }

        throw new Error('不是可识别的聊天记录文件');
    },

    validateChatImportContent(chatData) {
        const localData = chatData?.localStorage;
        const mediaRecords = chatData?.indexedDB?.chatMediaDB?.images || [];

        if (!localData || typeof localData !== 'object' || Array.isArray(localData)) {
            throw new Error('聊天记录缺少 localStorage 数据');
        }

        if (!localData.wechatRoles || !Array.isArray(localData.wechatRoles)) {
            throw new Error('聊天记录缺少角色列表');
        }

        if (!Array.isArray(mediaRecords)) {
            throw new Error('聊天图片数据格式不正确');
        }

        return {
            localData,
            mediaRecords
        };
    },

    clearChatStorageOnly() {
        const keys = this.getChatRelatedStorageKeys();
        keys.forEach((key) => localStorage.removeItem(key));
    },

    // 导出聊天记录（仅聊天相关 localStorage + IndexedDB 媒体）
    async exportChatData() {
        try {
            const localData = {};
            const chatKeys = this.getChatRelatedStorageKeys();

            chatKeys.forEach((key) => {
                localData[key] = this.readStorageValue(key);
            });

            const mediaRecords = await this.readAllMediaRecords();
            const payload = this.buildChatExportPayload(localData, mediaRecords);

            const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `chat-history-${new Date().toISOString().slice(0, 10)}.json`;
            a.click();
            URL.revokeObjectURL(url);

            this.showToast(`聊天记录已导出（含 ${mediaRecords.length} 张聊天图片）`);
        } catch (error) {
            alert('导出聊天记录失败: ' + error.message);
        }
    },

    // 导入聊天记录（仅覆盖聊天相关数据，不影响其他设置）
    async importChatData(data) {
        if (!confirm('导入聊天记录将覆盖现有聊天内容，是否继续？')) {
            return;
        }

        const backup = {};
        const currentChatKeys = this.getChatRelatedStorageKeys();
        currentChatKeys.forEach((key) => {
            const rawValue = localStorage.getItem(key);
            if (rawValue !== null) {
                backup[key] = rawValue;
            }
        });

        let backupMediaRecords = [];
        try {
            backupMediaRecords = await this.readAllMediaRecords();
        } catch (e) {
            backupMediaRecords = [];
        }

        try {
            const chatData = this.getChatImportContent(data);
            const { localData, mediaRecords } = this.validateChatImportContent(chatData);

            this.clearChatStorageOnly();

            for (let key in localData) {
                if (!Object.prototype.hasOwnProperty.call(localData, key)) continue;
                if (localData[key] === null || localData[key] === undefined) continue;

                if (typeof localData[key] === 'object') {
                    localStorage.setItem(key, JSON.stringify(localData[key]));
                } else {
                    localStorage.setItem(key, String(localData[key]));
                }
            }

            await this.clearAndRestoreMediaRecords(mediaRecords);

            this.showToast('聊天记录导入成功，正在刷新...');
            setTimeout(() => location.reload(), 1200);
        } catch (err) {
            this.clearChatStorageOnly();

            for (let key in backup) {
                if (!Object.prototype.hasOwnProperty.call(backup, key)) continue;
                localStorage.setItem(key, backup[key]);
            }

            try {
                await this.clearAndRestoreMediaRecords(backupMediaRecords);
            } catch (restoreError) {
                console.error('媒体数据回滚失败:', restoreError);
            }

            alert('导入聊天记录失败: ' + err.message);
        }
    },

    // 兼容旧入口
    async exportAllData() {
        return this.exportChatData();
    },

    // 兼容旧入口
    async importAllData(data) {
        return this.importChatData(data);
    },
    
    // Toast提示
    showToast(message) {
        const toast = document.createElement('div');
        toast.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: rgba(0,0,0,0.8);
            color: #fff;
            padding: 12px 24px;
            border-radius: 20px;
            font-size: 15px;
            z-index: 9999;
            animation: fadeIn 0.3s;
        `;
        toast.textContent = message;
        document.body.appendChild(toast);
        setTimeout(() => {
            toast.style.opacity = '0';
            setTimeout(() => toast.remove(), 300);
        }, 2000);
    }
};

// 将 DataManager 显式挂载到 window，避免 app.js 中 window.DataManager 判断失效
try {
    window.DataManager = DataManager;
} catch (e) {
    console.warn('window.DataManager 挂载失败:', e);
}
