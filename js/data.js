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
            const mediaStores = await this.readAllMediaStores();
            const imageRecords = Array.isArray(mediaStores.images) ? mediaStores.images : [];
            const audioRecords = Array.isArray(mediaStores.audio) ? mediaStores.audio : [];

            const calculateRecordsSize = (records = []) => records.reduce((total, record) => {
                if (record?.dataUrl) {
                    return total + this.estimateDataUrlBytes(record.dataUrl);
                }
                return total + this.estimateStringBytes(JSON.stringify(record || {}));
            }, 0);

            const imageSize = calculateRecordsSize(imageRecords);
            const audioSize = calculateRecordsSize(audioRecords);
            const mediaSize = imageSize + audioSize;

            return {
                breakdown: {
                    mediaImages: imageSize,
                    mediaAudio: audioSize
                },
                total: mediaSize,
                details: [
                    {
                        key: 'indexedDB.chatMediaDB.images',
                        size: imageSize
                    },
                    {
                        key: 'indexedDB.chatMediaDB.audio',
                        size: audioSize
                    }
                ],
                recordCount: imageRecords.length + audioRecords.length
            };
        } catch (error) {
            console.warn('统计 IndexedDB 存储空间失败:', error);
            return {
                breakdown: {
                    mediaImages: 0,
                    mediaAudio: 0
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
            mediaImages: indexedDbInfo.breakdown.mediaImages || 0,
            mediaAudio: indexedDbInfo.breakdown.mediaAudio || 0
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

            const request = window.indexedDB.open('chatMediaDB', 2);

            request.onupgradeneeded = () => {
                const db = request.result;
                if (!db.objectStoreNames.contains('images')) {
                    db.createObjectStore('images', { keyPath: 'id' });
                }
                if (!db.objectStoreNames.contains('audio')) {
                    db.createObjectStore('audio', { keyPath: 'id' });
                }
            };

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error || new Error('打开媒体数据库失败'));
        });
    },

    readAllStoreRecords(storeName) {
        return new Promise(async (resolve, reject) => {
            try {
                const db = await this.openMediaDB();
                if (!db.objectStoreNames.contains(storeName)) {
                    db.close();
                    resolve([]);
                    return;
                }

                const tx = db.transaction(storeName, 'readonly');
                const store = tx.objectStore(storeName);
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

    readAllMediaRecords() {
        return this.readAllStoreRecords('images');
    },

    async readAllMediaStores() {
        const [images, audio] = await Promise.all([
            this.readAllStoreRecords('images'),
            this.readAllStoreRecords('audio')
        ]);

        return {
            images,
            audio
        };
    },

    clearAndRestoreMediaRecords(records = []) {
        return this.clearAndRestoreStoreRecords('images', records);
    },

    clearAndRestoreStoreRecords(storeName, records = []) {
        return new Promise(async (resolve, reject) => {
            try {
                const db = await this.openMediaDB();
                if (!db.objectStoreNames.contains(storeName)) {
                    db.close();
                    resolve();
                    return;
                }

                const tx = db.transaction(storeName, 'readwrite');
                const store = tx.objectStore(storeName);

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

    async clearAndRestoreMediaStores(media = {}) {
        const images = Array.isArray(media.images) ? media.images : [];
        const audio = Array.isArray(media.audio) ? media.audio : [];

        await this.clearAndRestoreStoreRecords('images', images);
        await this.clearAndRestoreStoreRecords('audio', audio);
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

    readAllLocalStorageData() {
        const localData = {};

        for (let index = 0; index < localStorage.length; index += 1) {
            const key = localStorage.key(index);
            if (!key) continue;
            localData[key] = this.readStorageValue(key);
        }

        return localData;
    },

    buildDataExportPayload(localData, mediaStores) {
        return {
            type: 'bht-data-export',
            version: 2,
            exportedAt: new Date().toISOString(),
            app: 'bht-phone',
            data: {
                localStorage: localData,
                indexedDB: {
                    chatMediaDB: {
                        images: Array.isArray(mediaStores?.images) ? mediaStores.images : [],
                        audio: Array.isArray(mediaStores?.audio) ? mediaStores.audio : []
                    }
                }
            },
            includes: [
                'apiSettings',
                'imageGenerationSettings',
                'minimaxSettings',
                'wechatRoles',
                'roleChatHistory',
                'userMasks',
                'moments',
                'wallpaper',
                'appearance',
                'mediaImages',
                'mediaAudio'
            ]
        };
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

    getDataImportContent(data) {
        if (!data || typeof data !== 'object') {
            throw new Error('导入文件内容为空或格式无效');
        }

        if (data.type === 'bht-data-export' && data.data) {
            return data.data;
        }

        if (data.type === 'chat-history-export' && data.chatData) {
            return data.chatData;
        }

        if (data.data?.localStorage || data.data?.indexedDB) {
            return data.data;
        }

        if (data.localStorage || data.indexedDB) {
            return data;
        }

        throw new Error('不是可识别的数据文件');
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

    validateDataImportContent(appData) {
        const localData = appData?.localStorage;
        const mediaRoot = appData?.indexedDB?.chatMediaDB || {};
        const mediaStores = {
            images: mediaRoot.images || [],
            audio: mediaRoot.audio || []
        };

        if (!localData || typeof localData !== 'object' || Array.isArray(localData)) {
            throw new Error('数据文件缺少 localStorage 数据');
        }

        if (!Array.isArray(mediaStores.images)) {
            throw new Error('图片媒体数据格式不正确');
        }

        if (!Array.isArray(mediaStores.audio)) {
            throw new Error('语音媒体数据格式不正确');
        }

        return {
            localData,
            mediaStores
        };
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

    clearLocalStorageAll() {
        localStorage.clear();
    },

    writeLocalStorageData(localData = {}) {
        for (let key in localData) {
            if (!Object.prototype.hasOwnProperty.call(localData, key)) continue;
            if (localData[key] === null || localData[key] === undefined) continue;

            if (typeof localData[key] === 'object') {
                localStorage.setItem(key, JSON.stringify(localData[key]));
            } else {
                localStorage.setItem(key, String(localData[key]));
            }
        }
    },

    async exportData() {
        try {
            const localData = this.readAllLocalStorageData();
            const mediaStores = await this.readAllMediaStores();
            const payload = this.buildDataExportPayload(localData, mediaStores);

            const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `bht-data-${new Date().toISOString().slice(0, 10)}.json`;
            a.click();
            URL.revokeObjectURL(url);

            const imageCount = mediaStores.images.length;
            const audioCount = mediaStores.audio.length;
            this.showToast(`数据已导出（图片 ${imageCount}，语音 ${audioCount}）`);
        } catch (error) {
            alert('导出数据失败: ' + error.message);
        }
    },

    async importData(data) {
        if (!confirm('导入数据将覆盖当前所有本地内容和设置，包括 API 配置、角色、聊天、面具、朋友圈等。是否继续？')) {
            return;
        }

        const backupLocalData = this.readAllLocalStorageData();
        let backupMediaStores = { images: [], audio: [] };
        try {
            backupMediaStores = await this.readAllMediaStores();
        } catch (e) {
            backupMediaStores = { images: [], audio: [] };
        }

        try {
            const appData = this.getDataImportContent(data);
            const { localData, mediaStores } = this.validateDataImportContent(appData);

            this.clearLocalStorageAll();
            this.writeLocalStorageData(localData);
            await this.clearAndRestoreMediaStores(mediaStores);

            this.showToast('数据导入成功，正在刷新...');
            setTimeout(() => location.reload(), 1200);
        } catch (err) {
            this.clearLocalStorageAll();
            this.writeLocalStorageData(backupLocalData);

            try {
                await this.clearAndRestoreMediaStores(backupMediaStores);
            } catch (restoreError) {
                console.error('媒体数据回滚失败:', restoreError);
            }

            alert('导入数据失败: ' + err.message);
        }
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
        return this.exportData();
    },

    // 兼容旧入口
    async importAllData(data) {
        return this.importData(data);
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
