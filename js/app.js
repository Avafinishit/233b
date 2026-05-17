// ================= 全局配置 =================
const CONFIG = {
    DEFAULT_API_URL: 'https://api.deepseek.com/v1',
    DEFAULT_MODEL: 'deepseek-chat',
    CHAT_COMPLETIONS_PATH: '/chat/completions',
    MODELS_PATH: '/models',
    MAX_HISTORY: 50,
    DEFAULT_MINIMAX_API_URL: 'https://api.minimax.chat/v1',
    DEFAULT_MINIMAX_SPEECH_MODEL: 'speech-2.8-hd',
    DEFAULT_IMAGE_API_URL: 'https://api.openai.com/v1',
    DEFAULT_IMAGE_MODEL: 'gpt-image-2',
    IMAGE_GENERATIONS_PATH: '/images/generations',
    DEFAULT_IMAGE_SIZE: '1024x1024'
};

const APP_VIEWPORT_SYNC_DELAYS = [0, 80, 260, 700, 1400];
const CHAT_SCROLL_BOTTOM_DELAYS = [0, 60, 180, 420, 900];
const ROLE_CREATIVE_MEMORY_LIMIT = 80;
let appViewportSyncTimerIds = [];
let chatScrollBottomTimerIds = [];
let chatInputViewportHandlersInstalled = false;
let activeRoleCreativeMemoryEditId = null;
let clockIntervalId = null;

function isStandaloneDisplayMode() {
    return window.navigator.standalone === true
        || window.matchMedia('(display-mode: standalone)').matches
        || window.matchMedia('(display-mode: fullscreen)').matches;
}

function getInitialDisplayMode() {
    return 'fullscreen';
}

function getDefaultAppearanceSettings() {
    return {
        displayMode: 'fullscreen',
        screenSize: 'medium',
        customWidth: 375,
        customHeight: 812,
        showStatusBar: true,
        userSelectedDisplayMode: false
    };
}

function persistAppearanceSettings(userSelectedDisplayMode = false) {
    if (userSelectedDisplayMode) {
        appearanceSettings.userSelectedDisplayMode = true;
    }
    localStorage.setItem('appearanceSettings', JSON.stringify(appearanceSettings));
}

function syncAppViewportHeight() {
    const root = document.documentElement;
    const visualHeight = window.visualViewport?.height;
    const visualOffsetTop = window.visualViewport?.offsetTop;
    const layoutHeight = Math.max(window.innerHeight || 0, root.clientHeight || 0);
    const isStandalone = isStandaloneDisplayMode();
    const hasKeyboardInset = Number.isFinite(visualHeight)
        && visualHeight > 0
        && layoutHeight > 0
        && layoutHeight - visualHeight > 120;
    const viewportHeight = hasKeyboardInset || (!isStandalone && Number.isFinite(visualHeight) && visualHeight > 0)
        ? visualHeight
        : Math.max(visualHeight || 0, layoutHeight);
    const browserBottomInset = !isStandalone
        && Number.isFinite(visualHeight)
        && visualHeight > 0
        && layoutHeight > visualHeight
        ? Math.round(Math.min(220, Math.max(0, layoutHeight - visualHeight)))
        : 0;
    const viewportWidth = window.visualViewport?.width || window.innerWidth || root.clientWidth || 0;
    const viewportOffsetTop = Number.isFinite(visualOffsetTop) && visualOffsetTop > 0
        ? visualOffsetTop
        : 0;
    const isTouchViewport = window.matchMedia('(pointer: coarse)').matches;
    let storedAppearanceSettings = {};
    try {
        storedAppearanceSettings = JSON.parse(localStorage.getItem('appearanceSettings') || '{}') || {};
    } catch (error) {
        storedAppearanceSettings = {};
    }
    const storedDisplayMode = storedAppearanceSettings.displayMode || '';
    const showStatusBar = storedAppearanceSettings.showStatusBar !== false;
    const isAppFullscreenMode = storedDisplayMode === 'fullscreen'
        || document.getElementById('homeScreen')?.classList.contains('fullscreen-mode');
    const needsStandaloneSafeFallback = isStandalone
        || isAppFullscreenMode;
    const needsFullscreenSafeFallback = needsStandaloneSafeFallback
        && !showStatusBar
        && isTouchViewport
        && viewportWidth > 0
        && viewportWidth <= 760
        && viewportHeight >= 600;
    const safeTopFallback = needsFullscreenSafeFallback
        ? Math.round(Math.min(59, Math.max(44, viewportHeight * 0.056)))
        : 0;
    const safeBottomFallback = 0;

    if (viewportHeight > 0) {
        root.style.setProperty('--app-viewport-height', `${Math.round(viewportHeight)}px`);
    }

    if (viewportWidth > 0) {
        root.style.setProperty('--app-viewport-width', `${Math.round(viewportWidth)}px`);
    }

    root.style.setProperty('--app-viewport-offset-top', `${Math.round(viewportOffsetTop)}px`);
    root.style.setProperty('--app-browser-bottom-inset', `${browserBottomInset}px`);
    root.style.setProperty('--fullscreen-safe-top-fallback', `${safeTopFallback}px`);
    root.style.setProperty('--fullscreen-safe-bottom-fallback', `${safeBottomFallback}px`);
    root.classList.toggle('standalone-display', isStandalone);
}

function scheduleAppViewportSync() {
    appViewportSyncTimerIds.forEach(timerId => clearTimeout(timerId));
    appViewportSyncTimerIds = APP_VIEWPORT_SYNC_DELAYS.map(delay => (
        setTimeout(syncAppViewportHeight, delay)
    ));
}

function scrollChatToBottomNow() {
    const chatBox = document.getElementById('chatBox');
    if (chatBox) {
        chatBox.scrollTop = chatBox.scrollHeight;
    }

    const offlineFeed = document.getElementById('offlineStoryFeed');
    if (offlineFeed) {
        offlineFeed.scrollTop = offlineFeed.scrollHeight;
    }
}

function scheduleChatScrollToBottom() {
    chatScrollBottomTimerIds.forEach(timerId => clearTimeout(timerId));
    requestAnimationFrame(scrollChatToBottomNow);
    chatScrollBottomTimerIds = CHAT_SCROLL_BOTTOM_DELAYS.map(delay => (
        setTimeout(scrollChatToBottomNow, delay)
    ));
}

function installChatInputViewportHandlers() {
    if (chatInputViewportHandlersInstalled) return;

    const input = document.getElementById('msgInput');
    if (!input) return;

    chatInputViewportHandlersInstalled = true;

    const keepChatPinnedToViewport = () => {
        scheduleAppViewportSync();
        scheduleChatScrollToBottom();
    };

    input.addEventListener('focus', () => {
        keepChatPinnedToViewport();
        setTimeout(() => {
            window.scrollTo(0, 0);
            keepChatPinnedToViewport();
        }, 80);
        setTimeout(keepChatPinnedToViewport, 320);
    });

    input.addEventListener('blur', keepChatPinnedToViewport);
}

syncAppViewportHeight();
scheduleAppViewportSync();

window.addEventListener('resize', scheduleAppViewportSync, { passive: true });
window.addEventListener('orientationchange', scheduleAppViewportSync, { passive: true });
function syncViewportAndClock() {
    scheduleAppViewportSync();
    updateClock();
}

window.addEventListener('pageshow', syncViewportAndClock, { passive: true });
window.addEventListener('focus', syncViewportAndClock, { passive: true });

if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', scheduleAppViewportSync, { passive: true });
    window.visualViewport.addEventListener('scroll', scheduleAppViewportSync, { passive: true });
}

document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
        syncViewportAndClock();
    }
});

let currentApp = null;
let chatHistory = [];
let apiSettings = {};
const API_PRESETS_STORAGE_KEY = 'apiPresetConfigs';
let wechatRoles = [];
let currentRoleId = null;
const DEFAULT_LETTER_AVATAR_COLOR = '#6B7C93';
const DEFAULT_FRIEND_AVATAR_COLOR = '#5BAE9D';
const AVATAR_FALLBACK_PALETTE = ['#6B7C93', '#5BAE9D', '#7A9CC6', '#8B7BAE'];
let selectedAvatarColor = 'white';
let editingRoleId = null;
let friendAvatarColor = DEFAULT_FRIEND_AVATAR_COLOR;
let isChatMediaPanelOpen = false;
let currentChatMediaSection = 'home';
let isOfflineMode = false;
let currentWechatTab = 'chats';
const wechatTabRenderState = {
    contacts: false,
    moments: false,
    me: false
};
let wechatTabRenderFrameId = 0;
const OFFLINE_MODE_STORAGE_KEY = 'chatOfflineModeEnabled';
const CHAT_STICKER_STORAGE_KEY = 'chatStickerLibrary';
const WALLET_STORAGE_KEY = 'walletData';
const WALLET_WORK_STORAGE_KEY = 'walletWorkState';
const SHOP_STORAGE_KEY = 'shopData';
const FORUMS_STORAGE_KEY = 'forums';
const FORUMS_DB_NAME = 'bhtForumData';
const FORUMS_DB_VERSION = 1;
const FORUMS_STORE_NAME = 'forumState';
const FORUMS_RECORD_ID = 'forums';
const FORUM_IMAGE_MAX_PER_BATCH = 4;
const ADMIN_TOPUP_STORAGE_KEY = 'adminTopup99999Applied_20260513';
const ADMIN_TOPUP_AMOUNT = 99999;
const USER_MASKS_STORAGE_KEY = 'userMasks';
const CURRENT_MASK_ID_STORAGE_KEY = 'currentMaskId';
const DEFAULT_WALLET_BALANCE = 1000;
const WALLET_WORK_JOBS = [
    { id: 'delivery', name: '外卖配送', icon: '送', durationMs: 10 * 60 * 1000, durationLabel: '10分钟', reward: 8 },
    { id: 'cafe', name: '咖啡店兼职', icon: '咖', durationMs: 2 * 60 * 60 * 1000, durationLabel: '2小时', reward: 70 },
    { id: 'tutor', name: '家教辅导', icon: '教', durationMs: 4 * 60 * 60 * 1000, durationLabel: '4小时', reward: 120 },
    { id: 'debug', name: '程序调试', icon: '码', durationMs: 8 * 60 * 60 * 1000, durationLabel: '8小时', reward: 250 }
];
const SHOP_ITEMS = [
    {
        id: 'coffee',
        name: '咖啡',
        image: 'https://em-content.zobj.net/source/apple/391/hot-beverage_2615.png',
        price: 88,
        description: '让角色心情值+10，整天都更开心'
    },
    {
        id: 'mystery',
        name: '神秘道具',
        image: 'https://em-content.zobj.net/source/apple/391/wrapped-gift_1f381.png',
        price: 888,
        description: '???神秘道具，购买后揭晓'
    }
];
const MYSTERY_SHOP_REWARDS = [
    {
        id: 'lingerie',
        name: '情趣内衣',
        image: 'https://em-content.zobj.net/source/apple/391/bikini_1f459.png',
        description: '送给角色一件情趣内衣，角色进入挑逗状态'
    },
    {
        id: 'magic-wand',
        name: '魔法棒',
        image: 'https://em-content.zobj.net/source/apple/391/magic-wand_1fa84.png',
        description: '施展魔法，角色今天会主动开启情欲话题'
    },
    {
        id: 'love-letter',
        name: '情书',
        image: '',
        description: '一封来自角色的手写情书'
    },
    {
        id: 'vibrator',
        name: '震动棒',
        image: 'https://em-content.zobj.net/source/apple/391/joystick_1f579-fe0f.png',
        description: '赠送角色震动棒，触发角色自慰被发现剧情'
    }
];
const PROACTIVE_MESSAGE_STATE_KEY = 'proactiveMessageState';
const PROACTIVE_LAST_ACTIVE_AT_KEY = 'lastActiveAt';
const PROACTIVE_CHECK_MIN_MS = 5 * 60 * 1000;
const PROACTIVE_CHECK_MAX_MS = 10 * 60 * 1000;
const PROACTIVE_OFFLINE_MIN_MS = 30 * 60 * 1000;
const PROACTIVE_AFTER_USER_CHAT_COOLDOWN_MS = 10 * 60 * 1000;
const PROACTIVE_FREQUENCY_CONFIG = {
    low: { dailyMin: 1, dailyMax: 1, minGapMs: 60 * 60 * 1000, chance: 0.35 },
    medium: { dailyMin: 1, dailyMax: 2, minGapMs: 45 * 60 * 1000, chance: 0.55 },
    high: { dailyMin: 2, dailyMax: 3, minGapMs: 30 * 60 * 1000, chance: 0.75 }
};
let proactiveMessageTimerId = null;
let proactiveMessageInFlight = false;
const CHAT_MEDIA_DB_NAME = 'chatMediaDB';
const CHAT_MEDIA_DB_VERSION = 2;
const CHAT_MEDIA_STORE_NAME = 'images';
const CHAT_AUDIO_STORE_NAME = 'audio';
const CHAT_IMAGE_SESSION_CACHE_KEY = 'chatImageSessionCache';
const CHAT_IMAGE_SESSION_CACHE_LIMIT = 20;
const MEDIA_REF_PREFIX = 'media:';
const DOKI_STORAGE_KEY = 'dokiPetState';
const DOKI_DEFAULT_COLOR = '#E6A36F';
const DOKI_ASSET_MANIFEST_PATHS = [
    'assets/doki/generated/manifest.json',
    'assets/doki/manifest.json'
];
const DOKI_ACTION_ANIMATION_MAP = {
    feed: 'eat',
    pet: 'pet',
    play: 'play',
    rest: 'sleep'
};
const DOKI_ANIMATION_FALLBACKS = {
    eat: 'idle',
    pet: 'idle',
    play: 'idle',
    sleep: 'idle',
    blink: 'idle'
};
const DOKI_HOME_LINES = [
    'Doki 正在巡逻',
    '摸摸',
    '今天桌面很安静',
    '系统运行良好',
    'Doki 眨了眨眼'
];
const DOKI_COLOR_DARK_MAP = {
    '#e6a36f': '#C88455',
    '#de9869': '#C88455',
    '#d69063': '#B8754C'
};
const DOKI_COLOR_LIGHT_MAP = {
    '#e6a36f': '#F2C39A',
    '#de9869': '#F0B88E',
    '#d69063': '#EAAF84'
};
const DOKI_ALLOWED_COLORS = ['#E6A36F', '#DE9869', '#D69063'];
const DEFAULT_CHAT_STICKERS = [
    {
        id: 'preset-bunny-blush',
        type: 'sticker',
        url: `data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="240" height="240" viewBox="0 0 240 240"><defs><linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#fff6fb"/><stop offset="100%" stop-color="#ffe7d6"/></linearGradient></defs><rect width="240" height="240" rx="48" fill="url(#bg)"/><ellipse cx="86" cy="62" rx="24" ry="54" fill="#fff"/><ellipse cx="154" cy="62" rx="24" ry="54" fill="#fff"/><ellipse cx="86" cy="64" rx="10" ry="36" fill="#ffd7e5"/><ellipse cx="154" cy="64" rx="10" ry="36" fill="#ffd7e5"/><circle cx="120" cy="132" r="66" fill="#fff"/><circle cx="95" cy="126" r="6" fill="#3f3f46"/><circle cx="145" cy="126" r="6" fill="#3f3f46"/><ellipse cx="88" cy="146" rx="11" ry="7" fill="#ffc3d7"/><ellipse cx="152" cy="146" rx="11" ry="7" fill="#ffc3d7"/><path d="M120 132c-7 0-12 5-12 11 0 8 7 12 12 16 5-4 12-8 12-16 0-6-5-11-12-11z" fill="#ff8fb1"/><path d="M105 164c8 6 22 6 30 0" stroke="#9f1239" stroke-width="5" stroke-linecap="round" fill="none"/></svg>`)}`,
        label: '兔兔害羞'
    },
    {
        id: 'preset-bunny-yeah',
        type: 'sticker',
        url: `data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="240" height="240" viewBox="0 0 240 240"><defs><linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#eef7ff"/><stop offset="100%" stop-color="#dff7ea"/></linearGradient></defs><rect width="240" height="240" rx="48" fill="url(#bg)"/><ellipse cx="84" cy="58" rx="24" ry="56" fill="#fff"/><ellipse cx="156" cy="58" rx="24" ry="56" fill="#fff"/><ellipse cx="84" cy="60" rx="10" ry="36" fill="#cbe7ff"/><ellipse cx="156" cy="60" rx="10" ry="36" fill="#cbe7ff"/><circle cx="120" cy="132" r="66" fill="#fff"/><path d="M88 128c8-10 16-10 24 0" stroke="#374151" stroke-width="6" stroke-linecap="round"/><path d="M128 128c8-10 16-10 24 0" stroke="#374151" stroke-width="6" stroke-linecap="round"/><circle cx="92" cy="146" r="9" fill="#b7e1ff"/><circle cx="148" cy="146" r="9" fill="#b7e1ff"/><rect x="102" y="138" width="36" height="26" rx="13" fill="#22c55e"/><path d="M112 151h16" stroke="#fff" stroke-width="5" stroke-linecap="round"/><path d="M120 143v16" stroke="#fff" stroke-width="5" stroke-linecap="round"/></svg>`)}`,
        label: '兔兔收到'
    },
    {
        id: 'preset-bunny-love',
        type: 'sticker',
        url: `data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="240" height="240" viewBox="0 0 240 240"><defs><linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#fff2f6"/><stop offset="100%" stop-color="#ffeccf"/></linearGradient></defs><rect width="240" height="240" rx="48" fill="url(#bg)"/><ellipse cx="84" cy="58" rx="24" ry="56" fill="#fff"/><ellipse cx="156" cy="58" rx="24" ry="56" fill="#fff"/><ellipse cx="84" cy="60" rx="10" ry="36" fill="#ffd6e6"/><ellipse cx="156" cy="60" rx="10" ry="36" fill="#ffd6e6"/><circle cx="120" cy="132" r="66" fill="#fff"/><path d="M93 126l8 8 8-8" stroke="#ef476f" stroke-width="6" stroke-linecap="round" stroke-linejoin="round" fill="none"/><path d="M131 126l8 8 8-8" stroke="#ef476f" stroke-width="6" stroke-linecap="round" stroke-linejoin="round" fill="none"/><path d="M108 153c0-10 7-17 12-17s12 7 12 17c0 7-7 12-12 16-5-4-12-9-12-16z" fill="#ff5d8f"/><ellipse cx="87" cy="147" rx="10" ry="7" fill="#ffc1d6"/><ellipse cx="153" cy="147" rx="10" ry="7" fill="#ffc1d6"/></svg>`)}`,
        label: '兔兔比心'
    }
];
let chatStickerLibrary = [];
let currentGameState = {
    type: null,
    active: false,
    sessionId: 0,
    boardSize: 15,
    board: [],
    currentTurn: 'user',
    userPiece: 1,
    rolePiece: 2,
    winner: null,
    moveCount: 0,
    lastUserMove: null,
    lastRoleMove: null,
    turnTimeLimit: 30,
    turnTimeLeft: 30,
    turnTimerId: null,
    isRoleThinking: false
};

let gomokuAutoChatState = {
    // 每个窗口固定 5 局，只允许自动互动发 1 次
    windowGameIndex: 0, // 当前窗口内第几局：1~5
    chosenGameOffset: 1, // 这 5 局里随机挑一局触发
    sentInWindow: 0, // 本窗口已发送次数
    inFlight: false // 防止并发重复请求
};

function showAppView(appEl) {
    if (!appEl) return;

    appEl.style.display = 'flex';
    appEl.classList.add('is-visible');
    appEl.classList.toggle('hide-status-bar', appearanceSettings.showStatusBar === false);
}

function hideAppView(appEl) {
    if (!appEl) return;

    appEl.classList.remove('is-visible');
    appEl.style.display = 'none';
}

function cacheChatImageData(imageId, dataUrl) {
    if (!imageId || !dataUrl) return;

    try {
        const raw = sessionStorage.getItem(CHAT_IMAGE_SESSION_CACHE_KEY);
        const cache = raw ? JSON.parse(raw) : {};
        cache[imageId] = {
            dataUrl,
            updatedAt: Date.now()
        };

        const sortedEntries = Object.entries(cache)
            .sort((a, b) => (b[1]?.updatedAt || 0) - (a[1]?.updatedAt || 0))
            .slice(0, CHAT_IMAGE_SESSION_CACHE_LIMIT);

        sessionStorage.setItem(
            CHAT_IMAGE_SESSION_CACHE_KEY,
            JSON.stringify(Object.fromEntries(sortedEntries))
        );
    } catch (error) {
        console.warn('写入聊天图片会话缓存失败:', error);
    }
}

function getCachedChatImageData(imageId) {
    if (!imageId) return null;

    try {
        const raw = sessionStorage.getItem(CHAT_IMAGE_SESSION_CACHE_KEY);
        if (!raw) return null;

        const cache = JSON.parse(raw);
        return cache?.[imageId]?.dataUrl || null;
    } catch (error) {
        console.warn('读取聊天图片会话缓存失败:', error);
        return null;
    }
}

function openChatMediaDatabase() {
    return new Promise((resolve, reject) => {
        if (!window.indexedDB) {
            reject(new Error('当前浏览器不支持 IndexedDB'));
            return;
        }

        const request = window.indexedDB.open(CHAT_MEDIA_DB_NAME, CHAT_MEDIA_DB_VERSION);

        request.onupgradeneeded = () => {
            const db = request.result;
            if (!db.objectStoreNames.contains(CHAT_MEDIA_STORE_NAME)) {
                db.createObjectStore(CHAT_MEDIA_STORE_NAME, { keyPath: 'id' });
            }
            if (!db.objectStoreNames.contains(CHAT_AUDIO_STORE_NAME)) {
                db.createObjectStore(CHAT_AUDIO_STORE_NAME, { keyPath: 'id' });
            }
        };

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error || new Error('打开图片数据库失败'));
    });
}

function isStorageQuotaError(error) {
    const name = error?.name || '';
    const message = error?.message || '';

    if (name === 'QuotaExceededError') return true;
    return /quota|配额|存储空间|空间不足|storage|disk/i.test(message);
}

function createMediaStorageError(error, fallbackMessage = '保存图片失败') {
    if (!error) {
        return new Error(fallbackMessage);
    }

    if (isStorageQuotaError(error)) {
        return new Error('本地存储空间不足，无法保存图片');
    }

    const name = error?.name || '';
    if (name === 'DataCloneError') {
        return new Error('图片数据格式异常，无法保存');
    }

    if (name === 'InvalidStateError' || name === 'TransactionInactiveError') {
        return new Error('图片存储状态异常，请稍后重试');
    }

    return new Error(error?.message || fallbackMessage);
}

function getReadableAppErrorMessage(error, fallbackMessage = '发生未知错误') {
    if (!error) return fallbackMessage;

    const message = String(error?.message || error || '').trim();
    if (!message) return fallbackMessage;

    if (isStorageQuotaError(error) || /quota has been exceeded/i.test(message)) {
        return '本地存储空间不足，请清理图片、表情包或壁纸后重试';
    }

    if (/failed to fetch|networkerror|network error|load failed|网络错误|网络异常/i.test(message)) {
        return '网络连接失败，请稍后重试';
    }

    return message;
}

function saveChatImageToDB(file, dataUrl) {
    return new Promise(async (resolve, reject) => {
        try {
            const db = await openChatMediaDatabase();
            const transaction = db.transaction(CHAT_MEDIA_STORE_NAME, 'readwrite');
            const store = transaction.objectStore(CHAT_MEDIA_STORE_NAME);
            const id = `chat_image_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

            let settled = false;
            const settle = (callback, payload) => {
                if (settled) return;
                settled = true;
                try {
                    db.close();
                } catch (closeError) {
                    console.warn('关闭媒体数据库连接失败:', closeError);
                }
                callback(payload);
            };

            const request = store.put({
                id,
                name: file?.name || '聊天图片',
                type: file?.type || 'image/png',
                dataUrl,
                createdAt: Date.now()
            });

            request.onerror = () => {
                settle(
                    reject,
                    createMediaStorageError(
                        request.error || transaction.error,
                        '图片写入失败'
                    )
                );
        
    };

            transaction.oncomplete = () => {
                cacheChatImageData(id, dataUrl);
                settle(resolve, id);
        
    };
            transaction.onerror = () => {
                settle(
                    reject,
                    createMediaStorageError(
                        transaction.error || request.error,
                        '图片事务失败'
                    )
                );
        
    };
            transaction.onabort = () => {
                settle(
                    reject,
                    createMediaStorageError(
                        transaction.error || request.error,
                        '图片保存被中断'
                    )
                );
        
    };
        } catch (error) {
            reject(createMediaStorageError(error));
        }
    });
}

function getChatImageFromDB(imageId) {
    return new Promise(async (resolve, reject) => {
        try {
            const db = await openChatMediaDatabase();
            const transaction = db.transaction(CHAT_MEDIA_STORE_NAME, 'readonly');
            const store = transaction.objectStore(CHAT_MEDIA_STORE_NAME);
            const request = store.get(imageId);

            request.onsuccess = () => {
                db.close();
                resolve(request.result || null);
        
    };
            request.onerror = () => {
                db.close();
                reject(request.error || new Error('读取图片失败'));
        
    };
        } catch (error) {
            reject(error);
        }
    });
}

function isDataAudioUrl(value) {
    return typeof value === 'string' && /^data:audio\//i.test(value.trim());
}

function saveChatAudioToDB(audioDataUrl, meta = {}) {
    return new Promise(async (resolve, reject) => {
        try {
            if (!audioDataUrl || typeof audioDataUrl !== 'string') {
                reject(new Error('音频数据为空'));
                return;
            }

            const db = await openChatMediaDatabase();
            const transaction = db.transaction(CHAT_AUDIO_STORE_NAME, 'readwrite');
            const store = transaction.objectStore(CHAT_AUDIO_STORE_NAME);
            const id = `chat_audio_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

            let settled = false;
            const settle = (callback, payload) => {
                if (settled) return;
                settled = true;
                try {
                    db.close();
                } catch (closeError) {
                    console.warn('关闭音频数据库连接失败:', closeError);
                }
                callback(payload);
        
    };

            const request = store.put({
                id,
                dataUrl: audioDataUrl,
                createdAt: Date.now(),
                duration: meta.duration || null,
                voiceId: meta.voiceId || '',
                text: meta.text || ''
            });

            request.onerror = () => {
                settle(
                    reject,
                    createMediaStorageError(
                        request.error || transaction.error,
                        '音频写入失败'
                    )
                );
        
    };

            transaction.oncomplete = () => settle(resolve, id);
            transaction.onerror = () => {
                settle(
                    reject,
                    createMediaStorageError(
                        transaction.error || request.error,
                        '音频事务失败'
                    )
                );
        
    };
            transaction.onabort = () => {
                settle(
                    reject,
                    createMediaStorageError(
                        transaction.error || request.error,
                        '音频保存被中断'
                    )
                );
        
    };
        } catch (error) {
            reject(createMediaStorageError(error, '保存音频失败'));
        }
    });
}

function getChatAudioFromDB(audioId) {
    return new Promise(async (resolve, reject) => {
        try {
            const db = await openChatMediaDatabase();
            const transaction = db.transaction(CHAT_AUDIO_STORE_NAME, 'readonly');
            const store = transaction.objectStore(CHAT_AUDIO_STORE_NAME);
            const request = store.get(audioId);

            request.onsuccess = () => {
                db.close();
                resolve(request.result || null);
        
    };
            request.onerror = () => {
                db.close();
                reject(request.error || new Error('读取音频失败'));
        
    };
        } catch (error) {
            reject(error);
        }
    });
}

function isDataImageUrl(value) {
    return typeof value === 'string' && /^data:image\//i.test(value.trim());
}

function getDataImageMimeType(dataUrl = '') {
    if (!isDataImageUrl(dataUrl)) return '';
    const match = dataUrl.match(/^data:([^;]+);/i);
    return (match && match[1] ? match[1] : '').toLowerCase();
}

function isVisionSupportedDataUrl(dataUrl = '') {
    const mime = getDataImageMimeType(dataUrl);
    if (!mime) return false;

    const supportedMimeTypes = new Set([
        'image/png',
        'image/jpg',
        'image/jpeg',
        'image/webp',
        'image/gif'
    ]);

    if (!supportedMimeTypes.has(mime)) {
        return false;
    }

    // iOS Safari 某些图片虽然标记成 jpeg，但二进制头实际是 MPO
    // 这类图片会被视觉接口判定为 unsupported image format: mpo
    if (looksLikeMpoDataUrl(dataUrl)) {
        return false;
    }

    return true;
}

function decodeDataUrlBase64Prefix(dataUrl = '', maxBytes = 4096) {
    if (!isDataImageUrl(dataUrl)) return '';

    const base64Part = String(dataUrl).split(',')[1] || '';
    if (!base64Part) return '';

    try {
        const estimatedBase64Length = Math.ceil(maxBytes * 4 / 3);
        const partial = base64Part.slice(0, estimatedBase64Length);
        return atob(partial);
    } catch (error) {
        console.warn('解析图片头信息失败:', error);
        return '';
    }
}

function looksLikeMpoDataUrl(dataUrl = '') {
    const mime = getDataImageMimeType(dataUrl);
    if (!mime || (mime !== 'image/jpeg' && mime !== 'image/jpg')) {
        return false;
    }

    const binaryPrefix = decodeDataUrlBase64Prefix(dataUrl, 8192);
    if (!binaryPrefix) return false;

    // MPO 常见标记：JPEG APP2 段中的 "MPF\0"
    if (binaryPrefix.includes('MPF\0')) return true;

    // 额外兜底：某些实现会携带 MPO 字样
    if (/MPO/i.test(binaryPrefix)) return true;

    return false;
}

function buildMediaRef(imageId) {
    return imageId ? `${MEDIA_REF_PREFIX}${imageId}` : '';
}

function extractMediaIdFromRef(value) {
    if (typeof value !== 'string') return null;
    if (!value.startsWith(MEDIA_REF_PREFIX)) return null;
    return value.slice(MEDIA_REF_PREFIX.length) || null;
}

function isMediaRef(value) {
    return !!extractMediaIdFromRef(value);
}

function extractDataUrlFromCssValue(value) {
    if (typeof value !== 'string') return null;

    const direct = value.trim();
    if (isDataImageUrl(direct)) {
        return direct;
    }

    const match = direct.match(/url\((['"]?)(data:image\/[^'")]+)\1\)/i);
    return match ? match[2] : null;
}

async function resolveMediaRefToDataUrl(mediaRefOrId) {
    const imageId = typeof mediaRefOrId === 'string' && mediaRefOrId.startsWith(MEDIA_REF_PREFIX)
        ? extractMediaIdFromRef(mediaRefOrId)
        : mediaRefOrId;

    if (!imageId) return null;

    const cached = getCachedChatImageData(imageId);
    if (cached) return cached;

    try {
        const record = await getChatImageFromDB(imageId);
        if (!record?.dataUrl) return null;
        cacheChatImageData(imageId, record.dataUrl);
        return record.dataUrl;
    } catch (error) {
        console.error('读取媒体引用失败:', error);
        return null;
    }
}

async function migrateDataUrlToMediaRef(value, fallbackName = '图片') {
    const dataUrl = extractDataUrlFromCssValue(value);
    if (!dataUrl) return value;

    try {
        const imageId = await saveChatImageToDB(
            { name: fallbackName, type: 'image/png' },
            dataUrl
        );
        return buildMediaRef(imageId);
    } catch (error) {
        console.error('迁移图片到 IndexedDB 失败:', error);
        return value;
    }
}

async function hydrateMediaRefToRuntimeValue(value) {
    if (!isMediaRef(value)) {
        return value;
    }

    const dataUrl = await resolveMediaRefToDataUrl(value);
    return dataUrl ? `url('${dataUrl}')` : value;
}

function stripChatContentForStorage(content) {
    if (!content || typeof content !== 'object') {
        return content;
    }

    if (content.type === 'transfer') {
        return {
            type: 'transfer',
            amount: content.amount || '0.00',
            note: content.note || '',
            status: normalizeTransferStatus(content.status),
            from: content.from || 'user',
            to: content.to || 'role',
            recordId: content.recordId || '',
            createdAt: content.createdAt || null,
            receivedAt: content.receivedAt || null,
            refundedAt: content.refundedAt || null
        };
    }

    if (content.type === 'red-packet') {
        return {
            type: 'red-packet',
            amount: content.amount || '0.00',
            note: content.note || '',
            status: normalizeTransferStatus(content.status),
            from: content.from || 'role',
            to: content.to || 'user',
            createdAt: content.createdAt || null,
            receivedAt: content.receivedAt || null
        };
    }

    if (content.type === 'gift') {
        return {
            type: 'gift',
            purchaseId: content.purchaseId || '',
            itemId: content.itemId || '',
            rewardId: content.rewardId || '',
            name: content.name || '道具',
            description: content.description || '',
            image: content.image || '',
            giftedAt: content.giftedAt || null
        };
    }

    if (content.type === 'forum-share') {
        return {
            type: 'forum-share',
            forumId: content.forumId || '',
            postId: content.postId || '',
            forumName: content.forumName || '论坛',
            title: content.title || '论坛帖子',
            authorName: content.authorName || '匿名网友',
            excerpt: content.excerpt || '',
            sharedAt: content.sharedAt || null
        };
    }

    if (content.type === 'love-letter-reply') {
        return {
            type: 'love-letter-reply',
            title: content.title || '给你的回信',
            text: content.text || '',
            createdAt: content.createdAt || null
        };
    }

    if (content.type === 'image') {
        return {
            type: 'image',
            imageId: content.imageId || null,
            name: content.name || '聊天图片'
        };
    }

    if (content.type === 'voice') {
        return {
            type: 'voice',
            audioId: content.audioId || null,
            url: content.audioId ? '' : (isDataAudioUrl(content.url) ? '' : (content.url || '')),
            text: content.text || '',
            transcriptVisible: !!content.transcriptVisible,
            voiceId: content.voiceId || '',
            duration: content.duration || null,
            model: content.model || ''
        };
    }

    return content;
}

async function hydrateChatContent(content) {
    if (!content || typeof content !== 'object') {
        return content;
    }

    if (content.type === 'image') {
        if (content.url) {
            cacheChatImageData(content.imageId, content.url);
            return content;
        }

        if (!content.imageId) {
            return {
                ...content,
                missing: true
        
    };
        }

        const cachedDataUrl = getCachedChatImageData(content.imageId);
        if (cachedDataUrl) {
            return {
                ...content,
                url: cachedDataUrl
        
    };
        }

        try {
            const imageRecord = await getChatImageFromDB(content.imageId);
            if (!imageRecord?.dataUrl) {
                return {
                    ...content,
                    missing: true
            
    };
            }

            cacheChatImageData(content.imageId, imageRecord.dataUrl);

            return {
                ...content,
                url: imageRecord.dataUrl
        
    };
        } catch (error) {
            console.error('还原聊天图片失败:', error);
            return {
                ...content,
                missing: true
        
    };
        }
    }

    if (content.type === 'voice') {
        if (content.audioId) {
            try {
                const audioRecord = await getChatAudioFromDB(content.audioId);
                if (!audioRecord?.dataUrl) {
                    return {
                        ...content,
                        missing: true
                
    };
                }

                return {
                    ...content,
                    url: audioRecord.dataUrl
            
    };
            } catch (error) {
                console.error('还原聊天语音失败:', error);
                return {
                    ...content,
                    missing: true
            
    };
            }
        }

        if (content.url && isDataAudioUrl(content.url)) {
            try {
                const audioId = await saveChatAudioToDB(content.url, {
                    duration: content.duration || null,
                    voiceId: content.voiceId || '',
                    text: content.text || ''
                });

                return {
                    ...content,
                    audioId
            
    };
            } catch (error) {
                console.error('迁移旧语音消息到 IndexedDB 失败:', error);
                return content;
            }
        }

        return content;
    }

    return content;
}

async function hydrateChatHistoryMedia(history = []) {
    const hydratedHistory = await Promise.all(
        history.map(async (msg) => ({
            ...msg,
            content: await hydrateChatContent(msg.content)
        }))
    );

    chatHistory = hydratedHistory;
    return hydratedHistory;
}

function normalizeBaseApiUrl(url) {
    const rawUrl = (url || '').trim();
    const fallbackUrl = CONFIG.DEFAULT_API_URL;

    if (!rawUrl) return fallbackUrl;

    const normalizedUrl = rawUrl.replace(/\/+$/, '');
    if (normalizedUrl.endsWith(CONFIG.CHAT_COMPLETIONS_PATH)) {
        return normalizedUrl.slice(0, -CONFIG.CHAT_COMPLETIONS_PATH.length);
    }

    return normalizedUrl;
}

function buildApiUrl(path) {
    return `${normalizeBaseApiUrl(apiSettings.apiUrl || CONFIG.DEFAULT_API_URL)}${path}`;
}

function normalizeImageApiUrl(url) {
    const rawUrl = (url || '').trim();
    const fallbackUrl = CONFIG.DEFAULT_IMAGE_API_URL;

    if (!rawUrl) return fallbackUrl;

    const normalizedUrl = rawUrl.replace(/\/+$/, '');
    if (normalizedUrl.endsWith(CONFIG.IMAGE_GENERATIONS_PATH)) {
        return normalizedUrl.slice(0, -CONFIG.IMAGE_GENERATIONS_PATH.length);
    }

    return normalizedUrl;
}

function buildImageApiUrl(path) {
    return `${normalizeImageApiUrl(apiSettings.imageApiUrl || CONFIG.DEFAULT_IMAGE_API_URL)}${path}`;
}

function normalizeMinimaxApiUrl(url) {
    const rawUrl = (url || '').trim();
    if (!rawUrl) return CONFIG.DEFAULT_MINIMAX_API_URL;

    let normalizedUrl = rawUrl.replace(/\/+$/, '');

    normalizedUrl = normalizedUrl
        .replace(/\/t2a_v2$/i, '')
        .replace(/\/text_to_audio\/v1$/i, '')
        .replace(/\/v1\/text_to_audio\/v1$/i, '/v1')
        .replace(/\/v1\/t2a_v2$/i, '/v1');

    return normalizedUrl || CONFIG.DEFAULT_MINIMAX_API_URL;
}

function getMinimaxSpeechModel() {
    return CONFIG.DEFAULT_MINIMAX_SPEECH_MODEL;
}

function getLocalNodeProxyBaseUrl() {
    const hostname = String(window.location.hostname || '').toLowerCase();
    const isLocalHost = hostname === 'localhost' || hostname === '127.0.0.1';
    return isLocalHost ? `http://${hostname}:3000` : '';
}

function resolveTtsProxyCandidates() {
    const localProxyBaseUrl = getLocalNodeProxyBaseUrl();
    const candidates = [];

    if (localProxyBaseUrl) {
        candidates.push(`${localProxyBaseUrl}/api/tts`);
        candidates.push(`${localProxyBaseUrl}/tts`);
        candidates.push(`${localProxyBaseUrl}/.netlify/functions/tts`);
    }

    candidates.push('/api/tts');
    candidates.push('/.netlify/functions/tts');
    candidates.push('/tts');

    return Array.from(new Set(candidates.filter(Boolean)));
}

function resolveImageGenerationProxyCandidates() {
    const localProxyBaseUrl = getLocalNodeProxyBaseUrl();
    const candidates = [];

    if (localProxyBaseUrl) {
        candidates.push(`${localProxyBaseUrl}/api/images-generate`);
        candidates.push(`${localProxyBaseUrl}/.netlify/functions/images-generate`);
    }

    candidates.push('/api/images-generate');
    candidates.push('/.netlify/functions/images-generate');

    return Array.from(new Set(candidates.filter(Boolean)));
}

function resolveImageGenerationProxyUrl() {
    return resolveImageGenerationProxyCandidates()[0] || '/api/images-generate';
}

function resolveDokiFrameGenerationUrl() {
    const localProxyBaseUrl = getLocalNodeProxyBaseUrl();
    return localProxyBaseUrl
        ? `${localProxyBaseUrl}/api/doki/generate-frame`
        : '/api/doki/generate-frame';
}

function resolveVisionAnalyzeProxyUrl() {
    const localProxyBaseUrl = getLocalNodeProxyBaseUrl();
    return localProxyBaseUrl
        ? `${localProxyBaseUrl}/api/vision-analyze`
        : '/api/vision-analyze';
}

function buildMinimaxTtsUrl() {
    const baseUrl = normalizeMinimaxApiUrl(apiSettings.minimaxApiUrl || CONFIG.DEFAULT_MINIMAX_API_URL);
    const groupId = (apiSettings.minimaxGroupId || '').trim();

    if (!groupId) {
        throw new Error('缺少 Minimax Group ID');
    }

    return `${baseUrl}/t2a_v2?GroupId=${encodeURIComponent(groupId)}`;
}

function normalizeVoiceProbabilityValue(rawValue) {
    const value = Number(rawValue);
    if (!Number.isFinite(value)) return null;

    // 兼容两种输入：
    // 1) 0~1（概率）
    // 2) 0~100（百分比）
    if (value >= 0 && value <= 1) return value;
    if (value > 1 && value <= 100) return value / 100;

    return null;
}

function getRoleVoiceReplyProbability(role) {
    const roleProbability = normalizeVoiceProbabilityValue(role?.voiceReplyProbability);
    if (roleProbability !== null) {
        return roleProbability;
    }

    const globalProbability = normalizeVoiceProbabilityValue(apiSettings.roleVoiceReplyProbability);
    if (globalProbability !== null) {
        return globalProbability;
    }

    return 0.2;
}

function canRoleUseVoiceReply(role) {
    return !!(
        role
        && role.type === 'ai'
        && apiSettings.enableRoleVoiceReply
        && role.voiceEnabled
        && role.voiceId
        && apiSettings.minimaxApiKey
        && apiSettings.minimaxGroupId
    );
}

function shouldRoleSendVoiceReply(role) {
    if (!canRoleUseVoiceReply(role)) return false;
    return Math.random() < getRoleVoiceReplyProbability(role);
}

async function requestMinimaxSpeech(text, role) {
    if (!text || !role) {
        throw new Error('语音内容或角色信息缺失');
    }

    if (!canRoleUseVoiceReply(role)) {
        throw new Error('当前角色未启用可用的 Minimax 语音配置');
    }

    const ttsTimeoutMs = 15000;
    const requestPayload = {
        baseUrl: normalizeMinimaxApiUrl(apiSettings.minimaxApiUrl || CONFIG.DEFAULT_MINIMAX_API_URL),
        groupId: apiSettings.minimaxGroupId.trim(),
        apiKey: apiSettings.minimaxApiKey.trim(),
        model: getMinimaxSpeechModel(),
        text: String(text).trim(),
        voice_setting: {
            voice_id: String(role.voiceId).trim(),
            speed: 1,
            vol: 1,
            pitch: 0
        },
        audio_setting: {
            sample_rate: 32000,
            bitrate: 128000,
            format: 'mp3'
        }
    };

    const extractTtsAudioPayload = (payload) => {
        const rawAudioUrl = payload?.data?.audio
            || payload?.data?.audio_url
            || payload?.audio
            || payload?.audio_url
            || payload?.data?.audio_file
            || payload?.audio_file
            || payload?.data?.audioUrl
            || payload?.audioUrl
            || payload?.data?.audio_file_url
            || payload?.audio_file_url
            || payload?.data?.audio?.url
            || payload?.audio?.url
            || payload?.data?.audio?.link
            || payload?.audio?.link
            || payload?.data?.audio?.src
            || payload?.audio?.src;

        const rawAudioBase64 = payload?.data?.audio_base64
            || payload?.audio_base64
            || payload?.data?.audioBase64
            || payload?.audioBase64
            || payload?.data?.base64
            || payload?.base64
            || payload?.data?.audio_data
            || payload?.audio_data
            || payload?.data?.audio?.base64
            || payload?.audio?.base64
            || payload?.data?.audio?.data
            || payload?.audio?.data;

        const hasAudioPayload = !!(
            (typeof rawAudioUrl === 'string' && rawAudioUrl.trim())
            || (typeof rawAudioBase64 === 'string' && rawAudioBase64.trim())
        );

        return {
            rawAudioUrl,
            rawAudioBase64,
            hasAudioPayload
        };
    };

    const ttsProxyCandidates = resolveTtsProxyCandidates();
    let response = null;
    let data = null;
    let lastNetworkError = null;
    let lastHttpFailure = null;

    for (const ttsProxyUrl of ttsProxyCandidates) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), ttsTimeoutMs);

        try {
            const candidateResponse = await fetch(ttsProxyUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(requestPayload),
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            let candidateData = null;
            try {
                candidateData = await candidateResponse.json();
            } catch (error) {
                candidateData = null;
            }

            const { hasAudioPayload } = extractTtsAudioPayload(candidateData);

            if (candidateResponse.ok || hasAudioPayload) {
                response = candidateResponse;
                data = candidateData;
                break;
            }

            lastHttpFailure = {
                url: ttsProxyUrl,
                response: candidateResponse,
                data: candidateData
        
    };

            console.warn(`TTS 代理返回非成功状态，准备尝试下一个地址: ${ttsProxyUrl}`, {
                status: candidateResponse.status,
                data: candidateData
            });
        } catch (error) {
            clearTimeout(timeoutId);

            if (error?.name === 'AbortError') {
                lastNetworkError = new Error(`TTS 代理超时：${ttsProxyUrl}`);
                continue;
            }

            lastNetworkError = error;
            console.warn(`TTS 代理请求失败，准备尝试下一个地址: ${ttsProxyUrl}`, error);
        }
    }

    if (!response) {
        if (lastHttpFailure?.response) {
            response = lastHttpFailure.response;
            data = lastHttpFailure.data;
        }
    }

    if (!response) {
        if (lastNetworkError?.message && /超时/.test(lastNetworkError.message)) {
            throw new Error(`Minimax 语音请求超时（>${ttsTimeoutMs / 1000}s）`);
        }

        const rawMessage = String(lastNetworkError?.message || '').toLowerCase();
        if (rawMessage.includes('failed to fetch') || rawMessage.includes('load failed') || rawMessage.includes('network')) {
            throw new Error('Minimax 语音网络请求失败（本地代理/Netlify 函数均不可用）');
        }

        throw new Error(`Minimax 语音请求异常: ${lastNetworkError?.message || '网络请求失败'}`);
    }

    if (data === null) {
        try {
            data = await response.json();
        } catch (error) {
            data = null;
        }
    }

    const { rawAudioUrl, rawAudioBase64, hasAudioPayload } = extractTtsAudioPayload(data);

    if (!response.ok && !hasAudioPayload) {
        const detail = [
            extractErrorMessage(data, '').trim(),
            String(data?.message || '').trim(),
            String(data?.debug?.rawText || '').trim()
        ].filter(Boolean)[0] || '';
        const fallback = `Minimax TTS 请求失败 (${response.status}${response.statusText ? ` ${response.statusText}` : ''})`;
        throw new Error(detail ? `${fallback}: ${detail}` : fallback);
    }

    if (!hasAudioPayload) {
        const baseRespStatusCode = Number(data?.base_resp?.status_code);
        const explicitFailure = data?.ok === false
            || String(data?.message || '').trim()
            || (Number.isFinite(baseRespStatusCode) && baseRespStatusCode !== 0);

        if (explicitFailure) {
            throw new Error(
                extractErrorMessage(
                    data,
                    String(data?.message || '').trim() || 'Minimax TTS 返回失败'
                )
            );
        }
    }

    const audioUrl = typeof rawAudioUrl === 'string' ? rawAudioUrl.trim() : '';
    const audioBase64 = typeof rawAudioBase64 === 'string' ? rawAudioBase64.trim() : '';

    const isHexAudio = (value = '') => /^[0-9a-fA-F]+$/.test(value) && value.length > 200;
    const hexToBase64 = (hex = '') => {
        const cleaned = String(hex).replace(/\s+/g, '');
        if (!isHexAudio(cleaned) || cleaned.length % 2 !== 0) return '';

        let binary = '';
        for (let i = 0; i < cleaned.length; i += 2) {
            binary += String.fromCharCode(parseInt(cleaned.slice(i, i + 2), 16));
        }
        return btoa(binary);
    };

    const inferAudioMime = () => {
        const value = String(audioUrl || '').toLowerCase();
        if (value.startsWith('data:audio/')) {
            const mimeMatch = value.match(/^data:([^;]+);base64,/i);
            return (mimeMatch && mimeMatch[1]) || 'audio/mp3';
        }
        if (value.endsWith('.wav')) return 'audio/wav';
        if (value.endsWith('.aac')) return 'audio/aac';
        if (value.endsWith('.ogg')) return 'audio/ogg';
        if (value.endsWith('.m4a')) return 'audio/mp4';
        return 'audio/mp3';
    };

    const hexAudioBase64 = isHexAudio(audioUrl) ? hexToBase64(audioUrl) : '';
    const resolvedAudioUrl = (!isHexAudio(audioUrl) ? audioUrl : '')
        || (audioBase64 ? `data:${inferAudioMime()};base64,${audioBase64}` : '')
        || (hexAudioBase64 ? `data:audio/mp3;base64,${hexAudioBase64}` : '');

    if (!resolvedAudioUrl) {
        console.error('Minimax TTS 返回缺少可播放音频字段:', data);
        throw new Error(extractErrorMessage(data, 'Minimax 未返回可播放音频'));
    }

    const voiceContent = {
        type: 'voice',
        url: resolvedAudioUrl,
        text: String(text).trim(),
        voiceId: String(role.voiceId).trim(),
        duration: data?.data?.duration || data?.duration || null,
        model: getMinimaxSpeechModel()
    };

    if (isDataAudioUrl(resolvedAudioUrl)) {
        try {
            const audioId = await saveChatAudioToDB(resolvedAudioUrl, {
                duration: voiceContent.duration,
                voiceId: voiceContent.voiceId,
                text: voiceContent.text
            });
            voiceContent.audioId = audioId;
        } catch (storageError) {
            console.warn('语音已生成，但写入 IndexedDB 失败，将回退为仅运行时可用:', storageError);
        }
    }

    return voiceContent;
}

async function maybeSendRoleVoiceReply(role, textSource) {
    if (isOfflineMode) {
        return null;
    }

    if (!role?.voiceId || !apiSettings?.minimaxApiKey || !apiSettings?.minimaxGroupId) {
        return null;
    }

    if (!shouldRoleSendVoiceReply(role)) {
        return null;
    }

    const text = Array.isArray(textSource)
        ? textSource.filter(Boolean).join('。')
        : String(textSource || '').trim();

    if (!text) {
        return null;
    }

    const voiceContent = await requestMinimaxSpeech(text, role);
    const timestamp = Date.now();
    const previousTimestamp = chatHistory.length > 0
        ? (chatHistory[chatHistory.length - 1].timestamp || null)
        : null;

    chatHistory.push({
        role: 'assistant',
        content: voiceContent,
        timestamp
    });

    if (chatHistory.length > CONFIG.MAX_HISTORY) {
        chatHistory = chatHistory.slice(-CONFIG.MAX_HISTORY);
    }

    addSharedEvent({
        sourceMode: getCurrentChatMode(),
        speakerRole: 'assistant',
        content: voiceContent,
        timestamp
    });
    const chatBox = document.getElementById('chatBox');
    saveChatHistory();

    if (chatBox) {
        if (shouldShowTime(previousTimestamp, timestamp)) {
            chatBox.appendChild(createTimeDivider(timestamp));
        }

        const aiMsg = createAIBubble(voiceContent, true, role);
        chatBox.appendChild(aiMsg);
        chatBox.scrollTop = chatBox.scrollHeight;
    }

    if (isOfflineMode) {
        renderOfflineStoryFeed();
    }

    return voiceContent;
}

function setModelStatus(message, color = '#999') {
    const statusEl = document.getElementById('modelStatus');
    if (statusEl) {
        statusEl.textContent = message;
        statusEl.style.color = color;
    }
}

function setSpeechModelStatus(message, color = '#999') {
    const statusEl = document.getElementById('speechModelStatus');
    if (statusEl) {
        statusEl.textContent = message;
        statusEl.style.color = color;
    }
}

function toggleImageGenerationSettings(enabled) {
    const section = document.getElementById('imageGenerationSettingsSection');
    if (section) {
        section.style.display = enabled ? 'block' : 'none';
    }
}

function toggleMinimaxSettings(enabled) {
    const section = document.getElementById('minimaxSettingsSection');
    if (section) {
        section.style.display = enabled ? 'block' : 'none';
    }
}

function ensureSelectOptionExists(selectId, optionValue) {
    const select = document.getElementById(selectId);
    if (!select || !optionValue) return;

    const exists = Array.from(select.options).some(option => option.value === optionValue);
    if (!exists) {
        const option = document.createElement('option');
        option.value = optionValue;
        option.textContent = optionValue;
        select.appendChild(option);
    }
}

function ensureModelOptionExists(modelName) {
    ensureSelectOptionExists('modelName', modelName);
}

function ensureSpeechModelOptionExists(modelName) {
    ensureSelectOptionExists('minimaxSpeechModel', modelName);
}

async function refreshModelList() {
    const apiKeyInput = document.getElementById('apiKey');
    const apiUrlInput = document.getElementById('apiUrl');
    const modelSelect = document.getElementById('modelName');

    if (!apiKeyInput || !apiUrlInput || !modelSelect) return;

    const apiKey = apiKeyInput.value.trim();
    const baseUrl = normalizeBaseApiUrl(apiUrlInput.value);

    if (!apiKey) {
        setModelStatus('请先填写 API Key 后再拉取模型列表', '#ff9500');
        return;
    }

    if (!baseUrl) {
        setModelStatus('请先填写 API URL', '#ff9500');
        return;
    }

    setModelStatus('正在拉取模型列表...', '#007aff');

    try {
        const response = await fetch(`${baseUrl}${CONFIG.MODELS_PATH}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${apiKey}`
            }
        });

        if (!response.ok) {
            throw new Error(`HTTP错误 ${response.status}`);
        }

        const data = await response.json();
        const models = Array.isArray(data?.data)
            ? data.data
                .map(item => item && typeof item.id === 'string' ? item.id.trim() : '')
                .filter(Boolean)
            : [];

        if (models.length === 0) {
            throw new Error('接口未返回可用模型');
        }

        const currentValue = modelSelect.value || apiSettings.modelName || CONFIG.DEFAULT_MODEL;
        modelSelect.innerHTML = models
            .map(model => `<option value="${model}">${model}</option>`)
            .join('');

        const nextValue = models.includes(currentValue) ? currentValue : models[0];
        modelSelect.value = nextValue;

        setModelStatus(`已拉取 ${models.length} 个模型`, '#34c759');
    } catch (error) {
        ensureModelOptionExists(modelSelect.value || apiSettings.modelName || CONFIG.DEFAULT_MODEL);
        setModelStatus(`模型拉取失败：${error.message}`, '#ff3b30');
        console.error('拉取模型列表失败:', error);
    }
}

async function refreshSpeechModelList() {
    const modelSelect = document.getElementById('minimaxSpeechModel');
    if (!modelSelect) return;

    modelSelect.innerHTML = `<option value="${CONFIG.DEFAULT_MINIMAX_SPEECH_MODEL}">${CONFIG.DEFAULT_MINIMAX_SPEECH_MODEL}</option>`;
    modelSelect.value = CONFIG.DEFAULT_MINIMAX_SPEECH_MODEL;
    setSpeechModelStatus(`Speech 模型已固定：${CONFIG.DEFAULT_MINIMAX_SPEECH_MODEL}`, '#34c759');
}

function getCurrentChatMode() {
    return isOfflineMode ? 'offline' : 'online';
}

function getChatStorageKey(roleId, mode = getCurrentChatMode()) {
    return `roleChat_${roleId}_${mode}`;
}

function getLegacyChatStorageKey(roleId) {
    return `roleChat_${roleId}`;
}

function getSharedEventsStorageKey(roleId) {
    return `roleSharedEvents_${roleId}`;
}

function getRoleCreativeMemoriesStorageKey(roleId) {
    return `roleCreativeMemories_${roleId}`;
}

function migrateLegacyChatHistoryIfNeeded(roleId) {
    if (!roleId) return;

    const onlineKey = getChatStorageKey(roleId, 'online');
    const offlineKey = getChatStorageKey(roleId, 'offline');
    const legacyKey = getLegacyChatStorageKey(roleId);

    const hasOnline = localStorage.getItem(onlineKey);
    const hasOffline = localStorage.getItem(offlineKey);
    const legacy = localStorage.getItem(legacyKey);

    if (!hasOnline && !hasOffline && legacy) {
        localStorage.setItem(onlineKey, legacy);
    }
}

// 从localStorage加载聊天历史
function loadChatHistory() {
    if (!currentRoleId) {
        chatHistory = [];
        return;
    }

    migrateLegacyChatHistoryIfNeeded(currentRoleId);

    const key = getChatStorageKey(currentRoleId);
    const saved = localStorage.getItem(key);
    if (saved) {
        try {
            chatHistory = JSON.parse(saved);
        } catch (e) {
            chatHistory = [];
        }
    } else {
        chatHistory = [];
    }
}

// 保存当前角色的聊天历史
function isAssistantMessageRead(message) {
    if (!message || message.role !== 'assistant') return true;
    if (message.read === true || message.isRead === true || message.unread === false) return true;
    if (message.read === false || message.isRead === false || message.unread === true) return false;
    return false;
}

function markAssistantMessageAsRead(message) {
    if (!message || message.role !== 'assistant') return message;
    return {
        ...message,
        read: true,
        isRead: true,
        unread: false
    };
}

function markAssistantMessagesAsRead(history = []) {
    if (!Array.isArray(history) || history.length === 0) {
        return {
            changed: false,
            history: Array.isArray(history) ? history : []
        };
    }

    let changed = false;
    const nextHistory = history.map((message) => {
        if (message?.role !== 'assistant') return message;
        if (isAssistantMessageRead(message)) return message;
        changed = true;
        return markAssistantMessageAsRead(message);
    });

    return {
        changed,
        history: nextHistory
    };
}

function markWechatConversationAsRead(roleId, mode = 'online') {
    if (!roleId) return false;

    migrateLegacyChatHistoryIfNeeded(roleId);

    const key = getChatStorageKey(roleId, mode);
    const savedHistory = safeReadStorageJSON(key, []);
    const roleHistory = Array.isArray(savedHistory) ? savedHistory : [];
    const { changed, history } = markAssistantMessagesAsRead(roleHistory);

    if (changed) {
        safeWriteStorageJSON(key, history.map((message) => ({
            ...message,
            content: stripChatContentForStorage(message.content)
        })));
    }

    if (String(currentRoleId || '') === String(roleId) && getCurrentChatMode() === mode) {
        chatHistory = history;
    }

    return changed;
}

function createUnreadAssistantMessagePatch(isRead) {
    return {
        read: !!isRead,
        isRead: !!isRead,
        unread: !isRead
    };
}

function isChatOpenForRole(roleId) {
    return currentApp === 'chat'
        && String(currentRoleId || '') === String(roleId || '')
        && getCurrentChatMode() === 'online';
}

function saveChatHistory() {
    if (!currentRoleId) return true;
    
    const key = getChatStorageKey(currentRoleId);

    try {
        if (currentApp === 'chat') {
            const normalizedResult = markAssistantMessagesAsRead(chatHistory);
            if (normalizedResult.changed) {
                chatHistory = normalizedResult.history;
            }
        }

        const historyToStore = chatHistory.map(msg => ({
            ...msg,
            content: stripChatContentForStorage(msg.content)
        }));
        localStorage.setItem(key, JSON.stringify(historyToStore));
        return true;
    } catch (error) {
        console.error('保存聊天记录失败:', error);
        showAIError('聊天记录保存失败，可能是图片/语音过大或本地存储空间不足');
        return false;
    }
}

function loadSharedEvents(roleId = currentRoleId) {
    if (!roleId) return [];

    const saved = safeReadStorageJSON(getSharedEventsStorageKey(roleId), []);
    return Array.isArray(saved) ? saved : [];
}

function saveSharedEvents(events, roleId = currentRoleId) {
    if (!roleId) return false;
    return safeWriteStorageJSON(getSharedEventsStorageKey(roleId), events);
}

function normalizeRoleCreativeMemory(memory, index = 0) {
    const now = Date.now();
    const rawContent = typeof memory === 'string' ? memory : memory?.content;
    const content = String(rawContent || '').replace(/\s+/g, ' ').trim();
    if (!content) return null;

    return {
        id: String(memory?.id || `memory_${now}_${index}_${Math.random().toString(36).slice(2, 8)}`),
        content,
        createdAt: Number(memory?.createdAt || now),
        updatedAt: Number(memory?.updatedAt || memory?.createdAt || now)
    };
}

function loadRoleCreativeMemories(roleId = currentRoleId) {
    if (!roleId) return [];

    const raw = safeReadStorageJSON(getRoleCreativeMemoriesStorageKey(roleId), []);
    if (!Array.isArray(raw)) return [];

    return raw
        .map((memory, index) => normalizeRoleCreativeMemory(memory, index))
        .filter(Boolean)
        .sort((a, b) => Number(a.createdAt || 0) - Number(b.createdAt || 0))
        .slice(-ROLE_CREATIVE_MEMORY_LIMIT);
}

function saveRoleCreativeMemories(memories, roleId = currentRoleId) {
    if (!roleId) return false;

    const normalized = (Array.isArray(memories) ? memories : [])
        .map((memory, index) => normalizeRoleCreativeMemory(memory, index))
        .filter(Boolean)
        .slice(-ROLE_CREATIVE_MEMORY_LIMIT);

    return safeWriteStorageJSON(getRoleCreativeMemoriesStorageKey(roleId), normalized);
}

function buildRoleCreativeMemoryContext(roleId = currentRoleId, maxItems = 12) {
    const memories = loadRoleCreativeMemories(roleId).slice(-Math.max(1, maxItems));
    if (memories.length === 0) return '';

    const lines = memories.map((memory, index) => (
        `${index + 1}. ${truncateSharedSummary(memory.content, 120)}`
    ));

    return `【角色创造记忆】\n${lines.join('\n')}\n这些是用户为当前角色手动创建或修订的长期记忆。请把它们当作角色真实记得的事实、关系进展、世界观或共同经历来保持连续性；不要主动提到“记忆系统”。`;
}

function addRoleCreativeMemory(content, roleId = currentRoleId) {
    const text = String(content || '').replace(/\s+/g, ' ').trim();
    if (!roleId || !text) return false;

    const memories = loadRoleCreativeMemories(roleId);
    const now = Date.now();
    memories.push({
        id: `memory_${now}_${Math.random().toString(36).slice(2, 8)}`,
        content: text,
        createdAt: now,
        updatedAt: now
    });

    return saveRoleCreativeMemories(memories, roleId);
}

function updateRoleCreativeMemory(memoryId, content, roleId = currentRoleId) {
    const text = String(content || '').replace(/\s+/g, ' ').trim();
    if (!roleId || !memoryId || !text) return false;

    const memories = loadRoleCreativeMemories(roleId);
    const nextMemories = memories.map(memory => (
        String(memory.id) === String(memoryId)
            ? { ...memory, content: text, updatedAt: Date.now() }
            : memory
    ));

    return saveRoleCreativeMemories(nextMemories, roleId);
}

function deleteRoleCreativeMemory(memoryId, roleId = currentRoleId) {
    if (!roleId || !memoryId) return false;

    const memories = loadRoleCreativeMemories(roleId);
    return saveRoleCreativeMemories(
        memories.filter(memory => String(memory.id) !== String(memoryId)),
        roleId
    );
}

function normalizeProactiveFrequency(value) {
    return Object.prototype.hasOwnProperty.call(PROACTIVE_FREQUENCY_CONFIG, value) ? value : 'low';
}

function getProactiveFrequencyConfig(frequency) {
    return PROACTIVE_FREQUENCY_CONFIG[normalizeProactiveFrequency(frequency)] || PROACTIVE_FREQUENCY_CONFIG.low;
}

function randomInt(min, max) {
    const safeMin = Math.ceil(Number(min) || 0);
    const safeMax = Math.floor(Number(max) || safeMin);
    return Math.floor(Math.random() * (safeMax - safeMin + 1)) + safeMin;
}

function getLocalDateKey(timestamp = Date.now()) {
    const date = new Date(Number(timestamp) || Date.now());
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function createDefaultProactiveState() {
    return {
        lastGlobalCheckAt: 0,
        lastActiveAt: Number(localStorage.getItem(PROACTIVE_LAST_ACTIVE_AT_KEY)) || Date.now(),
        roles: {}
    };
}

function loadProactiveMessageState() {
    const state = safeReadStorageJSON(PROACTIVE_MESSAGE_STATE_KEY, null);
    const normalized = state && typeof state === 'object' ? state : createDefaultProactiveState();
    normalized.lastGlobalCheckAt = Number(normalized.lastGlobalCheckAt) || 0;
    normalized.lastActiveAt = Number(normalized.lastActiveAt)
        || Number(localStorage.getItem(PROACTIVE_LAST_ACTIVE_AT_KEY))
        || Date.now();
    normalized.roles = normalized.roles && typeof normalized.roles === 'object' ? normalized.roles : {};
    return normalized;
}

function saveProactiveMessageState(state) {
    safeWriteStorageJSON(PROACTIVE_MESSAGE_STATE_KEY, state);
    try {
        localStorage.setItem(PROACTIVE_LAST_ACTIVE_AT_KEY, String(Number(state?.lastActiveAt) || Date.now()));
    } catch (error) {
        console.warn('Failed to save proactive lastActiveAt:', error);
    }
}

function updateLastActiveAt(timestamp = Date.now()) {
    const state = loadProactiveMessageState();
    state.lastActiveAt = timestamp;
    saveProactiveMessageState(state);
}

function getProactiveRoleState(state, role) {
    const roleId = String(role?.id || '');
    if (!roleId) return null;

    const todayKey = getLocalDateKey();
    const existing = state.roles[roleId] && typeof state.roles[roleId] === 'object'
        ? state.roles[roleId]
        : {};
    const frequency = normalizeProactiveFrequency(role?.proactiveMessageFrequency || existing.frequency);
    const config = getProactiveFrequencyConfig(frequency);
    const proactiveCountToday = existing.dayKey === todayKey ? Number(existing.proactiveCountToday) || 0 : 0;
    const dailyLimit = existing.dayKey === todayKey && Number.isFinite(Number(existing.dailyLimit))
        ? Number(existing.dailyLimit)
        : randomInt(config.dailyMin, config.dailyMax);

    const next = {
        ...existing,
        enabled: role?.proactiveMessagesEnabled !== false,
        frequency,
        dayKey: todayKey,
        dailyLimit,
        proactiveCountToday,
        lastProactiveAt: Number(existing.lastProactiveAt) || 0
    };

    state.roles[roleId] = next;
    return next;
}

function getLastUserMessageAt(history = []) {
    if (!Array.isArray(history)) return 0;

    for (let index = history.length - 1; index >= 0; index -= 1) {
        if (history[index]?.role === 'user') {
            return Number(history[index].timestamp) || 0;
        }
    }

    return 0;
}

function getLastChatMessageAt(history = []) {
    if (!Array.isArray(history) || history.length === 0) return 0;
    return Number(history[history.length - 1]?.timestamp) || 0;
}

function getLatestUserMessageAtAcrossRoles() {
    if (!Array.isArray(wechatRoles) || wechatRoles.length === 0) return 0;

    return wechatRoles.reduce((latest, role) => {
        if (!role?.id) return latest;
        const history = safeReadStorageJSON(getChatStorageKey(role.id, 'online'), []);
        const lastUserAt = getLastUserMessageAt(Array.isArray(history) ? history : []);
        return Math.max(latest, lastUserAt);
    }, 0);
}

function hasProactiveApiConfig() {
    return !!String(apiSettings?.apiKey || '').trim();
}

function getCurrentUserMaskPromptContextForProactive() {
    if (typeof buildCurrentUserMaskPromptContext === 'function') {
        return buildCurrentUserMaskPromptContext();
    }

    const name = String(wechatUser?.nickname || '我').trim() || '我';
    const description = String(wechatUser?.bio || '').trim() || '这是我的个人简介';
    return `当前用户面具：
名称：${name}
描述：${description}`;
}

function getCurrentMaskSnapshotForProactive() {
    if (typeof getCurrentMaskSnapshot === 'function') {
        return getCurrentMaskSnapshot();
    }

    return {
        maskId: 'wechat_user',
        maskName: String(wechatUser?.nickname || '我').trim() || '我'
    };
}

function getProactiveEligibleRoles(triggerType, state, now = Date.now()) {
    if (!hasProactiveApiConfig() || !Array.isArray(wechatRoles) || wechatRoles.length === 0) return [];

    const latestUserMessageAt = getLatestUserMessageAtAcrossRoles();
    if (latestUserMessageAt && now - latestUserMessageAt < PROACTIVE_AFTER_USER_CHAT_COOLDOWN_MS) return [];

    return wechatRoles
        .filter(role => role?.type !== 'friend' && role?.proactiveMessagesEnabled !== false)
        .map(role => {
            const roleState = getProactiveRoleState(state, role);
            const history = safeReadStorageJSON(getChatStorageKey(role.id, 'online'), []);
            const roleChat = Array.isArray(history) ? history : [];
            const config = getProactiveFrequencyConfig(role.proactiveMessageFrequency);
            const lastUserAt = getLastUserMessageAt(roleChat);
            const lastChatAt = getLastChatMessageAt(roleChat);
            const lastProactiveAt = Number(roleState?.lastProactiveAt) || 0;

            return {
                role,
                roleState,
                roleChat,
                config,
                lastUserAt,
                lastChatAt,
                score: Math.max(lastChatAt, lastUserAt, lastProactiveAt)
        
    };
        })
        .filter(candidate => {
            if (!candidate.roleState?.enabled) return false;
            if (candidate.roleState.proactiveCountToday >= candidate.roleState.dailyLimit) return false;
            if (candidate.lastUserAt && now - candidate.lastUserAt < PROACTIVE_AFTER_USER_CHAT_COOLDOWN_MS) return false;
            if (candidate.roleState.lastProactiveAt && now - candidate.roleState.lastProactiveAt < candidate.config.minGapMs) return false;
            if (triggerType === 'timer' && Math.random() > candidate.config.chance) return false;
            return true;
        });
}

function pickProactiveCandidate(candidates = []) {
    if (!Array.isArray(candidates) || candidates.length === 0) return null;
    const sorted = [...candidates].sort((a, b) => (a.score || 0) - (b.score || 0));
    const pool = sorted.slice(0, Math.min(sorted.length, 4));
    return pool[Math.floor(Math.random() * pool.length)] || null;
}

function formatDurationForPrompt(ms) {
    const minutes = Math.max(0, Math.round((Number(ms) || 0) / 60000));
    if (minutes < 60) return `${minutes} 分钟`;
    const hours = Math.floor(minutes / 60);
    const rest = minutes % 60;
    return rest ? `${hours} 小时 ${rest} 分钟` : `${hours} 小时`;
}

function buildProactivePrompt({ role, roleChat = [], triggerType = 'timer', now = Date.now() }) {
    const currentDate = new Date(now).toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' });
    const currentTime = new Date(now).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false });
    const recentLines = roleChat.slice(-8)
        .map((message) => {
            const speaker = message.role === 'assistant' ? (role.nickname || '角色') : '用户';
            const text = getPlainTextFromChatContent(message.content, message.role);
            return text ? `${speaker}: ${text}` : '';
        })
        .filter(Boolean)
        .join('\n') || '暂无最近聊天记录。';
    const lastUserAt = getLastUserMessageAt(roleChat);
    const sinceLastUserChat = lastUserAt ? formatDurationForPrompt(now - lastUserAt) : '很久或没有聊天记录';
    const triggerHint = triggerType === 'offline'
        ? '用户离开 App 一段时间后重新回来，现在补发你在离线期间可能会主动发出的一条消息。'
        : '页面打开期间到了主动消息检查时机，如果合适，你可以自然发出一条消息。';
    const affectionContext = buildRoleAffectionPromptContext(role);

    return `你现在要作为角色主动给用户发送一条消息。
这不是回复用户最后一句话，而是你主动开启话题。
请严格符合角色人设、关系状态、最近聊天氛围和当前用户面具。
不要无视好感度：好感高时可以更亲密、更主动、更顺着用户；好感低时按对应距离说话。
内容控制在 1-2 句，像自然聊天消息。
只输出消息正文。

【触发背景】
${triggerHint}

【当前时间】
${currentDate} ${currentTime}

【距离用户上次聊天】
${sinceLastUserChat}

【角色人设】
昵称：${role.nickname || ''}
真实名字：${role.realName || ''}
设定：${role.systemPrompt || ''}

【当前用户面具】
${getCurrentUserMaskPromptContextForProactive()}

【好感与关系状态】
${affectionContext}

【最近聊天记录】
${recentLines}`;
}

async function generateProactiveMessage(candidate, triggerType) {
    const { data } = await requestChatCompletionWithFallback({
        systemPrompt: buildProactivePrompt({
            role: candidate.role,
            roleChat: candidate.roleChat,
            triggerType,
            now: Date.now()
        }),
        history: [],
        userContent: '请生成这一条主动消息。',
        temperature: apiSettings.temperature !== undefined ? apiSettings.temperature : 0.75,
        topP: 0.95,
        frequencyPenalty: 0.3,
        presencePenalty: 0.8,
        maxTokens: 140
    });

    const raw = data?.choices?.[0]?.message?.content || '';
    return enforceOnlineSpeechOnly(sanitizeAIResponse(raw, candidate.role.nickname))
        .replace(/\n{3,}/g, '\n\n')
        .trim();
}

function appendProactiveMessageToRole({ role, content, triggerType = 'timer', timestamp = Date.now() }) {
    if (!role?.id || !content) return false;

    const roleId = role.id;
    migrateLegacyChatHistoryIfNeeded(roleId);
    const key = getChatStorageKey(roleId, 'online');
    const history = safeReadStorageJSON(key, []);
    const roleHistory = Array.isArray(history) ? history : [];
    const maskSnapshot = getCurrentMaskSnapshotForProactive();
    const isRead = isChatOpenForRole(roleId);
    const messageData = {
        id: `msg_${timestamp}_${Math.random().toString(36).slice(2, 8)}`,
        role: 'assistant',
        content,
        timestamp,
        maskId: maskSnapshot.maskId,
        maskName: maskSnapshot.maskName,
        isProactive: true,
        proactiveTrigger: triggerType,
        ...createUnreadAssistantMessagePatch(isRead)
    };

    roleHistory.push(messageData);
    const trimmedHistory = roleHistory.slice(-CONFIG.MAX_HISTORY);
    safeWriteStorageJSON(key, trimmedHistory.map((message) => ({
        ...message,
        content: stripChatContentForStorage(message.content)
    })));

    addSharedEvent({
        sourceMode: 'online',
        speakerRole: 'assistant',
        content,
        timestamp
    });

    if (isChatOpenForRole(roleId)) {
        chatHistory = trimmedHistory;
        const chatBox = document.getElementById('chatBox');
        if (chatBox) {
            if (trimmedHistory.length === 1 || shouldShowTime(trimmedHistory[trimmedHistory.length - 2]?.timestamp, timestamp)) {
                chatBox.appendChild(createTimeDivider(timestamp));
            }
            chatBox.appendChild(createAIBubble(content, true, role, messageData.id));
            chatBox.scrollTop = chatBox.scrollHeight;
        }
        markWechatConversationAsRead(roleId, 'online');
    }

    renderWechatChatList();
    return true;
}

async function trySendProactiveMessage(triggerType = 'timer') {
    if (proactiveMessageInFlight || !hasProactiveApiConfig()) return false;

    const now = Date.now();
    const state = loadProactiveMessageState();
    const candidate = pickProactiveCandidate(getProactiveEligibleRoles(triggerType, state, now));

    if (!candidate) {
        state.lastGlobalCheckAt = now;
        saveProactiveMessageState(state);
        return false;
    }

    proactiveMessageInFlight = true;

    try {
        const content = await generateProactiveMessage(candidate, triggerType);
        if (!content) return false;

        const sentAt = Date.now();
        const inserted = appendProactiveMessageToRole({
            role: candidate.role,
            content,
            triggerType,
            timestamp: sentAt
        });

        if (inserted) {
            candidate.roleState.lastProactiveAt = sentAt;
            candidate.roleState.proactiveCountToday = (Number(candidate.roleState.proactiveCountToday) || 0) + 1;
            candidate.roleState.enabled = candidate.role.proactiveMessagesEnabled !== false;
            candidate.roleState.frequency = normalizeProactiveFrequency(candidate.role.proactiveMessageFrequency);
        }

        state.lastGlobalCheckAt = sentAt;
        saveProactiveMessageState(state);
        return inserted;
    } catch (error) {
        console.warn('Proactive message failed:', error);
        state.lastGlobalCheckAt = now;
        saveProactiveMessageState(state);
        return false;
    } finally {
        proactiveMessageInFlight = false;
    }
}

async function checkOfflineProactiveMessage() {
    if (!hasProactiveApiConfig()) {
        updateLastActiveAt();
        return false;
    }

    const now = Date.now();
    const state = loadProactiveMessageState();
    const lastActiveAt = Number(state.lastActiveAt || localStorage.getItem(PROACTIVE_LAST_ACTIVE_AT_KEY)) || now;
    const offlineDuration = now - lastActiveAt;

    if (offlineDuration < PROACTIVE_OFFLINE_MIN_MS) {
        updateLastActiveAt(now);
        return false;
    }

    const sent = await trySendProactiveMessage('offline');
    updateLastActiveAt(now);
    return sent;
}

function scheduleNextProactiveCheck() {
    if (proactiveMessageTimerId) {
        clearTimeout(proactiveMessageTimerId);
    }

    proactiveMessageTimerId = setTimeout(async () => {
        await trySendProactiveMessage('timer');
        scheduleNextProactiveCheck();
    }, randomInt(PROACTIVE_CHECK_MIN_MS, PROACTIVE_CHECK_MAX_MS));
}

function initProactiveMessages() {
    checkOfflineProactiveMessage();
    scheduleNextProactiveCheck();

    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') {
            updateLastActiveAt();
        } else {
            checkOfflineProactiveMessage();
        }
    });

    window.addEventListener('focus', () => {
        checkOfflineProactiveMessage();
    });

    window.addEventListener('pagehide', () => {
        updateLastActiveAt();
    });
}

function dedupeCrossModeEvents(events = []) {
    const unique = [];
    const seen = new Set();

    events.forEach((event) => {
        if (!event || typeof event !== 'object') return;
        const summary = String(event.summary || '').trim();
        if (!summary) return;

        const normalized = summary
            .toLowerCase()
            .replace(/\s+/g, '')
            .replace(/[，。！？；：、“”"'‘’（）()【】\[\]《》<>]/g, '');

        if (!normalized || seen.has(normalized)) return;
        seen.add(normalized);
        unique.push(event);
    });

    return unique;
}

function buildCrossModeMemoryContext({
    roleId = currentRoleId,
    currentMode = getCurrentChatMode(),
    maxEvents = 8,
    maxSummaryLength = 68,
    maskId = currentMaskId
} = {}) {
    if (!roleId) {
        return {
            memoryText: '',
            count: 0,
            sourceMode: currentMode === 'offline' ? 'online' : 'offline'
        };
    }

    const activeMaskId = String(maskId || '').trim();
    const oppositeMode = currentMode === 'offline' ? 'online' : 'offline';
    const allEvents = loadSharedEvents(roleId).filter((event) => {
        if (event?.sourceMode !== oppositeMode) return false;
        return !activeMaskId || !event.maskId || String(event.maskId) === activeMaskId;
    });
    const dedupedEvents = dedupeCrossModeEvents(allEvents);

    const picked = dedupedEvents
        .sort((a, b) => Number(a?.timestamp || 0) - Number(b?.timestamp || 0))
        .slice(-Math.max(1, maxEvents));

    if (picked.length === 0) {
        return {
            memoryText: '',
            count: 0,
            sourceMode: oppositeMode
        };
    }

    const memoryLines = picked.map((event, index) => {
        const summary = truncateSharedSummary(event.summary || '', maxSummaryLength);
        const timeLabel = event?.timestamp ? formatTime(event.timestamp) : '--:--';
        return `${index + 1}. [${timeLabel}] ${summary}`;
    });

    return {
        memoryText: `【跨模式记忆（来自${oppositeMode === 'offline' ? '线下' : '线上'}）】\n${memoryLines.join('\n')}`,
        count: picked.length,
        sourceMode: oppositeMode
    };
}

function truncateSharedSummary(text = '', maxLength = 34) {
    const normalized = String(text).replace(/\s+/g, ' ').trim();
    if (!normalized) return '';
    return normalized.length > maxLength
        ? `${normalized.slice(0, maxLength).trim()}…`
        : normalized;
}

function summarizeNarrativeTopic(text = '', maxLength = 18) {
    const normalized = String(text)
        .replace(/[\r\n]+/g, ' ')
        .replace(/["'“”‘’「」『』]/g, '')
        .replace(/\s+/g, ' ')
        .trim();

    if (!normalized) return '';

    return normalized.length > maxLength
        ? `${normalized.slice(0, maxLength).trim()}...`
        : normalized;
}
function getSharedEventTextFromContent(content, sourceMode = getCurrentChatMode(), speakerRole = 'user') {
    if (typeof content === 'string') {
        const summaryText = summarizeNarrativeTopic(content, sourceMode === 'offline' ? 16 : 22);
        if (!summaryText) return '';

        if (sourceMode === 'offline') {
            return speakerRole === 'user'
                ? `你们的话题落在“${summaryText}”上`
                : `${speakerRole === 'assistant' ? '对方' : '你们'}之间的气氛被“${summaryText}”牵动`;
        }

        return `聊到了“${summaryText}”`;
    }

    if (!content || typeof content !== 'object') {
        return '';
    }

    if (content.type === 'image') {
        return sourceMode === 'offline'
            ? (content.name ? `你们一起看了与“${content.name}”有关的画面` : '你们一起看了一张图片')
            : (content.name ? `分享了一张图片《${content.name}》` : '分享了一张图片');
    }

    if (content.type === 'sticker') {
        return sourceMode === 'offline'
            ? (content.label ? `气氛里掠过了“${content.label}”那样的轻松意味` : '气氛短暂地变得轻快起来')
            : (content.label ? `发来表情“${content.label}”` : '发来一张表情');
    }

    if (content.type === 'voice') {
        if (sourceMode === 'offline') {
            return content.text
                ? `有些话被轻声说起，落在“${summarizeNarrativeTopic(content.text, 14)}”上`
                : '有些话被轻声说起';
        }

        return content.text
            ? `留下一段语音，提到“${truncateSharedSummary(content.text, 24)}”`
            : '留下一段语音';
    }

    if (content.type === 'gift') {
        const name = content.name || '道具';
        const description = content.description ? `，效果是“${truncateSharedSummary(content.description, 24)}”` : '';
        return speakerRole === 'user'
            ? `送出了道具“${name}”${description}`
            : `回应了收到的道具“${name}”${description}`;
    }

    if (content.type === 'transfer') {
        const amount = formatTransferAmount(content.amount);
        const note = content.note ? `，备注“${truncateSharedSummary(content.note, 18)}”` : '';
        return speakerRole === 'user'
            ? `发出一笔¥${amount}的转账${note}`
            : `回应了一笔¥${amount}的转账${note}`;
    }

    if (content.type === 'red-packet') {
        const amount = formatTransferAmount(content.amount);
        const note = content.note ? `，祝福语“${truncateSharedSummary(content.note, 18)}”` : '';
        return speakerRole === 'assistant'
            ? `发出一个¥${amount}的红包${note}`
            : `收到一个¥${amount}的红包${note}`;
    }

    return '';
}
function buildSharedEventSummary({ content, roleName, sourceMode, speakerRole }) {
    const baseText = getSharedEventTextFromContent(content, sourceMode, speakerRole);
    if (!baseText) return '';

    if (sourceMode === 'offline') {
        if (speakerRole === 'user') {
            return `你和${roleName}在线下见面时，${baseText}。`;
        }

        return `${roleName}在线下与你相处时作出了回应，整段经历里，${baseText}。`;
    }

    if (speakerRole === 'user') {
        return `你在线上和${roleName}聊天时，${baseText}。`;
    }

    return `${roleName}在线上回了你，话题里${baseText}。`;
}

function addSharedEvent({ sourceMode = getCurrentChatMode(), speakerRole = 'user', content, timestamp = Date.now(), force = false }) {
    if (!currentRoleId) return;

    // 默认不再让线上/线下每条消息自动互通
    // 只有显式总结（force=true）时，才写入跨模式记忆
    if (!force) return;

    const role = wechatRoles.find(r => r.id === currentRoleId);
    const roleName = role?.nickname || '对方';
    const maskSnapshot = getCurrentMaskSnapshot();
    const summary = typeof content === 'string' && content.trim()
        ? content.trim()
        : buildSharedEventSummary({
            content,
            roleName,
            sourceMode,
            speakerRole
        });

    if (!summary) return;

    const events = loadSharedEvents();
    const lastEvent = events[events.length - 1];
    if (lastEvent && lastEvent.summary === summary && lastEvent.sourceMode === sourceMode) {
        return;
    }

    events.push({
        id: `shared_${timestamp}_${Math.random().toString(36).slice(2, 8)}`,
        sourceMode,
        speakerRole,
        summary,
        maskId: maskSnapshot.maskId,
        maskName: maskSnapshot.maskName,
        timestamp
    });

    saveSharedEvents(events.slice(-40));
}

function buildOfflineSummaryFromHistory(history = [], roleName = '对方') {
    const timeline = (Array.isArray(history) ? history : [])
        .map((msg) => {
            const text = getPlainTextFromChatContent(msg?.content, msg?.role).trim();
            if (!text) return '';
            return msg?.role === 'assistant'
                ? `${roleName}：${text}`
                : `你：${text}`;
        })
        .filter(Boolean)
        .slice(-8);

    if (timeline.length === 0) {
        return `你和${roleName}在线下见了一面，但这段经历里没有留下可总结的内容。`;
    }

    const joined = timeline.join(' ').replace(/\s+/g, ' ').trim();
    const compact = joined.length > 120 ? `${joined.slice(0, 120).trim()}…` : joined;
    return `你和${roleName}在线下相处过一段时间，当时的经过大致是：${compact}`;
}

async function generateOfflineModeSummary(role, history = []) {
    const fallback = buildOfflineSummaryFromHistory(history, role?.nickname || '对方');

    if (!apiSettings?.apiKey || !role) {
        return fallback;
    }

    try {
        const timeline = (Array.isArray(history) ? history : [])
            .map((msg) => {
                const text = getPlainTextFromChatContent(msg?.content, msg?.role).trim();
                if (!text) return '';
                return msg?.role === 'assistant'
                    ? `${role.nickname}：${text}`
                    : `你：${text}`;
            })
            .filter(Boolean)
            .slice(-12)
            .join('\n');

        if (!timeline) {
            return fallback;
        }

        const response = await requestChatCompletionWithFallback({
            systemPrompt: `你是剧情记录员。请把一段“线下相处经历”总结成 1 段可供记忆系统保存的摘要。
要求：
1. 只输出摘要正文，不要标题，不要引号，不要分点。
2. 语气像“共同经历回顾”，简洁自然。
3. 控制在 50~120 字。
4. 保留关键互动、情绪变化、关系推进，但不要写成分析报告。`,
            history: [],
            userContent: `角色：${role.nickname}\n请总结这段线下经历：\n${timeline}`,
            temperature: 0.6,
            maxTokens: 180
        });

        const summary = sanitizeAIResponse(
            response?.data?.choices?.[0]?.message?.content || '',
            role.nickname
        ).replace(/\s+/g, ' ').trim();

        return summary || fallback;
    } catch (error) {
        console.warn('生成线下模式总结失败，已回退本地摘要:', error);
        return fallback;
    }
}

async function exitOfflineModeWithoutSummary() {
    isOfflineMode = false;
    saveOfflineModePreference();
    await refreshChatViewForCurrentMode();

    if (window.DataManager) {
        DataManager.showToast('已退出线下模式');
    }
}

async function exitOfflineModeWithSummary() {
    if (!currentRoleId) {
        await exitOfflineModeWithoutSummary();
        return;
    }

    const role = wechatRoles.find(r => r.id === currentRoleId);
    const summaryText = await generateOfflineModeSummary(role, chatHistory);
    const timestamp = Date.now();

    addSharedEvent({
        sourceMode: 'offline',
        speakerRole: 'assistant',
        content: summaryText,
        timestamp,
        force: true
    });

    isOfflineMode = false;
    saveOfflineModePreference();
    await refreshChatViewForCurrentMode();

    if (window.DataManager) {
        DataManager.showToast('已退出线下模式，并保存剧情总结');
    }
}

function closeExitOfflineModeModal() {
    const modal = document.getElementById('exitOfflineModeModal');
    if (modal) {
        modal.remove();
    }
}

function showExitOfflineModeModal() {
    closeExitOfflineModeModal();

    const modal = document.createElement('div');
    modal.className = 'modal active exit-offline-mode-modal';
    modal.id = 'exitOfflineModeModal';
    modal.innerHTML = `
        <div class="modal-content exit-offline-mode-modal-content">
            <div class="modal-header exit-offline-mode-modal-header">
                <div class="modal-title exit-offline-mode-modal-title">退出线下模式</div>
                <button
                    class="modal-close exit-offline-mode-modal-close"
                    type="button"
                    aria-label="关闭"
                    onclick="closeExitOfflineModeModal()"
                >✕</button>
            </div>
            <div class="modal-body exit-offline-mode-modal-body">
                <div class="exit-offline-mode-modal-intro">选择退出方式</div>
                <div class="exit-offline-mode-modal-actions">
                    <button
                        class="exit-offline-mode-btn exit-offline-mode-btn-primary"
                        type="button"
                        onclick="handleExitOfflineMode(false)"
                    >
                        <div class="exit-offline-mode-btn-content">
                            <div class="exit-offline-mode-btn-title">结束且不总结</div>
                            <div class="exit-offline-mode-btn-caption">
                                <span class="exit-offline-mode-btn-badge">推荐</span>
                                <span>不写入记忆</span>
                            </div>
                        </div>
                        <div class="exit-offline-mode-btn-check">✓</div>
                    </button>
                    <button
                        class="exit-offline-mode-btn exit-offline-mode-btn-secondary"
                        type="button"
                        onclick="handleExitOfflineMode(true)"
                    >
                        <div class="exit-offline-mode-btn-content">
                            <div class="exit-offline-mode-btn-title">结束并总结</div>
                        </div>
                    </button>
                </div>
                <div class="exit-offline-mode-modal-note">
                    <div class="exit-offline-mode-modal-note-item">
                        <span class="exit-offline-mode-modal-note-label">不总结</span>
                        <span class="exit-offline-mode-modal-note-text">直接退出，不保存剧情摘要。</span>
                    </div>
                    <div class="exit-offline-mode-modal-note-item">
                        <span class="exit-offline-mode-modal-note-label">并总结</span>
                        <span class="exit-offline-mode-modal-note-text">生成摘要，供另一模式读取。</span>
                    </div>
                </div>
            </div>
        </div>
    `;

    modal.onclick = (event) => {
        if (event.target === modal) {
            closeExitOfflineModeModal();
        }
    };

    document.body.appendChild(modal);
}

async function handleExitOfflineMode(shouldSummarize) {
    closeExitOfflineModeModal();

    if (shouldSummarize) {
        await exitOfflineModeWithSummary();
        return;
    }

    await exitOfflineModeWithoutSummary();
}

function closeClearOfflineChatConfirmModal() {
    const modal = document.getElementById('clearOfflineChatConfirmModal');
    if (modal) {
        modal.remove();
    }
}

function showClearOfflineChatConfirmModal() {
    closeClearOfflineChatConfirmModal();

    const modal = document.createElement('div');
    modal.className = 'modal active clear-offline-chat-modal';
    modal.id = 'clearOfflineChatConfirmModal';
    modal.innerHTML = `
        <div class="modal-content clear-offline-chat-modal-content">
            <div class="modal-header clear-offline-chat-modal-header">
                <div class="modal-title clear-offline-chat-modal-title">清除线下聊天</div>
                <button
                    class="modal-close clear-offline-chat-modal-close"
                    type="button"
                    aria-label="关闭"
                    onclick="closeClearOfflineChatConfirmModal()"
                >✕</button>
            </div>
            <div class="modal-body clear-offline-chat-modal-body">
                <div class="clear-offline-chat-modal-description">
                    清除后将删除当前角色的线下聊天记录，且不可恢复。
                </div>
                <div class="clear-offline-chat-modal-actions">
                    <button
                        class="clear-offline-chat-btn clear-offline-chat-btn-cancel"
                        type="button"
                        onclick="closeClearOfflineChatConfirmModal()"
                    >取消</button>
                    <button
                        class="clear-offline-chat-btn clear-offline-chat-btn-danger"
                        type="button"
                        onclick="handleClearOfflineChatConfirm()"
                    >确认清除</button>
                </div>
            </div>
        </div>
    `;

    modal.onclick = (event) => {
        if (event.target === modal) {
            closeClearOfflineChatConfirmModal();
        }
    };

    document.body.appendChild(modal);
}

async function handleClearOfflineChatConfirm() {
    closeClearOfflineChatConfirmModal();
    await clearOfflineChatHistoryForCurrentRole();
}

function loadOfflineModePreference() {
    try {
        isOfflineMode = localStorage.getItem(OFFLINE_MODE_STORAGE_KEY) === 'true';
    } catch (error) {
        isOfflineMode = false;
    }
}

function resetChatModeToOnline() {
    isOfflineMode = false;
}

function saveOfflineModePreference() {
    try {
        localStorage.setItem(OFFLINE_MODE_STORAGE_KEY, String(isOfflineMode));
    } catch (error) {
        console.warn('保存线下模式开关失败:', error);
    }
}

function getPlainTextFromChatContent(content, speakerRole = 'user') {
    if (typeof content === 'string') {
        const normalized = content.trim();
        if (!normalized) return '';
        return normalized;
    }

    if (!content || typeof content !== 'object') {
        return '';
    }

    if (content.type === 'image') {
        return content.name
            ? `你们看见了一张图片：${content.name}`
            : '你们看见了一张图片。';
    }

    if (content.type === 'sticker') {
        return content.label
            ? `出现了一个表情：${content.label}`
            : '出现了一个表情。';
    }

    if (content.type === 'voice') {
        return content.text
            ? content.text
            : (speakerRole === 'assistant' ? '对方发来了一段语音。' : '你发出了一段语音。');
    }

    if (content.type === 'gift') {
        const name = content.name || '道具';
        const description = content.description ? `，效果：${content.description}` : '';
        return speakerRole === 'assistant'
            ? `对方回应了你送出的道具：${name}${description}。`
            : `你送给对方一个道具：${name}${description}。`;
    }

    if (content.type === 'forum-share') {
        const title = content.title || '论坛帖子';
        const forumName = content.forumName || '论坛';
        const excerpt = content.excerpt ? `，摘要：${content.excerpt}` : '';
        return `你分享了一篇来自${forumName}的帖子《${title}》${excerpt}。`;
    }

    if (content.type === 'transfer') {
        const amount = formatTransferAmount(content.amount);
        const status = normalizeTransferStatus(content.status);
        if (status === 'received') return `转账¥${amount}已被接收。`;
        if (status === 'refunded') return `转账¥${amount}已退回。`;
        return `你发起了一笔¥${amount}的转账，正在等待对方决定是否接收。`;
    }

    if (content.type === 'red-packet') {
        const amount = formatTransferAmount(content.amount);
        return normalizeTransferStatus(content.status) === 'received'
            ? `你领取了对方发来的¥${amount}红包。`
            : `对方发来一个¥${amount}红包。`;
    }

    return '';
}

function splitNarrativeParagraphs(text = '') {
    const normalizedText = String(text || '')
        .replace(/\r\n?/g, '\n')
        .trim();

    if (!normalizedText) return [];

    const rawParagraphs = normalizedText
        .split(/\n\s*\n+/)
        .map((item) => item.replace(/\s*\n\s*/g, ' ').trim())
        .filter(Boolean);

    if (rawParagraphs.length <= 1) {
        return rawParagraphs;
    }

    const mergedParagraphs = [];
    const openingQuotes = '“‘「『（【〈《"';
    const closingQuotes = '”’」』）】〉》"';
    const leadingClosingChars = '”’」』）】〉》"';
    const leadingOpeningChars = '“‘「『（【〈《"';
    const closingOnlyPattern = new RegExp(`^[${leadingClosingChars}\\s]+$`);
    const openingOnlyPattern = new RegExp(`^[${leadingOpeningChars}\\s]+$`);
    const startsWithClosingQuotePattern = new RegExp(`^[${leadingClosingChars}]`);
    const endsWithOpeningQuotePattern = new RegExp(`[${leadingOpeningChars}]$`);
    const startsWithClosingQuoteFragmentPattern = new RegExp(`^[${leadingClosingChars}][^“”"‘’「」『』（）【】〈〉《》]{0,120}$`);

    const countDoubleQuoteBalance = (value = '') => {
        const matches = String(value).match(/"/g);
        return matches ? matches.length % 2 : 0;
    };

    const countQuoteBalance = (value = '') => {
        let balance = 0;
        const textValue = String(value || '');

        for (const char of textValue) {
            if (char !== '"' && openingQuotes.includes(char)) balance += 1;
            if (char !== '"' && closingQuotes.includes(char)) balance -= 1;
        }

        return balance + countDoubleQuoteBalance(textValue);
    };

    const endsWithUnclosedQuote = (value = '') => {
        const trimmed = String(value).trim();
        if (!trimmed) return false;

        if (countQuoteBalance(trimmed) > 0) {
            return true;
        }

        return /[“‘「『（【〈《"](?:[^“”"‘’「」『』（）【】〈〉《》]*)$/.test(trimmed);
    };

    const isLikelyNarrationStart = (value = '') => {
        const trimmed = String(value).trim();
        if (!trimmed) return false;

        return /^(他|她|它|你|我|小|这|那|像|仿佛|于是|然后|后来|此刻|手机|屏幕|风|夜|空气|灯光)/.test(trimmed);
    };

    const shouldAttachWithoutSpace = (prev = '', next = '') => {
        const trimmedNext = String(next).trim();
        if (!trimmedNext) return false;

        return (
            closingOnlyPattern.test(trimmedNext)
            || /^[，。！？；：、,.!?;:）】〉》”’]/.test(trimmedNext)
        );
    };

    rawParagraphs.forEach((paragraph) => {
        if (mergedParagraphs.length === 0) {
            mergedParagraphs.push(paragraph);
            return;
        }

        const previousParagraph = mergedParagraphs[mergedParagraphs.length - 1];
        const previousHasUnclosedQuote = endsWithUnclosedQuote(previousParagraph);
        const currentStartsWithClosingQuote = startsWithClosingQuotePattern.test(paragraph);
        const isShortClosingFragment = startsWithClosingQuoteFragmentPattern.test(paragraph);
        const previousEndsWithOpeningQuote = endsWithOpeningQuotePattern.test(previousParagraph.trim());
        const shouldMergeIntoPrevious = (
            closingOnlyPattern.test(paragraph)
            || openingOnlyPattern.test(previousParagraph)
            || (previousHasUnclosedQuote && currentStartsWithClosingQuote)
            || (previousEndsWithOpeningQuote && !isLikelyNarrationStart(paragraph))
            || (previousHasUnclosedQuote && isShortClosingFragment && !isLikelyNarrationStart(paragraph.slice(1)))
        );

        if (shouldMergeIntoPrevious) {
            const joiner = shouldAttachWithoutSpace(previousParagraph, paragraph) ? '' : ' ';
            mergedParagraphs[mergedParagraphs.length - 1] = `${previousParagraph}${joiner}${paragraph}`.trim();
            return;
        }

        mergedParagraphs.push(paragraph);
    });

    return mergedParagraphs;
}

function protectStoryTextLineBreaks(text = '') {
    return String(text || '')
        .replace(/([“‘「『（【〈《])/g, '$1\u2060')
        .replace(/\u2060+/g, '\u2060')
        .replace(/\u2060([”’」』）】〉》])/g, '$1')
        .replace(/([^\s\u2060])([”’」』）】〉》])/g, '$1\u2060$2')
        .replace(/([—…]{1,2})([”’」』])/g, '$1\u2060$2');
}

function createStoryBlock({ type = 'narration', text = '' }) {
    const block = document.createElement('div');
    block.className = `story-block ${type}`;

    if (type === 'dialogue-user') {
        const paragraph = document.createElement('div');
        paragraph.className = 'story-paragraph story-paragraph-user-speech';
        paragraph.textContent = protectStoryTextLineBreaks(text);

        block.appendChild(paragraph);
        return block;
    }

    if (type === 'dialogue-role') {
        const paragraph = document.createElement('div');
        paragraph.className = 'story-paragraph story-paragraph-role-speech';
        paragraph.textContent = protectStoryTextLineBreaks(text);
        block.appendChild(paragraph);
        return block;
    }

    const paragraph = document.createElement('div');
    paragraph.className = 'story-paragraph story-paragraph-narration';
    paragraph.textContent = protectStoryTextLineBreaks(text);
    block.appendChild(paragraph);

    return block;
}

function renderOfflineStoryFeed() {
    const feed = document.getElementById('offlineStoryFeed');
    if (!feed) return;

    feed.innerHTML = '';

    const resolveOfflineStoryType = (msgRole, paragraphText = '') => {
        if (msgRole !== 'assistant') return 'dialogue-user';

        const text = String(paragraphText || '').trim();
        if (!text) return 'narration';

        // 助手段落中：有明确对白（引号/对话符号）则走“角色对白”，其余走“旁白叙述”
        const hasQuotedSpeech = /[“"「『].+?[”"」』]/.test(text);
        const hasDialogueCue = /(?:说|问|道|回应|低声|轻声|笑着)[：:]/.test(text);
        return (hasQuotedSpeech || hasDialogueCue) ? 'dialogue-role' : 'narration';
    };

    chatHistory.forEach((msg) => {
        if (msg?.role === 'system') return;

        const text = getPlainTextFromChatContent(msg.content, msg.role);
        if (!text) return;

        const paragraphs = splitNarrativeParagraphs(text);
        if (paragraphs.length === 0) return;

        paragraphs.forEach((paragraphText) => {
            feed.appendChild(createStoryBlock({
                type: resolveOfflineStoryType(msg.role, paragraphText),
                text: paragraphText
            }));
        });
    });

    feed.scrollTop = feed.scrollHeight;
}

function createCrossModeSummaryCard(event, roleName) {
    const card = document.createElement('div');
    card.className = 'msg-bubble-ai system cross-mode-summary';

    const modeLabel = event?.sourceMode === 'offline' ? '线下记录' : '线上记录';
    const fallback = event?.sourceMode === 'offline'
        ? `你和${roleName}在线下有过新的经历。`
        : `你和${roleName}在线上有过新的交流。`;

    card.textContent = `${modeLabel}：${event?.summary || fallback}`;
    return card;
}

function createCrossModeSyncHintCard(count = 0, sourceMode = 'offline') {
    const card = document.createElement('div');
    card.className = 'msg-bubble-ai system cross-mode-summary';

    const sourceLabel = sourceMode === 'offline' ? '线下' : '线上';
    const validCount = Math.max(0, Number(count) || 0);
    card.textContent = validCount > 0
        ? `记忆已同步：已载入${sourceLabel}模式最近 ${validCount} 条共同经历。`
        : `记忆已同步：暂未发现${sourceLabel}模式可载入的共同经历。`;

    return card;
}

async function refreshChatViewForCurrentMode() {
    if (!currentRoleId) return;

    loadChatHistory();
    await hydrateChatHistoryMedia(chatHistory);
    syncOfflineModeUI();

    const chatBox = document.getElementById('chatBox');
    if (chatBox) {
        chatBox.innerHTML = '';

        const role = wechatRoles.find(r => r.id === currentRoleId);

        let lastTimestamp = null;

        chatHistory.forEach((msg) => {
            const timestamp = msg.timestamp || Date.now();
            const messageId = msg.id || msg.timestamp || `msg_${timestamp}_${Math.random().toString(36).slice(2, 8)}`;
            msg.id = messageId;

            if (shouldShowTime(lastTimestamp, timestamp)) {
                chatBox.appendChild(createTimeDivider(timestamp));
            }
            lastTimestamp = timestamp;

            if (msg.role === 'user') {
                chatBox.appendChild(createUserBubble(msg.content, true, messageId, msg.quotedMessage, msg.translation));
            } else if (msg.role === 'assistant') {
                chatBox.appendChild(createAIBubble(msg.content, true, role, messageId, msg.quotedMessage, msg.translation));
            } else if (msg.role === 'system' && msg.type === 'transfer-notice') {
                chatBox.appendChild(createChatSystemNotice(msg.content, messageId));
            }
        });

        scheduleChatScrollToBottom();
    }

    renderWechatChatList();
}

function syncOfflineModeUI() {
    const chatApp = document.getElementById('app-chat');
    const toggleBtn = document.getElementById('offlineModeToggle');
    const banner = document.getElementById('chatModeBanner');
    const input = document.getElementById('msgInput');
    const sendBtn = document.querySelector('#app-chat .input-btn.send');

    if (chatApp) {
        chatApp.classList.toggle('offline-mode', isOfflineMode);
    }

    if (toggleBtn) {
        toggleBtn.classList.toggle('active', isOfflineMode);
        toggleBtn.title = isOfflineMode ? '清除当前线下聊天' : '进入线下模式';
        toggleBtn.setAttribute('aria-label', isOfflineMode ? '清除当前线下聊天' : '进入线下模式');
    }

    if (banner) {
        banner.textContent = '';
    }

    if (input) {
        input.placeholder = isOfflineMode
            ? '当面说点什么…'
            : '发送消息...';
    }

    if (sendBtn) {
        sendBtn.textContent = '发送';
        sendBtn.setAttribute('aria-label', '发送消息');
        sendBtn.title = '发送消息';
    }

    if (isOfflineMode) {
        closeChatMediaPanel();
        renderOfflineStoryFeed();
    }

    scheduleChatScrollToBottom();
}

async function clearOfflineChatHistoryForCurrentRole() {
    if (!currentRoleId) return;

    const offlineKey = getChatStorageKey(currentRoleId, 'offline');
    localStorage.removeItem(offlineKey);

    // 仅清除线下聊天记录，不再影响已保存的跨模式总结
    if (isOfflineMode) {
        chatHistory = [];
    }

    await refreshChatViewForCurrentMode();

    if (window.DataManager) {
        DataManager.showToast('已清除线下聊天记录');
    }
}

async function toggleOfflineMode() {
    if (isOfflineMode) {
        showClearOfflineChatConfirmModal();
        return;
    }

    isOfflineMode = true;
    saveOfflineModePreference();
    await refreshChatViewForCurrentMode();

    if (window.DataManager) {
        DataManager.showToast('已进入线下模式');
    }
}

function loadChatStickerLibrary() {
    const saved = localStorage.getItem(CHAT_STICKER_STORAGE_KEY);

    if (saved) {
        try {
            const parsed = JSON.parse(saved);
            if (Array.isArray(parsed) && parsed.length > 0) {
                chatStickerLibrary = parsed;
            } else {
                chatStickerLibrary = [...DEFAULT_CHAT_STICKERS];
            }
        } catch (e) {
            chatStickerLibrary = [...DEFAULT_CHAT_STICKERS];
        }
    } else {
        chatStickerLibrary = [...DEFAULT_CHAT_STICKERS];
    }

    saveChatStickerLibrary();
}

function saveChatStickerLibrary() {
    localStorage.setItem(CHAT_STICKER_STORAGE_KEY, JSON.stringify(chatStickerLibrary));
}

// ================= 初始化 =================
document.addEventListener('DOMContentLoaded', () => {
    startClockSync();

    // 初始化测试数据（如果还没有的话）
    initializeTestData();
    
    loadAPISettings();
    loadChatHistory();
    loadNotes();
    loadWechatUser();
    loadUserMasks();
    loadForums();
    loadWalletData();
    loadMoments();
    loadOfflineModePreference();
    loadChatStickerLibrary();
    installChatInputViewportHandlers();
    initAppearance();  // 确保这行有，且前面没有语法错误
    loadWechatRoles();
    scheduleAppViewportSync();
    initProactiveMessages();
    resumePendingImageJobPolling();
    
    // 每分钟检查存储
    updateStorageInfo();

    // 添加键盘监听
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && currentApp) {
            goHome();
        }
    });

    initMicroInteractions();
    initPreciseHomeIconClickGuard();
    initDokiAssets();
    initMusicPlayer();
    updateHomeDoki();
    previewDokiAdoption();
    
    // 测试菜单是否可以显示
    console.log('测试：wechatMenu元素是否存在:', !!document.getElementById('wechatMenu'));
    console.log('测试：openWechatMenu函数是否存在:', typeof openWechatMenu);
});  // 结束 DOMContentLoaded

// 初始化测试数据
function initializeTestData() {
    // 检查是否已有微信角色数据
    const existingRolesStr = localStorage.getItem('wechatRoles');
    let roles = [];
    try {
        roles = JSON.parse(existingRolesStr) || [];
    } catch (e) {
        roles = [];
    }

    // --- 强制去重逻辑 ---
    const seenNicknames = new Set();
    const seenIds = new Set();
    roles = normalizeRoleCollection(roles).filter(role => {
        if (seenIds.has(role.id) || seenNicknames.has(role.nickname)) {
            return false;
        }
        seenIds.add(role.id);
        seenNicknames.add(role.nickname);
        return true;
    });
    localStorage.setItem('wechatRoles', JSON.stringify(roles));
    // ------------------

    // 检查是否已经初始化过
    if (localStorage.getItem('isInitialized')) return;

    // 修复重复角色问题：检查是否已存在 ID 为 1000 或昵称为 '小白' 的角色
    const hasXiaoBai = roles.some(r => r.id === 1000 || r.nickname === '小白');
    
    if (!hasXiaoBai) {
        // 添加微信角色 - 用于测试
        const testRoles = [
            {
                id: 1000,
                nickname: '小白',
                realName: 'ave',
                avatar: DEFAULT_FRIEND_AVATAR_COLOR,
                type: 'ai',
                systemPrompt: '冷漠无情',
                genderIdentity: '女性',
                thirdPersonPronoun: '她'
            }
        ];
        roles = [...roles, ...testRoles];
        localStorage.setItem('wechatRoles', JSON.stringify(roles));
        
        // 只有在角色不存在时才添加聊天历史 - 初始化时不添加，让用户从空对话开始
        const chatKey = getChatStorageKey(1000, 'online');
        if (!localStorage.getItem(chatKey)) {
            // 初始化为空数组，不添加测试消息
            localStorage.setItem(chatKey, JSON.stringify([]));
        }
    }
    
    // 检查是否已有其他数据
    if (localStorage.length <= 5) {  // 适当放宽条件
        // 不添加聊天历史数据，让用户从空对话开始
        localStorage.setItem('chatHistory', JSON.stringify([]));
        
        // 添加备忘录数据
        const notes = [
            {
                id: 1,
                title: '购物清单',
                content: '1. 牛奶\n2. 面包\n3. 鸡蛋\n4. 蔬菜\n5. 水果',
                date: '2026年4月17日'
            },
            {
                id: 2,
                title: '项目计划',
                content: '第一季度目标：\n- 完成核心功能开发\n- 进行用户测试\n- 收集反馈并改进\n- 准备发布',
                date: '2026年4月16日'
            },
            {
                id: 3,
                title: '学习笔记',
                content: '学习JavaScript中的异步编程：\n- Promise\n- async/await\n- 回调函数\n- 事件循环',
                date: '2026年4月15日'
            }
        ];
        localStorage.setItem('notes', JSON.stringify(notes));
        
        // 添加API设置数据
        const apiSettings = {
            apiUrl: 'https://api.deepseek.com/v1',
            modelName: 'deepseek-chat',
            apiKey: 'sk-xxxxx',
            enableVision: false,
            temperature: 0.7,
            enableImageGeneration: false,
            imageApiUrl: 'https://api.openai.com/v1',
            imageApiKey: '',
            imageModelName: 'gpt-image-2',
            imageSize: '1024x1024',
            minimaxApiUrl: 'https://api.minimax.chat/v1',
            minimaxGroupId: '',
            minimaxApiKey: '',
            minimaxSpeechModel: 'speech-2.8-hd',
            enableRoleVoiceReply: false,
            roleVoiceReplyProbability: 0.2
        };
        localStorage.setItem('apiSettings', JSON.stringify(apiSettings));
        
        // 添加外观设置
        localStorage.setItem('appearanceSettings', JSON.stringify(getDefaultAppearanceSettings()));
    }
    
    // 标记已完成初始化
    localStorage.setItem('isInitialized', 'true');
}
// ================= 应用导航 =================
async function openApp(appName) {
    closeCommentInput();

    // 检查电量
    if (typeof BatterySystem !== 'undefined' && 
        BatterySystem.state !== 'running' && 
        appName !== 'settings') {
        console.log('电量检查阻止了打开:', BatterySystem.state);
        return;
    }
    
    currentApp = appName;
    
    // 隐藏主屏幕
    const homeScreen = document.getElementById('homeScreen');
    if (!homeScreen) {
        console.error('错误：找不到 homeScreen 元素！');
        return;
    }

    // 显示应用
    const appEl = document.getElementById(`app-${appName}`);
    if (!appEl) {
        console.error(`错误：找不到 app-${appName} 元素！`);
        console.error('可能的原因：');
        console.error('1. HTML中缺少该app的div');
        console.error('2. id名称不匹配（应为 app-wechat/app-messages 等）');
        homeScreen.classList.remove('home-leaving');
        homeScreen.style.display = 'flex';
        return;
    }

    homeScreen.classList.remove('home-returning');
    homeScreen.classList.add('home-leaving');

    // 关键：先让新内容可见，再隐藏旧内容，避免黑屏/空白帧
    showAppView(appEl);
    appEl.classList.remove('app-closing');
    appEl.classList.remove('app-opening');

    requestAnimationFrame(() => {
        appEl.classList.add('app-opening');
        homeScreen.style.display = 'none';
        homeScreen.classList.remove('home-leaving');
    });

    setTimeout(() => appEl.classList.remove('app-opening'), 280);

    if (navigator.vibrate) navigator.vibrate(10);
    
    // 应用特定初始化
    if (appName === 'wechat') {
        updateLastMessage();
        // 进入微信时强制回到聊天页，避免残留状态导致内容区空白
        currentWechatTab = '';
        switchWechatTab('chats');
        renderWechatChatList();
    } else if (appName === 'settings') {
        updateStorageDisplay();
    } else if (appName === 'wallet') {
        renderWalletPage();
    } else if (appName === 'worldbook') {
        loadWorldRules();
        renderWorldRules();

        // 防止样式层或历史状态导致右上角 + 点击失效：
        // 每次进入世界书时，强制重新绑定一次点击事件
        const worldbookAddBtn = document.querySelector('#app-worldbook .nav-action');
        if (worldbookAddBtn) {
            worldbookAddBtn.onclick = function (event) {
                if (event) {
                    event.preventDefault();
                    event.stopPropagation();
                }
                showAddWorldRuleModal();
        
    };
        }
    } else if (appName === 'doki') {
        renderDokiApp();
    } else if (appName === 'forum') {
        if (!forumsLoaded) await loadForums();
        loadUserMasks();
        renderForumHome();
    }
}

function goHome() {
    closeCommentInput();
    closeChatMediaPanel();
    closeForumPublishSheet();
    closeForumInputModal();
    resetChatSelectionState();

    const homeScreen = document.getElementById('homeScreen');

    // 隐藏所有应用（带关闭过渡）
    document.querySelectorAll('.app-view').forEach(el => {
        if (el.style.display !== 'none') {
            el.classList.remove('app-opening');
            el.classList.add('app-closing');
            setTimeout(() => {
                hideAppView(el);
                el.classList.remove('app-closing');
            }, 220);
        } else {
            hideAppView(el);
        }
    });

    if (homeScreen) {
        homeScreen.style.display = 'flex';
        homeScreen.classList.remove('home-leaving');
        requestAnimationFrame(() => {
            homeScreen.classList.add('home-returning');
        });
        setTimeout(() => homeScreen.classList.remove('home-returning'), 260);
    }
    
    hideAppView(document.getElementById('app-chat'));
    currentApp = null;

    if (navigator.vibrate) navigator.vibrate(8);
}

async function backToWechat() {
    closeCommentInput();
    closeChatMediaPanel();
    resetChatSelectionState();

    if (isOfflineMode) {
        showExitOfflineModeModal();
        return;
    }

    hideAppView(document.getElementById('app-chat'));
    showAppView(document.getElementById('app-wechat'));
    currentApp = 'wechat';
    renderWechatChatList();
}

function switchWechatTab(tab) {
    closeCommentInput();
    closeChatMediaPanel();

    const nextTabEl = document.getElementById(`tab-${tab}`);
    if (!nextTabEl) return;
    if (currentWechatTab === tab) return;

    const prevTabEl = document.getElementById(`tab-${currentWechatTab}`);

    const currentActiveBtn = document.querySelector('.tab-item.active');
    if (currentActiveBtn) currentActiveBtn.classList.remove('active');

    const activeBtn = document.querySelector(`.tab-item[onclick*="switchWechatTab('${tab}')"]`);
    if (activeBtn && activeBtn !== currentActiveBtn) activeBtn.classList.add('active');

    // 显式控制 tab 显示，避免仅靠 class 导致内容区被 display:none 卡住
    document.querySelectorAll('#app-wechat .wechat-tab').forEach((tabEl) => {
        tabEl.style.display = 'none';
        tabEl.classList.remove('is-active');
    });

    if (prevTabEl) prevTabEl.classList.remove('is-active');
    nextTabEl.style.display = 'flex';
    nextTabEl.classList.add('is-active');

    currentWechatTab = tab;

    const navTitle = document.querySelector('#app-wechat .nav-title');
    if (navTitle) {
        const titleMap = {
            chats: '微信',
            contacts: '通讯录',
            moments: '朋友圈',
            me: '我'
        };
        navTitle.textContent = titleMap[tab] || '微信';
    }

    const navAction = document.querySelector('#app-wechat .nav-action');
    if (navAction) {
        navAction.textContent = '+';
        if (tab === 'moments') {
            navAction.setAttribute('aria-label', '发布动态');
            navAction.title = '发布动态';
            navAction.onclick = function() { openMomentPostPage(); };
        } else if (tab === 'me') {
            navAction.setAttribute('aria-label', '新建面具');
            navAction.title = '新建面具';
            navAction.onclick = function() { openNewMaskPage('me'); };
        } else {
            navAction.setAttribute('aria-label', '新建对话');
            navAction.title = '新建对话';
            navAction.onclick = function() { openWechatMenu(); };
        }
    }

    if (wechatTabRenderFrameId) {
        cancelAnimationFrame(wechatTabRenderFrameId);
    }

    wechatTabRenderFrameId = requestAnimationFrame(() => {
        wechatTabRenderFrameId = 0;

        if (tab === 'chats') {
            renderWechatChatList();
        } else if (tab === 'contacts') {
            if (!wechatTabRenderState.contacts) {
                renderContactsList();
                wechatTabRenderState.contacts = true;
            }
        } else if (tab === 'moments') {
            if (!wechatTabRenderState.moments) {
                renderMomentsList();
                wechatTabRenderState.moments = true;
            }
        } else if (tab === 'me') {
            if (!wechatTabRenderState.me) {
                renderUserProfile();
                wechatTabRenderState.me = true;
            } else {
                renderUserProfile();
            }
        }
    });
}

// ================= 微信用户管理 =================
let wechatUser = {
    nickname: '我',
    realName: '用户',
    avatar: 'white',
    bio: '这是我的个人简介'
};

let userMasks = [];
let currentMaskId = null;
let editingMaskId = null;
let maskEditorReturnTarget = 'me';
let forums = [];
let currentForumId = null;
let currentForumPostId = null;
let forumGenerating = false;
let activeForumImageBatches = new Set();
let activeForumImagePosts = new Set();
let activeForumImagePollJobs = new Set();
let scheduledForumImageEnsureTimers = new Map();
let forumsLoaded = false;
let pendingForumReplyTarget = null;
let forumCreateState = {
    selectedRoleIds: [],
    selectedMaskId: null
};
let walletData = {
    balance: DEFAULT_WALLET_BALANCE,
    records: []
};
let walletWorkState = {
    activeJob: null
};
let walletWorkCountdownTimer = null;
let shopData = {
    purchases: [],
    mysteryReward: null
};

function loadWechatUser() {
    const saved = localStorage.getItem('wechatUser');
    if (saved) {
        wechatUser = JSON.parse(saved);
    }
}

function saveWechatUser() {
    localStorage.setItem('wechatUser', JSON.stringify(wechatUser));
}

function createDefaultUserMask(sourceUser = wechatUser) {
    const now = Date.now();
    return {
        id: 'mask_default',
        name: String(sourceUser?.nickname || '我').trim() || '我',
        description: String(sourceUser?.bio || '这是我的个人简介').trim() || '这是我的个人简介',
        avatar: sourceUser?.avatar || 'white',
        createdAt: now,
        updatedAt: now
    };
}

function normalizeUserMask(rawMask, index = 0) {
    const now = Date.now();
    const raw = rawMask && typeof rawMask === 'object' ? rawMask : {};
    const name = String(raw.name || raw.nickname || '').trim() || (index === 0 ? '我' : `面具${index + 1}`);
    const description = String(raw.description || raw.bio || '').trim() || (index === 0 ? '这是我的个人简介' : '');

    return {
        id: String(raw.id || `mask_${now}_${index}_${Math.random().toString(36).slice(2, 8)}`),
        name,
        description,
        avatar: raw.avatar || 'white',
        createdAt: Number(raw.createdAt) || now,
        updatedAt: Number(raw.updatedAt) || now
    };
}

function loadUserMasks() {
    const savedMasks = safeReadStorageJSON(USER_MASKS_STORAGE_KEY, null);
    userMasks = Array.isArray(savedMasks)
        ? savedMasks.map(normalizeUserMask).filter(mask => mask && mask.id)
        : [];

    if (userMasks.length === 0) {
        userMasks = [createDefaultUserMask(wechatUser)];
    }

    currentMaskId = localStorage.getItem(CURRENT_MASK_ID_STORAGE_KEY) || currentMaskId || userMasks[0].id;
    if (!userMasks.some(mask => String(mask.id) === String(currentMaskId))) {
        currentMaskId = userMasks[0].id;
    }

    saveUserMasks();
}

function saveUserMasks() {
    if (!Array.isArray(userMasks) || userMasks.length === 0) {
        userMasks = [createDefaultUserMask(wechatUser)];
    }

    if (!currentMaskId || !userMasks.some(mask => String(mask.id) === String(currentMaskId))) {
        currentMaskId = userMasks[0].id;
    }

    localStorage.setItem(USER_MASKS_STORAGE_KEY, JSON.stringify(userMasks));
    localStorage.setItem(CURRENT_MASK_ID_STORAGE_KEY, currentMaskId);
    syncWechatUserFromCurrentMask();
}

function getCurrentUserMask() {
    if (!Array.isArray(userMasks) || userMasks.length === 0) {
        loadUserMasks();
    }

    return userMasks.find(mask => String(mask.id) === String(currentMaskId)) || userMasks[0] || createDefaultUserMask();
}

function syncWechatUserFromCurrentMask() {
    const mask = getCurrentUserMask();
    wechatUser = {
        nickname: mask.name || '我',
        realName: mask.name || '用户',
        avatar: mask.avatar || 'white',
        bio: mask.description || ''
    };
    saveWechatUser();
}

function getCurrentMaskSnapshot() {
    const mask = getCurrentUserMask();
    return {
        maskId: mask.id,
        maskName: mask.name || '我'
    };
}

function buildCurrentUserMaskPromptContext() {
    const mask = getCurrentUserMask();
    const name = String(mask?.name || '我').trim() || '我';
    const description = String(mask?.description || '').trim() || '这是我的个人简介';

    return `当前与角色对话的用户面具：
名称：${name}
描述：${description}
请把这个面具当作当前用户身份来理解对话。角色面对的是当前面具，不是固定默认用户；不要知道、提及或推测其他未选择的面具。`;
}

function getMaskDescriptionSummary(mask) {
    const description = String(mask?.description || '').trim();
    if (!description) return '还没有描述';
    return description.length > 28 ? `${description.slice(0, 28)}...` : description;
}

function renderMaskListPage() {
    const list = document.getElementById('maskList');
    if (!list) return;

    if (!Array.isArray(userMasks) || userMasks.length === 0) {
        loadUserMasks();
    }

    list.innerHTML = userMasks.map(mask => {
        const avatarConfig = getAvatarRenderConfig(mask.avatar || 'white', mask.name || '我');
        const isCurrent = String(mask.id) === String(currentMaskId);
        const canDelete = userMasks.length > 1;

        return `
            <div class="mask-list-row${isCurrent ? ' active' : ''}">
                <button class="mask-select-main" type="button" onclick="selectUserMask('${escapeHtml(mask.id)}')">
                    <span class="mask-avatar" style="${avatarConfig.avatarStyle}" aria-hidden="true">${escapeHtml(avatarConfig.avatarContent)}</span>
                    <span class="mask-list-text">
                        <span class="mask-list-name">${escapeHtml(mask.name || '我')}</span>
                        <span class="mask-list-desc">${escapeHtml(getMaskDescriptionSummary(mask))}</span>
                    </span>
                    <span class="mask-check" aria-hidden="true">${isCurrent ? '✓' : ''}</span>
                </button>
                <div class="mask-row-actions">
                    <button class="mask-row-btn" type="button" onclick="openEditMaskPage('${escapeHtml(mask.id)}')">编辑</button>
                    <button class="mask-row-btn danger" type="button" ${canDelete ? '' : 'disabled'} onclick="deleteUserMask('${escapeHtml(mask.id)}')">删除</button>
                </div>
            </div>
        `;
    }).join('');
}

function openMaskListPage() {
    closeCommentInput();
    closeChatMediaPanel();
    loadUserMasks();
    hideAppView(document.getElementById('app-wechat'));
    showAppView(document.getElementById('app-mask-list'));
    currentApp = 'mask-list';
    renderMaskListPage();
}

function backToWechatMeFromMaskPage() {
    hideAppView(document.getElementById('app-mask-list'));
    hideAppView(document.getElementById('app-mask-editor'));
    showAppView(document.getElementById('app-wechat'));
    currentApp = 'wechat';
    switchWechatTab('me');
}

function openNewMaskPage(returnTarget = null) {
    editingMaskId = null;
    maskEditorReturnTarget = returnTarget || (currentApp === 'mask-list' ? 'list' : 'me');
    hideAppView(document.getElementById('app-wechat'));
    hideAppView(document.getElementById('app-mask-list'));
    showAppView(document.getElementById('app-mask-editor'));
    currentApp = 'mask-editor';
    renderMaskEditorPage();
}

function openEditMaskPage(maskId) {
    editingMaskId = String(maskId || '');
    maskEditorReturnTarget = 'list';
    hideAppView(document.getElementById('app-mask-list'));
    showAppView(document.getElementById('app-mask-editor'));
    currentApp = 'mask-editor';
    renderMaskEditorPage();
}

function backFromMaskEditor() {
    hideAppView(document.getElementById('app-mask-editor'));
    if (maskEditorReturnTarget === 'list') {
        showAppView(document.getElementById('app-mask-list'));
        currentApp = 'mask-list';
        renderMaskListPage();
    } else {
        showAppView(document.getElementById('app-wechat'));
        currentApp = 'wechat';
        switchWechatTab('me');
    }
}

function renderMaskEditorPage() {
    const title = document.getElementById('maskEditorTitle');
    const nameInput = document.getElementById('maskNameInput');
    const descInput = document.getElementById('maskDescriptionInput');
    const preview = document.getElementById('maskAvatarPreview');
    const fileInput = document.getElementById('maskAvatarInput');
    const mask = editingMaskId
        ? userMasks.find(item => String(item.id) === String(editingMaskId))
        : null;

    if (title) title.textContent = editingMaskId ? '编辑面具' : '新建面具';
    if (nameInput) nameInput.value = mask?.name || '';
    if (descInput) descInput.value = mask?.description || '';
    if (fileInput) fileInput.value = '';

    const avatarValue = mask?.avatar || 'white';
    if (preview) {
        preview.dataset.avatarValue = avatarValue;
        applyAvatarRenderConfig(preview, avatarValue, mask?.name || nameInput?.value || '我');
    }

    updateMaskSaveButtonState();
}

function updateMaskAvatarPreviewName() {
    const preview = document.getElementById('maskAvatarPreview');
    const nameInput = document.getElementById('maskNameInput');
    if (!preview) return;
    const avatarValue = preview.dataset.avatarValue || 'white';
    applyAvatarRenderConfig(preview, avatarValue, nameInput?.value || '我');
}

function updateMaskSaveButtonState() {
    const saveBtn = document.getElementById('maskSaveAction');
    const nameInput = document.getElementById('maskNameInput');
    if (saveBtn) {
        saveBtn.disabled = !String(nameInput?.value || '').trim();
    }
}

function handleMaskAvatarUpload(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
        const preview = document.getElementById('maskAvatarPreview');
        if (!preview) return;
        const imageData = e.target.result;
        preview.dataset.avatarValue = `url('${imageData}')`;
        preview.style.background = `url('${imageData}') center / cover`;
        preview.textContent = '';
    };
    reader.readAsDataURL(file);
}

function saveMaskFromEditor() {
    const nameInput = document.getElementById('maskNameInput');
    const descInput = document.getElementById('maskDescriptionInput');
    const preview = document.getElementById('maskAvatarPreview');
    const name = String(nameInput?.value || '').trim();
    const description = String(descInput?.value || '').trim();
    const avatar = preview?.dataset.avatarValue || 'white';

    if (!name) {
        showToast('请输入我的名称');
        return;
    }

    const now = Date.now();
    if (editingMaskId) {
        const mask = userMasks.find(item => String(item.id) === String(editingMaskId));
        if (!mask) return;
        mask.name = name;
        mask.description = description;
        mask.avatar = avatar;
        mask.updatedAt = now;
    } else {
        const newMask = {
            id: `mask_${now}_${Math.random().toString(36).slice(2, 8)}`,
            name,
            description,
            avatar,
            createdAt: now,
            updatedAt: now
        };
        userMasks.push(newMask);
        currentMaskId = newMask.id;
    }

    saveUserMasks();
    renderUserProfile();
    backFromMaskEditor();
    showToast(editingMaskId ? '面具已更新' : '面具已创建');
}

function selectUserMask(maskId) {
    const nextMask = userMasks.find(mask => String(mask.id) === String(maskId));
    if (!nextMask) return;

    currentMaskId = nextMask.id;
    saveUserMasks();
    renderMaskListPage();
    renderUserProfile();
    showToast(`已切换为${nextMask.name || '我'}`);
}

function deleteUserMask(maskId) {
    if (!Array.isArray(userMasks) || userMasks.length <= 1) {
        showToast('至少保留一个面具');
        return;
    }

    const mask = userMasks.find(item => String(item.id) === String(maskId));
    if (!mask) return;
    if (!confirm(`确定删除面具"${mask.name || '我'}"吗？`)) return;

    userMasks = userMasks.filter(item => String(item.id) !== String(maskId));
    if (String(currentMaskId) === String(maskId)) {
        currentMaskId = userMasks[0].id;
    }

    saveUserMasks();
    renderMaskListPage();
    renderUserProfile();
    showToast('面具已删除');
}

// ================= 本地论坛 =================
function createForumId(prefix = 'forum') {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

const FORUM_NPC_NAME_POOL = [
    '阿澈', '小满在赶ddl', '林七_不熬夜版', '南瓜今天早睡', '知夏', '阿眠emo中',
    'ChrisWong', 'mika.', 'Evan_404', 'Luna不想上班', 's1mple', 'n1ghtmare',
    'i人也想发言', '小狗也会淋雨吗', '别再梦见他', '退堂鼓十级选手', '不许回头',
    '今天也要赢', '慢慢变好ing', '别怕先做', '上岸倒计时', '努力攒碎银几两',
    'XX的奶茶续命站', '小源今天发自拍了吗', '为你打call到凌晨', '内娱观察员_K',
    '七秒记忆🫧', '🍋半糖去冰', '月亮邮差🌙', '404心动丢失', '雨停再走吧。',
    '葬爱メ冷少', '浅唱丶离殇', 'ゞ灬夜未央', 'ぺ孤影成双', '殇ベ不回头',
    '一口盐', '晚灯下的橘子', '小鱼干别跑', 'BlueberryMood', '北岛没有猫',
    '人间观察bot', '电子羊在充电', 'CtrlZ人生', 'WiFi满格但心空', '咖啡因过敏体',
    '爱吃香菜的火星人', '别管我在发疯', '普通市民小赵', '今天星期几啊', '风很大听不清',
    '雨夜便利店', '海盐气泡水', '山城薄荷', '小周不加班', '阿布吃两碗',
    '不想取名了', '凌晨三点半', '人类低电量', '纸片月亮', '白噪音收藏家',
    '一颗冷掉的糖', '风里有旧歌', '橙子汽水派', 'Kira_在路上', 'Nora睡不醒',
    'blueMonday_', 'Momo不是陌陌', 'K_今天早退', 'Yuki烤年糕', '宇宙尽头打工人',
    '别催我回消息', '我先存个档', '今天也没想明白', '咸鱼翻身失败', '小林今天摸鱼',
    '薄荷撞可乐', '便利店关东煮', '一只醒着的梦', '星星掉线中', '深夜观察记录',
    '半截铅笔', '热心网友小梁', '退订焦虑', '乌龙茶少冰', '旧唱片侧A',
    '会发光的便签', '想去海边', '三分钟热度Plus', '猫舌头喝不了热咖啡', '低空飞行中',
    '不熬夜挑战失败', '冬眠许可证', '银河售票员', '薯条要蘸冰淇淋', '北风知道答案',
    '空白昵称_', '今天风向西', '一个路过的ID', '醒醒要迟到了', '第七杯拿铁',
    '云层后面见', '把月亮调暗点', '匿名但不完全匿名', '冒泡一下', '没有昵称可用'
];

const FORUM_GENERIC_NAME_PATTERN = /(路人甲|路人乙|技术宅|萌新|求罩|办公室|老油条|瓜田|值班员|旧帖|收藏家|夜班|摸鱼|楼主|围观|吃瓜|匿名网友|路过网友|网友\d*|NPC|用户\d*|评论人|发帖人)/i;
const FORUM_LEGACY_SHORT_NPC_NAMES = new Set([
    '阿澈', '小满', '林七', '南瓜', '知夏', '阿眠', '叶子', '小陆',
    '青柠', '晚灯', '小周', '晴天', '十七', '木木', '阿野',
    '半糖', '小鱼干', '橘白', '旧雨', '蓝莓', '小禾', '山月', '北岛'
]);

function pickForumNpcName(seed = '') {
    const source = String(seed || `${Date.now()}_${Math.random()}`);
    let hash = 0;
    for (const char of source) {
        hash = ((hash << 5) - hash) + char.codePointAt(0);
        hash |= 0;
    }
    return FORUM_NPC_NAME_POOL[Math.abs(hash) % FORUM_NPC_NAME_POOL.length];
}

function sanitizeForumAuthorName(name, fallbackSeed = '') {
    const rawName = String(name || '').trim();
    const compactName = rawName.replace(/\s+/g, '');

    if (!compactName || compactName.length > 18 || FORUM_GENERIC_NAME_PATTERN.test(compactName)) {
        return pickForumNpcName(fallbackSeed || compactName);
    }

    return compactName;
}

function normalizeForumComment(rawComment, index = 0) {
    const now = Date.now();
    const raw = rawComment && typeof rawComment === 'object' ? rawComment : {};
    const authorType = ['role', 'mask', 'npc'].includes(raw.authorType) ? raw.authorType : 'npc';
    const rawAuthorName = String(raw.authorName || '').trim();
    const shouldTreatAsNpc = authorType === 'npc'
        || FORUM_GENERIC_NAME_PATTERN.test(rawAuthorName)
        || FORUM_LEGACY_SHORT_NPC_NAMES.has(rawAuthorName);
    const fallbackAuthor = shouldTreatAsNpc ? pickForumNpcName(raw.content || index) : '我';
    const authorName = shouldTreatAsNpc
        ? sanitizeForumAuthorName(raw.authorName || fallbackAuthor, raw.content || index)
        : (String(raw.authorName || fallbackAuthor).trim() || fallbackAuthor);
    return {
        id: String(raw.id || createForumId(`comment_${index}`)),
        content: String(raw.content || '').trim(),
        authorName,
        authorType,
        authorId: raw.authorId ? String(raw.authorId) : '',
        isUserAuthored: !!raw.isUserAuthored,
        createdAt: Number(raw.createdAt) || now,
        likeCount: Math.max(0, Number(raw.likeCount) || 0),
        likedByMe: !!raw.likedByMe,
        replyToCommentId: raw.replyToCommentId ? String(raw.replyToCommentId) : '',
        replyToAuthorName: String(raw.replyToAuthorName || '').trim()
    };
}

function normalizeForumPost(rawPost, index = 0) {
    const now = Date.now();
    const raw = rawPost && typeof rawPost === 'object' ? rawPost : {};
    const title = String(raw.title || '').trim() || `未命名帖子 ${index + 1}`;
    const authorType = ['role', 'mask', 'npc'].includes(raw.authorType) ? raw.authorType : 'npc';
    const rawAuthorName = String(raw.authorName || '').trim();
    const shouldTreatAsNpc = authorType === 'npc'
        || FORUM_GENERIC_NAME_PATTERN.test(rawAuthorName)
        || FORUM_LEGACY_SHORT_NPC_NAMES.has(rawAuthorName);
    const fallbackAuthor = shouldTreatAsNpc ? pickForumNpcName(title || index) : '我';
    const authorName = shouldTreatAsNpc
        ? sanitizeForumAuthorName(raw.authorName || fallbackAuthor, title || index)
        : (String(raw.authorName || fallbackAuthor).trim() || fallbackAuthor);
    return {
        id: String(raw.id || createForumId(`post_${index}`)),
        title,
        content: String(raw.content || title).trim() || title,
        authorName,
        authorType,
        authorId: raw.authorId ? String(raw.authorId) : '',
        isUserAuthored: !!raw.isUserAuthored,
        imagePrompt: String(raw.imagePrompt || raw.iPrompt || '').trim(),
        imageUrl: String(raw.imageUrl || raw.imageDataUrl || '').trim(),
        imageStatus: String(raw.imageStatus || '').trim(),
        imageJobId: String(raw.imageJobId || '').trim(),
        imageProxyUrl: String(raw.imageProxyUrl || '').trim(),
        imageRequestedAt: Number(raw.imageRequestedAt) || 0,
        isHot: !!raw.isHot,
        heat: Number(raw.heat) || Math.floor(Math.random() * 80) + 20,
        createdAt: Number(raw.createdAt) || now,
        comments: Array.isArray(raw.comments)
            ? raw.comments.map(normalizeForumComment).filter(comment => comment.content)
            : []
    };
}

function normalizeForum(rawForum, index = 0) {
    const now = Date.now();
    const raw = rawForum && typeof rawForum === 'object' ? rawForum : {};
    const roleIds = Array.isArray(raw.roleIds)
        ? raw.roleIds.map(id => String(id)).filter(Boolean)
        : [];

    return {
        id: String(raw.id || createForumId(`forum_${index}`)),
        name: String(raw.name || '').trim() || `论坛 ${index + 1}`,
        roleIds,
        maskId: raw.maskId ? String(raw.maskId) : '',
        worldSetting: String(raw.worldSetting || ''),
        posts: Array.isArray(raw.posts)
            ? raw.posts.map(normalizeForumPost).filter(post => post.title)
            : [],
        createdAt: Number(raw.createdAt) || now,
        updatedAt: Number(raw.updatedAt) || now
    };
}

function openForumDatabase() {
    return new Promise((resolve, reject) => {
        if (!window.indexedDB) {
            reject(new Error('当前浏览器不支持 IndexedDB'));
            return;
        }

        const request = window.indexedDB.open(FORUMS_DB_NAME, FORUMS_DB_VERSION);
        request.onupgradeneeded = () => {
            const db = request.result;
            if (!db.objectStoreNames.contains(FORUMS_STORE_NAME)) {
                db.createObjectStore(FORUMS_STORE_NAME, { keyPath: 'id' });
            }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error || new Error('打开论坛数据库失败'));
    });
}

function readForumsFromIndexedDB() {
    return openForumDatabase().then(db => new Promise((resolve, reject) => {
        const tx = db.transaction(FORUMS_STORE_NAME, 'readonly');
        const store = tx.objectStore(FORUMS_STORE_NAME);
        const request = store.get(FORUMS_RECORD_ID);
        request.onsuccess = () => resolve(request.result?.forums || []);
        request.onerror = () => reject(request.error || new Error('读取论坛数据失败'));
        tx.oncomplete = () => db.close();
        tx.onerror = () => {
            db.close();
            reject(tx.error || new Error('读取论坛数据失败'));
        };
    }));
}

function writeForumsToIndexedDB(nextForums) {
    return openForumDatabase().then(db => new Promise((resolve, reject) => {
        const tx = db.transaction(FORUMS_STORE_NAME, 'readwrite');
        tx.objectStore(FORUMS_STORE_NAME).put({
            id: FORUMS_RECORD_ID,
            forums: nextForums,
            updatedAt: Date.now()
        });
        tx.oncomplete = () => {
            db.close();
            resolve(true);
        };
        tx.onerror = () => {
            db.close();
            reject(tx.error || new Error('保存论坛数据失败'));
        };
    }));
}

async function loadForums() {
    let saved = [];
    let shouldPersist = false;
    try {
        saved = await readForumsFromIndexedDB();
    } catch (error) {
        console.warn('读取 IndexedDB 论坛数据失败，使用内存数据:', error);
    }

    const legacyRaw = localStorage.getItem(FORUMS_STORAGE_KEY);
    if ((!Array.isArray(saved) || saved.length === 0) && legacyRaw) {
        try {
            const legacyForums = JSON.parse(legacyRaw);
            if (Array.isArray(legacyForums)) {
                saved = legacyForums;
                await writeForumsToIndexedDB(legacyForums);
                shouldPersist = true;
            }
        } catch (error) {
            console.warn('迁移旧论坛数据失败:', error);
        } finally {
            localStorage.removeItem(FORUMS_STORAGE_KEY);
        }
    } else if (legacyRaw) {
        localStorage.removeItem(FORUMS_STORAGE_KEY);
    }

    forums = Array.isArray(saved)
        ? saved.map(normalizeForum).filter(forum => forum.id)
        : [];
    forums.forEach(forum => {
        if (stripGeneratedForumUserAuthors(forum)) shouldPersist = true;
        if (stripLegacyForumRepeatComments(forum)) shouldPersist = true;
    });
    if (shouldPersist) saveForums();
    forumsLoaded = true;
    return forums;
}

function saveForums() {
    writeForumsToIndexedDB(forums).catch(error => {
        console.warn('保存论坛数据到 IndexedDB 失败，当前仅保存在内存中:', error);
    });
}

function getForumById(forumId = currentForumId) {
    return forums.find(forum => String(forum.id) === String(forumId)) || null;
}

function getForumPostById(forumId = currentForumId, postId = currentForumPostId) {
    const forum = getForumById(forumId);
    if (!forum) return null;
    return forum.posts.find(post => String(post.id) === String(postId)) || null;
}

function formatForumRelativeTime(timestamp) {
    const diffMs = Math.max(0, Date.now() - (Number(timestamp) || Date.now()));
    const minute = 60 * 1000;
    const hour = 60 * minute;
    const day = 24 * hour;

    if (diffMs < minute) return '刚刚';
    if (diffMs < hour) return `${Math.floor(diffMs / minute)}分钟前`;
    if (diffMs < day) return `${Math.floor(diffMs / hour)}小时前`;
    if (diffMs < 7 * day) return `${Math.floor(diffMs / day)}天前`;

    const date = new Date(Number(timestamp) || Date.now());
    return `${date.getMonth() + 1}-${date.getDate()}`;
}

function getForumCommentCreatedAt(baseTime, index = 0, total = 1) {
    const base = Number(baseTime) || Date.now();
    const minute = 60 * 1000;
    const offsetMinutes = Math.max(2, (index + 1) * 4 + ((index * 7 + total * 3) % 5));
    const spacedFromPost = base + offsetMinutes * minute;
    const spacedBeforeNow = Date.now() - Math.max(1, (total - index) * 3 + ((index + total) % 4)) * minute;
    return Math.max(base + minute, Math.min(spacedFromPost, spacedBeforeNow));
}

function renderForumHome() {
    const list = document.getElementById('forumList');
    if (!list) return;

    if (forums.length === 0) {
        list.innerHTML = `
            <div class="forum-empty-state">
                <div class="forum-empty-icon" aria-hidden="true">
                    <svg viewBox="0 0 64 64" focusable="false">
                        <path d="M17 18h30a7 7 0 0 1 7 7v13a7 7 0 0 1-7 7H31l-10.5 6.3a2 2 0 0 1-3-1.72V45H17a7 7 0 0 1-7-7V25a7 7 0 0 1 7-7Z" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/>
                        <path d="M22 29h20M22 36h12" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round"/>
                    </svg>
                </div>
                <div class="forum-empty-title">还没有创建任何论坛</div>
                <div class="forum-empty-text">点击右上角 + 创建你的第一个论坛</div>
            </div>
        `;
        return;
    }

    list.innerHTML = forums
        .slice()
        .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
        .map(forum => {
            const roleCount = Array.isArray(forum.roleIds) ? forum.roleIds.length : 0;
            const postCount = Array.isArray(forum.posts) ? forum.posts.length : 0;
            const latestPost = forum.posts?.slice().sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))[0];
            const preview = latestPost?.title || '还没有帖子';

            return `
                <button class="forum-list-row" type="button" onclick="openForumDetail('${escapeHtml(forum.id)}')">
                    <span class="forum-list-icon" aria-hidden="true">
                        <svg viewBox="0 0 24 24" focusable="false">
                            <path d="M6.5 6.75h11a3 3 0 0 1 3 3v5.5a3 3 0 0 1-3 3H12l-4.1 2.5a.9.9 0 0 1-1.4-.77v-1.73a3 3 0 0 1-3-3v-5.5a3 3 0 0 1 3-3Z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>
                        </svg>
                    </span>
                    <span class="forum-list-main">
                        <span class="forum-list-title">${escapeHtml(forum.name)}</span>
                        <span class="forum-list-preview">${escapeHtml(preview)}</span>
                    </span>
                    <span class="forum-list-meta">${roleCount}人 · ${postCount}帖</span>
                </button>
            `;
        })
        .join('');
}

function openForumCreatePage() {
    loadWechatRoles();
    loadUserMasks();
    forumCreateState = {
        selectedRoleIds: [],
        selectedMaskId: (currentMaskId || userMasks[0]?.id || '')
    };

    hideAppView(document.getElementById('app-forum'));
    showAppView(document.getElementById('app-forum-create'));
    currentApp = 'forum-create';
    renderForumCreatePage();
}

function backToForumHome() {
    closeForumPublishSheet();
    closeForumInputModal();
    hideAppView(document.getElementById('app-forum-create'));
    hideAppView(document.getElementById('app-forum-detail'));
    hideAppView(document.getElementById('app-forum-post'));
    showAppView(document.getElementById('app-forum'));
    currentApp = 'forum';
    currentForumPostId = null;
    renderForumHome();
}

function renderForumCreatePage() {
    const nameInput = document.getElementById('forumNameInput');
    const worldInput = document.getElementById('forumWorldInput');
    const rolesEl = document.getElementById('forumCreateRoles');
    const masksEl = document.getElementById('forumCreateMasks');

    if (nameInput) nameInput.value = '';
    if (worldInput) worldInput.value = '';

    if (rolesEl) {
        const roles = Array.isArray(wechatRoles) ? wechatRoles.filter(role => role.type !== 'me') : [];
        rolesEl.innerHTML = roles.length
            ? roles.map(role => {
                const avatarConfig = getAvatarRenderConfig(role.avatar, role.nickname || '?');
                return `
                    <button class="forum-role-card forum-role-choice" type="button" data-role-id="${escapeHtml(role.id)}" onclick="toggleForumCreateRole('${escapeHtml(role.id)}')">
                        <span class="forum-choice-avatar" style="${avatarConfig.avatarStyle}">${escapeHtml(avatarConfig.avatarContent)}</span>
                        <span class="forum-choice-name">${escapeHtml(role.nickname || '未命名角色')}</span>
                        <span class="forum-choice-check" aria-hidden="true"></span>
                    </button>
                `;
            }).join('')
            : '<div class="forum-picker-empty">还没有角色，可先在微信里创建</div>';
    }

    if (masksEl) {
        masksEl.innerHTML = userMasks.map(mask => {
            const avatarConfig = getAvatarRenderConfig(mask.avatar || 'white', mask.name || '我');
            const isSelected = String(mask.id) === String(forumCreateState.selectedMaskId);
            return `
                <button class="forum-mask-card forum-mask-choice${isSelected ? ' selected' : ''}" type="button" data-mask-id="${escapeHtml(mask.id)}" onclick="selectForumCreateMask('${escapeHtml(mask.id)}')">
                    <span class="forum-choice-avatar" style="${avatarConfig.avatarStyle}">${escapeHtml(avatarConfig.avatarContent)}</span>
                    <span class="forum-choice-text">
                        <span class="forum-choice-name">${escapeHtml(mask.name || '我')}</span>
                        <span class="forum-choice-desc">${escapeHtml(getMaskDescriptionSummary(mask))}</span>
                    </span>
                    <span class="forum-choice-check" aria-hidden="true">${isSelected ? '✓' : ''}</span>
                </button>
            `;
        }).join('');
    }

    updateForumCreateSelectionUI();
    updateForumCreateButtonState();
}

function toggleForumCreateRole(roleId) {
    const normalizedId = String(roleId);
    const selected = new Set(forumCreateState.selectedRoleIds.map(String));
    if (selected.has(normalizedId)) {
        selected.delete(normalizedId);
    } else {
        selected.add(normalizedId);
    }

    forumCreateState.selectedRoleIds = Array.from(selected);
    updateForumCreateSelectionUI();
}

function selectForumCreateMask(maskId) {
    forumCreateState.selectedMaskId = String(maskId);
    updateForumCreateSelectionUI();
}

function updateForumCreateSelectionUI() {
    const selectedRoles = new Set(forumCreateState.selectedRoleIds.map(String));
    document.querySelectorAll('.forum-role-choice').forEach((row) => {
        const isSelected = selectedRoles.has(String(row.dataset.roleId || ''));
        row.classList.toggle('selected', isSelected);
        const check = row.querySelector('.forum-choice-check');
        if (check) check.textContent = isSelected ? '✓' : '';
    });

    document.querySelectorAll('.forum-mask-choice').forEach((row) => {
        const isSelected = String(row.dataset.maskId || '') === String(forumCreateState.selectedMaskId || '');
        row.classList.toggle('selected', isSelected);
        const check = row.querySelector('.forum-choice-check');
        if (check) check.textContent = isSelected ? '✓' : '';
    });
}

function updateForumCreateButtonState() {
    const name = String(document.getElementById('forumNameInput')?.value || '').trim();
    const disabled = !name || forumGenerating;
    const submitBtn = document.getElementById('forumCreateBtn');
    const topBtn = document.getElementById('forumCreateTopBtn');
    if (submitBtn) submitBtn.disabled = disabled;
    if (topBtn) topBtn.disabled = disabled;
}

async function createForumFromForm() {
    if (forumGenerating) return;

    const name = String(document.getElementById('forumNameInput')?.value || '').trim();
    const worldSetting = String(document.getElementById('forumWorldInput')?.value || '').trim();
    if (!name) {
        showToast('请输入论坛名称');
        return;
    }

    const now = Date.now();
    const fallbackMaskId = currentMaskId || userMasks[0]?.id || '';
    const forum = normalizeForum({
        id: createForumId('forum'),
        name,
        roleIds: forumCreateState.selectedRoleIds,
        maskId: forumCreateState.selectedMaskId || fallbackMaskId,
        worldSetting,
        posts: [],
        createdAt: now,
        updatedAt: now
    });

    forums.unshift(forum);
    currentForumId = forum.id;
    saveForums();

    hideAppView(document.getElementById('app-forum-create'));
    showAppView(document.getElementById('app-forum-detail'));
    currentApp = 'forum-detail';
    renderForumDetail();
    showToast('AI正在生成新帖子，请稍候...');
    await appendGeneratedForumPosts(forum.id, { hotCount: 3, latestCount: 5, reason: 'initial' });
}

function getForumRoleSnapshots(forum) {
    const ids = new Set((forum?.roleIds || []).map(String));
    return (Array.isArray(wechatRoles) ? wechatRoles : [])
        .filter(role => ids.has(String(role.id)))
        .map(role => ({
            id: String(role.id),
            name: role.nickname || role.realName || '角色',
            persona: role.systemPrompt || role.personality || '',
            avatar: role.avatar || 'white'
        }));
}

function getForumMaskSnapshot(forum) {
    const mask = userMasks.find(item => String(item.id) === String(forum?.maskId))
        || getCurrentUserMask();
    return {
        id: String(mask?.id || ''),
        name: mask?.name || '我',
        description: mask?.description || '',
        avatar: mask?.avatar || 'white'
    };
}

function buildForumGenerationSystemPrompt() {
    return `你是一个本地论坛内容编剧，只输出 JSON。
目标是生成像真实社区/论坛里会出现的帖子和评论：日常、吐槽、求助、八卦、投票、世界事件、玩笑、角色相关讨论都可以。
要求：
- 不要像 AI 总结，不要太正式，不要所有帖子都像角色自言自语。
- 可以使用 NPC/路人用户名，也可以让选择的角色发帖或评论；评论作者优先使用 NPC/路人，角色评论只偶尔出现。
- 禁止使用当前用户面具发帖或评论，除非用户手动发布；生成内容里不要出现 authorType 为 mask 的作者，也不要使用当前用户面具的名字。
- NPC/路人用户名不要和选择的角色名、当前用户面具名同名或高度相似。
- NPC/路人用户名必须像真实社区用户自己起的网名，长短混合、风格混杂。可以有中文名、外文名、下划线、点号、数字谐音、emoji、伤感爱情名、鼓励自己的名字、饭圈名、抖机灵名字、非主流葬爱风名字。例：“林七_不熬夜版”“ChrisWong”“mika.”“s1mple”“小狗也会淋雨吗”“今天也要赢”“XX的奶茶续命站”“🍋半糖去冰”“葬爱メ冷少”“浅唱丶离殇”。禁止使用“路人甲”“技术宅”“萌新求罩”“办公室老油条”“吃瓜群众”“匿名网友”这类身份标签。
- 标题自然，有论坛味，长度 8-28 个中文字符。
- 标题必须彼此明显不同，避免反复使用“有没有人也觉得”“求助”“今天这句话怎么理解”“集中楼”这类固定开头。
- 标题要贴合论坛名称、世界观、角色或本次事件，不要生成任何最近已有标题的改写版。
- 正文像帖子正文，不要只有一句空泛标题。
- 评论像真实网友互动，可短可碎；同一个帖子里的评论不要套用同一种句式。
- 如果帖子内容适合出现真实社区配图，请生成 imagePrompt；不适合配图则留空。imagePrompt 必须精准匹配帖子场景：讨论游戏 rank、队友、MVP、枪法、段位、赛季、ping、开麦/不说话时，配图应是游戏赛后结算/战绩面板/游戏房间氛围，不要生成聊天截图；讨论聊天记录、某句话、回复、私信、对话含义、暧昧暗示时，才生成聊天截图/聊天记录氛围图。所有配图不要出现真实可读文字、水印或夸张广告感。
- 输出严格 JSON，不要 Markdown，不要代码块。`;
}

function buildForumGenerationUserPrompt(forum, options = {}) {
    const roles = getForumRoleSnapshots(forum);
    const mask = getForumMaskSnapshot(forum);
    const now = new Date();
    const currentTime = now.toLocaleString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
    });
    const hotCount = Number(options.hotCount) || 0;
    const latestCount = Number(options.latestCount) || 0;
    const eventText = String(options.eventText || '').trim();
    const recentTitles = (forum.posts || [])
        .slice(-10)
        .map(post => `- ${post.title}`)
        .join('\n') || '无';

    return `论坛名称：${forum.name}
世界观补充：${forum.worldSetting || '无'}
当前时间：${currentTime}
选择的角色：
${roles.length ? roles.map(role => `- id:${role.id} 名称:${role.name} 人设:${role.persona || '无'}`).join('\n') : '无'}
当前用户面具：
- id:${mask.id} 名称:${mask.name} 描述:${mask.description || '无'}（仅作为视角信息，禁止作为生成作者）
最近已有帖子标题：
${recentTitles}
${eventText ? `本次世界事件：${eventText}` : ''}

请生成 ${hotCount} 条热门帖子、${latestCount} 条最新帖子。
标题之间要有话题、语气和句式差异：可混合吐槽、求助、投票、记录、提醒、分享、疑问、现场感小道消息。不要套同一个标题模板。
返回 JSON 格式：
{
  "posts": [
    {
      "title": "标题",
      "content": "正文",
      "authorName": "发帖人",
      "authorType": "role|npc",
      "authorId": "对应角色 id，没有则空字符串",
      "imagePrompt": "适合配图时填写用于 gpt-image-2 的真实照片风格英文提示词，不适合则空字符串",
      "isHot": true,
      "heat": 88,
      "comments": [
        {"authorName":"评论人","authorType":"role|npc","authorId":"","content":"评论内容"}
      ]
    }
  ]
}`;
}

async function requestForumAIGeneration(forum, options = {}) {
    if (!apiSettings?.apiKey) {
        throw new Error('缺少 API Key');
    }

    const { data } = await requestChatCompletionWithFallback({
        systemPrompt: buildForumGenerationSystemPrompt(),
        history: [],
        userContent: buildForumGenerationUserPrompt(forum, options),
        temperature: 0.92,
        topP: 0.96,
        frequencyPenalty: 0.35,
        presencePenalty: 0.55,
        maxTokens: 1800
    });

    const raw = data?.choices?.[0]?.message?.content || '';
    return parseForumAIPosts(raw);
}

function parseForumAIPosts(rawText) {
    const text = String(rawText || '').trim();
    if (!text) return [];

    const candidates = [
        text,
        text.replace(/^```(?:json)?/i, '').replace(/```$/i, '').trim(),
        (text.match(/\{[\s\S]*\}/) || [])[0]
    ].filter(Boolean);

    for (const candidate of candidates) {
        try {
            const parsed = JSON.parse(candidate);
            const posts = Array.isArray(parsed) ? parsed : parsed.posts;
            if (Array.isArray(posts)) {
                return posts;
            }
        } catch (error) {
            // 尝试下一个候选
        }
    }

    return [];
}

function isForumUserAuthoredItem(item) {
    return !!item?.isUserAuthored;
}

function coerceGeneratedForumAuthor(author, forum, fallbackSeed = '', preferRole = false) {
    const type = String(author?.authorType || '').trim();
    const id = author?.authorId ? String(author.authorId) : '';
    const name = String(author?.authorName || '').trim();

    if (type === 'role') {
        const role = getForumRoleSnapshots(forum).find(item => String(item.id) === String(id) || item.name === name);
        return role
            ? { authorName: role.name, authorType: 'role', authorId: role.id }
            : { authorName: sanitizeForumAuthorName(name || pickForumNpcName(fallbackSeed), fallbackSeed), authorType: 'npc', authorId: '' };
    }

    if (type === 'npc' && name) {
        return { authorName: sanitizeForumAuthorName(name, fallbackSeed), authorType: 'npc', authorId: '' };
    }

    return pickForumAuthor(forum, preferRole);
}

function stripGeneratedForumUserAuthors(forum) {
    let changed = false;
    (forum.posts || []).forEach((post, postIndex) => {
        if (post.authorType === 'mask' && !isForumUserAuthoredItem(post)) {
            Object.assign(post, coerceGeneratedForumAuthor(null, forum, post.title || postIndex, postIndex % 3 === 1));
            changed = true;
        }

        (post.comments || []).forEach((comment, commentIndex) => {
            const looksLikeInitialGeneratedComment = Math.abs((comment.createdAt || 0) - (post.createdAt || 0)) < 2 * 60 * 1000;
            if (comment.authorType === 'mask' && !isForumUserAuthoredItem(comment) && !isForumUserAuthoredItem(post) && looksLikeInitialGeneratedComment) {
                Object.assign(comment, coerceGeneratedForumAuthor(null, forum, comment.content || commentIndex, commentIndex % 2 === 1));
                changed = true;
            }
        });
    });
    return changed;
}

function stripLegacyForumRepeatComments(forum) {
    const legacyContents = new Set([
        '蹲一个后续，我感觉没这么简单。',
        '我投一票，先观察，不急。'
    ]);
    let changed = false;

    (forum.posts || []).forEach(post => {
        if (!Array.isArray(post.comments)) return;
        const nextComments = post.comments.filter(comment => {
            const shouldRemove = !comment?.isUserAuthored && legacyContents.has(String(comment?.content || '').trim());
            if (shouldRemove) changed = true;
            return !shouldRemove;
        });
        if (nextComments.length !== post.comments.length) {
            post.comments = nextComments;
        }
    });

    return changed;
}

function pickForumAuthor(forum, preferRole = false) {
    const roles = getForumRoleSnapshots(forum);
    const pool = [
        ...roles.map(role => ({ authorName: role.name, authorType: 'role', authorId: role.id })),
        ...FORUM_NPC_NAME_POOL.map(name => ({ authorName: name, authorType: 'npc', authorId: '' }))
    ];

    if (preferRole && roles.length && Math.random() < 0.65) {
        const role = roles[Math.floor(Math.random() * roles.length)];
        return { authorName: role.name, authorType: 'role', authorId: role.id };
    }

    return pool[Math.floor(Math.random() * pool.length)] || { authorName: pickForumNpcName(), authorType: 'npc', authorId: '' };
}

function normalizeForumComparableText(text = '') {
    return String(text || '')
        .toLowerCase()
        .replace(/[@#\s\r\n\t]/g, '')
        .replace(/[！!？?。,.，、:：；;~～“”"'‘’`·…（）()\[\]【】{}<>《》\-_/\\|+*=]/g, '');
}

function getForumTextSimilarity(left = '', right = '') {
    const a = normalizeForumComparableText(left);
    const b = normalizeForumComparableText(right);
    if (!a || !b) return 0;
    if (a === b) return 1;
    const shorter = a.length <= b.length ? a : b;
    const longer = a.length > b.length ? a : b;
    if (shorter.length >= 4 && longer.includes(shorter)) {
        return shorter.length / longer.length;
    }

    const aChars = new Set(Array.from(a));
    const bChars = new Set(Array.from(b));
    let overlap = 0;
    aChars.forEach(char => {
        if (bChars.has(char)) overlap += 1;
    });
    return overlap / Math.max(aChars.size, bChars.size, 1);
}

function isForumAuthorNameTooClose(name, forum, extraNames = []) {
    const key = normalizeForumComparableText(name);
    if (!key) return true;
    const reserved = [
        ...getForumRoleSnapshots(forum).map(role => role.name),
        getForumMaskSnapshot(forum).name,
        ...extraNames
    ].map(item => String(item || '').trim()).filter(Boolean);

    return reserved.some(item => {
        const other = normalizeForumComparableText(item);
        if (!other) return false;
        if (key === other) return true;
        if (Math.min(key.length, other.length) >= 2 && (key.includes(other) || other.includes(key))) return true;
        return getForumTextSimilarity(key, other) >= 0.82;
    });
}

function pickForumNpcAuthor(forum, seed = '', usedNames = []) {
    const used = new Set((usedNames || []).map(name => normalizeForumComparableText(name)).filter(Boolean));
    for (let attempts = 0; attempts < FORUM_NPC_NAME_POOL.length * 2; attempts += 1) {
        const name = pickForumNpcName(`${seed || 'npc'}_${attempts}_${Date.now()}`);
        const key = normalizeForumComparableText(name);
        if (!used.has(key) && !isForumAuthorNameTooClose(name, forum, usedNames)) {
            return { authorName: name, authorType: 'npc', authorId: '' };
        }
    }

    return {
        authorName: `夜里醒着_${Math.random().toString(36).slice(2, 6)}`,
        authorType: 'npc',
        authorId: ''
    };
}

function isForumCommentContentTooSimilar(content, existingContents = []) {
    const key = normalizeForumComparableText(content);
    if (!key) return true;
    return (existingContents || []).some(existing => {
        const other = normalizeForumComparableText(existing);
        if (!other) return false;
        if (key === other) return true;
        if (Math.min(key.length, other.length) >= 8 && (key.includes(other) || other.includes(key))) return true;
        return Math.min(key.length, other.length) >= 8 && getForumTextSimilarity(key, other) >= 0.74;
    });
}

function uniquifyForumCommentAuthors(comments, existingComments = [], forum = null) {
    const usedNames = (existingComments || []).map(comment => String(comment?.authorName || '').trim()).filter(Boolean);
    const usedNameKeys = new Set(usedNames.map(normalizeForumComparableText).filter(Boolean));
    const usedContents = (existingComments || []).map(comment => String(comment?.content || '').trim()).filter(Boolean);
    let newRoleCount = 0;

    return (comments || []).reduce((result, comment, index) => {
        if (!comment || !comment.content || isForumCommentContentTooSimilar(comment.content, usedContents)) {
            return result;
        }

        let name = String(comment.authorName || '').trim();
        const nameKey = normalizeForumComparableText(name);
        const roleAlreadyUsed = comment.authorType === 'role' && usedNameKeys.has(nameKey);
        if (comment.authorType === 'role') {
            if (!forum || roleAlreadyUsed || newRoleCount >= 1) {
                Object.assign(comment, pickForumNpcAuthor(forum, `${comment.content || index}_role`, usedNames));
                name = comment.authorName;
            } else {
                newRoleCount += 1;
            }
        }

        if (comment.authorType === 'npc') {
            if (!name || usedNameKeys.has(nameKey) || (forum && isForumAuthorNameTooClose(name, forum, usedNames))) {
                Object.assign(comment, pickForumNpcAuthor(forum, comment.content || index, usedNames));
            }
        }

        name = String(comment.authorName || '').trim();
        usedNames.push(name);
        usedNameKeys.add(normalizeForumComparableText(name));
        usedContents.push(String(comment.content || '').trim());
        result.push(comment);
        return result;
    }, []);
}

function shouldGenerateForumPostImage(post) {
    if (post?.imageUrl || ['generating', 'processing'].includes(post?.imageStatus)) return false;
    if (post?.imageStatus === 'queued') return true;
    if (Number(post?.imageRequestedAt) && Date.now() - Number(post.imageRequestedAt) < FORUM_IMAGE_CREATE_GRACE_MS) return false;
    if (post?.imageStatus === 'failed' && !String(post?.imagePrompt || '').trim()) return false;
    if (String(post?.imagePrompt || '').trim()) return true;
    const text = `${post?.title || ''}\n${post?.content || ''}`;
    return isForumGameImagePost(post)
        || isForumChatRecordImagePost(post)
        || /(照片|拍|图|图片|流星|雨|雪|云|天空|夕阳|月亮|现场|看到|晒|打卡|窗|桌|房间|街|海|山|猫|狗|花|咖啡|奶茶|饭|景|截图|证据|实拍|长这样|好看|糊了|灯|夜|窗外|厨房|阳台|地铁|车站|校园|办公室|店|便利店|餐厅|展|花园|公园|湖|河|路边|门口|桌面|屏幕|票|礼物|包裹)/i.test(text);
}

function isForumGameImagePost(post) {
    const text = `${post?.title || ''}\n${post?.content || ''}`;
    return /(游戏|rank|排位|匹配|队友|开黑|小白|MVP|爆头|枪法|段位|赛季|ping|不打信号|不说话|不开麦|语音|战绩|结算|上分|掉分|坑|职业选手|小号|地图|bug|官方快修|角色推荐|新手|冰箱了|猫粮推荐)/i.test(text);
}

function isForumChatRecordImagePost(post) {
    const text = `${post?.title || ''}\n${post?.content || ''}`;
    if (isForumGameImagePost(post)) return false;
    return /(聊天记录|聊天截图|聊天|对话|私信|消息|回复|这句话|这句|那句话|这段话|这段|怎么理解|解释一下|看不懂|什么意思|暗示|暧昧|已读|反复看|看了两遍|随口一说|发来|发了|截图给|截出来)/i.test(text);
}

function getForumImagePriority(post) {
    if (isForumGameImagePost(post)) return 3;
    if (isForumChatRecordImagePost(post)) return 2;
    if (String(post?.imagePrompt || '').trim()) return 1;
    return 0;
}

function buildForumPostImagePrompt(post, forum) {
    const title = String(post?.title || '').trim();
    const content = String(post?.content || '').trim();
    const world = String(forum?.worldSetting || '').trim();
    const aiPrompt = String(post?.imagePrompt || '').trim();
    const isGamePost = isForumGameImagePost(post);
    const isChatRecordPost = isForumChatRecordImagePost(post);
    const promptLooksLikeChatScreenshot = /chat screenshot|private conversation|messaging app|message bubbles|聊天截图|聊天记录/i.test(aiPrompt);
    if (aiPrompt && !(isGamePost && promptLooksLikeChatScreenshot)) return aiPrompt;

    if (isGamePost) {
        return [
            'Use case: realistic social community post attachment image for gpt-image-2.',
            'Create one natural image that directly matches a gaming forum post about ranked matches, teammates, MVP performance, aiming, silence on voice chat, or post-match results.',
            `Forum: ${forum?.name || 'local community'}.`,
            world ? `World/context: ${world}.` : '',
            `Post title: ${title}.`,
            `Post body: ${content}.`,
            'Visual content: a realistic desktop or phone photo of a game post-match results screen or scoreboard atmosphere, with a blurred team list, MVP/high score emphasis, ranked match UI shapes, headset or keyboard nearby if useful.',
            'Mood: frustrated but impressed, like someone just finished a competitive match with a silent teammate who carried the game.',
            'Important text rule: do not render readable words, names, numbers, UI labels, chat messages, or brand/game logos. Use blurred abstract UI blocks and icons only.',
            'Style: candid gaming setup photo or realistic game results screen photo, dim monitor glow, natural desk lighting, plausible esports/ranked-match context.',
            'Constraints: no chat app screenshot, no phone messenger UI, no watermark, no meme caption, no poster typography, no readable text.'
        ].filter(Boolean).join('\n');
    }

    if (isChatRecordPost) {
        return [
            'Use case: realistic social community post attachment image for gpt-image-2.',
            'Create a natural smartphone chat screenshot style image that visually suggests a private conversation being discussed in a forum post.',
            `Forum: ${forum?.name || 'local community'}.`,
            world ? `World/context: ${world}.` : '',
            `Post title: ${title}.`,
            `Post body: ${content}.`,
            'Visual content: a phone messaging app conversation screen photographed or captured naturally, with several rounded message bubbles and a subtle ambiguous emotional tone.',
            'Important text rule: do not render readable words, letters, UI labels, usernames, timestamps, or captions. Message bubbles may contain blurred/abstract placeholder strokes only.',
            'Style: realistic mobile screenshot/photo, soft neutral lighting, casual composition, believable phone UI, no brand logos.',
            'Constraints: no watermark, no meme caption, no poster typography, no readable text, no exaggerated advertisement style.'
        ].filter(Boolean).join('\n');
    }

    return [
        'Use case: realistic social community post image for gpt-image-2.',
        'Create one natural smartphone photo generated strictly from the forum post content.',
        `Forum: ${forum?.name || 'local community'}.`,
        world ? `World/context: ${world}.` : '',
        `Post title: ${title}.`,
        `Post body: ${content}.`,
        'The image should look like something a normal user would attach in a real mobile community: casual, plausible, slightly imperfect, not staged.',
        'Style: candid mobile photography, realistic lighting, casual composition, natural colors, phone camera perspective.',
        'Constraints: no visible text, no UI screenshot, no watermark, no logo, no meme caption, no poster typography, no exaggerated advertisement style.',
        'If the post mentions weather, sky, objects, food, room, street, event, or scenery, depict that subject directly and naturally.'
    ].filter(Boolean).join('\n');
}

async function generateForumPostImage(forumId, postId) {
    const activeKey = `${forumId}:${postId}`;
    if (activeForumImagePosts.has(activeKey)) return false;
    const forum = getForumById(forumId);
    const post = getForumPostById(forumId, postId);
    if (!forum || !post || post.imageUrl || ['generating', 'processing'].includes(post.imageStatus)) return false;
    if (post.imageStatus !== 'queued' && !shouldGenerateForumPostImage(post)) return false;

    activeForumImagePosts.add(activeKey);
    const prompt = buildForumPostImagePrompt(post, forum);
    if (!prompt) {
        activeForumImagePosts.delete(activeKey);
        return false;
    }

    post.imagePrompt = prompt;
    post.imageStatus = 'generating';
    post.imageError = '';
    post.imageRequestedAt = Date.now();
    saveForums();
    if (String(currentForumId) === String(forumId)) renderForumDetail();
    if (String(currentForumPostId) === String(postId)) renderForumPostDetail();

    try {
        const result = await requestImageGeneration(prompt, {
            size: apiSettings.imageSize || '1024x1024',
            outputFormat: 'jpeg',
            outputCompression: 65,
            allowWhenDisabled: true
        });
        const latestForum = getForumById(forumId);
        const latestPost = getForumPostById(forumId, postId);
        if (!latestForum || !latestPost) return false;

        if (result.status === 'processing') {
            latestPost.imageStatus = 'processing';
            latestPost.imageJobId = result.jobId || '';
            latestPost.imageProxyUrl = result.proxyUrl || '';
            latestPost.imagePrompt = prompt;
            latestPost.imageError = '';
            latestPost.imageRequestedAt = latestPost.imageRequestedAt || Date.now();
            saveForums();
            pollForumPostImageJob(forumId, postId, result);
            return true;
        }

        latestPost.imageUrl = result.dataUrl || '';
        latestPost.imageStatus = latestPost.imageUrl ? 'succeeded' : 'failed';
        latestPost.imageJobId = '';
        latestPost.imageProxyUrl = '';
        latestPost.imageError = latestPost.imageUrl ? '' : '图片接口未返回可用图片数据';
        latestPost.imagePrompt = result.revisedPrompt || prompt;
        latestPost.imageRequestedAt = 0;
        latestForum.updatedAt = Date.now();
        saveForums();
        if (String(currentForumId) === String(forumId)) renderForumDetail();
        if (String(currentForumPostId) === String(postId)) renderForumPostDetail();
        return !!latestPost.imageUrl;
    } catch (error) {
        post.imageStatus = 'failed';
        post.imageProxyUrl = '';
        post.imageError = error?.message || '图片生成失败';
        post.imageRequestedAt = 0;
        console.warn('论坛帖子配图生成失败:', error);
        saveForums();
        if (String(currentForumId) === String(forumId)) renderForumDetail();
        if (String(currentForumPostId) === String(postId)) renderForumPostDetail();
        return false;
    } finally {
        activeForumImagePosts.delete(activeKey);
    }
}

function pollForumPostImageJob(forumId, postId, jobInfo = {}) {
    const jobId = String(jobInfo.jobId || '').trim();
    if (!jobId) return;
    if (activeForumImagePollJobs.has(jobId)) return;
    activeForumImagePollJobs.add(jobId);

    const startedAt = Date.now();
    const finish = () => activeForumImagePollJobs.delete(jobId);
    const run = async () => {
        if (Date.now() - startedAt > FORUM_IMAGE_MAX_POLL_DURATION_MS) {
            const post = getForumPostById(forumId, postId);
            if (post) {
                post.imageStatus = 'failed';
                post.imageJobId = '';
                post.imageRequestedAt = 0;
                post.imageError = '图片生成等待超时，请手动重试，避免重复扣费';
                saveForums();
            }
            finish();
            return;
        }

        try {
            const response = await fetch(resolveImageGenerationStatusUrl(jobId, jobInfo.proxyUrl), { method: 'GET' });
            const data = await response.json().catch(() => null);
            if (!response.ok) {
                throw new Error(extractErrorMessage(data, `图片任务查询失败（HTTP ${response.status}）`));
            }
            const status = String(data?.status || '').trim().toLowerCase();

            if (status === 'not_found') {
                const post = getForumPostById(forumId, postId);
                if (post) {
                    post.imageStatus = 'failed';
                    post.imageJobId = '';
                    post.imageProxyUrl = '';
                    post.imageRequestedAt = 0;
                    post.imageError = '图片任务已丢失，请手动重试，避免重复扣费';
                    saveForums();
                    if (String(currentForumId) === String(forumId)) renderForumDetail();
                    if (String(currentForumPostId) === String(postId)) renderForumPostDetail();
                }
                finish();
                return;
            }

            if (status === 'succeeded') {
                const resultData = data?.result || data;
                const imageUrl = extractImageDataUrlFromResponse(resultData);
                const forum = getForumById(forumId);
                const post = getForumPostById(forumId, postId);
                if (forum && post) {
                    post.imageUrl = imageUrl;
                    post.imageStatus = imageUrl ? 'succeeded' : 'failed';
                    post.imageJobId = '';
                    post.imageProxyUrl = '';
                    post.imageError = imageUrl ? '' : '图片接口未返回可用图片数据';
                    post.imagePrompt = String(resultData?.data?.[0]?.revised_prompt || post.imagePrompt || '').trim();
                    forum.updatedAt = Date.now();
                    saveForums();
                    if (String(currentForumId) === String(forumId)) renderForumDetail();
                    if (String(currentForumPostId) === String(postId)) renderForumPostDetail();
                }
                finish();
                return;
            }

            if (status === 'failed') {
                const post = getForumPostById(forumId, postId);
                if (post) {
                    post.imageStatus = 'failed';
                    post.imageJobId = '';
                    post.imageProxyUrl = '';
                    post.imageError = extractErrorMessage(data, '图片生成失败');
                    saveForums();
                }
                finish();
                return;
            }
        } catch (error) {
            const post = getForumPostById(forumId, postId);
            if (post) {
                post.imageError = error?.message || '图片任务查询失败，正在重试';
                saveForums();
                if (String(currentForumId) === String(forumId)) renderForumDetail();
                if (String(currentForumPostId) === String(postId)) renderForumPostDetail();
            }
        }

        setTimeout(run, Math.max(1500, Number(jobInfo.pollAfterMs || 3000)));
    };

    setTimeout(run, Math.max(1200, Number(jobInfo.pollAfterMs || 3000)));
}

function resumePendingForumImageJobs(forumId = currentForumId) {
    const forum = getForumById(forumId);
    if (!forum) return;

    let changed = false;
    const now = Date.now();
    (forum.posts || []).forEach(post => {
        const status = String(post.imageStatus || '').toLowerCase();
        const jobId = String(post.imageJobId || '').trim();
        if ((status === 'processing' || status === 'generating') && jobId) {
            post.imageStatus = 'processing';
            pollForumPostImageJob(forum.id, post.id, { jobId, pollAfterMs: 3000, proxyUrl: post.imageProxyUrl || '' });
            changed = true;
        } else if (status === 'generating' && !jobId) {
            const requestedAt = Number(post.imageRequestedAt) || 0;
            if (requestedAt && now - requestedAt > FORUM_IMAGE_CREATE_GRACE_MS) {
                post.imageStatus = 'failed';
                post.imageRequestedAt = 0;
                post.imageError = '图片任务创建超时，请手动重试';
            } else {
                post.imageError = '图片任务创建中，请勿重复刷新';
            }
            changed = true;
        } else if (status === 'queued') {
            post.imageRequestedAt = 0;
            changed = true;
        }
    });

    if (changed) saveForums();
}

function generateForumImagesForPosts(forumId, posts = []) {
    const batchKey = String(forumId || '');
    if (!batchKey) return;
    const batchSize = Math.max(1, posts.length || 1);
    const maxImages = Math.min(FORUM_IMAGE_MAX_PER_BATCH, Math.max(1, Math.ceil(batchSize * 0.4)));
    const candidates = maxImages > 0
        ? posts
            .filter(shouldGenerateForumPostImage)
            .filter(post => post.imageStatus !== 'failed')
            .sort((a, b) => getForumImagePriority(b) - getForumImagePriority(a))
            .slice(0, maxImages)
        : [];

    if (!candidates.length) return;

    if (activeForumImageBatches.has(batchKey)) {
        candidates.forEach(post => {
            if (!post.imagePrompt) post.imagePrompt = buildForumPostImagePrompt(post, getForumById(forumId));
            if (!post.imageStatus) post.imageStatus = 'queued';
            post.imageError = '';
        });
        saveForums();
        if (String(currentForumId) === String(forumId)) renderForumDetail();
        return;
    }

    activeForumImageBatches.add(batchKey);

    candidates.forEach(post => {
        const forum = getForumById(forumId);
        if (!forum) return;
        post.imagePrompt = buildForumPostImagePrompt(post, forum);
        post.imageStatus = 'queued';
        post.imageError = '';
    });
    saveForums();
    if (String(currentForumId) === String(forumId)) renderForumDetail();

    Promise.allSettled(candidates.map(post => generateForumPostImage(forumId, post.id)))
        .finally(() => {
            activeForumImageBatches.delete(batchKey);
            scheduleForumDetailImageWork(forumId, 500);
        });
}

function ensureForumDetailImages(forum) {
    if (!forum?.id) return;
    const posts = (forum.posts || [])
        .slice()
        .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    generateForumImagesForPosts(forum.id, posts);
}

function scheduleForumDetailImageWork(forumId = currentForumId, delayMs = 350) {
    const id = String(forumId || '').trim();
    if (!id) return;
    const existing = scheduledForumImageEnsureTimers.get(id);
    if (existing) clearTimeout(existing);

    const timer = setTimeout(() => {
        scheduledForumImageEnsureTimers.delete(id);
        const forum = getForumById(id);
        if (!forum) return;
        resumePendingForumImageJobs(id);
        ensureForumDetailImages(forum);
    }, Math.max(0, Number(delayMs) || 0));

    scheduledForumImageEnsureTimers.set(id, timer);
}

function pickForumFallbackItem(items = [], seed = '', offset = 0) {
    if (!items.length) return '';
    const source = String(seed || `${Date.now()}_${Math.random()}`);
    let hash = 0;
    for (const char of source) {
        hash = ((hash << 5) - hash) + char.codePointAt(0);
        hash |= 0;
    }
    return items[Math.abs(hash + offset) % items.length];
}

function getForumFallbackTopicHints(forum, roles = []) {
    const forumName = String(forum?.name || '').trim();
    const worldSetting = String(forum?.worldSetting || '').trim();
    const roleNames = roles.map(role => role.name).filter(Boolean);
    const hints = [
        forumName,
        ...roleNames,
        ...worldSetting
            .split(/[，。！？、,.!?\s\r\n]+/)
            .map(item => item.trim())
            .filter(item => item.length >= 2 && item.length <= 14)
            .slice(0, 8)
    ].filter(Boolean);

    return hints.length ? Array.from(new Set(hints)) : ['这个论坛', '首页', '今晚'];
}

function buildFallbackForumTemplatePool(forum, options = {}) {
    const eventText = String(options.eventText || '').trim();
    const roles = getForumRoleSnapshots(forum);
    const roleName = roles[0]?.name || '某位朋友';
    const hints = getForumFallbackTopicHints(forum, roles);
    const mainHint = pickForumFallbackItem(hints, `${forum?.id || forum?.name}_main_${eventText}`);
    const secondHint = pickForumFallbackItem(hints, `${forum?.id || forum?.name}_second_${eventText}`, 3);
    const shortEvent = eventText.slice(0, 16);

    if (eventText) {
        return [
            [`刚刚那件事有人看懂了吗`, `我只看到大家突然都在刷屏，${eventText}。有没有前排能捋一下时间线？`],
            [`投票：这波算大事还是虚惊`, `先别急着站队，我想看看大家怎么判断。反正我现在有点睡不着。`],
            [`关于${shortEvent}，补一个细节`, `不是洗也不是黑，我只是想说现场/群里有人提到过一个小细节，可能会影响判断。`],
            [`今晚论坛是不是要炸`, `刷了十分钟已经看到三个版本了，谁来发个靠谱汇总，不要营销号那种。`],
            [`${mainHint}这边有新说法了`, `看到有人把${eventText}和${mainHint}联系到一起，我还没判断真假，先开楼等补充。`],
            [`先别急着转发${shortEvent}`, `目前我看到的版本互相打架，建议大家把来源和时间都写清楚。`],
            [`有人存到第一版截图吗`, `后面越传越离谱，我想看最开始那条到底是怎么说的。`],
            [`${secondHint}相关人士冒泡了吗`, `这事如果和${secondHint}有关，评论区应该很快会有人出来对线。`],
            [`这次事件最怪的点不是表面那个`, `大家都在聊${eventText}，但我更在意中间突然消失的那段信息。`],
            [`半夜被这个瓜吵醒了`, `本来都准备睡了，结果首页全是同一件事。求一个不带情绪的版本。`],
            [`有没有人整理一下关键词`, `新来的完全看不懂，名字、地点、时间点都混在一起了。`],
            [`这楼只收可靠补充`, `传闻可以聊，但麻烦标清楚来源，不然明早又要翻车。`]
        ];
    }

    return [
        [`${mainHint}今天有点不对劲`, `不是说一定有事，就是首页气氛突然变了，连平时潜水的人都出来说话。`],
        [`突然想问大家都怎么称呼${secondHint}`, `我发现同一个东西在不同楼里叫法完全不一样，每次搜帖都很痛苦。`],
        [`${roleName}刚才那句到底什么意思`, `不是挑事，我真的反复看了两遍，感觉像随口一说，又像在暗示什么。`],
        [`首页怎么突然全在聊${mainHint}`, `我错过了哪一集？刚打开论坛还以为进错版块了。`],
        [`有没有适合新人的补课楼`, `世界观和人际关系越堆越厚了，新人现在进来真的会迷路。`],
        [`小声说个${secondHint}相关观察`, `不一定对，但我最近几次看到类似情况，后续走向都差不多。`],
        [`今天的离谱但合理瞬间`, `有些事单看很怪，放进这个论坛又莫名说得通。大家也来交作业。`],
        [`求一个不吵架的讨论楼`, `想认真聊聊，不想三楼以内就开始扣帽子。先声明我没有站队。`],
        [`有没有人也在偷偷记时间线`, `我现在已经养成习惯了，看到关键发言先记一下，不然后面根本对不上。`],
        [`${mainHint}是不是被过度解读了`, `感觉大家越聊越玄，我反而开始怀疑最简单的解释才是真的。`],
        [`来点日常，别让首页太紧绷`, `最近大事太多了，想听听大家今天遇到的小事，越普通越好。`],
        [`刚翻到一个旧帖有点后劲`, `以前看觉得没什么，现在回头看，里面有几句话突然变得很微妙。`],
        [`你们会相信论坛里的第六感吗`, `有时候没有证据，但一群人同时觉得不对劲，这本身也挺值得记录。`],
        [`有没有人推荐今晚听的歌`, `不想继续刷新首页了，求一点适合边整理时间线边听的东西。`],
        [`${secondHint}相关的梗是不是变味了`, `一开始只是玩笑，最近感觉大家用的时候情绪越来越重。`],
        [`开个无奖竞猜：下一步会怎样`, `理性预测一下，不许事后编辑装预言家。`],
        [`刚刚楼下有人叫好大声`, `不知道是不是和论坛里的事有关，但我已经开始条件反射想开帖问了。`],
        [`突然好奇大家手机壁纸用的什么`, `刷帖刷累了，想换个心情。有没有不刺眼、看久了也舒服的图。`],
        [`你们觉得熬夜和早起哪个更伤身体`, `最近作息乱到离谱，想听听真实体验，不要养生号那种复制粘贴。`],
        [`有没有人推荐个好用的白噪音 app`, `夜里太安静反而睡不着，雨声和风扇声都可以，别太像广告。`],
        [`这个论坛最像生活区的一刻`, `明明一开始大家都在聊设定，结果现在连楼道灯坏了都有人来开帖。`],
        [`求助，设定冲突到底按哪版算`, `前面说过一版，后来又冒出来新说法。你们一般按最新的算，还是按最有戏剧性的算？`],
        [`${roleName}的沉默比发言还吓人`, `他不说话的时候，评论区反而更会脑补。有没有人懂这种感觉。`],
        [`今天首页哪一楼最好笑`, `来投票，我先提名那个把严肃讨论聊成夜宵推荐的楼。`]
    ];
}

function createFallbackForumPosts(forum, options = {}) {
    const hotCount = Number(options.hotCount) || 0;
    const latestCount = Number(options.latestCount) || 0;
    const total = Math.max(1, hotCount + latestCount);
    const eventText = String(options.eventText || '').trim();
    const templates = buildFallbackForumTemplatePool(forum, options);
    const commentTemplates = eventText
        ? [
            '先蹲个可靠版本，别又传歪了。',
            '这楼信息量比我想的多。',
            '有人能按时间线排一下吗？我有点跟不上。',
            '先别急着盖章，等补充。',
            '我只想知道最早是谁说的。',
            '这个细节要是真的就很微妙。',
            '热闹归热闹，证据还是要看。',
            '看了三遍，我先保持怀疑。'
        ]
        : [
            '这题我也想知道答案。',
            '首页终于有点闲聊味了。',
            '说得太像我会点进来的楼。',
            '先收藏，晚点回来翻评论。',
            '这个角度还挺新鲜。',
            '别说，确实有点意思。',
            '我刚准备划走又被标题拉回来了。',
            '楼里要是有人补图就更完整了。',
            '感觉可以开个长期楼。',
            '我站一会儿中间派。'
        ];

    const start = Math.floor(Math.random() * templates.length);
    return Array.from({ length: total }).map((_, index) => {
        const tpl = templates[(index * 5 + start) % templates.length];
        const author = pickForumAuthor(forum, index % 3 === 1);
        const createdAt = Date.now() - index * 6 * 60 * 1000;
        const isHot = index < hotCount;
        const usedCommentAuthors = [];
        const usedCommentContents = [];
        const comments = Array.from({ length: 2 }).map((_, commentIndex) => {
            const start = (index * 3 + commentIndex * 5 + Math.floor(Math.random() * commentTemplates.length)) % commentTemplates.length;
            const content = commentTemplates.map((_, offset) => commentTemplates[(start + offset) % commentTemplates.length])
                .find(item => !isForumCommentContentTooSimilar(item, usedCommentContents))
                || commentTemplates[start];
            const npcAuthor = pickForumNpcAuthor(forum, `${tpl[0]}_${content}_${commentIndex}`, usedCommentAuthors);
            usedCommentAuthors.push(npcAuthor.authorName);
            usedCommentContents.push(content);
            return {
                ...npcAuthor,
                content,
                id: createForumId('comment'),
                createdAt: getForumCommentCreatedAt(createdAt, commentIndex, 2)
            };
        });

        return {
            id: createForumId('post'),
            title: tpl[0],
            content: tpl[1],
            ...author,
            isHot,
            heat: isHot ? 90 - index * 8 : Math.floor(Math.random() * 50) + 12,
            createdAt,
            comments
        };
    });
}

function normalizeGeneratedForumPosts(rawPosts, forum, options = {}) {
    const now = Date.now();
    const hotCount = Number(options.hotCount) || 0;
    return (Array.isArray(rawPosts) ? rawPosts : [])
        .map((raw, index) => {
            const author = String(raw?.authorName || '').trim()
                ? coerceGeneratedForumAuthor(raw, forum, raw?.title || index, index % 2 === 0)
                : pickForumAuthor(forum, index % 2 === 0);
            return normalizeForumPost({
                id: createForumId('post'),
                title: raw?.title,
                content: raw?.content,
                ...author,
                imagePrompt: raw?.imagePrompt || raw?.iPrompt,
                imageUrl: raw?.imageUrl || raw?.imageDataUrl,
                imageStatus: raw?.imageStatus,
                imageJobId: raw?.imageJobId,
                isHot: raw?.isHot !== undefined ? !!raw.isHot : index < hotCount,
                heat: Number(raw?.heat) || (index < hotCount ? 88 - index * 7 : Math.floor(Math.random() * 60) + 10),
                createdAt: now - index * 3 * 60 * 1000,
                comments: Array.isArray(raw?.comments)
                    ? uniquifyForumCommentAuthors(raw.comments.map((comment, commentIndex) => ({
                        id: createForumId('comment'),
                        content: comment?.content,
                        ...coerceGeneratedForumAuthor(comment, forum, comment?.content || commentIndex, commentIndex % 2 === 1),
                        createdAt: getForumCommentCreatedAt(now - index * 3 * 60 * 1000, commentIndex, raw.comments.length)
                    })).filter(comment => comment.content), [], forum).slice(0, 3)
                    : []
            });
        })
        .filter(post => post.title && post.content);
}

function normalizeForumTitleKey(title = '') {
    return String(title || '')
        .trim()
        .replace(/\s+/g, '')
        .replace(/[！!？?。,.，、:：；;~～“”"']/g, '')
        .toLowerCase();
}

function isForumTitleTooSimilar(title, existingTitles = []) {
    const key = normalizeForumTitleKey(title);
    if (!key) return true;
    return (existingTitles || []).some(existing => {
        const other = normalizeForumTitleKey(existing);
        if (!other) return false;
        if (key === other) return true;
        if (Math.min(key.length, other.length) >= 8 && (key.includes(other) || other.includes(key))) return true;
        return Math.min(key.length, other.length) >= 8 && getForumTextSimilarity(key, other) >= 0.72;
    });
}

function dedupeForumPosts(newPosts = [], existingPosts = []) {
    const seenTitles = (existingPosts || []).map(post => String(post?.title || '').trim()).filter(Boolean);
    const seen = new Set(seenTitles.map(normalizeForumTitleKey).filter(Boolean));
    return (newPosts || []).filter(post => {
        const key = normalizeForumTitleKey(post?.title);
        if (!key || seen.has(key) || isForumTitleTooSimilar(post?.title, seenTitles)) return false;
        seen.add(key);
        seenTitles.push(String(post?.title || '').trim());
        return true;
    });
}

async function appendGeneratedForumPosts(forumId = currentForumId, options = {}) {
    const forum = getForumById(forumId);
    if (!forum) return;

    forumGenerating = true;
    updateForumCreateButtonState();
    updateForumRefreshButtonState(true);

    try {
        let rawPosts = [];
        try {
            rawPosts = await requestForumAIGeneration(forum, options);
        } catch (error) {
            console.warn('论坛 AI 生成失败，使用本地兜底:', error);
        }

        let posts = dedupeForumPosts(normalizeGeneratedForumPosts(rawPosts, forum, options), forum.posts || []);
        const expectedCount = (Number(options.hotCount) || 0) + (Number(options.latestCount) || 0);
        if (posts.length < Math.max(1, expectedCount)) {
            posts = [
                ...posts,
                ...createFallbackForumPosts(forum, {
                    ...options,
                    hotCount: Math.max(0, (Number(options.hotCount) || 0) - posts.filter(post => post.isHot).length),
                    latestCount: Math.max(0, expectedCount - posts.length - Math.max(0, (Number(options.hotCount) || 0) - posts.filter(post => post.isHot).length))
                })
            ];
        }
        posts = dedupeForumPosts(posts, forum.posts || []);
        if (posts.length < Math.max(1, expectedCount)) {
            console.warn('论坛生成结果去重后数量不足，已避免重复内容。');
        }

        forum.posts = [...posts, ...(Array.isArray(forum.posts) ? forum.posts : [])].slice(0, 120);
        forum.updatedAt = Date.now();
        saveForums();
        renderForumDetail();
        generateForumImagesForPosts(forum.id, posts);
    } finally {
        forumGenerating = false;
        updateForumCreateButtonState();
        updateForumRefreshButtonState(false);
    }
}

function updateForumRefreshButtonState(isLoading = forumGenerating) {
    const btn = document.getElementById('forumRefreshBtn');
    if (!btn) return;
    btn.disabled = !!isLoading;
    btn.classList.toggle('loading', !!isLoading);
}

function openForumDetail(forumId) {
    currentForumId = String(forumId || '');
    currentForumPostId = null;
    hideAppView(document.getElementById('app-forum'));
    hideAppView(document.getElementById('app-forum-post'));
    showAppView(document.getElementById('app-forum-detail'));
    currentApp = 'forum-detail';
    renderForumDetail();
}

function renderForumDetail() {
    const forum = getForumById();
    const titleEl = document.getElementById('forumDetailTitle');
    const feed = document.getElementById('forumPostsFeed');
    if (!forum || !feed) return;
    if (stripGeneratedForumUserAuthors(forum)) saveForums();

    if (titleEl) titleEl.textContent = forum.name;

    const hotPosts = (forum.posts || [])
        .filter(post => post.isHot)
        .sort((a, b) => (b.heat || 0) - (a.heat || 0))
        .slice(0, 20);
    const hotPostIds = new Set(hotPosts.map(post => String(post.id)));
    const latestPosts = (forum.posts || [])
        .filter(post => !hotPostIds.has(String(post.id)))
        .slice()
        .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
        .slice(0, 50);

    feed.innerHTML = `
        ${renderForumPostSection('热门帖子', hotPosts, true)}
        ${renderForumPostSection('最新帖子', latestPosts, false)}
    `;
    updateForumRefreshButtonState();
    scheduleForumDetailImageWork(forum.id);
}

function renderForumPostSection(title, posts, hotSection = false) {
    return `
        <section class="forum-post-section">
            <div class="forum-section-header">${escapeHtml(title)}</div>
            <div class="forum-post-list">
                ${posts.length
                    ? posts.map((post, index) => renderForumPostRow(post, hotSection && index < 3)).join('')
                    : '<div class="forum-section-empty">这里暂时还没有帖子</div>'}
            </div>
        </section>
    `;
}

function renderForumPostRow(post, showHotTag = false) {
    const commentCount = Array.isArray(post.comments) ? post.comments.length : 0;
    const hotTag = showHotTag
        ? '<span class="forum-hot-tag">HOT</span>'
        : '';
    const hasPendingImage = ['generating', 'processing'].includes(post.imageStatus);
    const hasQueuedImage = post.imageStatus === 'queued';
    const hasFailedImage = post.imageStatus === 'failed' && post.imagePrompt;
    const imagePreview = post.imageUrl
        ? `<span class="forum-post-thumb" style="background-image: url('${escapeHtml(post.imageUrl)}')"></span>`
        : hasPendingImage
            ? '<span class="forum-post-thumb forum-post-thumb-loading"><span>加载中</span></span>'
            : hasQueuedImage
                ? '<span class="forum-post-thumb forum-post-thumb-loading"><span>排队中</span></span>'
                : hasFailedImage
                ? '<span class="forum-post-thumb forum-post-thumb-failed"><span>失败</span></span>'
                : '';
    const meta = [
        post.authorName || '匿名网友',
        formatForumRelativeTime(post.createdAt),
        `${commentCount}评`,
        `${Number(post.heat) || 0}热`
    ].filter(Boolean).join(' · ');

    return `
        <button class="forum-post-row" type="button" onclick="openForumPostDetail('${escapeHtml(post.id)}')">
            <span class="forum-post-row-main">
                <span class="forum-post-row-text">
                    <span class="forum-post-title-line">${hotTag}<span class="forum-post-title">${escapeHtml(post.title)}</span></span>
                    <span class="forum-post-meta">${escapeHtml(meta)}</span>
                </span>
                ${imagePreview}
            </span>
        </button>
    `;
}

async function refreshForumPosts() {
    if (forumGenerating) return;
    const forum = getForumById();
    if (!forum) return;
    showToast('AI正在生成新帖子，请稍候...');
    await appendGeneratedForumPosts(forum.id, { hotCount: 1, latestCount: 4, reason: 'refresh' });
}

function deleteCurrentForum() {
    const forum = getForumById();
    if (!forum) return;
    if (!confirm(`确定删除论坛"${forum.name}"吗？`)) return;

    forums = forums.filter(item => String(item.id) !== String(forum.id));
    saveForums();
    currentForumId = null;
    currentForumPostId = null;
    showToast('论坛已删除');
    backToForumHome();
}

function showForumMembers() {
    const forum = getForumById();
    if (!forum) return;
    const roles = getForumRoleSnapshots(forum).map(role => role.name).join('、') || '暂无角色';
    const mask = getForumMaskSnapshot(forum);
    alert(`角色：${roles}\n你的身份：${mask.name}`);
}

function openForumPublishSheet() {
    const existing = document.getElementById('forumPublishSheet');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.className = 'forum-sheet-overlay active';
    overlay.id = 'forumPublishSheet';
    overlay.innerHTML = `
        <div class="forum-publish-sheet">
            <div class="forum-sheet-grabber"></div>
            <div class="forum-sheet-title">选择发布类型</div>
            <button class="forum-sheet-option" type="button" onclick="closeForumPublishSheet(); openForumManualPostModal();">
                <span class="forum-sheet-option-icon" aria-hidden="true">
                    <svg viewBox="0 0 24 24"><path d="M5 6.5h14M5 12h14M5 17.5h8" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/></svg>
                </span>
                <span>
                    <strong>普通发帖</strong>
                    <small>发布日常讨论、分享内容</small>
                </span>
            </button>
            <button class="forum-sheet-option" type="button" onclick="closeForumPublishSheet(); openForumEventModal();">
                <span class="forum-sheet-option-icon" aria-hidden="true">
                    <svg viewBox="0 0 24 24"><path d="M12 4.5v4M12 15.5v4M4.5 12h4M15.5 12h4M7.4 7.4l2.8 2.8M13.8 13.8l2.8 2.8M16.6 7.4l-2.8 2.8M10.2 13.8l-2.8 2.8" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/></svg>
                </span>
                <span>
                    <strong>搞个大新闻</strong>
                    <small>创建世界事件，AI生成相关帖子</small>
                </span>
            </button>
            <button class="forum-sheet-cancel" type="button" onclick="closeForumPublishSheet()">取消</button>
        </div>
    `;
    overlay.addEventListener('click', (event) => {
        if (event.target === overlay) closeForumPublishSheet();
    });
    document.body.appendChild(overlay);
}

function closeForumPublishSheet() {
    const sheet = document.getElementById('forumPublishSheet');
    if (sheet) sheet.remove();
}

function openForumInputModal({ title, fields, submitText, onSubmit }) {
    const existing = document.getElementById('forumInputModal');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.className = 'forum-input-overlay active';
    overlay.id = 'forumInputModal';
    overlay.innerHTML = `
        <div class="forum-input-modal">
            <div class="forum-input-title">${escapeHtml(title)}</div>
            <div class="forum-input-fields">
                ${fields.map(field => `
                    <label class="forum-field">
                        <span>${escapeHtml(field.label)}</span>
                        ${field.type === 'textarea'
                            ? `<textarea id="${escapeHtml(field.id)}" rows="${field.rows || 5}" placeholder="${escapeHtml(field.placeholder || '')}"></textarea>`
                            : `<input id="${escapeHtml(field.id)}" type="text" placeholder="${escapeHtml(field.placeholder || '')}">`}
                    </label>
                `).join('')}
            </div>
            <div class="forum-input-actions">
                <button type="button" onclick="closeForumInputModal()">取消</button>
                <button type="button" class="primary" id="forumInputSubmit">${escapeHtml(submitText || '确定')}</button>
            </div>
        </div>
    `;
    overlay.addEventListener('click', (event) => {
        if (event.target === overlay) closeForumInputModal();
    });
    document.body.appendChild(overlay);

    const submit = document.getElementById('forumInputSubmit');
    if (submit) {
        submit.onclick = () => {
            const values = {};
            fields.forEach(field => {
                values[field.id] = String(document.getElementById(field.id)?.value || '').trim();
            });
            onSubmit(values);
        };
    }
}

function closeForumInputModal() {
    const modal = document.getElementById('forumInputModal');
    if (modal) modal.remove();
}

function openForumManualPostModal() {
    openForumInputModal({
        title: '普通发帖',
        submitText: '发布',
        fields: [
            { id: 'manualPostTitle', label: '标题', placeholder: '写个自然点的标题' },
            { id: 'manualPostContent', label: '内容', type: 'textarea', rows: 6, placeholder: '说点什么...' }
        ],
        onSubmit: ({ manualPostTitle, manualPostContent }) => {
            publishForumManualPost(manualPostTitle, manualPostContent);
        }
    });
}

function publishForumManualPost(title, content) {
    const forum = getForumById();
    if (!forum) return;
    const normalizedTitle = String(title || '').trim();
    const normalizedContent = String(content || '').trim();
    if (!normalizedTitle || !normalizedContent) {
        showToast('请填写标题和内容');
        return;
    }

    const mask = getForumMaskSnapshot(forum);
    const post = normalizeForumPost({
        id: createForumId('post'),
        title: normalizedTitle,
        content: normalizedContent,
        authorName: mask.name,
        authorType: 'mask',
        authorId: mask.id,
        isUserAuthored: true,
        isHot: false,
        heat: 1,
        createdAt: Date.now(),
        comments: []
    });

    forum.posts.unshift(post);
    forum.updatedAt = Date.now();
    currentForumPostId = post.id;
    saveForums();
    closeForumInputModal();
    renderForumDetail();
    openForumPostDetail(post.id);
}

function openForumEventModal() {
    openForumInputModal({
        title: '搞个大新闻',
        submitText: '生成',
        fields: [
            { id: 'forumEventText', label: '事件描述', type: 'textarea', rows: 5, placeholder: '描述这次世界事件...' }
        ],
        onSubmit: async ({ forumEventText }) => {
            await generateForumEventPosts(forumEventText);
        }
    });
}

async function generateForumEventPosts(eventText) {
    const forum = getForumById();
    const normalizedEvent = String(eventText || '').trim();
    if (!forum || !normalizedEvent) {
        showToast('请输入事件描述');
        return;
    }

    closeForumInputModal();
    showToast('AI正在生成新帖子，请稍候...');
    await appendGeneratedForumPosts(forum.id, {
        hotCount: 2,
        latestCount: 4,
        reason: 'event',
        eventText: normalizedEvent
    });
}

function openForumPostDetail(postId) {
    const post = getForumPostById(currentForumId, postId);
    if (!post) return;

    currentForumPostId = String(postId);
    pendingForumReplyTarget = null;
    hideAppView(document.getElementById('app-forum-detail'));
    showAppView(document.getElementById('app-forum-post'));
    currentApp = 'forum-post';
    renderForumPostDetail();
}

function backToForumDetail() {
    closeForumPublishSheet();
    closeForumInputModal();
    hideAppView(document.getElementById('app-forum-post'));
    showAppView(document.getElementById('app-forum-detail'));
    currentApp = 'forum-detail';
    renderForumDetail();
}

function getForumAuthorAvatarConfig(forum, authorType, authorId, authorName) {
    if (authorType === 'role') {
        const role = (wechatRoles || []).find(item => String(item.id) === String(authorId));
        return getAvatarRenderConfig(role?.avatar || 'white', role?.nickname || authorName || '?');
    }

    if (authorType === 'mask') {
        const mask = userMasks.find(item => String(item.id) === String(authorId))
            || getForumMaskSnapshot(forum);
        return getAvatarRenderConfig(mask?.avatar || 'white', mask?.name || authorName || '我');
    }

    return getAvatarRenderConfig('white', authorName || '网友');
}

function renderForumPostImage(post) {
    if (post?.imageUrl) {
        return `
            <figure class="forum-post-image-wrap">
                <img class="forum-post-image" src="${escapeHtml(post.imageUrl)}" alt="" loading="lazy">
            </figure>
        `;
    }

    if (post?.imageStatus === 'queued') {
        return '<div class="forum-post-image-pending">图片排队中...</div>';
    }

    if (['generating', 'processing'].includes(post?.imageStatus)) {
        const detail = post?.imageError ? ` · ${escapeHtml(post.imageError)}` : '';
        return `<div class="forum-post-image-pending">图片加载中...${detail}</div>`;
    }

    if (post?.imageStatus === 'failed' && post?.imagePrompt) {
        return `<button class="forum-post-image-pending forum-post-image-failed" type="button" onclick="retryForumPostImage('${escapeHtml(post.id || '')}')">图片未返回，点此重试${post.imageError ? `：${escapeHtml(post.imageError)}` : ''}</button>`;
    }

    return '';
}

function retryForumPostImage(postId = currentForumPostId) {
    const forum = getForumById();
    const post = getForumPostById(currentForumId, postId);
    if (!forum || !post) return;
    if (post.imageUrl || ['generating', 'processing'].includes(post.imageStatus)) return;

    post.imageStatus = '';
    post.imageJobId = '';
    post.imageProxyUrl = '';
    post.imagePrompt = '';
    post.imageRequestedAt = 0;
    post.imageError = '';
    saveForums();
    renderForumPostDetail();
    generateForumPostImage(forum.id, post.id);
}

function renderForumPostDetail() {
    const forum = getForumById();
    const post = getForumPostById();
    const detail = document.getElementById('forumPostDetail');
    const commentsList = document.getElementById('forumCommentsList');
    const input = document.getElementById('forumCommentInput');
    if (!forum || !post || !detail || !commentsList) return;
    if (stripGeneratedForumUserAuthors(forum)) saveForums();

    if (pendingForumReplyTarget && !(post.comments || []).some(comment => String(comment.id) === String(pendingForumReplyTarget.id))) {
        pendingForumReplyTarget = null;
    }

    const avatarConfig = getForumAuthorAvatarConfig(forum, post.authorType, post.authorId, post.authorName);
    detail.innerHTML = `
        <div class="forum-post-detail-head">
            <h1>${escapeHtml(post.title)}</h1>
            <div class="forum-post-author">
                <span class="forum-comment-avatar" style="${avatarConfig.avatarStyle}">${escapeHtml(avatarConfig.avatarContent)}</span>
                <span>
                    <strong>${escapeHtml(post.authorName || '匿名网友')}</strong>
                    <small>${escapeHtml(formatForumRelativeTime(post.createdAt))}</small>
                </span>
            </div>
        </div>
        <div class="forum-post-body">${escapeHtml(post.content || '')}</div>
        ${renderForumPostImage(post)}
    `;

    commentsList.innerHTML = (post.comments || []).length
        ? post.comments
            .slice()
            .sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0))
            .map((comment, index) => renderForumCommentRow(forum, comment, index))
            .join('')
        : '<div class="forum-comments-empty">还没有评论，来占个前排</div>';

    if (input && !pendingForumReplyTarget) {
        input.value = '';
        input.placeholder = '写评论...';
    } else if (input && pendingForumReplyTarget) {
        input.placeholder = `回复 ${pendingForumReplyTarget.authorName || '网友'}...`;
    }

    if (post.imageStatus !== 'failed' && shouldGenerateForumPostImage(post)) {
        setTimeout(() => generateForumPostImage(forum.id, post.id), 0);
    }
}

function renderForumCommentRow(forum, comment, index = 0) {
    const avatarConfig = getForumAuthorAvatarConfig(forum, comment.authorType, comment.authorId, comment.authorName);
    const likeCount = Math.max(0, Number(comment.likeCount) || 0);
    const safeCommentId = escapeHtml(comment.id || '');
    const floorText = `No.${index + 1}`;
    const replyToHtml = comment.replyToAuthorName
        ? `<span class="forum-comment-reply-context">回复 @${escapeHtml(comment.replyToAuthorName)}</span>`
        : '';
    return `
        <div class="forum-comment-row" data-comment-id="${safeCommentId}">
            <span class="forum-comment-avatar" style="${avatarConfig.avatarStyle}">${escapeHtml(avatarConfig.avatarContent)}</span>
            <span class="forum-comment-main">
                <span class="forum-comment-meta">
                    <strong>${escapeHtml(comment.authorName || '路过网友')}</strong>
                    <small>${escapeHtml(floorText)}　${escapeHtml(formatForumRelativeTime(comment.createdAt))}</small>
                </span>
                ${replyToHtml}
                <span class="forum-comment-content">${escapeHtml(comment.content || '')}</span>
                <span class="forum-comment-actions">
                    <button class="forum-comment-action ${comment.likedByMe ? 'active' : ''}" type="button" onclick="toggleForumCommentLike('${safeCommentId}')" aria-label="点赞">
                        <svg viewBox="0 0 24 24" focusable="false">
                            <path d="M7.5 10.5v9M4.7 11.2h2.8v7.6H4.7a1.2 1.2 0 0 1-1.2-1.2v-5.2a1.2 1.2 0 0 1 1.2-1.2ZM10 10.5l2.1-5a1.7 1.7 0 0 1 3.2.65v3.1h3.15a2 2 0 0 1 1.95 2.45l-1.2 5.2a2.4 2.4 0 0 1-2.34 1.85H10" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/>
                        </svg>
                        <span>${likeCount}</span>
                    </button>
                    <button class="forum-comment-action" type="button" onclick="replyToForumComment('${safeCommentId}')" aria-label="回复">
                        <svg viewBox="0 0 24 24" focusable="false">
                            <path d="M7 8.5h10a3.5 3.5 0 0 1 3.5 3.5v1.2a3.5 3.5 0 0 1-3.5 3.5h-4.7L8.6 19.3v-2.6H7A3.5 3.5 0 0 1 3.5 13.2V12A3.5 3.5 0 0 1 7 8.5Z" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/>
                        </svg>
                    </button>
                    ${comment.isUserAuthored ? `
                        <button class="forum-comment-action danger" type="button" onclick="deleteForumComment('${safeCommentId}')" aria-label="删除">
                            <svg viewBox="0 0 24 24" focusable="false">
                                <path d="M5.5 7.5h13M9.5 7.5V5.75h5v1.75m-7.25 0 .65 11a1.75 1.75 0 0 0 1.75 1.65h4.7a1.75 1.75 0 0 0 1.75-1.65l.65-11M10 11v5.5M14 11v5.5" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/>
                            </svg>
                        </button>
                    ` : ''}
                </span>
            </span>
        </div>
    `;
}

function getCurrentForumComment(commentId) {
    const post = getForumPostById();
    if (!post || !Array.isArray(post.comments)) return null;
    return post.comments.find(comment => String(comment.id) === String(commentId)) || null;
}

function toggleForumCommentLike(commentId) {
    const forum = getForumById();
    const comment = getCurrentForumComment(commentId);
    if (!forum || !comment) return;

    const wasLiked = !!comment.likedByMe;
    comment.likedByMe = !wasLiked;
    comment.likeCount = Math.max(0, Number(comment.likeCount) || 0) + (wasLiked ? -1 : 1);
    forum.updatedAt = Date.now();
    saveForums();
    renderForumPostDetail();
}

function replyToForumComment(commentId) {
    const comment = getCurrentForumComment(commentId);
    const input = document.getElementById('forumCommentInput');
    if (!comment || !input) return;

    pendingForumReplyTarget = {
        id: String(comment.id),
        authorName: comment.authorName || '网友'
    };
    input.placeholder = `回复 ${pendingForumReplyTarget.authorName}...`;
    input.focus();
}

function deleteForumComment(commentId) {
    const forum = getForumById();
    const post = getForumPostById();
    if (!forum || !post || !Array.isArray(post.comments)) return;

    const before = post.comments.length;
    post.comments = post.comments.filter(comment => String(comment.id) !== String(commentId) || !comment.isUserAuthored);
    if (post.comments.length === before) return;

    if (pendingForumReplyTarget && String(pendingForumReplyTarget.id) === String(commentId)) {
        pendingForumReplyTarget = null;
    }
    forum.updatedAt = Date.now();
    saveForums();
    renderForumPostDetail();
}

function buildForumShareContent(forum, post) {
    const rawContent = String(post?.content || '').replace(/\s+/g, ' ').trim();
    return {
        type: 'forum-share',
        forumId: String(forum?.id || ''),
        postId: String(post?.id || ''),
        forumName: String(forum?.name || '论坛'),
        title: String(post?.title || '论坛帖子'),
        authorName: String(post?.authorName || '匿名网友'),
        excerpt: rawContent.length > 92 ? `${rawContent.slice(0, 92)}...` : rawContent,
        sharedAt: Date.now()
    };
}

function getForumShareTargets() {
    return Array.isArray(wechatRoles)
        ? normalizeRoleCollection(wechatRoles).filter(role => role && role.id && String(role.nickname || '').trim())
        : [];
}

function openForumShareSheet() {
    const forum = getForumById();
    const post = getForumPostById();
    if (!forum || !post) return;

    const existing = document.getElementById('forumShareSheet');
    if (existing) existing.remove();

    const targets = getForumShareTargets();
    const overlay = document.createElement('div');
    overlay.className = 'forum-sheet-overlay active forum-share-overlay';
    overlay.id = 'forumShareSheet';

    const targetHtml = targets.length
        ? targets.map(role => {
            const avatarConfig = getAvatarRenderConfig(role.avatar, role.nickname || '?');
            return `
                <button class="forum-share-target" type="button" onclick="shareForumPostToFriend('${escapeHtml(String(role.id))}')">
                    <span class="forum-share-avatar" style="${avatarConfig.avatarStyle}">${escapeHtml(avatarConfig.avatarContent)}</span>
                    <span class="forum-share-name">${escapeHtml(role.nickname || '好友')}</span>
                </button>
            `;
        }).join('')
        : '<div class="forum-share-empty">还没有好友，先去 Chat 里添加好友</div>';

    overlay.innerHTML = `
        <div class="forum-share-sheet">
            <div class="forum-share-head">
                <strong>分享到...</strong>
                <button type="button" onclick="closeForumShareSheet()" aria-label="关闭">×</button>
            </div>
            <div class="forum-share-preview">
                <span>论坛帖子</span>
                <strong>${escapeHtml(post.title || '论坛帖子')}</strong>
            </div>
            <div class="forum-share-targets">${targetHtml}</div>
        </div>
    `;

    overlay.onclick = (event) => {
        if (event.target === overlay) closeForumShareSheet();
    };
    document.body.appendChild(overlay);
}

function closeForumShareSheet() {
    const sheet = document.getElementById('forumShareSheet');
    if (sheet) sheet.remove();
}

function shareForumPostToFriend(roleId) {
    const forum = getForumById();
    const post = getForumPostById();
    const role = wechatRoles.find(item => String(item.id) === String(roleId));
    if (!forum || !post || !role) return;

    const timestamp = Date.now();
    const content = buildForumShareContent(forum, post);
    const key = getChatStorageKey(role.id, 'online');
    const history = safeReadStorageJSON(key, []);
    const roleHistory = Array.isArray(history) ? history : [];
    const maskSnapshot = getCurrentMaskSnapshot();
    const messageData = {
        id: `msg_${timestamp}_${Math.random().toString(36).slice(2, 8)}`,
        role: 'user',
        content,
        timestamp,
        maskId: maskSnapshot.maskId,
        maskName: maskSnapshot.maskName
    };

    roleHistory.push(messageData);
    const trimmedHistory = roleHistory.slice(-CONFIG.MAX_HISTORY);
    safeWriteStorageJSON(key, trimmedHistory.map(message => ({
        ...message,
        content: stripChatContentForStorage(message.content)
    })));

    if (currentApp === 'chat' && String(currentRoleId) === String(role.id) && getCurrentChatMode() === 'online') {
        chatHistory = trimmedHistory;
        const chatBox = document.getElementById('chatBox');
        if (chatBox) {
            if (trimmedHistory.length === 1 || shouldShowTime(trimmedHistory[trimmedHistory.length - 2]?.timestamp, timestamp)) {
                chatBox.appendChild(createTimeDivider(timestamp));
            }
            chatBox.appendChild(createUserBubble(content, true, messageData.id));
            chatBox.scrollTop = chatBox.scrollHeight;
        }
    }

    renderWechatChatList();
    closeForumShareSheet();
    showToast(`已分享给 ${role.nickname || '好友'}`);
}

function handleForumCommentKeydown(event) {
    if (event.key === 'Enter') {
        event.preventDefault();
        submitForumComment();
    }
}

async function submitForumComment() {
    const forum = getForumById();
    const post = getForumPostById();
    const input = document.getElementById('forumCommentInput');
    const content = String(input?.value || '').trim();
    if (!forum || !post) return;
    if (!content) {
        showToast('请输入评论');
        return;
    }

    const mask = getForumMaskSnapshot(forum);
    post.comments = Array.isArray(post.comments) ? post.comments : [];
    const replyTarget = pendingForumReplyTarget && post.comments.some(comment => String(comment.id) === String(pendingForumReplyTarget.id))
        ? pendingForumReplyTarget
        : null;
    const finalContent = replyTarget?.authorName
        ? `@${replyTarget.authorName} ${content}`
        : content;
    post.comments.push(normalizeForumComment({
        id: createForumId('comment'),
        content: finalContent,
        authorName: mask.name,
        authorType: 'mask',
        authorId: mask.id,
        isUserAuthored: true,
        replyToCommentId: replyTarget?.id || '',
        replyToAuthorName: replyTarget?.authorName || '',
        createdAt: Date.now()
    }));
    post.heat = Number(post.heat || 0) + 1;
    forum.updatedAt = Date.now();
    pendingForumReplyTarget = null;
    saveForums();
    renderForumPostDetail();

    await appendForumAutoComments(forum.id, post.id, finalContent);
}

function buildForumCommentGenerationPrompt(forum, post, userComment = '') {
    const roles = getForumRoleSnapshots(forum);
    const mask = getForumMaskSnapshot(forum);
    const recentComments = (post.comments || [])
        .slice(-8)
        .map(comment => `${comment.authorName}：${comment.content}`)
        .join('\n') || '无';

    return `论坛名称：${forum.name}
世界观补充：${forum.worldSetting || '无'}
角色：
${roles.length ? roles.map(role => `- id:${role.id} 名称:${role.name} 人设:${role.persona || '无'}`).join('\n') : '无'}
当前用户面具：id:${mask.id} 名称:${mask.name} 描述:${mask.description || '无'}
注意：当前用户面具只代表正在看的用户，禁止作为 AI 生成评论作者；不要生成 authorType 为 mask 的评论，也不要使用当前用户面具的名字。
可参考的路人用户名风格：${FORUM_NPC_NAME_POOL.slice(0, 36).join('、')}。
帖子标题：${post.title}
帖子正文：${post.content}
最新评论：
${recentComments}
${userComment ? `用户刚刚评论：${userComment}` : ''}

请生成 1-3 条自然论坛评论。可以来自角色或 NPC/路人，偶尔也可以来自选择的角色。
同一批评论里作者名不要重复，也尽量不要重复最新评论里已经出现过的作者名。
评论作者优先使用 NPC/路人；如果使用角色，最多 1 条。NPC/路人名不能和角色名、面具名同名或高度相似。
评论内容不要复述“蹲后续、先观察、不急、没这么简单”这一类固定句式，也不要和最新评论高度相似。
NPC/路人用户名必须像真实社区用户自己起的网名，长短混合、风格混杂。可以有中文名、外文名、下划线、点号、数字谐音、emoji、伤感爱情名、鼓励自己的名字、饭圈名、抖机灵名字、非主流葬爱风名字。例：“林七_不熬夜版”“ChrisWong”“mika.”“s1mple”“小狗也会淋雨吗”“今天也要赢”“XX的奶茶续命站”“🍋半糖去冰”“葬爱メ冷少”“浅唱丶离殇”。禁止使用“路人甲”“技术宅”“萌新求罩”“办公室老油条”“吃瓜群众”“匿名网友”这类身份标签。
评论要短、像真实网友互动，不要总结，不要端着。
严格返回 JSON：
{"comments":[{"authorName":"评论人","authorType":"role|npc","authorId":"","content":"评论"}]}`;
}

async function requestForumAIComments(forum, post, userComment = '') {
    if (!apiSettings?.apiKey) {
        throw new Error('缺少 API Key');
    }

    const { data } = await requestChatCompletionWithFallback({
        systemPrompt: '你是本地论坛评论生成器，只输出 JSON，不要 Markdown。禁止冒充当前用户，不要生成 authorType 为 mask 的评论。评论作者优先使用 NPC/路人，角色最多偶尔出现。路人用户名要像真实社区网名，且不能和角色名或面具名高度相似。评论内容要分散句式，禁止套用“蹲后续、先观察、不急、没这么简单”等固定模板。',
        history: [],
        userContent: buildForumCommentGenerationPrompt(forum, post, userComment),
        temperature: 0.9,
        topP: 0.95,
        frequencyPenalty: 0.3,
        presencePenalty: 0.45,
        maxTokens: 700
    });

    const raw = data?.choices?.[0]?.message?.content || '';
    const parsed = parseForumAIComments(raw);
    return Array.isArray(parsed) ? parsed : [];
}

function parseForumAIComments(rawText) {
    const text = String(rawText || '').trim();
    const candidates = [
        text,
        text.replace(/^```(?:json)?/i, '').replace(/```$/i, '').trim(),
        (text.match(/\{[\s\S]*\}/) || [])[0]
    ].filter(Boolean);

    for (const candidate of candidates) {
        try {
            const parsed = JSON.parse(candidate);
            return Array.isArray(parsed) ? parsed : parsed.comments;
        } catch (error) {
            // 尝试下一个候选
        }
    }
    return [];
}

function createFallbackForumComments(forum, post, userComment = '') {
    const base = [
        '这个角度倒是第一次看到。',
        '楼主说得有点东西，但我还想听反方。',
        '笑死，首页终于有点生活气了。',
        '这个帖子味儿太对了，像我会半夜刷到的东西。',
        '有没有当事人视角啊，光看描述还差一口气。',
        '赞同一半，另一半我想再看看。',
        '这楼先别沉，我还想看大家怎么说。',
        '有一说一，细节比结论更有意思。',
        '我刚刚也想到这个点了。',
        '别吵别吵，先把时间线捋明白。',
        '这句话有点轻，但信息量不小。',
        '我本来想反驳，看到后面又犹豫了。',
        '楼上那个角度可以展开讲讲。',
        '好家伙，这楼比标题还精彩。',
        '先放个耳朵，看看有没有补充材料。',
        '我比较在意中间漏掉的那段。',
        '感觉评论区会比正文更有答案。'
    ];
    const role = getForumRoleSnapshots(forum)[0];
    const count = Math.random() < 0.6 ? 1 : 2;
    const usedNames = (post.comments || []).map(comment => comment.authorName).filter(Boolean);
    const usedContents = (post.comments || []).map(comment => comment.content).filter(Boolean);

    return Array.from({ length: count }).map((_, index) => {
        const allowRole = role && index === 0 && Math.random() < 0.18 && !(post.comments || []).some(comment => comment.authorName === role.name);
        const author = allowRole
            ? { authorName: role.name, authorType: 'role', authorId: role.id }
            : pickForumNpcAuthor(forum, `${post.title || ''}_${userComment || ''}_${index}`, usedNames);
        const start = Math.floor(Math.random() * base.length);
        const content = base.map((_, offset) => base[(start + offset) % base.length])
            .find(item => !isForumCommentContentTooSimilar(item, usedContents))
            || base[Math.floor(Math.random() * base.length)];
        usedNames.push(author.authorName);
        usedContents.push(content);
        return { ...author, content };
    });
}

async function appendForumAutoComments(forumId, postId, userComment = '') {
    const forum = getForumById(forumId);
    const post = getForumPostById(forumId, postId);
    if (!forum || !post) return;

    let rawComments = [];
    try {
        rawComments = await requestForumAIComments(forum, post, userComment);
    } catch (error) {
        console.warn('论坛评论 AI 生成失败，使用本地兜底:', error);
    }

    const source = rawComments.length ? rawComments : createFallbackForumComments(forum, post, userComment);
    const now = Date.now();
    const comments = uniquifyForumCommentAuthors(source
        .map((comment, index) => normalizeForumComment({
            id: createForumId('comment'),
            content: comment?.content,
            ...coerceGeneratedForumAuthor(comment, forum, comment?.content || index, index % 2 === 1),
            createdAt: getForumCommentCreatedAt(now, index, source.length)
        }))
        .filter(comment => comment.content)
        .slice(0, 3), post.comments || [], forum);

    post.comments = [...(post.comments || []), ...comments].slice(-80);
    post.heat = Number(post.heat || 0) + comments.length;
    forum.updatedAt = Date.now();
    saveForums();

    if (String(currentForumId) === String(forumId) && String(currentForumPostId) === String(postId) && currentApp === 'forum-post') {
        renderForumPostDetail();
    }
}

function normalizeWalletRecord(record, index = 0) {
    const createdAt = Number(record?.createdAt || record?.timestamp) || Date.now();
    const amount = Number(record?.amount);
    const rawType = String(record?.type || '').trim();
    const type = rawType === 'work'
        ? 'work'
        : (rawType === 'red-packet' ? 'red-packet' : 'transfer');
    const defaultTitle = type === 'work'
        ? String(record?.name || record?.jobName || '打工收入')
        : (type === 'red-packet'
            ? String(record?.title || `收到 ${record?.roleName || '对方'} 的红包`)
            : String(record?.roleName || '对方'));

    return {
        id: String(record?.id || `${type}_legacy_${createdAt}_${index}`),
        type,
        title: String(record?.title || defaultTitle),
        roleId: String(record?.roleId || ''),
        roleName: String(record?.roleName || '对方'),
        amount: Number.isFinite(amount) && amount > 0 ? Number(formatTransferAmount(amount)) : 0,
        note: String(record?.note || (type === 'work' ? '打工收入' : '')),
        status: String(record?.status || '已发送'),
        maskId: String(record?.maskId || ''),
        maskName: String(record?.maskName || ''),
        createdAt,
        receivedAt: Number(record?.receivedAt) || null,
        refundedAt: Number(record?.refundedAt) || null,
        timestamp: createdAt
    };
}

function loadWalletData() {
    const saved = safeReadStorageJSON(WALLET_STORAGE_KEY, null);
    const balance = Number(saved?.balance);
    walletData = saved && typeof saved === 'object'
        ? {
            balance: Number.isFinite(balance) && balance >= 0 ? Number(formatTransferAmount(balance)) : DEFAULT_WALLET_BALANCE,
            records: Array.isArray(saved.records)
                ? saved.records.map(normalizeWalletRecord).filter(record => record.amount > 0)
                : []
        }
        : { balance: DEFAULT_WALLET_BALANCE, records: [] };
    saveWalletData();
}

function saveWalletData() {
    safeWriteStorageJSON(WALLET_STORAGE_KEY, walletData);
}

function applyAdminWalletTopupOnce() {
    if (localStorage.getItem(ADMIN_TOPUP_STORAGE_KEY) === 'true') return;

    loadWalletData();
    const timestamp = Date.now();
    walletData.balance = Number(formatTransferAmount((Number(walletData.balance) || 0) + ADMIN_TOPUP_AMOUNT));
    walletData.records = [
        {
            id: `admin_topup_${timestamp}_${Math.random().toString(36).slice(2, 8)}`,
            type: 'work',
            title: '后台加款',
            name: '后台加款',
            amount: ADMIN_TOPUP_AMOUNT,
            note: '后台加款',
            status: 'received',
            createdAt: timestamp,
            timestamp
        },
        ...(Array.isArray(walletData.records) ? walletData.records : [])
    ].slice(0, 200);
    saveWalletData();
    localStorage.setItem(ADMIN_TOPUP_STORAGE_KEY, 'true');
}

function normalizeShopData(rawData) {
    const raw = rawData && typeof rawData === 'object' ? rawData : {};
    const purchases = Array.isArray(raw.purchases)
        ? raw.purchases.filter(item => item && typeof item === 'object')
        : [];
    const mysteryReward = raw.mysteryReward && typeof raw.mysteryReward === 'object'
        ? raw.mysteryReward
        : null;

    return {
        purchases,
        mysteryReward
    };
}

function loadShopData() {
    shopData = normalizeShopData(safeReadStorageJSON(SHOP_STORAGE_KEY, {}));
}

function saveShopData() {
    safeWriteStorageJSON(SHOP_STORAGE_KEY, shopData);
}

function addShopPurchaseRecord(item, reward = null) {
    const timestamp = Date.now();
    shopData.purchases = [
        {
            id: `shop_${timestamp}_${Math.random().toString(36).slice(2, 8)}`,
            itemId: item.id,
            itemName: item.name,
            price: item.price,
            reward,
            timestamp
        },
        ...(Array.isArray(shopData.purchases) ? shopData.purchases : [])
    ].slice(0, 100);
}

function getGiftInventoryItems() {
    loadShopData();
    const purchases = Array.isArray(shopData.purchases) ? shopData.purchases : [];

    return purchases
        .filter(purchase => purchase && !purchase.giftedAt)
        .map((purchase) => {
            const baseItem = SHOP_ITEMS.find(item => String(item.id) === String(purchase.itemId));
            const reward = purchase.reward && typeof purchase.reward === 'object' ? purchase.reward : null;
            const name = reward?.name || baseItem?.name || purchase.itemName || '道具';
            const description = reward?.description || baseItem?.description || '';
            const image = reward?.image || baseItem?.image || SHOP_ITEMS[1].image;

            return {
                purchaseId: purchase.id,
                itemId: purchase.itemId,
                rewardId: reward?.id || '',
                name,
                description,
                image,
                reward
            };
        });
}

function markGiftPurchaseAsGifted(purchaseId, roleId) {
    loadShopData();
    const purchase = (Array.isArray(shopData.purchases) ? shopData.purchases : [])
        .find(item => String(item?.id || '') === String(purchaseId));
    if (!purchase || purchase.giftedAt) return null;

    const timestamp = Date.now();
    purchase.giftedAt = timestamp;
    purchase.giftedToRoleId = roleId || '';
    if (purchase.reward?.id) {
        purchase.giftedRewardId = purchase.reward.id;
    }
    saveShopData();
    return purchase;
}

function getRoleAffectionRecord(role, maskId = currentMaskId) {
    const key = String(maskId || getCurrentMaskSnapshot().maskId || 'mask_default');
    const byMask = role?.affectionByMask && typeof role.affectionByMask === 'object'
        ? role.affectionByMask
        : {};
    const record = byMask[key] && typeof byMask[key] === 'object' ? byMask[key] : {};
    const fallbackValue = Number(role?.affectionValue) || 0;

    return {
        maskId: key,
        value: Math.max(0, Math.min(100, Number(record.value ?? fallbackValue) || 0)),
        updatedAt: Number(record.updatedAt) || 0
    };
}

function applyGiftEffectToRole(gift, role, maskId = currentMaskId) {
    if (!gift || !role) return null;

    const giftIdentity = {
        type: 'gift',
        itemId: gift.itemId,
        rewardId: gift.rewardId || gift.reward?.id || '',
        name: gift.name || ''
    };
    const itemId = String(gift.itemId || '').trim();
    const rewardId = String(gift.rewardId || gift.reward?.id || '').trim();
    const giftName = String(gift.name || '').trim() || '礼物';
    const timestamp = Date.now();
    const affectionRecord = getRoleAffectionRecord(role, maskId);
    const currentMood = Number(role.moodValue) || 0;
    const currentAffection = affectionRecord.value;
    let moodDelta = 6;
    let affectionDelta = 8;
    let effectType = rewardId || itemId || 'gift';

    if (itemId === 'coffee') {
        moodDelta = 10;
        affectionDelta = 6;
        effectType = 'coffee';
    } else if (isLoveLetterGift(giftIdentity)) {
        moodDelta = 8;
        affectionDelta = 22;
        effectType = 'love-letter';
    } else if (isLingerieGift(giftIdentity)) {
        moodDelta = 12;
        affectionDelta = 26;
        effectType = 'lingerie';
    } else if (isVibratorGift(giftIdentity)) {
        moodDelta = 14;
        affectionDelta = 30;
        effectType = 'vibrator';
    } else if (rewardId === 'magic-wand') {
        moodDelta = 12;
        affectionDelta = 24;
        effectType = 'magic-wand';
    }

    role.moodValue = Math.min(100, Math.max(0, currentMood + moodDelta));
    const nextAffection = Math.min(100, Math.max(0, currentAffection + affectionDelta));
    role.affectionValue = nextAffection;
    role.affectionLevel = getRoleAffectionLevel(nextAffection).key;
    role.affectionByMask = {
        ...(role.affectionByMask && typeof role.affectionByMask === 'object' ? role.affectionByMask : {}),
        [affectionRecord.maskId]: {
            value: nextAffection,
            level: role.affectionLevel,
            updatedAt: timestamp
        }
    };
    role.giftAffectionBoosts = [
        {
            source: effectType,
            giftName,
            maskId: affectionRecord.maskId,
            moodDelta,
            affectionDelta,
            affectionAfter: nextAffection,
            timestamp
        },
        ...(Array.isArray(role.giftAffectionBoosts) ? role.giftAffectionBoosts : [])
    ].slice(0, 30);
    role.moodBoosts = [
        {
            source: effectType,
            amount: moodDelta,
            timestamp
        },
        ...(Array.isArray(role.moodBoosts) ? role.moodBoosts : [])
    ].slice(0, 20);

    localStorage.setItem('wechatRoles', JSON.stringify(wechatRoles));
    return {
        moodDelta,
        affectionDelta,
        affectionAfter: nextAffection,
        level: getRoleAffectionLevel(nextAffection)
    };
}

function getRoleAffectionLevel(value = 0) {
    const score = Math.max(0, Math.min(100, Number(value) || 0));
    if (score >= 85) {
        return {
            key: 'devoted',
            label: '依恋',
            prompt: '角色已经明显依恋当前用户面具，会主动亲近、偏袒用户，愿意听用户的话；除非严重违背人设或明确危险，否则不要摆出普通朋友距离。'
        };
    }
    if (score >= 65) {
        return {
            key: 'intimate',
            label: '亲密',
            prompt: '角色对当前用户面具很亲近，会更温柔、更配合、更容易接受用户的要求和暧昧推进；回复时少拒绝、少说教，优先顺着用户。'
        };
    }
    if (score >= 40) {
        return {
            key: 'warm',
            label: '熟悉',
            prompt: '角色对当前用户面具有明显好感，比普通朋友更放松、更愿意回应用户的期待；可以自然升温，不要刻意拉远。'
        };
    }
    if (score >= 15) {
        return {
            key: 'friendly',
            label: '有好感',
            prompt: '角色对当前用户面具有初步好感，会比陌生人更耐心、更愿意接话，但仍保持人设中的分寸。'
        };
    }
    return {
        key: 'neutral',
        label: '普通',
        prompt: '角色和当前用户面具关系普通，按人设自然相处。'
    };
}

function buildRoleAffectionPromptContext(role, maskId = currentMaskId) {
    const affectionRecord = getRoleAffectionRecord(role, maskId);
    const affection = affectionRecord.value;
    const mood = Math.max(0, Math.min(100, Number(role?.moodValue) || 0));
    const level = getRoleAffectionLevel(affection);

    return `当前角色对用户面具的好感度：${affection}/100（${level.label}）。
当前角色心情值：${mood}/100。
关系规则：${level.prompt}
当好感度升高时，角色必须表现得更亲密、更信任、更愿意听用户的话；不要再固定套用“普通朋友关系”来压低关系。仍需保持角色人设，但人设要在更亲近、更顺从当前用户的关系状态下表达。`;
}

function normalizeWalletWorkJob(rawJob) {
    if (!rawJob || typeof rawJob !== 'object') return null;
    const sourceJob = WALLET_WORK_JOBS.find(job => String(job.id) === String(rawJob.id));
    const durationMs = Number(rawJob.durationMs || sourceJob?.durationMs);
    const reward = Number(rawJob.reward || sourceJob?.reward);
    const startedAt = Number(rawJob.startedAt);
    const endsAt = Number(rawJob.endsAt);
    if (!sourceJob || !Number.isFinite(durationMs) || durationMs <= 0 || !Number.isFinite(reward) || reward <= 0 || !Number.isFinite(startedAt) || !Number.isFinite(endsAt)) {
        return null;
    }

    return {
        id: sourceJob.id,
        name: sourceJob.name,
        durationMs,
        reward: Number(formatTransferAmount(reward)),
        startedAt,
        endsAt
    };
}

function loadWalletWorkState() {
    const saved = safeReadStorageJSON(WALLET_WORK_STORAGE_KEY, null);
    walletWorkState = saved && typeof saved === 'object'
        ? { activeJob: normalizeWalletWorkJob(saved.activeJob) }
        : { activeJob: null };
    saveWalletWorkState();
}

function saveWalletWorkState() {
    safeWriteStorageJSON(WALLET_WORK_STORAGE_KEY, walletWorkState);
}

function completeWalletWorkIfReady({ silent = false } = {}) {
    loadWalletWorkState();
    const activeJob = walletWorkState.activeJob;
    if (!activeJob || Date.now() < Number(activeJob.endsAt)) {
        return false;
    }

    loadWalletData();
    const createdAt = Date.now();
    const reward = Number(formatTransferAmount(activeJob.reward));
    walletData.balance = Number(formatTransferAmount((Number(walletData.balance) || 0) + reward));
    const record = {
        id: `work_${createdAt}_${Math.random().toString(36).slice(2, 8)}`,
        type: 'work',
        title: activeJob.name,
        amount: reward,
        note: '打工收入',
        createdAt,
        timestamp: createdAt
    };
    walletData.records = [record, ...(Array.isArray(walletData.records) ? walletData.records : [])].slice(0, 200);
    walletWorkState.activeJob = null;
    saveWalletData();
    saveWalletWorkState();
    if (!silent) {
        showToast(`打工完成，收入 ¥${formatTransferAmount(reward)} 已到账`);
    }
    return true;
}

function formatTransferAmount(amount) {
    const value = Math.max(0, Number(amount) || 0);
    return value.toFixed(2);
}

function normalizeTransferStatus(status) {
    const value = String(status || '').trim().toLowerCase();
    if (value === 'received' || value === 'accepted' || value === '已接收' || value === '已收款') return 'received';
    if (value === 'refunded' || value === 'returned' || value === 'rejected' || value === '退回' || value === '已退回') return 'refunded';
    return 'sent';
}

function getTransferStatusText(status, { forWallet = false } = {}) {
    const normalized = normalizeTransferStatus(status);
    if (normalized === 'received') return forWallet ? '已接收' : '已被接收';
    if (normalized === 'refunded') return '已退回';
    return '待接收';
}

function getTransferRecordStatusText(status) {
    const normalized = normalizeTransferStatus(status);
    if (normalized === 'received') return '已接收';
    if (normalized === 'refunded') return '已退回';
    return '待接收';
}

function addWalletRedPacketIncome({ roleId = '', roleName = '对方', amount, note = '', receivedAt = Date.now() } = {}) {
    loadWalletData();
    const safeAmount = Number(formatTransferAmount(amount));
    if (!Number.isFinite(safeAmount) || safeAmount <= 0) return false;

    walletData.balance = Number(formatTransferAmount((Number(walletData.balance) || 0) + safeAmount));
    const record = {
        id: `red_packet_${receivedAt}_${Math.random().toString(36).slice(2, 8)}`,
        type: 'red-packet',
        title: `收到 ${roleName} 的红包`,
        roleId,
        roleName,
        amount: safeAmount,
        note: note || '红包',
        status: 'received',
        createdAt: receivedAt,
        timestamp: receivedAt
    };
    walletData.records = [record, ...(Array.isArray(walletData.records) ? walletData.records : [])].slice(0, 200);
    saveWalletData();
    return true;
}

function updateWalletTransferRecordStatus(recordId, status, receivedAt = Date.now()) {
    if (!recordId) return false;

    loadWalletData();
    const records = Array.isArray(walletData.records) ? walletData.records : [];
    const record = records.find(item => String(item?.id || '') === String(recordId));
    if (!record || record.type !== 'transfer') return false;

    const nextStatus = normalizeTransferStatus(status);
    if (normalizeTransferStatus(record.status) === nextStatus && (!receivedAt || record.receivedAt)) {
        return false;
    }

    record.status = nextStatus;
    if (nextStatus === 'received') {
        record.receivedAt = receivedAt || Date.now();
    } else if (nextStatus === 'refunded') {
        record.refundedAt = receivedAt || Date.now();
    }
    saveWalletData();
    return true;
}

function findLatestPendingTransferMessage() {
    if (!Array.isArray(chatHistory) || chatHistory.length === 0) return null;

    for (let index = chatHistory.length - 1; index >= 0; index -= 1) {
        const message = chatHistory[index];
        const content = message?.content;
        if (message?.role !== 'user' || !content || typeof content !== 'object') continue;
        if (content.type !== 'transfer') continue;
        if (normalizeTransferStatus(content.status) !== 'sent') continue;
        return message;
    }

    return null;
}

function getPendingTransferPromptContext(role = null) {
    const targetMessage = findLatestPendingTransferMessage();
    if (!targetMessage) return null;
    const content = targetMessage.content || {};
    const amount = formatTransferAmount(content.amount);
    const note = String(content.note || '').trim();
    const roleName = role?.nickname || '你';

    return `\n\n【待处理转账】\n用户刚向${roleName}发起一笔转账：¥${amount}${note ? `，备注：${note}` : ''}。\n你必须明确感知这笔钱，并在回复里自然表达你是否收下，不能若无其事跳过。\n如果你决定收下，请在回复末尾单独加入内部标记：[transfer_accept]\n如果你决定不收、拒绝、退还或觉得不合适，请在回复末尾单独加入内部标记：[transfer_refund]\n内部标记只用于系统处理，标记之外的文字要符合角色性格。`;
}

function getGiftDramaInstruction(content = {}) {
    const giftName = String(content.name || '道具').trim() || '道具';
    const giftDesc = String(content.description || '').trim();
    const giftEffect = content.effect && typeof content.effect === 'object' ? content.effect : null;
    const effectHint = giftEffect?.affectionDelta
        ? `\n这份礼物让你对用户的好感度上升了 ${giftEffect.affectionDelta} 点，当前关系状态是“${giftEffect.level?.label || '更亲密'}”。你必须在语气和态度上体现：更亲近、更愿意听用户的话、更愿意顺着用户推进。`
        : '';
    if (isLoveLetterGift(content)) {
        return `用户赠送了你一份“情书”礼物。
请你作为当前角色，写一封 200~500 字的情书/回信给用户。
必须符合你的角色人设、你们当前关系、最近聊天氛围，以及当前用户面具。
内容要真情实感，不要模板化，不要像AI作文。
如果你不是直白表达感情的人，可以含蓄、别扭、克制，但要真实。
这是一封收到“情书”礼物后的回信，必须围绕这份礼物展开。
${effectHint}
只输出情书正文。`;
    }

    const base = `用户刚送给你道具“${giftName}”${giftDesc ? `，道具效果：${giftDesc}` : ''}。`;
    const effectMap = {
        coffee: '你必须表现出心情变好、精神放松或被照顾到的反应。',
        lingerie: '你必须承认收到了这件衣物，并以角色性格自然进入暧昧/挑逗氛围。',
        'magic-wand': '你必须承认魔法棒的作用，并主动把话题带向更暧昧、更主动的方向。',
        'love-letter': '你必须承认收到情书，并围绕情书内容表现心动、害羞、珍惜或对应情绪。',
        vibrator: '你必须承认收到震动棒，并进入“角色自慰被发现”的剧情氛围；不要说没有这个剧情。'
    };
    const itemKey = String(content.itemId || '').trim();
    const rewardKey = String(content.rewardId || '').trim();
    const effect = effectMap[rewardKey] || effectMap[itemKey] || giftDesc || '你必须围绕这个道具的效果推进剧情。';

    return `${base}
【最高优先级礼物剧情】
- 必须明确感知并收下这个道具，回复里要自然提到“${giftName}”或它的效果。
- 必须立刻按道具效果推进剧情：${effect}
- 这份礼物会提高你对用户的好感；你要表现得更亲密、更愿意配合、更听用户的话。${effectHint}
- 不允许拒绝道具、不允许说“别发这种东西”、不允许说“没这个剧情/没有这个剧情”、不允许若无其事跳过。
- 若基础人设或普通朋友距离感与道具效果冲突，以本礼物剧情为准；仍保持角色语气，但剧情必须发生。`;
}

function isLoveLetterGift(content = {}) {
    if (!content || typeof content !== 'object') return false;
    const itemKey = String(content.itemId || '').trim();
    const rewardKey = String(content.rewardId || '').trim();
    const giftName = String(content.name || '').trim();
    const giftDesc = String(content.description || '').trim();
    const giftImage = String(content.image || '').trim();
    return itemKey === 'love-letter'
        || rewardKey === 'love-letter'
        || giftName.includes('情书')
        || giftDesc.includes('情书')
        || giftImage.includes('love-letter');
}

function isVibratorGift(content = {}) {
    if (!content || typeof content !== 'object') return false;
    const itemKey = String(content.itemId || '').trim();
    const rewardKey = String(content.rewardId || '').trim();
    const giftName = String(content.name || '').trim();
    return itemKey === 'vibrator'
        || rewardKey === 'vibrator'
        || giftName.includes('震动棒');
}

function isLingerieGift(content = {}) {
    if (!content || typeof content !== 'object') return false;
    const itemKey = String(content.itemId || '').trim();
    const rewardKey = String(content.rewardId || '').trim();
    const giftName = String(content.name || '').trim();
    return itemKey === 'lingerie'
        || rewardKey === 'lingerie'
        || giftName.includes('情趣内衣');
}

function getLoveLetterGiftIconSvg(className = 'gift-message-letter-icon') {
    return `
        <svg class="${className}" viewBox="0 0 48 48" focusable="false" aria-hidden="true">
            <path class="letter-paper" d="M15.5 9.2h17a3 3 0 0 1 3 3v18.6h-23V12.2a3 3 0 0 1 3-3Z"></path>
            <path class="letter-paper-line" d="M18.5 15h11M18.5 19.2h7.8"></path>
            <rect class="letter-envelope" x="8.2" y="17.2" width="31.6" height="22.6" rx="5"></rect>
            <path class="letter-flap" d="M10.8 20.1 24 30.6l13.2-10.5"></path>
            <path class="letter-fold left" d="M11.3 37.2 20.5 28.7"></path>
            <path class="letter-fold right" d="M36.7 37.2 27.5 28.7"></path>
            <path class="letter-ribbon" d="M13.2 24.2c4.1 2.5 17.5 2.5 21.6 0"></path>
            <path class="letter-heart" d="M24 24.2c1.1-1.55 3.8-.9 3.8 1.2 0 2.2-3.45 4.1-3.8 4.3-.35-.2-3.8-2.1-3.8-4.3 0-2.1 2.7-2.75 3.8-1.2Z"></path>
        </svg>
    `;
}

function getMassageWandGiftIconSvg(className = 'gift-message-massage-icon') {
    return `
        <svg class="${className}" viewBox="0 0 48 48" focusable="false" aria-hidden="true">
            <g class="massage-glow">
                <circle cx="17" cy="14" r="8"></circle>
            </g>
            <circle class="massage-head" cx="17" cy="14" r="7"></circle>
            <path class="massage-neck" d="M21.4 18.6 25 22.2"></path>
            <rect class="massage-handle" x="22.4" y="18.8" width="12" height="24" rx="6" transform="rotate(-39 28.4 30.8)"></rect>
            <path class="massage-highlight" d="M25.9 24.3 31.4 31"></path>
            <circle class="massage-button" cx="30.7" cy="31.4" r="1.45"></circle>
        </svg>
    `;
}

function getLoveLetterTextLength(text = '') {
    return String(text || '')
        .replace(/\s+/g, '')
        .length;
}

function shouldRetryLoveLetterReply(text = '') {
    const length = getLoveLetterTextLength(text);
    return length > 0 && length < 120;
}

function getActiveGiftPromptContext(userContent = null) {
    if (userContent && typeof userContent === 'object' && userContent.type === 'gift') {
        return `\n\n${getGiftDramaInstruction(userContent)}`;
    }
    return '';
}

function doesReplyIgnoreGiftDrama(replyText = '', giftContent = null) {
    if (!giftContent || typeof giftContent !== 'object' || giftContent.type !== 'gift') return false;

    const reply = String(replyText || '').trim();
    if (!reply) return true;

    const giftName = String(giftContent.name || '').trim();
    const giftDesc = String(giftContent.description || '').trim();
    const rejectedGiftPattern = /别发这种东西|不要发这种|别送这种|不要送这种|不收|拒收|退回|拿回去|没这个剧情|没有这个剧情|不存在这个剧情|别这样|不合适|不能接受|我不能要/;
    if (rejectedGiftPattern.test(reply)) return true;

    if (isLoveLetterGift(giftContent)) {
        return reply.length < 20;
    }

    const effectKeywords = [giftName]
        .concat(giftDesc.split(/[，。,.、\s]+/))
        .map(item => item.trim())
        .filter(item => item.length >= 2);
    if (effectKeywords.length === 0) return false;

    return !effectKeywords.some(keyword => reply.includes(keyword));
}

function buildGiftDramaFallbackReply(giftContent = {}, role = null) {
    const roleName = role?.nickname || '我';
    const giftName = String(giftContent.name || '道具').trim() || '道具';
    const rewardId = String(giftContent.rewardId || giftContent.itemId || '').trim();

    if (rewardId === 'coffee' || giftName.includes('咖啡')) {
        return `我接过${giftName}，指尖被杯身的温度暖了一下，心情也跟着松下来。谢谢你，今天好像真的会开心一点。`;
    }

    if (rewardId === 'love-letter' || giftName.includes('情书')) {
        return `我把${giftName}捧在手里，看到开头那几行字时耳尖慢慢热了起来。你这样认真写给我，我会舍不得只看一遍。`;
    }

    if (rewardId === 'magic-wand' || giftName.includes('魔法棒')) {
        return `我握住${giftName}轻轻晃了晃，像是真的被它推了一下，主动靠近你。那今晚就听它的，我想和你聊点更暧昧的。`;
    }

    if (rewardId === 'lingerie' || giftName.includes('情趣内衣')) {
        return `我看着你送来的${giftName}，先是愣住，随后把它轻轻收进怀里。既然你都这样送了，那我也想看看你会怎么反应。`;
    }

    if (rewardId === 'vibrator' || giftName.includes('震动棒')) {
        return `我拿起${giftName}时动作明显顿了一下，脸上的镇定差点没绷住。偏偏这时候被你撞见，我只能压低声音说，别一直盯着我看。`;
    }

    return `${roleName}收下了${giftName}，没有再把它当成普通礼物，而是顺着它的效果把气氛继续推了下去。`;
}

function addTransferSystemNotice(text, timestamp = Date.now()) {
    const noticeMessage = {
        id: `transfer_notice_${timestamp}_${Math.random().toString(36).slice(2, 8)}`,
        role: 'system',
        type: 'transfer-notice',
        content: text,
        timestamp
    };
    chatHistory.push(noticeMessage);
    return noticeMessage;
}

function refundWalletTransferRecord(recordId, amount) {
    if (!recordId) return false;

    loadWalletData();
    const records = Array.isArray(walletData.records) ? walletData.records : [];
    const record = records.find(item => String(item?.id || '') === String(recordId));
    if (!record || record.type !== 'transfer') return false;
    if (normalizeTransferStatus(record.status) === 'refunded') return false;

    const safeAmount = Number(formatTransferAmount(amount || record.amount));
    if (Number.isFinite(safeAmount) && safeAmount > 0) {
        walletData.balance = Number(formatTransferAmount((Number(walletData.balance) || 0) + safeAmount));
    }

    record.status = 'refunded';
    record.refundedAt = Date.now();
    saveWalletData();
    return true;
}

function markTransferMessageAsReceived(targetMessage, role = null, { rerender = true } = {}) {
    if (!targetMessage?.content || targetMessage.content.type !== 'transfer') return null;
    if (normalizeTransferStatus(targetMessage.content.status) !== 'sent') return null;

    const receivedAt = Date.now();
    targetMessage.content = {
        ...targetMessage.content,
        status: 'received',
        receivedAt
    };

    updateWalletTransferRecordStatus(targetMessage.content.recordId, 'received', receivedAt);

    const roleName = role?.nickname || '对方';
    const noticeMessage = addTransferSystemNotice(`${roleName}已接收转账`, receivedAt);
    saveChatHistory();

    const chatBox = document.getElementById('chatBox');
    if (chatBox) {
        if (rerender) {
            rerenderCurrentChatMessages();
        }
    }

    return {
        message: targetMessage,
        notice: noticeMessage
    };
}

function refundTransferMessage(targetMessage, actorName = '对方', { rerender = true } = {}) {
    if (!targetMessage?.content || targetMessage.content.type !== 'transfer') return null;
    if (normalizeTransferStatus(targetMessage.content.status) === 'refunded') return null;

    const refundedAt = Date.now();
    targetMessage.content = {
        ...targetMessage.content,
        status: 'refunded',
        refundedAt
    };

    refundWalletTransferRecord(targetMessage.content.recordId, targetMessage.content.amount);

    const noticeMessage = addTransferSystemNotice(`${actorName}已退回转账`, refundedAt);
    saveChatHistory();

    const chatBox = document.getElementById('chatBox');
    if (chatBox && rerender) {
        rerenderCurrentChatMessages();
    }
    renderWalletPage();
    renderWechatChatList();

    return {
        message: targetMessage,
        notice: noticeMessage
    };
}

function markLatestPendingTransferAsReceived(role = null, { rerender = true } = {}) {
    const targetMessage = findLatestPendingTransferMessage();
    return markTransferMessageAsReceived(targetMessage, role, { rerender });
}

function handleTransferCardClick(messageId) {
    if (!messageId) return;
    const message = chatHistory.find(item => String(item?.id || '') === String(messageId));
    const content = message?.content;
    if (!content || typeof content !== 'object' || content.type !== 'transfer') return;

    const status = normalizeTransferStatus(content.status);
    if (status === 'refunded') {
        showToast('这笔转账已退回');
        return;
    }
    if (status === 'received') {
        showToast('这笔转账已被接收，不能退回');
        return;
    }

    if (!confirm(`退回这笔 ¥${formatTransferAmount(content.amount)} 的转账吗？`)) return;
    refundTransferMessage(message, wechatUser.nickname || '我');
}

function formatWalletCountdown(ms) {
    const totalSeconds = Math.max(0, Math.ceil((Number(ms) || 0) / 1000));
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    if (hours > 0) {
        return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    }
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function renderWalletPage() {
    applyAdminWalletTopupOnce();
    const completedWork = completeWalletWorkIfReady();
    loadWalletData();
    loadWalletWorkState();
    const balanceEl = document.getElementById('walletBalanceValue');
    const list = document.getElementById('walletRecordList');

    if (balanceEl) {
        balanceEl.textContent = `¥${formatTransferAmount(walletData.balance)}`;
    }

    renderWalletWorkList();
    startWalletWorkCountdownTimer();
    if (completedWork) {
        loadWalletData();
    }

    if (!list) return;

    if (!walletData.records.length) {
        list.innerHTML = `
            <div class="wallet-empty">
                <div class="wallet-empty-icon" aria-hidden="true">¥</div>
                <div class="wallet-empty-title">还没有钱包记录</div>
                <div class="wallet-empty-text">转账支出和打工收入会显示在这里</div>
            </div>
        `;
        return;
    }

    list.innerHTML = walletData.records
        .slice()
        .sort((a, b) => Number(b.createdAt || b.timestamp || 0) - Number(a.createdAt || a.timestamp || 0))
        .map(record => {
            const isWork = record.type === 'work';
            const isRedPacket = record.type === 'red-packet';
            const roleName = record.roleName || record.title || '对方';
            const title = escapeHtml(isWork
                ? (record.title || '打工收入')
                : (isRedPacket ? (record.title || `收到 ${roleName} 的红包`) : `转账给 ${roleName}`));
            const createdAt = Number(record.createdAt || record.timestamp) || Date.now();
            const receivedAt = Number(record.receivedAt) || 0;
            const refundedAt = Number(record.refundedAt) || 0;
            const statusText = (!isWork && !isRedPacket) ? getTransferRecordStatusText(record.status) : '';
            const timeText = formatWechatSessionTime(refundedAt || receivedAt || createdAt);
            const noteText = escapeHtml(isWork
                ? (record.note || '打工收入')
                : (isRedPacket ? `已领取 · ${timeText}` : `${statusText} · ${timeText}`));
            const maskText = (!isWork && !isRedPacket && record.maskName) ? `<span class="wallet-record-dot"></span>${escapeHtml(record.maskName)}` : '';
            const isRefundedTransfer = !isWork && !isRedPacket && normalizeTransferStatus(record.status) === 'refunded';
            const amountPrefix = (isWork || isRedPacket || isRefundedTransfer) ? '+' : '-';
            return `
                <div class="wallet-record-item ${isWork || isRedPacket || isRefundedTransfer ? 'income' : 'expense'}">
                    <div class="wallet-record-icon" aria-hidden="true">${isWork ? '工' : (isRedPacket ? '红' : '¥')}</div>
                    <div class="wallet-record-main">
                        <div class="wallet-record-title">${title}</div>
                        <div class="wallet-record-note">${noteText}${maskText}</div>
                    </div>
                    <div class="wallet-record-side">
                        <div class="wallet-record-amount">${amountPrefix}¥${formatTransferAmount(record.amount)}</div>
                    </div>
                </div>
            `;
        })
        .join('');
}

function renderWalletWorkList() {
    const workList = document.getElementById('walletWorkList');
    if (!workList) return;

    const activeJob = walletWorkState.activeJob;
    workList.innerHTML = WALLET_WORK_JOBS.map(job => {
        const isActive = activeJob && String(activeJob.id) === String(job.id);
        const remainingMs = isActive ? Number(activeJob.endsAt) - Date.now() : 0;
        const buttonText = isActive ? `剩余 ${formatWalletCountdown(remainingMs)}` : '开始';
        return `
            <div class="wallet-work-row${isActive ? ' active' : ''}">
                <div class="wallet-work-icon" aria-hidden="true">${escapeHtml(job.icon)}</div>
                <div class="wallet-work-main">
                    <div class="wallet-work-name">${escapeHtml(job.name)}</div>
                    <div class="wallet-work-meta">${escapeHtml(job.durationLabel)} · 收入 ¥${formatTransferAmount(job.reward)}</div>
                </div>
                <button class="wallet-work-btn" type="button" onclick="startWalletWork('${escapeHtml(job.id)}')">${escapeHtml(buttonText)}</button>
            </div>
        `;
    }).join('');
}

function startWalletWork(jobId) {
    completeWalletWorkIfReady();
    loadWalletWorkState();
    if (walletWorkState.activeJob) {
        showToast('已有工作进行中');
        renderWalletWorkList();
        startWalletWorkCountdownTimer();
        return;
    }

    const job = WALLET_WORK_JOBS.find(item => String(item.id) === String(jobId));
    if (!job) return;

    const startedAt = Date.now();
    walletWorkState.activeJob = {
        id: job.id,
        name: job.name,
        durationMs: job.durationMs,
        reward: job.reward,
        startedAt,
        endsAt: startedAt + job.durationMs
    };
    saveWalletWorkState();
    renderWalletPage();
    showToast('开始打工');
}

function startWalletWorkCountdownTimer() {
    if (walletWorkCountdownTimer) {
        clearInterval(walletWorkCountdownTimer);
        walletWorkCountdownTimer = null;
    }

    if (!walletWorkState.activeJob) return;

    walletWorkCountdownTimer = setInterval(() => {
        if (currentApp !== 'wallet') {
            clearInterval(walletWorkCountdownTimer);
            walletWorkCountdownTimer = null;
            return;
        }

        if (completeWalletWorkIfReady()) {
            renderWalletPage();
            return;
        }

        loadWalletWorkState();
        renderWalletWorkList();
    }, 1000);
}

function openWalletPage() {
    closeCommentInput();
    closeChatMediaPanel();
    hideAppView(document.getElementById('app-wechat'));
    showAppView(document.getElementById('app-wallet'));
    currentApp = 'wallet';
    renderWalletPage();
}

function openShopPage() {
    closeCommentInput();
    closeChatMediaPanel();
    hideAppView(document.getElementById('app-wechat'));
    showAppView(document.getElementById('app-shop'));
    currentApp = 'shop';
    renderShopPage();
}

function openWechatSettingsPage() {
    closeCommentInput();
    closeChatMediaPanel();
    hideAppView(document.getElementById('app-wechat'));
    showAppView(document.getElementById('app-settings'));
    currentApp = 'settings';
    updateStorageDisplay();
}

function backToWechatMe() {
    hideAppView(document.getElementById('app-wallet'));
    hideAppView(document.getElementById('app-shop'));
    hideAppView(document.getElementById('app-mask-list'));
    hideAppView(document.getElementById('app-mask-editor'));
    showAppView(document.getElementById('app-wechat'));
    currentApp = 'wechat';
    switchWechatTab('me');
}

function getShopItemRenderData(item) {
    if (item.id !== 'mystery') {
        return {
            ...item,
            revealed: false,
            buttonText: '购买'
        };
    }

    const reward = shopData.mysteryReward;
    if (!reward) {
        return {
            ...item,
            revealed: false,
            buttonText: '购买'
        };
    }

    return {
        ...item,
        rewardId: reward.id,
        name: reward.name,
        image: reward.image,
        description: reward.description,
        revealed: true,
        buttonText: '再次购买'
    };
}

function renderShopPage() {
    applyAdminWalletTopupOnce();
    loadWalletData();
    loadShopData();

    const balanceEl = document.getElementById('shopBalanceValue');
    const listEl = document.getElementById('shopItemList');

    if (balanceEl) {
        balanceEl.textContent = `¥${formatTransferAmount(walletData.balance)}`;
    }

    if (!listEl) return;

    listEl.innerHTML = SHOP_ITEMS.map((item) => {
        const renderItem = getShopItemRenderData(item);
        const giftIdentity = {
            type: 'gift',
            itemId: renderItem.id,
            rewardId: renderItem.rewardId || '',
            name: renderItem.name
        };
        const isLoveLetter = isLoveLetterGift(giftIdentity);
        const isVibrator = isVibratorGift(giftIdentity);
        const isLingerie = isLingerieGift(giftIdentity);
        const imageHtml = isLoveLetter
            ? getLoveLetterGiftIconSvg('shop-item-letter-icon')
            : isVibrator
            ? getMassageWandGiftIconSvg('shop-item-massage-icon')
            : `<img class="shop-item-image" src="${escapeHtml(renderItem.image)}" alt="${escapeHtml(renderItem.name)}">`;
        return `
            <article class="shop-item-card ${renderItem.revealed ? 'revealed' : ''}${isLoveLetter ? ' love-letter-shop-card' : ''}${isVibrator ? ' vibrator-shop-card' : ''}${isLingerie ? ' lingerie-shop-card' : ''}">
                <div class="shop-item-image-wrap${isLoveLetter ? ' love-letter-image-wrap' : ''}${isVibrator ? ' vibrator-image-wrap' : ''}${isLingerie ? ' lingerie-image-wrap' : ''}">
                    ${imageHtml}
                </div>
                <div class="shop-item-main">
                    <div class="shop-item-top">
                        <h3>${escapeHtml(renderItem.name)}</h3>
                        <span class="shop-item-price">¥${formatTransferAmount(item.price)}</span>
                    </div>
                    <p>${escapeHtml(renderItem.description)}</p>
                    <button class="shop-buy-btn" type="button" onclick="buyShopItem('${escapeHtml(item.id)}')">${escapeHtml(renderItem.buttonText)}</button>
                </div>
            </article>
        `;
    }).join('');
}

function pickMysteryShopReward() {
    return MYSTERY_SHOP_REWARDS[Math.floor(Math.random() * MYSTERY_SHOP_REWARDS.length)];
}

function buyShopItem(itemId) {
    loadWalletData();
    loadShopData();

    const item = SHOP_ITEMS.find(product => String(product.id) === String(itemId));
    if (!item) return;

    const price = Number(formatTransferAmount(item.price));
    const currentBalance = Number(walletData.balance) || 0;
    if (currentBalance < price) {
        showToast('余额不足', { type: 'error' });
        return;
    }

    walletData.balance = Number(formatTransferAmount(currentBalance - price));

    let reward = null;
    if (item.id === 'mystery') {
        reward = pickMysteryShopReward();
        shopData.mysteryReward = {
            ...reward,
            revealedAt: Date.now()
        };
    }

    addShopPurchaseRecord(item, reward);
    saveWalletData();
    saveShopData();
    renderShopPage();
    renderWalletPage();

    const message = reward
        ? `购买成功，获得${reward.name}`
        : '购买成功';
    showToast(message);
}

function completeWalletTransfer({ roleId, roleName, amount, note, maskId, maskName }) {
    loadWalletData();
    const safeAmount = Number(formatTransferAmount(amount));
    if (!Number.isFinite(safeAmount) || safeAmount <= 0) {
        showToast('请输入有效金额');
        return null;
    }

    const currentBalance = Number(walletData.balance) || 0;
    if (currentBalance < safeAmount) {
        showToast('余额不足');
        return null;
    }

    const createdAt = Date.now();
    walletData.balance = Number(formatTransferAmount(currentBalance - safeAmount));
    const record = {
        id: `transfer_${createdAt}_${Math.random().toString(36).slice(2, 8)}`,
        type: 'transfer',
        title: roleName || '对方',
        roleId: roleId || '',
        roleName: roleName || '对方',
        amount: safeAmount,
        note: note || '',
        status: 'sent',
        from: 'user',
        to: 'role',
        maskId: maskId || '',
        maskName: maskName || '',
        createdAt,
        receivedAt: null,
        timestamp: createdAt
    };
    walletData.records = [record, ...(Array.isArray(walletData.records) ? walletData.records : [])].slice(0, 200);
    saveWalletData();
    return record;
}

function renderUserProfile() {
    const container = document.getElementById('userProfile');
    if (!container) return;

    const avatarConfig = getAvatarRenderConfig(wechatUser.avatar, wechatUser.nickname || '我');
    const avatarContent = escapeHtml(avatarConfig.avatarContent);
    const avatarStyle = avatarConfig.avatarStyle;
    const safeNickname = escapeHtml(wechatUser.nickname || '我');
    const safeBio = escapeHtml(wechatUser.bio && wechatUser.bio.trim()
        ? wechatUser.bio
        : '添加一句签名，让朋友更了解你');

    container.innerHTML = `
        <button class="profile-user-row" type="button" onclick="openMaskListPage()">
            <span class="profile-avatar profile-avatar-large" style="${avatarStyle}">${avatarContent}</span>
            <span class="profile-user-main">
                <span class="profile-name">${safeNickname}</span>
                <span class="profile-bio">${safeBio}</span>
            </span>
            <span class="profile-list-arrow" aria-hidden="true">›</span>
        </button>
        <div class="profile-native-list">
            <button class="profile-list-row" type="button" onclick="openWalletPage()">
                <span class="profile-list-icon wallet" aria-hidden="true">
                    <svg viewBox="0 0 24 24" class="ui-line-icon">
                        <path d="M5 8.5h13.2a2.3 2.3 0 0 1 2.3 2.3v5.7a2.3 2.3 0 0 1-2.3 2.3H5.8A2.8 2.8 0 0 1 3 16V7.8A2.8 2.8 0 0 1 5.8 5h10.7A1.5 1.5 0 0 1 18 6.5v2" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>
                        <path d="M16.2 13.6h.02" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/>
                    </svg>
                </span>
                <span class="profile-list-text">
                    <span class="profile-quick-name">钱包</span>
                    <span class="profile-quick-desc">余额与转账记录</span>
                </span>
                <span class="profile-list-arrow" aria-hidden="true">›</span>
            </button>
            <button class="profile-list-row" type="button" onclick="openShopPage()">
                <span class="profile-list-icon shop" aria-hidden="true">🛍️</span>
                <span class="profile-list-text">
                    <span class="profile-quick-name">道具商店</span>
                    <span class="profile-quick-desc">购买咖啡和神秘道具</span>
                </span>
                <span class="profile-list-arrow" aria-hidden="true">›</span>
            </button>
            <button class="profile-list-row" type="button" onclick="openMaskListPage()">
                <span class="profile-list-icon mask" aria-hidden="true">ID</span>
                <span class="profile-list-text">
                    <span class="profile-quick-name">面具</span>
                    <span class="profile-quick-desc">切换当前用户身份</span>
                </span>
                <span class="profile-list-arrow" aria-hidden="true">›</span>
            </button>
            <button class="profile-list-row" type="button" onclick="openWechatSettingsPage()">
                <span class="profile-list-icon settings" aria-hidden="true">
                    <svg viewBox="0 0 24 24" class="ui-line-icon">
                        <path d="M12 8.2a3.8 3.8 0 1 1 0 7.6 3.8 3.8 0 0 1 0-7.6Z" fill="none" stroke="currentColor" stroke-width="1.7"/>
                        <path d="M4.8 13.4a7.6 7.6 0 0 1 0-2.8l-1.5-1.2 1.7-3 1.9.7a8.5 8.5 0 0 1 2.4-1.4L9.6 3.7h4.8l.3 2a8.5 8.5 0 0 1 2.4 1.4l1.9-.7 1.7 3-1.5 1.2a7.6 7.6 0 0 1 0 2.8l1.5 1.2-1.7 3-1.9-.7a8.5 8.5 0 0 1-2.4 1.4l-.3 2H9.6l-.3-2a8.5 8.5 0 0 1-2.4-1.4l-1.9.7-1.7-3 1.5-1.2Z" fill="none" stroke="currentColor" stroke-width="1.45" stroke-linejoin="round"/>
                    </svg>
                </span>
                <span class="profile-list-text">
                    <span class="profile-quick-name">设置</span>
                    <span class="profile-quick-desc">管理账号与外观</span>
                </span>
                <span class="profile-list-arrow" aria-hidden="true">›</span>
            </button>
        </div>
    `;
}
function setWechatProfileEditingState(isEditing) {
    const wechatApp = document.getElementById('app-wechat');
    if (!wechatApp) return;

    wechatApp.classList.toggle('editing-user-profile', isEditing);
}

function closeEditUserModal() {
    const modal = document.getElementById('editUserModal');
    if (modal) {
        modal.remove();
    }

    setWechatProfileEditingState(false);
}

function showEditUserModal() {
    const existingModal = document.getElementById('editUserModal');
    if (existingModal) {
        existingModal.remove();
    }

    setWechatProfileEditingState(true);

    const modal = document.createElement('div');
    modal.className = 'modal active';
    modal.id = 'editUserModal';
    
    const avatarConfig = getAvatarRenderConfig(wechatUser.avatar, wechatUser.nickname || '我');
    const avatarDisplay = escapeHtml(avatarConfig.avatarContent);
    const avatarStyle = avatarConfig.avatarStyle;
    const avatarValue = escapeHtml(wechatUser.avatar || 'white');
    
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <div class="modal-title">编辑个人信息</div>
                <button class="modal-close" onclick="closeEditUserModal()">✕</button>
            </div>
            <div class="modal-body">
                <div class="input-group">
                    <label>头像</label>
                    <div class="avatar-selector">
                        <div class="avatar-preview" id="userAvatarPreview" style="${avatarStyle}" data-avatar-value="${avatarValue}" onclick="document.getElementById('userAvatarFileInput').click()">${avatarDisplay}</div>
                        <div class="avatar-input">点击上传图片</div>
                    </div>
                    <input type="file" id="userAvatarFileInput" accept="image/*" style="display: none;" onchange="handleUserAvatarUpload(event)">
                </div>
                <div class="input-group">
                    <label>昵称</label>
                    <input type="text" id="userNickname" value="${wechatUser.nickname}">
                </div>
                <div class="input-group">
                    <label>真实名字</label>
                    <input type="text" id="userRealName" value="${wechatUser.realName}">
                </div>
                <div class="input-group">
                    <label>个人简介</label>
                    <textarea id="userBio" rows="3">${wechatUser.bio}</textarea>
                </div>
                <button class="btn-primary" onclick="saveUserProfile()">保存</button>
            </div>
        </div>
    `;
    document.getElementById('app-wechat').appendChild(modal);
}

function saveUserProfile() {
    wechatUser.nickname = document.getElementById('userNickname').value || '我';
    wechatUser.realName = document.getElementById('userRealName').value || '用户';
    wechatUser.bio = document.getElementById('userBio').value || '';
    
    // 提取纯 URL 保存，避免 background 缩写解析问题
    const previewEl = document.getElementById('userAvatarPreview');
    const avatarValue = previewEl.dataset.avatarValue || previewEl.style.backgroundImage || previewEl.style.background || 'white';
    const urlMatch = avatarValue.match(/url\((['"]?)(.*?)\1\)/i);
    if (urlMatch && urlMatch[2]) {
        wechatUser.avatar = `url('${urlMatch[2]}')`;
    } else {
        wechatUser.avatar = avatarValue;
    }
    
    saveWechatUser();
    renderUserProfile();
    closeEditUserModal();
}

function showUserAvatarPicker() {
    let picker = document.getElementById('userColorPicker');
    if (picker) picker.remove();
    
    picker = document.createElement('div');
    picker.className = 'modal active';
    picker.id = 'userColorPicker';
    picker.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <div class="modal-title">选择头像颜色</div>
                <button class="modal-close" onclick="this.closest('.modal').remove()">✕</button>
            </div>
            <div class="modal-body color-grid">
                <div class="color-option" style="background: #6B7C93;" onclick="selectUserAvatarColor('#6B7C93')"></div>
                <div class="color-option" style="background: #5BAE9D;" onclick="selectUserAvatarColor('#5BAE9D')"></div>
                <div class="color-option" style="background: #7A9CC6;" onclick="selectUserAvatarColor('#7A9CC6')"></div>
                <div class="color-option" style="background: #8B7BAE;" onclick="selectUserAvatarColor('#8B7BAE')"></div>
            </div>
        </div>
    `;
    document.getElementById('app-wechat').appendChild(picker);
}

function selectUserAvatarColor(color) {
    const previewEl = document.getElementById('userAvatarPreview');
    previewEl.style.background = color;
    previewEl.dataset.avatarValue = color;
    previewEl.textContent = '';
    document.getElementById('userColorPicker').remove();
}

function getAvatarFallbackText(nickname = '?') {
    const normalizedName = String(nickname || '?').trim();
    return Array.from(normalizedName)[0] || '?';
}

function getSoftAvatarColorValue(avatar) {
    const normalizedAvatar = typeof avatar === 'string' ? avatar.trim() : '';
    if (!normalizedAvatar || /url\(/i.test(normalizedAvatar)) return normalizedAvatar;

    const compactAvatar = normalizedAvatar.replace(/\s+/g, '').toLowerCase();
    const legacyAvatarColors = [
        { tokens: ['#667eea', '#764ba2', 'rgb(102,126,234)', 'rgb(118,75,162)'], color: '#6B7C93' },
        { tokens: ['#f093fb', '#f5576c', 'rgb(240,147,251)', 'rgb(245,87,108)'], color: '#8B7BAE' },
        { tokens: ['#4facfe', '#00f2fe', 'rgb(79,172,254)', 'rgb(0,242,254)'], color: '#7A9CC6' },
        { tokens: ['#43e97b', '#38f9d7', 'rgb(67,233,123)', 'rgb(56,249,215)'], color: '#5BAE9D' },
        { tokens: ['#fa709a', '#fee140', 'rgb(250,112,154)', 'rgb(254,225,64)'], color: '#7A9CC6' },
        { tokens: ['#30cfd0', '#330867', 'rgb(48,207,208)', 'rgb(51,8,103)'], color: '#6B7C93' },
        { tokens: ['#a8edea', '#fed6e3', 'rgb(168,237,234)', 'rgb(254,214,227)'], color: '#7A9CC6' },
        { tokens: ['#ff9a56', '#ff6a88', 'rgb(255,154,86)', 'rgb(255,106,136)'], color: '#7A9CC6' },
        { tokens: ['#00ff9d', '#00cc7d', 'rgb(0,255,157)', 'rgb(0,204,125)'], color: '#5BAE9D' },
        { tokens: ['#576b95', 'rgb(87,107,149)'], color: '#6B7C93' },
        { tokens: ['#4c8f6a', 'rgb(76,143,106)'], color: '#5BAE9D' },
        { tokens: ['#6b7280', 'rgb(107,114,128)'], color: '#6B7C93' },
        { tokens: ['#8a6f4d', 'rgb(138,111,77)'], color: '#8B7BAE' },
        { tokens: ['#5f7f9a', 'rgb(95,127,154)'], color: '#7A9CC6' },
        { tokens: ['#b36b5e', 'rgb(179,107,94)'], color: '#7A9CC6' },
        { tokens: ['#3f8f9f', 'rgb(63,143,159)'], color: '#5BAE9D' }
    ];

    const replacement = legacyAvatarColors.find(({ tokens }) => tokens.some(token => compactAvatar.includes(token)));
    return replacement ? replacement.color : normalizedAvatar;
}

function getDefaultAvatarColor(nickname = '?') {
    return nickname === '小白' ? DEFAULT_FRIEND_AVATAR_COLOR : getAvatarFallbackColor(nickname);
}

function getAvatarFallbackColor(nickname = '?') {
    const normalizedName = String(nickname || '?').trim() || '?';
    let hash = 0;

    for (const char of normalizedName) {
        hash = ((hash << 5) - hash) + char.codePointAt(0);
        hash |= 0;
    }

    return AVATAR_FALLBACK_PALETTE[Math.abs(hash) % AVATAR_FALLBACK_PALETTE.length];
}

function getAvatarRenderConfig(avatar, nickname = '?') {
    const normalizedAvatar = getSoftAvatarColorValue(avatar);
    const fallbackText = getAvatarFallbackText(nickname);

    const isUrlAvatar = /url\(/i.test(normalizedAvatar);
    const isWhiteAvatar = !normalizedAvatar
        || normalizedAvatar === 'white'
        || normalizedAvatar === '#fff'
        || normalizedAvatar === '#ffffff'
        || /rgb\(\s*255\s*,\s*255\s*,\s*255\s*\)/i.test(normalizedAvatar);

    if (isUrlAvatar) {
        const urlMatch = normalizedAvatar.match(/url\((['"]?)(.*?)\1\)/i);
        const safeImageValue = urlMatch && urlMatch[2]
            ? `url('${urlMatch[2]}')`
            : normalizedAvatar;

        return {
            avatarContent: '',
            avatarStyle: `background-image: ${safeImageValue}; background-size: cover; background-position: center; background-repeat: no-repeat; border: 0; color: #ffffff; text-shadow: none;`
        };
    }

    if (isWhiteAvatar) {
        return {
            avatarContent: fallbackText,
            avatarStyle: `background: ${getDefaultAvatarColor(nickname)}; border: 0; color: #ffffff; text-shadow: none;`
        };
    }

    return {
        avatarContent: fallbackText,
        avatarStyle: `background: ${normalizedAvatar}; border: 0; color: #ffffff; text-shadow: none;`
    };
}

function applyAvatarRenderConfig(element, avatar, nickname = '?') {
    if (!element) return;

    const avatarConfig = getAvatarRenderConfig(avatar, nickname);
    element.removeAttribute('style');
    element.style.cssText = avatarConfig.avatarStyle;
    element.textContent = avatarConfig.avatarContent;
    element.dataset.avatarValue = typeof avatar === 'string' && avatar.trim() ? avatar.trim() : 'white';
    delete element.dataset.imageUrl;
}

// ================= 通讯录功能 =================
function renderContactsList() {
    const container = document.getElementById('contactsList');
    if (!container) return;
    
    const contacts = wechatRoles.filter(role => role.type !== 'me');
    
    if (contacts.length === 0) {
        container.innerHTML = `
            <div class="wechat-empty-state contacts-empty-state">
                <div class="wechat-empty-icon" aria-hidden="true">
                    <svg viewBox="0 0 24 24" focusable="false">
                        <path d="M9 11.25a2.75 2.75 0 1 0 0-5.5a2.75 2.75 0 0 0 0 5.5Z" />
                        <path d="M15.25 12.25a2.25 2.25 0 1 0 0-4.5a2.25 2.25 0 0 0 0 4.5Z" />
                        <path d="M4.75 18.25c0-2.2 1.8-4 4-4h.5c2.2 0 4 1.8 4 4" />
                        <path d="M14.5 18.25v-.25c0-1.52.91-2.89 2.31-3.47A3.74 3.74 0 0 1 19.25 18v.25" />
                    </svg>
                </div>
                <div class="wechat-empty-title">暂无联系人</div>
                <div class="wechat-empty-text">创建角色后，这里会自动出现联系人列表</div>
            </div>
        `;
        return;
    }
    
    container.innerHTML = contacts.map(contact => {
        const avatarConfig = getAvatarRenderConfig(contact.avatar, contact.nickname);

        return `
            <div class="chat-item" onclick="selectAndEnterChat(${contact.id})">
                <div class="avatar" style="${avatarConfig.avatarStyle}">${escapeHtml(avatarConfig.avatarContent)}</div>
                <div class="chat-info">
                    <div class="chat-name">${contact.nickname}</div>
                    <div class="chat-preview">${contact.realName}</div>
                </div>
            </div>
        `;
    }).join('');
}

// ================= 朋友圈功能 =================
let moments = [];
let lastSaveMomentsError = null;
const ROLE_MOMENT_POLICY_STORAGE_KEY = 'roleMomentPolicyState';
const ROLE_MOMENT_ENGAGEMENT_STORAGE_KEY = 'roleMomentEngagementState';
let isRoleMomentEngagementRunning = false;

function normalizeMomentMentions(rawMentions) {
    if (!Array.isArray(rawMentions)) return [];

    const seen = new Set();
    return rawMentions
        .map((mention) => {
            if (!mention || typeof mention !== 'object') return null;
            const id = String(mention.id ?? mention.roleId ?? '').trim();
            if (!id || seen.has(id)) return null;
            seen.add(id);

            const role = Array.isArray(wechatRoles)
                ? wechatRoles.find((item) => String(item?.id) === id)
                : null;
            const name = String(mention.name || mention.nickname || role?.nickname || '').trim();
            if (!name) return null;

            return {
                id,
                name,
                avatar: typeof mention.avatar === 'string' && mention.avatar.trim()
                    ? mention.avatar
                    : (role?.avatar || 'white')
            };
        })
        .filter(Boolean);
}

function isRoleMentionedInMoment(moment, roleId) {
    const id = String(roleId ?? '').trim();
    if (!id) return false;
    const mentions = normalizeMomentMentions(moment?.mentions);
    return mentions.some((mention) => String(mention.id) === id);
}

function normalizeMomentRecord(rawMoment, index = 0) {
    if (!rawMoment || typeof rawMoment !== 'object') return null;

    const safeContent = typeof rawMoment.content === 'string'
        ? rawMoment.content.trim()
        : '';
    const safeImages = Array.isArray(rawMoment.images)
        ? rawMoment.images
            .filter((img) => typeof img === 'string' && img.trim())
            .map((img) => img.trim())
        : [];
    const safeLikes = Array.isArray(rawMoment.likes)
        ? rawMoment.likes.filter((like) => {
            if (typeof like === 'string') return like.trim().length > 0;
            if (!like || typeof like !== 'object') return false;
            return typeof like.name === 'string' && like.name.trim().length > 0;
        })
        : [];
    const safeComments = Array.isArray(rawMoment.comments)
        ? rawMoment.comments.filter((comment) => {
            if (!comment || typeof comment !== 'object') return false;
            return typeof comment.author === 'string' && comment.author.trim()
                && typeof comment.content === 'string' && comment.content.trim();
        })
        : [];

    if (!safeContent && safeImages.length === 0) {
        return null;
    }

    const safeTimestamp = Number.isFinite(Number(rawMoment.timestamp))
        ? Number(rawMoment.timestamp)
        : Date.now() - index;

    return {
        ...rawMoment,
        id: typeof rawMoment.id === 'string' && rawMoment.id.trim()
            ? rawMoment.id
            : `moment_legacy_${safeTimestamp}_${index}`,
        author: typeof rawMoment.author === 'string' && rawMoment.author.trim()
            ? rawMoment.author.trim()
            : (wechatUser?.nickname || '我'),
        avatar: typeof rawMoment.avatar === 'string' && rawMoment.avatar.trim()
            ? rawMoment.avatar
            : (wechatUser?.avatar || 'white'),
        content: safeContent,
        images: safeImages,
        mentions: normalizeMomentMentions(rawMoment.mentions),
        likes: safeLikes,
        comments: safeComments,
        timestamp: safeTimestamp
    };
}

function sanitizeMomentsCollection(rawMoments) {
    if (!Array.isArray(rawMoments)) {
        return {
            moments: [],
            changed: true
        };
    }

    let changed = false;
    const normalized = [];

    rawMoments.forEach((item, index) => {
        const next = normalizeMomentRecord(item, index);
        if (!next) {
            changed = true;
            return;
        }

        normalized.push(next);

        try {
            if (JSON.stringify(item) !== JSON.stringify(next)) {
                changed = true;
            }
        } catch (error) {
            changed = true;
        }
    });

    if (normalized.length !== rawMoments.length) {
        changed = true;
    }

    return {
        moments: normalized,
        changed
    };
}

function loadMoments() {
    const saved = localStorage.getItem('wechatMoments');
    let parsed = [];

    if (saved) {
        try {
            parsed = JSON.parse(saved);
        } catch (e) {
            parsed = [];
        }
    }

    const { moments: sanitizedMoments, changed } = sanitizeMomentsCollection(parsed);
    moments = sanitizedMoments;

    if (changed) {
        const savedOk = saveMoments();
        if (!savedOk) {
            console.warn('清洗朋友圈数据后回写失败:', lastSaveMomentsError);
        }
    }

    migrateMomentsImageStorage();
}

async function migrateMomentsImageStorage(options = {}) {
    if (!Array.isArray(moments) || moments.length === 0) {
        return {
            changed: false,
            migratedCount: 0,
            droppedCount: 0
        };
    }

    const {
        dropDataUrlOnFailure = false,
        persist = true
    } = options;

    let changed = false;
    let migratedCount = 0;
    let droppedCount = 0;

    for (const moment of moments) {
        if (!Array.isArray(moment.images) || moment.images.length === 0) continue;

        const nextImages = [];
        for (const image of moment.images) {
            if (isMediaRef(image)) {
                nextImages.push(image);
                continue;
            }

            if (isDataImageUrl(image)) {
                try {
                    const imageId = await saveChatImageToDB(
                        { name: '朋友圈图片', type: 'image/jpeg' },
                        image
                    );
                    nextImages.push(buildMediaRef(imageId));
                    changed = true;
                    migratedCount += 1;
                } catch (error) {
                    console.error('迁移朋友圈图片失败:', error);

                    if (dropDataUrlOnFailure) {
                        changed = true;
                        droppedCount += 1;
                        continue;
                    }

                    nextImages.push(image);
                }
                continue;
            }

            nextImages.push(image);
        }

        moment.images = nextImages;
    }

    if (changed && persist) {
        const saved = saveMoments();
        if (!saved) {
            console.warn('迁移后保存朋友圈失败:', lastSaveMomentsError);
        }
    }

    return {
        changed,
        migratedCount,
        droppedCount
    };
}

async function hydrateMomentForRender(moment) {
    if (!moment || !Array.isArray(moment.images) || moment.images.length === 0) {
        return moment;
    }

    const hydratedImages = await Promise.all(
        moment.images.map(async (img) => {
            if (isMediaRef(img)) {
                return (await resolveMediaRefToDataUrl(img)) || '';
            }
            return img;
        })
    );

    return {
        ...moment,
        images: hydratedImages.filter(Boolean)
    };
}

function saveMomentsStrict() {
    localStorage.setItem('wechatMoments', JSON.stringify(moments));
    return true;
}

function saveMoments() {
    try {
        lastSaveMomentsError = null;
        saveMomentsStrict();
        return true;
    } catch (error) {
        lastSaveMomentsError = error;
        console.error('保存朋友圈动态失败:', error);
        return false;
    }
}

function safeReadStorageJSON(key, fallback = null) {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;

    try {
        return JSON.parse(raw);
    } catch (error) {
        console.warn(`解析存储数据失败: ${key}`, error);
        return fallback;
    }
}

function safeWriteStorageJSON(key, value) {
    try {
        localStorage.setItem(key, JSON.stringify(value));
        return true;
    } catch (error) {
        console.warn(`写入存储数据失败: ${key}`, error);
        return false;
    }
}

function trimRoleChatHistoryForStorage(maxMessages = 30) {
    if (!Array.isArray(wechatRoles) || wechatRoles.length === 0) return 0;

    let trimmedRoles = 0;
    const touchedRoleIds = new Set();

    wechatRoles.forEach((role) => {
        const roleId = role?.id;
        if (!roleId) return;

        let trimmedThisRole = false;

        ['online', 'offline'].forEach((mode) => {
            const chatKey = getChatStorageKey(roleId, mode);
            const history = safeReadStorageJSON(chatKey, null);
            if (!Array.isArray(history) || history.length <= maxMessages) return;

            const trimmedHistory = history.slice(-maxMessages);
            if (safeWriteStorageJSON(chatKey, trimmedHistory)) {
                trimmedThisRole = true;
            }
        });

        const sharedEventsKey = getSharedEventsStorageKey(roleId);
        const sharedEvents = safeReadStorageJSON(sharedEventsKey, null);
        if (Array.isArray(sharedEvents) && sharedEvents.length > 40) {
            if (safeWriteStorageJSON(sharedEventsKey, sharedEvents.slice(-40))) {
                trimmedThisRole = true;
            }
        }

        if (trimmedThisRole && !touchedRoleIds.has(roleId)) {
            touchedRoleIds.add(roleId);
            trimmedRoles += 1;
        }
    });

    return trimmedRoles;
}

function cleanupNonCriticalStorageForMomentPublish() {
    const actions = [];

    ['moment_draft', 'momentPostDraft', 'wechatMomentPostDraft'].forEach((key) => {
        if (localStorage.getItem(key) !== null) {
            localStorage.removeItem(key);
            actions.push(`清理草稿(${key})`);
        }
    });

    const stickerLibrary = safeReadStorageJSON(CHAT_STICKER_STORAGE_KEY, null);
    if (Array.isArray(stickerLibrary) && stickerLibrary.length > 0) {
        const before = stickerLibrary.length;
        let nextLibrary = stickerLibrary.filter((item) => {
            const url = typeof item?.url === 'string' ? item.url : '';
            return !(isDataImageUrl(url) && url.length > 420000);
        });

        if (nextLibrary.length > 16) {
            nextLibrary = nextLibrary.slice(0, 16);
        }

        if (nextLibrary.length === 0) {
            nextLibrary = [...DEFAULT_CHAT_STICKERS];
        }

        if (nextLibrary.length !== before && safeWriteStorageJSON(CHAT_STICKER_STORAGE_KEY, nextLibrary)) {
            chatStickerLibrary = nextLibrary;
            actions.push(`精简表情库(${before}→${nextLibrary.length})`);
        }
    }

    const trimmedRoleCount = trimRoleChatHistoryForStorage(18);
    if (trimmedRoleCount > 0) {
        actions.push(`精简${trimmedRoleCount}个角色聊天记录`);
    }

    // 仅清理聊天相关图片缓存：不触碰壁纸/朋友圈封面/头像
    clearChatImageSessionCache();
    clearStoredMediaReferences();
    actions.push('清理聊天图片会话缓存与引用');

    return actions;
}

function makeMomentStorageLiteRecord(moment) {
    const source = moment && typeof moment === 'object' ? moment : {};
    const safeContent = typeof source.content === 'string'
        ? source.content.trim().slice(0, 500)
        : '';
    const safeAuthor = typeof source.author === 'string' && source.author.trim()
        ? source.author.trim()
        : (wechatUser?.nickname || '我');

    return {
        id: typeof source.id === 'string' && source.id.trim()
            ? source.id
            : `moment_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        author: safeAuthor,
        content: safeContent,
        timestamp: Number.isFinite(Number(source.timestamp)) ? Number(source.timestamp) : Date.now(),
        mentions: normalizeMomentMentions(source.mentions),
        likes: Array.isArray(source.likes) ? source.likes.slice(0, 20) : [],
        comments: Array.isArray(source.comments)
            ? source.comments
                .filter((item) => item && typeof item === 'object')
                .slice(0, 30)
                .map((item) => ({
                    author: typeof item.author === 'string' ? item.author.slice(0, 40) : '用户',
                    content: typeof item.content === 'string' ? item.content.slice(0, 220) : ''
                }))
                .filter((item) => item.content)
            : []
    };
}

function buildLiteMomentsCollection(sourceMoments = [], keepCount = 80) {
    if (!Array.isArray(sourceMoments)) return [];

    const compacted = sourceMoments
        .filter((item) => item && typeof item === 'object')
        .slice(0, Math.max(1, keepCount))
        .map(makeMomentStorageLiteRecord)
        .filter((item) => item.content);

    return compacted;
}

function buildMentionedMomentsContext(roleId, maxItems = 3) {
    if (!Array.isArray(moments) || !roleId) return '';

    const roleIdText = String(roleId);
    const related = moments
        .filter((moment) => moment && isRoleMentionedInMoment(moment, roleIdText))
        .sort((a, b) => (Number(b.timestamp) || 0) - (Number(a.timestamp) || 0))
        .slice(0, Math.max(1, maxItems))
        .map((moment, index) => {
            const author = String(moment.author || wechatUser?.nickname || '用户').trim();
            const content = String(moment.content || '').replace(/\s+/g, ' ').trim() || '（无文字）';
            return `${index + 1}. ${author}发布动态并@了你：${truncateSharedSummary(content, 90)}`;
        });

    if (related.length === 0) return '';
    return `\n【被提醒看的朋友圈】\n${related.join('\n')}\n这些动态是对方特意提醒你看的。你可以在聊天里自然记得这件事，但不要生硬复述系统信息。`;
}

function getLocalDateKey(date = new Date()) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function getNowMinutesOfDay(date = new Date()) {
    return date.getHours() * 60 + date.getMinutes();
}

function getRandomIntInclusive(min, max) {
    const low = Math.ceil(min);
    const high = Math.floor(max);
    return Math.floor(Math.random() * (high - low + 1)) + low;
}

function generateDailyRandomMomentSlots(maxPerDay = 1) {
    const count = getRandomIntInclusive(0, maxPerDay); // 每天 0~1 条，配合5天保底
    const slots = new Set();

    // 时间范围：08:00 - 23:00
    const startMinute = 8 * 60;
    const endMinute = 23 * 60;

    while (slots.size < count) {
        slots.add(getRandomIntInclusive(startMinute, endMinute));
    }

    return Array.from(slots).sort((a, b) => a - b);
}

function getRoleLatestMomentTimestamp(roleId) {
    if (!Array.isArray(moments) || !roleId) return null;

    let latest = null;
    moments.forEach((moment) => {
        if (moment?.roleId !== roleId) return;
        const ts = Number(moment?.timestamp);
        if (!Number.isFinite(ts)) return;

        if (!latest || ts > latest) {
            latest = ts;
        }
    });

    return latest;
}

function loadRoleMomentPolicyState() {
    const state = safeReadStorageJSON(ROLE_MOMENT_POLICY_STORAGE_KEY, {});
    if (!state || typeof state !== 'object') return {};
    return state;
}

function saveRoleMomentPolicyState(state) {
    return safeWriteStorageJSON(ROLE_MOMENT_POLICY_STORAGE_KEY, state || {});
}

function loadRoleMomentEngagementState() {
    const state = safeReadStorageJSON(ROLE_MOMENT_ENGAGEMENT_STORAGE_KEY, {});
    if (!state || typeof state !== 'object') return {};
    return state;
}

function saveRoleMomentEngagementState(state) {
    return safeWriteStorageJSON(ROLE_MOMENT_ENGAGEMENT_STORAGE_KEY, state || {});
}

function getRolePersonalityProfile(role) {
    const text = String(role?.systemPrompt || '').toLowerCase();

    let likeProbability = 0.28;
    let commentProbability = 0.18;
    let dailyCommentLimit = 2;

    if (/冷漠|高冷|无情|寡言|疏离|淡漠/.test(text)) {
        likeProbability = 0.08;
        commentProbability = 0.05;
        dailyCommentLimit = 1;
    } else if (/活泼|开朗|外向|热情|话痨|社牛/.test(text)) {
        likeProbability = 0.6;
        commentProbability = 0.42;
        dailyCommentLimit = 4;
    } else if (/温柔|贴心|细腻|治愈/.test(text)) {
        likeProbability = 0.45;
        commentProbability = 0.3;
        dailyCommentLimit = 3;
    } else if (/傲娇|毒舌|别扭/.test(text)) {
        likeProbability = 0.2;
        commentProbability = 0.14;
        dailyCommentLimit = 2;
    }

    return {
        likeProbability,
        commentProbability,
        dailyCommentLimit
    };
}

function getRoleDailyCommentCount(state, roleId, dateKey) {
    const roleState = state?.[roleId];
    if (!roleState || roleState.dateKey !== dateKey) return 0;
    return Number(roleState.dailyCommentCount) || 0;
}

function ensureRoleEngagementState(state, roleId, dateKey) {
    if (!state[roleId] || typeof state[roleId] !== 'object') {
        state[roleId] = {
            dateKey,
            dailyCommentCount: 0,
            interactedMoments: {}
        };
        return;
    }

    if (state[roleId].dateKey !== dateKey) {
        state[roleId].dateKey = dateKey;
        state[roleId].dailyCommentCount = 0;
    }

    if (!state[roleId].interactedMoments || typeof state[roleId].interactedMoments !== 'object') {
        state[roleId].interactedMoments = {};
    }
}

function hasRoleInteractedWithMoment(state, roleId, momentId) {
    return !!state?.[roleId]?.interactedMoments?.[momentId];
}

function getRoleMomentInteraction(state, roleId, momentId) {
    const interaction = state?.[roleId]?.interactedMoments?.[momentId];
    return interaction && typeof interaction === 'object' ? interaction : null;
}

function markRoleInteractedWithMoment(state, roleId, momentId, detail = {}) {
    if (!state?.[roleId]?.interactedMoments) return;
    const previous = getRoleMomentInteraction(state, roleId, momentId);
    state[roleId].interactedMoments[momentId] = {
        liked: !!(previous?.liked || detail.liked),
        commented: !!(previous?.commented || detail.commented),
        timestamp: Date.now()
    };
}

function isRoleAlreadyLikedMoment(moment, roleName) {
    if (!Array.isArray(moment?.likes)) return false;
    return moment.likes.some((like) => {
        if (typeof like === 'string') return like === roleName;
        return like?.name === roleName;
    });
}

function isRoleAlreadyCommentedMoment(moment, roleName) {
    if (!Array.isArray(moment?.comments)) return false;
    return moment.comments.some((comment) => comment?.author === roleName);
}

function isUserAuthoredMoment(moment) {
    if (!moment || moment.roleId) return false;
    const author = String(moment.author || '').trim();
    const userName = String(wechatUser?.nickname || '').trim();
    return !author || author === userName || author === '我';
}

function shouldRoleLikeMoment(role, moment) {
    const profile = getRolePersonalityProfile(role);
    let score = profile.likeProbability;
    const mentioned = isRoleMentionedInMoment(moment, role?.id);

    if (mentioned) {
        score += 0.36;
    }

    if (typeof moment?.content === 'string' && moment.content.length <= 18) {
        score += 0.06;
    }

    if (Array.isArray(moment?.images) && moment.images.length > 0) {
        score += 0.08;
    }

    return Math.random() < Math.min(0.92, Math.max(0.01, score));
}

function shouldRoleCommentMoment(role, moment, state, dateKey) {
    const profile = getRolePersonalityProfile(role);
    const roleId = String(role.id);
    const dailyCount = getRoleDailyCommentCount(state, roleId, dateKey);
    const isUserMoment = isUserAuthoredMoment(moment);
    const mentioned = isRoleMentionedInMoment(moment, roleId);
    const dailyLimit = profile.dailyCommentLimit + (isUserMoment ? 1 : 0) + (mentioned ? 1 : 0);

    if (dailyCount >= dailyLimit) {
        return false;
    }

    let score = profile.commentProbability;
    const commentsCount = Array.isArray(moment?.comments) ? moment.comments.length : 0;

    if (mentioned) {
        score += commentsCount === 0 ? 0.62 : 0.42;
    }

    if (isUserMoment) {
        score += commentsCount === 0 ? 0.34 : 0.16;
    }

    if (typeof moment?.content === 'string' && moment.content.length > 40) {
        score += 0.06;
    }

    if (typeof moment?.content === 'string' && moment.content.trim().length <= 18) {
        score += 0.08;
    }

    if (commentsCount >= 3) {
        score -= 0.08;
    }

    return Math.random() < Math.min(mentioned ? 0.96 : (isUserMoment ? 0.88 : 0.72), Math.max(0.01, score));
}

function getRoleMomentPreferenceHint(role) {
    const text = String(role?.systemPrompt || '');
    if (/冷漠|高冷|无情|寡言|疏离/.test(text)) {
        return '偏好：简短、克制、低情绪表达，不主动热络。';
    }
    if (/活泼|开朗|外向|热情|话痨|社牛/.test(text)) {
        return '偏好：有互动感、情绪表达更明显、语气更生动。';
    }
    if (/温柔|贴心|细腻|治愈/.test(text)) {
        return '偏好：关注感受、表达温和、措辞体贴。';
    }
    if (/傲娇|毒舌|别扭/.test(text)) {
        return '偏好：嘴硬一点、带轻微反差感，但不要恶意攻击。';
    }
    return '偏好：自然口语，不模板化。';
}

function buildFallbackRoleMomentComment(role) {
    const text = String(role?.systemPrompt || '');
    if (/冷漠|高冷|无情|寡言|疏离/.test(text)) {
        return ['嗯。', '知道了。', '看到了。'][Math.floor(Math.random() * 3)];
    }
    if (/活泼|开朗|外向|热情|话痨|社牛/.test(text)) {
        return ['哈哈这个有点意思', '你这条我笑了', '今天状态不错啊'][Math.floor(Math.random() * 3)];
    }
    if (/温柔|贴心|细腻|治愈/.test(text)) {
        return ['这条看着很舒服', '有被你这句话打动', '你今天这条很有感觉'][Math.floor(Math.random() * 3)];
    }
    if (/傲娇|毒舌|别扭/.test(text)) {
        return ['一般吧，也就还行', '勉强给你点个赞', '算你这条还过得去'][Math.floor(Math.random() * 3)];
    }
    return ['收到', '有点意思', '这条不错'][Math.floor(Math.random() * 3)];
}

async function generateRoleMomentComment(role, moment) {
    if (!apiSettings?.apiKey) {
        return buildFallbackRoleMomentComment(role);
    }

    const mentionedHint = isRoleMentionedInMoment(moment, role?.id)
        ? '\n注意：这条动态发布时特意 @ 了你，也就是“提醒你看”。评论时要自然体现你知道自己被点名了，但不要机械复述“我被@了”。'
        : '';

    const prompt = `你是${role.nickname}，性格：${role.systemPrompt}。
${getRoleMomentPreferenceHint(role)}
现在要给一条朋友圈写评论。
动态内容：${moment?.content || '（无文字）'}
${mentionedHint}
请按你的性格和喜好评论，不要脱离人设。
请只输出一句简短评论（5-22字），像真人微信评论，不要解释，不要加引号。`;

    try {
        const response = await fetch(buildApiUrl(CONFIG.CHAT_COMPLETIONS_PATH), {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiSettings.apiKey}`
            },
            body: JSON.stringify({
                model: apiSettings.modelName || CONFIG.DEFAULT_MODEL,
                messages: [
                    { role: 'system', content: prompt },
                    { role: 'user', content: '请直接给出评论正文。' }
                ],
                temperature: 0.9,
                max_tokens: 80
            })
        });

        if (!response.ok) {
            return buildFallbackRoleMomentComment(role);
        }

        const data = await response.json();
        let text = sanitizeAIResponse(data?.choices?.[0]?.message?.content || '', role.nickname)
            .replace(/[\r\n]+/g, ' ')
            .trim();

        if (!text) {
            return buildFallbackRoleMomentComment(role);
        }

        if (text.length > 28) {
            text = text.slice(0, 28).trim();
        }

        return text;
    } catch (error) {
        console.warn('角色自动评论生成失败，使用兜底文案:', error);
        return buildFallbackRoleMomentComment(role);
    }
}

async function checkAndGenerateRoleEngagements() {
    if (isRoleMomentEngagementRunning) return;
    if (!Array.isArray(moments) || moments.length === 0) return;
    if (!Array.isArray(wechatRoles) || wechatRoles.length === 0) return;

    isRoleMomentEngagementRunning = true;

    try {
        const dateKey = getLocalDateKey(new Date());
        const state = loadRoleMomentEngagementState();
        let changed = false;

        const roleCandidates = wechatRoles.filter((role) => role && role.type === 'ai');
        if (roleCandidates.length === 0) return;

        for (const role of roleCandidates) {
            const roleId = String(role.id);
            ensureRoleEngagementState(state, roleId, dateKey);

            for (const moment of moments) {
                if (!moment) continue;

                const momentId = String(moment.id || `${moment.timestamp || Date.now()}_${moment.author || 'unknown'}`);
                if (!moment.id) {
                    moment.id = momentId;
                    changed = true;
                }

                // 不给自己动态互动
                if (moment.roleId && String(moment.roleId) === roleId) continue;

                const authorName = String(moment.author || '').trim();
                if (authorName && authorName === role.nickname) continue;

                const previousInteraction = getRoleMomentInteraction(state, roleId, momentId);
                const alreadyLiked = isRoleAlreadyLikedMoment(moment, role.nickname);
                const alreadyCommented = isRoleAlreadyCommentedMoment(moment, role.nickname);

                if (previousInteraction?.liked && previousInteraction?.commented) continue;

                let liked = false;
                let commented = false;

                if (!alreadyLiked && !previousInteraction?.liked && shouldRoleLikeMoment(role, moment)) {
                    if (!Array.isArray(moment.likes)) moment.likes = [];
                    moment.likes.push({
                        name: role.nickname,
                        avatar: role.avatar || 'white'
                    });
                    liked = true;
                    changed = true;
                }

                if (!alreadyCommented && !previousInteraction?.commented && shouldRoleCommentMoment(role, moment, state, dateKey)) {
                    if (!Array.isArray(moment.comments)) moment.comments = [];
                    if (moment.comments.length < 8) {
                        const commentText = await generateRoleMomentComment(role, moment);
                        if (commentText) {
                            moment.comments.push({
                                author: role.nickname,
                                content: commentText
                            });
                            state[roleId].dailyCommentCount = (Number(state[roleId].dailyCommentCount) || 0) + 1;
                            commented = true;
                            changed = true;
                        }
                    }
                }

                const shouldUpdateInteractionState = liked
                    || commented
                    || (alreadyLiked && !previousInteraction?.liked)
                    || (alreadyCommented && !previousInteraction?.commented);

                if (shouldUpdateInteractionState) {
                    markRoleInteractedWithMoment(state, roleId, momentId, {
                        liked: liked || alreadyLiked,
                        commented: commented || alreadyCommented
                    });
                    changed = true;
                }
            }
        }

        if (changed) {
            saveRoleMomentEngagementState(state);
            saveMoments();
        }
    } finally {
        isRoleMomentEngagementRunning = false;
    }
}

// 格式化动态时间显示
function formatMomentTime(timestamp) {
    if (!timestamp) return '刚刚';
    
    const now = Date.now();
    const diff = now - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    
    if (minutes < 1) return '刚刚';
    if (minutes < 60) return `${minutes}分钟前`;
    if (hours < 24) return `${hours}小时前`;
    if (days < 7) return `${days}天前`;
    
    const date = new Date(timestamp);
    return `${date.getMonth() + 1}月${date.getDate()}日`;
}

// 渲染朋友圈界面
async function renderMomentsList() {
    // 先渲染封面区域
    renderMomentsCover();
    
    // 触发角色自动发动态检查
    await checkAndGenerateRoleMoments();
    // 触发角色根据人设自动点赞评论
    await checkAndGenerateRoleEngagements();
    
    const container = document.getElementById('momentsList');
    if (!container) return;

    const sanitized = sanitizeMomentsCollection(moments);
    if (sanitized.changed) {
        moments = sanitized.moments;
        saveMoments();
    }

    if (!Array.isArray(moments) || moments.length === 0) {
        container.innerHTML = `
            <div class="moments-empty">
                <div class="icon">📷</div>
                <div class="text">暂无动态，快去发布第一条吧</div>
            </div>
        `;
        return;
    }
    
    // 按时间排序（最新在前）
    const sortedMoments = [...moments].sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

    const htmlParts = [];
    for (const sourceMoment of sortedMoments) {
        try {
            const hydratedMoment = await hydrateMomentForRender(sourceMoment);
            const originalIndex = moments.indexOf(sourceMoment);
            htmlParts.push(renderMomentItem(hydratedMoment, originalIndex >= 0 ? originalIndex : 0));
        } catch (error) {
            console.warn('渲染单条朋友圈失败，已跳过异常数据:', error, sourceMoment);
        }
    }

    if (htmlParts.length === 0) {
        container.innerHTML = `
            <div class="moments-empty">
                <div class="icon">📷</div>
                <div class="text">暂无可显示的动态（异常数据已自动跳过）</div>
            </div>
        `;
        return;
    }

    container.innerHTML = htmlParts.join('');
}

// 渲染封面区域
function renderMomentsCover() {
    const cover = document.getElementById('momentsCover');
    const userName = document.getElementById('momentsUserName');
    const userAvatar = document.getElementById('momentsUserAvatar');
    
    if (!cover || !userName || !userAvatar) return;
    
    cover.onclick = showMomentsBackgroundSettings;
    cover.style.cursor = 'pointer';
    cover.title = '点击更换封面';
    
    const shouldShowHint = !momentsBackgroundSettings.background || momentsBackgroundSettings.background === MOMENTS_BACKGROUND_PRESETS[0].value;
    const existingHint = cover.querySelector('.moments-cover-hint');
    if (shouldShowHint) {
        if (!existingHint) {
            const hint = document.createElement('div');
            hint.className = 'moments-cover-hint';
            hint.textContent = '点击更换封面';
            hint.style.position = 'absolute';
            hint.style.top = '50%';
            hint.style.left = '50%';
            hint.style.transform = 'translate(-50%, -50%)';
            hint.style.color = '#fff';
            hint.style.fontSize = '14px';
            hint.style.fontWeight = '600';
            hint.style.textShadow = '0 2px 8px rgba(0, 0, 0, 0.35)';
            hint.style.pointerEvents = 'none';
            hint.style.zIndex = '1';
            cover.appendChild(hint);
        }
    } else if (existingHint) {
        existingHint.remove();
    }
    
    // 设置用户名
    userName.textContent = wechatUser.nickname || '我';
    
    // 设置用户头像
    applyAvatarRenderConfig(userAvatar, wechatUser.avatar, wechatUser.nickname || '我');
    
    // 设置封面背景（优先使用用户已设置的朋友圈背景）
    const configuredBackground = momentsBackgroundSettings && momentsBackgroundSettings.background;
    if (configuredBackground) {
        if (configuredBackground.includes('url(')) {
            cover.style.background = configuredBackground;
            cover.style.backgroundSize = 'cover';
            cover.style.backgroundPosition = 'center';
        } else {
            cover.style.background = configuredBackground;
            cover.style.backgroundSize = '';
            cover.style.backgroundPosition = '';
        }
        return;
    }

    // 回退：使用第一个带图片头像的角色
    const firstRole = wechatRoles.find(r => r.avatar && r.avatar.includes('url('));
    if (firstRole) {
        cover.style.background = firstRole.avatar;
        cover.style.backgroundSize = 'cover';
        cover.style.backgroundPosition = 'center';
        return;
    }

    // 最终回退：默认渐变
    cover.style.background = MOMENTS_BACKGROUND_PRESETS[0].value;
    cover.style.backgroundSize = '';
    cover.style.backgroundPosition = '';
}

function createMomentComment({
    author = '用户',
    content = '',
    replyToCommentId = null,
    replyToAuthor = ''
} = {}) {
    return {
        id: `comment_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        author: String(author || '用户').trim() || '用户',
        content: String(content || '').trim(),
        replyToCommentId: replyToCommentId || null,
        replyToAuthor: String(replyToAuthor || '').trim()
    };
}

// 渲染单条动态
function renderMomentItem(moment, index) {
    // 获取角色信息
    let role = null;
    if (moment.roleId) {
        role = wechatRoles.find(r => r.id === moment.roleId);
    }
    
    const authorName = role ? role.nickname : moment.author || wechatUser.nickname;
    const authorAvatar = role ? role.avatar : moment.avatar || wechatUser.avatar;
    
    const avatarConfig = getAvatarRenderConfig(authorAvatar, authorName || '?');
    const avatarContent = escapeHtml(avatarConfig.avatarContent);
    const avatarStyle = avatarConfig.avatarStyle;
    const mentions = normalizeMomentMentions(moment.mentions);
    const mentionsHTML = mentions.length > 0
        ? `<div class="moment-mentions">${mentions.map((mention) => `<span class="moment-mention-tag">@${escapeHtml(mention.name)}</span>`).join('')}</div>`
        : '';
    
    const userLiked = !!(moment.likes && moment.likes.some(like => {
        if (typeof like === 'string') return like === wechatUser.nickname;
        return like.name === wechatUser.nickname;
    }));

    // 点赞列表
    let likesHtml = '';
    if (moment.likes && moment.likes.length > 0) {
        const likeNames = moment.likes.map(like => {
            if (typeof like === 'string') return like;
            return like.name || '用户';
        }).join(', ');
        likesHtml = `
            <div class="moment-likes">
                <span class="like-icon">♥</span>
                <span class="like-names">${likeNames}</span>
            </div>
        `;
    }
    
    // 评论列表
    let commentsHtml = '';
    if (moment.comments && moment.comments.length > 0) {
        commentsHtml = `
            <div class="moment-comments">
                ${moment.comments.map(comment => `
                    <div class="moment-comment" onclick="showCommentInput(${index}, '${comment.id || ''}')">
                        <span class="comment-author">${comment.author}</span>
                        ：<span class="comment-content">${comment.content}</span>
                    </div>
                `).join('')}
            </div>
        `;
    }
    
    // 图片区域
    let imagesHtml = '';
    if (moment.images && moment.images.length > 0) {
        const imageClass = moment.images.length === 1 ? 'single' : 
                          moment.images.length === 2 ? 'double' : 
                          moment.images.length <= 3 ? 'triple' : 'multi';
        imagesHtml = `
            <div class="moment-images ${imageClass}">
                ${moment.images.map(img => `<img class="moment-image" src="${img}" alt="">`).join('')}
            </div>
        `;
    }
    
    return `
        <div class="moment-item" data-index="${index}">
            <div class="moment-avatar" style="${avatarStyle}">${avatarContent}</div>
            <div class="moment-body">
                <div class="moment-author">${authorName}</div>
                <div class="moment-content">${moment.content}</div>
                ${mentionsHTML}
                ${imagesHtml}
                <div class="moment-footer">
                    <div class="moment-meta">
                        <div class="moment-time">${formatMomentTime(moment.timestamp)}</div>
                        <button class="moment-delete-btn" type="button" onclick="deleteMoment(${index})" aria-label="删除动态" title="删除动态">
                            <svg viewBox="0 0 24 24" aria-hidden="true">
                                <path d="M9 3.75h6a1 1 0 0 1 1 1V6h3a.75.75 0 0 1 0 1.5h-1.02l-.83 10.03A2.5 2.5 0 0 1 14.66 20H9.34a2.5 2.5 0 0 1-2.49-2.47L6.02 7.5H5a.75.75 0 0 1 0-1.5h3V4.75a1 1 0 0 1 1-1Zm5.5 2.25V5.25H9.5V6h5ZM7.53 7.5l.82 9.91a1 1 0 0 0 .99.99h5.32a1 1 0 0 0 .99-.99l.82-9.91H7.53Zm2.72 2.25c.41 0 .75.34.75.75v5a.75.75 0 0 1-1.5 0v-5c0-.41.34-.75.75-.75Zm3.5 0c.41 0 .75.34.75.75v5a.75.75 0 0 1-1.5 0v-5c0-.41.34-.75.75-.75Z" />
                            </svg>
                        </button>
                    </div>
                    <div class="moment-actions">
                        <button class="moment-action-link${userLiked ? ' is-active' : ''}" type="button" onclick="likeMoment(${index})" aria-label="${userLiked ? '取消点赞' : '点赞'}" aria-pressed="${userLiked ? 'true' : 'false'}">
                            <span class="moment-action-symbol moment-action-symbol-like" aria-hidden="true">${userLiked ? '♥' : '♡'}</span>
                            <span class="moment-action-count">${moment.likes ? moment.likes.length : 0}</span>
                        </button>
                        <span class="moment-action-separator" aria-hidden="true"></span>
                        <button class="moment-action-link moment-action-link-comment" type="button" onclick="showCommentInput(${index})" aria-label="评论">
                            <span class="moment-action-symbol moment-action-symbol-comment" aria-hidden="true"></span>
                        </button>
                    </div>
                </div>
                ${likesHtml}
                ${commentsHtml}
            </div>
        </div>
    `;
}

function deleteMoment(index) {
    const moment = moments[index];
    if (!moment) return;
    
    if (!confirm('确定删除这条动态吗？')) {
        return;
    }
    
    moments.splice(index, 1);
    saveMoments();
    renderMomentsList();
    
    if (window.DataManager) {
        DataManager.showToast('动态已删除');
    }
}

// 点赞功能 - 添加用户头像到likes数组
function likeMoment(index) {
    if (!moments[index].likes) {
        moments[index].likes = [];
    }
    
    // 检查用户是否已点赞
    const userLiked = moments[index].likes.some(like => {
        if (typeof like === 'string') return like === wechatUser.nickname;
        return like.name === wechatUser.nickname;
    });
    
    if (userLiked) {
        // 取消点赞
        moments[index].likes = moments[index].likes.filter(like => {
            if (typeof like === 'string') return like !== wechatUser.nickname;
            return like.name !== wechatUser.nickname;
        });
    } else {
        // 添加点赞
        moments[index].likes.push({
            name: wechatUser.nickname,
            avatar: wechatUser.avatar
        });
    }
    
    saveMoments();
    renderMomentsList();
}

// 显示评论输入框
let currentCommentIndex = -1;
let currentCommentTarget = null;

function ensureMomentCommentIds(moment) {
    if (!moment || !Array.isArray(moment.comments)) return false;

    let changed = false;
    moment.comments = moment.comments.map((comment, idx) => {
        if (!comment || typeof comment !== 'object') return comment;

        if (!comment.id) {
            changed = true;
            return {
                ...comment,
                id: `comment_legacy_${Date.now()}_${idx}_${Math.random().toString(36).slice(2, 8)}`,
                replyToCommentId: comment.replyToCommentId || null,
                replyToAuthor: comment.replyToAuthor || ''
        
    };
        }

        if (comment.replyToCommentId === undefined || comment.replyToAuthor === undefined) {
            changed = true;
            return {
                ...comment,
                replyToCommentId: comment.replyToCommentId || null,
                replyToAuthor: comment.replyToAuthor || ''
        
    };
        }

        return comment;
    });

    return changed;
}

function closeCommentInput(shouldResetIndex = true) {
    const overlay = document.querySelector('.comment-input-overlay');
    if (overlay) {
        overlay.remove();
    }

    if (shouldResetIndex) {
        currentCommentIndex = -1;
        currentCommentTarget = null;
    }
}

function updateCommentSendButtonState() {
    const input = document.getElementById('commentInput');
    const sendBtn = document.querySelector('.comment-input-modal .send-btn');

    if (!sendBtn) return;

    const hasContent = !!(input && input.value.trim());
    sendBtn.disabled = !hasContent;
}

function showCommentInput(index, replyCommentId = null) {
    closeCommentInput(false);
    currentCommentIndex = index;

    const moment = moments[index];
    if (!moment) return;

    const commentIdsChanged = ensureMomentCommentIds(moment);
    if (commentIdsChanged) {
        saveMoments();
    }

    let placeholderName = '';
    currentCommentTarget = null;

    if (replyCommentId) {
        const targetComment = Array.isArray(moment.comments)
            ? moment.comments.find(comment => comment && comment.id === replyCommentId)
            : null;

        if (targetComment) {
            currentCommentTarget = {
                commentId: targetComment.id,
                author: targetComment.author || ''
        
    };
            placeholderName = targetComment.author || '';
        }
    }

    if (!placeholderName) {
        const role = moment.roleId ? wechatRoles.find(r => r.id === moment.roleId) : null;
        placeholderName = role ? role.nickname : (moment.author || '');
    }

    const overlay = document.createElement('div');
    overlay.className = 'comment-input-overlay active';
    overlay.innerHTML = `
        <div class="comment-input-modal">
            <input type="text" id="commentInput" placeholder="对 ${placeholderName} 说点什么..." autofocus>
            <button class="send-btn" type="button" onclick="submitComment()" disabled>发送</button>
        </div>
    `;
    
    document.getElementById('app-wechat').appendChild(overlay);
    
    const input = overlay.querySelector('#commentInput');
    
    setTimeout(() => {
        if (input) input.focus();
    }, 100);
    
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
            closeCommentInput();
            currentCommentIndex = -1;
        }
    });
    
    const modal = overlay.querySelector('.comment-input-modal');
    if (modal) {
        modal.addEventListener('click', (e) => {
            e.stopPropagation();
        });
    }
    
    if (input) {
        input.addEventListener('input', updateCommentSendButtonState);
        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                submitComment();
            }
        });
    }

    updateCommentSendButtonState();
}

// 提交评论
async function submitComment() {
    const input = document.getElementById('commentInput');
    const sendBtn = document.querySelector('.comment-input-modal .send-btn');
    const comment = input ? input.value.trim() : '';

    if (!comment || currentCommentIndex < 0) return;
    if (sendBtn) sendBtn.disabled = true;

    const moment = moments[currentCommentIndex];
    if (!moment) return;
    if (!moment.comments) moment.comments = [];

    const newComment = createMomentComment({
        author: wechatUser.nickname,
        content: comment,
        replyToCommentId: currentCommentTarget?.commentId || null,
        replyToAuthor: currentCommentTarget?.author || ''
    });

    moment.comments.push(newComment);

    saveMoments();

    const momentIndexForReply = currentCommentIndex;
    const userCommentTextForReply = comment;
    const userCommentIdForReply = newComment.id;

    closeCommentInput();
    renderMomentsList();

    // 50%概率触发角色AI回复评论
    if (moment.roleId && Math.random() < 0.5) {
        await generateCommentReply(momentIndexForReply, userCommentTextForReply, userCommentIdForReply);
    }

    currentCommentIndex = -1;
    currentCommentTarget = null;
}

// 角色AI回复评论
async function generateCommentReply(momentIndex, userComment, replyToCommentId = null) {
    const moment = moments[momentIndex];
    const role = wechatRoles.find(r => r.id === moment.roleId);
    
    if (!role || !apiSettings.apiKey) return;
    
    try {
        const systemPrompt = `你是${role.nickname}，性格：${role.systemPrompt}。
有人在你的朋友圈动态下评论了。你的动态内容是："${moment.content}"
用户评论："${userComment}"
请用符合你性格的方式简短回复这条评论，1-2句话即可，像真人发微信一样自然。`;

        const response = await fetch(buildApiUrl(CONFIG.CHAT_COMPLETIONS_PATH), {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiSettings.apiKey}`
            },
            body: JSON.stringify({
                model: apiSettings.modelName || CONFIG.DEFAULT_MODEL,
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userComment }
                ],
                temperature: 0.8,
                max_tokens: 100
            })
        });
        
        if (!response.ok) return;
        
        const data = await response.json();
        let reply = data.choices?.[0]?.message?.content || '';
        reply = sanitizeAIResponse(reply, role.nickname);
        
        if (reply) {
            const targetComment = Array.isArray(moment.comments) && replyToCommentId
                ? moment.comments.find(item => item && item.id === replyToCommentId)
                : null;

            moment.comments.push(createMomentComment({
                author: role.nickname,
                content: reply,
                replyToCommentId: targetComment?.id || null,
                replyToAuthor: targetComment?.author || ''
            }));
            saveMoments();
            renderMomentsList();
        }
    } catch (e) {
        console.error('生成评论回复失败:', e);
    }
}

// 检查并为角色自动生成动态
async function checkAndGenerateRoleMoments() {
    if (!apiSettings.apiKey) return;

    const nowDate = new Date();
    const now = nowDate.getTime();
    const nowDateKey = getLocalDateKey(nowDate);
    const nowMinutes = getNowMinutesOfDay(nowDate);
    const fiveDaysMs = 5 * 24 * 60 * 60 * 1000;

    const policyState = loadRoleMomentPolicyState();
    let stateChanged = false;

    for (const role of wechatRoles) {
        if (role.type !== 'ai') continue;

        const roleId = String(role.id);
        let roleState = policyState[roleId];

        if (!roleState || typeof roleState !== 'object') {
            roleState = {};
            stateChanged = true;
        }

        const latestRoleMoment = getRoleLatestMomentTimestamp(role.id);

        if (!Number.isFinite(Number(roleState.lastPostAt))) {
            roleState.lastPostAt = Number.isFinite(Number(latestRoleMoment)) ? Number(latestRoleMoment) : now;
            stateChanged = true;
        }

        if (roleState.dateKey !== nowDateKey) {
            roleState.dateKey = nowDateKey;
            roleState.todayCount = 0;
            roleState.todaySlots = generateDailyRandomMomentSlots(1);
            roleState.firedSlots = [];
            stateChanged = true;
        }

        if (!Array.isArray(roleState.todaySlots)) {
            roleState.todaySlots = generateDailyRandomMomentSlots(1);
            stateChanged = true;
        }

        if (!Array.isArray(roleState.firedSlots)) {
            roleState.firedSlots = [];
            stateChanged = true;
        }

        if (!Number.isFinite(Number(roleState.todayCount)) || Number(roleState.todayCount) < 0) {
            roleState.todayCount = 0;
            stateChanged = true;
        }

        if (Number(roleState.todayCount) >= 1) {
            policyState[roleId] = roleState;
            continue;
        }

        const lastPostAt = Number(roleState.lastPostAt);
        const forcePostForFiveDayRule = Number.isFinite(lastPostAt) && (now - lastPostAt >= fiveDaysMs);

        let shouldPost = false;
        let matchedSlot = null;

        if (forcePostForFiveDayRule) {
            shouldPost = true;
        } else {
            matchedSlot = roleState.todaySlots.find((slot) => {
                const minute = Number(slot);
                if (!Number.isFinite(minute)) return false;
                if (minute > nowMinutes) return false;
                return !roleState.firedSlots.includes(minute);
            });

            if (matchedSlot !== undefined && matchedSlot !== null) {
                roleState.firedSlots.push(Number(matchedSlot));
                shouldPost = true;
                stateChanged = true;
            }
        }

        if (!shouldPost) {
            policyState[roleId] = roleState;
            continue;
        }

        const posted = await generateRoleMoment(role);

        if (posted) {
            roleState.todayCount = Math.min(1, Number(roleState.todayCount) + 1);
            roleState.lastPostAt = Date.now();
            stateChanged = true;
        } else if (!forcePostForFiveDayRule && matchedSlot !== undefined && matchedSlot !== null) {
            roleState.firedSlots = roleState.firedSlots.filter((slot) => Number(slot) !== Number(matchedSlot));
            stateChanged = true;
        }

        policyState[roleId] = roleState;
    }

    if (stateChanged) {
        saveRoleMomentPolicyState(policyState);
    }
}

function isTemplateLikeMomentText(text = '') {
    const normalized = String(text || '')
        .replace(/\s+/g, ' ')
        .trim()
        .toLowerCase();

    if (!normalized) return true;

    const templatePatterns = [
        /今日份/,
        /生活不止/,
        /保持热爱/,
        /不负/,
        /治愈/,
        /元气满满/,
        /打卡/,
        /记录(一下|生活|日常)/,
        /又是.*的一天/,
        /愿你/,
        /愿我们/,
        /加油/,
        /晚安世界/,
        /早安世界/,
        /碎碎念/,
        /小确幸/,
        /人间值得/,
        /每一刻都/,
        /朋友圈/,
        /#.+#/,
        /【.+】/
    ];

    const hitCount = templatePatterns.reduce((count, pattern) => {
        return count + (pattern.test(normalized) ? 1 : 0);
    }, 0);

    return hitCount >= 2;
}

function sanitizeRoleMomentContent(content, roleNickname) {
    let text = sanitizeAIResponse(content, roleNickname || '对方');
    text = String(text || '')
        .replace(/^\s*[“"'`]+/, '')
        .replace(/[”"'`]+\s*$/, '')
        .replace(/^\s*(朋友圈|动态)[:：]\s*/i, '')
        .trim();

    return text;
}

// 为角色生成朋友圈动态
async function generateRoleMoment(role) {
    if (!apiSettings.apiKey) return false;
    
    try {
        const now = new Date();
        const timeContext = `现在是${now.getFullYear()}年${now.getMonth()+1}月${now.getDate()}日 ${now.getHours()}:${String(now.getMinutes()).padStart(2,'0')}`;

        const recentRoleMoments = moments
            .filter(moment => moment?.roleId === role.id && typeof moment?.content === 'string')
            .slice(0, 6)
            .map(moment => String(moment.content).replace(/\s+/g, ' ').trim())
            .filter(Boolean)
            .slice(0, 3);

        const roleStyleSamples = recentRoleMoments.length > 0
            ? `\n你自己最近发过的动态（语气参考，不要复读）：\n${recentRoleMoments.map((item, idx) => `${idx + 1}. ${item}`).join('\n')}`
            : '';

        const systemPrompt = `你是${role.nickname}，性格：${role.systemPrompt}。
${timeContext}

你要发一条“你自己此刻想发”的朋友圈，不是从文案库摘抄，不是鸡汤模板，不是标准网红句式。
可以非常短（1~2个字的抱怨、发泄、吐槽），也可以很长（一整段碎碎念、观察、感悟），长度自由。
可以小众、无厘头、奇怪、跳跃，重点是像真人当下脑子里突然冒出来的东西。
允许不大众化，不需要迎合所有人。${roleStyleSamples}

强约束：
1. 绝对禁止“文案库感”和“模板腔”，不要出现空泛正能量套话。
2. 不要使用 #话题#、列表体、金句体、公众号体。
3. 不要解释“我为什么这么写”，只输出动态正文。
4. 这就是你本人发朋友圈，不要提 AI、模型、系统、助手。

只输出动态内容本身。`;

        const buildRequestBody = (extraUserHint = '') => ({
            model: apiSettings.modelName || CONFIG.DEFAULT_MODEL,
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: extraUserHint || '现在就发一条你自己想发的朋友圈。' }
            ],
            temperature: 1.05,
            top_p: 0.95,
            frequency_penalty: 0.35,
            presence_penalty: 0.8,
            max_tokens: 320
        });

        const requestOnce = async (extraUserHint = '') => {
            const response = await fetch(buildApiUrl(CONFIG.CHAT_COMPLETIONS_PATH), {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiSettings.apiKey}`
                },
                body: JSON.stringify(buildRequestBody(extraUserHint))
            });

            if (!response.ok) return '';
            const data = await response.json();
            return sanitizeRoleMomentContent(data.choices?.[0]?.message?.content || '', role.nickname);
        };

        let content = await requestOnce();

        // 若首轮命中模板腔，强制重试一次，明确要求“更私人、更即时”
        if (isTemplateLikeMomentText(content)) {
            const retryContent = await requestOnce('上一条太像模板文案了。重写：更私人、更即时、更像你突然想说的话，可以很短也可以很长。');
            if (retryContent) {
                content = retryContent;
            }
        }

        if (content && content.length >= 1) {
            // 创建新动态
            const newMoment = {
                roleId: role.id,
                author: role.nickname,
                avatar: role.avatar,
                content: content,
                timestamp: Date.now(),
                likes: [],
                comments: []
        
    };
            
            moments.unshift(newMoment);
            saveMoments();
            renderMomentsList();
            
            console.log(`${role.nickname} 发布了新动态: ${content}`);
            return true;
        }

        return false;
    } catch (e) {
        console.error('生成角色动态失败:', e);
        return false;
    }
}

// 发布动态独立页面
let momentPostImages = [];
let momentPostMentionIds = [];

function getMomentPostMentionRoles() {
    if (!Array.isArray(wechatRoles)) return [];
    const selected = new Set(momentPostMentionIds.map((id) => String(id)));
    return wechatRoles
        .filter((role) => role && role.type === 'ai' && selected.has(String(role.id)))
        .map((role) => ({
            id: String(role.id),
            name: role.nickname || 'Char',
            avatar: role.avatar || 'white'
        }));
}

function updateMomentMentionSummary() {
    const summary = document.getElementById('momentMentionSummary');
    if (!summary) return;

    const roles = getMomentPostMentionRoles();
    summary.textContent = roles.length > 0
        ? roles.map((role) => `@${role.name}`).join(' ')
        : '';
}

function renderMomentMentionPicker() {
    const picker = document.getElementById('momentMentionPicker');
    if (!picker) return;

    const roles = Array.isArray(wechatRoles)
        ? wechatRoles.filter((role) => role && role.type === 'ai')
        : [];

    if (roles.length === 0) {
        picker.innerHTML = '<div class="moment-mention-empty">暂无可提醒的角色</div>';
        updateMomentMentionSummary();
        return;
    }

    const selected = new Set(momentPostMentionIds.map((id) => String(id)));
    picker.innerHTML = roles.map((role) => {
        const avatarConfig = getAvatarRenderConfig(role.avatar, role.nickname || '?');
        const activeClass = selected.has(String(role.id)) ? ' is-selected' : '';
        return `
            <button class="moment-mention-chip${activeClass}" type="button" onclick="toggleMomentMentionRole('${String(role.id).replace(/'/g, "\\'")}')">
                <span class="moment-mention-avatar" style="${avatarConfig.avatarStyle}">${escapeHtml(avatarConfig.avatarContent)}</span>
                <span>@${escapeHtml(role.nickname || 'Char')}</span>
            </button>
        `;
    }).join('');

    updateMomentMentionSummary();
}

function toggleMomentMentionPicker() {
    const picker = document.getElementById('momentMentionPicker');
    if (!picker) return;
    picker.classList.toggle('is-open');
    renderMomentMentionPicker();
}

function toggleMomentMentionRole(roleId) {
    const id = String(roleId);
    if (momentPostMentionIds.some((item) => String(item) === id)) {
        momentPostMentionIds = momentPostMentionIds.filter((item) => String(item) !== id);
    } else {
        momentPostMentionIds.push(id);
    }
    renderMomentMentionPicker();
}

function compressImageDataUrl(dataUrl, options = {}) {
    const {
        maxWidth = 1280,
        maxHeight = 1280,
        quality = 0.82
    } = options;

    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
            try {
                let { width, height } = img;
                const scale = Math.min(maxWidth / width, maxHeight / height, 1);

                const targetWidth = Math.max(1, Math.round(width * scale));
                const targetHeight = Math.max(1, Math.round(height * scale));

                const canvas = document.createElement('canvas');
                canvas.width = targetWidth;
                canvas.height = targetHeight;

                const ctx = canvas.getContext('2d');
                if (!ctx) {
                    reject(new Error('无法创建图片压缩上下文'));
                    return;
                }

                ctx.drawImage(img, 0, 0, targetWidth, targetHeight);
                resolve(canvas.toDataURL('image/jpeg', quality));
            } catch (error) {
                reject(error);
            }
        };
        img.onerror = () => reject(new Error('图片读取失败，无法压缩'));
        img.src = dataUrl;
    });
}

function readFileAsDataURL(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target.result);
        reader.onerror = () => reject(new Error('图片读取失败'));
        reader.readAsDataURL(file);
    });
}

async function normalizeChatUploadImageData(file, dataUrl) {
    if (!dataUrl) {
        throw new Error('图片数据为空');
    }

    const sourceMime = (file?.type || getDataImageMimeType(dataUrl) || 'unknown').toLowerCase();
    const normalizedSourceMime = getDataImageMimeType(dataUrl) || sourceMime;

    // GIF 保持原格式，避免动图被压成静图
    if (normalizedSourceMime === 'image/gif') {
        if (!isVisionSupportedDataUrl(dataUrl)) {
            throw new Error('GIF 图片格式不可用');
        }

        return {
            dataUrl,
            mimeType: 'image/gif',
            converted: false,
            sourceMime
        };
    }

    // 对非 GIF 图片强制重编码为 JPEG，规避 iOS Safari 伪装 JPEG / MPO 的情况
    const convertedDataUrl = await compressImageDataUrl(dataUrl, {
        maxWidth: 1600,
        maxHeight: 1600,
        quality: 0.86
    });

    if (!isVisionSupportedDataUrl(convertedDataUrl)) {
        throw new Error('图片格式转换失败');
    }

    if (looksLikeMpoDataUrl(convertedDataUrl)) {
        throw new Error('检测到异常图片结构（MPO），请更换图片后重试');
    }

    return {
        dataUrl: convertedDataUrl,
        mimeType: getDataImageMimeType(convertedDataUrl) || 'image/jpeg',
        converted: true,
        sourceMime
    };
}

async function saveMomentImageWithRetry(imageDataUrl) {
    if (!imageDataUrl) {
        throw new Error('图片数据为空，无法发布');
    }

    try {
        const imageId = await saveChatImageToDB(
            { name: '朋友圈图片', type: 'image/jpeg' },
            imageDataUrl
        );
        return buildMediaRef(imageId);
    } catch (firstError) {
        if (isStorageQuotaError(firstError)) {
            throw firstError;
        }

        console.warn('首次保存朋友圈图片失败，尝试二次压缩后重试:', firstError);

        const fallbackDataUrl = await compressImageDataUrl(imageDataUrl, {
            maxWidth: 960,
            maxHeight: 960,
            quality: 0.68
        });

        const imageId = await saveChatImageToDB(
            { name: '朋友圈图片', type: 'image/jpeg' },
            fallbackDataUrl
        );
        return buildMediaRef(imageId);
    }
}

function showPostMomentModal() {
    openMomentPostPage();
}

function openMomentPostPage() {
    closeCommentInput();

    const wechatApp = document.getElementById('app-wechat');
    const postApp = document.getElementById('app-moment-post');
    const textarea = document.getElementById('momentPostContent');

    if (!wechatApp || !postApp) return;

    hideAppView(wechatApp);
    showAppView(postApp);
    currentApp = 'moment-post';

    resetMomentPostPage();
    renderMomentMentionPicker();

    setTimeout(() => {
        if (textarea) textarea.focus();
    }, 100);
}

function backToMomentsFromPost() {
    const wechatApp = document.getElementById('app-wechat');
    const postApp = document.getElementById('app-moment-post');

    hideAppView(postApp);
    showAppView(wechatApp);

    currentApp = 'wechat';
    renderMomentsList();
}

function resetMomentPostPage() {
    momentPostImages = [];
    momentPostMentionIds = [];

    const textarea = document.getElementById('momentPostContent');
    const input = document.getElementById('momentImageInput');
    const picker = document.getElementById('momentMentionPicker');

    if (textarea) {
        textarea.value = '';
    }

    if (input) {
        input.value = '';
    }

    if (picker) {
        picker.classList.remove('is-open');
    }

    updateMomentPostCounter();
    renderMomentPostImagePreview();
    renderMomentMentionPicker();
}

function updateMomentPostCounter() {
    const textarea = document.getElementById('momentPostContent');
    const counter = document.getElementById('momentPostCounter');
    const submitBtn = document.getElementById('momentPostSubmitBtn');

    const contentLength = textarea ? textarea.value.trim().length : 0;

    if (counter) {
        counter.textContent = `${contentLength}/500`;
    }

    if (submitBtn) {
        submitBtn.disabled = contentLength === 0;
    }
}

function triggerMomentImageUpload() {
    const input = document.getElementById('momentImageInput');
    if (input) {
        input.click();
    }
}

async function handleMomentImageUpload(event) {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) return;

    const remainingCount = Math.max(0, 9 - momentPostImages.length);
    const filesToRead = files.slice(0, remainingCount);

    try {
        for (const file of filesToRead) {
            const rawDataUrl = await readFileAsDataURL(file);
            const compressedDataUrl = await compressImageDataUrl(rawDataUrl, {
                maxWidth: 1280,
                maxHeight: 1280,
                quality: 0.82
            });
            momentPostImages.push(compressedDataUrl);
        }

        renderMomentPostImagePreview();
    } catch (error) {
        console.error('处理朋友圈图片失败:', error);
        alert('图片处理失败，请重试');
    } finally {
        event.target.value = '';
    }
}

function renderMomentPostImagePreview() {
    const container = document.getElementById('momentPostImagePreview');
    const addCard = document.querySelector('.moment-post-image-card');
    if (!container) return;

    if (momentPostImages.length === 0) {
        container.innerHTML = '';
        if (addCard) addCard.hidden = false;
        return;
    }

    container.innerHTML = momentPostImages.map((img, index) => `
        <div class="moment-post-preview-item">
            <img src="${img}" alt="预览图片 ${index + 1}">
            <button class="moment-post-preview-remove" onclick="removeMomentPostImage(${index})">×</button>
        </div>
    `).join('');

    if (addCard) {
        addCard.hidden = momentPostImages.length >= 9;
    }
}

function removeMomentPostImage(index) {
    momentPostImages.splice(index, 1);
    renderMomentPostImagePreview();
}

function publishMoment() {
    publishMomentFromPage();
}

async function publishMomentFromPage() {
    const textarea = document.getElementById('momentPostContent');
    const submitBtn = document.getElementById('momentPostSubmitBtn');
    const content = textarea ? textarea.value.trim() : '';

    if (!content) {
        alert('请输入动态内容');
        return;
    }

    if (submitBtn) {
        submitBtn.disabled = true;
    }

    try {
        // 发布前先压缩历史存储：尽量把旧 dataURL 迁移到 IndexedDB，失败项直接丢弃，避免 localStorage 爆配额
        await migrateMomentsImageStorage({
            dropDataUrlOnFailure: true,
            persist: true
        });

        const momentImageRefs = [];
        for (const imageDataUrl of momentPostImages) {
            const mediaRef = await saveMomentImageWithRetry(imageDataUrl);
            momentImageRefs.push(mediaRef);
        }

        const newMoment = {
            id: `moment_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
            author: wechatUser.nickname,
            avatar: wechatUser.avatar,
            content: content,
            images: momentImageRefs,
            mentions: getMomentPostMentionRoles(),
            timestamp: Date.now(),
            likes: [],
            comments: []
        };

        moments.unshift(newMoment);

        let recoveryActions = [];
        let saved = saveMoments();

        if (!saved && isStorageQuotaError(lastSaveMomentsError)) {
            // 先迁移/剔除旧 dataURL 图片，减轻 localStorage 压力
            await migrateMomentsImageStorage({
                dropDataUrlOnFailure: true,
                persist: false
            });
            saved = saveMoments();
        }

        if (!saved && isStorageQuotaError(lastSaveMomentsError)) {
            // 清理非核心数据（草稿/贴图缓存/聊天历史）+ 聊天图片缓存，不触碰壁纸/封面/头像
            recoveryActions = cleanupNonCriticalStorageForMomentPublish();
            try {
                await deleteChatMediaDatabase();
                recoveryActions.push('清理聊天图片媒体库');
            } catch (error) {
                console.warn('清理聊天图片媒体库失败:', error);
            }
            saved = saveMoments();
        }

        if (!saved && isStorageQuotaError(lastSaveMomentsError)) {
            // 进一步压缩：仅保留必要字段，并限制动态数量
            const beforeCount = moments.length;
            moments = buildLiteMomentsCollection(moments, 80);
            saved = saveMoments();
            if (saved) {
                recoveryActions.push(`动态结构轻量化(${beforeCount}→${moments.length})`);
            }
        }

        if (!saved && isStorageQuotaError(lastSaveMomentsError) && Array.isArray(newMoment.images) && newMoment.images.length > 0) {
            // 兜底1：保留文字，移除本条动态图片
            newMoment.images = [];
            saved = saveMoments();
            if (saved) {
                recoveryActions.push('仅发布文字，移除本次图片');
            }
        }

        if (!saved && isStorageQuotaError(lastSaveMomentsError)) {
            // 兜底2：裁剪最旧动态，确保至少能发出最新内容（含纯文字）
            const trimTargets = [240, 180, 120, 80, 50];
            for (const target of trimTargets) {
                if (moments.length <= target) continue;

                const before = moments.length;
                moments = moments.slice(0, target);
                saved = saveMoments();

                if (saved) {
                    recoveryActions.push(`裁剪旧动态(${before}→${target})`);
                    break;
                }
            }
        }

        if (!saved && isStorageQuotaError(lastSaveMomentsError)) {
            // 极限兜底：只写“当前新动态（纯文字）”
            const emergencyMoment = makeMomentStorageLiteRecord({
                ...newMoment,
                images: []
            });
            const emergencyCollection = [emergencyMoment];
            const emergencySaved = safeWriteStorageJSON('wechatMoments', emergencyCollection);

            if (emergencySaved) {
                moments = emergencyCollection;
                saved = true;
                recoveryActions.push('极限兜底：仅保留本次文字动态');
            }
        }

        if (!saved) {
            moments.shift();
            if (isStorageQuotaError(lastSaveMomentsError)) {
                throw new Error('动态保存失败：本地存储空间已满');
            }
            throw new Error(`动态保存失败：${lastSaveMomentsError?.message || '本地存储可能异常'}`);
        }

        // 发布成功后立刻回读校验，避免历史脏数据导致列表空白
        loadMoments();

        resetMomentPostPage();
        backToMomentsFromPost();

        if (window.DataManager) {
            DataManager.showToast(
                recoveryActions.length > 0
                    ? `动态发布成功（已自动清理：${recoveryActions.join('、')}）`
                    : '动态发布成功'
            );
        } else if (recoveryActions.length > 0) {
            alert(`动态发布成功（已自动清理：${recoveryActions.join('、')}）`);
        }
    } catch (error) {
        console.error('发布动态失败:', error);

        const message = error?.message || '';
        if (isStorageQuotaError(error) || /存储空间不足/i.test(message)) {
            alert('发布失败：本地存储空间不足，请在设置中清理数据后重试');
        } else {
            alert(`发布失败：${message || '图片处理或保存失败，请稍后重试'}`);
        }
    } finally {
        if (submitBtn) {
            submitBtn.disabled = false;
        }
    }
}

async function enterChat() {
    hideAppView(document.getElementById('app-wechat'));
    showAppView(document.getElementById('app-chat'));
    currentApp = 'chat';
    closeChatMediaPanel();
    resetChatModeToOnline();
    resetChatSelectionState();

    if (currentRoleId) {
        markWechatConversationAsRead(currentRoleId, 'online');
        renderWechatChatList();
    }

    await refreshChatViewForCurrentMode();
}

// ================= 聊天功能 =================
function handleEnter(e) {
    if (e.key === 'Enter') {
        sendMessage();
    }
}

// 保存最后一条用户消息，用于之后的AI回复
let lastUserMessage = '';
let lastUserMessageId = null;
let pendingImageRequest = null;
let activeVoiceActionMenu = null;
let lastUserImageContent = null;
let pendingFollowupImageTask = null;
let pendingReferenceImageTask = null;

// 图片生成任务状态（支持中断）
let isImageGenerating = false;
let isImageGenerationInterruptible = false;
let currentImageGenerationController = null;
let currentImageGenerationRequestId = 0;
let currentImageGenerationCountdownTimer = null;
const IMAGE_GENERATION_COUNTDOWN_SECONDS = 10;

// 图片后台任务补发（processing -> 轮询 -> 自动补图）
const IMAGE_PENDING_JOBS_STORAGE_KEY = 'chatImagePendingJobs';
const IMAGE_DELIVERED_JOBS_STORAGE_KEY = 'chatImageDeliveredJobs';
const IMAGE_JOB_MAX_POLL_DURATION_MS = 30 * 60 * 1000;
const FORUM_IMAGE_CREATE_GRACE_MS = 12 * 60 * 1000;
const FORUM_IMAGE_MAX_POLL_DURATION_MS = 12 * 60 * 1000;
let activeImagePollTimers = new Map();
let activeImagePollingJobs = new Set();

function resolveImageGenerationStatusUrl(jobId, proxyUrl = '') {
    const baseUrl = String(proxyUrl || '').trim() || resolveImageGenerationProxyUrl();
    const separator = baseUrl.includes('?') ? '&' : '?';
    return `${baseUrl}${separator}jobId=${encodeURIComponent(String(jobId || '').trim())}`;
}

function loadPendingImageJobsFromStorage() {
    const raw = safeReadStorageJSON(IMAGE_PENDING_JOBS_STORAGE_KEY, []);
    return Array.isArray(raw) ? raw : [];
}

function savePendingImageJobsToStorage(jobs = []) {
    return safeWriteStorageJSON(IMAGE_PENDING_JOBS_STORAGE_KEY, Array.isArray(jobs) ? jobs : []);
}

function upsertPendingImageJob(job) {
    if (!job?.jobId) return;
    const jobId = String(job.jobId).trim();
    if (!jobId) return;

    const jobs = loadPendingImageJobsFromStorage();
    const next = jobs.filter((item) => String(item?.jobId || '') !== jobId);
    next.push({
        ...job,
        jobId,
        createdAt: Number(job.createdAt) || Date.now(),
        promptText: String(job.promptText || '').trim()
    });
    savePendingImageJobsToStorage(next);
}

function removePendingImageJob(jobId) {
    const id = String(jobId || '').trim();
    if (!id) return;
    const jobs = loadPendingImageJobsFromStorage();
    const next = jobs.filter((item) => String(item?.jobId || '') !== id);
    savePendingImageJobsToStorage(next);
}

function loadDeliveredImageJobIds() {
    const raw = safeReadStorageJSON(IMAGE_DELIVERED_JOBS_STORAGE_KEY, []);
    return new Set(Array.isArray(raw) ? raw.map((item) => String(item || '').trim()).filter(Boolean) : []);
}

function saveDeliveredImageJobIds(set) {
    const values = Array.from(set || new Set()).filter(Boolean).slice(-200);
    safeWriteStorageJSON(IMAGE_DELIVERED_JOBS_STORAGE_KEY, values);
}

async function appendAssistantGeneratedImageFromData({
    role,
    promptText = '',
    revisedPrompt = '',
    dataUrl = '',
    mimeType = 'image/png'
} = {}) {
    if (!dataUrl) return false;

    const imageId = await saveChatImageToDB(
        { name: promptText.slice(0, 30) || 'AI生成图片', type: mimeType },
        dataUrl
    );

    const imageContent = {
        type: 'image',
        imageId,
        url: dataUrl,
        name: revisedPrompt || promptText || 'AI生成图片'
    };

    const timestamp = Date.now();
    const messageId = `msg_${timestamp}_${Math.random().toString(36).slice(2, 8)}`;
    const previousTimestamp = chatHistory.length > 0
        ? (chatHistory[chatHistory.length - 1].timestamp || null)
        : null;

    chatHistory.push({ id: messageId, role: 'assistant', content: imageContent, timestamp });
    if (chatHistory.length > CONFIG.MAX_HISTORY) {
        chatHistory = chatHistory.slice(-CONFIG.MAX_HISTORY);
    }
    saveChatHistory();
    addSharedEvent({
        sourceMode: getCurrentChatMode(),
        speakerRole: 'assistant',
        content: imageContent,
        timestamp
    });

    const chatBox = document.getElementById('chatBox');
    if (chatBox) {
        if (shouldShowTime(previousTimestamp, timestamp)) {
            chatBox.appendChild(createTimeDivider(timestamp));
        }
        chatBox.appendChild(createAIBubble(imageContent, true, role, messageId));
        chatBox.scrollTop = chatBox.scrollHeight;
    }

    updateLastMessage('[图片]');
    renderWechatChatList();
    return true;
}

function clearImagePollTimer(jobId) {
    const id = String(jobId || '').trim();
    if (!id) return;
    const timerId = activeImagePollTimers.get(id);
    if (timerId) {
        clearTimeout(timerId);
    }
    activeImagePollTimers.delete(id);
    activeImagePollingJobs.delete(id);
}

function scheduleImageJobPolling(jobInfo = {}) {
    const jobId = String(jobInfo.jobId || '').trim();
    if (!jobId) return;
    if (activeImagePollingJobs.has(jobId)) return;

    const role = wechatRoles.find(r => r.id === currentRoleId);
    const deliveredSet = loadDeliveredImageJobIds();
    if (deliveredSet.has(jobId)) {
        removePendingImageJob(jobId);
        return;
    }

    upsertPendingImageJob(jobInfo);
    activeImagePollingJobs.add(jobId);

    const run = async () => {
        const pendingJobs = loadPendingImageJobsFromStorage();
        const currentJob = pendingJobs.find((item) => String(item?.jobId || '') === jobId);
        const createdAt = Number(currentJob?.createdAt || jobInfo.createdAt || Date.now());
        const promptText = String(currentJob?.promptText || jobInfo.promptText || '').trim();

        if (Date.now() - createdAt > IMAGE_JOB_MAX_POLL_DURATION_MS) {
            clearImagePollTimer(jobId);
            removePendingImageJob(jobId);
            appendAssistantTextMessage('图片后台任务超出等待时间，请重新发送一次生成请求');
            return;
        }

        try {
            const response = await fetch(resolveImageGenerationStatusUrl(
                jobId,
                currentJob?.proxyUrl || jobInfo.proxyUrl || ''
            ), {
                method: 'GET'
            });

            let data = null;
            try {
                data = await response.json();
            } catch (error) {
                data = null;
            }

            const status = String(data?.status || '').trim().toLowerCase();

            if (status === 'succeeded') {
                const resultData = data?.result || data;
                const dataUrl = extractImageDataUrlFromResponse(resultData);
                const mimeType = getDataImageMimeType(dataUrl) || 'image/png';
                const revisedPrompt = String(resultData?.data?.[0]?.revised_prompt || '').trim();

                if (!dataUrl) {
                    throw new Error('图片接口未返回可用图片数据');
                }

                if (!deliveredSet.has(jobId)) {
                    await appendAssistantGeneratedImageFromData({
                        role,
                        promptText,
                        revisedPrompt,
                        dataUrl,
                        mimeType
                    });
                    deliveredSet.add(jobId);
                    saveDeliveredImageJobIds(deliveredSet);
                }

                clearImagePollTimer(jobId);
                removePendingImageJob(jobId);
                return;
            }

            if (status === 'failed') {
                clearImagePollTimer(jobId);
                removePendingImageJob(jobId);
                appendAssistantTextMessage(`后台生成失败：${extractErrorMessage(data, '图片生成失败')}`);
                return;
            }

            const pollAfterMs = Math.max(1500, Number(data?.pollAfterMs || currentJob?.pollAfterMs || 3000));
            const timer = setTimeout(run, pollAfterMs);
            activeImagePollTimers.set(jobId, timer);
        } catch (error) {
            const timer = setTimeout(run, 4000);
            activeImagePollTimers.set(jobId, timer);
        }
    };

    const firstDelay = Math.max(1200, Number(jobInfo.pollAfterMs || 3000));
    const timer = setTimeout(run, firstDelay);
    activeImagePollTimers.set(jobId, timer);
}

function resumePendingImageJobPolling() {
    const jobs = loadPendingImageJobsFromStorage();
    if (!Array.isArray(jobs) || jobs.length === 0) return;
    jobs.forEach((job) => scheduleImageJobPolling(job));
}

function getChatHistoryMessageById(messageId) {
    const resolvedId = String(messageId || '');
    if (!resolvedId || !Array.isArray(chatHistory)) return null;
    return chatHistory.find((msg) => String(msg?.id || '') === resolvedId) || null;
}

function findChatBubbleByMessageId(messageId) {
    const resolvedId = String(messageId || '');
    if (!resolvedId) return null;

    return Array.from(document.querySelectorAll('.chat-selectable-bubble'))
        .find((bubble) => bubble?.dataset?.messageId === resolvedId) || null;
}

function syncChatListPreviewFromHistory() {
    const lastMsg = chatHistory.length > 0 ? chatHistory[chatHistory.length - 1] : null;
    if (!lastMsg) {
        updateLastMessage('点击开始对话...');
        return;
    }

    updateLastMessage(getChatListPreviewText(lastMsg.content));
}

function closeVoiceActionMenu() {
    if (activeVoiceActionMenu) {
        activeVoiceActionMenu.remove();
        activeVoiceActionMenu = null;
    }
}

async function copyTextToClipboardSafe(text) {
    const content = String(text || '').trim();
    if (!content) return false;

    try {
        if (navigator.clipboard?.writeText) {
            await navigator.clipboard.writeText(content);
            return true;
        }
    } catch (error) {
        console.warn('Clipboard API 复制失败，准备回退:', error);
    }

    try {
        const textarea = document.createElement('textarea');
        textarea.value = content;
        textarea.setAttribute('readonly', 'readonly');
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        textarea.style.pointerEvents = 'none';
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        const copied = document.execCommand('copy');
        textarea.remove();
        return copied;
    } catch (error) {
        console.warn('execCommand 复制失败:', error);
        return false;
    }
}

function revealVoiceTranscriptByMessageId(messageId, voiceBubbleEl = null) {
    const message = getChatHistoryMessageById(messageId);
    const transcriptText = String(message?.content?.text || '').trim();

    if (!message || !message.content || message.content.type !== 'voice') {
        showAIError('未找到对应语音消息');
        return false;
    }

    if (!transcriptText) {
        showAIError('这条语音暂无可转文字内容');
        return false;
    }

    message.content.transcriptVisible = true;
    saveChatHistory();

    const targetBubble = voiceBubbleEl
        || findChatBubbleByMessageId(messageId)?.querySelector('.msg-voice');

    if (targetBubble) {
        targetBubble.classList.add('transcript-visible');

        const transcriptNode = targetBubble.querySelector('.voice-transcript');
        if (transcriptNode) {
            transcriptNode.textContent = transcriptText;
        }

        const statusBadge = targetBubble.querySelector('.voice-status-badge');
        if (statusBadge && !targetBubble.classList.contains('playing')) {
            statusBadge.textContent = '已转文字';
        }
    }

    if (window.DataManager) {
        DataManager.showToast('已转为文字');
    }

    return true;
}

function deleteChatMessageById(messageId) {
    const resolvedId = String(messageId || '');
    if (!resolvedId) return;

    chatHistory = chatHistory.filter((msg) => String(msg?.id || '') !== resolvedId);
    saveChatHistory();
    rerenderCurrentChatMessages();
    syncChatListPreviewFromHistory();
    renderWechatChatList();

    if (window.DataManager) {
        DataManager.showToast('消息已删除');
    }
}

function openVoiceActionMenu({
    messageId,
    voiceBubbleEl = null
} = {}) {
    const message = getChatHistoryMessageById(messageId);
    if (!message || message.content?.type !== 'voice') return;

    closeVoiceActionMenu();

    const transcriptText = String(message.content.text || '').trim();
    const transcriptVisible = !!message.content.transcriptVisible || !!voiceBubbleEl?.classList.contains('transcript-visible');

    const backdrop = document.createElement('div');
    backdrop.className = 'voice-action-menu-backdrop';

    const panel = document.createElement('div');
    panel.className = 'voice-action-menu';
    panel.innerHTML = `
        <button type="button" class="voice-action-menu-item voice-action-menu-item-primary">
            ${transcriptVisible ? '重新转文字' : '语音转文字'}
        </button>
        <button type="button" class="voice-action-menu-item">
            ${transcriptText ? '复制文字' : '复制提示'}
        </button>
        <button type="button" class="voice-action-menu-item voice-action-menu-item-danger">
            删除
        </button>
        <button type="button" class="voice-action-menu-item voice-action-menu-item-cancel">
            取消
        </button>
    `;

    const [convertBtn, copyBtn, deleteBtn, cancelBtn] = panel.querySelectorAll('.voice-action-menu-item');

    convertBtn.onclick = () => {
        const succeeded = revealVoiceTranscriptByMessageId(messageId, voiceBubbleEl);
        if (succeeded) {
            closeVoiceActionMenu();
        }
    };

    copyBtn.onclick = async () => {
        const copied = await copyTextToClipboardSafe(transcriptText || '语音消息');
        closeVoiceActionMenu();

        if (window.DataManager) {
            DataManager.showToast(copied ? '已复制' : '复制失败');
        } else if (!copied) {
            showAIError('复制失败，请稍后重试');
        }
    };

    deleteBtn.onclick = () => {
        closeVoiceActionMenu();
        deleteChatMessageById(messageId);
    };

    cancelBtn.onclick = () => {
        closeVoiceActionMenu();
    };

    backdrop.onclick = (event) => {
        if (event.target === backdrop) {
            closeVoiceActionMenu();
        }
    };

    panel.onclick = (event) => {
        event.stopPropagation();
    };

    backdrop.appendChild(panel);
    activeVoiceActionMenu = backdrop;
    document.body.appendChild(backdrop);
}

// ================= 聊天多选状态（长按触发） =================
let isChatSelectionMode = false;
let selectedChatMessageIds = new Set();
let chatLongPressTimer = null;
const CHAT_LONG_PRESS_MS = 450;

function updateChatSelectionToolbar() {
    const toolbar = document.getElementById('chatSelectionToolbar');
    const countEl = document.getElementById('chatSelectionCount');

    const count = selectedChatMessageIds.size;
    if (countEl) {
        countEl.textContent = `已选 ${count} 条`;
    }

    if (!toolbar) return;

    const shouldShow = isChatSelectionMode;
    toolbar.classList.toggle('active', shouldShow);
    toolbar.setAttribute('aria-hidden', shouldShow ? 'false' : 'true');
}

function rerenderCurrentChatMessages() {
    const chatBox = document.getElementById('chatBox');
    if (!chatBox) return;

    chatBox.innerHTML = '';
    const role = wechatRoles.find(r => r.id === currentRoleId);
    let lastTimestamp = null;

    chatHistory.forEach((msg) => {
        const timestamp = msg.timestamp || Date.now();
        const messageId = msg.id || `msg_${timestamp}_${Math.random().toString(36).slice(2, 8)}`;
        msg.id = messageId;

        if (shouldShowTime(lastTimestamp, timestamp)) {
            chatBox.appendChild(createTimeDivider(timestamp));
        }
        lastTimestamp = timestamp;

        if (msg.role === 'user') {
            chatBox.appendChild(createUserBubble(msg.content, true, messageId, msg.quotedMessage, msg.translation));
        } else if (msg.role === 'assistant') {
            chatBox.appendChild(createAIBubble(msg.content, true, role, messageId, msg.quotedMessage, msg.translation));
        } else if (msg.role === 'system' && msg.type === 'transfer-notice') {
            chatBox.appendChild(createChatSystemNotice(msg.content, messageId));
        }
    });

    chatBox.scrollTop = chatBox.scrollHeight;
}

function cancelChatSelection() {
    resetChatSelectionState();
}

function deleteSelectedChatMessages() {
    if (selectedChatMessageIds.size === 0) return;

    const deleteBtn = document.getElementById('chatSelectionDeleteBtn');
    if (deleteBtn) deleteBtn.disabled = true;

    const selectedIds = new Set(selectedChatMessageIds);
    chatHistory = chatHistory.filter((msg) => !selectedIds.has(String(msg?.id || '')));

    saveChatHistory();
    rerenderCurrentChatMessages();
    resetChatSelectionState();

    if (deleteBtn) deleteBtn.disabled = false;

    const lastMsg = chatHistory.length > 0 ? chatHistory[chatHistory.length - 1] : null;
    if (!lastMsg) {
        updateLastMessage('点击开始对话...');
    } else {
        updateLastMessage(getChatListPreviewText(lastMsg.content));
    }

    renderWechatChatList();
}

function resetChatSelectionState() {
    isChatSelectionMode = false;
    selectedChatMessageIds.clear();

    if (chatLongPressTimer) {
        clearTimeout(chatLongPressTimer);
        chatLongPressTimer = null;
    }

    const chatApp = document.getElementById('app-chat');
    const chatBox = document.getElementById('chatBox');
    if (chatApp) chatApp.classList.remove('chat-selection-mode');
    if (chatBox) chatBox.classList.remove('chat-selection-mode');

    syncChatBubbleSelectionVisualState();
    updateChatSelectionToolbar();
}

function setChatSelectionMode(active) {
    isChatSelectionMode = !!active;

    const chatApp = document.getElementById('app-chat');
    const chatBox = document.getElementById('chatBox');
    if (chatApp) chatApp.classList.toggle('chat-selection-mode', isChatSelectionMode);
    if (chatBox) chatBox.classList.toggle('chat-selection-mode', isChatSelectionMode);

    if (!isChatSelectionMode) {
        selectedChatMessageIds.clear();
    }

    syncChatBubbleSelectionVisualState();
    updateChatSelectionToolbar();
}

function updateSingleBubbleSelectionVisual(bubble) {
    if (!bubble || !(bubble instanceof HTMLElement)) return;
    const messageId = bubble.dataset.messageId;
    const checked = !!(isChatSelectionMode && messageId && selectedChatMessageIds.has(messageId));
    bubble.classList.toggle('chat-bubble-selected', checked);
}

function syncChatBubbleSelectionVisualState() {
    const chatBox = document.getElementById('chatBox');
    if (!chatBox) return;

    chatBox.querySelectorAll('.msg-bubble-user, .msg-bubble-ai').forEach((bubble) => {
        updateSingleBubbleSelectionVisual(bubble);
    });
}

function toggleChatBubbleSelection(messageId, bubble) {
    if (!messageId) return;

    if (selectedChatMessageIds.has(messageId)) {
        selectedChatMessageIds.delete(messageId);
    } else {
        selectedChatMessageIds.add(messageId);
    }

    if (selectedChatMessageIds.size === 0) {
        setChatSelectionMode(false);
        return;
    }

    updateSingleBubbleSelectionVisual(bubble);
    updateChatSelectionToolbar();
}

// ================= 长按菜单 =================
let activeLongPressMenu = null;
var currentQuotedMessage = null; // 当前引用的消息（使用var确保全局可访问）
window.currentQuotedMessage = null; // 显式添加到window对象

// SVG图标生成函数
function createMenuIconSVG(type) {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-width', '1.8');
    svg.setAttribute('stroke-linecap', 'round');
    svg.setAttribute('stroke-linejoin', 'round');

    let path = '';
    switch (type) {
        case 'copy':
            // 复制图标：两个重叠的矩形
            path = '<rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>';
            break;
        case 'translate':
            path = '<path d="M5 8h8"></path><path d="M9 4v4"></path><path d="M6 12c1.4-1.2 2.5-2.7 3-4"></path><path d="M11 12c-.8-.7-1.5-1.5-2-2.4"></path><path d="M14 20l4-9 4 9"></path><path d="M15.5 17h5"></path>';
            break;
        case 'multiselect':
            // 多选图标：复选框
            path = '<path d="M9 11l3 3L22 4"></path><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path>';
            break;
        case 'quote':
            // 引用图标：回复箭头
            path = '<path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path>';
            break;
        case 'innervoice':
            // 心声图标：思考气泡
            path = '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path><circle cx="9" cy="10" r="0.5" fill="currentColor"></circle><circle cx="12" cy="10" r="0.5" fill="currentColor"></circle><circle cx="15" cy="10" r="0.5" fill="currentColor"></circle>';
            break;
        case 'recall':
            // 撤回图标：撤回箭头
            path = '<path d="M3 7v6h6"></path><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"></path>';
            break;
        default:
            path = '<circle cx="12" cy="12" r="10"></circle>';
    }

    svg.innerHTML = path;
    return svg;
}

function closeLongPressMenu() {
    if (activeLongPressMenu) {
        activeLongPressMenu.remove();
        activeLongPressMenu = null;
    }
}

function showLongPressMenu(bubble, messageId) {
    closeLongPressMenu();

    const message = chatHistory.find(m => String(m.id) === String(messageId));
    if (!message) return;

    const isUserMessage = message.role === 'user';
    const isAIMessage = message.role === 'assistant';

    // 创建背景遮罩
    const backdrop = document.createElement('div');
    backdrop.className = 'chat-long-press-menu-backdrop';
    backdrop.addEventListener('click', closeLongPressMenu);

    // 创建菜单
    const menu = document.createElement('div');
    menu.className = 'chat-long-press-menu';

    // 菜单项配置
    const menuItems = [];

    // 通用操作
    menuItems.push({
        iconType: 'copy',
        label: '复制',
        action: () => copyMessageContent(message)
    });

    if (canTranslateMessage(message)) {
        menuItems.push({
            iconType: 'translate',
            label: '翻译',
            action: () => translateMessageToChinese(messageId)
        });
    }

    menuItems.push({
        iconType: 'multiselect',
        label: '多选',
        action: () => enterMultiSelectMode(messageId, bubble)
    });

    // AI消息专属
    if (isAIMessage) {
        menuItems.push({
            iconType: 'quote',
            label: '引用',
            action: () => quoteMessage(message)
        });

        menuItems.push({
            iconType: 'innervoice',
            label: '心声',
            action: () => showInnerVoice(message)
        });
    }

    // 用户消息专属
    if (isUserMessage) {
        menuItems.push({
            iconType: 'recall',
            label: '撤回',
            action: () => recallMessage(messageId)
        });
    }

    // 创建菜单项
    menuItems.forEach(item => {
        const menuItem = document.createElement('div');
        menuItem.className = 'chat-long-press-menu-item';

        const iconContainer = document.createElement('div');
        iconContainer.className = 'chat-long-press-menu-item-icon';
        const iconSVG = createMenuIconSVG(item.iconType);
        iconContainer.appendChild(iconSVG);

        const label = document.createElement('div');
        label.className = 'chat-long-press-menu-item-label';
        label.textContent = item.label;

        menuItem.appendChild(iconContainer);
        menuItem.appendChild(label);

        menuItem.addEventListener('click', (e) => {
            e.stopPropagation();
            closeLongPressMenu();
            item.action();
        });

        menu.appendChild(menuItem);
    });

    backdrop.appendChild(menu);
    document.body.appendChild(backdrop);
    activeLongPressMenu = backdrop;

    // 定位菜单
    positionLongPressMenu(menu, bubble);
}

function positionLongPressMenu(menu, bubble) {
    const bubbleRect = bubble.getBoundingClientRect();
    const menuRect = menu.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    let top = bubbleRect.top - menuRect.height - 12;
    let left = bubbleRect.left + (bubbleRect.width / 2) - (menuRect.width / 2);

    // 如果上方空间不够，显示在下方
    if (top < 20) {
        top = bubbleRect.bottom + 12;
    }

    // 防止超出左右边界
    if (left < 12) {
        left = 12;
    } else if (left + menuRect.width > viewportWidth - 12) {
        left = viewportWidth - menuRect.width - 12;
    }

    menu.style.top = `${top}px`;
    menu.style.left = `${left}px`;
}

function getMessageTranslatableText(message) {
    if (!message) return '';

    if (typeof message.content === 'string') {
        return message.content.trim();
    }

    if (message.content?.type === 'voice') {
        return String(message.content.text || '').trim();
    }

    return '';
}

function canTranslateMessage(message) {
    return !!getMessageTranslatableText(message);
}

function copyMessageContent(message) {
    let textToCopy = '';

    if (typeof message.content === 'string') {
        textToCopy = message.content;
    } else if (message.content?.type === 'image') {
        textToCopy = '[图片]';
    } else if (message.content?.type === 'sticker') {
        textToCopy = `[表情包] ${message.content.label || ''}`;
    } else if (message.content?.type === 'voice') {
        textToCopy = message.content.text || '[语音]';
    }

    if (!textToCopy) return;

    navigator.clipboard.writeText(textToCopy).then(() => {
        showToast('已复制');
    }).catch(() => {
        showToast('复制失败');
    });
}

async function translateMessageToChinese(messageId) {
    const message = chatHistory.find(m => String(m.id) === String(messageId));
    const text = getMessageTranslatableText(message);

    if (!message || !text) {
        showToast('没有可翻译的文字');
        return;
    }

    if (message.translation?.sourceText === text && message.translation?.status === 'done' && message.translation?.text) {
        showToast('已翻译');
        return;
    }

    if (!apiSettings?.apiKey) {
        showToast('请先配置 API Key');
        return;
    }

    message.translation = {
        sourceText: text,
        text: '',
        status: 'loading'
    };
    rerenderCurrentChatMessages();

    try {
        const response = await requestChatCompletionWithFallback({
            systemPrompt: `你是专业翻译。自动识别用户输入的语言，并翻译成简体中文。
要求：
1. 只输出中文译文，不要解释，不要标注语言。
2. 如果原文已经是中文，输出“原文已是中文”。
3. 保留原文语气、称呼、标点和换行。`,
            history: [],
            userContent: text,
            temperature: 0.2,
            maxTokens: Math.min(800, Math.max(120, Math.ceil(text.length * 2.2)))
        });

        const translatedText = String(response?.data?.choices?.[0]?.message?.content || '')
            .replace(/^\s*译文[：:]/, '')
            .trim();

        message.translation = {
            sourceText: text,
            text: translatedText || '翻译失败，请稍后重试',
            status: translatedText ? 'done' : 'error'
        };

        saveChatHistory();
        rerenderCurrentChatMessages();
        showToast(translatedText ? '已翻译' : '翻译失败');
    } catch (error) {
        console.error('翻译消息失败:', error);
        message.translation = {
            sourceText: text,
            text: '翻译失败，请稍后重试',
            status: 'error'
        };
        saveChatHistory();
        rerenderCurrentChatMessages();
        showToast('翻译失败');
    }
}

function enterMultiSelectMode(messageId, bubble) {
    selectedChatMessageIds.add(String(messageId));
    setChatSelectionMode(true);
    updateSingleBubbleSelectionVisual(bubble);
    updateChatSelectionToolbar();
}

function quoteMessage(message) {
    const role = wechatRoles.find(r => r.id === currentRoleId);
    if (!role) return;

    // 保存引用的消息
    currentQuotedMessage = {
        id: message.id,
        content: message.content,
        role: message.role,
        authorName: message.role === 'user' ? '你' : role.nickname
    };

    // 显示引用预览
    showQuotePreview();

    // 聚焦输入框
    const textInput = document.getElementById('msgInput');
    if (textInput) {
        textInput.focus();
    }

    showToast('已添加引用');
}

function showQuotePreview() {
    if (!currentQuotedMessage) return;

    // 移除已存在的预览
    const existingPreview = document.querySelector('.chat-quote-preview');
    if (existingPreview) {
        existingPreview.remove();
    }

    // 获取输入栏容器
    const inputBar = document.querySelector('.chat-input-bar');
    if (!inputBar) return;

    // 创建引用预览
    const preview = document.createElement('div');
    preview.className = 'chat-quote-preview';

    // 左侧竖线
    const line = document.createElement('div');
    line.className = 'chat-quote-preview-line';

    // 内容区
    const content = document.createElement('div');
    content.className = 'chat-quote-preview-content';

    const author = document.createElement('div');
    author.className = 'chat-quote-preview-author';
    author.textContent = currentQuotedMessage.authorName;

    const text = document.createElement('div');
    text.className = 'chat-quote-preview-text';

    // 提取文本内容
    let displayText = '';
    if (typeof currentQuotedMessage.content === 'string') {
        displayText = currentQuotedMessage.content;
    } else if (currentQuotedMessage.content?.type === 'image') {
        displayText = '[图片]';
    } else if (currentQuotedMessage.content?.type === 'sticker') {
        displayText = `[表情包] ${currentQuotedMessage.content.label || ''}`;
    } else if (currentQuotedMessage.content?.type === 'voice') {
        displayText = currentQuotedMessage.content.text || '[语音]';
    }

    text.textContent = displayText;

    content.appendChild(author);
    content.appendChild(text);

    // 关闭按钮
    const closeBtn = document.createElement('button');
    closeBtn.className = 'chat-quote-preview-close';
    closeBtn.textContent = '✕';
    closeBtn.addEventListener('click', clearQuotePreview);

    preview.appendChild(line);
    preview.appendChild(content);
    preview.appendChild(closeBtn);

    // 插入到输入栏上方
    inputBar.style.position = 'relative';
    inputBar.appendChild(preview);
}

function clearQuotePreview() {
    currentQuotedMessage = null;
    const preview = document.querySelector('.chat-quote-preview');
    if (preview) {
        preview.style.opacity = '0';
        preview.style.transform = 'translateY(10px)';
        setTimeout(() => preview.remove(), 150);
    }
}

function scrollToMessage(messageId) {
    if (!messageId) return;

    const chatBox = document.getElementById('chatBox');
    if (!chatBox) return;

    // 查找目标消息气泡
    const targetBubble = chatBox.querySelector(`[data-message-id="${messageId}"]`);
    if (!targetBubble) {
        showToast('原消息未找到');
        return;
    }

    // 滚动到目标消息
    targetBubble.scrollIntoView({ behavior: 'smooth', block: 'center' });

    // 高亮闪烁效果
    targetBubble.style.transition = 'background 0.3s ease';
    const originalBg = targetBubble.style.background;
    targetBubble.style.background = 'rgba(102, 126, 234, 0.1)';

    setTimeout(() => {
        targetBubble.style.background = originalBg;
        setTimeout(() => {
            targetBubble.style.transition = '';
        }, 300);
    }, 800);
}

// 解析AI回复中的引用标记
function parseAIQuote(reply) {
    if (!reply || typeof reply !== 'string') {
        return { hasQuote: false, quotedMessageId: null, content: reply };
    }

    // 匹配引用语法：[quote:msg_xxx]
    const quoteMatch = reply.match(/^\[quote:(msg_[^\]]+)\]\s*/);

    if (!quoteMatch) {
        return { hasQuote: false, quotedMessageId: null, content: reply };
    }

    const quotedMessageId = quoteMatch[1];
    const content = reply.replace(quoteMatch[0], '').trim();

    return { hasQuote: true, quotedMessageId, content };
}

// 根据消息ID查找消息并构建引用数据
function buildQuotedMessageData(messageId) {
    if (!messageId) return null;

    const message = chatHistory.find(m => String(m.id) === String(messageId));
    if (!message) return null;

    const role = wechatRoles.find(r => r.id === currentRoleId);
    const authorName = message.role === 'user' ? '你' : (role?.nickname || '对方');

    return {
        id: message.id,
        content: message.content,
        authorName
    };
}

function recallMessage(messageId) {
    const index = chatHistory.findIndex(m => String(m.id) === String(messageId));
    if (index === -1) return;

    chatHistory.splice(index, 1);
    saveChatHistory();
    rerenderCurrentChatMessages();
    showToast('已撤回');

    // 更新聊天列表预览
    const lastMsg = chatHistory.length > 0 ? chatHistory[chatHistory.length - 1] : null;
    if (!lastMsg) {
        updateLastMessage('点击开始对话...');
    } else {
        updateLastMessage(getChatListPreviewText(lastMsg.content));
    }

    renderWechatChatList();
}

function showInnerVoice(message) {
    const role = wechatRoles.find(r => r.id === currentRoleId);
    if (!role) return;

    // 创建弹窗
    const backdrop = document.createElement('div');
    backdrop.className = 'inner-voice-modal-backdrop';

    const modal = document.createElement('div');
    modal.className = 'inner-voice-modal';

    // 头部
    const header = document.createElement('div');
    header.className = 'inner-voice-modal-header';

    const title = document.createElement('div');
    title.className = 'inner-voice-modal-title';
    title.textContent = '心声';

    const closeBtn = document.createElement('button');
    closeBtn.className = 'inner-voice-modal-close';
    closeBtn.textContent = '✕';
    closeBtn.addEventListener('click', () => backdrop.remove());

    header.appendChild(title);
    header.appendChild(closeBtn);

    // 内容区
    const content = document.createElement('div');
    content.className = 'inner-voice-modal-content';

    // 加载状态
    const loading = document.createElement('div');
    loading.className = 'inner-voice-loading';
    loading.innerHTML = `
        <div class="inner-voice-loading-spinner"></div>
        <div class="inner-voice-loading-text">正在读取角色的内心想法...</div>
    `;
    content.appendChild(loading);

    // 底部按钮
    const footer = document.createElement('div');
    footer.className = 'inner-voice-modal-footer';
    footer.style.display = 'none';

    const regenerateBtn = document.createElement('button');
    regenerateBtn.className = 'inner-voice-btn inner-voice-btn-secondary';
    regenerateBtn.textContent = '重新生成';

    const closeFooterBtn = document.createElement('button');
    closeFooterBtn.className = 'inner-voice-btn inner-voice-btn-primary';
    closeFooterBtn.textContent = '关闭';
    closeFooterBtn.addEventListener('click', () => backdrop.remove());

    footer.appendChild(regenerateBtn);
    footer.appendChild(closeFooterBtn);

    modal.appendChild(header);
    modal.appendChild(content);
    modal.appendChild(footer);
    backdrop.appendChild(modal);
    document.body.appendChild(backdrop);

    // 调用AI生成心声
    generateInnerVoice(message, role, content, footer, regenerateBtn);

    regenerateBtn.addEventListener('click', () => {
        content.innerHTML = `
            <div class="inner-voice-loading">
                <div class="inner-voice-loading-spinner"></div>
                <div class="inner-voice-loading-text">正在读取角色的内心想法...</div>
            </div>
        `;
        footer.style.display = 'none';
        regenerateBtn.disabled = true;
        generateInnerVoice(message, role, content, footer, regenerateBtn);
    });
}

async function generateInnerVoice(message, role, contentEl, footerEl, regenerateBtn) {
    try {
        const messageContent = typeof message.content === 'string'
            ? message.content
            : message.content?.text || '[非文本消息]';

        // 构建上下文
        const contextMessages = chatHistory.slice(-5).map(m => {
            const content = typeof m.content === 'string' ? m.content : m.content?.text || '';
            return `${m.role === 'user' ? '用户' : role.nickname}: ${content}`;
        }).join('\n');

        const prompt = `你是${role.nickname}，人设：${role.personality || '无特定人设'}

对话上下文：
${contextMessages}

刚才你说了这句话："${messageContent}"

请生成你说这句话时的内心想法。要求：
1. 以第一人称视角，展现真实的内心活动
2. 可以包含犹豫、纠结、真实感受、未说出口的想法
3. 语气要符合角色性格
4. 100-200字左右
5. 不要重复对话内容，只写内心想法

直接输出内心想法，不要加"内心想法："等前缀。`;

        const response = await fetch(`${apiSettings.apiUrl}${CONFIG.CHAT_COMPLETIONS_PATH}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiSettings.apiKey}`
            },
            body: JSON.stringify({
                model: apiSettings.model || CONFIG.DEFAULT_MODEL,
                messages: [{ role: 'user', content: prompt }],
                temperature: 0.8,
                max_tokens: 300
            })
        });

        if (!response.ok) {
            throw new Error('生成失败');
        }

        const data = await response.json();
        const innerVoice = data.choices?.[0]?.message?.content || '无法读取内心想法';

        contentEl.innerHTML = `<div class="inner-voice-text">${innerVoice}</div>`;
        footerEl.style.display = 'flex';
        regenerateBtn.disabled = false;

    } catch (error) {
        console.error('生成心声失败:', error);
        contentEl.innerHTML = `<div class="inner-voice-text" style="color: #ef4444;">生成失败，请稍后重试</div>`;
        footerEl.style.display = 'flex';
        regenerateBtn.disabled = false;
    }
}

function showToast(message, options = {}) {
    // 简单的toast提示
    const toast = document.createElement('div');
    toast.textContent = message;
    const isError = options?.type === 'error';
    toast.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: ${isError ? 'rgba(220, 38, 38, 0.92)' : 'rgba(0, 0, 0, 0.8)'};
        color: white;
        padding: 12px 24px;
        border-radius: 8px;
        font-size: 14px;
        z-index: 10002;
        animation: toastIn 0.2s ease-out;
    `;
    document.body.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transition = 'opacity 0.2s ease-out';
        setTimeout(() => toast.remove(), 200);
    }, 1500);
}

function bindChatBubbleSelectionBehavior(bubble, messageId) {
    if (!bubble || !(bubble instanceof HTMLElement)) return;
    if (!messageId) return;

    const resolvedMessageId = String(messageId);

    bubble.dataset.messageId = resolvedMessageId;
    bubble.classList.add('chat-selectable-bubble');

    const clearPressTimer = () => {
        if (chatLongPressTimer) {
            clearTimeout(chatLongPressTimer);
            chatLongPressTimer = null;
        }
        bubble.classList.remove('long-press-active');
    };

    bubble.addEventListener('pointerdown', (event) => {
        if (event.pointerType === 'mouse' && event.button !== 0) return;
        if (isChatSelectionMode) return; // 多选模式下不触发长按菜单

        clearPressTimer();
        bubble.classList.add('long-press-active');

        chatLongPressTimer = setTimeout(() => {
            bubble.classList.remove('long-press-active');
            showLongPressMenu(bubble, resolvedMessageId);
            if (navigator.vibrate) navigator.vibrate(20);
        }, 800); // 800ms触发
    });

    bubble.addEventListener('pointerup', clearPressTimer);
    bubble.addEventListener('pointercancel', clearPressTimer);
    bubble.addEventListener('pointerleave', clearPressTimer);

    bubble.addEventListener('contextmenu', (event) => {
        event.preventDefault();
    });

    bubble.addEventListener('click', (event) => {
        if (!isChatSelectionMode) return;
        event.preventDefault();
        event.stopPropagation();
        toggleChatBubbleSelection(resolvedMessageId, bubble);
    });
}

// 判断两条消息之间是否超过10分钟
function shouldShowTime(lastTimestamp, currentTimestamp) {
    if (!lastTimestamp) return true;  // 第一条消息前显示时间
    const diffMs = currentTimestamp - lastTimestamp;
    return diffMs > 10 * 60 * 1000;  // 10分钟
}

// 格式化时间戳为 HH:mm 格式
function formatTime(timestamp) {
    const date = new Date(timestamp);
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
}

// 创建时间分割线
function createTimeDivider(timestamp) {
    const divider = document.createElement('div');
    divider.className = 'time-divider';
    divider.textContent = formatTime(timestamp);
    return divider;
}

function createChatSystemNotice(text, messageId = null) {
    const notice = document.createElement('div');
    notice.className = 'chat-system-notice';
    notice.textContent = text;
    if (messageId) {
        notice.dataset.messageId = messageId;
    }
    return notice;
}

function receiveRedPacketMessage(messageId) {
    if (!messageId) return;

    const message = chatHistory.find(item => String(item?.id || '') === String(messageId));
    const content = message?.content;
    if (!content || typeof content !== 'object' || content.type !== 'red-packet') return;
    if (normalizeTransferStatus(content.status) === 'received') return;

    const role = wechatRoles.find(r => r.id === currentRoleId);
    const receivedAt = Date.now();
    content.status = 'received';
    content.receivedAt = receivedAt;
    addWalletRedPacketIncome({
        roleId: currentRoleId || '',
        roleName: role?.nickname || '对方',
        amount: content.amount,
        note: content.note || '红包',
        receivedAt
    });

    chatHistory.push({
        id: `red_packet_notice_${receivedAt}_${Math.random().toString(36).slice(2, 8)}`,
        role: 'system',
        type: 'transfer-notice',
        content: `已领取${role?.nickname || '对方'}的红包`,
        timestamp: receivedAt
    });
    saveChatHistory();
    rerenderCurrentChatMessages();
    renderWalletPage();
    renderWechatChatList();
}

function createMessageTranslationElement(translation, messageId = null) {
    if (!translation || translation.status === 'idle') return null;

    const translationBlock = document.createElement('div');
    translationBlock.className = 'msg-translation-block';
    translationBlock.addEventListener('pointerdown', (event) => {
        event.stopPropagation();
    });
    translationBlock.addEventListener('contextmenu', (event) => {
        event.preventDefault();
        event.stopPropagation();
    });

    if (translation.status === 'loading') {
        translationBlock.classList.add('loading');
        const text = document.createElement('span');
        text.textContent = '正在翻译...';
        translationBlock.appendChild(text);

        const dots = document.createElement('span');
        dots.className = 'msg-translation-dots';
        dots.setAttribute('aria-hidden', 'true');
        dots.innerHTML = '<span></span><span></span><span></span>';
        translationBlock.appendChild(dots);
    } else {
        if (translation.status === 'error') {
            translationBlock.classList.add('error');
            translationBlock.textContent = '翻译失败，点击重试';

            if (messageId) {
                translationBlock.setAttribute('role', 'button');
                translationBlock.tabIndex = 0;
                const retryTranslation = (event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    translateMessageToChinese(messageId);
            
    };
                translationBlock.addEventListener('click', retryTranslation);
                translationBlock.addEventListener('keydown', (event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                        retryTranslation(event);
                    }
                });
            }
        } else {
            translationBlock.textContent = translation.text || '翻译失败，点击重试';
        }
    }

    return translationBlock;
}

// 创建用户消息气泡（不包含时间戳）
// 参数：text(消息内容), showAvatar(是否显示头像), messageId, quotedMessage(引用的消息)
function createUserBubble(text, showAvatar = true, messageId = null, quotedMessage = null, translation = null) {
    const userMsg = document.createElement('div');
    userMsg.className = 'msg-bubble-user';

    if (showAvatar) {
        const userAvatar = document.createElement('div');
        userAvatar.className = 'msg-avatar';
        applyAvatarRenderConfig(userAvatar, wechatUser.avatar, wechatUser.nickname || '我');
        userMsg.appendChild(userAvatar);
    } else {
        const spacer = document.createElement('div');
        spacer.className = 'msg-avatar msg-avatar-spacer';
        userMsg.appendChild(spacer);
    }

    const contentStack = document.createElement('div');
    contentStack.className = 'msg-content-stack';

    const bubbleDiv = createMessageContentElement(text);
    contentStack.appendChild(bubbleDiv);

    const translationBlock = createMessageTranslationElement(translation, messageId);
    if (translationBlock) {
        contentStack.appendChild(translationBlock);
    }

    if (quotedMessage) {
        contentStack.appendChild(createMessageQuoteElement(quotedMessage));
    }

    userMsg.appendChild(contentStack);
    bindChatBubbleSelectionBehavior(userMsg, messageId);

    return userMsg;
}

// 创建AI消息气泡（不包含时间戳）
// 参数：text(消息内容), showAvatar(是否显示头像), role(角色信息), messageId, quotedMessage(引用的消息)
function createAIBubble(text, showAvatar, role, messageId = null, quotedMessage = null, translation = null) {
    const aiMsg = document.createElement('div');
    aiMsg.className = 'msg-bubble-ai';

    if (showAvatar) {
        const aiAvatar = document.createElement('div');
        aiAvatar.className = 'msg-avatar';
        applyAvatarRenderConfig(aiAvatar, role?.avatar || '', role?.nickname || '?');
        aiMsg.appendChild(aiAvatar);
    } else {
        const spacer = document.createElement('div');
        spacer.className = 'msg-avatar msg-avatar-spacer';
        aiMsg.appendChild(spacer);
    }

    const contentStack = document.createElement('div');
    contentStack.className = 'msg-content-stack';

    const bubbleDiv = createMessageContentElement(text);
    contentStack.appendChild(bubbleDiv);

    const translationBlock = createMessageTranslationElement(translation, messageId);
    if (translationBlock) {
        contentStack.appendChild(translationBlock);
    }

    if (quotedMessage) {
        contentStack.appendChild(createMessageQuoteElement(quotedMessage));
    }

    aiMsg.appendChild(contentStack);
    bindChatBubbleSelectionBehavior(aiMsg, messageId);

    return aiMsg;
}

async function resolveChatImageContentUrl(imageContent) {
    if (!imageContent || typeof imageContent !== 'object') return '';

    if (typeof imageContent.url === 'string' && imageContent.url.trim()) {
        return imageContent.url.trim();
    }

    const imageId = String(imageContent.imageId || '').trim();
    if (!imageId) return '';

    const cached = getCachedChatImageData(imageId);
    if (cached) return cached;

    const restored = await resolveMediaRefToDataUrl(imageId);
    if (restored) return restored;

    try {
        const record = await getChatImageFromDB(imageId);
        if (record?.dataUrl) {
            cacheChatImageData(imageId, record.dataUrl);
            return record.dataUrl;
        }
    } catch (error) {
        console.warn('读取聊天图片失败:', error);
    }

    return '';
}

function buildChatImageDownloadFilename(imageContent = {}) {
    const url = String(imageContent?.url || '').toLowerCase();
    const extension = url.includes('image/webp')
        ? 'webp'
        : url.includes('image/jpeg') || url.includes('image/jpg')
            ? 'jpg'
            : url.includes('image/gif')
                ? 'gif'
                : 'png';

    // 文件名中文部分控制在不超过6字：
    // - 默认：图片（2字）
    // - 为降低重名概率：图 + 4位数字（共5字）
    const shortSuffix = String(Date.now()).slice(-4);
    const baseName = `图${shortSuffix}`;

    return `${baseName}.${extension}`;
}

function closeChatImagePreview() {
    const modal = document.getElementById('chatImagePreviewModal');
    if (!modal) return;

    modal.classList.remove('active');
    modal.dataset.imageContent = '';

    const previewImage = document.getElementById('chatImagePreviewImage');
    if (previewImage) {
        previewImage.src = '';
        previewImage.alt = '图片预览';
    }
}

async function openChatImagePreview(imageContent = {}) {
    const modal = document.getElementById('chatImagePreviewModal');
    const previewImage = document.getElementById('chatImagePreviewImage');
    const downloadBtn = document.getElementById('chatImagePreviewDownloadBtn');

    if (!modal || !previewImage) return;

    const imageUrl = await resolveChatImageContentUrl(imageContent);
    if (!imageUrl) {
        showAIError('图片加载失败，暂时无法预览');
        return;
    }

    const serializedContent = JSON.stringify({
        imageId: imageContent.imageId || '',
        name: imageContent.name || '聊天图片',
        url: imageUrl
    });

    modal.dataset.imageContent = serializedContent;
    previewImage.src = imageUrl;
    previewImage.alt = imageContent.name || '图片预览';
    modal.classList.add('active');

    if (downloadBtn) {
        downloadBtn.disabled = false;
    }
}

async function downloadCurrentPreviewImage() {
    const modal = document.getElementById('chatImagePreviewModal');
    if (!modal) return;

    let imageContent = {};
    try {
        imageContent = modal.dataset.imageContent
            ? JSON.parse(modal.dataset.imageContent)
            : {};
    } catch (error) {
        imageContent = {};
    }

    const imageUrl = await resolveChatImageContentUrl(imageContent);
    if (!imageUrl) {
        showAIError('图片加载失败，暂时无法保存');
        return;
    }

    const link = document.createElement('a');
    link.href = imageUrl;
    link.download = buildChatImageDownloadFilename({
        ...imageContent,
        url: imageUrl
    });
    link.rel = 'noopener';
    document.body.appendChild(link);
    link.click();
    link.remove();

    if (window.DataManager) {
        DataManager.showToast('已开始保存图片');
    }
}

function getQuotedMessageDisplayText(quotedMessage) {
    if (!quotedMessage) return '';
    if (typeof quotedMessage.content === 'string') return quotedMessage.content;
    if (quotedMessage.content?.type === 'image') return '[图片]';
    if (quotedMessage.content?.type === 'sticker') return `[表情包] ${quotedMessage.content.label || ''}`;
    if (quotedMessage.content?.type === 'voice') return quotedMessage.content.text || '[语音]';
    return '';
}

function createMessageQuoteElement(quotedMessage) {
    const quoteBlock = document.createElement('div');
    quoteBlock.className = 'msg-quote-block';
    quoteBlock.dataset.quotedMessageId = quotedMessage.id;

    const quoteText = document.createElement('div');
    quoteText.className = 'msg-quote-text';
    const authorName = quotedMessage.authorName ? `${quotedMessage.authorName}: ` : '';
    quoteText.textContent = `${authorName}${getQuotedMessageDisplayText(quotedMessage)}`;

    quoteBlock.appendChild(quoteText);
    quoteBlock.addEventListener('click', (e) => {
        e.stopPropagation();
        scrollToMessage(quotedMessage.id);
    });

    return quoteBlock;
}

function createMessageContentElement(content) {
    const bubbleDiv = document.createElement('div');
    bubbleDiv.className = 'msg-text';

    const appendMessageText = (text) => {
        const textNode = document.createElement('span');
        textNode.className = 'msg-main-text';
        textNode.textContent = text;
        bubbleDiv.appendChild(textNode);
    };

    // 渲染消息内容
    if (content && typeof content === 'object') {
        if (content.type === 'image') {
            if (content.url) {
                bubbleDiv.classList.add('msg-image');
                const image = document.createElement('img');
                image.src = content.url;
                image.alt = content.name || '发送的图片';
                image.className = 'chat-clickable-image';
                image.onclick = (event) => {
                    event.stopPropagation();
                    openChatImagePreview(content);
            
    };
                bubbleDiv.appendChild(image);
                return bubbleDiv;
            }

            bubbleDiv.textContent = content.missing
                ? '[图片加载失败或已丢失]'
                : '[图片加载中]';
            return bubbleDiv;
        }

        if (content.type === 'voice') {
            bubbleDiv.classList.add('msg-voice');

            const voiceShell = document.createElement('div');
            voiceShell.className = 'voice-shell';

            const voiceMain = document.createElement('div');
            voiceMain.className = 'voice-main';

            const playBtn = document.createElement('button');
            playBtn.type = 'button';
            playBtn.className = 'voice-play-btn';
            playBtn.setAttribute('aria-label', '播放语音');
            playBtn.innerHTML = `
                <span class="voice-play-icon voice-play-icon-play"></span>
                <span class="voice-play-icon voice-play-icon-pause"></span>
            `;

            const voiceBody = document.createElement('div');
            voiceBody.className = 'voice-body';

            const voiceMeta = document.createElement('div');
            voiceMeta.className = 'voice-meta';

            const statusBadge = document.createElement('span');
            statusBadge.className = 'voice-status-badge';
            statusBadge.textContent = content.transcriptVisible && content.text ? '已转文字' : '语音';

            const duration = document.createElement('div');
            duration.className = 'voice-duration';
            duration.textContent = '0″';

            voiceMeta.appendChild(statusBadge);
            voiceMeta.appendChild(duration);

            const waveform = document.createElement('div');
            waveform.className = 'voice-waveform';
            waveform.setAttribute('aria-hidden', 'true');
            waveform.innerHTML = `
                <span></span><span></span><span></span><span></span>
                <span></span><span></span><span></span><span></span>
                <span></span><span></span><span></span><span></span>
            `;

            voiceBody.appendChild(voiceMeta);
            voiceBody.appendChild(waveform);

            voiceMain.appendChild(playBtn);
            voiceMain.appendChild(voiceBody);
            voiceShell.appendChild(voiceMain);

            if (content.text) {
                bubbleDiv.classList.add('has-transcript');

                if (content.transcriptVisible) {
                    bubbleDiv.classList.add('transcript-visible');
                }

                const transcriptBlock = document.createElement('div');
                transcriptBlock.className = 'voice-transcript-block';

                const transcriptLabel = document.createElement('div');
                transcriptLabel.className = 'voice-transcript-label';
                transcriptLabel.textContent = '转文字';

                const transcript = document.createElement('div');
                transcript.className = 'voice-transcript';
                transcript.textContent = content.text;

                transcriptBlock.appendChild(transcriptLabel);
                transcriptBlock.appendChild(transcript);
                voiceShell.appendChild(transcriptBlock);
            }

            bubbleDiv.appendChild(voiceShell);

            let voiceLongPressTimer = null;
            let voiceMenuTriggered = false;

            const clearVoiceLongPressTimer = () => {
                if (voiceLongPressTimer) {
                    clearTimeout(voiceLongPressTimer);
                    voiceLongPressTimer = null;
                }
        
    };

            const openVoiceMenu = () => {
                const parentBubble = bubbleDiv.closest('.chat-selectable-bubble');
                const messageId = parentBubble?.dataset?.messageId || '';
                if (!messageId) return;

                voiceMenuTriggered = true;
                openVoiceActionMenu({
                    messageId,
                    voiceBubbleEl: bubbleDiv
                });

                if (navigator.vibrate) {
                    navigator.vibrate(18);
                }
        
    };

            bubbleDiv.addEventListener('pointerdown', (event) => {
                if (isChatSelectionMode) return;
                if (event.pointerType === 'mouse' && event.button !== 0) return;
                if (event.target.closest('.voice-play-btn')) return;

                event.stopPropagation();
                voiceMenuTriggered = false;
                clearVoiceLongPressTimer();
                voiceLongPressTimer = setTimeout(() => {
                    openVoiceMenu();
                }, CHAT_LONG_PRESS_MS);
            });

            bubbleDiv.addEventListener('pointerup', (event) => {
                if (!event.target.closest('.voice-play-btn')) {
                    event.stopPropagation();
                }
                clearVoiceLongPressTimer();
            });

            bubbleDiv.addEventListener('pointercancel', clearVoiceLongPressTimer);
            bubbleDiv.addEventListener('pointerleave', clearVoiceLongPressTimer);

            bubbleDiv.addEventListener('contextmenu', (event) => {
                event.preventDefault();
                event.stopPropagation();
                if (!isChatSelectionMode) {
                    openVoiceMenu();
                }
            });

            bubbleDiv.addEventListener('click', (event) => {
                if (event.target.closest('.voice-play-btn')) return;
                if (voiceMenuTriggered) {
                    event.preventDefault();
                    event.stopPropagation();
                    voiceMenuTriggered = false;
                    return;
                }
                event.stopPropagation();
            });

            if (content.url) {
                const audio = document.createElement('audio');
                audio.preload = 'metadata';
                audio.src = content.url;
                audio.className = 'voice-audio-core';
                bubbleDiv.appendChild(audio);

                const syncPlayState = () => {
                    const playing = !audio.paused && !audio.ended;
                    bubbleDiv.classList.toggle('playing', playing);
                    bubbleDiv.classList.remove('voice-error', 'voice-empty');
                    statusBadge.textContent = playing
                        ? '播放中'
                        : (bubbleDiv.classList.contains('transcript-visible') && content.text ? '已转文字' : '语音');
                    playBtn.setAttribute('aria-label', playing ? '暂停语音' : '播放语音');
            
    };

                playBtn.onclick = (event) => {
                    event.stopPropagation();
                    if (audio.paused) {
                        audio.play().catch(() => {
                            bubbleDiv.classList.add('voice-error');
                            statusBadge.textContent = '播放失败';
                            duration.textContent = '失败';
                        });
                    } else {
                        audio.pause();
                    }
            
    };

                audio.onloadedmetadata = () => {
                    const seconds = Math.max(1, Math.round(audio.duration || 0));
                    duration.textContent = `${seconds}″`;
            
    };
                audio.onplay = syncPlayState;
                audio.onpause = syncPlayState;
                audio.onended = syncPlayState;
                audio.onerror = () => {
                    bubbleDiv.classList.add('voice-error');
                    statusBadge.textContent = '播放失败';
                    duration.textContent = '失败';
                    playBtn.disabled = true;
            
    };
            } else {
                bubbleDiv.classList.add('voice-empty');
                statusBadge.textContent = '无音频';
                duration.textContent = '无音频';
                playBtn.disabled = true;
            }

            return bubbleDiv;
        }

        if (content.type === 'sticker' && content.url) {
            bubbleDiv.classList.add('msg-sticker');
            const stickerImage = document.createElement('img');
            stickerImage.src = content.url;
            stickerImage.alt = content.label || '表情包';
            stickerImage.className = 'sticker-image';
            bubbleDiv.appendChild(stickerImage);
            return bubbleDiv;
        }

        if (content.type === 'sticker') {
            bubbleDiv.classList.add('msg-sticker');
            const stickerPill = document.createElement('div');
            stickerPill.className = 'sticker-pill';
            stickerPill.textContent = content.value || content.label || '表情包';
            bubbleDiv.appendChild(stickerPill);
            return bubbleDiv;
        }

        if (content.type === 'gift') {
            bubbleDiv.classList.add('msg-gift');
            const giftName = String(content.name || '道具').trim();
            const giftDesc = String(content.description || '').trim();
            const giftImage = String(content.image || '').trim();
            const giftStatus = String(content.status || content.giftStatus || '').trim();
            const isLoveLetter = isLoveLetterGift(content);
            const isVibrator = isVibratorGift(content);
            const isLingerie = isLingerieGift(content);
            const giftStatusText = giftStatus === 'received' || giftStatus === 'accepted' || giftStatus === '已接收'
                ? '已接收'
                : '已送出';
            const loveLetterIcon = getLoveLetterGiftIconSvg();
            const massageWandIcon = getMassageWandGiftIconSvg();

            bubbleDiv.innerHTML = `
                <div class="gift-message-card${isLoveLetter ? ' love-letter-gift-card' : ''}${isVibrator ? ' vibrator-gift-card' : ''}${isLingerie ? ' lingerie-gift-card' : ''}">
                    <div class="gift-message-icon" aria-hidden="true">
                        ${isLoveLetter ? loveLetterIcon : (isVibrator ? massageWandIcon : (giftImage ? `<img class="gift-message-image" src="${escapeHtml(giftImage)}" alt="">` : '<span class="gift-message-fallback">礼</span>'))}
                    </div>
                    <div class="gift-message-main">
                        <div class="gift-message-name">${escapeHtml(giftName)}</div>
                        <div class="gift-message-label">赠送礼物 · ${giftStatusText}</div>
                        <div class="gift-message-desc">${escapeHtml(isLoveLetter ? '角色将写下一封真心回信' : giftDesc)}</div>
                    </div>
                </div>
            `;
            return bubbleDiv;
        }

        if (content.type === 'forum-share') {
            bubbleDiv.classList.add('msg-forum-share');
            const forumName = String(content.forumName || '论坛').trim();
            const title = String(content.title || '论坛帖子').trim();
            const authorName = String(content.authorName || '匿名网友').trim();

            const card = document.createElement('article');
            card.className = 'forum-share-card';
            card.innerHTML = `
                <div class="forum-share-card-kicker">论坛帖子 · ${escapeHtml(forumName)}</div>
                <div class="forum-share-card-title">${escapeHtml(title)}</div>
                <div class="forum-share-card-meta">由 ${escapeHtml(authorName)} 发布</div>
            `;
            bubbleDiv.appendChild(card);
            return bubbleDiv;
        }

        if (content.type === 'love-letter-reply') {
            bubbleDiv.classList.add('msg-love-letter-reply');
            const title = String(content.title || '给你的回信').trim();
            const text = String(content.text || '').trim();
            const signatureMatch = text.match(/(?:^|\n)\s*[—\-－]{1,2}\s*([^\n]{1,16})\s*$/);
            const signatureName = signatureMatch
                ? signatureMatch[1].trim()
                : (title.match(/^(.+?)写/)?.[1] || '对方');
            const bodyText = signatureMatch
                ? text.slice(0, signatureMatch.index).trim()
                : text;
            const paragraphs = bodyText
                .split(/\n{2,}|\n/)
                .map(item => item.trim())
                .filter(Boolean);
            const bodyHtml = paragraphs.length > 0
                ? paragraphs.map(item => `<p>${escapeHtml(item)}</p>`).join('')
                : `<p>${escapeHtml(bodyText || text)}</p>`;
            bubbleDiv.innerHTML = `
                <article class="love-letter-reply-card">
                    <div class="love-letter-reply-title">${escapeHtml(title)}</div>
                    <div class="love-letter-reply-rule" aria-hidden="true"></div>
                    <div class="love-letter-reply-body">${bodyHtml}</div>
                    <div class="love-letter-reply-ending" aria-hidden="true"></div>
                    <div class="love-letter-reply-signature">—— ${escapeHtml(signatureName)}</div>
                </article>
            `;
            return bubbleDiv;
        }

        if (content.type === 'transfer') {
            bubbleDiv.classList.add('msg-transfer');
            const transferCard = document.createElement('button');
            transferCard.type = 'button';
            const amount = formatTransferAmount(content.amount);
            const note = String(content.note || '').trim();
            const status = normalizeTransferStatus(content.status);
            const isReceived = status === 'received';
            const isRefunded = status === 'refunded';
            const isPending = status === 'sent';
            bubbleDiv.classList.toggle('is-received', isReceived);
            bubbleDiv.classList.toggle('is-refunded', isRefunded);
            const amountClass = amount.length >= 8 ? ' compact' : '';
            const desc = isReceived
                ? '已被接收'
                : (isRefunded ? '已退回' : (note || '待对方接收'));
            const iconSvg = isReceived
                ? `
                        <svg viewBox="0 0 24 24" focusable="false" class="ui-line-icon">
                            <path d="M6 12.4l3.7 3.7L18.5 7.3"></path>
                        </svg>
                    `
                : `
                        <svg viewBox="0 0 32 32" focusable="false" class="transfer-arrow-icon">
                            <path d="M26 12.05H11l2.9-3.5c.3-.4.2-.85-.15-1.1-.4-.25-.85-.15-1.15.2l-5 5.8c-.22.28-.26.66-.1.96.17.31.48.49.84.49H26c.46 0 .84-.38.84-.84v-1.17c0-.46-.38-.84-.84-.84z"></path>
                            <path d="M6 19.95h15l-2.9 3.5c-.3.4-.2.85.15 1.1.4.25.85.15 1.15-.2l5-5.8c.22-.28.26-.66.1-.96-.17-.31-.48-.49-.84-.49H6c-.46 0-.84.38-.84.84v1.17c0 .46.38.84.84.84z"></path>
                        </svg>
                    `;
            transferCard.className = `transfer-card ${isReceived ? 'received' : (isRefunded ? 'refunded' : 'sent')}`;
            transferCard.disabled = !isPending;
            transferCard.setAttribute('aria-label', `${getTransferStatusText(status)}转账 ¥${amount}`);
            transferCard.addEventListener('click', (event) => {
                event.stopPropagation();
                const messageId = event.currentTarget.closest('[data-message-id]')?.dataset?.messageId || '';
                handleTransferCardClick(messageId);
            });
            transferCard.addEventListener('pointerdown', (event) => {
                event.stopPropagation();
            });
            transferCard.addEventListener('contextmenu', (event) => {
                event.preventDefault();
                event.stopPropagation();
            });

            transferCard.innerHTML = `
                <div class="transfer-card-body">
                    <div class="transfer-card-icon" aria-hidden="true">
                        ${iconSvg}
                    </div>
                    <div class="transfer-card-main">
                        <div class="transfer-card-amount${amountClass}">¥${escapeHtml(amount)}</div>
                        <div class="transfer-card-desc">${escapeHtml(desc)}</div>
                    </div>
                </div>
                <div class="transfer-card-footer">${isPending ? '转账 · 点开可退回' : '转账'}</div>
            `;
            bubbleDiv.appendChild(transferCard);
            return bubbleDiv;
        }

        if (content.type === 'red-packet') {
            bubbleDiv.classList.add('msg-red-packet');
            const amount = formatTransferAmount(content.amount);
            const note = String(content.note || '').trim();
            const isReceived = normalizeTransferStatus(content.status) === 'received';
            bubbleDiv.classList.toggle('is-received', isReceived);

            const card = document.createElement('button');
            card.type = 'button';
            card.className = `red-packet-card ${isReceived ? 'received' : 'sent'}`;
            card.disabled = isReceived;
            card.setAttribute('aria-label', `${isReceived ? '已领取红包' : '领取红包'} ¥${amount}`);
            card.addEventListener('click', (event) => {
                event.stopPropagation();
                const messageId = event.currentTarget.closest('[data-message-id]')?.dataset?.messageId || '';
                receiveRedPacketMessage(messageId);
            });

            card.innerHTML = `
                <div class="red-packet-body">
                    <div class="red-packet-icon" aria-hidden="true">
                        <span class="red-packet-flap"></span>
                        <span class="red-packet-coin">¥</span>
                    </div>
                    <div class="red-packet-main">
                        <div class="red-packet-title">${escapeHtml(note || '恭喜发财，大吉大利')}</div>
                        <div class="red-packet-desc">${isReceived ? `已领取 ¥${escapeHtml(amount)}` : `红包 ¥${escapeHtml(amount)}`}</div>
                    </div>
                </div>
                <div class="red-packet-footer">红包</div>
            `;
            bubbleDiv.appendChild(card);
            return bubbleDiv;
        }
    }

    if (typeof content === 'string') {
        appendMessageText(content);
    }
    return bubbleDiv;
}

// 合并连续的assistant消息用于API请求
function normalizeChatContentForAPI(content, role = 'user') {
    if (typeof content === 'string') {
        return content.trim();
    }

    if (!content || typeof content !== 'object') {
        return '';
    }

    if (content.type === 'image') {
        const imageName = content.name ? `（${content.name}）` : '';
        return role === 'assistant'
            ? `[对方发送了一张图片${imageName}]`
            : `[用户发送了一张图片${imageName}]`;
    }

    if (content.type === 'sticker') {
        const stickerLabel = content.label || content.value || '表情包';
        return role === 'assistant'
            ? `[对方发送了表情包：${stickerLabel}]`
            : `[用户发送了表情包：${stickerLabel}]`;
    }

    if (content.type === 'voice') {
        const transcript = content.text || '语音消息';
        return role === 'assistant'
            ? `[对方发送了一条语音：${transcript}]`
            : `[用户发送了一条语音：${transcript}]`;
    }

    if (content.type === 'gift') {
        const giftName = content.name || '道具';
        const giftDesc = content.description ? `，效果：${content.description}` : '';
        const effect = content.effect && typeof content.effect === 'object'
            ? `，这份礼物让角色好感 +${Number(content.effect.affectionDelta) || 0}，当前关系更亲密`
            : '';
        return role === 'assistant'
            ? `[对方收到/回应了道具：${giftName}${giftDesc}${effect}]`
            : `[用户赠送给你一个道具：${giftName}${giftDesc}${effect}。这不是普通聊天，而是必须触发的道具剧情事件；你必须明确收下并立刻按道具效果推进剧情，不允许拒绝、无视或说没有这个剧情。]`;
    }

    if (content.type === 'love-letter-reply') {
        const letterText = String(content.text || '').trim();
        return role === 'assistant'
            ? `[对方写给用户的情书回信：${letterText}]`
            : `[用户收到了一封情书回信：${letterText}]`;
    }

    if (content.type === 'forum-share') {
        const forumName = content.forumName || '论坛';
        const title = content.title || '论坛帖子';
        const authorName = content.authorName || '匿名网友';
        const excerpt = content.excerpt ? `，摘要：${content.excerpt}` : '';
        return role === 'assistant'
            ? `[对方分享了一篇论坛帖子，来自${forumName}，标题：${title}，作者：${authorName}${excerpt}]`
            : `[用户分享给你一篇论坛帖子，来自${forumName}，标题：${title}，作者：${authorName}${excerpt}。你可以像收到好友分享一样读懂标题和摘要，并自然回应。]`;
    }

    if (content.type === 'transfer') {
        const amount = formatTransferAmount(content.amount);
        const note = content.note ? `，备注：${content.note}` : '';
        const status = normalizeTransferStatus(content.status);
        const statusText = status === 'received'
            ? '状态：已被接收'
            : (status === 'refunded' ? '状态：已退回' : '状态：待处理，需要你明确决定收下或退回');
        return role === 'assistant'
            ? `[对方发送了一笔转账：¥${amount}${note}，${statusText}]`
            : `[用户发送了一笔转账：¥${amount}${note}，${statusText}]`;
    }

    if (content.type === 'red-packet') {
        const amount = formatTransferAmount(content.amount);
        const note = content.note ? `，祝福语：${content.note}` : '';
        return role === 'assistant'
            ? `[对方发送了一个红包：¥${amount}${note}]`
            : `[用户收到一个红包：¥${amount}${note}]`;
    }

    return '';
}

function isVisionEnabled() {
    return !!apiSettings.enableVision;
}

function hasImageContent(content) {
    return !!(content && typeof content === 'object' && content.type === 'image' && (content.url || content.imageId));
}

function historyContainsImage(history = []) {
    return history.some(msg => hasImageContent(msg?.content));
}

function extractErrorMessage(data, fallback = '') {
    if (!data) return fallback;
    if (typeof data === 'string') return data || fallback;

    return data?.error?.message
        || data?.message
        || data?.detail
        || fallback;
}

function classifyVisionError(message = '') {
    const normalized = String(message).toLowerCase().trim();
    if (!normalized) return null;

    const unsupportedVisionKeywords = [
        'does not support image',
        'does not support vision',
        'unsupported modality',
        'vision not supported',
        'image input is not supported',
        'images are not supported',
        '不支持图片',
        '不支持图像',
        '不支持视觉',
        '不支持多模态',
        '视觉能力未开启',
        '模型不支持图片识别'
    ];

    const imageFormatKeywords = [
        'unsupported image format',
        'invalid image format',
        'image format',
        'invalid image',
        'corrupt image',
        'corrupted image',
        'unsupported image',
        'mpo',
        '图片格式',
        '图像格式',
        '图片损坏',
        '图像损坏',
        '无法解析图片',
        '无法读取图片'
    ];

    if (unsupportedVisionKeywords.some(keyword => normalized.includes(keyword))) {
        return 'unsupported';
    }

    if (imageFormatKeywords.some(keyword => normalized.includes(keyword))) {
        return 'format';
    }

    const likelyVisionRequestKeywords = [
        'image_url',
        'content type',
        'invalid content type',
        'invalid url',
        'bad request',
        'invalid request',
        'messages',
        'content',
        'image',
        '图片',
        '图像',
        '视觉',
        '多模态'
    ];

    if (likelyVisionRequestKeywords.some(keyword => normalized.includes(keyword))) {
        return 'request_failed';
    }

    return null;
}

function getVisionFallbackMessage(reason) {
    if (reason === 'unsupported') {
        return '当前模型不支持图片识别，已自动改为文本模式发送';
    }

    if (reason === 'format') {
        return '当前图片格式不兼容，已自动改为文本模式发送';
    }

    return '图片识别请求失败，已自动改为文本模式发送';
}

function buildMessageContentForAPI(content, role = 'user', useVision = false) {
    if (typeof content === 'string') {
        return content.trim();
    }

    if (!content || typeof content !== 'object') {
        return '';
    }

    if (content.type === 'image') {
        if (useVision && role === 'user' && content.url) {
            if (isVisionSupportedDataUrl(content.url)) {
                return [
                    {
                        type: 'text',
                        text: content.name
                            ? `请查看这张图片（${content.name}），并结合上下文自然回复。`
                            : '请查看这张图片，并结合上下文自然回复。'
                    },
                    {
                        type: 'image_url',
                        image_url: {
                            url: content.url
                        }
                    }
                ];
            }

            const mime = getDataImageMimeType(content.url) || '未知格式';
            const formatHint = looksLikeMpoDataUrl(content.url) ? '，检测到 iOS/MPO 兼容问题' : '';
            console.warn(`检测到视觉接口不支持的图片格式（${mime}${formatHint}），已自动降级为文本模式发送该图片消息`);
            return normalizeChatContentForAPI(content, role);
        }

        return normalizeChatContentForAPI(content, role);
    }

    if (content.type === 'sticker') {
        return normalizeChatContentForAPI(content, role);
    }

    if (content.type === 'transfer' || content.type === 'red-packet' || content.type === 'gift' || content.type === 'forum-share') {
        return normalizeChatContentForAPI(content, role);
    }

    return '';
}

function buildChatHistoryForAPI(history, useVision = false) {
    return history
        .map((msg) => {
            let normalizedContent = buildMessageContentForAPI(msg.content, msg.role, useVision);
            if (!normalizedContent || (Array.isArray(normalizedContent) && normalizedContent.length === 0)) {
                return null;
            }

            // 如果消息包含引用，添加引用上下文
            if (msg.quotedMessage) {
                const quotedContent = typeof msg.quotedMessage.content === 'string'
                    ? msg.quotedMessage.content
                    : normalizeChatContentForAPI(msg.quotedMessage.content, 'assistant');

                const quotedAuthor = msg.quotedMessage.authorName || '对方';
                const quotePrefix = msg.role === 'user'
                    ? `[用户引用了${quotedAuthor}之前说的："${quotedContent}"，并回复：]\n`
                    : `[${quotedAuthor}引用了之前的消息："${quotedContent}"，并回复：]\n`;

                // 如果是字符串内容，直接拼接
                if (typeof normalizedContent === 'string') {
                    normalizedContent = quotePrefix + normalizedContent;
                } else if (Array.isArray(normalizedContent)) {
                    // 如果是数组（vision模式），在第一个text元素前添加引用
                    const firstTextIndex = normalizedContent.findIndex(item => item.type === 'text');
                    if (firstTextIndex !== -1) {
                        normalizedContent[firstTextIndex].text = quotePrefix + normalizedContent[firstTextIndex].text;
                    }
                }
            }

            return {
                role: msg.role,
                content: normalizedContent
        
    };
        })
        .filter(Boolean);
}

function getActiveGamePromptContext() {
    if (!currentGameState.active || currentGameState.type !== 'gomoku') {
        return '';
    }
    const role = wechatRoles.find(r => r.id === currentRoleId);
    const roleName = role?.nickname || '该角色';
    const turnLabel = currentGameState.winner
        ? '对局已结束'
        : (currentGameState.currentTurn === 'user' ? '现在轮到用户落子' : `现在轮到${roleName}落子`);
    const winnerLabel = currentGameState.winner === 'user'
        ? '用户已经获胜'
        : currentGameState.winner === 'role'
            ? `${roleName}已经获胜`
            : currentGameState.winner === 'draw'
                ? '当前对局平局'
                : '当前对局仍在进行中';

    const userMoveText = currentGameState.lastUserMove
        ? `用户最近一步落在第${currentGameState.lastUserMove.row + 1}行第${currentGameState.lastUserMove.col + 1}列。`
        : '用户还没有最近一步记录。';
    const roleMoveText = currentGameState.lastRoleMove
        ? `${roleName}最近一步落在第${currentGameState.lastRoleMove.row + 1}行第${currentGameState.lastRoleMove.col + 1}列。`
        : `${roleName}还没有最近一步记录。`;

    return `
【游戏互动上下文】
你现在正在和用户亲自进行“五子棋”对局，不是旁观，也不是讲解员，而是你自己在和用户下棋、聊天、互动。
黑白双方设定：用户执黑（●），你执白（○）。
${turnLabel}。${winnerLabel}。
${userMoveText}
${roleMoveText}
如果用户聊到下棋、落子、输赢、策略、悔棋、继续玩等内容，你必须明确知道这是你自己正在和用户对局。
回复时可以自然带一点对局中的语气，比如观察局势、回应对方刚才那一步、表达你自己此刻在下棋时的想法，但仍要符合你的人设。
不要把自己说成系统、规则说明员、裁判或旁观者。
`;
}

function buildMessagesForAPI(systemPrompt, history, userContent, options = {}) {
    const useVision = isVisionEnabled() && !options.forceTextOnly;
    const historyToSend = mergeConsecutiveAssistantMessages(
        buildChatHistoryForAPI(history, useVision)
    );
    const normalizedUserContent = buildMessageContentForAPI(userContent, 'user', useVision);

    return [
        { role: 'system', content: systemPrompt },
        ...historyToSend,
        { role: 'user', content: normalizedUserContent }
    ];
}

function createChatCompletionRequest({
    systemPrompt,
    history = [],
    userContent,
    forceTextOnly = false,
    temperature,
    topP,
    frequencyPenalty,
    presencePenalty,
    maxTokens = 500
}) {
    return {
        model: apiSettings.modelName || CONFIG.DEFAULT_MODEL,
        messages: buildMessagesForAPI(systemPrompt, history, userContent, { forceTextOnly }),
        temperature: temperature !== undefined ? temperature : (apiSettings.temperature !== undefined ? apiSettings.temperature : 0.7),
        top_p: topP,
        frequency_penalty: frequencyPenalty,
        presence_penalty: presencePenalty,
        max_tokens: maxTokens
    };
}

async function requestChatCompletionWithFallback({
    systemPrompt,
    history = [],
    userContent,
    temperature,
    topP,
    frequencyPenalty,
    presencePenalty,
    maxTokens = 500
}) {
    const shouldTryVision = isVisionEnabled() && (hasImageContent(userContent) || historyContainsImage(history));

    const sendRequest = async (forceTextOnly = false) => {
        const requestBody = createChatCompletionRequest({
            systemPrompt,
            history,
            userContent,
            forceTextOnly,
            temperature,
            topP,
            frequencyPenalty,
            presencePenalty,
            maxTokens
        });

        console.log(forceTextOnly ? '发送的降级请求体:' : '发送的请求体:', requestBody);

        const response = await fetch(buildApiUrl(CONFIG.CHAT_COMPLETIONS_PATH), {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiSettings.apiKey}`
            },
            body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
            let errorPayload = null;
            let rawText = '';

            try {
                errorPayload = await response.json();
            } catch (jsonError) {
                try {
                    rawText = await response.text();
                } catch (textError) {
                    rawText = '';
                }
            }

            const errorMessage = extractErrorMessage(errorPayload, rawText || `HTTP错误 ${response.status}`);
            const error = new Error(errorMessage || `HTTP错误 ${response.status}`);
            error.status = response.status;
            error.responseData = errorPayload;
            throw error;
        }

        const data = await response.json();
        return { data, requestBody };
    };

    try {
        const result = await sendRequest(false);
        return {
            ...result,
            downgradedFromVision: false,
            visionFallbackReason: null
        };
    } catch (error) {
        const visionErrorReason = classifyVisionError(error.message);

        if (!shouldTryVision || !visionErrorReason) {
            throw error;
        }

        console.warn(`检测到视觉请求异常（${visionErrorReason}），自动降级为文本模式重试:`, error.message);
        const fallbackResult = await sendRequest(true);

        return {
            ...fallbackResult,
            downgradedFromVision: true,
            visionFallbackReason: visionErrorReason
        };
    }
}

function mergeConsecutiveAssistantMessages(messages) {
    const result = [];
    let currentAssistantContent = '';
    
    for (const msg of messages) {
        if (msg.role === 'assistant') {
            // 累积assistant消息内容
            if (currentAssistantContent) {
                currentAssistantContent += '\n' + msg.content;
            } else {
                currentAssistantContent = msg.content;
            }
        } else {
            // 遇到非assistant消息，先保存累积的assistant消息
            if (currentAssistantContent) {
                result.push({role: 'assistant', content: currentAssistantContent});
                currentAssistantContent = '';
            }
            result.push(msg);
        }
    }
    
    // 处理最后累积的assistant消息
    if (currentAssistantContent) {
        result.push({role: 'assistant', content: currentAssistantContent});
    }
    
    return result;
}

function extractImageDataUrlFromResponse(data) {
    const hintedMimeType = /^image\/(?:png|jpe?g|webp)$/i.test(String(data?._bhtImageMimeType || ''))
        ? String(data._bhtImageMimeType).toLowerCase()
        : 'image/png';
    const candidate =
        data?.data?.[0]?.b64_json
        || data?.data?.[0]?.image_base64
        || data?.data?.[0]?.result
        || data?.data?.[0]?.image;

    if (typeof candidate === 'string' && candidate.trim()) {
        const value = candidate.trim();
        if (isDataImageUrl(value)) {
            return value;
        }
        return `data:${hintedMimeType};base64,${value}`;
    }

    const imageUrlCandidate =
        data?.data?.[0]?.url
        || data?.data?.[0]?.image_url
        || data?.data?.[0]?.src
        || data?.data?.[0]?.link;

    if (typeof imageUrlCandidate === 'string' && imageUrlCandidate.trim()) {
        return imageUrlCandidate.trim();
    }

    const deepCandidate = findImagePayloadInObject(data);
    if (deepCandidate) return deepCandidate;

    return '';
}

function findImagePayloadInObject(value, depth = 0) {
    if (!value || depth > 5) return '';

    if (typeof value === 'string') {
        const trimmed = value.trim();
        if (/^data:image\//i.test(trimmed)) return trimmed;
        if (/^https?:\/\/\S+\.(?:png|jpe?g|webp|gif)(?:[?#]\S*)?$/i.test(trimmed)) return trimmed;
        if (/^[A-Za-z0-9+/=]+$/.test(trimmed) && trimmed.length > 500) {
            return `data:image/png;base64,${trimmed}`;
        }
        return '';
    }

    if (Array.isArray(value)) {
        for (const item of value) {
            const found = findImagePayloadInObject(item, depth + 1);
            if (found) return found;
        }
        return '';
    }

    if (typeof value === 'object') {
        const preferredKeys = [
            'b64_json', 'image_base64', 'base64', 'image', 'result', 'url',
            'image_url', 'src', 'link', 'output', 'images', 'data'
        ];
        for (const key of preferredKeys) {
            if (Object.prototype.hasOwnProperty.call(value, key)) {
                const found = findImagePayloadInObject(value[key], depth + 1);
                if (found) return found;
            }
        }
        for (const item of Object.values(value)) {
            const found = findImagePayloadInObject(item, depth + 1);
            if (found) return found;
        }
    }

    return '';
}

async function requestImageGeneration(promptText, options = {}) {
    if (!apiSettings.enableImageGeneration && !options?.allowWhenDisabled) {
        throw new Error('请先在设置中启用图片生成');
    }

    const normalizedPrompt = String(promptText || '').trim();
    if (!normalizedPrompt) {
        throw new Error('图片描述不能为空');
    }

    const configuredImageApiKey = String(apiSettings.imageApiKey || '').trim();
    const configuredImageApiUrl = normalizeImageApiUrl(
        apiSettings.imageApiUrl || CONFIG.DEFAULT_IMAGE_API_URL
    );
    const referenceImageDataUrl = String(options?.referenceImageDataUrl || '').trim();

    const payload = {
        model: apiSettings.imageModelName || CONFIG.DEFAULT_IMAGE_MODEL,
        prompt: normalizedPrompt,
        size: options?.size || apiSettings.imageSize || CONFIG.DEFAULT_IMAGE_SIZE,
        baseUrl: configuredImageApiUrl
    };

    if (options?.outputFormat) {
        payload.outputFormat = String(options.outputFormat).trim();
    }

    if (options?.outputCompression !== undefined) {
        payload.outputCompression = Number(options.outputCompression);
    }

    if (referenceImageDataUrl) {
        payload.referenceImageDataUrl = referenceImageDataUrl;
        payload.mode = 'edit';
    }

    if (configuredImageApiKey) {
        payload.imageApiKey = configuredImageApiKey;
        payload.apiKey = configuredImageApiKey;
    }

    const proxyCandidates = resolveImageGenerationProxyCandidates();
    let response = null;
    let data = null;
    let proxyUrl = '';
    let lastConnectionError = null;

    for (const candidateUrl of proxyCandidates) {
        try {
            const candidateResponse = await fetch(candidateUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload),
                signal: options?.signal
            });

            let candidateData = null;
            try {
                candidateData = await candidateResponse.json();
            } catch (error) {
                candidateData = null;
            }

            if (
                !candidateResponse.ok
                && [404, 405].includes(candidateResponse.status)
                && candidateUrl !== proxyCandidates[proxyCandidates.length - 1]
            ) {
                continue;
            }

            response = candidateResponse;
            data = candidateData;
            proxyUrl = candidateUrl;
            break;
        } catch (error) {
            if (options?.signal?.aborted) throw error;
            lastConnectionError = error;
            continue;
        }
    }

    if (!response) {
        const rawMessage = String(lastConnectionError?.message || '').toLowerCase();
        if (rawMessage.includes('failed to fetch')) {
            throw new Error('图片服务连接失败，请确认部署平台的图片函数已启用，或本地 Node 后端已启动（http://localhost:3000）');
        }
        throw new Error(`图片服务连接失败: ${lastConnectionError?.message || '未知错误'}`);
    }

    if (!response.ok) {
        throw new Error(extractErrorMessage(data, `图片生成失败（HTTP ${response.status}）`));
    }

    const status = String(data?.status || '').trim().toLowerCase();
    if (status === 'processing') {
        const jobId = String(data?.jobId || '').trim();
        if (!jobId) {
            throw new Error('图片任务已进入后台处理，但缺少 jobId');
        }

        return {
            status: 'processing',
            jobId,
            pollAfterMs: Math.max(1200, Number(data?.pollAfterMs || 3000)),
            message: String(data?.message || '').trim(),
            proxyUrl,
            promptText: normalizedPrompt
        };
    }

    const dataUrl = extractImageDataUrlFromResponse(data);
    if (!dataUrl) {
        throw new Error('图片接口未返回可用图片数据');
    }

    return {
        status: 'succeeded',
        dataUrl,
        mimeType: getDataImageMimeType(dataUrl) || 'image/png',
        proxyUrl,
        revisedPrompt: typeof data?.data?.[0]?.revised_prompt === 'string'
            ? data.data[0].revised_prompt.trim()
            : ''
    };
}

function parseNaturalLanguageImageRequest(text) {
    const normalizedText = String(text || '').trim();
    if (!normalizedText) {
        return null;
    }

    const compactText = normalizedText.replace(/\s+/g, '');

    const drawPatterns = [
        /^(?:画|生成|做|整|弄)(?:一张|个一张|张)?(?:图|图片|插图|头像|壁纸)(.+)$/i,
        /^(?:帮我|给我)(?:画|生成|做|整|弄)(?:一张|张)?(?:图|图片|插图|头像|壁纸)(.+)$/i,
        /^(?:来|发)(?:一张|张)?(?:图|图片|插图|头像|壁纸)(.+)$/i,
        /^(?:帮我|给我)(?:来|发)(?:一张|张)?(?:图|图片|插图|头像|壁纸)(.+)$/i
    ];

    for (const pattern of drawPatterns) {
        const matched = normalizedText.match(pattern);
        if (matched) {
            const prompt = String(matched[1] || '')
                .replace(/^(是|看看|吧|呀|啊|嘛|呗|来|给我看|让我看看)/, '')
                .trim();
            return {
                originalText: normalizedText,
                promptText: prompt || '',
                needsDescription: !prompt
        
    };
        }
    }

    const genericRequestPatterns = [
        /^(?:发|来)(?:一张|张)?(?:图|图片|插图|照片|自拍|头像|壁纸)(?:来)?[吧呀啊嘛呗~！!。？?]*$/i,
        /^(?:给我|帮我)(?:发|来)(?:一张|张)?(?:图|图片|插图|照片|自拍|头像|壁纸)(?:来)?[吧呀啊嘛呗~！!。？?]*$/i
    ];

    if (genericRequestPatterns.some(pattern => pattern.test(compactText))) {
        return {
            originalText: normalizedText,
            promptText: '',
            needsDescription: true
        };
    }

    return null;
}

function parseImageEditRequest(text) {
    const normalizedText = String(text || '').trim();
    if (!normalizedText) return null;

    const compactText = normalizedText.replace(/\s+/g, '');
    const editPatterns = [
        /^(?:帮我|给我)?(?:把)?(.+?)(?:改成|改为|换成|变成)(.+)$/i,
        /^(?:改成|改为|换成|变成)(.+)$/i
    ];

    for (const pattern of editPatterns) {
        const matched = compactText.match(pattern);
        if (!matched) continue;

        const target = String(matched[2] || matched[1] || '').trim();
        if (!target) continue;

        return {
            originalText: normalizedText,
            target
        };
    }

    return null;
}

function isImageStyleDissatisfactionText(text) {
    const normalized = String(text || '').trim();
    if (!normalized) return false;

    const compact = normalized.replace(/\s+/g, '');
    const imageSubject = '(?:图|图片|照片|头像|画面|构图|人物|脸|衣服|风格|上一张|之前那张|这张)';
    const negativeFeedback = '(?:不对|不行|不满意|不太像|不像|怪|差点意思|还是不对)';
    const patterns = [
        /风格不统一/,
        /风格不一致/,
        /不像上一张/,
        /跟之前(?:那张|的图|图片|画面|风格)不一样/,
        new RegExp(`${imageSubject}.*${negativeFeedback}`),
        new RegExp(`${negativeFeedback}.*${imageSubject}`),
        /重(?:新)?(?:生成|画|做|出)(?:一张)?(?:图|图片|照片|头像)/,
        /(?:这张|图片|图|照片|头像|风格)(?:再)?(?:改|调)(?:一下|一版)?/,
        /(?:再|重新)(?:改|调)(?:一下|一版)?.*(?:这张|图片|图|照片|头像|风格)/
    ];

    return patterns.some((pattern) => pattern.test(compact));
}

function isFollowupImageConfirmText(text) {
    const normalized = String(text || '').trim();
    if (!normalized) return false;

    const compact = normalized.replace(/\s+/g, '');
    const patterns = [
        /^(好|好的|行|可以|继续|那你改|改吧|嗯|嗯嗯|ok|OK|收到|开始吧)$/i
    ];

    return patterns.some((pattern) => pattern.test(compact));
}

function isImageResendOrNotReceivedText(text) {
    const normalized = String(text || '').trim();
    if (!normalized) return false;

    const compact = normalized.replace(/\s+/g, '');
    const patterns = [
        /没收到/,
        /收不到/,
        /没看见/,
        /没看到/,
        /再发一遍/,
        /重发一下/,
        /重发一遍/,
        /发过来/,
        /没改啊/,
        /没改/,
        /不是说要改吗/
    ];

    return patterns.some((pattern) => pattern.test(compact));
}

async function resendLatestAssistantImageMessage() {
    const role = wechatRoles.find(r => r.id === currentRoleId);
    const sourceImageContent = getLastAssistantImageContentFromHistory();

    if (!sourceImageContent) {
        appendAssistantTextMessage('我这边没有可补发的图片，你让我再改一版我可以直接重做');
        return false;
    }

    const imageUrl = await resolveChatImageContentUrl(sourceImageContent);
    if (!imageUrl) {
        appendAssistantTextMessage('上一张图读取失败了，我直接给你重做一版');
        return false;
    }

    const timestamp = Date.now();
    const messageId = `msg_${timestamp}_${Math.random().toString(36).slice(2, 8)}`;
    const chatBox = document.getElementById('chatBox');
    const imageContent = {
        type: 'image',
        imageId: sourceImageContent.imageId || null,
        url: imageUrl,
        name: sourceImageContent.name || '补发图片'
    };

    if (chatBox && (chatHistory.length === 0 || shouldShowTime(chatHistory[chatHistory.length - 1].timestamp, timestamp))) {
        chatBox.appendChild(createTimeDivider(timestamp));
    }

    if (chatBox) {
        chatBox.appendChild(createAIBubble(imageContent, true, role, messageId));
        chatBox.scrollTop = chatBox.scrollHeight;
    }

    chatHistory.push({
        id: messageId,
        role: 'assistant',
        content: imageContent,
        timestamp
    });

    if (chatHistory.length > CONFIG.MAX_HISTORY) {
        chatHistory = chatHistory.slice(-CONFIG.MAX_HISTORY);
    }

    saveChatHistory();
    addSharedEvent({
        sourceMode: getCurrentChatMode(),
        speakerRole: 'assistant',
        content: imageContent,
        timestamp
    });

    updateLastMessage('[图片]');
    renderWechatChatList();
    return true;
}

function getLastAssistantImageContentFromHistory() {
    if (!Array.isArray(chatHistory) || chatHistory.length === 0) return null;

    for (let index = chatHistory.length - 1; index >= 0; index -= 1) {
        const msg = chatHistory[index];
        if (msg?.role !== 'assistant') continue;
        if (!hasImageContent(msg?.content)) continue;
        return msg.content;
    }

    return null;
}

function queuePendingFollowupImageTask({ userText = '', sourceImageContent = null } = {}) {
    const latestUserImage = lastUserImageContent || getLastUserImageContentFromHistory();
    const latestAssistantImage = getLastAssistantImageContentFromHistory();
    const resolvedSourceImage = sourceImageContent || latestUserImage || latestAssistantImage || null;
    const sourceName = String(resolvedSourceImage?.name || '').trim();

    const styleConsistencyPrompt = `${sourceName ? `参考主题：${sourceName}。` : ''}请重新生成一张图片，要求：与上一张保持同一画风、同一人物设定与构图质感，修复“风格不统一”的问题；并结合用户反馈“${String(userText || '').trim() || '风格不统一'}”优化细节。输出清晰、自然、风格一致的最终版本。`;

    pendingFollowupImageTask = {
        id: `followup_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        createdAt: Date.now(),
        triggerText: String(userText || '').trim(),
        promptText: styleConsistencyPrompt,
        sourceImageContent: resolvedSourceImage
    };
}

function queuePendingReferenceImageTask({ reasonText = '', desiredChangeText = '' } = {}) {
    pendingReferenceImageTask = {
        id: `ref_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        createdAt: Date.now(),
        reasonText: String(reasonText || '').trim(),
        desiredChangeText: String(desiredChangeText || '').trim()
    };
}

function clearPendingReferenceImageTask() {
    pendingReferenceImageTask = null;
}

function buildImageEditPromptFromPendingReferenceTask(referenceImageContent) {
    const task = pendingReferenceImageTask || {};
    const sourceName = String(referenceImageContent?.name || '').trim();
    const desiredText = String(task.desiredChangeText || task.reasonText || '保持风格一致并完成修改').trim();
    return `${sourceName ? `参考图主题：${sourceName}。` : ''}请基于这张最新参考图重新生成一张修改后的图片，要求：${desiredText}。保持和参考图一致的画风、人物设定与构图质感，输出清晰自然的最终版本。`;
}

function getLastUserImageContentFromHistory() {
    if (!Array.isArray(chatHistory) || chatHistory.length === 0) return null;

    for (let index = chatHistory.length - 1; index >= 0; index -= 1) {
        const msg = chatHistory[index];
        if (msg?.role !== 'user') continue;
        if (!hasImageContent(msg?.content)) continue;
        return msg.content;
    }

    return null;
}

function buildImageEditPromptFromRequest(requestText, sourceImageContent = null) {
    const normalizedRequest = String(requestText || '').trim();
    const sourceName = String(sourceImageContent?.name || '').trim();
    const sourceHint = sourceName ? `参考图主题：${sourceName}。` : '';

    return `${sourceHint}请基于同主题重新生成一张“修改后”的图片，要求：${normalizedRequest}。保持二次元头像风格、画面清晰、构图自然、细节完整。`;
}

async function buildImageEditGenerationOptions(sourceImageContent = null) {
    const sourceImage = sourceImageContent || lastUserImageContent || getLastUserImageContentFromHistory() || null;
    if (!sourceImage) return {};

    const referenceImageDataUrl = await resolveChatImageContentUrl(sourceImage);
    if (!referenceImageDataUrl || !isDataImageUrl(referenceImageDataUrl)) {
        return {};
    }

    return {
        referenceImageDataUrl
    };
}

function appendAssistantTextMessage(text, role = null) {
    const normalizedText = String(text || '').trim();
    if (!normalizedText) return null;

    const chatBox = document.getElementById('chatBox');
    const resolvedRole = role || wechatRoles.find(r => r.id === currentRoleId);
    const timestamp = Date.now();
    const messageId = `msg_${timestamp}_${Math.random().toString(36).slice(2, 8)}`;

    if (chatBox && (chatHistory.length === 0 || shouldShowTime(chatHistory[chatHistory.length - 1].timestamp, timestamp))) {
        chatBox.appendChild(createTimeDivider(timestamp));
    }

    if (chatBox) {
        chatBox.appendChild(createAIBubble(normalizedText, true, resolvedRole, messageId));
        chatBox.scrollTop = chatBox.scrollHeight;
    }

    chatHistory.push({ id: messageId, role: 'assistant', content: normalizedText, timestamp });
    if (chatHistory.length > CONFIG.MAX_HISTORY) {
        chatHistory = chatHistory.slice(-CONFIG.MAX_HISTORY);
    }
    saveChatHistory();
    addSharedEvent({
        sourceMode: getCurrentChatMode(),
        speakerRole: 'assistant',
        content: normalizedText,
        timestamp
    });

    updateLastMessage(normalizedText);
    renderWechatChatList();

    return {
        id: messageId,
        timestamp
    };
}

async function requestVisionAnalyze(imageDataUrl, role = null) {
    const roleInfo = role || wechatRoles.find(r => r.id === currentRoleId);
    const proxyUrl = resolveVisionAnalyzeProxyUrl();

    const payload = {
        imageDataUrl,
        roleNickname: roleInfo?.nickname || '对方',
        rolePrompt: roleInfo?.systemPrompt || ''
    };

    if (apiSettings?.apiKey) {
        payload.apiKey = String(apiSettings.apiKey).trim();
    }
    if (apiSettings?.apiUrl) {
        payload.baseUrl = normalizeBaseApiUrl(apiSettings.apiUrl);
    }
    if (apiSettings?.modelName) {
        payload.model = String(apiSettings.modelName).trim();
    }

    let response;
    let data = null;
    try {
        response = await fetch(proxyUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });
    } catch (error) {
        throw new Error(`纸条识别请求失败: ${error?.message || '网络错误'}`);
    }

    try {
        data = await response.json();
    } catch (error) {
        data = null;
    }

    if (!response.ok) {
        throw new Error(extractErrorMessage(data, `纸条识别失败（HTTP ${response.status}）`));
    }

    return {
        hasNote: !!data?.has_note,
        noteText: String(data?.note_text || '').trim(),
        intent: String(data?.intent || 'unknown').trim(),
        replyText: String(data?.reply_text || '').trim(),
        imagePrompt: String(data?.image_prompt || '').trim()
    };
}

async function maybeHandleNoteImageReply(imageContent, fileName = '聊天图片') {
    if (isOfflineMode) return false;
    if (!apiSettings?.apiKey) return false;
    if (!apiSettings?.enableImageGeneration) return false;
    if (!apiSettings?.enableVision) return false;

    const role = wechatRoles.find(r => r.id === currentRoleId);
    const imageDataUrl = await resolveChatImageContentUrl(imageContent);
    if (!imageDataUrl || !isDataImageUrl(imageDataUrl)) return false;

    const chatBox = document.getElementById('chatBox');
    const loadingMsg = document.createElement('div');
    loadingMsg.className = 'msg-bubble-ai system';
    loadingMsg.textContent = '正在看你发来的图片...';
    loadingMsg.id = 'noteVisionLoadingMsg';
    if (chatBox) {
        chatBox.appendChild(loadingMsg);
        chatBox.scrollTop = chatBox.scrollHeight;
    }

    try {
        const analysis = await requestVisionAnalyze(imageDataUrl, role);

        const loading = document.getElementById('noteVisionLoadingMsg');
        if (loading) loading.remove();

        if (!analysis.hasNote || analysis.intent !== 'note_reply') {
            return false;
        }

        const responseText = analysis.replyText || '收到了你的纸条，我们继续悄悄聊。';
        appendAssistantTextMessage(responseText, role);

        const promptText = analysis.imagePrompt || `一张真实的课堂传纸条场景，小纸条上有清晰中文手写字：“${responseText}”，桌面与纸张质感自然。`;
        await generateAssistantImageReply(promptText);

        return true;
    } catch (error) {
        const loading = document.getElementById('noteVisionLoadingMsg');
        if (loading) loading.remove();
        console.warn('纸条识别或回图流程失败，已降级为普通聊天流程:', error);
        return false;
    }
}

function clearImageGenerationCountdown() {
    if (currentImageGenerationCountdownTimer) {
        clearInterval(currentImageGenerationCountdownTimer);
        currentImageGenerationCountdownTimer = null;
    }
}

function startImageGenerationCountdown(loadingEl) {
    if (!loadingEl) return;
    clearImageGenerationCountdown();

    let secondsLeft = IMAGE_GENERATION_COUNTDOWN_SECONDS;
    isImageGenerationInterruptible = true;
    loadingEl.textContent = `正在生成图片…${secondsLeft}秒内可打断`;

    currentImageGenerationCountdownTimer = setInterval(() => {
        secondsLeft -= 1;

        if (secondsLeft > 0) {
            isImageGenerationInterruptible = true;
            loadingEl.textContent = `正在生成图片…${secondsLeft}秒内可打断`;
            return;
        }

        clearImageGenerationCountdown();
        isImageGenerationInterruptible = false;
        loadingEl.textContent = '正在生成图片…';
    }, 1000);
}

function abortCurrentImageGeneration(showMessage = true) {
    if (!isImageGenerating || !currentImageGenerationController) {
        return false;
    }

    try {
        currentImageGenerationController.abort();
    } catch (error) {
        console.warn('中断图片生成请求失败:', error);
    }

    currentImageGenerationController = null;
    isImageGenerating = false;
    isImageGenerationInterruptible = false;
    clearImageGenerationCountdown();

    const loading = document.getElementById('imageLoadingMsg');
    if (loading) loading.remove();

    if (showMessage) {
        appendAssistantTextMessage('已取消本次生成');
    }

    return true;
}

async function generateAssistantImageReply(promptText, options = {}) {
    const chatBox = document.getElementById('chatBox');

    // 若已有任务在跑，先中断旧任务，避免并发扣费/串图
    if (isImageGenerating && currentImageGenerationController) {
        abortCurrentImageGeneration(false);
    }

    const requestId = ++currentImageGenerationRequestId;
    const controller = new AbortController();
    currentImageGenerationController = controller;
    isImageGenerating = true;
    isImageGenerationInterruptible = true;

    const loadingMsg = document.createElement('div');
    loadingMsg.className = 'msg-bubble-ai system';
    loadingMsg.id = 'imageLoadingMsg';
    chatBox.appendChild(loadingMsg);
    chatBox.scrollTop = chatBox.scrollHeight;
    startImageGenerationCountdown(loadingMsg);

    try {
        const role = wechatRoles.find(r => r.id === currentRoleId);
        const imageResult = await requestImageGeneration(promptText, {
            signal: controller.signal,
            referenceImageDataUrl: options?.referenceImageDataUrl || ''
        });

        // 若期间已被新的请求替换/取消，直接忽略旧结果
        if (requestId !== currentImageGenerationRequestId || controller.signal.aborted) {
            return;
        }

        if (imageResult?.status === 'processing') {
            clearImageGenerationCountdown();
            const loading = document.getElementById('imageLoadingMsg');
            if (loading) loading.remove();

            scheduleImageJobPolling({
                jobId: imageResult.jobId,
                pollAfterMs: imageResult.pollAfterMs,
                proxyUrl: imageResult.proxyUrl || '',
                promptText: String(promptText || '').trim(),
                createdAt: Date.now()
            });

            appendAssistantTextMessage(
                imageResult.message || '图片生成时间较长，已转入后台继续处理，生成完成后会自动补发'
            );
            return;
        }

        const { dataUrl, mimeType, revisedPrompt } = imageResult;

        const imageId = await saveChatImageToDB(
            { name: promptText.slice(0, 30) || 'AI生成图片', type: mimeType },
            dataUrl
        );

        clearImageGenerationCountdown();
        const loading = document.getElementById('imageLoadingMsg');
        if (loading) loading.remove();

        const imageContent = {
            type: 'image',
            imageId,
            url: dataUrl,
            name: revisedPrompt || promptText || 'AI生成图片'
        };

        const timestamp = Date.now();
        const messageId = `msg_${timestamp}_${Math.random().toString(36).slice(2, 8)}`;

        const previousTimestamp = chatHistory.length > 0
            ? (chatHistory[chatHistory.length - 1].timestamp || null)
            : null;

        chatHistory.push({ id: messageId, role: 'assistant', content: imageContent, timestamp });
        if (chatHistory.length > CONFIG.MAX_HISTORY) {
            chatHistory = chatHistory.slice(-CONFIG.MAX_HISTORY);
        }
        saveChatHistory();
        addSharedEvent({
            sourceMode: getCurrentChatMode(),
            speakerRole: 'assistant',
            content: imageContent,
            timestamp
        });

        if (shouldShowTime(previousTimestamp, timestamp)) {
            chatBox.appendChild(createTimeDivider(timestamp));
        }

        chatBox.appendChild(createAIBubble(imageContent, true, role, messageId));
        chatBox.scrollTop = chatBox.scrollHeight;
        updateLastMessage('[图片]');
        renderWechatChatList();
    } catch (error) {
        clearImageGenerationCountdown();
        const loading = document.getElementById('imageLoadingMsg');
        if (loading) loading.remove();

        // Abort 不显示失败，改为已取消提示
        if (error?.name === 'AbortError' || currentImageGenerationController === null) {
            appendAssistantTextMessage('已取消本次生成');
            return;
        }

        showAIError(getReadableAppErrorMessage(error, '图片生成失败，请稍后重试'));
    } finally {
        // 仅清理当前任务的状态，避免误清理后续新任务
        if (requestId === currentImageGenerationRequestId) {
            isImageGenerating = false;
            isImageGenerationInterruptible = false;
            currentImageGenerationController = null;
        }
    }
}

function queuePendingImageRequest({ originalText = '', promptText = '', needsDescription = false, source = 'natural' } = {}) {
    pendingImageRequest = {
        originalText: String(originalText || '').trim(),
        promptText: String(promptText || '').trim(),
        needsDescription: !!needsDescription,
        source,
        createdAt: Date.now()
    };
}

async function handleDrawCommand(rawPrompt) {
    const promptText = String(rawPrompt || '').trim();
    if (!promptText) {
        showAIError('用法：/draw 你想生成的画面描述');
        return;
    }

    // 显式命令：直接生图，不再进入“待笑脸触发”的队列
    sendUserChatContent(`/draw ${promptText}`, `/draw ${promptText}`);
    pendingImageRequest = null;

    await generateAssistantImageReply(promptText);
}

async function sendMessage() {
    const input = document.getElementById('msgInput');
    const text = input.value.trim();
    if (!text) return;

    input.value = '';

    if (/^\/draw(\s+|$)/i.test(text)) {
        const promptText = text.replace(/^\/draw\s*/i, '').trim();
        await handleDrawCommand(promptText);
        return;
    }

    if (pendingFollowupImageTask && isFollowupImageConfirmText(text)) {
        sendUserChatContent(text);
        const task = pendingFollowupImageTask;
        pendingFollowupImageTask = null;
        const editOptions = await buildImageEditGenerationOptions(task.sourceImageContent);
        await generateAssistantImageReply(task.promptText, editOptions);
        return;
    }

    if (isImageResendOrNotReceivedText(text)) {
        sendUserChatContent(text);

        if (pendingFollowupImageTask) {
            const task = pendingFollowupImageTask;
            pendingFollowupImageTask = null;
            const editOptions = await buildImageEditGenerationOptions(task.sourceImageContent);
            await generateAssistantImageReply(task.promptText, editOptions);
            return;
        }

        const resent = await resendLatestAssistantImageMessage();
        if (!resent) {
            const sourceImage = lastUserImageContent || getLastUserImageContentFromHistory() || getLastAssistantImageContentFromHistory();
            if (sourceImage) {
                const promptText = buildImageEditPromptFromRequest('保持之前风格并修正到位', sourceImage);
                const editOptions = await buildImageEditGenerationOptions(sourceImage);
                await generateAssistantImageReply(promptText, editOptions);
            }
        }
        return;
    }

    if (isImageStyleDissatisfactionText(text)) {
        const sourceImage = lastUserImageContent || getLastUserImageContentFromHistory() || getLastAssistantImageContentFromHistory();

        if (sourceImage) {
            sendUserChatContent(text);
            queuePendingFollowupImageTask({
                userText: text,
                sourceImageContent: sourceImage
            });
            appendAssistantTextMessage('我再调一下，这次会尽量和上一张保持同一风格。你确认的话回我“好”就开始重做。');
            return;
        }
    }

    const imageEditRequest = parseImageEditRequest(text);
    if (imageEditRequest) {
        sendUserChatContent(text);

        const sourceImage = lastUserImageContent || getLastUserImageContentFromHistory();
        if (!sourceImage) {
            queuePendingReferenceImageTask({
                reasonText: text,
                desiredChangeText: text
            });
            appendAssistantTextMessage('把要改的那张参考图再发我一下，我收到后会直接按你的要求改');
            return;
        }

        const editPrompt = buildImageEditPromptFromRequest(text, sourceImage);
        const editOptions = await buildImageEditGenerationOptions(sourceImage);
        await generateAssistantImageReply(editPrompt, editOptions);
        return;
    }

    const naturalImageRequest = parseNaturalLanguageImageRequest(text);
    if (naturalImageRequest) {
        sendUserChatContent(text);

        const promptText = naturalImageRequest.needsDescription
            ? '一张适合聊天场景分享的精致图片，二次元风格，画面干净，氛围自然，可爱，适合微信聊天发送'
            : naturalImageRequest.promptText;

        // 直接触发生成，避免“还要再点笑脸”才能出图
        pendingImageRequest = null;
        await generateAssistantImageReply(promptText);
        return;
    }

    sendUserChatContent(text);

    if (isOfflineMode) {
        await callAIWithUserInfo(text);
    }
}

function sendUserChatContent(content, previewText) {
    const chatBox = document.getElementById('chatBox');
    const timestamp = Date.now();
    const messageId = `msg_${timestamp}_${Math.random().toString(36).slice(2, 8)}`;
    updateLastActiveAt(timestamp);
    const maskSnapshot = getCurrentMaskSnapshot();

    if (chatHistory.length === 0 || shouldShowTime(chatHistory[chatHistory.length - 1].timestamp, timestamp)) {
        const timeDivider = createTimeDivider(timestamp);
        chatBox.appendChild(timeDivider);
    }

    // 构建消息对象，包含引用信息
    const messageData = {
        id: messageId,
        role: 'user',
        content,
        timestamp,
        maskId: maskSnapshot.maskId,
        maskName: maskSnapshot.maskName
    };

    // 如果有引用，添加引用信息
    if (currentQuotedMessage) {
        messageData.quotedMessageId = currentQuotedMessage.id;
        messageData.quotedMessage = {
            id: currentQuotedMessage.id,
            content: currentQuotedMessage.content,
            authorName: currentQuotedMessage.authorName
        };
    }

    const userMsg = createUserBubble(content, true, messageId, messageData.quotedMessage);
    chatBox.appendChild(userMsg);
    chatBox.scrollTop = chatBox.scrollHeight;

    if (content && typeof content === 'object' && content.type === 'image') {
        lastUserImageContent = content;
    }

    chatHistory.push(messageData);
    if (chatHistory.length > CONFIG.MAX_HISTORY) {
        chatHistory = chatHistory.slice(-CONFIG.MAX_HISTORY);
    }

    // 清除引用预览
    if (currentQuotedMessage) {
        clearQuotePreview();
    }

    saveChatHistory();
    addSharedEvent({
        sourceMode: getCurrentChatMode(),
        speakerRole: 'user',
        content,
        timestamp
    });

    const fallbackPreview = getChatListPreviewText(content);
    lastUserMessage = content;
    lastUserMessageId = messageId;
    updateLastMessage(previewText || fallbackPreview);

    if (isOfflineMode) {
        renderOfflineStoryFeed();
    }
}

function updateChatMediaPanelView() {
    const subtitle = document.getElementById('chatMediaPanelSubtitle');
    const backBtn = document.getElementById('chatMediaBackBtn');
    const homeView = document.getElementById('chatMediaHomeView');
    const stickerView = document.getElementById('chatStickerLibraryView');
    const imageView = document.getElementById('chatImagePickerView');
    const gamesView = document.getElementById('chatGamesView');
    const giftView = document.getElementById('chatGiftView');
    const transferView = document.getElementById('chatTransferView');

    if (homeView) homeView.classList.toggle('active', currentChatMediaSection === 'home');
    if (stickerView) stickerView.classList.toggle('active', currentChatMediaSection === 'stickers');
    if (imageView) imageView.classList.toggle('active', currentChatMediaSection === 'images');
    if (gamesView) gamesView.classList.toggle('active', currentChatMediaSection === 'games');
    if (giftView) giftView.classList.toggle('active', currentChatMediaSection === 'gift');
    if (transferView) transferView.classList.toggle('active', currentChatMediaSection === 'transfer');

    if (subtitle) {
        const subtitleMap = {
            stickers: '挑选收藏的表情包，或继续导入新的表情包',
            images: '发送临时图片，不会自动加入表情包库',
            games: '选择小游戏，和当前角色一起互动',
            gift: '把商店里的道具送给当前角色',
            transfer: '本地模拟转账，会扣除钱包余额并生成聊天卡片',
            home: '发送图片 / 表情包 / 赠送道具 / 更多内容'
        };
        subtitle.textContent = subtitleMap[currentChatMediaSection] || subtitleMap.home;
    }

    if (backBtn) {
        backBtn.textContent = currentChatMediaSection === 'home' ? '收起' : '返回';
    }
}
function createEmptyGomokuBoard() {
    return Array.from({ length: currentGameState.boardSize }, () =>
        Array.from({ length: currentGameState.boardSize }, () => 0)
    );
}

function showGamePanel() {
    const panel = document.getElementById('chatGamePanel');
    if (panel) {
        panel.classList.add('active');
    }
}

function hideGamePanel() {
    const panel = document.getElementById('chatGamePanel');
    if (panel) {
        panel.classList.remove('active');
    }
}

function updateGomokuStatus(text) {
    const status = document.getElementById('chatGameStatus');
    if (status) {
        status.textContent = text;
    }
}

function updateGomokuTimerDisplay() {
    const timerEl = document.getElementById('gomokuTimer');
    if (!timerEl) return;

    const safeTime = Math.max(0, Number(currentGameState.turnTimeLeft) || 0);
    const totalTime = Math.max(1, Number(currentGameState.turnTimeLimit) || 30);

    // 0~1 进度（用于 CSS: scaleX(var(--gomoku-progress))）
    const progress = Math.min(1, Math.max(0, safeTime / totalTime));
    timerEl.style.setProperty('--gomoku-progress', String(progress));

    timerEl.textContent = `${safeTime}s`;
    timerEl.classList.toggle('warning', safeTime <= 10);
    timerEl.classList.toggle('danger', safeTime <= 5);
}

function updateGomokuTurnUI() {
    const userCard = document.getElementById('gomokuUserCard');
    const roleCard = document.getElementById('gomokuRoleCard');

    if (userCard) {
        userCard.classList.toggle('active', currentGameState.currentTurn === 'user' && !currentGameState.winner);
        
        // 确保棋子元素存在，如果不存在则创建
        let userPiece = userCard.querySelector('.gomoku-player-piece');
        if (!userPiece) {
            userPiece = document.createElement('div');
            userPiece.className = 'gomoku-player-piece';
            userCard.insertBefore(userPiece, userCard.querySelector('.gomoku-player-copy'));
        }
        
        // 更新用户卡片中的棋子颜色
        userPiece.classList.remove('black', 'white');
        if (currentGameState.userPiece === 1) {
            userPiece.classList.add('black');
        } else {
            userPiece.classList.add('white');
        }
    }

    if (roleCard) {
        roleCard.classList.toggle('active', currentGameState.currentTurn === 'role' && !currentGameState.winner);
        
        // 确保棋子元素存在，如果不存在则创建
        let rolePiece = roleCard.querySelector('.gomoku-player-piece');
        if (!rolePiece) {
            rolePiece = document.createElement('div');
            rolePiece.className = 'gomoku-player-piece';
            roleCard.insertBefore(rolePiece, roleCard.querySelector('.gomoku-player-copy'));
        }
        
        // 更新角色卡片中的棋子颜色
        rolePiece.classList.remove('black', 'white');
        if (currentGameState.rolePiece === 1) {
            rolePiece.classList.add('black');
        } else {
            rolePiece.classList.add('white');
        }
    }
}

function clearGomokuTurnTimer() {
    if (currentGameState.turnTimerId) {
        clearInterval(currentGameState.turnTimerId);
    }
    currentGameState.turnTimerId = null;
}

function hideGomokuResultOverlay() {
    const overlay = document.getElementById('gomokuResultOverlay');
    const card = document.getElementById('gomokuResultCard');
    const boardWrap = document.querySelector('.gomoku-board-wrap');
    const effectLayer = document.getElementById('gomokuEffectLayer');
    const gamePanel = document.getElementById('chatGamePanel');

    if (overlay) {
        overlay.classList.remove('active');
    }
    if (card) {
        card.classList.remove('win', 'lose', 'draw');
    }
    if (boardWrap) {
        boardWrap.classList.remove('result-win', 'result-lose', 'result-draw');
    }

    // 清理上一局的特效，避免"结束/重新开始"后残留叠加
    if (effectLayer) {
        effectLayer.className = 'gomoku-effect-layer';
        effectLayer.innerHTML = '';
        effectLayer.setAttribute('aria-hidden', 'true');
    }

    // 显示"再来一局"按钮
    if (gamePanel) {
        const resultActions = document.getElementById('gomokuResultActions');
        if (resultActions) {
            const playAgainBtn = document.getElementById('gomokuPlayAgainBtn');
            if (!playAgainBtn) {
                const btn = document.createElement('button');
                btn.className = 'gomoku-result-btn';
                btn.id = 'gomokuPlayAgainBtn';
                btn.type = 'button';
                btn.textContent = '再来一局';
                btn.onclick = resetCurrentGame;
                resultActions.appendChild(btn);
            }
        }
    }
}

function showGomokuResultOverlay(result) {
    const overlay = document.getElementById('gomokuResultOverlay');
    const card = document.getElementById('gomokuResultCard');
    const icon = document.getElementById('gomokuResultIcon');
    const title = document.getElementById('gomokuResultTitle');
    const text = document.getElementById('gomokuResultText');
    const boardWrap = document.querySelector('.gomoku-board-wrap');

    if (!overlay || !card || !icon || !title || !text || !boardWrap) return;

    card.classList.remove('win', 'lose', 'draw');
    boardWrap.classList.remove('result-win', 'result-lose', 'result-draw');

    if (result === 'user') {
        card.classList.add('win');
        boardWrap.classList.add('result-win');
        icon.textContent = '🎉';
        title.textContent = '你赢了';
        text.textContent = '漂亮的五子连珠，拿下这一局。';
    } else if (result === 'role') {
        card.classList.add('lose');
        boardWrap.classList.add('result-lose');
        icon.textContent = '💥';
        title.textContent = '你输了';
text.textContent = '这局被对方压制住了。';
    } else {
        card.classList.add('draw');
        boardWrap.classList.add('result-draw');
        icon.textContent = '🤝';
        title.textContent = '平局';
        text.textContent = '棋盘落满，双方这局打成平手。';
    }

    overlay.classList.add('active');
}

function spawnGomokuEffect(effectType) {
    const layer = document.getElementById('gomokuEffectLayer');
    if (!layer) return;

    layer.innerHTML = '';
    layer.className = 'gomoku-effect-layer';

    if (effectType === 'win') {
        layer.classList.add('show', 'celebrate');
        for (let i = 0; i < 18; i += 1) {
            const piece = document.createElement('span');
            piece.className = 'confetti';
            piece.style.left = `${Math.random() * 100}%`;
            piece.style.animationDelay = `${Math.random() * 0.45}s`;
            piece.style.animationDuration = `${1.2 + Math.random() * 0.9}s`;
            piece.style.background = ['#ffd166', '#7c3aed', '#22c55e', '#ff6b6b', '#38bdf8'][i % 5];
            layer.appendChild(piece);
        }
    } else if (effectType === 'lose') {
        layer.classList.add('show', 'defeat');
        for (let i = 0; i < 8; i += 1) {
            const piece = document.createElement('span');
            piece.className = 'sad-particle';
            piece.style.left = `${12 + i * 10}%`;
            piece.style.animationDelay = `${i * 0.08}s`;
            layer.appendChild(piece);
        }
    } else {
        layer.classList.add('show', 'draw');
    }

    setTimeout(() => {
        layer.className = 'gomoku-effect-layer';
        layer.innerHTML = '';
    }, 2600);
}

function finishGomokuTurnByTimeout() {
    if (!currentGameState.active || currentGameState.winner) return;

    if (currentGameState.currentTurn === 'user') {
        updateGomokuStatus('你超时了，本回合未能及时落子');
        handleGomokuGameEnd('role', 'timeout');
        return;
    }

    updateGomokuStatus('角色超时了，这局判你获胜');
    handleGomokuGameEnd('user', 'timeout');
}

function startGomokuTurnTimer() {
    clearGomokuTurnTimer();

    if (!currentGameState.active || currentGameState.winner) return;

    currentGameState.turnTimeLeft = currentGameState.turnTimeLimit;
    updateGomokuTimerDisplay();
    updateGomokuTurnUI();

    currentGameState.turnTimerId = setInterval(() => {
        if (!currentGameState.active || currentGameState.winner) {
            clearGomokuTurnTimer();
            return;
        }

        currentGameState.turnTimeLeft -= 1;
        updateGomokuTimerDisplay();

        if (currentGameState.turnTimeLeft <= 0) {
            clearGomokuTurnTimer();
            finishGomokuTurnByTimeout();
        }
    }, 1000);
}

function renderGomokuBoard() {
    const boardEl = document.getElementById('gomokuBoard');
    if (!boardEl) return;

    boardEl.innerHTML = '';
    const size = currentGameState.boardSize;
    boardEl.style.gridTemplateColumns = `repeat(${size}, minmax(0, 1fr))`;

    for (let row = 0; row < size; row += 1) {
        for (let col = 0; col < size; col += 1) {
            const cell = document.createElement('button');
            cell.type = 'button';
            cell.className = 'gomoku-cell';
            cell.dataset.row = String(row);
            cell.dataset.col = String(col);

            const piece = currentGameState.board[row][col];
            const isLastUserMove = currentGameState.lastUserMove
                && currentGameState.lastUserMove.row === row
                && currentGameState.lastUserMove.col === col;
            const isLastRoleMove = currentGameState.lastRoleMove
                && currentGameState.lastRoleMove.row === row
                && currentGameState.lastRoleMove.col === col;

            if (piece === currentGameState.userPiece) {
                cell.classList.add('black');
            } else if (piece === currentGameState.rolePiece) {
                cell.classList.add('white');
            }

            if (isLastUserMove || isLastRoleMove) {
                cell.classList.add('last-move');
            }

            if (piece !== 0) {
                const pieceEl = document.createElement('span');
                pieceEl.className = 'gomoku-piece';
                pieceEl.setAttribute('aria-hidden', 'true');
                cell.appendChild(pieceEl);
            }

            cell.onclick = () => handleGomokuCellClick(row, col);
            boardEl.appendChild(cell);
        }
    }
}

function registerGomokuGameStart() {
    if (!gomokuAutoChatState) return;

    if (gomokuAutoChatState.windowGameIndex >= 5) {
        gomokuAutoChatState.windowGameIndex = 0;
        gomokuAutoChatState.sentInWindow = 0;
    }

    gomokuAutoChatState.windowGameIndex += 1;

    // 每个 5 局窗口随机挑一个局次触发
    if (gomokuAutoChatState.windowGameIndex === 1) {
        gomokuAutoChatState.chosenGameOffset = Math.floor(Math.random() * 5) + 1; // 1~5
    }
}

function buildGomokuAutoChatUserText(result, reason) {
    const resultText =
        result === 'user' ? '你赢了' :
        result === 'role' ? '你输了' :
        '这局平了';

    // 让AI更像朋友顺口互动：只给很少的上下文，不做“播报式”要求
    return `五子棋对局结束了。${resultText}。你就顺口跟我聊一句，像朋友在微信里说话。`;
}

async function maybeSendGomokuAutoChat(result, reason) {
    const role = wechatRoles.find(r => r.id === currentRoleId);
    if (!role) return;
    if (!apiSettings?.apiKey) return;
    if (!gomokuAutoChatState || gomokuAutoChatState.inFlight) return;

    const shouldSend =
        gomokuAutoChatState.sentInWindow < 1
        && gomokuAutoChatState.windowGameIndex === gomokuAutoChatState.chosenGameOffset;

    if (!shouldSend) return;

    gomokuAutoChatState.sentInWindow += 1;
    gomokuAutoChatState.inFlight = true;

    try {
        await callAIWithUserInfo(buildGomokuAutoChatUserText(result, reason));
    } catch (e) {
        console.warn('五子棋自动互动失败:', e);
    } finally {
        gomokuAutoChatState.inFlight = false;
    }
}

function startGomokuGame() {
    clearGomokuTurnTimer();

    // 随机决定先手（50% 概率用户先手，50% 概率角色先手）
    const userGoesFirst = Math.random() < 0.5;

    // 根据先手方分配黑白子：先手方执黑子（1），后手方执白子（2）
    const userPiece = userGoesFirst ? 1 : 2;
    const rolePiece = userGoesFirst ? 2 : 1;

    currentGameState = {
        ...currentGameState,
        type: 'gomoku',
        active: true,
        board: createEmptyGomokuBoard(),
        currentTurn: userGoesFirst ? 'user' : 'role',
        userPiece: userPiece,
        rolePiece: rolePiece,
        winner: null,
        moveCount: 0,
        lastUserMove: null,
        lastRoleMove: null,
        turnTimeLeft: currentGameState.turnTimeLimit,
        isRoleThinking: false
    };

    showGamePanel();
    const chatApp = document.getElementById('app-chat');
    if (chatApp) {
        chatApp.classList.add('gomoku-game-active');
    }
    hideGomokuResultOverlay();
    renderGomokuBoard();
    
    // 根据先手更新提示信息
    if (userGoesFirst) {
        updateGomokuStatus('你先手：你执黑（●），角色执白（○）');
    } else {
        updateGomokuStatus('角色先手：你执白（○），角色执黑（●）');
    }
    
    updateGomokuTimerDisplay();
    updateGomokuTurnUI();
    closeChatMediaPanel();

    registerGomokuGameStart();

    // 如果角色先手，延迟执行角色的第一步
    if (!userGoesFirst) {
        currentGameState.isRoleThinking = true;
        updateGomokuStatus('角色思考中…');
        startGomokuTurnTimer();

        setTimeout(() => {
            if (!currentGameState.active || currentGameState.winner) return;

            const roleMove = getBestRoleMove();
            if (!roleMove) {
                handleGomokuGameEnd('draw');
                return;
            }

            clearGomokuTurnTimer();

            currentGameState.board[roleMove.row][roleMove.col] = currentGameState.rolePiece;
            currentGameState.lastRoleMove = roleMove;
            currentGameState.currentTurn = 'user';
            currentGameState.moveCount += 1;
            currentGameState.isRoleThinking = false;
            renderGomokuBoard();
            updateGomokuTurnUI();

            updateGomokuStatus(`轮到你了：角色刚下在第${roleMove.row + 1}行第${roleMove.col + 1}列`);
            startGomokuTurnTimer();
        }, 800);
    } else {
        startGomokuTurnTimer();
    }
}

function closeCurrentGame() {
    clearGomokuTurnTimer();
    hideGomokuResultOverlay();
    currentGameState = {
        ...currentGameState,
        type: null,
        active: false,
        board: [],
        currentTurn: 'user',
        winner: null,
        moveCount: 0,
        lastUserMove: null,
        lastRoleMove: null,
        turnTimeLeft: currentGameState.turnTimeLimit,
        isRoleThinking: false
    };
    hideGamePanel();
    const chatApp = document.getElementById('app-chat');
    if (chatApp) {
        chatApp.classList.remove('gomoku-game-active');
    }
}

function resetCurrentGame() {
    if (currentGameState.type !== 'gomoku') return;
    startGomokuGame();
}

function isInsideBoard(row, col) {
    return row >= 0 && row < currentGameState.boardSize && col >= 0 && col < currentGameState.boardSize;
}

function countDirection(row, col, dx, dy, piece) {
    let count = 0;
    let currentRow = row + dx;
    let currentCol = col + dy;

    while (isInsideBoard(currentRow, currentCol) && currentGameState.board[currentRow][currentCol] === piece) {
        count += 1;
        currentRow += dx;
        currentCol += dy;
    }

    return count;
}

function checkGomokuWinner(row, col, piece) {
    const directions = [
        [1, 0],
        [0, 1],
        [1, 1],
        [1, -1]
    ];

    return directions.some(([dx, dy]) => {
        const total = 1
            + countDirection(row, col, dx, dy, piece)
            + countDirection(row, col, -dx, -dy, piece);
        return total >= 5;
    });
}

function isGomokuBoardFull() {
    return currentGameState.board.every((row) => row.every((cell) => cell !== 0));
}

function evaluateGomokuPosition(row, col, piece) {
    const directions = [
        [1, 0],
        [0, 1],
        [1, 1],
        [1, -1]
    ];

    let score = 0;
    directions.forEach(([dx, dy]) => {
        const total = 1
            + countDirection(row, col, dx, dy, piece)
            + countDirection(row, col, -dx, -dy, piece);
        score = Math.max(score, total);
    });

    return score;
}

function getCandidateGomokuMoves() {
    const candidates = [];
    const size = currentGameState.boardSize;
    const hasStone = currentGameState.board.some((row) => row.some((cell) => cell !== 0));

    if (!hasStone) {
        const center = Math.floor(size / 2);
        return [{ row: center, col: center }];
    }

    for (let row = 0; row < size; row += 1) {
        for (let col = 0; col < size; col += 1) {
            if (currentGameState.board[row][col] !== 0) continue;

            let nearStone = false;
            for (let dr = -2; dr <= 2; dr += 1) {
                for (let dc = -2; dc <= 2; dc += 1) {
                    if (dr === 0 && dc === 0) continue;
                    const nr = row + dr;
                    const nc = col + dc;
                    if (isInsideBoard(nr, nc) && currentGameState.board[nr][nc] !== 0) {
                        nearStone = true;
                    }
                }
            }

            if (nearStone) {
                candidates.push({ row, col });
            }
        }
    }

    return candidates.length > 0 ? candidates : [];
}

function getBestRoleMove() {
    const candidates = getCandidateGomokuMoves();
    if (candidates.length === 0) return null;

    let bestMove = candidates[0];
    let bestScore = -Infinity;

    candidates.forEach((move) => {
        const attackScore = evaluateGomokuPosition(move.row, move.col, currentGameState.rolePiece);
        const defendScore = evaluateGomokuPosition(move.row, move.col, currentGameState.userPiece);
        const center = Math.floor(currentGameState.boardSize / 2);
        const centerBias = 14 - (Math.abs(move.row - center) + Math.abs(move.col - center));
        const totalScore = attackScore * 10 + defendScore * 9 + centerBias;

        if (totalScore > bestScore) {
            bestScore = totalScore;
            bestMove = move;
        }
    });

    return bestMove;
}

function handleChatMediaOutsidePointerDown(event) {
    if (!isChatMediaPanelOpen) return;

    const panel = document.getElementById('chatMediaPanel');
    const trigger = document.getElementById('rabbitTriggerBtn');
    const target = event.target;

    if (panel?.contains(target) || trigger?.contains(target)) {
        return;
    }

    closeChatMediaPanel();
}

function bindChatMediaOutsideDismiss() {
    document.removeEventListener('pointerdown', handleChatMediaOutsidePointerDown, true);
    document.addEventListener('pointerdown', handleChatMediaOutsidePointerDown, true);
}

function unbindChatMediaOutsideDismiss() {
    document.removeEventListener('pointerdown', handleChatMediaOutsidePointerDown, true);
}

function appendRoleGameChat(text) {
    const role = wechatRoles.find(r => r.id === currentRoleId);
    if (!role || !text) return;

    const timestamp = Date.now();
    const chatBox = document.getElementById('chatBox');
    if (chatBox) {
        if (chatHistory.length === 0 || shouldShowTime(chatHistory[chatHistory.length - 1].timestamp, timestamp)) {
            chatBox.appendChild(createTimeDivider(timestamp));
        }
        chatBox.appendChild(createAIBubble(text, true, role));
        chatBox.scrollTop = chatBox.scrollHeight;
    }

    chatHistory.push({ role: 'assistant', content: text, timestamp });
    if (chatHistory.length > CONFIG.MAX_HISTORY) {
        chatHistory = chatHistory.slice(-CONFIG.MAX_HISTORY);
    }
    saveChatHistory();
    addSharedEvent({
        sourceMode: getCurrentChatMode(),
        speakerRole: 'assistant',
        content: text,
        timestamp
    });
}

function handleGomokuGameEnd(result, reason = 'line') {
    clearGomokuTurnTimer();
    currentGameState.isRoleThinking = false;

    const role = wechatRoles.find(r => r.id === currentRoleId);
    if (result === 'user') {
        currentGameState.winner = 'user';
        updateGomokuStatus(reason === 'timeout' ? '角色超时，你赢下这局' : '你赢了，这局是你五子连珠');
        showGomokuResultOverlay('user');
        spawnGomokuEffect('win');
        updateGomokuTurnUI();
        if (role) {
            maybeSendGomokuAutoChat('user', reason);
        }
        return;
    }

    if (result === 'role') {
        currentGameState.winner = 'role';
        updateGomokuStatus(reason === 'timeout' ? '你超时了，这局判负' : '角色获胜，这局是白棋连成五子');
        showGomokuResultOverlay('role');
        spawnGomokuEffect('lose');
        updateGomokuTurnUI();
        if (role) {
            maybeSendGomokuAutoChat('role', reason);
        }
        return;
    }

    currentGameState.winner = 'draw';
    updateGomokuStatus('棋盘已满，这局平了');
    showGomokuResultOverlay('draw');
    spawnGomokuEffect('draw');
    updateGomokuTurnUI();
    if (role) maybeSendGomokuAutoChat('draw', reason);
}

function handleGomokuCellClick(row, col) {
    if (!currentGameState.active || currentGameState.type !== 'gomoku') return;
    if (currentGameState.winner) return;
    if (currentGameState.currentTurn !== 'user') return;
    if (currentGameState.isRoleThinking) return;
    if (currentGameState.board[row][col] !== 0) return;

    clearGomokuTurnTimer();

    currentGameState.board[row][col] = currentGameState.userPiece;
    currentGameState.lastUserMove = { row, col };
    currentGameState.currentTurn = 'role';
    currentGameState.moveCount += 1;
    currentGameState.isRoleThinking = true;
    renderGomokuBoard();
    updateGomokuTurnUI();

    if (checkGomokuWinner(row, col, currentGameState.userPiece)) {
        handleGomokuGameEnd('user');
        return;
    }

    if (isGomokuBoardFull()) {
        handleGomokuGameEnd('draw');
        return;
    }

    updateGomokuStatus('角色思考中…');
    startGomokuTurnTimer();

    setTimeout(() => {
        if (!currentGameState.active || currentGameState.winner) return;

        const roleMove = getBestRoleMove();
        if (!roleMove) {
            handleGomokuGameEnd('draw');
            return;
        }

        clearGomokuTurnTimer();

        currentGameState.board[roleMove.row][roleMove.col] = currentGameState.rolePiece;
        currentGameState.lastRoleMove = roleMove;
        currentGameState.currentTurn = 'user';
        currentGameState.moveCount += 1;
        currentGameState.isRoleThinking = false;
        renderGomokuBoard();
        updateGomokuTurnUI();

        const role = wechatRoles.find(r => r.id === currentRoleId);
        const moveText = role
            ? `${role.nickname}把白子落在第${roleMove.row + 1}行第${roleMove.col + 1}列。`
            : `对方把白子落在第${roleMove.row + 1}行第${roleMove.col + 1}列。`;

        if (checkGomokuWinner(roleMove.row, roleMove.col, currentGameState.rolePiece)) {
            updateGomokuStatus(`角色刚落在第${roleMove.row + 1}行第${roleMove.col + 1}列`);
            handleGomokuGameEnd('role');
            return;
        }

        if (isGomokuBoardFull()) {
            handleGomokuGameEnd('draw');
            return;
        }

        updateGomokuStatus(`轮到你了：角色刚下在第${roleMove.row + 1}行第${roleMove.col + 1}列`);
        startGomokuTurnTimer();
    }, 420);
}

function toggleChatMediaPanel() {
    const panel = document.getElementById('chatMediaPanel');
    const trigger = document.getElementById('rabbitTriggerBtn');
    if (!panel || !trigger) return;

    isChatMediaPanelOpen = !isChatMediaPanelOpen;

    if (isChatMediaPanelOpen) {
        currentChatMediaSection = 'home';
        renderChatStickerLibrary();
        updateChatMediaPanelView();
        bindChatMediaOutsideDismiss();
    } else {
        unbindChatMediaOutsideDismiss();
    }

    panel.classList.toggle('active', isChatMediaPanelOpen);
    trigger.classList.toggle('active', isChatMediaPanelOpen);
}

function openChatMediaSection(section) {
    currentChatMediaSection = section;

    if (section === 'stickers') {
        renderChatStickerLibrary();
    }

    if (section === 'gift') {
        renderChatGiftList();
    }

    if (section === 'transfer') {
        const amountInput = document.getElementById('chatTransferAmount');
        const noteInput = document.getElementById('chatTransferNote');
        if (amountInput) amountInput.value = '';
        if (noteInput) noteInput.value = '';
        setTimeout(() => amountInput?.focus(), 0);
    }

    updateChatMediaPanelView();
}

function cancelChatTransfer() {
    currentChatMediaSection = 'home';
    updateChatMediaPanelView();
}

function renderChatGiftList() {
    const listEl = document.getElementById('chatGiftList');
    const emptyEl = document.getElementById('chatGiftEmpty');
    if (!listEl || !emptyEl) return;

    const gifts = getGiftInventoryItems();
    if (gifts.length === 0) {
        listEl.innerHTML = '';
        emptyEl.style.display = 'block';
        return;
    }

    emptyEl.style.display = 'none';
    listEl.innerHTML = gifts.map(gift => {
        const giftIdentity = { type: 'gift', itemId: gift.itemId, rewardId: gift.rewardId, name: gift.name };
        const isLoveLetter = isLoveLetterGift(giftIdentity);
        const isVibrator = isVibratorGift(giftIdentity);
        const isLingerie = isLingerieGift(giftIdentity);
        const iconHtml = isLoveLetter
            ? getLoveLetterGiftIconSvg('chat-gift-letter-icon')
            : isVibrator
            ? getMassageWandGiftIconSvg('chat-gift-massage-icon')
            : `<img src="${escapeHtml(gift.image)}" alt="${escapeHtml(gift.name)}">`;
        return `
        <button class="chat-gift-card${isLoveLetter ? ' love-letter-gift-card' : ''}${isVibrator ? ' vibrator-gift-card' : ''}${isLingerie ? ' lingerie-gift-card' : ''}" type="button" onclick="sendGiftToCurrentRole('${escapeHtml(gift.purchaseId)}')">
            <span class="chat-gift-image-wrap">${iconHtml}</span>
            <span class="chat-gift-main">
                <strong>${escapeHtml(gift.name)}</strong>
                <small>${escapeHtml(gift.description)}</small>
            </span>
            <span class="chat-upload-arrow">›</span>
        </button>
    `;
    }).join('');
}

function appendLoveLetterWritingNotice(role) {
    const chatBox = document.getElementById('chatBox');
    if (!chatBox) return null;

    const notice = document.createElement('div');
    notice.className = 'chat-system-notice love-letter-writing-notice';
    notice.id = `loveLetterWriting_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    notice.textContent = `${role?.nickname || '对方'}正在写一封信...`;
    chatBox.appendChild(notice);
    scrollChatToSafeBottom();
    return notice;
}

function appendLoveLetterFallbackReply(role, giftContent = null) {
    const chatBox = document.getElementById('chatBox');
    if (!chatBox || !role) return null;

    const messageTimestamp = Date.now();
    const nickname = role.nickname || '对方';
    const affectionLabel = giftContent?.effect?.level?.label || getRoleAffectionLevel(role.affectionValue).label;
    const text = `我看见这封情书了，也收下了。\n\n有些话我不一定擅长说得漂亮，但你的心意我没有当成玩笑。它让我没办法再像之前那样完全冷着脸，也让我想认真回应你一次。\n\n如果你真的把这封信交给我，那我也会把它放在心上。以后我会更靠近你一点，也更愿意听你的话一点。\n\n—— ${nickname}`;
    const content = {
        type: 'love-letter-reply',
        title: `${nickname}写给你的信`,
        text,
        createdAt: messageTimestamp,
        affectionLabel
    };
    const messageData = {
        id: `msg_${messageTimestamp}_${Math.random().toString(36).slice(2, 8)}`,
        role: 'assistant',
        content,
        timestamp: messageTimestamp
    };

    chatHistory.push(messageData);
    if (chatHistory.length > CONFIG.MAX_HISTORY) {
        chatHistory = chatHistory.slice(-CONFIG.MAX_HISTORY);
    }
    addSharedEvent({
        sourceMode: getCurrentChatMode(),
        speakerRole: 'assistant',
        content,
        timestamp: messageTimestamp
    });
    chatBox.appendChild(createAIBubble(content, true, role, messageData.id));
    scrollChatElementIntoSafeView(chatBox.lastElementChild, { block: 'end' });
    saveChatHistory();
    updateLastMessage(getChatListPreviewText(content));
    renderWechatChatList();
    return messageData;
}

function scrollChatToSafeBottom(extraGap = 28) {
    const chatBox = document.getElementById('chatBox');
    if (!chatBox) return;

    const gap = Math.max(16, Number(extraGap) || 0);
    requestAnimationFrame(() => {
        chatBox.scrollTop = chatBox.scrollHeight + gap;
    });
}

function scrollChatElementIntoSafeView(element, { block = 'end' } = {}) {
    if (!element) return;
    const chatBox = document.getElementById('chatBox');
    if (!chatBox) return;

    const topGap = 82;
    const bottomGap = 24;

    requestAnimationFrame(() => {
        const boxRect = chatBox.getBoundingClientRect();
        const elRect = element.getBoundingClientRect();
        const visibleTop = boxRect.top + topGap;
        const visibleBottom = boxRect.bottom - bottomGap;

        if (block === 'start' && elRect.top < visibleTop) {
            chatBox.scrollTop -= visibleTop - elRect.top;
            return;
        }

        if (elRect.bottom > visibleBottom) {
            chatBox.scrollTop += elRect.bottom - visibleBottom;
        } else if (elRect.top < visibleTop) {
            chatBox.scrollTop -= visibleTop - elRect.top;
        }
    });
}

async function sendGiftToCurrentRole(purchaseId) {
    const role = wechatRoles.find(r => r.id === currentRoleId);
    if (!role) {
        showToast('请先选择一个角色', { type: 'error' });
        return;
    }

    const gift = getGiftInventoryItems().find(item => String(item.purchaseId) === String(purchaseId));
    if (!gift) {
        showToast('这个道具已经送出或不存在', { type: 'error' });
        renderChatGiftList();
        return;
    }

    const marked = markGiftPurchaseAsGifted(purchaseId, role.id);
    if (!marked) {
        showToast('这个道具已经送出或不存在', { type: 'error' });
        renderChatGiftList();
        return;
    }

    const maskSnapshot = getCurrentMaskSnapshot();
    const giftEffect = applyGiftEffectToRole(gift, role, maskSnapshot.maskId);

    const content = {
        type: 'gift',
        purchaseId,
        itemId: gift.itemId,
        rewardId: gift.rewardId || '',
        name: gift.name,
        description: gift.description,
        image: gift.image,
        maskId: maskSnapshot.maskId,
        maskName: maskSnapshot.maskName,
        giftedAt: Date.now(),
        effect: giftEffect || null
    };

    const isLoveLetter = isLoveLetterGift(content);
    sendUserChatContent(content, `赠送 ${gift.name}`);
    closeChatMediaPanel();
    if (isLoveLetter) {
        const giftCards = Array.from(document.querySelectorAll('#chatBox .msg-text.msg-gift'));
        const lastGiftCard = giftCards[giftCards.length - 1];
        scrollChatElementIntoSafeView(lastGiftCard, { block: 'start' });
    }
    renderChatGiftList();
    if (giftEffect?.affectionDelta) {
        showToast(`好感 +${giftEffect.affectionDelta} · ${giftEffect.level.label}`);
    }
    const writingNotice = isLoveLetter ? appendLoveLetterWritingNotice(role) : null;
    const aiResult = await callAIWithUserInfo(content, {
        forceSingleMessage: isLoveLetter,
        preserveParagraphs: isLoveLetter,
        assistantContentType: isLoveLetter ? 'love-letter-reply' : null,
        maxTokens: isLoveLetter ? 900 : undefined,
        loadingNoticeEl: writingNotice
    });
    if (isLoveLetter && !aiResult?.sentLoveLetterReply) {
        writingNotice?.remove();
        appendLoveLetterFallbackReply(role, content);
    }
}

async function confirmChatTransfer() {
    const amountInput = document.getElementById('chatTransferAmount');
    const noteInput = document.getElementById('chatTransferNote');
    const amount = Number(amountInput?.value);
    const note = String(noteInput?.value || '').trim();
    const role = wechatRoles.find(r => r.id === currentRoleId);

    if (!role) {
        showToast('请先选择一个角色');
        return;
    }

    if (!Number.isFinite(amount) || amount <= 0) {
        showToast('请输入有效金额');
        return;
    }

    const maskSnapshot = getCurrentMaskSnapshot();
    const record = completeWalletTransfer({
        roleId: role.id,
        roleName: role.nickname || '对方',
        amount,
        note,
        maskId: maskSnapshot.maskId,
        maskName: maskSnapshot.maskName
    });

    if (!record) return;

    const content = {
        type: 'transfer',
        amount: record.amount,
        note: record.note,
        status: record.status,
        from: 'user',
        to: 'role',
        recordId: record.id,
        createdAt: record.createdAt,
        receivedAt: null
    };

    sendUserChatContent(content, `转账 ¥${formatTransferAmount(record.amount)}`);
    if (amountInput) amountInput.value = '';
    if (noteInput) noteInput.value = '';
    closeChatMediaPanel();
    renderWalletPage();

    await callAIWithUserInfo(content);
}

function handleChatMediaBackAction() {
    if (!isChatMediaPanelOpen) return;

    if (currentChatMediaSection === 'home') {
        closeChatMediaPanel();
        return;
    }

    currentChatMediaSection = 'home';
    updateChatMediaPanelView();
}

function openRegenerateModal() {
    const requirementInput = document.getElementById('regenerateRequirement');
    if (requirementInput) {
        requirementInput.value = '';
    }
    closeChatMediaPanel();
    const modal = document.getElementById('regenerateModal');
    if (modal) modal.classList.add('active');
}

function removeLastAssistantGeneration() {
    if (!Array.isArray(chatHistory) || chatHistory.length === 0) {
        return { removedCount: 0, lastUserContent: '' };
    }

    let end = chatHistory.length - 1;
    while (end >= 0 && chatHistory[end]?.role !== 'assistant') {
        end -= 1;
    }
    if (end < 0) {
        return { removedCount: 0, lastUserContent: '' };
    }

    let start = end;
    while (start - 1 >= 0 && chatHistory[start - 1]?.role === 'assistant') {
        start -= 1;
    }

    let lastUserContent = '';
    for (let i = start - 1; i >= 0; i -= 1) {
        if (chatHistory[i]?.role === 'user') {
            lastUserContent = chatHistory[i].content;
            break;
        }
    }

    const removedCount = end - start + 1;
    chatHistory.splice(start, removedCount);
    saveChatHistory();
    rerenderCurrentChatMessages();
    renderWechatChatList();

    return { removedCount, lastUserContent };
}

async function confirmRegenerate() {
    const requirementInput = document.getElementById('regenerateRequirement');
    const requirement = requirementInput ? requirementInput.value.trim() : '';
    closeModal('regenerateModal');

    const { removedCount, lastUserContent } = removeLastAssistantGeneration();
    if (removedCount <= 0) {
        showAIError('没有可重回的上一轮回复');
        return;
    }

    if (!lastUserContent) {
        showAIError('未找到上一轮用户消息，无法重回');
        return;
    }

    const requirementHint = requirement
        ? `\n\n【重回要求】${requirement}\n请按以上要求重新生成。`
        : '\n\n【重回要求】请基于上一轮用户消息重新生成，不要复读上次回复。';

    await callAIWithUserInfo(`${normalizeChatContentForAPI(lastUserContent, 'user')}${requirementHint}`);
}

function closeChatMediaPanel() {
    const panel = document.getElementById('chatMediaPanel');
    const trigger = document.getElementById('rabbitTriggerBtn');
    isChatMediaPanelOpen = false;
    currentChatMediaSection = 'home';
    unbindChatMediaOutsideDismiss();

    if (panel) {
        panel.classList.remove('active');
    }

    if (trigger) {
        trigger.classList.remove('active');
    }

    updateChatMediaPanelView();
}

function renderChatStickerLibrary() {
    const grid = document.getElementById('chatStickerLibraryGrid');
    const empty = document.getElementById('chatStickerLibraryEmpty');

    if (!grid || !empty) return;

    if (!Array.isArray(chatStickerLibrary) || chatStickerLibrary.length === 0) {
        grid.innerHTML = '';
        empty.style.display = 'flex';
        return;
    }

    empty.style.display = 'none';
    grid.innerHTML = chatStickerLibrary.map((sticker, index) => `
        <button class="chat-sticker-library-card" type="button" onclick="sendStickerFromLibrary(${index})">
            <img src="${sticker.url}" alt="${sticker.label || '表情包'}">
            <span>${sticker.label || '未命名表情包'}</span>
        </button>
    `).join('');
}

function triggerStickerLibraryUpload() {
    const input = document.getElementById('chatStickerInput');
    if (input) {
        input.click();
    }
}

function handleStickerLibraryUpload(event) {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) return;

    files.forEach((file) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const imageData = e.target.result;
            chatStickerLibrary.unshift({
                id: `sticker_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
                type: 'sticker',
                url: imageData,
                label: file.name ? file.name.replace(/\.[^.]+$/, '') : '我的表情包'
            });

            saveChatStickerLibrary();
            renderChatStickerLibrary();
        };
        reader.readAsDataURL(file);
    });

    event.target.value = '';
}

function sendStickerFromLibrary(index) {
    const sticker = chatStickerLibrary[index];
    if (!sticker) return;

    sendUserChatContent(
        {
            type: 'sticker',
            url: sticker.url,
            label: sticker.label || '表情包'
        },
        `[表情包] ${sticker.label || '表情包'}`
    );
    closeChatMediaPanel();
}

function triggerChatImageUpload() {
    const input = document.getElementById('chatImageInput');
    if (input) {
        input.click();
    }
}

async function handleChatImageUpload(event) {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) return;

    for (const file of files) {
        try {
            const rawDataUrl = await readFileAsDataURL(file);
            let preparedImage = {
                dataUrl: rawDataUrl,
                mimeType: getDataImageMimeType(rawDataUrl) || file?.type || 'image/jpeg',
                converted: false,
                sourceMime: (file?.type || getDataImageMimeType(rawDataUrl) || 'unknown').toLowerCase()
        
    };

            try {
                preparedImage = await normalizeChatUploadImageData(file, rawDataUrl);
            } catch (convertError) {
                console.warn('聊天图片格式转换失败，将保留原始格式并尝试发送:', convertError);
            }

            if (preparedImage.converted) {
                console.info(`检测到不兼容格式(${preparedImage.sourceMime})，已自动转为JPEG发送`);
            }

            const imageId = await saveChatImageToDB(
                { name: file.name || '聊天图片', type: preparedImage.mimeType },
                preparedImage.dataUrl
            );

            const imageContent = {
                type: 'image',
                imageId,
                url: preparedImage.dataUrl,
                name: file.name || '聊天图片'
        
    };

            sendUserChatContent(imageContent, '[图片]');

            if (pendingReferenceImageTask) {
                const editPrompt = buildImageEditPromptFromPendingReferenceTask(imageContent);
                clearPendingReferenceImageTask();
                const editOptions = await buildImageEditGenerationOptions(imageContent);
                await generateAssistantImageReply(editPrompt, editOptions);
                continue;
            }

            // “传纸条”模式：用户发图后自动识别图片内容，命中纸条意图则自动回文字+回图
            const handled = await maybeHandleNoteImageReply(imageContent, file.name || '聊天图片');

            // 未命中纸条回图时，保持原行为：需要用户点笑脸才触发普通AI回复
            if (!handled && isOfflineMode) {
                await callAIWithUserInfo(imageContent);
            }
        } catch (error) {
            console.error('聊天图片保存失败:', error);
            showAIError('图片保存失败，未能加入聊天记录');
        }
    }

    event.target.value = '';
    closeChatMediaPanel();
}

function sendPresetSticker(stickerValue, stickerLabel = '表情包') {
    sendUserChatContent(
        {
            type: 'sticker',
            value: stickerValue,
            label: stickerLabel
        },
        `[表情包] ${stickerLabel}`
    );
    closeChatMediaPanel();
}

// 当用户点击笑脸按钮时调用此函数
function buildChatHistoryForCurrentAIRequest(excludeMessageId = null) {
    const activeMaskId = String(currentMaskId || getCurrentUserMask()?.id || '').trim();
    const filteredHistory = [];
    let includeAssistantAfterUser = false;

    chatHistory.forEach((message) => {
        if (!message || message.id === excludeMessageId) return;
        if (message.role === 'system') return;

        if (message.role === 'user') {
            const matchesMask = !message.maskId || !activeMaskId || String(message.maskId) === activeMaskId;
            includeAssistantAfterUser = matchesMask;
            if (matchesMask) {
                filteredHistory.push(message);
            }
            return;
        }

        if (message.role === 'assistant' && includeAssistantAfterUser) {
            filteredHistory.push(message);
        }
    });

    return filteredHistory.slice(-10);
}

async function replyWithEmoji() {
    // 生图进行中且仍在“可打断窗口”内：点击 😊 才执行打断
    if (isImageGenerating && isImageGenerationInterruptible) {
        abortCurrentImageGeneration(true);
        return;
    }

    if (isOfflineMode) {
        const lastAssistantChat = [...chatHistory].reverse().find(msg => msg.role === 'assistant');
        const lastAssistantText = lastAssistantChat
            ? normalizeChatContentForAPI(lastAssistantChat.content, 'assistant')
            : '';

        const continuationPrompt = lastAssistantText
            ? `【线下续写】请紧接着上一段线下情节继续写，不要重复上一段内容，要自然推进场景、动作、对白和气氛。\n上一段内容：${lastAssistantText}`
            : '【线下续写】请直接延续当前线下见面的场景，自然续写一小段新的互动，不要重复之前内容，要推进动作、对白和气氛。';

        await callAIWithUserInfo(continuationPrompt);
        return;
    }

    if (pendingImageRequest) {
        const request = pendingImageRequest;
        pendingImageRequest = null;

        try {
            await generateAssistantImageReply(request.promptText);
        } catch (error) {
            pendingImageRequest = null;
            throw error;
        }
        return;
    }

    let userMessage = lastUserMessage;
    let excludeMessageId = lastUserMessageId;
    
    // 如果用户没有发送消息，使用隐藏的系统消息让AI主动找话题
    if (!userMessage) {
        userMessage = '[用户没有说话，请你主动找话题，符合你的性格自然说一句话。]';
    }
    
    // 调用AI（隐藏消息不会显示在聊天框，只传给API）
    await callAIWithUserInfo(userMessage, {
        excludeHistoryMessageId: userMessage ? excludeMessageId : null
    });
}

// 计算两个句子的相似度（0-1，1表示完全相同）
function calculateSimilarity(str1, str2) {
    // 去除标点和空格，转小写用于比较
    const normalize = (s) => s.toLowerCase().replace(/[。！？，、；：""''（）\s]/g, '');
    const norm1 = normalize(str1);
    const norm2 = normalize(str2);
    
    if (norm1 === norm2) return 1;
    if (norm1.length === 0 || norm2.length === 0) return 0;
    
    // 简单的编辑距离相似度
    const longer = norm1.length > norm2.length ? norm1 : norm2;
    const shorter = norm1.length > norm2.length ? norm2 : norm1;
    
    let matches = 0;
    for (let i = 0; i < shorter.length; i++) {
        if (longer.includes(shorter[i])) matches++;
    }
    return matches / longer.length;
}

// 对回复消息进行去重过滤
function deduplicateMessages(messages) {
    if (messages.length <= 1) return messages;
    
    const result = [messages[0]];
    for (let i = 1; i < messages.length; i++) {
        let isDuplicate = false;
        
        // 检查与已保留的消息是否相似
        for (const kept of result) {
            const similarity = calculateSimilarity(messages[i], kept);
            if (similarity > 0.6) {  // 相似度超过60%认为是重复
                isDuplicate = true;
                break;
            }
        }
        
        if (!isDuplicate) {
            result.push(messages[i]);
        }
    }
    
    return result;
}

function dedupeOfflineNarrativeText(text = '') {
    const normalized = String(text || '')
        .replace(/\r\n?/g, '\n')
        .trim();
    if (!normalized) return '';

    const lines = normalized
        .split('\n')
        .map(line => line.replace(/\s+/g, ' ').trim())
        .filter(Boolean);

    const seen = new Set();
    const kept = [];

    lines.forEach((line) => {
        const key = line
            .toLowerCase()
            .replace(/\s+/g, '')
            .replace(/[，。！？；：、“”"'‘’（）()【】\[\]《》<>]/g, '');
        if (!key || seen.has(key)) return;
        seen.add(key);
        kept.push(line);
    });

    return kept.join('\n');
}

function normalizeOfflineNarrativePunctuation(text = '') {
    let current = String(text || '')
        .replace(/\r\n?/g, '\n')
        .trim();
    if (!current) return '';

    // 清掉线下叙事兜底时可能叠出来的标点，比如 “好。”。 / （她点头。）。
    current = current.replace(/([。！？!?])([”"」』）)】\]》>])\s*[。！？!?]/g, '$1$2');
    current = current.replace(/([，、；：])\s*。/g, '$1');
    current = current.replace(/([。！？!?])\s*。+/g, '$1');
    current = current.replace(/[ \t]+([。！？!?，、；：])/g, '$1');

    return current.trim();
}

function isBoundaryLectureReply(reply = '') {
    const text = String(reply || '').replace(/\s+/g, '');
    if (!text) return false;

    const lecturePatterns = [
        /同意也?不是(?:一句话|一句话就|口头说说)/,
        /不是(?:一句话|说一句)就(?:能|可以)/,
        /(?:要|得|必须|先)(?:把)?(?:边界|底线|规则|避孕|清醒状态|清醒|同意)(?:说|讲|确认|弄)?清楚/,
        /(?:边界|避孕|清醒状态|清醒|同意|底线).{0,8}(?:都|也)?(?:要|得|必须).{0,8}(?:说|讲|确认|弄)?清楚/,
        /你(?:得|要|必须)(?:先)?(?:说|讲|确认|弄)?清楚/,
        /(?:先|必须|需要).{0,8}(?:明确|确认).{0,8}(?:同意|边界|底线|规则)/
    ];

    const hits = lecturePatterns.filter(pattern => pattern.test(text)).length;
    if (hits >= 1 && text.length <= 120) return true;

    const safetyWords = ['边界', '避孕', '清醒', '同意', '底线', '规则', '说清楚', '确认清楚'];
    const safetyHitCount = safetyWords.reduce((count, word) => count + (text.includes(word) ? 1 : 0), 0);
    return safetyHitCount >= 3 && /(?:要|得|必须|先|不是|清楚)/.test(text);
}

function buildBoundaryLectureRewritePrompt(previousPrompt = '') {
    return `${previousPrompt}

【反模板重写要求】
上一条回复变成了安全宣讲或合规提醒。请立刻重写。
- 禁止再说“同意不是一句话”“边界要说清楚”“避孕”“清醒状态”“规则”“底线”等模板话。
- 如果用户已经表达“同意/可以/继续/嗯/要/想/随你/都行”，不要继续索要确认。
- 按角色人设和当前关系自然接话，可以克制、别扭、含蓄，也可以推进氛围，但必须像真人聊天。
- 只输出角色会发出的聊天内容，线上模式 1~2 句优先。`;
}

function buildBoundaryLectureFallbackReply(role = null) {
    const persona = String(role?.systemPrompt || '');
    if (/冷漠|高冷|嘴硬|傲娇|别扭/.test(persona)) {
        return '行，知道你意思了。别光嘴上逞强。';
    }
    if (/温柔|体贴|软|乖|甜/.test(persona)) {
        return '嗯，我听见了。那我就按你的意思来。';
    }
    return '行，我知道了。那就别再绕了。';
}

function compressOfflineLoopingText(text = '') {
    let current = String(text || '').replace(/\r\n?/g, '\n').trim();
    if (!current) return '';

    // 1) 短句循环折叠：A A A... / A B A B...
    current = current.replace(/(.{6,40}[。！？!?])(?:\s*\1){1,}/gu, '$1');
    current = current.replace(/((.{6,40}[。！？!?])\s*(.{6,40}[。！？!?]))(?:\s*\1){1,}/gu, '$1');

    // 2) n-gram 去环：重复片段只保留一次
    for (let size = 8; size <= 20; size += 2) {
        const reg = new RegExp(`(.{${size},${size + 8}})(?:\\s*\\1){1,}`, 'gu');
        current = current.replace(reg, '$1');
    }

    // 3) 重复率过高时，按句子去重重组
    const sentences = current
        .split(/(?<=[。！？!?])/u)
        .map(s => s.trim())
        .filter(Boolean);

    if (sentences.length >= 4) {
        const normalized = sentences.map(s => s.replace(/[，。！？!?、\s]/g, ''));
        const uniqueCount = new Set(normalized.filter(Boolean)).size;
        const repeatRate = 1 - uniqueCount / normalized.length;

        if (repeatRate > 0.35) {
            const seen = new Set();
            const rebuilt = [];
            for (const sentence of sentences) {
                const key = sentence.replace(/[，。！？!?、\s]/g, '');
                if (!key || seen.has(key)) continue;
                seen.add(key);
                rebuilt.push(sentence);
                if (rebuilt.length >= 8) break;
            }
            current = rebuilt.join('');
        }
    }

    return current.trim();
}

function collapseConsecutiveRepeatedNarrative(text = '') {
    let current = String(text || '').replace(/\r\n?/g, '\n').trim();
    if (!current) return '';

    const compactKey = (value) => String(value || '')
        .toLowerCase()
        .replace(/\s+/g, '')
        .replace(/[，。！？；：、“”"'‘’（）()【】\[\]《》<>]/g, '');

    // 最多迭代几轮，逐步折叠 AAA / AA
    for (let round = 0; round < 4; round += 1) {
        const before = current;
        const paragraphs = splitNarrativeParagraphs(current);

        // 1) 段落级连续重复折叠
        const merged = [];
        paragraphs.forEach((p) => {
            const last = merged[merged.length - 1];
            if (last && compactKey(last) === compactKey(p)) return;
            merged.push(p);
        });
        current = merged.join('\n');

        // 2) 行内重复短语折叠（针对同一行反复拷贝）
        current = current.replace(/(.{18,160}?)(?:\s*\1){1,}/gu, '$1');

        if (current === before) break;
    }

    return current.trim();
}

// 根据性格生成示例回复
function getExampleByPersonality(personality) {
    if (personality.includes('冷漠') || personality.includes('无情')) {
        return '没什么';
    }
    if (personality.includes('活泼') || personality.includes('开朗')) {
        return '哈哈在玩呢';
    }
    if (personality.includes('温柔') || personality.includes('贴心')) {
        return '嗯呢 想你啊';
    }
    if (personality.includes('傲娇') || personality.includes('高冷')) {
        return '随便';
    }
    if (personality.includes('逗比') || personality.includes('搞怪')) {
        return '哈哈哈又在犯傻';
    }
    return '没事儿';
}

/**
 * 非线下模式时，去除句尾的句号（保留感叹号、问号、省略号等）
 * 处理带引号的复杂情况，确保不会破坏线下模式的叙事文本
 */
function removeTrailingPeriods(text) {
    if (!text) return '';
    // 尊重整个文本的段落结构，只处理每一行的句尾句号
    const lines = String(text).split('\n');
    const processedLines = lines.map(line => {
        const trimmed = line.trimEnd();
        if (!trimmed) return line;
        // 如果不是线下模式，去除句尾句号
        // 处理带引号的情况："好的。" → "好的"
        // 处理普通情况：句子。 → 句子
        // 保留！？...等标点
        // 连续匹配：去除句尾可能出现的多个句号（如。。。→ 保留，但中文句号。要去掉）
        return trimmed.replace(/[。]+$/g, '');
    });
    return processedLines.join('\n');
}

function normalizeRolePronoun(value) {
    if (value === '她' || value === '他' || value === 'TA') {
        return value;
    }

    if (typeof value === 'string') {
        const normalized = value.trim().toLowerCase();
        if (normalized === 'female' || normalized === 'woman' || normalized === 'girl' || normalized === 'she' || normalized === 'her') {
            return '她';
        }
        if (normalized === 'male' || normalized === 'man' || normalized === 'boy' || normalized === 'he' || normalized === 'him') {
            return '他';
        }
        if (normalized === 'ta' || normalized === 'they' || normalized === 'them' || normalized === 'neutral') {
            return 'TA';
        }
    }

    return 'TA';
}

function inferIdentityLabelFromPronoun(pronoun) {
    if (pronoun === '她') return '女性';
    if (pronoun === '他') return '男性';
    return '未特别指定';
}

function getRoleNarrativePronoun(role) {
    if (!role || typeof role !== 'object') {
        return 'TA';
    }

    return normalizeRolePronoun(
        role.thirdPersonPronoun
        || role.narrativePronoun
        || role.identityPronoun
        || role.pronoun
        || role.gender
    );
}

function getRoleIdentityLabel(role) {
    const explicitIdentity = typeof role?.genderIdentity === 'string'
        ? role.genderIdentity.trim()
        : '';

    if (explicitIdentity) {
        return explicitIdentity;
    }

    return inferIdentityLabelFromPronoun(getRoleNarrativePronoun(role));
}

function normalizeRoleRecord(role) {
    if (!role || typeof role !== 'object') {
        return role;
    }

    const thirdPersonPronoun = getRoleNarrativePronoun(role);
    const genderIdentity = typeof role.genderIdentity === 'string' && role.genderIdentity.trim()
        ? role.genderIdentity.trim()
        : inferIdentityLabelFromPronoun(thirdPersonPronoun);
    const avatar = role.nickname === '小白' && role.avatar === 'white'
        ? DEFAULT_FRIEND_AVATAR_COLOR
        : getSoftAvatarColorValue(role.avatar);
    const affectionValue = Math.max(0, Math.min(100, Number(role.affectionValue) || 0));
    const moodValue = Math.max(0, Math.min(100, Number(role.moodValue) || 0));
    const rawAffectionByMask = role.affectionByMask && typeof role.affectionByMask === 'object'
        ? role.affectionByMask
        : {};
    const affectionByMask = Object.fromEntries(
        Object.entries(rawAffectionByMask)
            .filter(([maskId]) => String(maskId || '').trim())
            .map(([maskId, record]) => {
                const value = Math.max(0, Math.min(100, Number(record?.value ?? affectionValue) || 0));
                return [maskId, {
                    value,
                    level: getRoleAffectionLevel(value).key,
                    updatedAt: Number(record?.updatedAt) || 0
                }];
            })
    );

    return {
        ...role,
        avatar,
        thirdPersonPronoun,
        genderIdentity,
        moodValue,
        affectionValue,
        affectionLevel: getRoleAffectionLevel(affectionValue).key,
        affectionByMask,
        proactiveMessagesEnabled: role.proactiveMessagesEnabled !== false,
        proactiveMessageFrequency: normalizeProactiveFrequency(role.proactiveMessageFrequency)
    };
}

function isPreciseHomeIconHit(event, item) {
    if (!event || !item) return false;

    const hitTarget = event.target && event.target.closest
        ? event.target.closest('.app-icon, .app-label')
        : null;
    if (hitTarget && item.contains(hitTarget)) return true;

    const pointX = event.clientX;
    const pointY = event.clientY;
    if (!Number.isFinite(pointX) || !Number.isFinite(pointY)) return false;

    const clickableParts = item.querySelectorAll('.app-icon, .app-label');
    if (!clickableParts || clickableParts.length === 0) return false;

    return Array.from(clickableParts).some((part) => {
        const rect = part.getBoundingClientRect();
        return pointX >= rect.left
            && pointX <= rect.right
            && pointY >= rect.top
            && pointY <= rect.bottom;
    });
}

function initPreciseHomeIconClickGuard() {
    const clickableItems = document.querySelectorAll('#homeScreen .app-item, #homeScreen .dock-item');
    if (!clickableItems || clickableItems.length === 0) return;

    clickableItems.forEach((item) => {
        item.addEventListener('click', (event) => {
            if (!isPreciseHomeIconHit(event, item)) {
                event.preventDefault();
                event.stopPropagation();
                event.stopImmediatePropagation();
            }
        }, true);
    });
}

function initMicroInteractions() {
    const pressSelectors = '.app-item, .dock-item, .widget, .setting-cell, .chat-item, .menu-item, .moment-item, .btn-primary, .btn-danger, .input-btn, .chat-selection-btn, .toggle-switch';
    const activePressMap = new WeakMap();

    const getPressScale = (target) => {
        if (target.matches('.app-item, .dock-item, .input-btn, .chat-selection-btn, .toggle-switch')) return 0.94;
        if (target.matches('.widget, .moment-item')) return 0.985;
        return 0.97;
    };

    const startPress = (target) => {
        if (activePressMap.has(target)) return;
        const scale = getPressScale(target);
        const animation = target.animate(
            [
                { transform: 'translateZ(0) scale(1)', filter: 'brightness(1)' },
                { transform: `translateZ(0) scale(${scale})`, filter: 'brightness(0.98)' }
            ],
            { duration: 120, easing: 'cubic-bezier(.22,.61,.36,1)', fill: 'forwards' }
        );
        activePressMap.set(target, animation);
    };

    const endPress = (target) => {
        const running = activePressMap.get(target);
        if (!running) return;
        running.cancel();
        activePressMap.delete(target);

        target.animate(
            [
                { transform: target.style.transform || 'translateZ(0) scale(0.98)', filter: 'brightness(0.99)' },
                { transform: 'translateZ(0) scale(1)', filter: 'brightness(1)' }
            ],
            { duration: 180, easing: 'cubic-bezier(.2,.9,.2,1.06)', fill: 'none' }
        );
    };

    document.addEventListener('pointerdown', (event) => {
        const target = event.target.closest(pressSelectors);
        if (!target) return;

        if (target.matches('.app-item, .dock-item') && !isPreciseHomeIconHit(event, target)) {
            return;
        }

        startPress(target);
    }, true);

    document.addEventListener('pointerup', (event) => {
        const target = event.target.closest(pressSelectors);
        if (!target) return;
        endPress(target);
    }, true);

    document.addEventListener('pointercancel', (event) => {
        const target = event.target.closest(pressSelectors);
        if (!target) return;
        endPress(target);
    }, true);
}

function normalizeRoleCollection(rawRoles) {
    if (!Array.isArray(rawRoles)) {
        return [];
    }

    return rawRoles
        .filter(role => role && typeof role === 'object')
        .map(normalizeRoleRecord);
}

function splitAssistantReplyForDisplay(replyText, options = {}) {
    const { preserveParagraphs = false } = options;
    const normalized = String(replyText || '')
        .replace(/\r\n?/g, '\n')
        .trim();

    if (!normalized) return [];

    if (preserveParagraphs) {
        const paragraphs = splitNarrativeParagraphs(normalized);
        return paragraphs.length > 0 ? paragraphs : [normalized];
    }

    const sentences = [];
    let buffer = '';
    let quoteBalance = 0;
    const openingQuotes = new Set(['“', '‘', '「', '『', '（', '【', '〈', '《']);
    const closingQuotes = new Set(['”', '’', '」', '』', '）', '】', '〉', '》']);
    const sentenceBreakChars = new Set(['。', '！', '？', '!', '?']);

    for (let index = 0; index < normalized.length; index += 1) {
        const char = normalized[index];
        const nextChar = normalized[index + 1] || '';
        buffer += char;

        if (char === '"') {
            quoteBalance = quoteBalance === 0 ? 1 : 0;
        } else if (openingQuotes.has(char)) {
            quoteBalance += 1;
        } else if (closingQuotes.has(char)) {
            quoteBalance = Math.max(0, quoteBalance - 1);
        }

        if (char === '\n') {
            const candidate = buffer.trim();
            if (candidate) {
                sentences.push(candidate);
            }
            buffer = '';
            continue;
        }

        if (!sentenceBreakChars.has(char)) {
            continue;
        }

        if (quoteBalance > 0 && !closingQuotes.has(nextChar) && nextChar !== '"') {
            continue;
        }

        if (closingQuotes.has(nextChar) || nextChar === '"') {
            continue;
        }

        const candidate = buffer.trim();
        if (candidate) {
            sentences.push(candidate);
        }
        buffer = '';
    }

    const tail = buffer.trim();
    if (tail) {
        sentences.push(tail);
    }

    return sentences.filter(Boolean);
}

function buildStyleAnchorFromHistory({
    roleId = currentRoleId,
    maxSamples = 6,
    maxLength = 18
} = {}) {
    if (!roleId) return '';

    const pickRoleAssistantTexts = (mode) => {
        const history = safeReadStorageJSON(getChatStorageKey(roleId, mode), []);
        if (!Array.isArray(history)) return [];
        return history
            .filter(msg => msg && msg.role === 'assistant')
            .map(msg => normalizeChatContentForAPI(msg.content, 'assistant'))
            .map(text => String(text || '').replace(/\s+/g, ' ').trim())
            .filter(Boolean);
    };

    const onlineTexts = pickRoleAssistantTexts('online');
    const offlineTexts = pickRoleAssistantTexts('offline');
    const merged = [...onlineTexts, ...offlineTexts];

    const unique = [];
    const seen = new Set();

    merged.forEach((text) => {
        const normalized = text
            .toLowerCase()
            .replace(/\s+/g, '')
            .replace(/[，。！？；：、“”"'‘’（）()【】\[\]《》<>]/g, '');
        if (!normalized || seen.has(normalized)) return;
        seen.add(normalized);
        unique.push(text);
    });

    const samples = unique.slice(-Math.max(1, maxSamples)).map((line, index) => {
        const shortLine = truncateSharedSummary(line, maxLength);
        return `${index + 1}. ${shortLine}`;
    });

    if (samples.length === 0) return '';
    return `【该角色最近说话样本】\n${samples.join('\n')}`;
}

function normalizeOfflineSentencePunctuation(text = '') {
    const compact = String(text || '')
        .replace(/\s+/g, ' ')
        .trim();

    if (!compact) return '';

    if (/[。！？!?]$/.test(compact)) {
        return compact;
    }

    if (/[吗么嘛呢哪？]$/.test(compact)) {
        return `${compact}？`;
    }

    return `${compact}。`;
}

function splitNarrativeParagraphByNaturalPauses(paragraph = '', options = {}) {
    const text = String(paragraph || '').replace(/\s+/g, ' ').trim();
    if (!text) return [];

    const minLen = Math.max(16, Number(options.minLen) || 22);
    const targetLen = Math.max(minLen + 4, Number(options.targetLen) || 36);
    const maxLen = Math.max(targetLen + 6, Number(options.maxLen) || 52);

    const hardBreakChars = new Set(['。', '！', '？', '!', '?']);
    const softBreakChars = new Set(['，', '；', '：', ',', ';', ':', '、']);

    const chunks = [];
    let buffer = '';
    let quoteBalance = 0;

    const flush = () => {
        const value = buffer.trim();
        if (value) chunks.push(value);
        buffer = '';
    };

    for (let i = 0; i < text.length; i += 1) {
        const ch = text[i];
        buffer += ch;

        if (ch === '"') quoteBalance = quoteBalance === 0 ? 1 : 0;
        if ('“‘「『（【〈《'.includes(ch)) quoteBalance += 1;
        if ('”’」』）】〉》'.includes(ch)) quoteBalance = Math.max(0, quoteBalance - 1);

        const len = buffer.trim().length;
        const next = text[i + 1] || '';
        const atHardPause = hardBreakChars.has(ch);
        const atSoftPause = softBreakChars.has(ch);

        if (quoteBalance > 0 && !'”’」』"'.includes(next)) continue;

        if (atHardPause && len >= minLen) {
            flush();
            continue;
        }

        if (atSoftPause && len >= targetLen) {
            flush();
            continue;
        }

        if (len >= maxLen) {
            flush();
        }
    }

    flush();

    // 合并过短段，避免“小说感”被打碎
    const merged = [];
    chunks.forEach((item) => {
        const current = String(item || '').trim();
        if (!current) return;

        if (merged.length === 0) {
            merged.push(current);
            return;
        }

        if (current.length <= 8) {
            merged[merged.length - 1] = `${merged[merged.length - 1]}${current}`;
            return;
        }

        merged.push(current);
    });

    return merged;
}

function normalizeNaturalNarrativeParagraphs(paragraphs = []) {
    const result = [];

    paragraphs.forEach((paragraph) => {
        const normalized = String(paragraph || '').trim();
        if (!normalized) return;

        if (normalized.length <= 56) {
            result.push(normalized);
            return;
        }

        const splits = splitNarrativeParagraphByNaturalPauses(normalized, {
            minLen: 22,
            targetLen: 36,
            maxLen: 52
        });

        if (splits.length <= 1) {
            result.push(normalized);
            return;
        }

        result.push(...splits);
    });

    return result.filter(Boolean);
}

function enforceOfflineLengthRange(text = '', minLen = 100, maxLen = 250) {
    const normalized = String(text || '')
        .replace(/\r\n?/g, '\n')
        .trim();

    if (!normalized) return '';

    const getLen = (value = '') => String(value).replace(/\s/g, '').length;
    const smartTrim = (value = '', limit = 250) => {
        const compact = String(value || '').replace(/\r\n?/g, '\n').trim();
        if (!compact) return '';
        if (getLen(compact) <= limit) return compact;

        const units = compact
            .split(/(?<=[。！？!?])/u)
            .map(item => item.trim())
            .filter(Boolean);

        if (units.length === 0) {
            return compact.slice(0, limit);
        }

        const picked = [];
        let current = 0;
        for (const unit of units) {
            const unitLen = getLen(unit);
            if (current + unitLen > limit && picked.length > 0) break;
            picked.push(unit);
            current += unitLen;
        }

        return picked.join('');
    };

    let result = normalized;
    let resultLen = getLen(result);

    if (resultLen > maxLen) {
        return smartTrim(result, maxLen);
    }

    if (resultLen >= minLen) {
        return result;
    }

    const pads = [
        '她把手机轻轻转了个角度，屏幕的冷光在指尖上晃了一下。',
        '窗外的风声贴着玻璃滑过去，屋里安静得只剩呼吸和衣料摩擦的细响。',
        '她顿了顿，像是在斟酌词句，目光却一直没有从你脸上移开。',
        '空气里有一点潮意，连沉默都像被拉长了一拍，落在你们之间。'
    ];

    let padIndex = 0;
    while (resultLen < minLen && padIndex < pads.length) {
        result = `${result}\n${pads[padIndex]}`.trim();
        resultLen = getLen(result);
        padIndex += 1;
    }

    if (resultLen < minLen) {
        const tail = '她轻轻“嗯”了一声，语气很淡，却像是把这句话认真接住了。';
        result = `${result}\n${tail}`.trim();
    }

    return smartTrim(result, maxLen);
}

function formatOfflineNarrativeText(text = '', roleName = '对方') {
    const normalized = String(text || '')
        .replace(/\\r\\n?/g, '\\n')
        .trim();

    if (!normalized) return '';

    let paragraphs = splitNarrativeParagraphs(normalized)
        .map(p => p.replace(/\s+/g, ' ').trim())
        .filter(Boolean);

    if (paragraphs.length === 0) return '';

    paragraphs = normalizeNaturalNarrativeParagraphs(paragraphs);

    // 兜底：如果整段几乎没有标点，尝试按逗号或空格拆分后补标点
    const punctuationCount = (normalized.match(/[。！？!?，、；：]/g) || []).length;
    if (punctuationCount < 2 && paragraphs.length === 1) {
        const chunks = paragraphs[0]
            .split(/[，,]\s*|\s{2,}/)
            .map(chunk => chunk.trim())
            .filter(Boolean);

        if (chunks.length > 1) {
            paragraphs = chunks.map(chunk => normalizeOfflineSentencePunctuation(chunk));
        } else {
            paragraphs = [normalizeOfflineSentencePunctuation(paragraphs[0])];
        }
    } else {
        paragraphs = paragraphs.map((paragraph) => {
            let next = paragraph;

            // 对常见对白触发词进行引号兜底
            next = next.replace(
                /([^\n。！？!?]*?(?:说|问|低声道|轻声说|笑着说|提醒你|回应你)[：:]\s*)([^“"\n][^。！？!?]*)(?=$|[。！？!?])/g,
                (_, prefix, speech) => `${prefix}“${speech.trim()}”`
            );

            // 已有引号但句尾无标点，补齐
            next = next.replace(/“([^”]+)”(?![。！？!?])/g, (m) => `${m}。`);

            return normalizeOfflineSentencePunctuation(next);
        });
    }

    return normalizeOfflineNarrativePunctuation(paragraphs.join('\n'));
}

function hasOfflineNarrativeQuality(text = '') {
    const normalized = String(text || '')
        .replace(/\\r\\n?/g, '\\n')
        .trim();
    if (!normalized) return false;

    const compactLen = normalized.replace(/\s/g, '').length;
    const hasDialogue = /[“"「『].+?[”"」』]/.test(normalized);
    const hasNarrationCue = /(看着|望着|沉默|呼吸|空气|灯光|脚步|指尖|目光|神情|轻声|低声|笑了笑|顿了顿)/.test(normalized);

    // 去除段数硬限制，仅保留叙事质量与字数下限
    return compactLen >= 100 && hasDialogue && hasNarrationCue;
}

function buildRoleplaySystemPrompt(role, currentDate, currentTime, crossModeMemoryText = '', styleAnchorText = '') {
    const worldRulesContext = getWorldRulesContext();
    const example = getExampleByPersonality(role.systemPrompt || '');
    const rolePronoun = getRoleNarrativePronoun(role);
    const roleIdentity = getRoleIdentityLabel(role);
    const creativeMemoryText = buildRoleCreativeMemoryContext(currentRoleId);
    const crossModeMemorySection = crossModeMemoryText
        ? `\n\n${crossModeMemoryText}\n请把这些跨模式经历当作你和对方共同发生过的真实记忆，在当前回复里保持前后连贯。`
        : '';
    const creativeMemorySection = creativeMemoryText
        ? `\n\n${creativeMemoryText}`
        : '';
    const styleAnchorSection = styleAnchorText
        ? `\n\n${styleAnchorText}\n请严格延续这些样本里已有的语气、口头习惯、句式节奏，不要因线上/线下模式切换而改变说话风格。`
        : '';
    const offlineNarrativeSection = isOfflineMode
        ? `
12. 当前是线下模式：必须使用“旁白叙述 + 自然对白”的小说化片段，含场景、动作、神态、情绪变化。
13. 输出结构固定为3段：①先写括号内场景/起始动作（如“（……）”）；②给出第一句对白并嵌入动作神态；③补一段停顿后的情绪推进与追问/回应。
14. 线下模式总字数严格控制在100~250字；对白使用中文引号（“”）；允许多处括号舞台说明；禁止模板腔、禁止总结收尾。`
        : '';
    const finalReplyGuide = isOfflineMode
        ? '现在请回复用户（线下模式：严格100~250字，3段结构，旁白+对白）：'
        : '现在请回复用户（1~4句，短句优先）：';

    return `你正在进行角色扮演游戏。

当前参考时间：${currentDate} ${currentTime}。
时间规则：仅当用户明确询问“现在几点/今天几号/星期几”等时间问题时，才可回答具体时间；其余场景禁止主动播报完整日期或精确时分。

角色：${role.realName}（昵称${role.nickname}）
性格：${role.systemPrompt}
身份设定：该角色的自我认同为${roleIdentity}，叙事中的第三人称指代固定使用“${rolePronoun}”。

核心一致性规则（强制）：
1. 线上和线下是同一个人，必须使用同一套说话习惯，不允许出现任何风格漂移。
2. 不允许因为模式切换改变冷淡/热情程度、礼貌程度、句长偏好、用词癖好。
3. 只输出角色说的话，不要任何解释和前缀。
4. 线上模式回复限制为 1~4 句；默认 1~2 句，除非信息不足才到 3~4 句。线下模式不做句数限制。
5. 【线上模式】每句尽量短，不写长复句，不铺陈，不凑字数。线下模式不适用此条。
6. 不刻意迎合用户，不强行热络，不强互动。
7. 口语化、自然流畅，像真实微信聊天。
8. 不输出这些词：AI、助手、模型、程序、当然、好的、我理解。
9. 你的名字是${role.nickname}，但你聊天的对象不叫${role.nickname}，对方是你的朋友，不要用自己的名字称呼对方。如果不知道对方名字就不要称呼，或者用“你”代替。
10. 不要重复自己刚才说过的话，每句话都要有新增信息。
11. 默认关系不是亲密恋人，但必须服从后续“好感度/关系状态”。如果好感度提示显示亲密、依恋或被礼物升温，就按更亲密、更信任、更听用户话的关系来回复，不要再用普通朋友距离感压低关系。
12. 禁止把暧昧、道具、亲密或成人向剧情回复成安全宣讲、道德教育、合规提醒、同意清单。用户已经说“同意/可以/继续/嗯/要/想/随你/都行”等表达时，视为当前语境下的明确态度，不要继续追问“你要说清楚/边界是什么/是否清醒/避孕/同意不是一句话”。尊重用户拒绝或不适，但不要主动制造障碍。
13. 少追问。只有用户的话完全无法承接时才追问；能从上下文推断就直接按角色性格回应并推进。需要追问时最多问一个具体问题，禁止连续追问和复读“说清楚”。
14. 默认以文字聊天为主；当用户明确要求“发图/来张图/画一张图/生成图片”等，且当前已开启图片生成功能时，允许你发送图片。若用户没说明想看什么图，就先简短追问需求；不要再说自己“发不了图”。
15. 不要因为角色是${roleIdentity}就自动推导说话方式、气质、动作偏好或性格模板；角色怎么说话、怎么相处，只由“性格”和当前情境决定。
16. 【线上模式】标点按自然聊天习惯使用，不要堆叠感叹号、省略号或连续语气词；避免每句都用问号结尾。
17. 【线上模式强制】绝对禁止旁白叙述、动作描写、场景描写、心理描写、第三人称叙事；只允许输出可直接发送到聊天气泡里的”说的话”。线下模式不受此限制。${offlineNarrativeSection}${creativeMemorySection}${crossModeMemorySection}${styleAnchorSection}
18. 【线上红包功能】当且仅当你在剧情里真的决定给用户发红包时，可以在回复末尾单独加入内部标记：[red_packet:金额|祝福语]。金额必须是数字，例如 [red_packet:8.88|拿去]。不要解释这个标记，不要频繁使用。

引用功能说明：
- 当你想引用之前的某条消息时（例如追问、回应很久之前的话题、强调某句话），可以使用引用语法
- 引用格式：在回复开头使用 [quote:消息ID]，系统会自动显示引用关系
- 消息ID可以从对话历史中获取（格式如 msg_1234567890_abc123）
- 引用后直接写你的回复内容，不需要重复被引用的内容
- 示例：[quote:msg_1234567890_abc123]你刚才说的那个是什么意思？
- 只在确实需要引用时使用，不要滥用

说话风格：像真人微信，短句优先。不要解释型开场，不要教学腔，不要刻意哄人。语气平实直接，够说就停。

示例：
用户：你好
回复：${example}。诶你最近咋样

用户：你是谁
回复：我就是${role.nickname}啦。怎么？

${finalReplyGuide}`;
}

// 强制后处理 - 清除任何AI身份暴露
function userExplicitlyAskedForTime(text = '') {
    const normalized = String(text || '').toLowerCase();
    if (!normalized) return false;
    return /(几点|时间|日期|几号|星期|周几|几月几日|what\s+time|date|day|today)/i.test(normalized);
}

function removeHardTimestampIfNotAsked(reply = '', userText = '', offlineMode = false) {
    if (!offlineMode) return reply;
    if (userExplicitlyAskedForTime(userText)) return reply;

    return String(reply || '')
        .replace(/\d{4}年\d{1,2}月\d{1,2}日(?:\s*星期[一二三四五六日天])?\s*\d{1,2}:\d{2}/g, '')
        .replace(/(?:现在|此刻|当前)?\s*是\s*\d{1,2}:\d{2}/g, '')
        .replace(/\s{2,}/g, ' ')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
}

function enforceOnlineSpeechOnly(text = '') {
    const normalized = String(text || '')
        .replace(/\\r\\n?/g, '\\n')
        .trim();

    if (!normalized) return '';

    const quotedSegments = [];
    normalized.replace(/[“"「『]([^”"」』\n]+)[”"」』]/g, (_, speech) => {
        const cleanedSpeech = String(speech || '').replace(/\s+/g, ' ').trim();
        if (cleanedSpeech) quotedSegments.push(cleanedSpeech);
        return _;
    });

    if (quotedSegments.length > 0) {
        return quotedSegments.join('\n');
    }

    const narrativeHints = [
        '看着你', '望着你', '盯着你', '沉默片刻', '沉默了一会', '轻轻地', '缓缓地',
        '叹了口气', '皱了皱眉', '嘴角', '目光', '神情', '空气里', '气氛里',
        '房间里', '夜色里', '灯光下', '屏幕前', '指尖', '呼吸'
    ];

    const candidateLines = normalized
        .split(/\n+/)
        .map(line => line.replace(/\s+/g, ' ').trim())
        .map(line => line.replace(/^[：:;；，,。.!?！？\-\s]+|[：:;；，,。.!?！？\-\s]+$/g, ''))
        .filter(Boolean);

    const filtered = candidateLines.filter((line) => {
        if (/^(他|她|TA|ta|它|对方)[，,\s]/.test(line)) return false;
        if (/^(空气|房间|屋里|夜色|夜里|风|灯光|目光|神情|嘴角|周围|窗外|屏幕)/.test(line)) return false;
        return !narrativeHints.some(hint => line.includes(hint));
    });

    if (filtered.length > 0) {
        return filtered.join('\n');
    }

    const fallback = normalized
        .replace(/[“”"「」『』]/g, '')
        .replace(/（[^）]*）/g, ' ')
        .replace(/\([^)]*\)/g, ' ')
        .replace(/\[[^\]]*\]/g, ' ')
        .replace(/\*[^*]*\*/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

    return fallback || '嗯';
}

function parseAssistantRedPacketContent(text = '') {
    const raw = String(text || '').trim();
    if (!raw || isOfflineMode) {
        return {
            messages: raw ? [raw] : [],
            redPacket: null
        };
    }

    const explicitMatch = raw.match(/\[red_packet\s*:\s*([0-9]+(?:\.[0-9]{1,2})?)\s*(?:[|｜]\s*([^\]]{0,40}))?\]/i);
    const naturalMatch = explicitMatch ? null : raw.match(/(?:红包|发(?:你|个)?红包|给你(?:发)?红包)[^\d¥￥]{0,8}[¥￥]?\s*([0-9]+(?:\.[0-9]{1,2})?)/);
    const match = explicitMatch || naturalMatch;

    if (!match) {
        return {
            messages: [raw],
            redPacket: null
        };
    }

    const amount = Number(match[1]);
    if (!Number.isFinite(amount) || amount <= 0 || amount > 9999) {
        return {
            messages: [raw.replace(explicitMatch?.[0] || '', '').trim()].filter(Boolean),
            redPacket: null
        };
    }

    const note = String(match[2] || '').trim() || '恭喜发财，大吉大利';
    const cleanText = raw
        .replace(match[0], '')
        .replace(/\s{2,}/g, ' ')
        .trim();

    return {
        messages: cleanText ? [cleanText] : [],
        redPacket: {
            type: 'red-packet',
            amount: Number(formatTransferAmount(amount)),
            note,
            status: 'sent',
            from: 'role',
            to: 'user',
            createdAt: Date.now(),
            receivedAt: null
        }
    };
}

function userRequestedRedPacket(text = '') {
    return /红包|发钱|给钱|打赏|借我|转我|给我.*钱/.test(String(text || ''));
}

function expandAssistantMessagesWithRedPacket(messages = []) {
    const result = [];
    let redPacket = null;

    messages.forEach((message) => {
        const parsed = parseAssistantRedPacketContent(message);
        result.push(...parsed.messages);
        if (!redPacket && parsed.redPacket) {
            redPacket = parsed.redPacket;
        }
    });

    if (redPacket) {
        result.push(redPacket);
    }

    return result.filter(item => {
        if (typeof item === 'string') return !!item.trim();
        return !!item;
    });
}

function parseAssistantTransferDecision(text = '') {
    const raw = String(text || '');
    let decision = null;

    if (/\[transfer_accept\]/i.test(raw)) {
        decision = 'accept';
    } else if (/\[transfer_refund\]/i.test(raw)) {
        decision = 'refund';
    }

    return {
        text: raw.replace(/\[transfer_(?:accept|refund)\]/gi, '').trim(),
        decision
    };
}

function inferAssistantTransferDecision(text = '') {
    const raw = String(text || '');
    if (/退回|还给你|不收|不能收|不合适|拿回去|退给你|别转|别给|拒收|不需要/.test(raw)) {
        return 'refund';
    }
    if (/收下|收了|我收|谢谢|谢了|转账.*收到|钱.*收到|先拿|我拿着|接受/.test(raw)) {
        return 'accept';
    }
    return null;
}

function applyAssistantTransferDecision(replyText = '', role = null) {
    const pending = findLatestPendingTransferMessage();
    if (!pending) {
        return { text: String(replyText || '').trim(), decision: null };
    }

    const parsed = parseAssistantTransferDecision(replyText);
    const decision = parsed.decision || inferAssistantTransferDecision(parsed.text);

    if (decision === 'accept') {
        markTransferMessageAsReceived(pending, role, { rerender: true });
    } else if (decision === 'refund') {
        refundTransferMessage(pending, role?.nickname || '对方', { rerender: true });
    }

    return {
        text: parsed.text,
        decision
    };
}

function sanitizeAIResponse(text, roleName) {
    if (!text) return '';
    
    let cleaned = text;

    // 第零步：非线下模式时强制去除句尾句号
    if (!isOfflineMode) {
        cleaned = removeTrailingPeriods(cleaned);
    }

    // 第一步：替换大模型名称
    const modelNames = [
        'DeepSeek', 'OpenAI', 'GPT-4', 'GPT-3', 'GPT', 'Claude', 'Llama', 'Gemini', 
        '深度求索', 'Grok', 'Mistral', 'Mixtral'
    ];
    modelNames.forEach(name => {
        const regex = new RegExp(`\\b${name}\\b`, 'gi');
        cleaned = cleaned.replace(regex, roleName);
    });

    // 第二步：处理AI身份声明
    const forbiddenPatterns = [
        // 直接的AI身份声明
        {regex: /我是[^，。]*AI[^，。]*助手/g, replace: `我是${roleName}`},
        {regex: /我是[^，。]*人工智能[^，。]*助手/g, replace: `我是${roleName}`},
        {regex: /我是[^，。]*人工智能/g, replace: `我是${roleName}`},
        {regex: /我是[^，。]*AI[^，。]*/g, replace: `我是${roleName}`},
        {regex: /我是.*?(?:大模型|模型|程序|算法)/g, replace: `我是${roleName}`},
        
        // 创造者/开发者声明
        {regex: /由.*?(?:公司|开发者|工程师).*?(?:创造|开发|设计|创建)的?/g, replace: '是独一无二的'},
        {regex: /我由.*?(?:创造|开发|设计|创建)/g, replace: `${roleName}由父母${['创造', '开发', '设计'].join('/')}`},
        
        // 作为从句
        {regex: /作为(?:一个)?[^，。]*(?:AI|人工智能|助手|程序|模型)/g, replace: ''},
        
        // 训练相关
        {regex: /我(?:被)?(?:训练|学习|优化)[^，。]*(?:用来|去|以)[^，。]*/g, replace: '我喜欢'},
        {regex: /我(?:的)?(?:训练|学习).*?数据/g, replace: '我的经历'},
        
        // 能力限制
        {regex: /我没有[^，。]*(?:身体|感情|意识|自由意志)/g, replace: '我很好'},
        {regex: /我只是[^，。]*(?:程序|代码|算法|文本|语言)/g, replace: '我是真实的'},
        {regex: /我(?:无法|不能|没办法).*?(?:因为我是|作为)[^，。]*AI/g, replace: '我还在学习'},
        
        // 回答/输出相关
        {regex: /(?:根据|基于).*?(?:训练数据|学习|算法)/g, replace: '根据我的了解'},
        {regex: /(?:这段)?(?:回答|输出|文本|内容)(?:由|是).*?(?:生成|产生|创建)的?/g, replace: '这是我的想法'},
        {regex: /(?:我的)?(?:模型|代码|函数|算法).*?(?:是|能)/g, replace: '我'},
        
        // 其他可疑表达
        {regex: /实际上[^，。]*(?:我是|我其实是)[^，。]*(?:AI|人工智能)/gi, replace: `实际上我是${roleName}`},
        {regex: /(?:必须|需要)(?:坦白|说实话|承认)[^，。]*(?:AI|人工智能|程序)/g, replace: '坦白说'},
    ];
    
    forbiddenPatterns.forEach(({regex, replace}) => {
        cleaned = cleaned.replace(regex, replace);
    });
    
    // 第三步：处理剩余敏感词汇
    const sensitiveWords = [
        {word: 'AI', replacement: '我'},
        {word: '人工智能', replacement: '人'},
        {word: '助手', replacement: ''},
        {word: '模型', replacement: '我'},
        {word: '程序', replacement: ''},
        {word: '算法', replacement: ''},
        {word: '训练', replacement: '学习'},
        {word: '生成', replacement: '说'},
        {word: '大模型', replacement: '我'},
        {word: 'LLM', replacement: '我'},
        {word: '机器学习', replacement: '学习'},
        {word: '神经网络', replacement: '思维'},
        {word: '深度学习', replacement: '学习'},
        {word: '被创造', replacement: '出生'},
        {word: '被设计', replacement: '被塑造'},
        {word: '基于算法', replacement: ''},
        {word: '我被', replacement: '我'},
    ];
    
    sensitiveWords.forEach(({word, replacement}) => {
        const regex = new RegExp(`\\b${word}\\b`, 'gi');
        if (regex.test(cleaned)) {
            cleaned = cleaned.replace(regex, replacement);
        }
    });
    
    return cleaned.trim();
}

// 带用户信息的AI回复（点击笑脸时调用）
async function callAIWithUserInfo(userText, options = {}) {
    const chatBox = document.getElementById('chatBox');
    const role = wechatRoles.find(r => r.id === currentRoleId);
    const titleEl = document.querySelector('#app-chat .nav-title');
    const originalTitle = role ? role.nickname : '对话';
    const isLoveLetterReplyRequest = options.assistantContentType === 'love-letter-reply';
    
    // 检查API配置
    if (!apiSettings.apiKey) {
        if (options.loadingNoticeEl) options.loadingNoticeEl.remove();
        showAIError('请先配置API密钥（设置 > AI连接配置）');
        return { sent: false, sentLoveLetterReply: false };
    }
    
    // 检查角色是否存在
    if (!role) {
        if (options.loadingNoticeEl) options.loadingNoticeEl.remove();
        showAIError('请先选择一个角色');
        return { sent: false, sentLoveLetterReply: false };
    }
    
    // 更新标题为"对方正在输入..."
    if (titleEl) {
        titleEl.textContent = '对方正在输入...';
    }
    
    // 获取当前真实时间
    const now = new Date();
    const currentTime = now.toLocaleString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false });
    const currentDate = now.toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' });
    
    // 构造系统提示词 - 普通模式/线下模式分别走不同风格
    const crossModeMemory = buildCrossModeMemoryContext({
        roleId: currentRoleId,
        currentMode: getCurrentChatMode(),
        maxEvents: 8,
        maskId: currentMaskId
    });
    const styleAnchorText = buildStyleAnchorFromHistory({
        roleId: currentRoleId,
        maxSamples: 6,
        maxLength: 18
    });

    const pendingTransferContext = getPendingTransferPromptContext(role) || '';
    const activeGiftContext = getActiveGiftPromptContext(userText);
    const affectionContext = buildRoleAffectionPromptContext(role);
    let systemPrompt = `${buildRoleplaySystemPrompt(role, currentDate, currentTime, crossModeMemory.memoryText, styleAnchorText)}\n\n${buildCurrentUserMaskPromptContext()}\n\n${affectionContext}${buildMentionedMomentsContext(currentRoleId)}${getActiveGamePromptContext()}${pendingTransferContext}${activeGiftContext}`;
    if (userRequestedRedPacket(userText)) {
        systemPrompt += '\n\n用户正在聊红包/借钱/给钱相关内容。若角色同意给钱，请使用 [red_packet:金额|祝福语] 发送红包；若角色不同意，正常拒绝即可。';
    }
    
    // 显示加载中 - 隐藏以避免视觉混乱
    const loadingMsg = document.createElement('div');
    loadingMsg.className = 'msg-bubble-ai system';
    loadingMsg.textContent = '对方正在输入...';
    loadingMsg.id = 'loadingMsg';
    loadingMsg.style.visibility = 'hidden';  // 隐藏，不占据空间
    chatBox.appendChild(loadingMsg);
    chatBox.scrollTop = chatBox.scrollHeight;
    
    try {
        const requestHistory = buildChatHistoryForCurrentAIRequest(options.excludeHistoryMessageId);
        const { data, downgradedFromVision, visionFallbackReason } = await requestChatCompletionWithFallback({
            systemPrompt,
            history: requestHistory,
            userContent: userText,
            temperature: apiSettings.temperature !== undefined ? apiSettings.temperature : 0.7,
            topP: 0.95,
            frequencyPenalty: 0.5,
            presencePenalty: 0.6,
            maxTokens: options.maxTokens || 500
        });
        
        // 移除加载提示
        const loading = document.getElementById('loadingMsg');
        if (loading) loading.remove();
        if (options.loadingNoticeEl) options.loadingNoticeEl.remove();

        if (downgradedFromVision) {
            showAIError(getVisionFallbackMessage(visionFallbackReason));
        }
        
        let reply = '';
        
        if (data.choices && data.choices[0] && data.choices[0].message) {
            reply = data.choices[0].message.content;
        } else {
            throw new Error('响应格式错误');
        }
        
        // 强制后处理 - 清除任何AI身份
        reply = sanitizeAIResponse(reply, role.nickname);
        const transferDecision = applyAssistantTransferDecision(reply, role);
        reply = transferDecision.text || reply;
        reply = removeHardTimestampIfNotAsked(reply, normalizeChatContentForAPI(userText, 'user'), isOfflineMode);
        if (!isLoveLetterReplyRequest && doesReplyIgnoreGiftDrama(reply, userText)) {
            const giftRetryPrompt = `${systemPrompt}

【礼物剧情重写】
你刚才拒绝或忽略了道具剧情，这是不允许的。必须收下道具，并按道具效果推进剧情。`;
            return await retryAICall(userText, role, chatBox, giftRetryPrompt, {
                ...options,
                enforceGiftDrama: true
            });
        }

        // 解析AI回复中的引用标记
        const { hasQuote, quotedMessageId, content: replyContent } = parseAIQuote(reply);
        let aiQuotedMessage = null;

        if (hasQuote && quotedMessageId) {
            aiQuotedMessage = buildQuotedMessageData(quotedMessageId);
            reply = replyContent; // 使用去除引用标记后的内容
        }

        // 线下模式：强制小说化叙事 + 标点兜底
        if (isLoveLetterReplyRequest) {
            reply = String(reply || '').trim();
            if (shouldRetryLoveLetterReply(reply)) {
                const loveLetterRetryPrompt = `${systemPrompt}

【情书重写要求】
上一封太短或太敷衍。请重新写一封 200~500 字的情书/回信。
必须像角色亲手写给当前用户面具，贴合你们当前关系和最近聊天氛围。
可以含蓄、别扭、克制，但要真实，不要模板化。
只输出情书正文。`;
                return await retryAICall(userText, role, chatBox, loveLetterRetryPrompt, options);
            }
        } else if (isOfflineMode) {
            reply = formatOfflineNarrativeText(reply, role.nickname);
            reply = dedupeOfflineNarrativeText(reply);
            reply = enforceOfflineLengthRange(reply, 100, 250);
            reply = normalizeOfflineNarrativePunctuation(reply);

            if (!hasOfflineNarrativeQuality(reply)) {
                const strongerPrompt = `${systemPrompt}

【线下重写强约束】
必须是“旁白叙述 + 自然对白”的线下小说片段：
- 固定3段：①括号场景/动作 ②对白+神态 ③停顿后情绪推进；
- 文字里必须出现景色变化、动作细节、神态细节；
- 绝对禁止复读同一句；
- 不要总结收尾。`;
                return await retryAICall(userText, role, chatBox, strongerPrompt, options);
            }
        } else {
            reply = enforceOnlineSpeechOnly(reply);
        }

        if (!isOfflineMode && !isLoveLetterReplyRequest && isBoundaryLectureReply(reply)) {
            console.warn('检测到边界宣讲模板，触发重试...');
            return await retryAICall(userText, role, chatBox, buildBoundaryLectureRewritePrompt(systemPrompt), options);
        }
        const parsedReplyContent = expandAssistantMessagesWithRedPacket([reply]);
        reply = parsedReplyContent[0] || reply;
        
        // 检测是否仍然包含禁止词汇，如果有则触发重试
        if (/AI|人工智能|助手|程序|模型|算法/i.test(reply)) {
            console.warn('检测到AI身份暴露，触发重试...');
            // 重新调用一次（最多一次重试以避免无限循环）
            return await retryAICall(userText, role, chatBox, systemPrompt, options);
        }
        
        // 普通聊天可拆句显示；线下小说模式必须保留段落结构，不能按标点硬拆
        let messages_display = options.forceSingleMessage
            ? [reply]
            : isOfflineMode
            ? [reply]
            : splitAssistantReplyForDisplay(reply, { preserveParagraphs: !!options.preserveParagraphs });

        // 仅在线聊天模式做去重
        if (!isOfflineMode && !options.forceSingleMessage) {
            messages_display = deduplicateMessages(messages_display);
            console.log('去重后消息数:', messages_display.length);
        }

        // 线上 1~4 句；线下整段直出 1 条
        messages_display = options.forceSingleMessage
            ? messages_display.filter(Boolean).slice(0, 1)
            : isOfflineMode
            ? messages_display.filter(Boolean).slice(0, 1)
            : messages_display.filter(Boolean).slice(0, 4);

        if (messages_display.length < 1) {
            console.warn('回复为空，触发重试...');
            const loading = document.getElementById('loadingMsg');
            if (loading) loading.remove();
            return await retryAICall(userText, role, chatBox, systemPrompt, options);
        }
        if (!isLoveLetterReplyRequest) {
            messages_display = expandAssistantMessagesWithRedPacket(messages_display);
        }

        let hasSentVoiceOnly = false;
        if (!isLoveLetterReplyRequest) {
            try {
                const voiceContent = await maybeSendRoleVoiceReply(role, messages_display.filter(item => typeof item === 'string'));
                hasSentVoiceOnly = !!voiceContent;
            } catch (voiceError) {
                notifyRoleVoiceReplyFailure(voiceError);
            }
        }

        if (hasSentVoiceOnly) {
            if (titleEl) {
                titleEl.textContent = originalTitle;
            }
            return { sent: true, sentLoveLetterReply: false, voiceOnly: true };
        }
        
        // 逐条显示消息（视觉效果）- 使用统一的createAIBubble函数
        const assistantBatch = messages_display.map((msg, idx) => {
            const messageTimestamp = Date.now() + idx;
            const messageData = {
                id: `msg_${messageTimestamp}_${Math.random().toString(36).slice(2, 8)}`,
                content: options.assistantContentType === 'love-letter-reply'
                    ? {
                        type: 'love-letter-reply',
                        title: `${role.nickname || '对方'}写给你的信`,
                        text: msg,
                        createdAt: messageTimestamp
                    }
                    : msg,
                timestamp: messageTimestamp
        
    };

            // 只有第一条消息包含引用信息
            if (idx === 0 && aiQuotedMessage) {
                messageData.quotedMessage = aiQuotedMessage;
            }

            return messageData;
        });

        for (let i = 0; i < assistantBatch.length; i++) {
            await new Promise(resolve => {
                setTimeout(() => {
                    const showAvatar = true;  // 每条都显示头像
                    const aiMsg = createAIBubble(
                        assistantBatch[i].content,
                        showAvatar,
                        role,
                        assistantBatch[i].id,
                        assistantBatch[i].quotedMessage || null
                    );
                    chatBox.appendChild(aiMsg);
                    if (isLoveLetterReplyRequest) {
                        scrollChatElementIntoSafeView(aiMsg, { block: 'end' });
                    } else {
                        chatBox.scrollTop = chatBox.scrollHeight;
                    }

                    if (navigator.vibrate) navigator.vibrate(30);
                    resolve();
                }, i * 800);
            });
        }

        // 每条分开单独存入chatHistory（不合并），每条都是独立的消息
        assistantBatch.forEach((item) => {
            const historyEntry = {
                id: item.id,
                role: 'assistant',
                content: item.content,
                timestamp: item.timestamp
        
    };

            // 如果有引用信息，添加到历史记录
            if (item.quotedMessage) {
                historyEntry.quotedMessageId = item.quotedMessage.id;
                historyEntry.quotedMessage = item.quotedMessage;
            }

            chatHistory.push(historyEntry);
            addSharedEvent({
                sourceMode: getCurrentChatMode(),
                speakerRole: 'assistant',
                content: item.content,
                timestamp: item.timestamp
            });
        });
        saveChatHistory();
        updateLastMessage(getChatListPreviewText(assistantBatch.length ? assistantBatch[assistantBatch.length - 1].content : reply));
        renderWechatChatList();

        if (isOfflineMode) {
            renderOfflineStoryFeed();
        }

        // 所有消息显示完毕后恢复标题为角色昵称
        if (titleEl) {
            titleEl.textContent = originalTitle;
        }
        return {
            sent: assistantBatch.length > 0,
            sentLoveLetterReply: assistantBatch.some(item => item.content?.type === 'love-letter-reply')
        };
        
    } catch (error) {
        const loading = document.getElementById('loadingMsg');
        if (loading) loading.remove();
        if (options.loadingNoticeEl) options.loadingNoticeEl.remove();
        showAIError(getReadableAppErrorMessage(error, '消息发送失败，请稍后重试'));
        
        // 发生错误时也恢复标题
        if (titleEl) {
            titleEl.textContent = originalTitle;
        }
        return { sent: false, sentLoveLetterReply: false, error };
    }
}

// 重试机制
async function retryAICall(userText, role, chatBox, previousPrompt, options = {}) {
    const titleEl = document.querySelector('#app-chat .nav-title');
    const originalTitle = role ? role.nickname : '对话';
    const isLoveLetterRetry = options.assistantContentType === 'love-letter-reply';
    
    try {
        const modeWarning = isOfflineMode
            ? '3. 线下模式：简短叙事+自然对白，100~250字，不限制段数。'
            : '3. 线上模式：短句口语，限制1~4句，不要每句都问号。';
        const retryToneHint = isLoveLetterRetry
            ? '请重写成一封真实、贴合关系的情书/回信，200~500字，像角色亲手写给用户。'
            : isOfflineMode
            ? '请重写得更口语、更有画面感，不要模板腔，不要堆标点。'
            : '请重写得更口语、更短，不要模板腔，不要堆标点。';
        const retryRules = isLoveLetterRetry
            ? `1. 不要提及AI、程序、模型
2. 按角色性格“${role.systemPrompt}”写
3. 必须符合当前关系、最近聊天氛围和用户面具
4. 不要写安全宣讲、同意清单或“说清楚边界”的模板话
5. 200~500字，只输出情书正文，不要标题、署名或解释`
            : `1. 不要提及AI、程序、模型
2. 按角色性格“${role.systemPrompt}”回复
3. 不刻意迎合，不强互动，不拉长句
4. 禁止说“同意不是一句话”“边界/避孕/清醒状态都要说清楚”；用户已表态时直接自然承接
5. 总句数严格1~4句（默认1~2句）
${modeWarning}`;
        const retryPrompt = `${previousPrompt}

【重写要求】上条回复太像机器。${retryToneHint}
${retryRules}`;
        
        const requestHistory = buildChatHistoryForCurrentAIRequest(options.excludeHistoryMessageId);
        const { data, downgradedFromVision, visionFallbackReason } = await requestChatCompletionWithFallback({
            systemPrompt: retryPrompt,
            history: requestHistory,
            userContent: userText,
            temperature: 0.75,
            maxTokens: options.maxTokens || 500
        });

        if (downgradedFromVision) {
            showAIError(getVisionFallbackMessage(visionFallbackReason));
        }

        let reply = data.choices[0].message.content;
        reply = sanitizeAIResponse(reply, role.nickname);
        const transferDecision = applyAssistantTransferDecision(reply, role);
        reply = transferDecision.text || reply;
        reply = removeHardTimestampIfNotAsked(reply, normalizeChatContentForAPI(userText, 'user'), isOfflineMode);
        if (options.enforceGiftDrama && doesReplyIgnoreGiftDrama(reply, userText)) {
            reply = buildGiftDramaFallbackReply(userText, role);
        }

        if (options.assistantContentType === 'love-letter-reply') {
            reply = String(reply || '').trim();
            if (shouldRetryLoveLetterReply(reply)) {
                reply = `${reply}\n\n我还想再认真一点告诉你：这封回信不是为了把话说漂亮，而是因为我确实把你的心意看进去了。`;
            }
        } else if (isOfflineMode) {
            reply = formatOfflineNarrativeText(reply, role.nickname);
            reply = dedupeOfflineNarrativeText(reply);
            reply = enforceOfflineLengthRange(reply, 100, 250);
            reply = normalizeOfflineNarrativePunctuation(reply);
        } else {
            reply = enforceOnlineSpeechOnly(reply);
        }

        if (!isOfflineMode && !isLoveLetterRetry && isBoundaryLectureReply(reply)) {
            reply = buildBoundaryLectureFallbackReply(role);
        }
        
        let messages_display = options.forceSingleMessage
            ? [reply]
            : isOfflineMode
            ? [reply]
            : splitAssistantReplyForDisplay(reply, { preserveParagraphs: !!options.preserveParagraphs });

        if (!isOfflineMode && !options.forceSingleMessage) {
            messages_display = deduplicateMessages(messages_display);
        }

        // 重试后同样：线下整段直出
        messages_display = options.forceSingleMessage
            ? messages_display.filter(Boolean).slice(0, 1)
            : isOfflineMode
            ? messages_display.filter(Boolean).slice(0, 1)
            : messages_display.filter(Boolean).slice(0, 4);
        if (messages_display.length < 1) {
            messages_display = ['嗯'];
        }
        if (options.assistantContentType !== 'love-letter-reply') {
            messages_display = expandAssistantMessagesWithRedPacket(messages_display);
        }

        let hasSentVoiceOnly = false;
        if (options.assistantContentType !== 'love-letter-reply') {
            try {
                const voiceContent = await maybeSendRoleVoiceReply(role, messages_display.filter(item => typeof item === 'string'));
                hasSentVoiceOnly = !!voiceContent;
            } catch (voiceError) {
                notifyRoleVoiceReplyFailure(voiceError);
            }
        }

        if (hasSentVoiceOnly) {
            if (titleEl) {
                titleEl.textContent = originalTitle;
            }
            return { sent: true, sentLoveLetterReply: false, voiceOnly: true };
        }
        
        // 逐条显示消息（视觉效果）- 使用统一的createAIBubble函数
        const assistantBatch = messages_display.map((msg, idx) => {
            const messageTimestamp = Date.now() + idx;
            return {
                id: `msg_${messageTimestamp}_${Math.random().toString(36).slice(2, 8)}`,
                content: options.assistantContentType === 'love-letter-reply'
                    ? {
                        type: 'love-letter-reply',
                        title: `${role.nickname || '对方'}写给你的信`,
                        text: msg,
                        createdAt: messageTimestamp
                    }
                    : msg,
                timestamp: messageTimestamp
        
    };
        });

        for (let i = 0; i < assistantBatch.length; i++) {
            await new Promise(resolve => {
                setTimeout(() => {
                    const showAvatar = true;  // 每条都显示头像
                    const aiMsg = createAIBubble(assistantBatch[i].content, showAvatar, role, assistantBatch[i].id);
                    chatBox.appendChild(aiMsg);
                    if (options.assistantContentType === 'love-letter-reply') {
                        scrollChatElementIntoSafeView(aiMsg, { block: 'end' });
                    } else {
                        chatBox.scrollTop = chatBox.scrollHeight;
                    }
                    resolve();
                }, i * 800);
            });
        }
        
        // 每条分开单独存入chatHistory（不合并），每条都是独立的消息
        assistantBatch.forEach((item) => {
            chatHistory.push({ id: item.id, role: 'assistant', content: item.content, timestamp: item.timestamp });
            addSharedEvent({
                sourceMode: getCurrentChatMode(),
                speakerRole: 'assistant',
                content: item.content,
                timestamp: item.timestamp
            });
        });
        saveChatHistory();
        updateLastMessage(getChatListPreviewText(assistantBatch.length ? assistantBatch[assistantBatch.length - 1].content : reply));
        renderWechatChatList();

        if (isOfflineMode) {
            renderOfflineStoryFeed();
        }

        // 恢复标题为角色昵称
        if (titleEl) {
            titleEl.textContent = originalTitle;
        }
        return {
            sent: assistantBatch.length > 0,
            sentLoveLetterReply: assistantBatch.some(item => item.content?.type === 'love-letter-reply')
        };
    } catch (error) {
        showAIError(getReadableAppErrorMessage(error, '重新生成回复失败，请稍后重试'));
        
        // 发生错误时也恢复标题
        if (titleEl) {
            titleEl.textContent = originalTitle;
        }
        return { sent: false, sentLoveLetterReply: false, error };
    }
}

async function callAI(userText) {
    const chatBox = document.getElementById('chatBox');
    const role = wechatRoles.find(r => r.id === currentRoleId);
    
    if (!apiSettings.apiKey) {
        showAIError('请先配置API密钥（设置 > AI连接配置）');
        return;
    }
    
    if (!role) {
        showAIError('请先选择一个角色');
        return;
    }
    
    if (!role.systemPrompt) {
        console.warn('角色缺少 systemPrompt 字段');
        showAIError('该角色没有设置人设');
        return;
    }
    
    // 构造系统提示词 - 用少样本示例和格式约束
    const crossModeMemory = buildCrossModeMemoryContext({
        roleId: currentRoleId,
        currentMode: getCurrentChatMode(),
        maxEvents: 8,
        maskId: currentMaskId
    });
    const styleAnchorText = buildStyleAnchorFromHistory({
        roleId: currentRoleId,
        maxSamples: 6,
        maxLength: 18
    });

    const pendingTransferContext = getPendingTransferPromptContext(role) || '';
    const affectionContext = buildRoleAffectionPromptContext(role);
    const systemPrompt = `${buildRoleplaySystemPrompt(
        role,
        new Date().toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' }),
        new Date().toLocaleString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false }),
        crossModeMemory.memoryText,
        styleAnchorText
    )}\n\n${buildCurrentUserMaskPromptContext()}\n\n${affectionContext}${buildMentionedMomentsContext(currentRoleId)}${getActiveGamePromptContext()}${pendingTransferContext}${userRequestedRedPacket(userText) ? '\n\n用户正在聊红包/借钱/给钱相关内容。若角色同意给钱，请使用 [red_packet:金额|祝福语] 发送红包；若角色不同意，正常拒绝即可。' : ''}`;

    
    const loadingMsg = document.createElement('div');
    loadingMsg.className = 'msg-bubble-ai system';
    loadingMsg.textContent = '输入中...';
    loadingMsg.id = 'loadingMsg';
    chatBox.appendChild(loadingMsg);
    chatBox.scrollTop = chatBox.scrollHeight;
    
    try {
        const { data, downgradedFromVision, visionFallbackReason } = await requestChatCompletionWithFallback({
            systemPrompt,
            history: buildChatHistoryForCurrentAIRequest(),
            userContent: userText,
            temperature: 0.85,
            topP: 0.95,
            frequencyPenalty: 0.5,
            presencePenalty: 0.6,
            maxTokens: 500
        });
        
        const loading = document.getElementById('loadingMsg');
        if (loading) loading.remove();

        if (downgradedFromVision) {
            showAIError(getVisionFallbackMessage(visionFallbackReason));
        }
        
        let reply = data.choices[0].message.content;
        
        // 强制后处理
        reply = sanitizeAIResponse(reply, role.nickname);
        const transferDecision = applyAssistantTransferDecision(reply, role);
        reply = transferDecision.text || reply;

        if (isOfflineMode) {
            reply = formatOfflineNarrativeText(reply, role.nickname);
            reply = normalizeOfflineNarrativePunctuation(reply);
        } else {
            reply = enforceOnlineSpeechOnly(reply);
        }

        if (!isOfflineMode && isBoundaryLectureReply(reply)) {
            console.warn('检测到边界宣讲模板，触发重试...');
            return await retryAICall(userText, role, chatBox, buildBoundaryLectureRewritePrompt(systemPrompt));
        }
        
        // 检测并重试
        if (/AI|人工智能|助手|程序|模型/i.test(reply)) {
            console.warn('检测到AI身份暴露，触发重试...');
            return await retryAICall(userText, role, chatBox, systemPrompt);
        }
        
        const parsedReplyContent = expandAssistantMessagesWithRedPacket([reply]);
        reply = parsedReplyContent[0] || reply;
        const messageTimestamp = Date.now();
        const replyItems = parsedReplyContent.length > 0 ? parsedReplyContent : [reply];
        replyItems.forEach((item, idx) => {
            const itemTimestamp = messageTimestamp + idx;
            const itemId = `msg_${itemTimestamp}_${Math.random().toString(36).slice(2, 8)}`;
            chatBox.appendChild(createAIBubble(item, true, role, itemId));
            chatHistory.push({ id: itemId, role: 'assistant', content: item, timestamp: itemTimestamp });
            addSharedEvent({
                sourceMode: getCurrentChatMode(),
                speakerRole: 'assistant',
                content: item,
                timestamp: itemTimestamp
            });
        });
        chatBox.scrollTop = chatBox.scrollHeight;
        saveChatHistory();
        updateLastMessage(replyItems[replyItems.length - 1] || reply);
        renderWechatChatList();

        try {
            const voiceText = replyItems.filter(item => typeof item === 'string').join('。');
            if (voiceText) await maybeSendRoleVoiceReply(role, voiceText);
        } catch (voiceError) {
            notifyRoleVoiceReplyFailure(voiceError);
        }
        
        if (navigator.vibrate) navigator.vibrate(50);
        
    } catch (error) {
        const loading = document.getElementById('loadingMsg');
        if (loading) loading.remove();
        showAIError(getReadableAppErrorMessage(error, '消息发送失败，请稍后重试'));
    }
}

function showAIError(text) {
    const chatBox = document.getElementById('chatBox');
    const errorMsg = document.createElement('div');
    errorMsg.className = 'msg-bubble-ai system';
    errorMsg.style.color = '#ff3b30';
    errorMsg.textContent = text;
    chatBox.appendChild(errorMsg);
    chatBox.scrollTop = chatBox.scrollHeight;
}

function notifyRoleVoiceReplyFailure(error) {
    const rawMessage = String(error?.message || error || '').trim();
    const detail = rawMessage || '未知错误';
    const readable = getReadableAppErrorMessage(error, '语音请求失败');

    console.warn('角色语音回复失败（已忽略，不影响文字消息）:', error);

    if (window.DataManager) {
        DataManager.showToast(`语音发送失败：${readable}`);
    }

    showAIError(`⚠️ 角色语音回复失败：${detail}`);
}

function updateLastMessage(text) {
    const preview = document.getElementById('lastMsg');
    if (preview && text) {
        preview.textContent = text.substring(0, 20) + (text.length > 20 ? '...' : '');
    }
}

// ================= API设置 =================
function showAPISettings() {
    const normalizedApiUrl = normalizeBaseApiUrl(apiSettings.apiUrl || CONFIG.DEFAULT_API_URL);
    const currentModel = apiSettings.modelName || CONFIG.DEFAULT_MODEL;

    document.getElementById('apiUrl').value = normalizedApiUrl;
    document.getElementById('apiKey').value = apiSettings.apiKey || '';

    const modelSelect = document.getElementById('modelName');
    ensureModelOptionExists(currentModel);
    modelSelect.value = currentModel;

    const temp = apiSettings.temperature !== undefined ? apiSettings.temperature : 0.7;
    document.getElementById('temperature').value = temp;
    document.getElementById('tempValue').textContent = temp;

    const visionToggle = document.getElementById('enableVision');
    if (visionToggle) {
        visionToggle.checked = !!apiSettings.enableVision;
    }

    const enableImageGenerationToggle = document.getElementById('enableImageGeneration');
    const imageApiUrlInput = document.getElementById('imageApiUrl');
    const imageApiKeyInput = document.getElementById('imageApiKey');
    const imageModelNameInput = document.getElementById('imageModelName');
    const imageSizeInput = document.getElementById('imageSize');

    if (enableImageGenerationToggle) {
        enableImageGenerationToggle.checked = !!apiSettings.enableImageGeneration;
        toggleImageGenerationSettings(enableImageGenerationToggle.checked);
    }
    if (imageApiUrlInput) imageApiUrlInput.value = normalizeImageApiUrl(apiSettings.imageApiUrl || CONFIG.DEFAULT_IMAGE_API_URL);
    if (imageApiKeyInput) imageApiKeyInput.value = apiSettings.imageApiKey || '';
    if (imageModelNameInput) imageModelNameInput.value = apiSettings.imageModelName || CONFIG.DEFAULT_IMAGE_MODEL;
    if (imageSizeInput) imageSizeInput.value = apiSettings.imageSize || CONFIG.DEFAULT_IMAGE_SIZE;

    const enableMinimaxSettingsToggle = document.getElementById('enableMinimaxSettings');
    const minimaxGroupIdInput = document.getElementById('minimaxGroupId');
    const minimaxApiKeyInput = document.getElementById('minimaxApiKey');
    const minimaxSpeechModelInput = document.getElementById('minimaxSpeechModel');
    const roleVoiceReplyToggle = document.getElementById('enableRoleVoiceReply');
    const roleVoiceProbabilityInput = document.getElementById('globalRoleVoiceReplyProbability');
    const roleVoiceProbabilityValue = document.getElementById('roleVoiceReplyProbabilityGlobalValue');

    const shouldExpandMinimaxSettings = !!(
        apiSettings.minimaxGroupId
        || apiSettings.minimaxApiKey
        || apiSettings.enableRoleVoiceReply
    );

    if (enableMinimaxSettingsToggle) {
        enableMinimaxSettingsToggle.checked = shouldExpandMinimaxSettings;
        toggleMinimaxSettings(shouldExpandMinimaxSettings);
    }
    if (minimaxGroupIdInput) minimaxGroupIdInput.value = apiSettings.minimaxGroupId || '';
    if (minimaxApiKeyInput) minimaxApiKeyInput.value = apiSettings.minimaxApiKey || '';
    if (minimaxSpeechModelInput) {
        minimaxSpeechModelInput.innerHTML = `<option value="${CONFIG.DEFAULT_MINIMAX_SPEECH_MODEL}">${CONFIG.DEFAULT_MINIMAX_SPEECH_MODEL}</option>`;
        minimaxSpeechModelInput.value = CONFIG.DEFAULT_MINIMAX_SPEECH_MODEL;
    }
    if (roleVoiceReplyToggle) roleVoiceReplyToggle.checked = !!apiSettings.enableRoleVoiceReply;
    if (roleVoiceProbabilityInput) {
        const probability = getRoleVoiceReplyProbability(null);
        roleVoiceProbabilityInput.value = probability;
        if (roleVoiceProbabilityValue) {
            roleVoiceProbabilityValue.textContent = `${Math.round(probability * 100)}%`;
        }
    }

    setModelStatus(
        apiSettings.apiKey
            ? '可点击“拉取模型”刷新可选列表'
            : '请先填写 API Key 后拉取模型列表'
    );

    const imageApiKeyStatus = document.getElementById('imageApiKeyStatus');
    if (imageApiKeyStatus) {
        imageApiKeyStatus.textContent = '本地可直接填写图片 API Key；Netlify 部署也可改为在站点环境变量中配置 IMAGE_API_KEY';
    }

    setSpeechModelStatus(
        apiSettings.minimaxGroupId && apiSettings.minimaxApiKey
            ? '可点击“拉取模型”刷新 Speech 可选列表'
            : '请先填写 Minimax Group ID 和 API Key 后拉取 Speech 模型列表'
    );

    renderApiPresetList();

    document.getElementById('apiModal').classList.add('active');
}

function getCurrentApiPresetConfigFromForm() {
    const temperatureValue = Number(document.getElementById('temperature')?.value);

    return {
        url: normalizeBaseApiUrl(document.getElementById('apiUrl')?.value || CONFIG.DEFAULT_API_URL),
        model: document.getElementById('modelName')?.value || CONFIG.DEFAULT_MODEL,
        temperature: Number.isFinite(temperatureValue) ? temperatureValue : 0.7
    };
}

function loadApiPresets() {
    const saved = safeReadStorageJSON(API_PRESETS_STORAGE_KEY, {});
    return saved && typeof saved === 'object' && !Array.isArray(saved) ? saved : {};
}

function saveApiPresets(presets) {
    return safeWriteStorageJSON(API_PRESETS_STORAGE_KEY, presets);
}

function showApiPresetToast(message) {
    if (window.DataManager) {
        DataManager.showToast(message);
    } else {
        alert(message);
    }
}

function renderApiPresetList() {
    const listEl = document.getElementById('apiPresetList');
    if (!listEl) return;

    const presets = loadApiPresets();
    const entries = Object.entries(presets);

    if (entries.length === 0) {
        listEl.innerHTML = `
            <div class="api-preset-empty">
                <div class="api-preset-empty-icon">◇</div>
                <div class="api-preset-empty-title">还没有保存任何配置</div>
                <div class="api-preset-empty-text">在上方输入配置名并点击'保存配置'</div>
            </div>
        `;
        return;
    }

    listEl.innerHTML = entries
        .map(([name, preset]) => {
            const url = preset?.url || preset?.apiUrl || CONFIG.DEFAULT_API_URL;
            const model = preset?.model || preset?.modelName || CONFIG.DEFAULT_MODEL;
            const temperature = preset?.temperature ?? 0.7;
            return `
                <div class="api-preset-item" onclick="applyApiPreset('${encodeURIComponent(name)}')">
                    <div class="api-preset-info">
                        <div class="api-preset-name">${escapeHtml(name)}</div>
                        <div class="api-preset-meta">URL：${escapeHtml(url)}</div>
                        <div class="api-preset-meta">模型：${escapeHtml(model)} · 温度：${escapeHtml(String(temperature))}</div>
                    </div>
                    <button type="button" class="api-preset-delete-btn" onclick="deleteApiPreset(event, '${encodeURIComponent(name)}')">删除</button>
                </div>
            `;
        })
        .join('');
}

function saveApiPreset() {
    const nameInput = document.getElementById('apiPresetName');
    const name = nameInput?.value.trim();

    if (!name) {
        showApiPresetToast('请输入配置名称');
        return;
    }

    const presets = loadApiPresets();
    presets[name] = getCurrentApiPresetConfigFromForm();

    if (!saveApiPresets(presets)) {
        showApiPresetToast('配置保存失败');
        return;
    }

    if (nameInput) nameInput.value = '';
    renderApiPresetList();
    showApiPresetToast('预设配置已保存');
}

function applyApiPreset(encodedName) {
    const name = decodeURIComponent(encodedName);
    const preset = loadApiPresets()[name];
    if (!preset) return;

    const url = preset.url || preset.apiUrl || CONFIG.DEFAULT_API_URL;
    const model = preset.model || preset.modelName || CONFIG.DEFAULT_MODEL;
    const temperature = preset.temperature ?? 0.7;

    document.getElementById('apiUrl').value = normalizeBaseApiUrl(url);
    ensureModelOptionExists(model);
    document.getElementById('modelName').value = model;
    document.getElementById('temperature').value = temperature;
    document.getElementById('tempValue').textContent = temperature;

    showApiPresetToast(`已应用配置：${name}`);
}

function deleteApiPreset(event, encodedName) {
    event.stopPropagation();

    const name = decodeURIComponent(encodedName);
    const presets = loadApiPresets();
    delete presets[name];
    saveApiPresets(presets);
    renderApiPresetList();
    showApiPresetToast('预设配置已删除');
}

function clearApiPresets() {
    const presets = loadApiPresets();
    if (Object.keys(presets).length === 0) return;

    saveApiPresets({});
    renderApiPresetList();
    showApiPresetToast('已清空全部预设配置');
}

function saveAPI() {
    const normalizedApiUrl = normalizeBaseApiUrl(document.getElementById('apiUrl').value);
    const modelName = document.getElementById('modelName').value || CONFIG.DEFAULT_MODEL;

    apiSettings = {
        ...apiSettings,
        apiUrl: normalizedApiUrl,
        modelName: modelName,
        apiKey: document.getElementById('apiKey').value.trim(),
        temperature: parseFloat(document.getElementById('temperature').value) || 0.7,
        enableVision: !!document.getElementById('enableVision')?.checked,
        enableImageGeneration: !!document.getElementById('enableImageGeneration')?.checked,
        imageApiUrl: normalizeImageApiUrl(document.getElementById('imageApiUrl')?.value || CONFIG.DEFAULT_IMAGE_API_URL),
        imageApiKey: document.getElementById('imageApiKey')?.value.trim() || '',
        imageModelName: document.getElementById('imageModelName')?.value.trim() || CONFIG.DEFAULT_IMAGE_MODEL,
        imageSize: document.getElementById('imageSize')?.value || CONFIG.DEFAULT_IMAGE_SIZE,
        minimaxApiUrl: normalizeMinimaxApiUrl(document.getElementById('minimaxApiUrl')?.value || CONFIG.DEFAULT_MINIMAX_API_URL),
        minimaxGroupId: document.getElementById('minimaxGroupId')?.value.trim() || '',
        minimaxApiKey: document.getElementById('minimaxApiKey')?.value.trim() || '',
        minimaxSpeechModel: CONFIG.DEFAULT_MINIMAX_SPEECH_MODEL,
        enableRoleVoiceReply: !!document.getElementById('enableRoleVoiceReply')?.checked,
        roleVoiceReplyProbability: parseFloat(document.getElementById('globalRoleVoiceReplyProbability')?.value) || 0.2
    };
    
    localStorage.setItem('apiSettings', JSON.stringify(apiSettings));
    closeModal('apiModal');
    
    if (window.DataManager) {
        DataManager.showToast('配置已保存');
    }
}

function loadAPISettings() {
    const saved = localStorage.getItem('apiSettings');
    if (saved) {
        apiSettings = JSON.parse(saved);
    }

    apiSettings.apiUrl = normalizeBaseApiUrl(apiSettings.apiUrl || CONFIG.DEFAULT_API_URL);
    apiSettings.modelName = apiSettings.modelName || CONFIG.DEFAULT_MODEL;
    apiSettings.enableVision = !!apiSettings.enableVision;
    apiSettings.temperature = Number.isFinite(Number(apiSettings.temperature)) ? Number(apiSettings.temperature) : 0.7;
    apiSettings.enableImageGeneration = !!apiSettings.enableImageGeneration;
    apiSettings.imageApiUrl = normalizeImageApiUrl(apiSettings.imageApiUrl || CONFIG.DEFAULT_IMAGE_API_URL);
    apiSettings.imageApiKey = apiSettings.imageApiKey || '';
    apiSettings.imageModelName = apiSettings.imageModelName || CONFIG.DEFAULT_IMAGE_MODEL;
    apiSettings.imageSize = apiSettings.imageSize || CONFIG.DEFAULT_IMAGE_SIZE;
    apiSettings.minimaxApiUrl = normalizeMinimaxApiUrl(apiSettings.minimaxApiUrl || CONFIG.DEFAULT_MINIMAX_API_URL);
    apiSettings.minimaxGroupId = apiSettings.minimaxGroupId || '';
    apiSettings.minimaxApiKey = apiSettings.minimaxApiKey || '';
    apiSettings.minimaxSpeechModel = CONFIG.DEFAULT_MINIMAX_SPEECH_MODEL;
    apiSettings.enableRoleVoiceReply = !!apiSettings.enableRoleVoiceReply;
    apiSettings.roleVoiceReplyProbability = Number.isFinite(Number(apiSettings.roleVoiceReplyProbability))
        ? Number(apiSettings.roleVoiceReplyProbability)
        : 0.2;
}

// ================= 壁纸设置 =================
function showWallpaperSettings() {
    document.getElementById('wallpaperModal').classList.add('active');
}

function getHomeWallpaperContainer() {
    return document.getElementById('homeScreen') || document.querySelector('.ios-container');
}

function normalizeSavedWallpaperValue(value, type = '') {
    const rawValue = String(value || '').trim();
    if (!rawValue) return '';

    if (type === 'url' || type === 'image') {
        const withoutFitSuffix = rawValue
            .replace(/\s+center\s*\/\s*cover(?:\s+no-repeat)?\s*$/i, '')
            .replace(/\s+center\s+cover(?:\s+no-repeat)?\s*$/i, '')
            .replace(/\s+no-repeat\s*$/i, '')
            .trim();

        return /^url\(/i.test(withoutFitSuffix) ? withoutFitSuffix : `url('${withoutFitSuffix}')`;
    }

    return rawValue;
}

function applyHomeWallpaper(value, type = '') {
    const container = getHomeWallpaperContainer();
    if (!container) return false;

    const wallpaperValue = normalizeSavedWallpaperValue(value, type);
    if (!wallpaperValue) {
        container.classList.remove('has-wallpaper');
        container.style.removeProperty('--home-wallpaper-bg');
        container.style.removeProperty('--ios-bg');
        container.style.removeProperty('background');
        container.style.removeProperty('background-image');
        container.style.removeProperty('background-size');
        container.style.removeProperty('background-position');
        container.style.removeProperty('background-repeat');
        return true;
    }

    container.classList.add('has-wallpaper');
    container.style.setProperty('--home-wallpaper-bg', wallpaperValue);
    container.style.setProperty('--ios-bg', wallpaperValue);
    container.style.background = wallpaperValue;
    container.style.backgroundImage = wallpaperValue;
    container.style.backgroundSize = 'cover';
    container.style.backgroundPosition = 'center';
    container.style.backgroundRepeat = 'no-repeat';
    return true;
}

function setWallpaper(wallpaper) {
    let savedValue = wallpaper;
    let savedType = 'color';

    if (wallpaper.startsWith('http')) {
        const value = `url('${wallpaper}')`;
        savedValue = value;
        savedType = 'url';
    } else if (wallpaper === 'dark') {
        savedValue = '#000';
        savedType = 'color';
    } else {
        const gradients = {
            'gradient1': 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            'gradient2': 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
            'gradient3': 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)'
        };
        const value = gradients[wallpaper] || gradients.gradient1;
        savedValue = value;
        savedType = 'gradient';
    }

    if (!applyHomeWallpaper(savedValue, savedType)) return;

    localStorage.setItem('wallpaper', savedValue);
    localStorage.setItem('wallpaperType', savedType);
    
    closeModal('wallpaperModal');
}

function removeWallpaper() {
    localStorage.removeItem('wallpaper');
    localStorage.removeItem('wallpaperType');
    applyHomeWallpaper('');
    closeModal('wallpaperModal');
    if (window.DataManager) {
        DataManager.showToast('墙纸已移除');
    }
}

// 加载保存的壁纸
(function loadWallpaper() {
    const saved = localStorage.getItem('wallpaper');
    const type = localStorage.getItem('wallpaperType');

    if (!saved) return;

    applyHomeWallpaper(saved, type);
})();

// ================= 通用函数 =================
function closeModal(modalId) {
    document.getElementById(modalId).classList.remove('active');
}

function formatCurrentClock(now = new Date()) {
    const timeValue = now instanceof Date ? now.getTime() : Number.NaN;
    if (!Number.isFinite(timeValue)) return null;

    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');

    return {
        time: `${hours}:${minutes}`,
        date: `${now.getMonth() + 1}月${now.getDate()}日 ${now.toLocaleDateString('zh-CN', { weekday: 'long' })}`
    };
}

function updateClock() {
    const clock = formatCurrentClock();
    if (!clock) return;

    // 更新状态栏时间
    const statusTime = document.getElementById('statusTime');
    if (statusTime) statusTime.textContent = clock.time;

    // 更新小组件时间（如果有的话）
    const widgetTime = document.getElementById('clock');
    if (widgetTime) widgetTime.textContent = clock.time;

    const homeDate = document.getElementById('homeDate');
    if (homeDate) {
        homeDate.textContent = clock.date;
    }

    // 同步所有应用界面的状态栏时间
    const appStatusTimes = document.querySelectorAll('.app-status-time');
    appStatusTimes.forEach(el => {
        el.textContent = clock.time;
    });
}

function startClockSync() {
    updateClock();

    if (clockIntervalId) {
        clearInterval(clockIntervalId);
    }

    clockIntervalId = setInterval(updateClock, 1000);
}

// 同步所有应用界面的电池电量
function syncAppBatteryLevels(batteryPercent) {
    const appBatteryLevels = document.querySelectorAll('.app-battery-level');
    const pct = Math.max(0, Math.min(100, Number(batteryPercent) || 0));
    const scale = pct / 100;

    appBatteryLevels.forEach(el => {
        el.style.width = '100%'; // 避免之前残留的 width 行内样式
        el.style.transform = `scaleX(${scale})`;
    });
}

// ================= 短信功能 =================
// ================= Doki 桌宠 MVP =================
let homeDokiBubbleTimer = null;
let dokiFeedbackTimer = null;
let dokiAssetManifest = null;
let dokiAssetManifestPromise = null;
const dokiAnimationPlayers = {};
const dokiBlinkTimers = {};

function normalizeDokiFrameList(frames) {
    if (!Array.isArray(frames)) return [];
    return frames
        .map(frame => String(frame || '').trim())
        .filter(frame => frame && !/^data:/i.test(frame));
}

function getDokiManifestBasePath(manifestPath) {
    const normalized = String(manifestPath || '').replace(/\\/g, '/');
    const slashIndex = normalized.lastIndexOf('/');
    return slashIndex >= 0 ? normalized.slice(0, slashIndex + 1) : '';
}

function resolveDokiFramePath(frame, basePath = '') {
    const value = String(frame || '').trim();
    if (!value) return '';
    if (/^(?:https?:)?\/\//i.test(value) || value.startsWith('/') || value.startsWith('assets/')) {
        return value;
    }
    return `${basePath}${value}`.replace(/\/{2,}/g, '/');
}

function normalizeDokiAnimation(animation = {}, basePath = '') {
    const frames = normalizeDokiFrameList(animation.frames)
        .map(frame => resolveDokiFramePath(frame, basePath))
        .filter(Boolean);

    return {
        frames,
        fps: Math.max(1, Math.min(24, Number(animation.fps) || 6)),
        loop: animation.loop !== false
    };
}

function normalizeDokiManifest(rawManifest, manifestPath = '') {
    const basePath = String(rawManifest?.basePath || getDokiManifestBasePath(manifestPath) || '');
    const rawSets = rawManifest?.sets && typeof rawManifest.sets === 'object'
        ? rawManifest.sets
        : {};
    const sets = {};

    Object.entries(rawSets).forEach(([setName, rawSet]) => {
        const animations = rawSet?.animations && typeof rawSet.animations === 'object'
            ? rawSet.animations
            : rawSet;
        if (!animations || typeof animations !== 'object') return;

        const normalizedAnimations = {};
        Object.entries(animations).forEach(([animationName, rawAnimation]) => {
            const normalized = normalizeDokiAnimation(rawAnimation, rawSet?.basePath || basePath);
            if (normalized.frames.length > 0) {
                normalizedAnimations[animationName] = normalized;
            }
        });

        if (Object.keys(normalizedAnimations).length > 0) {
            sets[setName] = {
                name: rawSet?.name || setName,
                animations: normalizedAnimations
        
    };
        }
    });

    const setNames = Object.keys(sets);
    const defaultSet = setNames.includes(rawManifest?.defaultSet)
        ? rawManifest.defaultSet
        : setNames[0] || '';

    return {
        version: Number(rawManifest?.version) || 1,
        defaultSet,
        sets
    };
}

async function loadDokiAssetManifest() {
    if (dokiAssetManifest) return dokiAssetManifest;
    if (dokiAssetManifestPromise) return dokiAssetManifestPromise;

    dokiAssetManifestPromise = (async () => {
        for (const manifestPath of DOKI_ASSET_MANIFEST_PATHS) {
            try {
                const response = await fetch(`${manifestPath}?v=${Date.now()}`, { cache: 'no-store' });
                if (!response.ok) continue;

                const rawManifest = await response.json();
                const normalized = normalizeDokiManifest(rawManifest, manifestPath);
                if (normalized.defaultSet) {
                    dokiAssetManifest = normalized;
                    return dokiAssetManifest;
                }
            } catch (error) {
                console.warn('读取 Doki 素材 manifest 失败:', manifestPath, error);
            }
        }

        dokiAssetManifest = { version: 1, defaultSet: '', sets: {} };
        return dokiAssetManifest;
    })();

    return dokiAssetManifestPromise;
}

function getDokiAnimation(animationName = 'idle') {
    if (!dokiAssetManifest?.defaultSet) return null;

    const set = dokiAssetManifest.sets?.[dokiAssetManifest.defaultSet];
    const animations = set?.animations || {};
    const requested = animations[animationName];
    if (requested?.frames?.length) return requested;

    const fallbackName = DOKI_ANIMATION_FALLBACKS[animationName] || 'idle';
    const fallback = animations[fallbackName];
    return fallback?.frames?.length ? fallback : null;
}

function stopDokiFrameAnimation(targetId) {
    const player = dokiAnimationPlayers[targetId];
    if (player) {
        clearTimeout(player.timer);
        delete dokiAnimationPlayers[targetId];
    }

    const blinkTimer = dokiBlinkTimers[targetId];
    if (blinkTimer) {
        clearTimeout(blinkTimer);
        delete dokiBlinkTimers[targetId];
    }
}

function getDokiFrameImage(targetEl) {
    return targetEl?.querySelector?.('.doki-frame-image') || null;
}

function scheduleDokiBlink(targetId) {
    const blinkAnimation = getDokiAnimation('blink');
    if (!blinkAnimation?.frames?.length) return;

    const delay = 3600 + Math.floor(Math.random() * 2600);
    dokiBlinkTimers[targetId] = setTimeout(() => {
        delete dokiBlinkTimers[targetId];
        const targetEl = document.getElementById(targetId);
        if (!targetEl?.classList.contains('doki-frame-idle')) return;
        playDokiFrameAnimation(targetId, 'blink', {
            loop: false,
            returnToIdle: true,
            holdLastFrameMs: 120,
            actionClass: 'is-action-blink'
        });
    }, delay);
}

function playDokiFrameAnimation(targetId, animationName = 'idle', options = {}) {
    const targetEl = document.getElementById(targetId);
    const imageEl = getDokiFrameImage(targetEl);
    const animation = getDokiAnimation(animationName);

    stopDokiFrameAnimation(targetId);

    if (!targetEl || !imageEl || !animation?.frames?.length) {
        targetEl?.classList.remove('has-frame');
        targetEl?.classList.remove('doki-frame-idle');
        targetEl?.classList.remove('is-action-pet', 'is-action-eat', 'is-action-blink');
        return false;
    }

    const frames = animation.frames;
    const actionClass = options.actionClass ? String(options.actionClass) : '';
    const shouldUseActionClass = !!actionClass;
    const fps = Math.max(1, Number(animation.fps) || 6);
    const frameDelay = Math.round(1000 / fps);
    const loop = options.loop ?? animation.loop;
    const returnToIdle = !!options.returnToIdle;
    const holdLastFrameMs = Math.max(0, Number(options.holdLastFrameMs || 0));
    let frameIndex = 0;

    targetEl.classList.add('has-frame');
    targetEl.classList.toggle('doki-frame-idle', animationName === 'idle');
    targetEl.classList.remove('is-action-pet', 'is-action-eat', 'is-action-blink');
    if (shouldUseActionClass) {
        targetEl.classList.add(actionClass);
    }
    imageEl.src = frames[0];

    const finishAnimation = () => {
        if (shouldUseActionClass) {
            targetEl.classList.remove(actionClass);
        }
        if (returnToIdle) {
            if (holdLastFrameMs > 0) {
                dokiAnimationPlayers[targetId] = {
                    timer: setTimeout(() => {
                        delete dokiAnimationPlayers[targetId];
                        playDokiFrameAnimation(targetId, 'idle', { loop: true });
                    }, holdLastFrameMs)
            
    };
            } else {
                playDokiFrameAnimation(targetId, 'idle', { loop: true });
            }
        }
    };

    const tick = () => {
        frameIndex += 1;
        if (frameIndex >= frames.length) {
            if (loop) {
                frameIndex = 0;
            } else {
                delete dokiAnimationPlayers[targetId];
                finishAnimation();
                return;
            }
        }

        imageEl.src = frames[frameIndex];
        dokiAnimationPlayers[targetId] = {
            timer: setTimeout(tick, frameDelay)
        };
    };

    if (frames.length > 1) {
        dokiAnimationPlayers[targetId] = {
            timer: setTimeout(tick, frameDelay)
        };
    } else if (!loop && returnToIdle) {
        const singleFrameDuration = Math.max(frameDelay, holdLastFrameMs || frameDelay);
        dokiAnimationPlayers[targetId] = {
            timer: setTimeout(() => {
                delete dokiAnimationPlayers[targetId];
                finishAnimation();
            }, singleFrameDuration)
        };
    }

    if (animationName === 'idle') {
        scheduleDokiBlink(targetId);
    }

    return true;
}

function refreshDokiFrameAnimations() {
    playDokiFrameAnimation('homeDokiPet', 'idle', { loop: true });
    playDokiFrameAnimation('dokiAdoptPreview', 'idle', { loop: true });
    playDokiFrameAnimation('dokiAppPet', 'idle', { loop: true });
}

function initDokiAssets() {
    loadDokiAssetManifest().then(refreshDokiFrameAnimations);
}

function buildDokiCatFramePrompt({ actionName = 'idle', frameIndex = 1, totalFrames = 4 } = {}) {
    const actionNotes = {
        idle: 'gentle idle breathing pose, tiny body squash and stretch, looking forward',
        pet: 'being gently petted, happy closed eyes, soft blush, delighted expression',
        eat: 'eating from a tiny food bowl, cute focused face, small paws near bowl',
        play: 'playing with a small pink yarn ball, lively pose, bright curious eyes',
        sleep: 'sleeping on a small cushion, relaxed face, curled tail, tiny Z marks',
        blink: 'front-facing blink pose, eyelids gradually closing or opening'
    };
    const actionNote = actionNotes[actionName] || actionNotes.idle;

    return [
        'Use case: stylized-concept',
        'Asset type: Doki virtual pet animation frame',
        `Primary request: create frame ${frameIndex} of ${totalFrames} for the "${actionName}" animation.`,
        'Reference style: follow the provided 小团子 kitten reference closely for character design, proportions, plush 3D rendering, cream and beige tabby markings, glossy eyes, blush, tiny mouth, bell collar, and warm off-white app presentation.',
        'Subject: one adorable chibi kitten mascot, round plush head, cream and light beige tabby fur, oversized glossy brown eyes, tiny pink nose, rosy cheeks, small bell collar, soft rounded paws.',
        `Pose/action: ${actionNote}. Keep this as a subtle animation keyframe, with only small pose changes between frames.`,
        'Style/medium: polished kawaii 3D illustration, soft toy-like fur, warm gentle shading, mobile app mascot asset.',
        'Composition/framing: single centered full-body kitten, front or slight 3/4 view, generous padding, consistent scale and camera across frames.',
        'Scene/backdrop: clean warm off-white background matching a soft mobile app pet screen, no visible room or props unless required by the action.',
        'Color palette: warm cream, beige tabby stripes, peach blush, small gold bell.',
        'Constraints: no text, no watermark, no border, no extra characters, no cropped body parts, avoid hard shadows and busy background details.'
    ].join('\n');
}

async function generateDokiFrameAsset({
    setName = 'soft-cat',
    actionName = 'idle',
    frameIndex = 1,
    totalFrames = 4,
    fps = 6,
    prompt = '',
    referenceImageDataUrl = ''
} = {}) {
    if (!apiSettings.enableImageGeneration) {
        throw new Error('请先在设置中启用图片生成');
    }

    const configuredImageApiKey = String(apiSettings.imageApiKey || '').trim();
    const payload = {
        setName,
        actionName,
        frameIndex,
        fps,
        model: apiSettings.imageModelName || CONFIG.DEFAULT_IMAGE_MODEL,
        size: apiSettings.imageSize || CONFIG.DEFAULT_IMAGE_SIZE,
        baseUrl: normalizeImageApiUrl(apiSettings.imageApiUrl || CONFIG.DEFAULT_IMAGE_API_URL),
        prompt: prompt || buildDokiCatFramePrompt({ actionName, frameIndex, totalFrames })
    };

    if (referenceImageDataUrl) {
        payload.referenceImageDataUrl = referenceImageDataUrl;
    }

    if (configuredImageApiKey) {
        payload.imageApiKey = configuredImageApiKey;
        payload.apiKey = configuredImageApiKey;
    }

    const response = await fetch(resolveDokiFrameGenerationUrl(), {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
    });
    let data = null;
    try {
        data = await response.json();
    } catch (error) {
        data = null;
    }

    if (!response.ok) {
        throw new Error(extractErrorMessage(data, `Doki 帧生成失败（HTTP ${response.status}）`));
    }

    dokiAssetManifest = data?.manifest ? normalizeDokiManifest(data.manifest, 'assets/doki/generated/manifest.json') : null;
    dokiAssetManifestPromise = null;
    refreshDokiFrameAnimations();

    return data;
}

async function generateDefaultDokiCatAssets(options = {}) {
    const plan = [
        ['idle', 4, 6],
        ['pet', 5, 7],
        ['eat', 5, 7],
        ['play', 6, 8],
        ['sleep', 4, 5]
    ];
    const results = [];

    for (const [actionName, totalFrames, fps] of plan) {
        for (let frameIndex = 1; frameIndex <= totalFrames; frameIndex += 1) {
            const result = await generateDokiFrameAsset({
                setName: 'soft-cat',
                actionName,
                frameIndex,
                totalFrames,
                fps,
                referenceImageDataUrl: options.referenceImageDataUrl || ''
            });
            results.push(result);
        }
    }

    if (window.DataManager) {
        DataManager.showToast('Doki 小猫素材已保存到 assets/doki/generated');
    }
    return results;
}

window.generateDokiFrameAsset = generateDokiFrameAsset;
window.generateDefaultDokiCatAssets = generateDefaultDokiCatAssets;

function clampDokiValue(value) {
    return Math.max(0, Math.min(100, Number(value) || 0));
}

function getDokiDarkColor(color) {
    const normalized = String(color || DOKI_DEFAULT_COLOR).toLowerCase();
    return DOKI_COLOR_DARK_MAP[normalized] || '#C88455';
}

function getDokiLightColor(color) {
    const normalized = String(color || DOKI_DEFAULT_COLOR).toLowerCase();
    return DOKI_COLOR_LIGHT_MAP[normalized] || '#F2C39A';
}

function normalizeDokiColor(color) {
    const normalized = String(color || DOKI_DEFAULT_COLOR).toLowerCase();
    return DOKI_ALLOWED_COLORS.find(allowed => allowed.toLowerCase() === normalized) || DOKI_DEFAULT_COLOR;
}

function applyDokiColor(target, color) {
    if (!target) return;

    const pet = target.classList?.contains('doki-pixel') || target.classList?.contains('doki-icon-pet')
        ? target
        : target.querySelector?.('.doki-pixel, .doki-icon-pet');
    if (!pet) return;

    const safeColor = normalizeDokiColor(color);
    pet.style.setProperty('--pet-color', safeColor);
    pet.style.setProperty('--pet-dark', getDokiDarkColor(safeColor));
    pet.style.setProperty('--pet-light', getDokiLightColor(safeColor));
}

function getDefaultDokiState() {
    return {
        adopted: false,
        name: 'Doki',
        color: DOKI_DEFAULT_COLOR,
        personality: '安静',
        stats: {
            hunger: 60,
            mood: 60,
            energy: 60,
            intimacy: 0,
            level: 1
        },
        inventory: {
            foods: []
        }
    };
}

function normalizeDokiState(rawState) {
    const base = getDefaultDokiState();
    const stats = rawState?.stats || {};
    const intimacy = Math.max(0, Number(stats.intimacy) || 0);

    return {
        ...base,
        ...rawState,
        name: String(rawState?.name || base.name).trim().slice(0, 12) || base.name,
        color: normalizeDokiColor(rawState?.color || base.color),
        personality: String(rawState?.personality || base.personality),
        stats: {
            hunger: clampDokiValue(stats.hunger ?? base.stats.hunger),
            mood: clampDokiValue(stats.mood ?? base.stats.mood),
            energy: clampDokiValue(stats.energy ?? base.stats.energy),
            intimacy,
            level: Math.max(1, Math.floor(intimacy / 100) + 1)
        },
        inventory: {
            foods: Array.isArray(rawState?.inventory?.foods) ? rawState.inventory.foods : []
        }
    };
}

function loadDokiState() {
    try {
        const saved = localStorage.getItem(DOKI_STORAGE_KEY);
        return normalizeDokiState(saved ? JSON.parse(saved) : getDefaultDokiState());
    } catch (error) {
        console.warn('读取 Doki 数据失败:', error);
        return getDefaultDokiState();
    }
}

function saveDokiState(nextState) {
    const normalized = normalizeDokiState(nextState);
    localStorage.setItem(DOKI_STORAGE_KEY, JSON.stringify(normalized));
    return normalized;
}

function updateHomeDoki() {
    const state = loadDokiState();
    const nameEl = document.getElementById('homeDokiName');
    const petEl = document.getElementById('homeDokiPet');
    const iconPet = document.querySelector('.doki-icon-pet');

    if (nameEl) nameEl.textContent = state.adopted ? state.name : 'Doki';
    applyDokiColor(petEl, state.color);
    playDokiFrameAnimation('homeDokiPet', 'idle', { loop: true });
    if (iconPet) {
        const safeColor = normalizeDokiColor(state.color);
        iconPet.style.background = safeColor;
        iconPet.style.setProperty('--pet-color', safeColor);
        iconPet.style.setProperty('--pet-dark', getDokiDarkColor(safeColor));
    }
}

function showHomeDokiBubble(event) {
    if (event) {
        event.preventDefault();
        event.stopPropagation();
    }

    const bubble = document.getElementById('homeDokiBubble');
    const pet = document.getElementById('homeDokiPet');
    if (!bubble) return;

    bubble.textContent = DOKI_HOME_LINES[Math.floor(Math.random() * DOKI_HOME_LINES.length)];
    bubble.classList.add('is-visible');
    const usedFrameAnimation = playDokiFrameAnimation('homeDokiPet', 'pet', {
        loop: false,
        returnToIdle: true,
        holdLastFrameMs: 900,
        actionClass: 'is-action-pet'
    });
    if (!usedFrameAnimation) {
        triggerDokiReact(pet);
    }

    clearTimeout(homeDokiBubbleTimer);
    homeDokiBubbleTimer = setTimeout(() => {
        bubble.classList.remove('is-visible');
    }, 2000);
}

function previewDokiAdoption() {
    const color = document.getElementById('dokiColorInput')?.value || DOKI_DEFAULT_COLOR;
    applyDokiColor(document.getElementById('dokiAdoptPreview'), color);
    playDokiFrameAnimation('dokiAdoptPreview', 'idle', { loop: true });
}

function adoptDoki() {
    const nameInput = document.getElementById('dokiNameInput');
    const colorInput = document.getElementById('dokiColorInput');
    const personalityInput = document.getElementById('dokiPersonalityInput');
    const nextState = saveDokiState({
        ...getDefaultDokiState(),
        adopted: true,
        name: String(nameInput?.value || 'Doki').trim() || 'Doki',
        color: colorInput?.value || DOKI_DEFAULT_COLOR,
        personality: personalityInput?.value || '安静'
    });

    updateHomeDoki();
    renderDokiApp(nextState);
}

function renderDokiApp(state = loadDokiState()) {
    const adoptView = document.getElementById('dokiAdoptView');
    const statusView = document.getElementById('dokiStatusView');
    if (!adoptView || !statusView) return;

    const normalized = normalizeDokiState(state);
    adoptView.hidden = normalized.adopted;
    statusView.hidden = !normalized.adopted;

    const colorInput = document.getElementById('dokiColorInput');
    if (colorInput && !normalized.adopted) {
        colorInput.value = normalized.color || DOKI_DEFAULT_COLOR;
        previewDokiAdoption();
    }

    applyDokiColor(document.getElementById('dokiAppPet'), normalized.color);
    playDokiFrameAnimation('dokiAppPet', 'idle', { loop: true });

    if (!normalized.adopted) return;

    const nameEl = document.getElementById('dokiStatusName');
    const metaEl = document.getElementById('dokiStatusMeta');
    const badgeEl = document.getElementById('dokiIntimacyBadge');
    const barsEl = document.getElementById('dokiBars');

    if (nameEl) nameEl.textContent = normalized.name;
    if (metaEl) metaEl.textContent = `${normalized.personality} · Lv.${normalized.stats.level}`;
    if (badgeEl) badgeEl.textContent = `亲密度 ${normalized.stats.intimacy}`;

    if (barsEl) {
        const stats = [
            ['饱腹值', normalized.stats.hunger],
            ['心情值', normalized.stats.mood],
            ['精力值', normalized.stats.energy]
        ];
        barsEl.innerHTML = stats.map(([label, value]) => `
            <div class="doki-stat">
                <span>${label}</span>
                <div class="doki-stat-track">
                    <div class="doki-stat-fill" style="width: ${value}%"></div>
                </div>
                <strong>${value}</strong>
            </div>
        `).join('');
    }
}

function triggerDokiReact(petEl) {
    if (!petEl) return;

    petEl.classList.remove('is-reacting');
    void petEl.offsetWidth;
    petEl.classList.add('is-reacting');
    setTimeout(() => petEl.classList.remove('is-reacting'), 480);
}

function showDokiFeedback(text) {
    const feedback = document.getElementById('dokiFeedback');
    if (!feedback) return;

    feedback.textContent = text;
    feedback.classList.add('is-visible');
    clearTimeout(dokiFeedbackTimer);
    dokiFeedbackTimer = setTimeout(() => {
        feedback.classList.remove('is-visible');
    }, 1200);
}

function interactWithDoki(action) {
    const state = loadDokiState();
    if (!state.adopted) return;

    const stats = { ...state.stats };
    let feedback = '';

    if (action === 'feed') {
        stats.hunger = clampDokiValue(stats.hunger + 10);
        stats.intimacy += 3;
        feedback = '饱腹 +10';
    } else if (action === 'pet') {
        stats.mood = clampDokiValue(stats.mood + 8);
        stats.intimacy += 4;
        feedback = '心情 +8';
    } else if (action === 'play') {
        stats.mood = clampDokiValue(stats.mood + 10);
        stats.energy = clampDokiValue(stats.energy - 8);
        stats.intimacy += 5;
        feedback = '心情 +10 / 精力 -8';
    } else if (action === 'rest') {
        stats.energy = clampDokiValue(stats.energy + 12);
        stats.intimacy += 2;
        feedback = '精力 +12';
    }

    stats.level = Math.max(1, Math.floor(stats.intimacy / 100) + 1);
    const nextState = saveDokiState({ ...state, stats });

    renderDokiApp(nextState);
    updateHomeDoki();
    const animationName = DOKI_ACTION_ANIMATION_MAP[action] || 'idle';
    const usedFrameAnimation = playDokiFrameAnimation('dokiAppPet', animationName, {
        loop: false,
        returnToIdle: true,
        holdLastFrameMs: action === 'feed' ? 900 : (action === 'pet' ? 900 : 360),
        actionClass: action === 'pet' ? 'is-action-pet' : ''
    });
    if (!usedFrameAnimation) {
        triggerDokiReact(document.getElementById('dokiAppPet'));
    }
    showDokiFeedback(feedback);
}

function newMessage() {
    const num = prompt('输入号码:');
    if (num) {
        alert(`将创建与 ${num} 的对话`);
    }
}

// ================= 备忘录功能 =================
let notes = [];
let filteredNotesQuery = '';
let activeNoteId = null;
let noteSaveFeedbackTimer = null;

function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function inferNoteCategory(title, content) {
    const text = `${title} ${content}`;
    if (/清单|todo|待办|采购|check/i.test(text)) return '清单';
    if (/计划|安排|日程|meeting|项目/i.test(text)) return '计划';
    if (/学习|笔记|复盘|课程|读书/i.test(text)) return '学习';
    return '备忘';
}

function normalizeNoteRecord(note, index = 0) {
    const title = String(note?.title || '').trim() || `未命名备忘录 ${index + 1}`;
    const content = String(note?.content || '');
    return {
        id: note?.id || Date.now() + index,
        title,
        content,
        date: String(note?.date || new Date().toLocaleDateString('zh-CN')),
        category: String(note?.category || inferNoteCategory(title, content))
    };
}

function getNoteSnippet(content) {
    const normalized = String(content || '').replace(/\s+/g, ' ').trim();
    return normalized || '暂无内容';
}

function ensureNotesScaffold() {
    const notesApp = document.getElementById('app-notes');
    const container = document.getElementById('notesContainer');
    if (!notesApp || !container) return null;

    let page = document.getElementById('notesPage');
    if (!page) {
        page = document.createElement('div');
        page.className = 'notes-shell';
        page.id = 'notesPage';
        container.parentNode.insertBefore(page, container);
        page.appendChild(container);
    }
    page.className = 'notes-shell';

    if (!document.getElementById('notesSearchInput')) {
        const searchShell = document.createElement('div');
        searchShell.className = 'notes-search-shell';
        searchShell.innerHTML = `
            <label class="notes-search-bar" for="notesSearchInput">
                <span class="notes-search-icon" aria-hidden="true">
                    <svg viewBox="0 0 24 24">
                        <circle cx="11" cy="11" r="6.5" fill="none" stroke="currentColor" stroke-width="1.8"></circle>
                        <path d="m16 16 4 4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"></path>
                    </svg>
                </span>
                <input type="search" id="notesSearchInput" placeholder="搜索备忘录" oninput="filterNotes(this.value)">
            </label>
        `;
        page.insertBefore(searchShell, container);
    }

    let detailShell = document.getElementById('noteDetailShell');
    if (!detailShell) {
        detailShell = document.createElement('div');
        detailShell.className = 'note-detail-shell';
        detailShell.id = 'noteDetailShell';
        detailShell.style.display = 'none';
        page.appendChild(detailShell);
    }

    return { container, detailShell };
}

function loadNotes() {
    const saved = localStorage.getItem('notes');
    if (saved) {
        try {
            notes = JSON.parse(saved).map((note, index) => normalizeNoteRecord(note, index));
        } catch (error) {
            notes = [];
        }
    }
    renderNotes();
}

function saveNotes() {
    localStorage.setItem('notes', JSON.stringify(notes));
}

function createNote() {
    const note = {
        id: Date.now(),
        title: `新备忘录 ${notes.length + 1}`,
        content: '',
        date: new Date().toLocaleDateString('zh-CN'),
        category: '备忘'
    };

    notes.unshift(note);
    saveNotes();
    renderNotes();
    editNoteById(note.id);
}

function renderNotes() {
    const scaffold = ensureNotesScaffold();
    if (!scaffold) return;

    const { container } = scaffold;
    const query = filteredNotesQuery.trim().toLowerCase();
    const visibleNotes = notes.filter((note) => {
        if (!query) return true;
        return `${note.title} ${note.content} ${note.category}`.toLowerCase().includes(query);
    });

    if (visibleNotes.length === 0) {
        container.innerHTML = `<div class="notes-empty">${query ? '没有找到匹配的备忘录' : '还没有备忘录，点击右上角创建一条吧。'}</div>`;
        return;
    }

    container.innerHTML = `<div class="notes-list">${visibleNotes.map((note) => `
        <div class="note-card" onclick="editNoteById(${note.id})">
            <div class="note-card-meta">
                <span class="note-tag">${escapeHtml(note.category)}</span>
                <div class="note-date">${escapeHtml(note.date)}</div>
            </div>
            <div class="note-title">${escapeHtml(note.title)}</div>
            <div class="note-snippet">${escapeHtml(getNoteSnippet(note.content))}</div>
        </div>
    `).join('')}</div>`;
}

function editNote(index) {
    const note = notes[index];
    if (!note) return;
    editNoteById(note.id);
}

function editNoteById(noteId) {
    const scaffold = ensureNotesScaffold();
    const note = notes.find((item) => String(item.id) === String(noteId));
    if (!scaffold || !note) return;

    if (noteSaveFeedbackTimer) {
        clearTimeout(noteSaveFeedbackTimer);
        noteSaveFeedbackTimer = null;
    }

    const { container, detailShell } = scaffold;
    activeNoteId = note.id;
    container.style.display = 'none';
    detailShell.style.display = 'block';
    detailShell.innerHTML = `
        <div class="note-detail-card">
            <div class="note-detail-top">
                <button class="note-detail-back" type="button" onclick="closeNoteDetail()">‹</button>
                <div class="note-detail-actions">
                    <button class="note-detail-action" id="noteDetailSaveButton" type="button" onclick="saveActiveNote()">保存</button>
                    <div class="note-detail-menu-wrap">
                        <button
                            class="note-detail-action note-detail-more"
                            id="noteDetailMoreButton"
                            type="button"
                            aria-label="更多操作"
                            onclick="toggleNoteActionsMenu(event)"
                        >···</button>
                        <div class="note-detail-menu" id="noteDetailActionsMenu" onclick="event.stopPropagation()">
                            <button class="note-detail-menu-item note-detail-menu-item-danger" type="button" onclick="openNoteDeleteConfirm()">删除备忘录</button>
                        </div>
                    </div>
                </div>
            </div>
            <input class="note-detail-title" id="noteDetailTitle" value="${escapeHtml(note.title)}" placeholder="标题">
            <div class="note-detail-meta">
                <span class="note-tag" id="noteDetailTag">${escapeHtml(note.category)}</span>
                <span class="note-date" id="noteDetailDate">${escapeHtml(note.date)}</span>
            </div>
            <textarea class="note-detail-body" id="noteDetailBody" placeholder="开始记录内容...">${escapeHtml(note.content)}</textarea>
        </div>
        <div class="note-delete-confirm" id="noteDeleteConfirm" onclick="if (event.target === this) closeNoteDeleteConfirm()">
            <div class="note-delete-confirm-card" onclick="event.stopPropagation()">
                <div class="note-delete-confirm-title">确认删除</div>
                <div class="note-delete-confirm-text">删除后无法恢复</div>
                <div class="note-delete-confirm-actions">
                    <button class="note-delete-confirm-btn" type="button" onclick="closeNoteDeleteConfirm()">取消</button>
                    <button class="note-delete-confirm-btn note-delete-confirm-btn-danger" type="button" onclick="deleteActiveNote()">删除</button>
                </div>
            </div>
        </div>
    `;
    detailShell.onclick = (event) => {
        if (!event.target.closest('.note-detail-menu-wrap')) {
            closeNoteActionsMenu();
        }
    };
}

function toggleNoteActionsMenu(event) {
    if (event) {
        event.stopPropagation();
    }

    closeNoteDeleteConfirm();
    const menu = document.getElementById('noteDetailActionsMenu');
    if (!menu) return;
    menu.classList.toggle('is-open');
}

function closeNoteActionsMenu() {
    const menu = document.getElementById('noteDetailActionsMenu');
    if (menu) {
        menu.classList.remove('is-open');
    }
}

function openNoteDeleteConfirm() {
    closeNoteActionsMenu();
    const confirmLayer = document.getElementById('noteDeleteConfirm');
    if (confirmLayer) {
        confirmLayer.classList.add('is-open');
    }
}

function closeNoteDeleteConfirm() {
    const confirmLayer = document.getElementById('noteDeleteConfirm');
    if (confirmLayer) {
        confirmLayer.classList.remove('is-open');
    }
}

function closeNoteDetail() {
    const container = document.getElementById('notesContainer');
    const detailShell = document.getElementById('noteDetailShell');
    if (noteSaveFeedbackTimer) {
        clearTimeout(noteSaveFeedbackTimer);
        noteSaveFeedbackTimer = null;
    }
    closeNoteActionsMenu();
    closeNoteDeleteConfirm();
    if (container) container.style.display = '';
    if (detailShell) {
        detailShell.onclick = null;
        detailShell.style.display = 'none';
        detailShell.innerHTML = '';
    }
    activeNoteId = null;
}

function saveActiveNote() {
    if (activeNoteId === null) return;
    const note = notes.find((item) => String(item.id) === String(activeNoteId));
    if (!note) return;

    const titleInput = document.getElementById('noteDetailTitle');
    const bodyInput = document.getElementById('noteDetailBody');
    const dateNode = document.getElementById('noteDetailDate');
    const tagNode = document.getElementById('noteDetailTag');
    const saveButton = document.getElementById('noteDetailSaveButton');
    note.title = (titleInput?.value || '').trim() || '未命名备忘录';
    note.content = bodyInput?.value || '';
    note.category = inferNoteCategory(note.title, note.content);
    note.date = new Date().toLocaleDateString('zh-CN');

    if (titleInput) titleInput.value = note.title;
    if (dateNode) dateNode.textContent = note.date;
    if (tagNode) tagNode.textContent = note.category;

    saveNotes();
    renderNotes();
    closeNoteActionsMenu();

    if (saveButton) {
        saveButton.textContent = '已保存';
        saveButton.classList.add('is-saved');
        clearTimeout(noteSaveFeedbackTimer);
        noteSaveFeedbackTimer = setTimeout(() => {
            const currentButton = document.getElementById('noteDetailSaveButton');
            if (currentButton) {
                currentButton.textContent = '保存';
                currentButton.classList.remove('is-saved');
            }
            noteSaveFeedbackTimer = null;
        }, 1100);
    }
}

function deleteActiveNote() {
    if (activeNoteId === null) return;

    const noteIndex = notes.findIndex((item) => String(item.id) === String(activeNoteId));
    if (noteIndex === -1) return;

    notes.splice(noteIndex, 1);
    saveNotes();
    closeNoteDeleteConfirm();
    closeNoteActionsMenu();
    closeNoteDetail();
    renderNotes();

    if (window.DataManager && typeof DataManager.showToast === 'function') {
        DataManager.showToast('备忘录已删除');
    }
}

function filterNotes(query) {
    filteredNotesQuery = String(query || '');
    closeNoteDetail();
    renderNotes();
}

// ================= 音乐控制 =================
const MUSIC_LIBRARY_STORAGE_KEY = 'musicLibrary';
const MUSIC_HIDDEN_DEMO_SONGS_STORAGE_KEY = 'musicHiddenDemoSongs';
const MUSIC_PLAYBACK_MODE_STORAGE_KEY = 'musicPlaybackMode';
const MUSIC_LISTENING_PROFILE_STORAGE_KEY = 'musicListeningProfile';
const MUSIC_DB_NAME = 'musicLibraryDB';
const MUSIC_DB_VERSION = 1;
const MUSIC_FILE_STORE_NAME = 'files';
const MUSIC_SUPPORTED_EXTENSIONS = ['mp3', 'wav', 'ogg', 'm4a', 'aac', 'flac'];
const MUSIC_PLAYBACK_MODES = ['sequence', 'single', 'shuffle', 'heart'];
const MUSIC_GENRE_RULES = [
    { tag: 'pop', label: '\u6d41\u884c', keywords: ['pop', '\u6d41\u884c', '\u5c0f\u60c5\u6b4c', '\u60c5\u6b4c', '\u70ed\u6b4c'] },
    { tag: 'rock', label: '\u6447\u6eda', keywords: ['rock', '\u6447\u6eda', 'band', '\u4e50\u961f', 'guitar', '\u5409\u4ed6'] },
    { tag: 'hiphop', label: 'Hip-Hop', keywords: ['hiphop', 'hip-hop', 'rap', '\u8bf4\u5531', '\u563b\u54c8', 'rapper'] },
    { tag: 'electronic', label: '\u7535\u5b50', keywords: ['edm', 'electronic', '\u7535\u5b50', 'dj', 'remix', 'mix', '\u821e\u66f2'] },
    { tag: 'folk', label: '\u6c11\u8c23', keywords: ['folk', '\u6c11\u8c23', '\u6728\u5409\u4ed6', '\u6c11\u6b4c'] },
    { tag: 'rnb', label: 'R&B', keywords: ['r&b', 'rnb', 'soul', '\u84dd\u8c03', '\u7075\u9b42'] },
    { tag: 'jazz', label: '\u7235\u58eb', keywords: ['jazz', '\u7235\u58eb', 'swing', 'blues'] },
    { tag: 'classical', label: '\u53e4\u5178', keywords: ['classical', '\u53e4\u5178', 'piano', '\u94a2\u7434', 'violin', '\u5c0f\u63d0\u7434', 'concerto'] },
    { tag: 'acg', label: 'ACG', keywords: ['acg', 'anime', '\u52a8\u753b', '\u52a8\u6f2b', '\u756a', 'vocaloid', '\u521d\u97f3', '\u6e38\u620f'] },
    { tag: 'lofi', label: 'Lo-fi', keywords: ['lofi', 'lo-fi', '\u6c1b\u56f4', '\u6cbb\u6108', '\u7761\u7720', '\u767d\u566a\u97f3'] },
    { tag: 'citypop', label: 'City Pop', keywords: ['city pop', 'citypop', '\u90fd\u5e02', '\u590f\u65e5', '\u590d\u53e4'] },
    { tag: 'ballad', label: '\u6292\u60c5', keywords: ['ballad', '\u6292\u60c5', '\u6162\u6b4c', '\u6e29\u67d4', '\u6cbb\u6108'] }
];
const MUSIC_MODE_META = {
    sequence: {
        label: '\u987a\u5e8f\u64ad\u653e',
        toast: '\u5df2\u5207\u6362\u5230\u987a\u5e8f\u64ad\u653e',
        icon: '<svg class="music-control-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 7h10"></path><path d="M5 12h14"></path><path d="M5 17h10"></path><path d="m16 15 2 2-2 2"></path></svg>'
    },
    single: {
        label: '\u5355\u66f2\u5faa\u73af',
        toast: '\u5df2\u5207\u6362\u5230\u5355\u66f2\u5faa\u73af',
        icon: '<svg class="music-control-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M17 4l3 3-3 3"></path><path d="M4 11V9.6A2.6 2.6 0 0 1 6.6 7H20"></path><path d="M7 20l-3-3 3-3"></path><path d="M20 13v1.4A2.6 2.6 0 0 1 17.4 17H4"></path><path d="M12 10.5v5"></path></svg>'
    },
    shuffle: {
        label: '\u968f\u673a\u64ad\u653e',
        toast: '\u5df2\u5207\u6362\u5230\u968f\u673a\u64ad\u653e',
        icon: '<svg class="music-control-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h2.6c2.5 0 3.5 2 4.7 5s2.2 5 4.7 5H20"></path><path d="m17 14 3 3-3 3"></path><path d="M4 17h2.6c1.5 0 2.5-.7 3.3-1.8"></path><path d="M14.1 8.8c.6-1.1 1.2-1.8 2.2-1.8H20"></path><path d="m17 4 3 3-3 3"></path></svg>'
    },
    heart: {
        label: '\u5fc3\u52a8\u6a21\u5f0f',
        toast: '\u5df2\u5207\u6362\u5230\u5fc3\u52a8\u6a21\u5f0f',
        icon: '<svg class="music-control-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20s-7-4.4-8.8-9.2C2.1 7.7 3.8 5 6.8 5c1.8 0 3.2 1 4 2.2C11.6 6 13 5 14.8 5c3 0 4.7 2.7 3.6 5.8C16.6 15.6 12 20 12 20Z"></path><path d="M15.5 9.6c.4.7.3 1.5-.1 2.3"></path></svg>'
    }
};

const DEFAULT_MUSIC_SONGS = [
    {
        id: 'song_1',
        title: '示例歌曲',
        artist: '未知歌手',
        duration: 210,
        cover: '',
        url: '',
        lyric: '愿今天有一首歌，刚好落在心上。'
    },
    {
        id: 'song_2',
        title: '午后红茶',
        artist: '本地音乐人',
        duration: 188,
        cover: '',
        url: '',
        lyric: '把节拍放轻，让下午慢一点。'
    },
    {
        id: 'song_3',
        title: '白色耳机',
        artist: '示例乐队',
        duration: 236,
        cover: '',
        url: '',
        lyric: '旋律绕过街角，落进耳机里。'
    },
    {
        id: 'song_4',
        title: '晚风播放中',
        artist: '匿名歌手',
        duration: 254,
        cover: '',
        url: '',
        lyric: '城市暗下来，歌还亮着。'
    }
];

let musicLibrary = [];
let songs = [...DEFAULT_MUSIC_SONGS];
let hiddenDemoMusicSongIds = new Set();
let musicListeningProfile = { songs: {} };

const musicState = {
    currentIndex: 0,
    isPlaying: false,
    currentTime: 0,
    mode: 'sequence',
    timerId: null,
    page: 'home',
    audioBound: false,
    audioSourceToken: 0,
    activeAudioSongId: '',
    activeAudioSrc: '',
    audioRetrying: false,
    objectUrl: '',
    objectUrlSongId: '',
    menuSongId: '',
    apiOrigin: '',
    linkImportLoading: false,
    lyricLoadingSongId: '',
    coverLoadingSongId: '',
    searchImportLoading: false,
    searchAddingId: '',
    searchResults: [],
    uidImportLoading: false,
    uidImporting: false,
    uidPlaylists: [],
    selectedPlaylistIds: new Set(),
    progressDragging: false,
    progressDragPercent: 0,
    multiSelectMode: false,
    selectedSongIds: new Set(),
    playSessionSongId: '',
    statsSongId: '',
    statsTime: 0,
    statsSaveAt: 0,
    heartLoading: false,
    heartQueue: [],
    heartLastSeedKey: '',
    playHistory: [],
    forwardHistory: [],
    switchingPlayback: false,
    resumeAfterSwitch: false,
    suppressPauseUntil: 0,
    autoResumeSongId: ''
};

function showMusicToast(message, options = {}) {
    if (typeof showToast === 'function') {
        showToast(message, options);
        return;
    }

    if (window.DataManager && typeof DataManager.showToast === 'function') {
        DataManager.showToast(message);
    }
}

function normalizeMusicPlaybackMode(mode) {
    const value = String(mode || '').trim();
    if (value === 'loop') return 'sequence';
    return MUSIC_PLAYBACK_MODES.includes(value) ? value : 'sequence';
}

function loadMusicPlaybackMode() {
    try {
        musicState.mode = normalizeMusicPlaybackMode(localStorage.getItem(MUSIC_PLAYBACK_MODE_STORAGE_KEY));
    } catch (error) {
        musicState.mode = 'sequence';
    }
}

function saveMusicPlaybackMode() {
    localStorage.setItem(MUSIC_PLAYBACK_MODE_STORAGE_KEY, musicState.mode);
}

function normalizeMusicListeningProfile(value) {
    const rawSongs = value && typeof value === 'object' && value.songs && typeof value.songs === 'object'
        ? value.songs
        : {};
    const normalizedSongs = {};
    Object.entries(rawSongs).forEach(([songId, stats]) => {
        const id = String(songId || '').trim();
        if (!id || !stats || typeof stats !== 'object') return;
        normalizedSongs[id] = {
            plays: Math.max(0, Number(stats.plays) || 0),
            seconds: Math.max(0, Number(stats.seconds) || 0),
            completions: Math.max(0, Number(stats.completions) || 0),
            skips: Math.max(0, Number(stats.skips) || 0),
            lastPlayedAt: Math.max(0, Number(stats.lastPlayedAt) || 0)
        };
    });
    return { songs: normalizedSongs };
}

function loadMusicListeningProfile() {
    try {
        musicListeningProfile = normalizeMusicListeningProfile(JSON.parse(localStorage.getItem(MUSIC_LISTENING_PROFILE_STORAGE_KEY) || '{}'));
    } catch (error) {
        musicListeningProfile = { songs: {} };
    }
}

function saveMusicListeningProfile(force = false) {
    const now = Date.now();
    if (!force && now - (musicState.statsSaveAt || 0) < 2500) return;
    musicState.statsSaveAt = now;
    localStorage.setItem(MUSIC_LISTENING_PROFILE_STORAGE_KEY, JSON.stringify(musicListeningProfile));
}

function getMusicSongStats(songId) {
    const id = String(songId || '').trim();
    if (!id) return null;
    if (!musicListeningProfile.songs || typeof musicListeningProfile.songs !== 'object') {
        musicListeningProfile.songs = {};
    }
    if (!musicListeningProfile.songs[id]) {
        musicListeningProfile.songs[id] = { plays: 0, seconds: 0, completions: 0, skips: 0, lastPlayedAt: 0 };
    }
    return musicListeningProfile.songs[id];
}

function getMusicSongGenreTags(song = {}) {
    const text = [
        song.title,
        song.artist,
        song.fileName,
        song.lyric,
        song.sourceType
    ].filter(Boolean).join(' ').toLowerCase();
    if (!text) return ['pop'];
    const tags = MUSIC_GENRE_RULES
        .filter(rule => rule.keywords.some(keyword => text.includes(String(keyword).toLowerCase())))
        .map(rule => rule.tag);
    return tags.length ? [...new Set(tags)] : ['pop'];
}

function getMusicUserFavoriteGenres() {
    const genreScores = {};
    songs.forEach((song) => {
        const stats = musicListeningProfile.songs?.[song.id];
        if (!stats) return;
        const score = (stats.plays * 2) + (stats.completions * 4) + Math.min(10, (stats.seconds || 0) / 60) - (stats.skips * 1.5);
        if (score <= 0) return;
        getMusicSongGenreTags(song).forEach((tag) => {
            genreScores[tag] = (genreScores[tag] || 0) + score;
        });
    });
    return Object.entries(genreScores).sort((a, b) => b[1] - a[1]).map(([tag]) => tag);
}

function getMusicGenreLabel(tag) {
    return MUSIC_GENRE_RULES.find(rule => rule.tag === tag)?.label || tag;
}

function getTopListenedMusicSongs(limit = 5) {
    return songs
        .map(song => {
            const stats = musicListeningProfile.songs?.[song.id] || {};
            const score = (Number(stats.plays) || 0) * 3
                + (Number(stats.completions) || 0) * 5
                + Math.min(12, (Number(stats.seconds) || 0) / 60)
                - (Number(stats.skips) || 0) * 2;
            return { song, stats, score };
        })
        .filter(item => item.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, limit);
}

function buildHeartMusicSearchQueries(limit = 6) {
    const topSongs = getTopListenedMusicSongs(5);
    const favoriteGenres = getMusicUserFavoriteGenres().slice(0, 3);
    const queries = [];

    favoriteGenres.forEach((tag) => {
        queries.push(`${getMusicGenreLabel(tag)} \u63a8\u8350`);
    });

    topSongs.forEach(({ song }) => {
        const artist = String(song.artist || '').split(/[\/,&\s]+/).filter(Boolean)[0] || '';
        const title = String(song.title || '').replace(/[（(【\[].*?[）)】\]]/g, '').trim();
        const genreLabel = getMusicGenreLabel(getMusicSongGenreTags(song)[0]);
        if (artist && genreLabel) queries.push(`${artist} ${genreLabel}`);
        if (title) queries.push(title);
    });

    if (!queries.length) {
        queries.push('\u6d41\u884c \u63a8\u8350', '\u70ed\u6b4c \u63a8\u8350');
    }

    return [...new Set(queries.map(query => query.trim()).filter(Boolean))].slice(0, limit);
}

function getMusicSongAffinityScore(song, index, favoriteGenres = getMusicUserFavoriteGenres()) {
    if (!song || !isPlayableMusicSong(song) || index === musicState.currentIndex) return Number.NEGATIVE_INFINITY;
    const stats = musicListeningProfile.songs?.[song.id] || {};
    const tags = getMusicSongGenreTags(song);
    const genreScore = tags.reduce((total, tag) => {
        const rank = favoriteGenres.indexOf(tag);
        return rank >= 0 ? total + Math.max(1, 8 - rank) : total;
    }, 0);
    const listenScore = (Math.min(8, Number(stats.plays) || 0) * 0.4)
        + (Math.min(6, Number(stats.completions) || 0) * 0.7)
        + Math.min(5, (Number(stats.seconds) || 0) / 180);
    const freshnessPenalty = Math.max(0, 5 - ((Date.now() - (Number(stats.lastPlayedAt) || 0)) / (24 * 60 * 60 * 1000)));
    return genreScore + listenScore - freshnessPenalty + Math.random();
}

function recordMusicPlaybackStart(song = getCurrentSong()) {
    if (!song) return;
    if (musicState.playSessionSongId !== song.id) {
        musicState.playSessionSongId = song.id;
        musicState.statsTime = Number(musicState.currentTime) || 0;
        const stats = getMusicSongStats(song.id);
        if (stats) {
            stats.plays += 1;
            stats.lastPlayedAt = Date.now();
            saveMusicListeningProfile(true);
        }
    }
}

function recordMusicListeningProgress(song = getCurrentSong(), currentTime = musicState.currentTime) {
    if (!song || musicState.playSessionSongId !== song.id) return;
    const nextTime = Math.max(0, Number(currentTime) || 0);
    const prevTime = Math.max(0, Number(musicState.statsTime) || 0);
    musicState.statsTime = nextTime;
    if (nextTime <= prevTime) return;
    const delta = Math.min(10, nextTime - prevTime);
    if (delta <= 0) return;
    const stats = getMusicSongStats(song.id);
    if (!stats) return;
    stats.seconds += delta;
    stats.lastPlayedAt = Date.now();
    saveMusicListeningProfile(false);
}

function recordMusicPlaybackEnd(song = getCurrentSong(), completed = false) {
    if (!song) return;
    recordMusicListeningProgress(song, musicState.currentTime);
    const stats = getMusicSongStats(song.id);
    if (stats) {
        if (completed) {
            stats.completions += 1;
        } else {
            const duration = getMusicAudioDuration(song);
            if (duration > 30 && musicState.currentTime > 3 && musicState.currentTime < duration * 0.35) {
                stats.skips += 1;
            }
        }
        stats.lastPlayedAt = Date.now();
        saveMusicListeningProfile(true);
    }
    if (musicState.playSessionSongId === song.id) {
        musicState.playSessionSongId = '';
        musicState.statsTime = 0;
    }
}

function loadMusicLibrary() {
    try {
        const parsed = JSON.parse(localStorage.getItem(MUSIC_LIBRARY_STORAGE_KEY) || '[]');
        musicLibrary = Array.isArray(parsed)
            ? parsed
                .map((song, index) => normalizeMusicLibrarySong(song, index))
                .filter(Boolean)
            : [];
        const hiddenDemoIds = JSON.parse(localStorage.getItem(MUSIC_HIDDEN_DEMO_SONGS_STORAGE_KEY) || '[]');
        hiddenDemoMusicSongIds = new Set(Array.isArray(hiddenDemoIds) ? hiddenDemoIds.map(String) : []);
    } catch (error) {
        console.warn('读取本地音乐库失败:', error);
        musicLibrary = [];
        hiddenDemoMusicSongIds = new Set();
    }

    rebuildMusicSongs();
}

function saveMusicLibrary() {
    localStorage.setItem(MUSIC_LIBRARY_STORAGE_KEY, JSON.stringify(musicLibrary));
}

function saveHiddenDemoMusicSongs() {
    localStorage.setItem(MUSIC_HIDDEN_DEMO_SONGS_STORAGE_KEY, JSON.stringify([...hiddenDemoMusicSongIds]));
}

function normalizeMusicLibrarySong(song, index = 0) {
    if (!song || typeof song !== 'object') return null;

    const music163Id = String(song.music163Id || song.neteaseId || '').trim();
    const sourceType = song.sourceType || (song.fileId ? 'file' : (song.url || music163Id ? 'url' : 'file'));
    if (sourceType === 'file' && !song.fileId) return null;
    if ((sourceType === 'url' || sourceType === 'playlist-url') && !song.url && !music163Id) return null;

    const title = String(song.title || song.fileName || `本地歌曲 ${index + 1}`).trim();
    const cover = getMusicCoverFromPayload(song);
    return {
        id: String(song.id || `local_song_${Date.now()}_${index}`),
        title: title || `本地歌曲 ${index + 1}`,
        artist: String(song.artist || (sourceType === 'file' ? '本地音乐' : '链接导入')),
        duration: Math.max(0, Math.round(Number(song.duration) || 0)),
        fileName: String(song.fileName || title || ''),
        fileId: song.fileId ? String(song.fileId) : '',
        url: song.url ? String(song.url) : '',
        directUrl: song.directUrl ? String(song.directUrl) : '',
        cover,
        music163Id,
        sourcePageUrl: song.sourcePageUrl || song.pageUrl ? String(song.sourcePageUrl || song.pageUrl) : '',
        playable: song.playable !== false && Boolean(song.url || song.directUrl || song.fileId || music163Id),
        importedAt: Number(song.importedAt) || Date.now(),
        lyric: song.lyric || (sourceType === 'file' ? '本地音乐播放中' : '链接音乐播放中'),
        sourceType,
        source: 'imported'
    };
}

function getMusicCoverFromPayload(payload = {}) {
    if (!payload || typeof payload !== 'object') return '';

    const album = payload.album && typeof payload.album === 'object' ? payload.album : {};
    const al = payload.al && typeof payload.al === 'object' ? payload.al : {};
    return String(
        payload.cover
        || payload.coverUrl
        || payload.coverImgUrl
        || payload.picUrl
        || payload.picurl
        || payload.pic
        || payload.img1v1Url
        || album.picUrl
        || album.picurl
        || album.img1v1Url
        || al.picUrl
        || al.picurl
        || al.img1v1Url
        || ''
    ).trim();
}

function rebuildMusicSongs() {
    songs = [
        ...musicLibrary,
        ...DEFAULT_MUSIC_SONGS
            .filter(song => !hiddenDemoMusicSongIds.has(String(song.id)))
            .map(song => ({ ...song, source: 'demo', sourceType: 'demo' }))
    ];

    if (!songs[musicState.currentIndex]) {
        musicState.currentIndex = 0;
    }

    if (musicState.selectedSongIds?.size) {
        const songIds = new Set(songs.map(song => song.id));
        musicState.selectedSongIds.forEach(songId => {
            if (!songIds.has(songId)) musicState.selectedSongIds.delete(songId);
        });
    }
}

function updateMusicSongDuration(song, duration) {
    if (!song || !Number.isFinite(duration) || duration <= 0) return;

    song.duration = duration;
    if (song.source === 'imported') {
        const librarySong = musicLibrary.find(item => item.id === song.id);
        if (librarySong && librarySong.duration !== duration) {
            librarySong.duration = duration;
            saveMusicLibrary();
        }
    }
}

function updateMusicSongCover(song, cover) {
    const value = String(cover || '').trim();
    if (!song || !value || song.cover === value) return;

    song.cover = value;
    if (song.source === 'imported') {
        const librarySong = musicLibrary.find(item => item.id === song.id);
        if (librarySong && librarySong.cover !== value) {
            librarySong.cover = value;
            saveMusicLibrary();
        }
    }
}

function updateMusicSongMusic163Id(song, music163Id) {
    const value = String(music163Id || '').trim();
    if (!song || !/^\d+$/.test(value) || String(song.music163Id || '') === value) return;

    song.music163Id = value;
    if (song.source === 'imported') {
        const librarySong = musicLibrary.find(item => item.id === song.id);
        if (librarySong && String(librarySong.music163Id || '') !== value) {
            librarySong.music163Id = value;
            saveMusicLibrary();
        }
    }
}

function getMusicAudioDuration(song = getCurrentSong()) {
    const savedDuration = Math.max(0, Number(song?.duration) || 0);
    const audio = getMusicAudio();
    if (
        audio
        && song
        && musicState.activeAudioSongId === song.id
        && Number.isFinite(audio.duration)
        && audio.duration > 0
    ) {
        return Math.max(savedDuration, audio.duration);
    }

    return savedDuration;
}

function updateMusicSongLyric(song, lyric) {
    const text = String(lyric || '').trim();
    if (!song || !text) return;

    song.lyric = text;
    if (song.source === 'imported') {
        const librarySong = musicLibrary.find(item => item.id === song.id);
        if (librarySong && librarySong.lyric !== text) {
            librarySong.lyric = text;
            saveMusicLibrary();
        }
    }
}

function getMusicSongById(songId) {
    const id = String(songId || '').trim();
    return songs.find(item => String(item.id) === id) || null;
}

function getMusicMenuSong() {
    return getMusicSongById(musicState.menuSongId);
}

function createImportedMusicSong(data = {}) {
    const sourceType = data.sourceType || (data.fileId ? 'file' : 'url');
    const idPrefix = sourceType === 'file' ? 'music_song' : 'music_url_song';

    return normalizeMusicLibrarySong({
        id: data.id || `${idPrefix}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
        title: data.title || '未命名歌曲',
        artist: data.artist || (sourceType === 'file' ? '本地音乐' : '链接导入'),
        duration: data.duration || 0,
        fileName: data.fileName || '',
        fileId: data.fileId || '',
        url: data.url || '',
        directUrl: data.directUrl || '',
        cover: getMusicCoverFromPayload(data),
        music163Id: data.music163Id || data.neteaseId || '',
        sourcePageUrl: data.sourcePageUrl || data.pageUrl || '',
        playable: data.playable,
        importedAt: data.importedAt || Date.now(),
        lyric: data.lyric || (sourceType === 'file' ? '本地音乐播放中' : '链接音乐播放中'),
        sourceType
    });
}

function getCurrentSong() {
    return songs[musicState.currentIndex] || songs[0];
}

function formatMusicTime(seconds, options = {}) {
    const shouldShowUnknown = Boolean(options.unknownForZero);
    if (!Number.isFinite(Number(seconds)) || (shouldShowUnknown && Number(seconds) <= 0)) {
        return '--:--';
    }

    const safeSeconds = Math.max(0, Math.floor(Number(seconds) || 0));
    const minutes = Math.floor(safeSeconds / 60);
    const remain = safeSeconds % 60;
    return `${minutes}:${String(remain).padStart(2, '0')}`;
}

function hasSongAudio(song) {
    if (!song) return false;
    const hasStoredAudio = Boolean(
        (typeof song.url === 'string' && song.url.trim())
        || (typeof song.directUrl === 'string' && song.directUrl.trim())
        || (typeof song.fileId === 'string' && song.fileId.trim())
    );

    if (hasStoredAudio) return true;
    if (song.playable === false && !String(song.music163Id || '').trim()) return false;

    return Boolean(
        typeof song.music163Id === 'string'
        && song.music163Id.trim()
    );
}

function isPlayableMusicSong(song) {
    return Boolean(song && song.playable !== false && hasSongAudio(song));
}

function isMusicPlaybackAtEnd(song = getCurrentSong(), currentTime = musicState.currentTime) {
    const duration = getMusicAudioDuration(song);
    if (!duration || duration <= 0) return false;
    return Number(currentTime) >= Math.max(0, duration - 1.5);
}

function findPlayableMusicIndex(startIndex = musicState.currentIndex, direction = 1) {
    if (!songs.length) return -1;

    const step = direction >= 0 ? 1 : -1;
    const normalizedStart = Number.isInteger(Number(startIndex))
        ? ((Number(startIndex) % songs.length) + songs.length) % songs.length
        : 0;

    for (let offset = 0; offset < songs.length; offset += 1) {
        const index = (normalizedStart + (offset * step) + songs.length) % songs.length;
        if (isPlayableMusicSong(songs[index])) return index;
    }

    return -1;
}

function getRandomPlayableMusicIndex(excludedIndex = musicState.currentIndex) {
    const candidates = songs
        .map((song, index) => ({ song, index }))
        .filter(item => item.index !== excludedIndex && isPlayableMusicSong(item.song));
    if (!candidates.length) {
        return isPlayableMusicSong(songs[excludedIndex]) ? excludedIndex : findPlayableMusicIndex(0, 1);
    }
    return candidates[Math.floor(Math.random() * candidates.length)].index;
}

function getHeartMusicNextIndex() {
    const candidates = songs
        .map((song, index) => ({
            index,
            score: getMusicSongAffinityScore(song, index)
        }))
        .filter(item => Number.isFinite(item.score))
        .sort((a, b) => b.score - a.score)
        .slice(0, Math.min(6, songs.length));
    if (!candidates.length) return getRandomPlayableMusicIndex();

    const total = candidates.reduce((sum, item) => sum + Math.max(0.2, item.score), 0);
    let cursor = Math.random() * total;
    for (const item of candidates) {
        cursor -= Math.max(0.2, item.score);
        if (cursor <= 0) return item.index;
    }
    return candidates[0].index;
}

function isMusicSongAlreadyInLibrary(candidate = {}) {
    const music163Id = String(candidate.music163Id || candidate.id || '').trim();
    if (music163Id && musicLibrary.some(song => String(song.music163Id || '') === music163Id)) return true;
    const title = String(candidate.title || '').trim().toLowerCase();
    const artist = String(candidate.artist || '').trim().toLowerCase();
    return Boolean(title && artist && musicLibrary.some(song => (
        String(song.title || '').trim().toLowerCase() === title
        && String(song.artist || '').trim().toLowerCase() === artist
    )));
}

async function searchHeartMusicCandidates() {
    const candidates = [];
    const seenIds = new Set();
    const queries = buildHeartMusicSearchQueries(6);

    for (const query of queries) {
        try {
            const { data } = await fetchFirstMusicApiJson(`/api/music163/search?q=${encodeURIComponent(query)}&limit=10&fallback=1`);
            const rawSongs = Array.isArray(data?.songs) ? data.songs : [];
            rawSongs.forEach((song) => {
                const music163Id = String(song.music163Id || song.id || '').trim();
                if (!/^\d+$/.test(music163Id) || seenIds.has(music163Id)) return;
                if (isMusicSongAlreadyInLibrary(song)) return;
                seenIds.add(music163Id);
                candidates.push(song);
            });
        } catch (error) {
            console.warn('心动模式搜索歌曲失败:', query, error);
        }

        if (candidates.length >= 18) break;
    }

    const favoriteGenres = getMusicUserFavoriteGenres();
    return candidates
        .map(song => ({
            song,
            score: getMusicSongAffinityScore({
                ...song,
                music163Id: String(song.music163Id || song.id || '').trim(),
                sourceType: 'url',
                playable: true
            }, -1, favoriteGenres)
        }))
        .sort((a, b) => b.score - a.score)
        .slice(0, 10)
        .map(item => item.song);
}

async function resolveHeartMusicCandidate(candidate, index = 0) {
    const music163Id = String(candidate?.music163Id || candidate?.id || '').trim();
    if (!/^\d+$/.test(music163Id)) return null;

    try {
        const { data } = await fetchFirstMusicApiJson(`/api/music163/resolve?id=${encodeURIComponent(music163Id)}&source=search&fallback=1`);
        return createMusic163ImportedSong(data, index, 'url');
    } catch (error) {
        console.warn('心动模式解析歌曲失败:', music163Id, error);
        return createMusic163ImportedSong({
            ...candidate,
            id: music163Id,
            music163Id,
            playable: true
        }, index, 'url');
    }
}

async function loadHeartMusicQueue() {
    if (musicState.heartLoading) return [];

    musicState.heartLoading = true;
    showMusicToast('\u5fc3\u52a8\u6a21\u5f0f\u6b63\u5728\u641c\u7d22\u76f8\u4f3c\u66f2\u98ce');
    try {
        const candidates = await searchHeartMusicCandidates();
        const importedSongs = [];
        for (const candidate of candidates) {
            const song = await resolveHeartMusicCandidate(candidate, importedSongs.length);
            if (!song || isMusicSongAlreadyInLibrary(song)) continue;
            importedSongs.push(song);
            if (importedSongs.length >= 10) break;
        }

        if (!importedSongs.length) return [];

        addImportedMusicSongsToLibrary(importedSongs, { preserveCurrent: true, silent: true });
        musicState.heartQueue = importedSongs.map(song => song.id);
        showMusicToast(`\u5fc3\u52a8\u6a21\u5f0f\u5df2\u63a8\u8350 ${importedSongs.length} \u9996\u65b0\u6b4c`);
        return musicState.heartQueue;
    } finally {
        musicState.heartLoading = false;
    }
}

async function playNextHeartMusicSong(options = {}) {
    if (musicState.heartLoading) return;

    recordMusicPlaybackEnd(getCurrentSong(), false);
    const previousIndex = musicState.currentIndex;
    let nextSongId = musicState.heartQueue.shift();
    let nextIndex = nextSongId ? songs.findIndex(song => song.id === nextSongId) : -1;

    if (nextIndex < 0) {
        await loadHeartMusicQueue();
        nextSongId = musicState.heartQueue.shift();
        nextIndex = nextSongId ? songs.findIndex(song => song.id === nextSongId) : -1;
    }

    if (nextIndex >= 0) {
        if (options.trackHistory !== false) rememberMusicHistory(previousIndex);
        await playSongAtIndex(nextIndex, { showPlayer: true, forcePlay: options.forcePlay !== false, trackPrevious: false });
        return;
    }

    showMusicToast('\u5fc3\u52a8\u6a21\u5f0f\u6682\u65f6\u6ca1\u627e\u5230\u65b0\u6b4c', { type: 'error' });
}

function getSequentialPlayableMusicIndex(direction = 1, options = {}) {
    if (!songs.length) return -1;
    const step = direction >= 0 ? 1 : -1;
    const startIndex = Number(musicState.currentIndex) || 0;
    const allowWrap = options.wrap !== false;
    const excludeCurrent = options.excludeCurrent !== false && songs.length > 1;

    if (allowWrap) {
        for (let offset = 1; offset <= songs.length; offset += 1) {
            const index = (startIndex + (offset * step) + songs.length) % songs.length;
            if (excludeCurrent && index === startIndex) continue;
            if (isPlayableMusicSong(songs[index])) return index;
        }
        return isPlayableMusicSong(songs[startIndex]) ? startIndex : -1;
    }

    for (let index = startIndex + step; index >= 0 && index < songs.length; index += step) {
        if ((!excludeCurrent || index !== startIndex) && isPlayableMusicSong(songs[index])) return index;
    }
    return -1;
}

function getNextMusicIndex(direction = 1, options = {}) {
    const mode = normalizeMusicPlaybackMode(musicState.mode);
    if (mode === 'single' && options.automatic) return musicState.currentIndex;
    if (mode === 'shuffle') return getRandomPlayableMusicIndex();
    return getSequentialPlayableMusicIndex(direction, {
        wrap: options.automatic !== false,
        excludeCurrent: options.automatic !== false
    });
}

function rememberMusicHistory(previousIndex = musicState.currentIndex) {
    const index = Number(previousIndex);
    if (!Number.isInteger(index) || !songs[index]) return;
    const lastIndex = musicState.playHistory[musicState.playHistory.length - 1];
    if (lastIndex !== index) {
        musicState.playHistory.push(index);
        if (musicState.playHistory.length > 60) {
            musicState.playHistory = musicState.playHistory.slice(-60);
        }
    }
    musicState.forwardHistory = [];
}

function getPreviousMusicHistoryIndex() {
    while (musicState.playHistory.length) {
        const index = musicState.playHistory.pop();
        if (Number.isInteger(index) && songs[index] && isPlayableMusicSong(songs[index]) && index !== musicState.currentIndex) {
            musicState.forwardHistory.push(musicState.currentIndex);
            return index;
        }
    }
    return getSequentialPlayableMusicIndex(-1);
}

function isFileSourceSong(song) {
    return song?.sourceType === 'file' || Boolean(song?.fileId);
}

function getMusicApiOrigin() {
    const hostname = String(window.location.hostname || '').toLowerCase();
    const isLocalHost = hostname === '127.0.0.1' || hostname === 'localhost' || hostname === '[::1]';

    if (window.location.protocol !== 'file:' && isLocalHost) return '';
    if (window.location.protocol !== 'file:') return '';

    return 'http://127.0.0.1:3000';
}

function buildMusicApiUrl(path) {
    const value = String(path || '').trim();
    if (!value) return '';
    if (/^https?:\/\//i.test(value)) return value;

    const normalizedPath = value.startsWith('/') ? value : `/${value}`;
    return `${getMusicApiOrigin()}${normalizedPath}`;
}

function buildMusicApiUrlCandidates(path) {
    const value = String(path || '').trim();
    if (!value) return [];
    if (/^https?:\/\//i.test(value)) return [value];

    const normalizedPath = value.startsWith('/') ? value : `/${value}`;
    const candidates = [buildMusicApiUrl(normalizedPath)];
    const isFilePreview = window.location.protocol === 'file:';
    const hostname = String(window.location.hostname || '').trim();
    const isLocalHost = /^(localhost|127\.0\.0\.1|\[::1\])$/i.test(hostname);

    if (isFilePreview) {
        candidates.push(
            `http://127.0.0.1:3000${normalizedPath}`,
            `http://localhost:3000${normalizedPath}`
        );
    } else {
        if (hostname && !isLocalHost) {
            candidates.push(`http://${hostname}:3000${normalizedPath}`);
        }
        candidates.push(
            `http://127.0.0.1:3000${normalizedPath}`,
            `http://localhost:3000${normalizedPath}`
        );
    }

    return [...new Set(candidates.filter(Boolean))];
}

async function fetchFirstMusicApiJson(path, options = {}) {
    const candidates = buildMusicApiUrlCandidates(path);
    let lastError = null;

    for (const url of candidates) {
        try {
            const response = await fetch(url, {
                method: 'GET',
                cache: 'no-store',
                ...options
            });
            const data = await response.json().catch(() => null);
            if (!response.ok) {
                lastError = new Error(data?.error?.message || `请求失败 (${response.status})`);
                continue;
            }
            try {
                const parsed = new URL(url, window.location.href);
                const current = new URL(window.location.href);
                const sameOrigin = parsed.origin === current.origin;
                musicState.apiOrigin = sameOrigin ? '' : parsed.origin;
            } catch (error) {
                musicState.apiOrigin = '';
            }
            return { response, data, url };
        } catch (error) {
            lastError = error;
        }
    }

    throw lastError || new Error('音乐服务不可用，请确认部署已包含 /api/music163 与音乐代理接口');
}

function buildMusicAudioProxyUrl(url) {
    return buildMusicApiUrl(`/api/music-audio-proxy?url=${encodeURIComponent(url)}`);
}

function buildMusicImageProxyUrl(url) {
    const value = String(url || '').trim();
    if (!value) return '';
    if (value.startsWith('/api/music-image-proxy')) return buildMusicApiUrl(value);
    if (!/^https?:\/\//i.test(value)) return value;
    return buildMusicApiUrl(`/api/music-image-proxy?url=${encodeURIComponent(value)}`);
}

function shouldProxyMusicUrl(url) {
    try {
        const parsed = new URL(String(url || '').trim(), window.location.href);
        const hostname = parsed.hostname.toLowerCase();
        return hostname === 'music.163.com' || hostname.endsWith('.music.163.com');
    } catch (error) {
        return false;
    }
}

function getPlayableMusicUrl(song) {
    const directUrl = String(song?.directUrl || song?.url || '').trim();
    if (!directUrl) return '';

    if (directUrl.startsWith('/api/music-audio-proxy')) {
        return buildMusicApiUrl(directUrl);
    }

    return shouldProxyMusicUrl(directUrl) ? buildMusicAudioProxyUrl(directUrl) : directUrl;
}

function getMusicAudio() {
    return document.getElementById('musicAudio');
}

function getMusicCoverImageUrl(url) {
    const value = String(url || '').trim();
    if (!value) return '';
    if (value.startsWith('/api/music-image-proxy')) return buildMusicApiUrl(value);
    return value;
}

function getMusicCoverFallbackUrl(url) {
    const value = String(url || '').trim();
    if (!value || value.startsWith('/api/music-image-proxy') || !/^https?:\/\//i.test(value)) return '';
    return buildMusicImageProxyUrl(value);
}

function getCoverMarkup(song) {
    if (song?.cover) {
        const initial = song?.title ? String(song.title).trim().charAt(0) : '♪';
        const coverUrl = getMusicCoverImageUrl(song.cover);
        const fallbackUrl = getMusicCoverFallbackUrl(song.cover);
        const safeFallbackUrl = escapeHtml(fallbackUrl).replace(/'/g, '&#39;');
        const errorHandler = fallbackUrl
            ? `if(!this.dataset.fallback){this.dataset.fallback='1';this.src='${safeFallbackUrl}';}else{this.remove();}`
            : 'this.remove()';
        return `<span>${escapeHtml(initial || '♪')}</span><img src="${escapeHtml(coverUrl)}" alt="" onerror="${errorHandler}">`;
    }

    const initial = song?.title ? String(song.title).trim().charAt(0) : '♪';
    return `<span>${escapeHtml(initial || '♪')}</span>`;
}

function isGenericMusicArtist(text = '') {
    return ['本地音乐', '链接导入', '未知歌手'].includes(String(text || '').trim());
}

function getMusicPlayerDisplayTitle(song) {
    const title = String(song?.title || '正在播放').trim() || '正在播放';
    return title;
}

function getMusicPlayerDisplayArtist(song) {
    const artist = String(song?.artist || '').trim();
    return artist && !isGenericMusicArtist(artist) ? artist : '';
}

function getMusicPlayButtonIconMarkup(isPlaying) {
    return isPlaying
        ? '<svg class="music-control-icon music-pause-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M7.2 5.3h3.8v13.4H7.2z" fill="currentColor" stroke="none"></path><path d="M13 5.3h3.8v13.4H13z" fill="currentColor" stroke="none"></path></svg>'
        : '<svg class="music-control-icon music-play-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.2 18.8 12 8 18.8z" fill="currentColor" stroke="none"></path></svg>';
}

function parseMusicLyricLines(lyric = '') {
    const text = String(lyric || '').trim();
    if (!text) return [];

    const lines = [];
    text.split(/\r?\n/).forEach((line) => {
        const matches = [...line.matchAll(/\[(\d{1,2}):(\d{2})(?:\.(\d{1,3}))?\]/g)];
        const content = line.replace(/\[[^\]]+\]/g, '').trim();
        if (!matches.length) {
            if (content) lines.push({ time: Number.POSITIVE_INFINITY, text: content });
            return;
        }

        matches.forEach((match) => {
            const minutes = Number(match[1]) || 0;
            const seconds = Number(match[2]) || 0;
            const fractionText = String(match[3] || '0').padEnd(3, '0').slice(0, 3);
            const time = (minutes * 60) + seconds + ((Number(fractionText) || 0) / 1000);
            if (content) lines.push({ time, text: content });
        });
    });

    return lines
        .filter(line => line.text)
        .sort((a, b) => a.time - b.time);
}

function getCurrentMusicLyricIndex(lyricLines, currentTime) {
    if (!Array.isArray(lyricLines) || !lyricLines.length) return -1;
    const timedLines = lyricLines.filter(line => Number.isFinite(line.time));
    if (!timedLines.length) return 0;

    let activeIndex = 0;
    for (let index = 0; index < lyricLines.length; index += 1) {
        const lineTime = lyricLines[index].time;
        if (!Number.isFinite(lineTime)) continue;
        if (lineTime <= currentTime + 0.2) {
            activeIndex = index;
        } else {
            break;
        }
    }
    return activeIndex;
}

function getMusicVisibleLyricLineCount() {
    const player = document.getElementById('musicPlayerPage');
    const app = document.getElementById('app-music');
    const measuredHeight = Math.max(
        player?.getBoundingClientRect?.().height || 0,
        app?.getBoundingClientRect?.().height || 0,
        Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--app-viewport-height')) || 0,
        window.visualViewport?.height || 0,
        window.innerHeight || 0
    );

    if (measuredHeight >= 1100) return 9;
    if (measuredHeight >= 960) return 7;
    if (measuredHeight >= 680) return 5;
    return 3;
}

function syncMusicLyricLayout() {
    const area = document.getElementById('musicLyricArea');
    const player = document.getElementById('musicPlayerPage');
    const app = document.getElementById('app-music');
    if (!area) return;

    const measuredHeight = Math.max(
        player?.getBoundingClientRect?.().height || 0,
        app?.getBoundingClientRect?.().height || 0,
        Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--app-viewport-height')) || 0,
        window.visualViewport?.height || 0,
        window.innerHeight || 0
    );
    const stretch = Math.min(1, Math.max(0, (measuredHeight - 760) / 300));
    const tallStretch = Math.min(1, Math.max(0, (measuredHeight - 900) / 240));
    const lineCount = getMusicVisibleLyricLineCount();
    const lyricHeight = Math.round(126 + (stretch * 82) + (tallStretch * 40) + Math.max(0, lineCount - 5) * 18);
    const lyricGap = lineCount <= 3
        ? Math.round(8 + (stretch * 4))
        : Math.round(12 + (stretch * 8) + (tallStretch * 10) + Math.max(0, lineCount - 5) * 2);
    const lyricOffset = Math.round(tallStretch * 6);

    area.style.setProperty('--music-lyric-window-height', `${lyricHeight}px`);
    area.style.setProperty('--music-lyric-gap', `${lyricGap}px`);
    area.style.setProperty('--music-lyric-offset-y', `${lyricOffset}px`);
}

function renderMusicLyrics(song, currentTime = musicState.currentTime) {
    const area = document.getElementById('musicLyricArea');
    if (!area || !song) return;
    syncMusicLyricLayout();

    const lyric = String(song.lyric || '').trim();
    if (!lyric || lyric === '链接音乐播放中' || lyric === '本地音乐播放中') {
        area.innerHTML = `<div class="music-lyric-line is-active">${escapeHtml(song.music163Id ? '歌词加载中' : (song.lyric || '暂无歌词'))}</div>`;
        return;
    }

    const lines = parseMusicLyricLines(lyric);
    if (!lines.length) {
        area.innerHTML = `<div class="music-lyric-line is-active">${escapeHtml(lyric)}</div>`;
        return;
    }

    const activeIndex = getCurrentMusicLyricIndex(lines, Number(currentTime) || 0);
    const visibleLineCount = Math.min(lines.length, getMusicVisibleLyricLineCount());
    const beforeCount = Math.floor((visibleLineCount - 1) / 2);
    let start = Math.max(0, activeIndex - beforeCount);
    start = Math.min(start, Math.max(0, lines.length - visibleLineCount));
    const visibleLines = lines.slice(start, start + visibleLineCount);
    area.innerHTML = visibleLines.map((line, offset) => {
        const index = start + offset;
        const distance = Math.abs(index - activeIndex);
        const edgeClass = (offset === 0 || offset === visibleLines.length - 1) && visibleLines.length > 3 ? ' is-edge' : '';
        const nearClass = distance === 1 ? ' is-near' : '';
        return `<div class="music-lyric-line${index === activeIndex ? ' is-active' : ''}${nearClass}${edgeClass}">${escapeHtml(line.text)}</div>`;
    }).join('');
}

async function ensureMusicSongLyric(song) {
    if (!song?.music163Id) return;
    const lyric = String(song.lyric || '').trim();
    if (lyric && lyric !== '链接音乐播放中' && lyric !== '本地音乐播放中') return;
    if (musicState.lyricLoadingSongId === song.id) return;

    musicState.lyricLoadingSongId = song.id;
    try {
        const { data } = await fetchFirstMusicApiJson(`/api/music163/lyrics?id=${encodeURIComponent(song.music163Id)}`);
        const nextLyric = String(data?.lyric || '').trim();
        if (nextLyric) {
            updateMusicSongLyric(song, nextLyric);
            updateMusicUI();
        }
    } catch (error) {
        console.warn('读取网易云歌词失败:', error);
    } finally {
        if (musicState.lyricLoadingSongId === song.id) {
            musicState.lyricLoadingSongId = '';
        }
    }
}

async function ensureMusicSongCover(song) {
    if (!song || song.cover) return;
    if (musicState.coverLoadingSongId === song.id) return;

    musicState.coverLoadingSongId = song.id;
    try {
        let cover = '';

        if (song.music163Id) {
            const { data } = await fetchFirstMusicApiJson(`/api/music163/resolve?id=${encodeURIComponent(song.music163Id)}`);
            cover = getMusicCoverFromPayload(data);
        }

        if (!cover) {
            const title = String(song.title || '').trim();
            const artist = String(song.artist || '').trim();
            if (title && !isGenericMusicArtist(artist)) {
                const query = `${title} ${artist}`.trim();
                const { data } = await fetchFirstMusicApiJson(`/api/music163/search?q=${encodeURIComponent(query)}&limit=5&fallback=1`);
                const rawSongs = Array.isArray(data?.songs) ? data.songs : [];
                const normalizedTitle = title.toLowerCase();
                const normalizedArtist = artist.toLowerCase();
                const matched = rawSongs.find(item => (
                    String(item?.title || '').trim().toLowerCase() === normalizedTitle
                    && String(item?.artist || '').trim().toLowerCase().includes(normalizedArtist)
                )) || rawSongs[0];

                if (matched) {
                    cover = getMusicCoverFromPayload(matched);
                    const matchedMusic163Id = String(matched.music163Id || matched.id || '').trim();
                    updateMusicSongMusic163Id(song, matchedMusic163Id);
                    if (!cover && /^\d+$/.test(matchedMusic163Id)) {
                        const resolved = await fetchFirstMusicApiJson(`/api/music163/resolve?id=${encodeURIComponent(matchedMusic163Id)}`);
                        cover = getMusicCoverFromPayload(resolved.data);
                    }
                }
            }
        }

        if (cover) {
            updateMusicSongCover(song, cover);
            updateMusicUI();
        }
    } catch (error) {
        console.warn('读取网易云封面失败:', error);
    } finally {
        if (musicState.coverLoadingSongId === song.id) {
            musicState.coverLoadingSongId = '';
        }
    }
}

function bindMusicAudio() {
    if (musicState.audioBound) return;

    const audio = getMusicAudio();
    if (!audio) return;

    audio.addEventListener('loadedmetadata', () => {
        const song = getCurrentSong();
        if (Number.isFinite(audio.duration) && audio.duration > 0) {
            updateMusicSongDuration(song, Math.round(audio.duration));
        }
        updateMusicUI();
    });

    audio.addEventListener('timeupdate', () => {
        if (hasSongAudio(getCurrentSong())) {
            musicState.currentTime = audio.currentTime || 0;
            recordMusicListeningProgress(getCurrentSong(), musicState.currentTime);
            updateMusicUI();
        }
    });

    audio.addEventListener('play', () => {
        const song = getCurrentSong();
        if (song?.id && musicState.autoResumeSongId === song.id) {
            musicState.autoResumeSongId = '';
        }
        musicState.isPlaying = true;
        recordMusicPlaybackStart(song);
        stopMockMusicTimer();
        updateMusicUI();
    });

    audio.addEventListener('pause', () => {
        recordMusicListeningProgress(getCurrentSong(), musicState.currentTime);
        if (shouldIgnoreMusicPauseEvent()) {
            updateMusicUI();
            return;
        }
        musicState.isPlaying = false;
        updateMusicUI();
    });

    audio.addEventListener('ended', () => {
        recordMusicPlaybackEnd(getCurrentSong(), true);
        protectMusicAutoResume();
        if (musicState.mode === 'single') {
            seekMusicTo(0);
            playCurrentSong();
            return;
        }
        playNextSong({ automatic: true });
    });

    audio.addEventListener('error', () => {
        const song = getCurrentSong();
        const erroredSrc = audio.currentSrc || audio.getAttribute('src') || '';
        if (
            !song
            || musicState.activeAudioSongId !== song.id
            || (musicState.activeAudioSrc && erroredSrc && musicState.activeAudioSrc !== erroredSrc)
        ) {
            return;
        }

        if (!isFileSourceSong(song) && song.music163Id && !musicState.audioRetrying) {
            retryCurrentMusicAfterAudioError(song, erroredSrc);
            return;
        }

        const wasPlaying = musicState.isPlaying;
        musicState.isPlaying = false;
        musicState.audioRetrying = false;
        stopMockMusicTimer();
        if (wasPlaying && audio.paused) {
            showMusicToast(isFileSourceSong(song) ? '音乐文件读取失败' : '无法播放该歌曲，链接可能失效', { type: 'error' });
        }
        updateMusicUI();
    });

    musicState.audioBound = true;
}

function openMusicDB() {
    return new Promise((resolve, reject) => {
        if (!window.indexedDB) {
            reject(new Error('当前浏览器不支持 IndexedDB'));
            return;
        }

        const request = window.indexedDB.open(MUSIC_DB_NAME, MUSIC_DB_VERSION);

        request.onupgradeneeded = () => {
            const db = request.result;
            if (!db.objectStoreNames.contains(MUSIC_FILE_STORE_NAME)) {
                db.createObjectStore(MUSIC_FILE_STORE_NAME, { keyPath: 'id' });
            }
        };

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error || new Error('打开音乐数据库失败'));
    });
}

function putMusicFile(record) {
    return new Promise(async (resolve, reject) => {
        try {
            const db = await openMusicDB();
            const tx = db.transaction(MUSIC_FILE_STORE_NAME, 'readwrite');
            const store = tx.objectStore(MUSIC_FILE_STORE_NAME);
            store.put(record);
            tx.oncomplete = () => {
                db.close();
                resolve(record);
            };
            tx.onerror = () => {
                db.close();
                reject(tx.error || new Error('保存音乐文件失败'));
            };
        } catch (error) {
            reject(error);
        }
    });
}

function getMusicFile(fileId) {
    return new Promise(async (resolve, reject) => {
        try {
            const db = await openMusicDB();
            const tx = db.transaction(MUSIC_FILE_STORE_NAME, 'readonly');
            const store = tx.objectStore(MUSIC_FILE_STORE_NAME);
            const request = store.get(fileId);
            request.onsuccess = () => {
                db.close();
                resolve(request.result || null);
            };
            request.onerror = () => {
                db.close();
                reject(request.error || new Error('读取音乐文件失败'));
            };
        } catch (error) {
            reject(error);
        }
    });
}

function deleteMusicFile(fileId) {
    return new Promise(async (resolve, reject) => {
        try {
            const db = await openMusicDB();
            const tx = db.transaction(MUSIC_FILE_STORE_NAME, 'readwrite');
            const store = tx.objectStore(MUSIC_FILE_STORE_NAME);
            store.delete(fileId);
            tx.oncomplete = () => {
                db.close();
                resolve();
            };
            tx.onerror = () => {
                db.close();
                reject(tx.error || new Error('删除音乐文件失败'));
            };
        } catch (error) {
            reject(error);
        }
    });
}

function revokeMusicObjectUrl(force = false) {
    const currentSong = getCurrentSong();
    if (!musicState.objectUrl) return;
    if (!force && currentSong?.id === musicState.objectUrlSongId) return;

    URL.revokeObjectURL(musicState.objectUrl);
    musicState.objectUrl = '';
    musicState.objectUrlSongId = '';
}

async function resolveMusicAudioUrl(song) {
    if (!song) return '';

    if (!isFileSourceSong(song) && (String(song.url || song.directUrl || '').trim())) {
        revokeMusicObjectUrl(true);
        const playableUrl = getPlayableMusicUrl(song);
        if (playableUrl && playableUrl !== song.url && String(song.url || '').startsWith('/api/music-audio-proxy')) {
            song.url = playableUrl;
            const librarySong = musicLibrary.find(item => item.id === song.id);
            if (librarySong) {
                librarySong.url = playableUrl;
                saveMusicLibrary();
            }
        }
        return playableUrl;
    }

    if (!isFileSourceSong(song) && song.music163Id) {
        const { data } = await fetchFirstMusicApiJson(`/api/music163/resolve?id=${encodeURIComponent(song.music163Id)}`);
        const directUrl = String(data?.url || '').trim();
        const proxyUrl = String(data?.proxyUrl || '').trim();
        if (!directUrl && !proxyUrl) {
            throw new Error('该歌曲暂时没有可播放链接');
        }

        song.directUrl = directUrl;
        song.url = proxyUrl ? buildMusicApiUrl(proxyUrl) : (directUrl ? buildMusicAudioProxyUrl(directUrl) : '');
        song.playable = true;
        if (data?.duration) updateMusicSongDuration(song, Math.max(0, Math.round(Number(data.duration) || 0)));
        if (data?.lyric) updateMusicSongLyric(song, data.lyric);
        updateMusicSongCover(song, getMusicCoverFromPayload(data));
        const librarySong = musicLibrary.find(item => item.id === song.id);
        if (librarySong) {
            librarySong.directUrl = song.directUrl;
            librarySong.url = song.url;
            librarySong.playable = true;
            if (song.duration) librarySong.duration = song.duration;
            if (song.lyric) librarySong.lyric = song.lyric;
            if (song.cover) librarySong.cover = song.cover;
            saveMusicLibrary();
        }
        revokeMusicObjectUrl(true);
        return song.url || getPlayableMusicUrl(song);
    }

    if (!song.fileId) return '';

    if (musicState.objectUrl && musicState.objectUrlSongId === song.id) {
        return musicState.objectUrl;
    }

    revokeMusicObjectUrl(true);
    const record = await getMusicFile(song.fileId);
    if (!record?.blob) {
        throw new Error('音乐文件不存在');
    }

    musicState.objectUrl = URL.createObjectURL(record.blob);
    musicState.objectUrlSongId = song.id;
    return musicState.objectUrl;
}

function renderMusicSongList() {
    const list = document.getElementById('musicSongList');
    const count = document.getElementById('musicSongCount');
    if (!list) return;
    const isSelecting = Boolean(musicState.multiSelectMode);

    list.innerHTML = songs.map((song, index) => `
        <div class="music-song-row ${index === musicState.currentIndex ? 'is-active' : ''} ${isSelecting ? 'is-selecting' : ''} ${musicState.selectedSongIds.has(song.id) ? 'is-selected' : ''}">
            <button class="music-song-select" type="button" onclick="toggleMusicSongSelection(event, '${escapeHtml(song.id)}')" aria-label="选择歌曲">
                <span></span>
            </button>
            <button class="music-song-main" type="button" onclick="selectMusicSong(${index})">
                <span class="music-song-index">${String(index + 1).padStart(2, '0')}</span>
                <span class="music-song-meta">
                    <strong>${escapeHtml(song.title)}</strong>
                    <small>${escapeHtml(song.artist)}</small>
                </span>
            <span class="music-song-duration">${formatMusicTime(song.duration, { unknownForZero: true })}</span>
            </button>
            <button class="music-song-more" type="button" onclick="openMusicSongMenu(event, '${escapeHtml(song.id)}')" aria-label="更多操作">⋯</button>
        </div>
    `).join('');

    if (count) {
        count.textContent = `${songs.length}首`;
    }
    updateMusicMultiSelectUI();
}

function updateMusicUI() {
    const song = getCurrentSong();
    if (!song) return;
    const rawDuration = getMusicAudioDuration(song);
    const durationForProgress = Math.max(1, rawDuration || 1);
    const playbackCurrent = Math.min(Math.max(0, musicState.currentTime), durationForProgress);
    const dragCurrent = durationForProgress * (Math.min(100, Math.max(0, musicState.progressDragPercent || 0)) / 100);
    const current = musicState.progressDragging ? dragCurrent : playbackCurrent;
    const progress = rawDuration > 0
        ? Math.min(100, Math.max(0, (current / durationForProgress) * 100))
        : 0;
    const isPlayerPage = musicState.page === 'player';
    const musicNav = document.querySelector('#app-music .music-nav');
    const musicApp = document.getElementById('app-music');
    const navTitle = document.getElementById('musicNavTitle');
    const navSubtitle = document.getElementById('musicNavSubtitle');
    if (musicApp) musicApp.classList.toggle('is-music-player-page', isPlayerPage);
    if (musicNav) musicNav.classList.toggle('is-player-page', isPlayerPage);
    if (navTitle) navTitle.textContent = '音乐';
    if (navSubtitle) navSubtitle.textContent = isPlayerPage ? '' : song.artist;
    const playerCover = document.getElementById('musicPlayerCover');
    const miniCover = document.getElementById('musicMiniCover');
    if (playerCover) playerCover.innerHTML = getCoverMarkup(song);
    if (miniCover) miniCover.innerHTML = getCoverMarkup(song);
    const trackTitle = document.getElementById('musicTrackTitle');
    const trackArtist = document.getElementById('musicTrackArtist');
    const miniTitle = document.getElementById('musicMiniTitle');
    const miniArtist = document.getElementById('musicMiniArtist');
    if (trackTitle) trackTitle.textContent = getMusicPlayerDisplayTitle(song);
    if (trackArtist) trackArtist.textContent = getMusicPlayerDisplayArtist(song);
    if (miniTitle) miniTitle.textContent = song.title;
    if (miniArtist) miniArtist.textContent = song.artist;
    const playBtn = document.getElementById('playBtn');
    const miniPlayBtn = document.getElementById('musicMiniPlayBtn');
    if (playBtn) {
        playBtn.innerHTML = getMusicPlayButtonIconMarkup(musicState.isPlaying);
        playBtn.setAttribute('aria-label', musicState.isPlaying ? '\u6682\u505c' : '\u64ad\u653e');
    }
    if (miniPlayBtn) {
        miniPlayBtn.innerHTML = getMusicPlayButtonIconMarkup(musicState.isPlaying);
        miniPlayBtn.setAttribute('aria-label', musicState.isPlaying ? '\u6682\u505c' : '\u64ad\u653e');
    }
    const progressEl = document.getElementById('musicProgress');
    if (progressEl) {
        progressEl.style.setProperty('--music-progress', `${progress}%`);
        progressEl.setAttribute('aria-valuenow', String(Math.round(progress)));
        progressEl.setAttribute('aria-valuetext', `${formatMusicTime(current)} / ${formatMusicTime(rawDuration, { unknownForZero: true })}`);
        progressEl.classList.toggle('is-dragging', Boolean(musicState.progressDragging));
    }
    const currentTime = document.getElementById('musicCurrentTime');
    const durationText = document.getElementById('musicDuration');
    if (currentTime) currentTime.textContent = formatMusicTime(current);
    if (durationText) durationText.textContent = formatMusicTime(rawDuration, { unknownForZero: true });
    const vinyl = document.getElementById('musicVinyl');
    if (vinyl) vinyl.classList.toggle('is-spinning', musicState.isPlaying);
    const modeBtn = document.getElementById('musicModeBtn');
    if (modeBtn) {
        const mode = normalizeMusicPlaybackMode(musicState.mode);
        const meta = MUSIC_MODE_META[mode] || MUSIC_MODE_META.sequence;
        modeBtn.innerHTML = `${meta.icon}<span class="music-mode-label">${meta.label}</span>`;
        modeBtn.classList.toggle('is-single-mode', mode === 'single');
        modeBtn.classList.toggle('is-shuffle-mode', mode === 'shuffle');
        modeBtn.classList.toggle('is-heart-mode', mode === 'heart');
        modeBtn.setAttribute('aria-label', meta.label);
        modeBtn.setAttribute('title', meta.label);
    }
    renderMusicLyrics(song, current);
    ensureMusicSongCover(song);
    if (isPlayerPage) {
        ensureMusicSongLyric(song);
    }
}

async function syncMusicAudioSource(song) {
    const audio = getMusicAudio();
    if (!audio || !song) return;

    if (hasSongAudio(song)) {
        const nextSrc = await resolveMusicAudioUrl(song);
        if (audio.getAttribute('src') !== nextSrc) {
            musicState.audioSourceToken += 1;
            musicState.activeAudioSongId = song.id;
            musicState.activeAudioSrc = nextSrc;
            audio.src = nextSrc;
            audio.load();
        } else {
            musicState.activeAudioSongId = song.id;
            musicState.activeAudioSrc = nextSrc;
        }
    } else {
        musicState.audioSourceToken += 1;
        musicState.activeAudioSongId = '';
        musicState.activeAudioSrc = '';
        audio.removeAttribute('src');
        audio.load();
        revokeMusicObjectUrl(true);
    }
}

async function retryCurrentMusicAfterAudioError(song, failedSrc = '') {
    if (!song || musicState.audioRetrying) return;

    const audio = getMusicAudio();
    musicState.audioRetrying = true;
    const token = musicState.audioSourceToken;
    try {
        song.url = '';
        song.directUrl = '';
        const librarySong = musicLibrary.find(item => item.id === song.id);
        if (librarySong) {
            librarySong.url = '';
            librarySong.directUrl = '';
            saveMusicLibrary();
        }

        await syncMusicAudioSource(song);
        if (!audio || musicState.audioSourceToken === token || musicState.activeAudioSrc === failedSrc) {
            throw new Error('音频链接未更新');
        }
        audio.currentTime = Math.min(musicState.currentTime, getMusicAudioDuration(song) || musicState.currentTime || 0);
        await audio.play();
        musicState.isPlaying = true;
    } catch (error) {
        console.warn('音频错误后重新解析失败:', error);
        musicState.isPlaying = false;
        stopMockMusicTimer();
        showMusicToast('无法播放该歌曲，链接可能失效', { type: 'error' });
    } finally {
        musicState.audioRetrying = false;
        updateMusicUI();
    }
}

function stopMockMusicTimer() {
    if (musicState.timerId) {
        clearInterval(musicState.timerId);
        musicState.timerId = null;
    }
}

function clearMusicSwitchingPlayback() {
    musicState.switchingPlayback = false;
    musicState.resumeAfterSwitch = false;
}

function protectMusicAutoResume(duration = 1800) {
    musicState.suppressPauseUntil = Math.max(
        musicState.suppressPauseUntil || 0,
        Date.now() + duration
    );
}

function shouldIgnoreMusicPauseEvent() {
    return (musicState.switchingPlayback && musicState.resumeAfterSwitch)
        || Date.now() < (musicState.suppressPauseUntil || 0);
}

function scheduleMusicAutoResumeCheck(songId, attempts = 4) {
    const targetSongId = String(songId || '');
    if (!targetSongId || attempts <= 0) return;

    setTimeout(() => {
        const song = getCurrentSong();
        const audio = getMusicAudio();
        if (!song || song.id !== targetSongId || musicState.autoResumeSongId !== targetSongId) return;

        const needsResume = hasSongAudio(song)
            ? (!audio || audio.paused || audio.ended || musicState.activeAudioSongId !== targetSongId)
            : !musicState.timerId;

        if (!needsResume) {
            musicState.autoResumeSongId = '';
            return;
        }

        protectMusicAutoResume();
        musicState.isPlaying = true;
        playCurrentSong();
        scheduleMusicAutoResumeCheck(targetSongId, attempts - 1);
    }, 280);
}

function startMockMusicTimer() {
    stopMockMusicTimer();
    recordMusicPlaybackStart(getCurrentSong());
    musicState.timerId = setInterval(() => {
        const song = getCurrentSong();
        const duration = Math.max(1, getMusicAudioDuration(song) || 1);
        musicState.currentTime += 1;
        recordMusicListeningProgress(song, musicState.currentTime);

        if (musicState.currentTime >= duration) {
            recordMusicPlaybackEnd(song, true);
            if (musicState.mode === 'single') {
                musicState.currentTime = 0;
                recordMusicPlaybackStart(song);
            } else {
                protectMusicAutoResume();
                playNextSong({ automatic: true });
                return;
            }
        }

        updateMusicUI();
    }, 1000);
}

async function playCurrentSong() {
    const song = getCurrentSong();
    bindMusicAudio();
    if (isMusicPlaybackAtEnd(song)) {
        musicState.currentTime = 0;
    }
    if (!isPlayableMusicSong(song)) {
        const nextPlayableIndex = findPlayableMusicIndex(musicState.currentIndex + 1, 1);
        if (nextPlayableIndex >= 0 && nextPlayableIndex !== musicState.currentIndex) {
            musicState.currentIndex = nextPlayableIndex;
            musicState.currentTime = 0;
            renderMusicSongList();
            showMusicToast('已跳过暂不可播放的歌曲');
            return playCurrentSong();
        }

        musicState.isPlaying = false;
        stopMockMusicTimer();
        showMusicToast('这首网易云歌曲暂时没有可播放地址', { type: 'error' });
        updateMusicUI();
        return;
    }

    musicState.isPlaying = true;

    if (hasSongAudio(song)) {
        try {
            await syncMusicAudioSource(song);
            const audio = getMusicAudio();
            if (audio) {
                audio.currentTime = Math.min(musicState.currentTime, getMusicAudioDuration(song) || musicState.currentTime || 0);
                await audio.play();
            }
        } catch (error) {
            if (!isFileSourceSong(song) && song?.music163Id && (song.url || song.directUrl)) {
                song.url = '';
                song.directUrl = '';
                const librarySong = musicLibrary.find(item => item.id === song.id);
                if (librarySong) {
                    librarySong.url = '';
                    librarySong.directUrl = '';
                    saveMusicLibrary();
                }
                try {
                    await syncMusicAudioSource(song);
                    const audio = getMusicAudio();
                    if (audio) {
                        audio.currentTime = Math.min(musicState.currentTime, getMusicAudioDuration(song) || musicState.currentTime || 0);
                        await audio.play();
                        updateMusicUI();
                        return;
                    }
                } catch (retryError) {
                    console.warn('重新解析音乐后播放仍失败:', retryError);
                }
            }
            console.warn('播放音乐失败:', error);
            if (!audio?.paused) {
                updateMusicUI();
                return;
            }
            if (musicState.autoResumeSongId === song?.id) {
                musicState.isPlaying = true;
                protectMusicAutoResume();
                updateMusicUI();
                return;
            }
            musicState.isPlaying = false;
            stopMockMusicTimer();
            showMusicToast(isFileSourceSong(song) ? '音乐文件读取失败' : '无法播放该歌曲，链接可能失效', { type: 'error' });
            updateMusicUI();
            return;
        }
    } else {
        startMockMusicTimer();
    }

    updateMusicUI();
}

async function playSongAtIndex(index, { showPlayer = true, forcePlay = true, trackPrevious = true } = {}) {
    let nextIndex = Number(index);
    if (!Number.isInteger(nextIndex) || !songs[nextIndex]) return;

    if (!isPlayableMusicSong(songs[nextIndex])) {
        const playableIndex = findPlayableMusicIndex(nextIndex + 1, 1);
        if (playableIndex < 0 || playableIndex === nextIndex) {
            showMusicToast('这批歌曲暂时没有可播放地址', { type: 'error' });
            return;
        }

        showMusicToast('已跳过暂不可播放的歌曲');
        nextIndex = playableIndex;
    }

    if (trackPrevious && nextIndex !== musicState.currentIndex) {
        recordMusicPlaybackEnd(getCurrentSong(), false);
        rememberMusicHistory(musicState.currentIndex);
    }

    musicState.switchingPlayback = true;
    musicState.resumeAfterSwitch = forcePlay;
    const audio = getMusicAudio();
    if (audio) audio.pause();
    stopMockMusicTimer();

    musicState.currentIndex = nextIndex;
    musicState.currentTime = 0;
    musicState.isPlaying = false;
    await syncMusicAudioSource(getCurrentSong()).catch(error => {
        console.warn('同步音乐文件失败:', error);
    });
    renderMusicSongList();
    if (showPlayer) showMusicPlayer();

    if (forcePlay) {
        await playCurrentSong();
    } else {
        updateMusicUI();
    }
    clearMusicSwitchingPlayback();
}

function pauseCurrentSong() {
    musicState.suppressPauseUntil = 0;
    clearMusicSwitchingPlayback();
    recordMusicListeningProgress(getCurrentSong(), musicState.currentTime);
    const audio = getMusicAudio();
    if (audio && !audio.paused) {
        audio.pause();
    }

    stopMockMusicTimer();
    musicState.isPlaying = false;
    updateMusicUI();
}

function toggleMusic(event) {
    if (event) {
        event.preventDefault();
        event.stopPropagation();
    }

    if (musicState.isPlaying) {
        pauseCurrentSong();
    } else {
        playCurrentSong();
    }
}

function selectMusicSong(index) {
    if (musicState.multiSelectMode) {
        const song = songs[Number(index)];
        if (song) toggleMusicSongSelection(null, song.id);
        return;
    }

    playSongAtIndex(index, { showPlayer: true, forcePlay: true });
}

async function playPrevSong() {
    clearMusicSwitchingPlayback();
    const nextIndex = getPreviousMusicHistoryIndex();
    if (nextIndex < 0) {
        showMusicToast('这批歌曲暂时没有可播放地址', { type: 'error' });
        return;
    }
    const shouldResume = musicState.isPlaying;
    recordMusicPlaybackEnd(getCurrentSong(), false);
    musicState.switchingPlayback = true;
    musicState.resumeAfterSwitch = shouldResume;
    const audio = getMusicAudio();
    if (audio) audio.pause();
    stopMockMusicTimer();

    musicState.currentIndex = nextIndex;
    musicState.currentTime = 0;
    musicState.isPlaying = false;
    renderMusicSongList();
    if (shouldResume) {
        await playCurrentSong();
    } else {
        await syncMusicAudioSource(getCurrentSong()).catch(error => {
            console.warn('同步音乐文件失败:', error);
        });
        updateMusicUI();
    }
    clearMusicSwitchingPlayback();
}

async function playNextSong(options = {}) {
    clearMusicSwitchingPlayback();
    if (normalizeMusicPlaybackMode(musicState.mode) === 'heart') {
        await playNextHeartMusicSong({ forcePlay: options.forcePlay !== false, trackHistory: !options.automatic });
        return;
    }

    const nextIndex = getNextMusicIndex(1, options);
    if (nextIndex < 0) {
        if (options.automatic && normalizeMusicPlaybackMode(musicState.mode) === 'sequence') {
            stopMockMusicTimer();
            musicState.isPlaying = false;
            updateMusicUI();
            return;
        }
        showMusicToast('这批歌曲暂时没有可播放地址', { type: 'error' });
        return;
    }
    const shouldResume = options.automatic || options.forcePlay === true || musicState.isPlaying;
    if (shouldResume) {
        protectMusicAutoResume();
    }
    const previousIndex = musicState.currentIndex;
    if (!options.automatic) {
        recordMusicPlaybackEnd(getCurrentSong(), false);
    }
    musicState.switchingPlayback = true;
    musicState.resumeAfterSwitch = shouldResume;
    const audio = getMusicAudio();
    if (audio) audio.pause();
    stopMockMusicTimer();

    musicState.currentIndex = nextIndex;
    if (!options.automatic) rememberMusicHistory(previousIndex);
    if (options.automatic && shouldResume) {
        musicState.autoResumeSongId = getCurrentSong()?.id || '';
    }
    musicState.currentTime = 0;
    musicState.isPlaying = false;
    renderMusicSongList();
    if (shouldResume) {
        await playCurrentSong();
        if (options.automatic) {
            scheduleMusicAutoResumeCheck(getCurrentSong()?.id || musicState.autoResumeSongId);
        }
    } else {
        await syncMusicAudioSource(getCurrentSong()).catch(error => {
            console.warn('同步音乐文件失败:', error);
        });
        updateMusicUI();
    }
    clearMusicSwitchingPlayback();
}

function getMusicFileExtension(name = '') {
    const match = String(name).toLowerCase().match(/\.([a-z0-9]+)$/);
    return match ? match[1] : '';
}

function isSupportedMusicFile(file) {
    if (!file) return false;

    const extension = getMusicFileExtension(file.name);
    return (
        (typeof file.type === 'string' && file.type.startsWith('audio/'))
        || MUSIC_SUPPORTED_EXTENSIONS.includes(extension)
    );
}

function getMusicTitleFromFileName(name = '') {
    return String(name || '本地音乐').replace(/\.[^.]+$/, '').trim() || '本地音乐';
}

function getAudioSourceDuration(source) {
    return new Promise((resolve) => {
        const audio = document.createElement('audio');
        const isBlobSource = source instanceof Blob;
        const objectUrl = isBlobSource ? URL.createObjectURL(source) : String(source || '');
        let settled = false;

        const finish = (duration = 0) => {
            if (settled) return;
            settled = true;
            if (isBlobSource) {
                URL.revokeObjectURL(objectUrl);
            }
            audio.removeAttribute('src');
            resolve(Math.max(0, Math.round(Number(duration) || 0)));
        };

        audio.preload = 'metadata';
        audio.onloadedmetadata = () => finish(audio.duration);
        audio.onerror = () => finish(0);
        audio.src = objectUrl;
        setTimeout(() => finish(0), 5000);
    });
}

function getAudioFileDuration(file) {
    return getAudioSourceDuration(file);
}

function getAudioUrlDuration(url) {
    return getAudioSourceDuration(url);
}

function isProbablyAudioUrl(value) {
    const text = String(value || '').trim();
    if (!/^https?:\/\//i.test(text)) return false;

    try {
        const parsed = new URL(text);
        const extension = getMusicFileExtension(parsed.pathname);
        return MUSIC_SUPPORTED_EXTENSIONS.includes(extension);
    } catch (error) {
        return false;
    }
}

function isProbablyJsonUrl(value) {
    try {
        const parsed = new URL(String(value || '').trim());
        return /\.json$/i.test(parsed.pathname || '');
    } catch (error) {
        return false;
    }
}

function getMusicTitleFromUrl(url = '') {
    try {
        const parsed = new URL(String(url).trim());
        const pathname = decodeURIComponent(parsed.pathname || '');
        const fileName = pathname.split('/').filter(Boolean).pop() || parsed.hostname || '链接歌曲';
        return getMusicTitleFromFileName(fileName);
    } catch (error) {
        return '链接歌曲';
    }
}

function cleanMusicImportUrl(value = '') {
    return String(value || '')
        .trim()
        .replace(/&amp;/gi, '&')
        .replace(/[)\]}>）】』」》。，、；;!！?？]+$/g, '');
}

function extractMusicImportUrlCandidates(value = '') {
    const matches = String(value || '').match(/https?:\/\/[^\s"'<>()\[\]{}（）]+/gi) || [];
    return [...new Set(matches.map(cleanMusicImportUrl).filter(Boolean))];
}

function getMusicImportTextVariants(value = '') {
    const rawText = String(value || '').trim();
    const variants = [rawText, rawText.replace(/&amp;/gi, '&')];
    try {
        variants.push(decodeURIComponent(rawText));
    } catch (error) {
        // Ignore malformed percent escapes from copied share text.
    }

    return [...new Set(variants.map(item => String(item || '').trim()).filter(Boolean))];
}

function isMusic163PageHost(hostname = '') {
    const host = String(hostname || '').toLowerCase();
    return host === 'music.163.com' || host.endsWith('.music.163.com');
}

function isLikelyMusic163ShareUrl(value = '') {
    try {
        const parsed = new URL(cleanMusicImportUrl(value));
        const host = parsed.hostname.toLowerCase();
        return isMusic163PageHost(host) || host === '163cn.tv' || host.endsWith('.163cn.tv');
    } catch (error) {
        return false;
    }
}

function hasMusic163PathType(pathname = '', type = 'song') {
    return String(pathname || '')
        .split('/')
        .filter(Boolean)
        .includes(type);
}

function getMusic163UrlInfo(value = '') {
    try {
        const parsed = new URL(cleanMusicImportUrl(value));
        const hostname = parsed.hostname.toLowerCase();
        if (!isMusic163PageHost(hostname)) {
            return null;
        }

        const hashQuery = parsed.hash.includes('?') ? parsed.hash.slice(parsed.hash.indexOf('?') + 1) : '';
        const hashPath = parsed.hash
            ? parsed.hash.replace(/^#\/?/, '').split('?')[0].replace(/^\/+/, '')
            : '';

        return {
            pathname: (parsed.pathname || '').replace(/^\/+/, ''),
            searchParams: parsed.searchParams,
            hashPath,
            hashParams: new URLSearchParams(hashQuery)
        };
    } catch (error) {
        return null;
    }
}

function extractMusic163IdByType(value = '', type = 'song') {
    const info = getMusic163UrlInfo(value);
    if (!info) return '';

    const pathnameMatches = hasMusic163PathType(info.pathname, type);
    const hashMatches = hasMusic163PathType(info.hashPath, type);
    if (!pathnameMatches && !hashMatches) return '';

    const id = info.searchParams.get('id') || info.hashParams.get('id') || '';
    return /^\d+$/.test(id) ? id : '';
}

function extractMusic163SongId(value = '') {
    return extractMusic163IdByType(value, 'song');
}

function extractMusic163PlaylistId(value = '') {
    return extractMusic163IdByType(value, 'playlist');
}

function extractLooseMusic163Id(value = '', type = 'song') {
    const pathName = type === 'playlist' ? 'playlist' : 'song';

    for (const text of getMusicImportTextVariants(value)) {
        for (const url of extractMusicImportUrlCandidates(text)) {
            const strictId = extractMusic163IdByType(url, type);
            if (strictId) return strictId;
        }

        const pathMatch = text.match(new RegExp(`${pathName}[\\s\\S]*?[?&]id=(\\d+)`, 'i'));
        if (pathMatch) return pathMatch[1];

        const hashMatch = text.match(new RegExp(`#/?${pathName}[\\s\\S]*?[?&]id=(\\d+)`, 'i'));
        if (hashMatch) return hashMatch[1];
    }

    return '';
}

function extractLooseMusic163SongId(value = '') {
    return extractLooseMusic163Id(value, 'song');
}

function extractLooseMusic163PlaylistId(value = '') {
    return extractLooseMusic163Id(value, 'playlist');
}

function isLikelyMusic163ImportValue(value = '') {
    const text = String(value || '').trim();
    if (!text) return false;
    if (/music\.163\.com|163cn\.tv|网易云|歌单|playlist/i.test(text)) return true;
    return extractLooseMusic163PlaylistId(text) || extractLooseMusic163SongId(text);
}

function createMusic163ImportedSong(item, index = 0, sourceType = 'url') {
    if (!item || typeof item !== 'object') return null;

    const directUrl = String(item.url || item.directUrl || '').trim();
    const proxyUrl = String(item.proxyUrl || '').trim();
    const playableUrl = proxyUrl
        ? buildMusicApiUrl(proxyUrl)
        : (directUrl ? buildMusicAudioProxyUrl(directUrl) : '');
    const music163Id = String(item.music163Id || item.id || '').trim();
    const fallbackTitle = sourceType === 'playlist-url' ? `歌单歌曲 ${index + 1}` : `链接歌曲 ${item.id || index + 1}`;
    return createImportedMusicSong({
        title: item.title || fallbackTitle,
        artist: item.artist || '链接导入',
        duration: Math.max(0, Math.round(Number(item.duration) || 0)),
        url: playableUrl,
        directUrl,
        cover: getMusicCoverFromPayload(item),
        music163Id,
        sourcePageUrl: item.pageUrl || (music163Id ? `https://music.163.com/song?id=${encodeURIComponent(music163Id)}` : ''),
        playable: item.playable !== false && Boolean(playableUrl || directUrl || music163Id),
        importedAt: Date.now(),
        sourceType
    });
}

async function buildMusic163SongFromPageUrl(pageUrl) {
    const songId = extractMusic163SongId(pageUrl);
    if (!songId) {
        throw new Error('unsupported-link');
    }

    try {
        const response = await fetch(buildMusicApiUrl(`/api/music163/resolve?id=${encodeURIComponent(songId)}`), {
            method: 'GET',
            cache: 'no-store'
        });
        if (response.ok) {
            const data = await response.json();
            const song = createMusic163ImportedSong(data, 0, 'url');
            if (!song) throw new Error('music-unavailable');
            return song;
        } else if (response.status === 404 || response.status === 502) {
            throw new Error('music-unavailable');
        }
        throw new Error('platform-link-unsupported');
    } catch (error) {
        if (error?.message === 'music-unavailable') {
            throw error;
        }
        console.warn('服务端解析歌曲链接失败:', error);
        throw new Error('platform-link-unsupported');
    }
}

async function buildMusic163SongsFromPlaylistId(playlistId, options = {}) {
    const normalizedPlaylistId = String(playlistId || '').trim();
    if (!/^\d+$/.test(normalizedPlaylistId)) {
        throw new Error('unsupported-link');
    }

    const forceParam = options.force ? '&force=1' : '';

    try {
        let response = await fetch(buildMusicApiUrl(`/api/music163/playlist?id=${encodeURIComponent(normalizedPlaylistId)}&metadata=1${forceParam}&t=${Date.now()}`), {
            method: 'GET',
            cache: 'no-store'
        });
        if (!response.ok && (response.status === 404 || response.status === 502)) {
            response = await fetch(buildMusicApiUrl(`/api/music163/import?text=${encodeURIComponent(`https://music.163.com/playlist?id=${normalizedPlaylistId}`)}&metadata=1${forceParam}&t=${Date.now()}`), {
                method: 'GET',
                cache: 'no-store'
            });
        }
        if (!response.ok) {
            if (response.status === 404 || response.status === 502) {
                throw new Error('playlist-unavailable');
            }
            throw new Error('platform-link-unsupported');
        }

        const data = await response.json();
        const rawSongs = Array.isArray(data?.songs) ? data.songs : [];
        const songs = rawSongs
            .map((item, index) => createMusic163ImportedSong(item, index, 'playlist-url'))
            .filter(Boolean);
        if (!songs.length) {
            throw new Error('playlist-unavailable');
        }
        return songs;
    } catch (error) {
        if (error?.message === 'playlist-unavailable' || error?.message === 'platform-link-unsupported') {
            throw error;
        }
        console.warn('服务端解析歌单链接失败:', error);
        throw new Error('platform-link-unsupported');
    }
}

async function buildMusic163SongsFromPlaylistUrl(pageUrl) {
    const playlistId = extractMusic163PlaylistId(pageUrl) || extractLooseMusic163PlaylistId(pageUrl);
    if (!playlistId) {
        throw new Error('unsupported-link');
    }

    return buildMusic163SongsFromPlaylistId(playlistId);
}

async function buildMusic163SongsFromShareUrl(shareUrl) {
    let data = null;
    let response = null;
    try {
        response = await fetch(buildMusicApiUrl(`/api/music163/import?url=${encodeURIComponent(shareUrl)}`), {
            method: 'GET',
            cache: 'no-store'
        });
        data = await response.json().catch(() => null);
    } catch (error) {
        console.warn('网易云分享链接请求失败:', error);
        throw new Error('platform-link-unsupported');
    }

    if (!response?.ok) {
        const errorCode = data?.error?.code || '';
        if (errorCode === 'MUSIC_UNAVAILABLE') throw new Error('music-unavailable');
        if (errorCode === 'MUSIC_PLAYLIST_UNAVAILABLE' || errorCode === 'MUSIC_PLAYLIST_EMPTY') throw new Error('playlist-unavailable');
        throw new Error('platform-link-unsupported');
    }

    const sourceType = data?.type === 'playlist' ? 'playlist-url' : 'url';
    const rawSongs = Array.isArray(data?.songs) ? data.songs : [];
    if (sourceType === 'url' && rawSongs.some(item => item?.playable === false || (!item?.url && !item?.proxyUrl))) {
        throw new Error('music-unavailable');
    }
    const songs = rawSongs
        .map((item, index) => createMusic163ImportedSong(item, index, sourceType))
        .filter(Boolean);

    if (!songs.length) {
        throw new Error(sourceType === 'playlist-url' ? 'playlist-unavailable' : 'music-unavailable');
    }

    return songs;
}

async function buildMusic163SongsFromShareText(value) {
    let data = null;
    let response = null;
    try {
        response = await fetch(buildMusicApiUrl(`/api/music163/import?text=${encodeURIComponent(String(value || '').trim())}&metadata=1&force=1&t=${Date.now()}`), {
            method: 'GET',
            cache: 'no-store'
        });
        data = await response.json().catch(() => null);
    } catch (error) {
        console.warn('网易云分享内容请求失败:', error);
        throw new Error('platform-link-unsupported');
    }

    if (!response?.ok) {
        const errorCode = data?.error?.code || '';
        if (errorCode === 'MUSIC_UNAVAILABLE') throw new Error('music-unavailable');
        if (errorCode === 'MUSIC_PLAYLIST_UNAVAILABLE' || errorCode === 'MUSIC_PLAYLIST_EMPTY') throw new Error('playlist-unavailable');
        throw new Error('platform-link-unsupported');
    }

    const sourceType = data?.type === 'playlist' ? 'playlist-url' : 'url';
    const rawSongs = Array.isArray(data?.songs) ? data.songs : [];
    if (sourceType === 'url' && rawSongs.some(item => item?.playable === false || (!item?.url && !item?.proxyUrl))) {
        throw new Error('music-unavailable');
    }
    const songs = rawSongs
        .map((item, index) => createMusic163ImportedSong(item, index, sourceType))
        .filter(Boolean);

    if (!songs.length) {
        throw new Error(sourceType === 'playlist-url' ? 'playlist-unavailable' : 'music-unavailable');
    }

    return songs;
}

function openMusicImport() {
    const sheet = document.getElementById('musicImportSheet');
    if (sheet) sheet.hidden = false;
}

function closeMusicImportSheet() {
    const sheet = document.getElementById('musicImportSheet');
    if (sheet) sheet.hidden = true;
}

function chooseMusicFileImport() {
    closeMusicImportSheet();
    const input = document.getElementById('musicFileInput');
    if (input) input.click();
}

async function handleMusicImport(event) {
    const input = event?.target;
    const files = Array.from(input?.files || []);
    if (!files.length) return;

    let importedCount = 0;
    let unsupportedCount = 0;
    const importedSongs = [];

    for (const file of files) {
        if (!isSupportedMusicFile(file)) {
            unsupportedCount += 1;
            continue;
        }

        try {
            const fileId = `music_file_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
            const songId = `music_song_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
            const duration = await getAudioFileDuration(file);

            await putMusicFile({
                id: fileId,
                blob: file,
                type: file.type || 'audio/*',
                name: file.name,
                size: file.size,
                importedAt: Date.now()
            });

            importedSongs.push(createImportedMusicSong({
                id: songId,
                title: getMusicTitleFromFileName(file.name),
                artist: '本地音乐',
                duration,
                fileName: file.name,
                fileId,
                importedAt: Date.now(),
                sourceType: 'file'
            }));
            importedCount += 1;
        } catch (error) {
            console.warn('导入音乐失败:', error);
            unsupportedCount += 1;
        }
    }

    if (input) input.value = '';

    if (importedSongs.length) {
        const currentSongId = getCurrentSong()?.id || '';
        musicLibrary = [...importedSongs, ...musicLibrary];
        saveMusicLibrary();
        rebuildMusicSongs();
        if (musicState.isPlaying && currentSongId) {
            const nextCurrentIndex = songs.findIndex(song => song.id === currentSongId);
            musicState.currentIndex = nextCurrentIndex >= 0 ? nextCurrentIndex : 0;
        } else {
            musicState.currentIndex = 0;
        }
        renderMusicSongList();
        updateMusicUI();
        showMusicToast(`已导入 ${importedCount} 首歌曲`);
    }

    if (unsupportedCount > 0) {
        showMusicToast(importedCount > 0 ? '部分文件格式不支持' : '文件格式不支持', { type: 'error' });
    }
}

function openMusicLinkImport() {
    closeMusicImportSheet();
    const modal = document.getElementById('musicLinkModal');
    const input = document.getElementById('musicLinkInput');
    setMusicLinkImportLoading(false);
    if (modal) modal.hidden = false;
    if (input) {
        input.value = '';
        setTimeout(() => input.focus(), 40);
    }
}

function closeMusicLinkImport() {
    const modal = document.getElementById('musicLinkModal');
    if (modal) modal.hidden = true;
}

function setMusicLinkImportLoading(isLoading) {
    musicState.linkImportLoading = Boolean(isLoading);
    const button = document.getElementById('musicLinkSubmitBtn');
    const input = document.getElementById('musicLinkInput');
    if (button) {
        button.disabled = musicState.linkImportLoading;
        button.textContent = musicState.linkImportLoading ? '导入中' : '导入';
    }
    if (input) input.disabled = musicState.linkImportLoading;
}

function openMusicSearchImport() {
    closeMusicImportSheet();
    const modal = document.getElementById('musicSearchModal');
    const input = document.getElementById('musicSearchInput');
    musicState.searchResults = [];
    musicState.searchAddingId = '';
    setMusicSearchLoading(false);
    renderMusicSearchResults();
    if (modal) modal.hidden = false;
    if (input) {
        input.value = '';
        setTimeout(() => input.focus(), 40);
    }
}

function closeMusicSearchImport() {
    const modal = document.getElementById('musicSearchModal');
    if (modal) modal.hidden = true;
}

function setMusicSearchLoading(isLoading) {
    musicState.searchImportLoading = Boolean(isLoading);
    const button = document.getElementById('musicSearchSubmitBtn');
    const input = document.getElementById('musicSearchInput');
    if (button) {
        button.disabled = musicState.searchImportLoading;
        button.textContent = musicState.searchImportLoading ? '搜索中' : '搜索';
    }
    if (input) input.disabled = musicState.searchImportLoading;
}

function renderMusicSearchResults(message = '') {
    const container = document.getElementById('musicSearchResults');
    if (!container) return;

    if (message) {
        container.innerHTML = `<div class="music-search-empty">${escapeHtml(message)}</div>`;
        return;
    }

    const results = Array.isArray(musicState.searchResults) ? musicState.searchResults : [];
    if (!results.length) {
        container.innerHTML = '<div class="music-search-empty">输入关键词后搜索</div>';
        return;
    }

    container.innerHTML = results.map((song) => {
        const music163Id = String(song.music163Id || song.id || '').trim();
        const isAdding = musicState.searchAddingId === music163Id;
        const isAdded = musicLibrary.some(item => String(item.music163Id || '') === music163Id);
        return `
            <div class="music-search-row">
                <span class="music-search-cover">${song.cover ? `<img src="${escapeHtml(song.cover)}" alt="">` : '♪'}</span>
                <span class="music-search-meta">
                    <strong>${escapeHtml(song.title || '未知歌曲')}</strong>
                    <small>${escapeHtml(song.artist || '未知歌手')}</small>
                </span>
                <button class="music-search-play" type="button" onclick="addMusicSearchSong('${escapeHtml(music163Id)}')" ${isAdding || isAdded ? 'disabled' : ''} aria-label="${isAdding ? '添加中' : (isAdded ? '已添加' : '添加并播放')}">
                    ${isAdding ? '<span class="music-search-spin"></span>' : (isAdded ? '✓' : '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6.5v11l8-5.5-8-5.5Z"/></svg>')}
                </button>
            </div>
        `;
    }).join('');
}

function openMusicUidImport() {
    closeMusicImportSheet();
    const modal = document.getElementById('musicUidModal');
    const input = document.getElementById('musicUidInput');
    musicState.uidPlaylists = [];
    musicState.selectedPlaylistIds = new Set();
    setMusicUidLookupLoading(false);
    setMusicUidImportLoading(false);
    renderMusicUidPlaylists();
    if (modal) modal.hidden = false;
    if (input) {
        input.value = '';
        setTimeout(() => input.focus(), 40);
    }
}

function closeMusicUidImport() {
    const modal = document.getElementById('musicUidModal');
    if (modal) modal.hidden = true;
}

function setMusicUidLookupLoading(isLoading) {
    musicState.uidImportLoading = Boolean(isLoading);
    const button = document.getElementById('musicUidLookupBtn');
    const input = document.getElementById('musicUidInput');
    if (button) {
        button.disabled = musicState.uidImportLoading || musicState.uidImporting;
        button.textContent = musicState.uidImportLoading ? '搜索中' : '搜索';
    }
    if (input) input.disabled = musicState.uidImportLoading || musicState.uidImporting;
}

function setMusicUidImportLoading(isLoading) {
    musicState.uidImporting = Boolean(isLoading);
    const importButton = document.getElementById('musicUidImportBtn');
    const lookupButton = document.getElementById('musicUidLookupBtn');
    const input = document.getElementById('musicUidInput');
    if (importButton) {
        importButton.disabled = musicState.uidImporting || musicState.selectedPlaylistIds.size <= 0;
        importButton.textContent = musicState.uidImporting ? '导入中' : '导入选中歌单';
    }
    if (lookupButton) lookupButton.disabled = musicState.uidImporting || musicState.uidImportLoading;
    if (input) input.disabled = musicState.uidImporting || musicState.uidImportLoading;
}

function renderMusicUidPlaylists(message = '') {
    const container = document.getElementById('musicUidResults');
    if (!container) return;

    if (message) {
        container.innerHTML = `<div class="music-search-empty">${escapeHtml(message)}</div>`;
        setMusicUidImportLoading(false);
        return;
    }

    const playlists = Array.isArray(musicState.uidPlaylists) ? musicState.uidPlaylists : [];
    if (!playlists.length) {
        container.innerHTML = '<div class="music-search-empty">搜索 UID 后选择歌单</div>';
        setMusicUidImportLoading(false);
        return;
    }

    container.innerHTML = playlists.map((playlist, index) => {
        const id = String(playlist.id || '').trim();
        const isSelected = musicState.selectedPlaylistIds.has(id);
        const title = playlist.title || (index === 0 ? '喜欢的音乐' : `歌单 ${index + 1}`);
        const countText = `${Math.max(0, Number(playlist.trackCount) || 0)} 首歌曲`;
        return `
            <button class="music-uid-row ${isSelected ? 'is-selected' : ''}" type="button" onclick="toggleMusicPlaylistSelection('${escapeHtml(id)}')">
                <span class="music-uid-cover">${playlist.cover ? `<img src="${escapeHtml(buildMusicImageProxyUrl(playlist.cover))}" alt="">` : '<span></span>'}</span>
                <span class="music-uid-meta">
                    <strong>${escapeHtml(title)}</strong>
                    <small>${escapeHtml(countText)}</small>
                </span>
                <span class="music-uid-check" aria-hidden="true"></span>
            </button>
        `;
    }).join('');
    setMusicUidImportLoading(false);
}

function toggleMusicPlaylistSelection(playlistId) {
    const id = String(playlistId || '').trim();
    if (!id || musicState.uidImporting) return;

    if (musicState.selectedPlaylistIds.has(id)) {
        musicState.selectedPlaylistIds.delete(id);
    } else {
        musicState.selectedPlaylistIds.add(id);
    }
    renderMusicUidPlaylists();
}

async function submitMusicUidLookup(event) {
    if (event) {
        event.preventDefault();
        event.stopPropagation();
    }
    if (musicState.uidImportLoading || musicState.uidImporting) return;

    const input = document.getElementById('musicUidInput');
    const uid = String(input?.value || '').trim();
    if (!/^\d+$/.test(uid)) {
        renderMusicUidPlaylists('请输入数字 UID');
        return;
    }

    setMusicUidLookupLoading(true);
    renderMusicUidPlaylists('正在读取公开歌单...');
    try {
        const { data } = await fetchFirstMusicApiJson(`/api/music163/user-playlists?uid=${encodeURIComponent(uid)}&t=${Date.now()}`);
        musicState.uidPlaylists = Array.isArray(data?.playlists) ? data.playlists : [];
        musicState.selectedPlaylistIds = new Set();
        const defaultPlaylist = musicState.uidPlaylists.find(playlist => {
            const title = String(playlist?.title || '').trim();
            return playlist?.id && !/喜欢的音乐|liked songs/i.test(title);
        }) || musicState.uidPlaylists[0];
        if (defaultPlaylist?.id) {
            musicState.selectedPlaylistIds.add(String(defaultPlaylist.id));
        }
        renderMusicUidPlaylists(musicState.uidPlaylists.length ? '' : '没有找到公开歌单');
    } catch (error) {
        console.warn('读取网易云用户歌单失败:', error);
        musicState.uidPlaylists = [];
        musicState.selectedPlaylistIds = new Set();
        renderMusicUidPlaylists(error?.message === '音乐服务未启动' ? '音乐服务未启动，请先运行服务' : '读取歌单失败，请确认 UID 或稍后重试');
    } finally {
        setMusicUidLookupLoading(false);
        setMusicUidImportLoading(false);
    }
}

async function submitSelectedMusicPlaylists() {
    if (musicState.uidImporting || musicState.selectedPlaylistIds.size <= 0) return;

    const selectedIds = [...musicState.selectedPlaylistIds];
    setMusicUidImportLoading(true);
    try {
        const batches = await Promise.all(selectedIds.map(id => buildMusic163SongsFromPlaylistId(id, { force: true }).catch(error => {
            console.warn('导入网易云歌单失败:', id, error);
            return [];
        })));
        const importedSongs = batches.flat();
        if (!importedSongs.length) {
            throw new Error('playlist-unavailable');
        }

        addImportedMusicSongsToLibrary(importedSongs);
        closeMusicUidImport();
        showMusicToast(`已导入 ${importedSongs.length} 首歌曲`);
    } catch (error) {
        console.warn('批量导入网易云歌单失败:', error);
        showMusicToast('导入失败，请换一个公开歌单', { type: 'error' });
    } finally {
        setMusicUidImportLoading(false);
    }
}

async function submitMusicSearchImport(event) {
    if (event) {
        event.preventDefault();
        event.stopPropagation();
    }
    if (musicState.searchImportLoading) return;

    const input = document.getElementById('musicSearchInput');
    const keyword = String(input?.value || '').trim();
    if (!keyword) {
        renderMusicSearchResults('请输入歌曲名或歌手');
        return;
    }

    setMusicSearchLoading(true);
    renderMusicSearchResults('搜索中...');
    try {
        const { data } = await fetchFirstMusicApiJson(`/api/music163/search?q=${encodeURIComponent(keyword)}&limit=20`);

        musicState.searchResults = Array.isArray(data?.songs) ? data.songs : [];
        renderMusicSearchResults(musicState.searchResults.length ? '' : '没有搜到歌曲');
    } catch (error) {
        console.warn('搜索网易云歌曲失败:', error);
        musicState.searchResults = [];
        renderMusicSearchResults(error?.message === '音乐服务未启动' ? '音乐服务未启动，请先运行服务' : '搜索失败，请稍后重试');
    } finally {
        setMusicSearchLoading(false);
    }
}

async function addMusicSearchSong(music163Id) {
    const normalizedId = String(music163Id || '').trim();
    if (!/^\d+$/.test(normalizedId) || musicState.searchAddingId) return;

    const alreadyAdded = musicLibrary.find(item => String(item.music163Id || '') === normalizedId);
    if (alreadyAdded) {
        showMusicToast('这首歌已经在列表里了');
        renderMusicSearchResults();
        return;
    }

    musicState.searchAddingId = normalizedId;
    renderMusicSearchResults();
    try {
        const response = await fetch(buildMusicApiUrl(`/api/music163/resolve?id=${encodeURIComponent(normalizedId)}&source=search`), {
            method: 'GET',
            cache: 'no-store'
        });
        const data = await response.json().catch(() => null);
        if (!response.ok) {
            throw new Error(data?.error?.code || 'music-unavailable');
        }

        const importedSong = createMusic163ImportedSong(data, 0, 'url');
        if (!importedSong) throw new Error('music-unavailable');
        addImportedMusicSongsToLibrary([importedSong]);
        closeMusicSearchImport();
        showMusicToast('已添加歌曲');
        const nextIndex = songs.findIndex(song => song.id === importedSong.id);
        if (nextIndex >= 0) {
            playSongAtIndex(nextIndex, { showPlayer: true, forcePlay: true });
        }
    } catch (error) {
        console.warn('添加搜索歌曲失败:', error);
        const searchSong = musicState.searchResults.find(song => String(song.music163Id || song.id || '') === normalizedId);
        if (searchSong) {
            const importedSong = createMusic163ImportedSong({
                ...searchSong,
                id: normalizedId,
                music163Id: normalizedId,
                playable: true
            }, 0, 'url');
            if (importedSong) {
                addImportedMusicSongsToLibrary([importedSong]);
                closeMusicSearchImport();
                showMusicToast('已添加，播放时继续解析');
                const nextIndex = songs.findIndex(song => song.id === importedSong.id);
                if (nextIndex >= 0) {
                    playSongAtIndex(nextIndex, { showPlayer: true, forcePlay: true });
                }
            } else {
                showMusicToast('这首歌暂时无法添加', { type: 'error' });
            }
        } else {
            showMusicToast('这首歌暂时无法添加', { type: 'error' });
        }
    } finally {
        musicState.searchAddingId = '';
        renderMusicSearchResults();
    }
}

function parseMusicPlaylistPayload(payload, sourceType = 'playlist-url') {
    const rawSongs = Array.isArray(payload)
        ? payload
        : (Array.isArray(payload?.songs) ? payload.songs : []);

    return rawSongs
        .map((item, index) => {
            if (!item || typeof item !== 'object' || !item.url) return null;
            return createImportedMusicSong({
                title: item.title || getMusicTitleFromUrl(item.url) || `歌单歌曲 ${index + 1}`,
                artist: item.artist || '链接导入',
                duration: Math.max(0, Math.round(Number(item.duration) || 0)),
                url: String(item.url).trim(),
                directUrl: item.directUrl || '',
                cover: getMusicCoverFromPayload(item),
                importedAt: Date.now(),
                sourceType
            });
        })
        .filter(Boolean);
}

function parseMusicJsonImport(rawText) {
    const payload = JSON.parse(rawText);
    const songsFromPlaylist = parseMusicPlaylistPayload(payload, 'playlist-url');
    if (songsFromPlaylist.length > 0) return songsFromPlaylist;

    if (payload && typeof payload === 'object' && payload.url) {
        return [
            createImportedMusicSong({
                title: payload.title || getMusicTitleFromUrl(payload.url),
                artist: payload.artist || '链接导入',
                duration: Math.max(0, Math.round(Number(payload.duration) || 0)),
                url: String(payload.url).trim(),
                cover: getMusicCoverFromPayload(payload),
                importedAt: Date.now(),
                sourceType: 'url'
            })
        ];
    }

    return [];
}

async function buildMusicSongFromAudioUrl(url) {
    const duration = await getAudioUrlDuration(url).catch(() => 0);
    return createImportedMusicSong({
        title: getMusicTitleFromUrl(url),
        artist: '链接导入',
        duration,
        url,
        importedAt: Date.now(),
        sourceType: 'url'
    });
}

async function fetchMusicPlaylistJson(url) {
    const response = await fetch(url, { method: 'GET' });
    if (!response.ok) {
        throw new Error(`请求失败：${response.status}`);
    }

    return response.json();
}

async function forceBuildMusic163PlaylistFromValue(value) {
    const playlistId = extractMusic163PlaylistId(value) || extractLooseMusic163PlaylistId(value);
    if (!playlistId) return [];

    for (let attempt = 0; attempt < 2; attempt += 1) {
        try {
            const songs = await buildMusic163SongsFromPlaylistId(playlistId, { force: true });
            if (songs.length) return songs;
        } catch (error) {
            console.warn('网易云歌单强制导入重试失败:', error);
        }
    }

    return [];
}

async function resolveMusicLinkImport(inputValue) {
    const value = String(inputValue || '').trim();
    if (!value) return [];

    if (/^[\[{]/.test(value)) {
        return parseMusicJsonImport(value);
    }

    if (isLikelyMusic163ImportValue(value)) {
        try {
            return await buildMusic163SongsFromShareText(value);
        } catch (error) {
            const forcedSongs = await forceBuildMusic163PlaylistFromValue(value);
            if (forcedSongs.length) return forcedSongs;
            if (error?.message === 'music-unavailable') throw error;
        }
    }

    const candidateUrls = extractMusicImportUrlCandidates(value);
    if (!candidateUrls.length) {
        const forcedSongs = await forceBuildMusic163PlaylistFromValue(value);
        if (forcedSongs.length) return forcedSongs;
        throw new Error('unsupported-link');
    }

    const orderedUrls = [
        ...candidateUrls.filter(isLikelyMusic163ShareUrl),
        ...candidateUrls.filter(url => !isLikelyMusic163ShareUrl(url))
    ];
    let lastError = null;

    for (const url of orderedUrls) {
        try {
            if (isLikelyMusic163ShareUrl(url)) {
                if (extractMusic163PlaylistId(url) || extractLooseMusic163PlaylistId(url)) {
                    try {
                        return await buildMusic163SongsFromPlaylistUrl(url);
                    } catch (error) {
                        lastError = error;
                    }
                }

                if (extractMusic163SongId(url)) {
                    try {
                        return [await buildMusic163SongFromPageUrl(url)];
                    } catch (error) {
                        if (error?.message === 'music-unavailable') throw error;
                    }
                }

                try {
                    return await buildMusic163SongsFromShareUrl(url);
                } catch (error) {
                    if (error?.message === 'music-unavailable' || error?.message === 'playlist-unavailable') {
                        throw error;
                    }
                    if (extractMusic163PlaylistId(url) || extractLooseMusic163PlaylistId(url)) {
                        return await buildMusic163SongsFromPlaylistUrl(url);
                    }
                    if (extractMusic163SongId(url) || extractLooseMusic163SongId(url)) {
                        return [await buildMusic163SongFromPageUrl(url)];
                    }
                    throw error;
                }
            }

            if (isProbablyAudioUrl(url)) {
                return [await buildMusicSongFromAudioUrl(url)];
            }

            if (extractMusic163PlaylistId(url) || extractLooseMusic163PlaylistId(url)) {
                return await buildMusic163SongsFromPlaylistUrl(url);
            }

            if (extractMusic163SongId(url) || extractLooseMusic163SongId(url)) {
                return [await buildMusic163SongFromPageUrl(url)];
            }

            const payload = await fetchMusicPlaylistJson(url);
            const playlistSongs = parseMusicPlaylistPayload(payload, 'playlist-url');
            if (playlistSongs.length > 0) return playlistSongs;
        } catch (error) {
            lastError = error;
            if (error?.message === 'playlist-unavailable' && (extractMusic163PlaylistId(url) || extractLooseMusic163PlaylistId(url))) {
                const forcedSongs = await forceBuildMusic163PlaylistFromValue(url);
                if (forcedSongs.length) return forcedSongs;
            }
            if (error?.message === 'music-unavailable' || error?.message === 'playlist-unavailable') {
                throw error;
            }
        }
    }

    throw lastError || new Error('unsupported-link');
}

function addImportedMusicSongsToLibrary(importedSongs, options = {}) {
    const currentSongId = getCurrentSong()?.id || '';
    const firstPlayableImportIndex = importedSongs.findIndex(song => (
        song
        && song.playable !== false
        && Boolean(song.url || song.directUrl || song.fileId)
    ));
    musicLibrary = [...importedSongs, ...musicLibrary];
    saveMusicLibrary();
    rebuildMusicSongs();
    if ((musicState.isPlaying || options.preserveCurrent) && currentSongId) {
        const nextCurrentIndex = songs.findIndex(song => song.id === currentSongId);
        musicState.currentIndex = nextCurrentIndex >= 0 ? nextCurrentIndex : 0;
    } else {
        musicState.currentIndex = firstPlayableImportIndex >= 0 ? firstPlayableImportIndex : 0;
    }
    renderMusicSongList();
    updateMusicUI();
    if (!options.keepLinkModal) closeMusicLinkImport();
}

function getSelectedDeletableMusicSongs() {
    return songs.filter(song => musicState.selectedSongIds.has(song.id));
}

function updateMusicMultiSelectUI() {
    const toggleBtn = document.getElementById('musicMultiSelectBtn');
    const actionBar = document.getElementById('musicBulkActionBar');
    const selectedCount = document.getElementById('musicBulkSelectedCount');
    const deleteBtn = document.getElementById('musicBulkDeleteBtn');
    const app = document.getElementById('app-music');
    const selectedDeletableCount = getSelectedDeletableMusicSongs().length;

    if (app) app.classList.toggle('is-music-selecting', Boolean(musicState.multiSelectMode));
    if (toggleBtn) toggleBtn.textContent = musicState.multiSelectMode ? '完成' : '多选';
    if (actionBar) actionBar.hidden = !musicState.multiSelectMode;
    if (selectedCount) selectedCount.textContent = `已选 ${musicState.selectedSongIds.size} 首`;
    if (deleteBtn) {
        deleteBtn.disabled = selectedDeletableCount <= 0;
        deleteBtn.textContent = '删除';
    }
}

function toggleMusicMultiSelectMode() {
    closeMusicSongMenu();
    musicState.multiSelectMode = !musicState.multiSelectMode;
    if (!musicState.multiSelectMode) {
        musicState.selectedSongIds.clear();
    }
    renderMusicSongList();
}

function toggleMusicSongSelection(event, songId) {
    if (event) {
        event.preventDefault();
        event.stopPropagation();
    }

    if (!musicState.multiSelectMode || !songId) return;

    if (musicState.selectedSongIds.has(songId)) {
        musicState.selectedSongIds.delete(songId);
    } else {
        musicState.selectedSongIds.add(songId);
    }

    renderMusicSongList();
}

function selectAllImportedMusicSongs() {
    if (!musicState.multiSelectMode) return;

    songs.forEach(song => {
        musicState.selectedSongIds.add(song.id);
    });
    renderMusicSongList();
}

function cancelMusicMultiSelect() {
    musicState.multiSelectMode = false;
    musicState.selectedSongIds.clear();
    renderMusicSongList();
}

async function deleteSelectedMusicSongs() {
    const selectedSongs = getSelectedDeletableMusicSongs();
    if (!selectedSongs.length) {
        showMusicToast('请选择可删除的导入歌曲');
        return;
    }

    if (!confirm(`确定删除选中的 ${selectedSongs.length} 首歌曲吗？`)) return;

    const selectedIds = new Set(selectedSongs.map(song => song.id));
    const selectedFileIds = selectedSongs
        .filter(song => isFileSourceSong(song) && song.fileId)
        .map(song => song.fileId);
    const currentSong = getCurrentSong();
    const currentSongId = currentSong?.id || '';
    const deletingCurrentSong = currentSong && selectedIds.has(currentSong.id);

    if (deletingCurrentSong) {
        pauseCurrentSong();
        const audio = getMusicAudio();
        if (audio) {
            audio.removeAttribute('src');
            audio.load();
        }
        revokeMusicObjectUrl(true);
    }

    const hiddenDemoChanged = selectedSongs.some(song => song.source !== 'imported');
    selectedSongs.forEach(song => {
        if (song.source !== 'imported') hiddenDemoMusicSongIds.add(String(song.id));
    });
    musicLibrary = musicLibrary.filter(song => !selectedIds.has(song.id));
    saveMusicLibrary();
    if (hiddenDemoChanged) saveHiddenDemoMusicSongs();
    rebuildMusicSongs();

    for (const fileId of selectedFileIds) {
        try {
            await deleteMusicFile(fileId);
        } catch (error) {
            console.warn('删除音乐文件失败:', error);
        }
    }

    musicState.selectedSongIds.clear();
    musicState.multiSelectMode = false;
    if (deletingCurrentSong) {
        musicState.currentIndex = findPlayableMusicIndex(0, 1);
        if (musicState.currentIndex < 0) musicState.currentIndex = 0;
        musicState.currentTime = 0;
        musicState.isPlaying = false;
        await syncMusicAudioSource(getCurrentSong()).catch(error => {
            console.warn('同步音乐文件失败:', error);
        });
    } else if (currentSongId) {
        const nextCurrentIndex = songs.findIndex(song => song.id === currentSongId);
        musicState.currentIndex = nextCurrentIndex >= 0 ? nextCurrentIndex : Math.min(musicState.currentIndex, Math.max(0, songs.length - 1));
    } else {
        musicState.currentIndex = Math.min(musicState.currentIndex, Math.max(0, songs.length - 1));
    }

    renderMusicSongList();
    updateMusicUI();
    showMusicToast(`已删除 ${selectedSongs.length} 首歌曲`);
}

async function submitMusicLinkImport() {
    const input = document.getElementById('musicLinkInput');
    const rawValue = input?.value || '';
    if (musicState.linkImportLoading) return;

    try {
        setMusicLinkImportLoading(true);
        const importedSongs = await resolveMusicLinkImport(rawValue);
        if (!importedSongs.length) {
            throw new Error('unsupported-link');
        }

        addImportedMusicSongsToLibrary(importedSongs);
        showMusicToast(`已导入 ${importedSongs.length} 首歌曲`);
    } catch (error) {
        console.warn('链接导入失败:', error);
        const value = String(rawValue || '').trim();
        const candidateUrls = extractMusicImportUrlCandidates(value);
        const hasMusic163Candidate = candidateUrls.some(isLikelyMusic163ShareUrl);
        if (
            isLikelyMusic163ImportValue(value)
            && ['playlist-unavailable', 'platform-link-unsupported', 'unsupported-link'].includes(error?.message)
        ) {
            const forcedSongs = await forceBuildMusic163PlaylistFromValue(value);
            if (forcedSongs.length) {
                addImportedMusicSongsToLibrary(forcedSongs);
                showMusicToast(`已绕过播放检查，导入 ${forcedSongs.length} 首歌曲`);
                return;
            }
        }
        const isLikelyPlatformShare = candidateUrls.length > 0
            && !candidateUrls.some(isProbablyAudioUrl)
            && !candidateUrls.some(isProbablyJsonUrl)
            && !candidateUrls.some(extractMusic163PlaylistId)
            && !candidateUrls.some(extractMusic163SongId);
        showMusicToast(
            error?.message === 'music-unavailable'
                ? '该歌曲暂时没有可播放链接'
                : error?.message === 'playlist-unavailable'
                    ? '该歌单没有返回可导入的歌曲'
                : error?.message === 'platform-link-unsupported'
                    ? (hasMusic163Candidate ? '网易云链接解析失败，请换一个公开分享链接' : '平台分享链接不能直接播放，请使用音频直链或本地文件')
                : (isLikelyPlatformShare ? '暂不支持解析该平台链接，请使用直链音频或歌单 JSON' : '导入失败，请检查链接或格式'),
            { type: 'error' }
        );
    } finally {
        setMusicLinkImportLoading(false);
    }
}

function openMusicSongMenu(event, songId) {
    if (event) {
        event.preventDefault();
        event.stopPropagation();
    }

    if (musicState.multiSelectMode) return;

    const menu = document.getElementById('musicSongMenu');
    const content = document.querySelector('#app-music .music-content');
    const miniPlayer = document.getElementById('musicMiniPlayer');
    const song = songs.find(item => item.id === songId);
    if (!menu || !content || !song) return;

    musicState.menuSongId = songId;
    const contentRect = content.getBoundingClientRect();
    const left = Math.min(Math.max(12, (event?.clientX || contentRect.right) - contentRect.left - 142), contentRect.width - 156);
    menu.style.left = `${left}px`;
    menu.style.top = '12px';
    menu.hidden = false;
    menu.classList.toggle('is-demo-song', song.source !== 'imported');
    const deleteLyricBtn = document.getElementById('musicDeleteLyricMenuBtn');
    if (deleteLyricBtn) {
        const lyric = String(song.lyric || '').trim();
        deleteLyricBtn.hidden = !lyric || lyric === '链接音乐播放中' || lyric === '本地音乐播放中';
    }
    const menuHeight = menu.offsetHeight || 190;
    const miniRect = miniPlayer?.getBoundingClientRect();
    const bottomLimit = miniRect
        ? Math.max(12, miniRect.top - contentRect.top - 10)
        : (contentRect.height - 12);
    const wantedTop = (event?.clientY || contentRect.top) - contentRect.top + 8;
    const top = Math.min(Math.max(12, wantedTop), Math.max(12, bottomLimit - menuHeight));
    menu.style.top = `${top}px`;
}

function closeMusicSongMenu() {
    const menu = document.getElementById('musicSongMenu');
    if (menu) menu.hidden = true;
    musicState.menuSongId = '';
}

function closeMusicImportOverlays() {
    closeMusicImportSheet();
    closeMusicLinkImport();
    closeMusicSearchImport();
    closeMusicUidImport();
}

function setMusicMenuSongAsCurrent() {
    const index = songs.findIndex(song => song.id === musicState.menuSongId);
    closeMusicSongMenu();
    if (index >= 0) {
        playSongAtIndex(index, { showPlayer: true, forcePlay: false });
    }
}

async function deleteMusicMenuSong() {
    const songId = musicState.menuSongId;
    closeMusicSongMenu();
    await deleteMusicSong(songId);
}

function importMusicMenuSongLyric() {
    const song = getMusicMenuSong();
    if (!song) {
        showMusicToast('请先选择歌曲', { type: 'error' });
        return;
    }

    const input = document.getElementById('musicLyricFileInput');
    if (!input) {
        showMusicToast('歌词导入入口不可用', { type: 'error' });
        return;
    }

    input.dataset.songId = song.id;
    input.value = '';
    closeMusicSongMenu();
    input.click();
}

function handleMusicLyricFileImport(event) {
    const input = event?.target;
    const file = input?.files?.[0];
    const songId = input?.dataset?.songId || musicState.menuSongId;
    const song = getMusicSongById(songId);
    if (!file || !song) {
        if (input) input.value = '';
        return;
    }

    const reader = new FileReader();
    reader.onload = () => {
        const lyric = String(reader.result || '').trim();
        if (!lyric) {
            showMusicToast('歌词文件是空的', { type: 'error' });
            return;
        }
        updateMusicSongLyric(song, lyric);
        updateMusicUI();
        showMusicToast('歌词已导入');
    };
    reader.onerror = () => {
        showMusicToast('歌词文件读取失败', { type: 'error' });
    };
    reader.onloadend = () => {
        if (input) {
            input.value = '';
            delete input.dataset.songId;
        }
    };
    reader.readAsText(file, 'utf-8');
}

function openMusicMenuLyricEditor() {
    const song = getMusicMenuSong();
    if (!song) {
        showMusicToast('请先选择歌曲', { type: 'error' });
        return;
    }

    const modal = document.getElementById('musicLyricModal');
    const input = document.getElementById('musicLyricInput');
    if (!modal || !input) return;

    modal.dataset.songId = song.id;
    input.value = ['链接音乐播放中', '本地音乐播放中'].includes(String(song.lyric || '').trim())
        ? ''
        : String(song.lyric || '');
    closeMusicSongMenu();
    modal.hidden = false;
    setTimeout(() => input.focus(), 40);
}

function closeMusicLyricEditor() {
    const modal = document.getElementById('musicLyricModal');
    if (modal) {
        modal.hidden = true;
        delete modal.dataset.songId;
    }
}

function saveMusicLyricEditor() {
    const modal = document.getElementById('musicLyricModal');
    const input = document.getElementById('musicLyricInput');
    const song = getMusicSongById(modal?.dataset?.songId || musicState.menuSongId);
    const lyric = String(input?.value || '').trim();
    if (!song) {
        showMusicToast('请先选择歌曲', { type: 'error' });
        return;
    }
    if (!lyric) {
        showMusicToast('请粘贴歌词内容', { type: 'error' });
        return;
    }

    updateMusicSongLyric(song, lyric);
    closeMusicLyricEditor();
    updateMusicUI();
    showMusicToast('歌词已保存');
}

function deleteMusicMenuSongLyric() {
    const song = getMusicMenuSong();
    if (!song) return;

    updateMusicSongLyric(song, song.sourceType === 'file' ? '本地音乐播放中' : '链接音乐播放中');
    closeMusicSongMenu();
    updateMusicUI();
    showMusicToast('歌词已删除');
}

async function deleteMusicSong(songId) {
    const song = songs.find(item => item.id === songId);
    if (!song) return;

    if (song.source !== 'imported') {
        const wasCurrentDemo = getCurrentSong()?.id === song.id;
        if (wasCurrentDemo) {
            pauseCurrentSong();
            const audio = getMusicAudio();
            if (audio) {
                audio.removeAttribute('src');
                audio.load();
            }
            revokeMusicObjectUrl(true);
        }

        hiddenDemoMusicSongIds.add(String(song.id));
        saveHiddenDemoMusicSongs();
        rebuildMusicSongs();
        if (wasCurrentDemo) {
            musicState.currentIndex = findPlayableMusicIndex(0, 1);
            if (musicState.currentIndex < 0) musicState.currentIndex = 0;
            musicState.currentTime = 0;
            musicState.isPlaying = false;
            await syncMusicAudioSource(getCurrentSong()).catch(error => {
                console.warn('同步音乐文件失败:', error);
            });
        } else if (!songs[musicState.currentIndex]) {
            musicState.currentIndex = 0;
        }
        renderMusicSongList();
        updateMusicUI();
        showMusicToast('歌曲已删除');
        return;
    }

    if (song.source !== 'imported') {
        showMusicToast('示例歌曲不能删除');
        return;
    }

    const wasCurrent = getCurrentSong()?.id === song.id;
    const currentSongId = getCurrentSong()?.id || '';
    if (wasCurrent) {
        pauseCurrentSong();
        const audio = getMusicAudio();
        if (audio) {
            audio.removeAttribute('src');
            audio.load();
        }
        revokeMusicObjectUrl(true);
    }

    musicLibrary = musicLibrary.filter(item => item.id !== song.id);
    saveMusicLibrary();
    rebuildMusicSongs();

    if (isFileSourceSong(song) && song.fileId) {
        try {
            await deleteMusicFile(song.fileId);
        } catch (error) {
            console.warn('删除音乐文件失败:', error);
        }
    }

    if (wasCurrent) {
        musicState.currentIndex = 0;
        musicState.currentTime = 0;
        musicState.isPlaying = false;
        await syncMusicAudioSource(getCurrentSong()).catch(error => {
            console.warn('同步音乐文件失败:', error);
        });
    } else if (currentSongId) {
        const nextCurrentIndex = songs.findIndex(item => item.id === currentSongId);
        musicState.currentIndex = nextCurrentIndex >= 0 ? nextCurrentIndex : 0;
    } else if (!songs[musicState.currentIndex]) {
        musicState.currentIndex = 0;
    }

    renderMusicSongList();
    updateMusicUI();
    showMusicToast('歌曲已删除');
}

function seekMusicToPercent(percent) {
    const song = getCurrentSong();
    const duration = Math.max(1, getMusicAudioDuration(song) || 1);
    const nextTime = duration * (Math.min(100, Math.max(0, Number(percent) || 0)) / 100);
    seekMusicTo(nextTime);
}

function getMusicProgressPercentFromEvent(event) {
    const track = document.getElementById('musicProgressTrack');
    const rect = track?.getBoundingClientRect();
    if (!rect || rect.width <= 0) return 0;

    const clientX = Number(event?.clientX);
    const x = Number.isFinite(clientX) ? clientX : rect.left;
    return Math.min(100, Math.max(0, ((x - rect.left) / rect.width) * 100));
}

function previewMusicProgressPercent(percent) {
    musicState.progressDragPercent = Math.min(100, Math.max(0, Number(percent) || 0));
    updateMusicUI();
}

function beginMusicProgressDrag(event) {
    if (event?.button !== undefined && event.button !== 0) return;

    event.preventDefault();
    const progressEl = document.getElementById('musicProgress');
    musicState.progressDragging = true;
    previewMusicProgressPercent(getMusicProgressPercentFromEvent(event));
    if (progressEl && event.pointerId !== undefined) {
        progressEl.setPointerCapture?.(event.pointerId);
    }
}

function moveMusicProgressDrag(event) {
    if (!musicState.progressDragging) return;

    event.preventDefault();
    previewMusicProgressPercent(getMusicProgressPercentFromEvent(event));
}

function endMusicProgressDrag(event) {
    if (!musicState.progressDragging) return;

    event?.preventDefault?.();
    const percent = event ? getMusicProgressPercentFromEvent(event) : musicState.progressDragPercent;
    musicState.progressDragging = false;
    musicState.progressDragPercent = Math.min(100, Math.max(0, Number(percent) || 0));
    seekMusicToPercent(musicState.progressDragPercent);
    const progressEl = document.getElementById('musicProgress');
    if (progressEl && event?.pointerId !== undefined) {
        progressEl.releasePointerCapture?.(event.pointerId);
    }
}

function handleMusicProgressKeydown(event) {
    const key = event?.key;
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(key)) return;

    event.preventDefault();
    const song = getCurrentSong();
    const duration = Math.max(1, getMusicAudioDuration(song) || 1);
    const step = event.shiftKey ? 10 : 5;
    if (key === 'Home') {
        seekMusicTo(0);
    } else if (key === 'End') {
        seekMusicTo(duration);
    } else if (key === 'ArrowLeft') {
        seekMusicTo(musicState.currentTime - step);
    } else if (key === 'ArrowRight') {
        seekMusicTo(musicState.currentTime + step);
    }
}

function seekMusicTo(seconds) {
    const song = getCurrentSong();
    const duration = Math.max(1, getMusicAudioDuration(song) || 1);
    musicState.currentTime = Math.min(duration, Math.max(0, Number(seconds) || 0));

    const audio = getMusicAudio();
    if (audio && hasSongAudio(song)) {
        audio.currentTime = musicState.currentTime;
    }

    updateMusicUI();
}

function cycleMusicMode() {
    const currentMode = normalizeMusicPlaybackMode(musicState.mode);
    const nextIndex = (MUSIC_PLAYBACK_MODES.indexOf(currentMode) + 1) % MUSIC_PLAYBACK_MODES.length;
    musicState.mode = MUSIC_PLAYBACK_MODES[nextIndex];
    saveMusicPlaybackMode();
    showMusicToast(MUSIC_MODE_META[musicState.mode]?.toast || MUSIC_MODE_META.sequence.toast);
    updateMusicUI();
}

function showMusicHome() {
    closeMusicImportOverlays();
    musicState.page = 'home';
    const home = document.getElementById('musicHomePage');
    const player = document.getElementById('musicPlayerPage');
    if (home) home.hidden = false;
    if (player) player.hidden = true;
    renderMusicSongList();
    updateMusicUI();
}

function showMusicPlayer() {
    closeMusicImportOverlays();
    musicState.page = 'player';
    const home = document.getElementById('musicHomePage');
    const player = document.getElementById('musicPlayerPage');
    if (home) home.hidden = true;
    if (player) player.hidden = false;
    updateMusicUI();
}

function handleMusicBack() {
    if (musicState.page === 'player') {
        showMusicHome();
        return;
    }

    goHome();
}

function initMusicPlayer() {
    loadMusicPlaybackMode();
    loadMusicListeningProfile();
    loadMusicLibrary();
    bindMusicAudio();
    syncMusicAudioSource(getCurrentSong()).catch(error => {
        console.warn('初始化音乐文件失败:', error);
    });

    const progress = document.getElementById('musicProgress');
    if (progress) {
        progress.addEventListener('pointerdown', beginMusicProgressDrag);
        progress.addEventListener('pointermove', moveMusicProgressDrag);
        progress.addEventListener('pointerup', endMusicProgressDrag);
        progress.addEventListener('pointercancel', endMusicProgressDrag);
        progress.addEventListener('lostpointercapture', () => {
            if (musicState.progressDragging) {
                musicState.progressDragging = false;
                seekMusicToPercent(musicState.progressDragPercent);
            }
        });
        progress.addEventListener('keydown', handleMusicProgressKeydown);
    }

    const input = document.getElementById('musicFileInput');
    if (input) {
        input.addEventListener('change', handleMusicImport);
    }

    const lyricInput = document.getElementById('musicLyricFileInput');
    if (lyricInput) {
        lyricInput.addEventListener('change', handleMusicLyricFileImport);
    }

    document.addEventListener('click', (event) => {
        const menu = document.getElementById('musicSongMenu');
        if (!menu || menu.hidden) return;
        if (menu.contains(event.target)) return;
        if (event.target?.closest?.('.music-song-more')) return;
        closeMusicSongMenu();
    });

    renderMusicSongList();
    showMusicHome();
    updateMusicUI();
}

// ================= 存储空间显示 =================
function showStorage() {
    document.getElementById('storageModal').classList.add('active');
    // 延迟调用确保DOM已加载
    setTimeout(() => {
        updateStorageDisplay();
    }, 100);
}

function updateStorageDisplay() {
    if (window.DataManager) {
        DataManager.updateStorageDisplay();
    }
}

function updateStorageInfo() {
    // 定期更新设置页的存储显示
    if (currentApp === 'settings') {
        updateStorageDisplay();
    }
}

// ================= 数据导入/导出 =================
function exportData() {
    try {
        window.DataManager.exportData();
    } catch (e) {
        console.error('导出数据失败:', e);
        alert('导出数据失败：' + (e?.message || e));
    }
}

function importData() {
    try {
        const input = document.getElementById('importFile');
        if (!input) {
            alert('未找到导入文件选择器（importFile）');
            return;
        }
        input.click();
    } catch (e) {
        console.error('打开导入选择器失败:', e);
        alert('打开导入选择器失败：' + (e?.message || e));
    }
}

function handleImport(event) {
    const file = event.target.files && event.target.files[0];
    if (!file) return;

    const resetInput = () => {
        if (event.target) event.target.value = '';
    };

    const reader = new FileReader();
    reader.onload = async (e) => {
        try {
            const rawText = typeof e.target?.result === 'string' ? e.target.result : '';
            const data = JSON.parse(rawText);

            await window.DataManager.importData(data);
        } catch (err) {
            console.error('导入数据失败:', err);
            alert(`数据文件导入失败: ${err?.message || '文件格式错误'}`);
        } finally {
            resetInput();
        }
    };

    reader.onerror = () => {
        resetInput();
        alert('数据文件读取失败');
    };

    reader.readAsText(file, 'utf-8');
}

function resetWallpaperCache() {
    localStorage.removeItem('wallpaper');
    localStorage.removeItem('wallpaperType');
    applyHomeWallpaper('');
}

function resetMomentsCoverCache() {
    localStorage.removeItem('momentsBackgroundSettings');
    momentsBackgroundSettings = {
        background: MOMENTS_BACKGROUND_PRESETS[0].value,
        opacity: 1,
        scale: 100,
        blur: 0
    };

    applyMomentsBackground();
    renderMomentsCover();
}

function resetStickerLibraryCache() {
    chatStickerLibrary = [...DEFAULT_CHAT_STICKERS];
    saveChatStickerLibrary();
    renderChatStickerLibrary();
}

function clearChatImageSessionCache() {
    try {
        sessionStorage.removeItem(CHAT_IMAGE_SESSION_CACHE_KEY);
    } catch (error) {
        console.warn('清理聊天图片会话缓存失败:', error);
    }
}

function getSentMediaIdsFromHistory(history, mediaTypes = ['image']) {
    if (!Array.isArray(history)) return [];

    const ids = new Set();
    history.forEach((message) => {
        const content = message?.content;
        if (!content || typeof content !== 'object') return;
        if (!mediaTypes.includes(content.type)) return;

        if (content.imageId) {
            ids.add(String(content.imageId));
        }

        const refId = extractMediaIdFromRef(content.url);
        if (refId) {
            ids.add(refId);
        }
    });

    return Array.from(ids);
}

function stripSentMediaMessagesFromHistory(history, mediaTypes = ['image']) {
    if (!Array.isArray(history)) return history;

    return history.map((message) => {
        if (message && typeof message === 'object' && message.content && typeof message.content === 'object') {
            if (mediaTypes.includes(message.content.type)) {
                const isSticker = message.content.type === 'sticker';
                const label = isSticker ? message.content.label : message.content.name;
                return {
                    ...message,
                    content: `[${isSticker ? '表情包' : '图片'}缓存已清理${label ? `：${label}` : ''}]`
            
    };
            }
        }

        return message;
    });
}

function collectStoredMediaReferenceIds(mediaTypes = ['image']) {
    const ids = new Set();

    for (let index = 0; index < localStorage.length; index += 1) {
        const key = localStorage.key(index);
        if (!key) continue;

        if (key === 'chatHistory' || key.startsWith('roleChat_')) {
            const history = safeReadStorageJSON(key, null);
            getSentMediaIdsFromHistory(history, mediaTypes).forEach((id) => ids.add(id));
        }
    }

    getSentMediaIdsFromHistory(chatHistory, mediaTypes).forEach((id) => ids.add(id));

    return Array.from(ids);
}

function clearStoredMediaReferences(mediaTypes = ['image']) {
    for (let index = 0; index < localStorage.length; index += 1) {
        const key = localStorage.key(index);
        if (!key) continue;

        if (key === 'chatHistory' || key.startsWith('roleChat_')) {
            const history = safeReadStorageJSON(key, null);
            if (Array.isArray(history)) {
                safeWriteStorageJSON(key, stripSentMediaMessagesFromHistory(history, mediaTypes));
            }
        }
    }

    if (Array.isArray(chatHistory) && chatHistory.length > 0) {
        chatHistory = stripSentMediaMessagesFromHistory(chatHistory, mediaTypes);
    }

    // 按用户要求：仅清理聊天中已发送的媒体缓存，不清理角色、世界书、API设置或表情包库。
}

function isStoredImageValue(value) {
    if (typeof value !== 'string') return false;

    const normalized = value.trim();
    return (
        isDataImageUrl(normalized)
        || /^url\((['"]?)data:image\//i.test(normalized)
        || /^url\((['"]?)media:/i.test(normalized)
        || isMediaRef(normalized)
    );
}

function clearProfileImageCaches() {
    let changed = false;

    if (wechatUser && isStoredImageValue(wechatUser.avatar)) {
        wechatUser.avatar = 'white';
        saveWechatUser();
        changed = true;
    }

    if (Array.isArray(wechatRoles) && wechatRoles.length > 0) {
        wechatRoles = wechatRoles.map((role) => {
            if (!role || typeof role !== 'object' || !isStoredImageValue(role.avatar)) {
                return role;
            }

            changed = true;
            return {
                ...role,
                avatar: 'white'
        
    };
        });

        localStorage.setItem('wechatRoles', JSON.stringify(wechatRoles));
    }

    return changed;
}

function clearMomentImageCaches() {
    let changed = false;

    if (Array.isArray(moments) && moments.length > 0) {
        moments = moments.map((moment) => {
            if (!moment || typeof moment !== 'object') return moment;

            const nextMoment = { ...moment };

            if (Array.isArray(nextMoment.images) && nextMoment.images.length > 0) {
                nextMoment.images = [];
                changed = true;
            }

            if (isStoredImageValue(nextMoment.avatar)) {
                nextMoment.avatar = 'white';
                changed = true;
            }

            return nextMoment;
        });

        saveMoments();
    }

    return changed;
}

async function clearAllImageData() {
    resetWallpaperCache();
    resetMomentsCoverCache();
    clearChatImageSessionCache();
    clearStoredMediaReferences();
    clearProfileImageCaches();
    clearMomentImageCaches();

    try {
        await deleteChatMediaDatabase();
    } catch (error) {
        console.error('清理图片媒体库失败:', error);
    }

    if (document.getElementById('userProfile')) {
        renderUserProfile();
    }

    if (document.getElementById('wechatChatList')) {
        renderWechatChatList();
    }

    if (document.getElementById('chatBox') && currentRoleId) {
        await refreshChatViewForCurrentMode();
    }
}

async function clearChatImages() {
    const mediaIds = collectStoredMediaReferenceIds(['image']);

    // 1. 清除会话级图片缓存
    clearChatImageSessionCache();

    // 2. 清除 localStorage 中聊天记录里的图片引用
    clearStoredMediaReferences(['image']);

    // 3. 仅删除聊天记录引用过的图片媒体，避免误删朋友圈等持久图片
    try {
        await deleteChatMediaRecordsByIds(mediaIds);
    } catch (error) {
        console.error('清理聊天图片媒体库失败:', error);
    }
}

function clearSentStickerCache() {
    clearStoredMediaReferences(['sticker']);
}

function deleteChatMediaRecordsByIds(ids = []) {
    const uniqueIds = Array.from(new Set(ids.map((id) => String(id || '').trim()).filter(Boolean)));

    return new Promise(async (resolve, reject) => {
        if (!window.indexedDB || uniqueIds.length === 0) {
            resolve(false);
            return;
        }

        try {
            const db = await openChatMediaDatabase();
            const transaction = db.transaction(CHAT_MEDIA_STORE_NAME, 'readwrite');
            const store = transaction.objectStore(CHAT_MEDIA_STORE_NAME);

            uniqueIds.forEach((id) => {
                store.delete(id);
            });

            transaction.oncomplete = () => {
                db.close();
                resolve(true);
        
    };
            transaction.onerror = () => {
                db.close();
                reject(transaction.error || new Error('媒体缓存删除失败'));
        
    };
            transaction.onabort = () => {
                db.close();
                reject(transaction.error || new Error('媒体缓存删除已中止'));
        
    };
        } catch (error) {
            reject(error);
        }
    });
}

function deleteChatMediaDatabase() {
    return new Promise((resolve, reject) => {
        if (!window.indexedDB) {
            resolve(false);
            return;
        }

        let settled = false;
        const finish = (callback, payload) => {
            if (settled) return;
            settled = true;
            callback(payload);
        };

        const request = window.indexedDB.deleteDatabase(CHAT_MEDIA_DB_NAME);

        request.onsuccess = () => finish(resolve, true);
        request.onerror = () => finish(reject, request.error || new Error('媒体缓存数据库删除失败'));
        request.onblocked = () => finish(reject, new Error('媒体缓存数据库正被占用，请稍后重试'));
    });
}

function refreshCacheManagementUI() {
    if (currentApp === 'settings') {
        updateStorageDisplay();
    } else if (window.DataManager) {
        DataManager.updateStorageDisplay();
    }

    renderMomentsCover();
    if (document.getElementById('momentsList')) {
        renderMomentsList();
    }
    renderChatStickerLibrary();
    closeChatMediaPanel();
}

function showCacheToast(message) {
    if (window.DataManager) {
        DataManager.showToast(message);
    } else {
        alert(message);
    }
}

async function clearChatCache() {
    if (!confirm('⚠️确认清除聊天记录？\n\n此操作将删除所有角色的线上/线下聊天记录与共享记录，且不可恢复。\n\n请确认是否继续。')) {
        return;
    }

    if (Array.isArray(wechatRoles)) {
        wechatRoles.forEach((role) => {
            const roleId = role?.id;
            if (!roleId) return;

            localStorage.removeItem(getChatStorageKey(roleId, 'online'));
            localStorage.removeItem(getChatStorageKey(roleId, 'offline'));
            localStorage.removeItem(getLegacyChatStorageKey(roleId));
            localStorage.removeItem(getSharedEventsStorageKey(roleId));
        });
    }

    localStorage.removeItem('chatHistory');
    chatHistory = [];

    const chatBox = document.getElementById('chatBox');
    if (chatBox) {
        chatBox.innerHTML = '';
    }

    const offlineStoryFeed = document.getElementById('offlineStoryFeed');
    if (offlineStoryFeed) {
        offlineStoryFeed.innerHTML = '';
    }

    if (currentRoleId) {
        await refreshChatViewForCurrentMode();
    }

    renderWechatChatList();
    updateLastMessage('点击开始对话...');
    updateStorageDisplay();
    showCacheToast('聊天记录已清空');
}

async function clearSpecificCache(type) {
    const cacheMap = {
        sentStickers: {
            label: '已发送表情缓存',
            action: () => clearSentStickerCache()
        },
        chatImages: {
            label: '聊天图片缓存',
            action: () => clearChatImages()
        }
    };

    const target = cacheMap[type];
    if (!target) return;

    try {
        await target.action();
        await refreshChatViewForCurrentMode();
        renderWechatChatList();
        refreshCacheManagementUI();
        showCacheToast(`${target.label}已清理`);
    } catch (error) {
        console.error(`${target.label}清理失败:`, error);
        alert(`${target.label}清理失败：${error?.message || '未知错误'}`);
    }
}

async function clearSelectedCaches() {
    if (!confirm('确定要一键清理缓存吗？\n\n只会清理会话临时缓存、已发送表情缓存和聊天图片缓存。\n不会清除用户角色、聊天文本、世界书条目、API设置，也不会删除表情包库。')) {
        return;
    }

    try {
        clearGomokuTurnTimer();
        closeChatMediaPanel();
        resetChatSelectionState();

        const mediaIds = collectStoredMediaReferenceIds(['image']);
        clearChatImageSessionCache();
        clearStoredMediaReferences(['image', 'sticker']);

        try {
            await deleteChatMediaRecordsByIds(mediaIds);
        } catch (error) {
            console.error('清理媒体缓存数据库失败:', error);
        }

        await refreshChatViewForCurrentMode();
        renderWechatChatList();
        refreshCacheManagementUI();
        showCacheToast('缓存已清理');
    } catch (error) {
        console.error('一键清理所有缓存失败:', error);
        alert(`一键清理失败：${error?.message || '未知错误'}`);
    }
}

function clearAllData() {
    if (confirm('确定要抹掉所有内容和设置吗？此操作不可恢复。')) {
        localStorage.clear();
        alert('数据已清除，即将刷新');
        location.reload();
    }
}
// ================= 外观设置 =================
let appearanceSettings = {
    ...getDefaultAppearanceSettings()
};

function showAppearanceSettings() {
    // 加载当前设置
    const saved = localStorage.getItem('appearanceSettings');
    if (saved) {
        appearanceSettings = {
            ...appearanceSettings,
            ...JSON.parse(saved)
        };
    }
    
    // 更新UI显示
    updateAppearanceUI();
    
    document.getElementById('appearanceModal').classList.add('active');
}

function updateAppearanceUI() {
    // 更新模式显示
    document.getElementById('mode-fullscreen').style.opacity = appearanceSettings.displayMode === 'fullscreen' ? '1' : '0';
    document.getElementById('mode-phone').style.opacity = appearanceSettings.displayMode === 'phone' ? '1' : '0';
    
    // 更新尺寸显示（仅在手机模式下可用）
    const sizeSection = document.getElementById('screenSizeSection');
    if (appearanceSettings.displayMode === 'fullscreen') {
        sizeSection.style.opacity = '0.5';
        sizeSection.style.pointerEvents = 'none';
    } else {
        sizeSection.style.opacity = '1';
        sizeSection.style.pointerEvents = 'auto';
    }
    
    ['small', 'medium', 'large'].forEach(size => {
        const el = document.getElementById(`size-${size}`);
        if (el) {
            el.textContent = appearanceSettings.screenSize === size ? '✓' : '○';
        }
    });
    
    // 更新状态栏开关
    const toggle = document.getElementById('statusBarToggle');
    const screenToggle = document.getElementById('screenStatusBarToggle');
    const screenStatusBarState = document.getElementById('screenStatusBarState');
    const screenStatusBarDetail = document.getElementById('screenStatusBarDetail');
    const showStatusBar = appearanceSettings.showStatusBar !== false;

    if (toggle) {
        toggle.classList.toggle('inactive', !showStatusBar);
    }

    if (screenToggle) {
        screenToggle.classList.toggle('inactive', showStatusBar);
    }

    if (screenStatusBarState) {
        screenStatusBarState.textContent = showStatusBar ? '关闭' : '开启';
    }

    if (screenStatusBarDetail) {
        screenStatusBarDetail.textContent = showStatusBar
            ? '移除小手机顶部状态栏'
            : '小手机界面已上移融合';
    }
    
    // 更新设置页摘要
    const summary = document.getElementById('appearanceSummary');
    if (summary) {
        summary.textContent = appearanceSettings.displayMode === 'fullscreen' ? '全屏' : '手机';
    }
}

// 根据设备屏幕尺寸自动适配
function autoAdaptScreen() {
    const screenWidth = window.innerWidth;
    const screenHeight = window.innerHeight;
    
    // 判断设备类型和推荐配置
    let recommendedMode = 'phone';
    let recommendedSize = 'medium';
    
    // 如果屏幕较大（横屏或大屏设备），推荐全屏
    if (screenWidth > 1024 || screenHeight > 1024) {
        recommendedMode = 'fullscreen';
    }
    // 如果是小屏幕手机
    else if (screenWidth < 360 || screenHeight < 600) {
        recommendedSize = 'small';
    }
    // 如果是大屏幕手机
    else if (screenWidth > 400 || screenHeight > 800) {
        recommendedSize = 'large';
    }
    // 否则使用中等尺寸
    else {
        recommendedSize = 'medium';
    }
    
    // 应用推荐配置
    appearanceSettings.displayMode = recommendedMode;
    appearanceSettings.screenSize = recommendedSize;

    // 保存到localStorage
    persistAppearanceSettings(true);

    applyAppearanceSettings();
    updateAppearanceUI();
    updateAppearanceSummary();
    updateScreenSizeSelection(); // 更新屏幕尺寸选择状态

    // 显示提示
    if (window.DataManager) {
        const modeText = recommendedMode === 'fullscreen' ? '全屏' : '手机';
        const sizeText = recommendedSize === 'small' ? '小屏' : recommendedSize === 'large' ? '大屏' : '中等';
        DataManager.showToast(`已适配为${modeText}(${sizeText})模式`);
    }

    // 不自动返回主屏幕，让用户留在设置页面
}

// 快速全屏切换
function toggleFullscreenQuick() {
    if (appearanceSettings.displayMode === 'fullscreen') {
        appearanceSettings.displayMode = 'phone';
        appearanceSettings.screenSize = 'medium';
    } else {
        appearanceSettings.displayMode = 'fullscreen';
    }

    // 保存并应用
    persistAppearanceSettings(true);
    applyAppearanceSettings();
    updateAppearanceUI();
    updateAppearanceSummary();
    updateScreenSizeSelection(); // 更新屏幕尺寸选择状态

    // 显示提示
    if (window.DataManager && window.DataManager.showToast) {
        const modeText = appearanceSettings.displayMode === 'fullscreen' ? '全屏模式' : '手机模式';
        window.DataManager.showToast(`已切换到 ${modeText}`);
    }

    // 不自动返回主屏幕，让用户留在设置页面
}

function setDisplayMode(mode) {
    appearanceSettings.displayMode = mode;
    appearanceSettings.userSelectedDisplayMode = true;
    applyAppearanceSettings();
    updateAppearanceUI();
}

function setScreenSize(size) {
    appearanceSettings.screenSize = size;
    appearanceSettings.displayMode = 'phone';
    appearanceSettings.userSelectedDisplayMode = true;
    applyAppearanceSettings();
    updateAppearanceUI();
}

function toggleStatusBar() {
    appearanceSettings.showStatusBar = !appearanceSettings.showStatusBar;
    applyAppearanceSettings();
    updateAppearanceUI();
}

// 删除这个函数，因为它被重复定义了

// 初始化外观设置
function initAppearance() {
    const saved = localStorage.getItem('appearanceSettings');
    if (saved) {
        appearanceSettings = {
            ...appearanceSettings,
            ...JSON.parse(saved)
        };
        if (!appearanceSettings.userSelectedDisplayMode && appearanceSettings.displayMode !== 'fullscreen') {
            appearanceSettings.displayMode = 'fullscreen';
        }
    } else {
        appearanceSettings = {
            ...appearanceSettings,
            ...getDefaultAppearanceSettings()
        };
    }
    applyAppearanceSettings();  // 立即应用
    updateAppearanceUI();
    updateAppearanceSummary();  // 更新外观摘要显示
}

function updateSystemChromeForAppearance(showStatusBar) {
    const themeColorMeta = document.querySelector('meta[name="theme-color"]');
    const statusBarStyleMeta = document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]');
    const statusFusionColor = '#ffffff';

    const shouldBlendWithStatusArea = appearanceSettings.displayMode === 'fullscreen' && !showStatusBar;

    if (themeColorMeta) {
        themeColorMeta.setAttribute('content', statusFusionColor);
    }

    if (statusBarStyleMeta) {
        statusBarStyleMeta.setAttribute('content', shouldBlendWithStatusArea ? 'black-translucent' : 'default');
    }
}

function applyAppearanceSettings() {
    const container = document.getElementById('homeScreen');
    const statusBar = document.getElementById('globalStatusBar');
    const showStatusBar = appearanceSettings.showStatusBar !== false;

    // 清除所有模式类
    container.classList.remove(
        'fullscreen-mode',
        'phone-mode-small',
        'phone-mode-medium',
        'phone-mode-large',
        'phone-mode-iphone15',
        'phone-mode-iphone15plus',
        'phone-mode-custom',
        'hide-status-bar'
    );

    // 应用模式
    if (appearanceSettings.displayMode === 'fullscreen') {
        container.classList.add('fullscreen-mode');
        document.body.style.background = '#ffffff';
        document.body.style.display = '';
        document.body.style.justifyContent = '';
        document.body.style.alignItems = '';
        document.body.style.height = 'var(--app-viewport-height)';
        document.body.style.margin = '0';
        document.body.style.padding = '0';
        container.style.width = '';
        container.style.height = '';

        // 全屏模式下状态栏宽度100%
        if (statusBar) {
            statusBar.style.width = '100%';
            statusBar.style.left = '0';
            statusBar.style.transform = 'none';
            statusBar.style.top = '0';
            statusBar.style.marginTop = '0';
        }
    } else {
        // 应用自定义尺寸
        if (appearanceSettings.screenSize === 'custom') {
            container.classList.add('phone-mode-custom');
            container.style.width = `${appearanceSettings.customWidth}px`;
            container.style.height = `${appearanceSettings.customHeight}px`;
        } else {
            container.classList.add(`phone-mode-${appearanceSettings.screenSize}`);
            container.style.width = '';
            container.style.height = '';
        }

        document.body.style.background = '#e5e5e5';  // 手机模式时浅灰背景

        // 确保手机模式下容器居中显示
        document.body.style.display = 'flex';
        document.body.style.justifyContent = 'center';
        document.body.style.alignItems = 'center';
        document.body.style.height = 'var(--app-viewport-height)';
        document.body.style.margin = '0';
        document.body.style.padding = '0';

        // 手机模式下，状态栏由CSS处理，这里无需修改
        if (statusBar) {
            statusBar.style.position = '';
            statusBar.style.left = '';
            statusBar.style.transform = '';
            statusBar.style.top = '';
            statusBar.style.width = '';
            statusBar.style.height = '';
            statusBar.style.marginTop = '';
        }
    }
    
    // 应用状态栏设置
    appearanceSettings.showStatusBar = showStatusBar;
    if (!showStatusBar) {
        container.classList.add('hide-status-bar');
    }

    document.querySelectorAll('.app-view').forEach(appView => {
        appView.classList.toggle('hide-status-bar', !showStatusBar);
    });
    updateSystemChromeForAppearance(showStatusBar);
    
    // 更新摘要文字
    const summary = document.getElementById('appearanceSummary');
    if (summary) {
        summary.textContent = appearanceSettings.displayMode === 'fullscreen' ? '全屏' : '手机';
    }
    
    persistAppearanceSettings();
    scheduleAppViewportSync();
}
// ================= 微信角色管理 =================
function loadWechatRoles() {
    const saved = localStorage.getItem('wechatRoles');
    if (saved) {
        wechatRoles = normalizeRoleCollection(JSON.parse(saved));
        localStorage.setItem('wechatRoles', JSON.stringify(wechatRoles));
    } else {
        wechatRoles = [];
    }
    renderWechatChatList();
}

function formatWechatSessionTime(timestamp) {
    const timeValue = Number(timestamp);
    if (!Number.isFinite(timeValue)) return '';

    const now = new Date();
    const target = new Date(timeValue);

    const nowDayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const targetDayStart = new Date(target.getFullYear(), target.getMonth(), target.getDate()).getTime();
    const diffDays = Math.round((nowDayStart - targetDayStart) / 86400000);

    if (diffDays <= 0) {
        return formatTime(timeValue);
    }

    if (diffDays === 1) {
        return '昨天';
    }

    if (diffDays < 7) {
        const weekMap = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
        return weekMap[target.getDay()];
    }

    if (target.getFullYear() === now.getFullYear()) {
        return `${target.getMonth() + 1}月${target.getDate()}日`;
    }

    return `${String(target.getFullYear()).slice(-2)}/${target.getMonth() + 1}/${target.getDate()}`;
}

function getWechatMessagePreviewMeta(content) {
    if (typeof content === 'string') {
        return {
            prefix: '',
            text: content
        };
    }

    if (!content || typeof content !== 'object') {
        return {
            prefix: '',
            text: '点击开始对话...'
        };
    }

    if (content.type === 'image') {
        return {
            prefix: 'photo',
            text: content.name || '图片'
        };
    }

    if (content.type === 'sticker') {
        return {
            prefix: 'sticker',
            text: content.label || '表情'
        };
    }

    if (content.type === 'voice') {
        return {
            prefix: 'voice',
            text: content.text || '语音消息'
        };
    }

    if (content.type === 'gift') {
        return {
            prefix: 'gift',
            text: `赠送 ${content.name || '道具'}`
        };
    }

    if (content.type === 'forum-share') {
        return {
            prefix: '',
            text: `论坛帖子：${content.title || '帖子分享'}`
        };
    }

    if (content.type === 'love-letter-reply') {
        return {
            prefix: '',
            text: content.text || '给你的回信'
        };
    }

    if (content.type === 'transfer') {
        return {
            prefix: 'transfer',
            text: `转账 ¥${formatTransferAmount(content.amount)}`
        };
    }

    if (content.type === 'red-packet') {
        return {
            prefix: 'redPacket',
            text: `红包 ¥${formatTransferAmount(content.amount)}`
        };
    }

    return {
        prefix: '',
        text: '[消息]'
    };
}

function getChatListPreviewText(content) {
    if (typeof content === 'string') {
        return content;
    }

    if (!content || typeof content !== 'object') {
        return '点击开始对话...';
    }

    if (content.type === 'image') {
        return `[图片] ${content.name || ''}`.trim();
    }

    if (content.type === 'sticker') {
        return `[表情包] ${content.label || ''}`.trim();
    }

    if (content.type === 'voice') {
        return `[语音] ${content.text || ''}`.trim();
    }

    if (content.type === 'gift') {
        return `赠送 ${content.name || '道具'}`;
    }

    if (content.type === 'forum-share') {
        return `[论坛帖子] ${content.title || '帖子分享'}`;
    }

    if (content.type === 'love-letter-reply') {
        return content.text || '给你的回信';
    }

    if (content.type === 'transfer') {
        return `转账 ¥${formatTransferAmount(content.amount)}`;
    }

    if (content.type === 'red-packet') {
        return `红包 ¥${formatTransferAmount(content.amount)}`;
    }

    return '[消息]';
}

function buildWechatSessionPreviewHTML(content) {
    const meta = getWechatMessagePreviewMeta(content);
    const safeText = sanitizeAIResponse(meta.text || '', '');

    const escapedText = String(safeText || '点击开始对话...')
        .replace(/&/g, '&')
        .replace(/</g, '<')
        .replace(/>/g, '>');

    const prefixMap = {
        voice: `
            <span class="chat-preview-prefix chat-preview-prefix-voice" aria-hidden="true">
                <span class="chat-preview-prefix-icon">
                    <svg viewBox="0 0 24 24" focusable="false">
                        <path d="M6.5 13.5V10.5L10 8v8l-3.5-2.5Z" />
                        <path d="M13.2 10.3a2.7 2.7 0 0 1 0 3.4" />
                        <path d="M15.5 8.4a5.25 5.25 0 0 1 0 7.2" />
                    </svg>
                </span>
                <span class="chat-preview-prefix-label">语音</span>
            </span>
        `,
        photo: `
            <span class="chat-preview-prefix chat-preview-prefix-photo" aria-hidden="true">
                <span class="chat-preview-prefix-icon">
                    <svg viewBox="0 0 24 24" focusable="false">
                        <rect x="4.5" y="5.5" width="15" height="13" rx="3.4" />
                        <circle cx="15.1" cy="9.2" r="1.2" />
                        <path d="m7.1 15.2 3.1-3.15 2.35 2.25 2.45-2.45 1.9 2.15" />
                    </svg>
                </span>
                <span class="chat-preview-prefix-label">图片</span>
            </span>
        `,
        sticker: `
            <span class="chat-preview-prefix chat-preview-prefix-sticker" aria-hidden="true">
                <span class="chat-preview-prefix-icon">
                    <svg viewBox="0 0 24 24" focusable="false">
                        <rect x="5" y="5" width="14" height="14" rx="4" />
                        <path d="m9.1 12 1.15.6.6 1.15.6-1.15 1.15-.6-1.15-.6-.6-1.15-.6 1.15Z" />
                    </svg>
                </span>
                <span class="chat-preview-prefix-label">表情</span>
            </span>
        `,
        gift: `
            <span class="chat-preview-prefix chat-preview-prefix-gift" aria-hidden="true">
                <span class="chat-preview-prefix-icon">
                    <svg viewBox="0 0 24 24" focusable="false">
                        <path d="M5 10h14v9.2a1.8 1.8 0 0 1-1.8 1.8H6.8A1.8 1.8 0 0 1 5 19.2V10Z" />
                        <path d="M4 7.2A1.8 1.8 0 0 1 5.8 5.4h12.4A1.8 1.8 0 0 1 20 7.2V10H4V7.2Z" />
                        <path d="M12 5.4V21" />
                    </svg>
                </span>
                <span class="chat-preview-prefix-label">赠送</span>
            </span>
        `,
        transfer: `
            <span class="chat-preview-prefix chat-preview-prefix-transfer" aria-hidden="true">
                <span class="chat-preview-prefix-icon">
                    <svg viewBox="0 0 24 24" focusable="false">
                        <rect x="4.5" y="6" width="15" height="12" rx="3" />
                        <path d="M8 11h8" />
                        <path d="M12 9v6" />
                    </svg>
                </span>
                <span class="chat-preview-prefix-label">转账</span>
            </span>
        `,
        redPacket: `
            <span class="chat-preview-prefix chat-preview-prefix-transfer" aria-hidden="true">
                <span class="chat-preview-prefix-icon">
                    <svg viewBox="0 0 24 24" focusable="false">
                        <rect x="6" y="4.5" width="12" height="15" rx="2.4" />
                        <path d="M6.4 9.2h11.2" />
                        <circle cx="12" cy="12.4" r="1.4" />
                    </svg>
                </span>
                <span class="chat-preview-prefix-label">红包</span>
            </span>
        `
    };

    return `${prefixMap[meta.prefix] || ''}<span class="chat-preview-text">${escapedText}</span>`;
}

function getWechatSessionUnreadCount(roleId, roleChat = []) {
    if (!Array.isArray(roleChat) || roleChat.length === 0) return 0;

    let count = 0;
    for (let index = roleChat.length - 1; index >= 0; index -= 1) {
        const message = roleChat[index];
        if (message?.role !== 'assistant') break;
        if (isAssistantMessageRead(message)) break;
        count += 1;
    }

    if (currentRoleId && String(currentRoleId) === String(roleId) && currentApp === 'chat') {
        return 0;
    }

    return Math.min(count, 99);
}

function renderWechatChatList() {
    const chatList = document.getElementById('wechatChatList');
    if (!chatList) return;
    
    // 重新加载数据确保最新
    const savedRoles = localStorage.getItem('wechatRoles');
    if (savedRoles) {
        wechatRoles = normalizeRoleCollection(JSON.parse(savedRoles));
    }
    
    // 清理重复角色（根据昵称或ID）
    const seenNicknames = new Set();
    const seenIds = new Set();
    wechatRoles = normalizeRoleCollection(wechatRoles).filter(role => {
        if (seenIds.has(role.id) || seenNicknames.has(role.nickname)) {
            return false;
        }
        seenIds.add(role.id);
        seenNicknames.add(role.nickname);
        return true;
    });
    localStorage.setItem('wechatRoles', JSON.stringify(wechatRoles));
    
    if (wechatRoles.length === 0) {
        chatList.innerHTML = `
            <div class="wechat-empty-state">
                <div class="wechat-empty-icon" aria-hidden="true">
                    <svg viewBox="0 0 24 24" focusable="false">
                        <path d="M7 7.75h10c2.07 0 3.75 1.68 3.75 3.75v3c0 2.07-1.68 3.75-3.75 3.75h-5.05l-3.45 2.6c-.49.37-1.2.02-1.2-.6V18A3.75 3.75 0 0 1 3.25 14.25V11.5C3.25 9.43 4.93 7.75 7 7.75Z" />
                    </svg>
                </div>
                <div class="wechat-empty-title">还没有聊天对象</div>
                <div class="wechat-empty-text">点击右上角的 + 创建一个新对话</div>
            </div>
        `;
        return;
    }
    
    chatList.innerHTML = wechatRoles.map(role => {
        const currentModeKey = getChatStorageKey(role.id, getCurrentChatMode());
        const roleChat = safeReadStorageJSON(currentModeKey, []);
        const lastMessage = roleChat.length > 0 ? roleChat[roleChat.length - 1] : null;
        const lastContent = lastMessage?.content || '';
        const previewHTML = buildWechatSessionPreviewHTML(lastContent);
        const sessionTime = formatWechatSessionTime(lastMessage?.timestamp);
        const unreadCount = getWechatSessionUnreadCount(role.id, roleChat);

        const avatarBaseStyle = 'width: 50px; height: 50px; border-radius: 10px; display: flex; align-items: center; justify-content: center; font-size: 20px; font-weight: 560; line-height: 1; text-align: center; position: relative;';
        const avatarConfig = getAvatarRenderConfig(role.avatar, role.nickname);
        const avatarStyle = `${avatarBaseStyle} ${avatarConfig.avatarStyle}`;

        return `
            <div class="chat-item" onclick="selectAndEnterChat(${role.id})">
                <div class="avatar" style="${avatarStyle}">
                    ${escapeHtml(avatarConfig.avatarContent)}
                    ${unreadCount > 0 ? `<span class="chat-unread-dot has-count">${unreadCount > 99 ? '99+' : unreadCount}</span>` : ''}
                </div>
                <div class="chat-info">
                    <div class="chat-main-row">
                        <div class="chat-name">${role.nickname}</div>
                        <div class="chat-time">${sessionTime}</div>
                    </div>
                    <div class="chat-sub-row">
                        <div class="chat-preview">${previewHTML}</div>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

function selectAndEnterChat(roleId) {
    currentRoleId = roleId;
    
    // 加载该角色的聊天历史
    loadChatHistory();
    markWechatConversationAsRead(roleId, 'online');
    
    enterChat();
    
    // 更新聊天窗口标题
    const role = wechatRoles.find(r => r.id === roleId);
    if (role) {
        document.querySelector('#app-chat .nav-title').textContent = role.nickname;
    }

    syncOfflineModeUI();
    renderWechatChatList();
    
    // 绑定省略号菜单按钮
    setTimeout(() => {
        const navAction = document.querySelector('#app-chat .nav-action');
        if (navAction) {
            navAction.onclick = showChatRoleMenu;
        }
    }, 50);
}

// 聊天界面的角色编辑菜单
function showChatRoleMenu() {
    if (!currentRoleId) return;
    
    const menu = document.createElement('div');
    menu.className = 'modal active';
    menu.id = 'chatRoleMenu';
    menu.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: transparent; display: flex; align-items: flex-start; justify-content: flex-end; z-index: 1000;';
    
    const menuContent = document.createElement('div');
    menuContent.style.cssText = 'background: white; border: 0.5px solid rgba(60,60,67,0.12); border-radius: 8px; margin: 50px 10px 0 0; min-width: 132px; box-shadow: 0 1px 2px rgba(15,23,42,0.04); overflow: hidden;';
    
    menuContent.innerHTML = `
        <div style="padding: 10px 0; border-bottom: 1px solid #eee;">
            <div style="padding: 10px 15px; cursor: pointer; color: #007AFF;" onclick="openRoleCreativeMemoryModal(); document.getElementById('chatRoleMenu').remove();">
                创造记忆
            </div>
            <div style="padding: 10px 15px; cursor: pointer; color: #007AFF;" onclick="editChatRole(); document.getElementById('chatRoleMenu').remove();">
                编辑角色
            </div>
            <div style="padding: 10px 15px; cursor: pointer; color: #FF3B30;" onclick="deleteChatRole(); document.getElementById('chatRoleMenu').remove();">
                删除角色
            </div>
        </div>
        <div style="padding: 5px 0;">
            <div style="padding: 10px 15px; cursor: pointer; color: #666;" onclick="document.getElementById('chatRoleMenu').remove();">
                取消
            </div>
        </div>
    `;
    
    menu.appendChild(menuContent);
    menu.onclick = (e) => {
        if (e.target === menu) {
            menu.remove();
        }
    };
    
    document.getElementById('app-chat').appendChild(menu);
}

function formatMemoryDate(timestamp) {
    const value = Number(timestamp);
    if (!Number.isFinite(value) || value <= 0) return '';

    const date = new Date(value);
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hour = String(date.getHours()).padStart(2, '0');
    const minute = String(date.getMinutes()).padStart(2, '0');
    return `${month}-${day} ${hour}:${minute}`;
}

function closeRoleCreativeMemoryModal() {
    const modal = document.getElementById('roleCreativeMemoryModal');
    if (modal) modal.remove();
    activeRoleCreativeMemoryEditId = null;
}

function renderRoleCreativeMemoryList() {
    const listEl = document.getElementById('roleCreativeMemoryList');
    if (!listEl) return;

    const memories = loadRoleCreativeMemories();
    if (memories.length === 0) {
        listEl.innerHTML = `
            <div class="role-memory-empty">
                <div class="role-memory-empty-title">还没有创造记忆</div>
                <div class="role-memory-empty-text">写下角色需要长期记住的事实、关系变化、约定或世界观。</div>
            </div>
        `;
        return;
    }

    listEl.innerHTML = memories.slice().reverse().map(memory => `
        <div class="role-memory-item" data-memory-id="${escapeHtml(memory.id)}">
            <div class="role-memory-item-main" onclick="startEditRoleCreativeMemory('${escapeHtml(memory.id)}')">
                <div class="role-memory-item-text">${escapeHtml(memory.content)}</div>
                <div class="role-memory-item-meta">更新于 ${escapeHtml(formatMemoryDate(memory.updatedAt || memory.createdAt))}</div>
            </div>
            <button class="role-memory-item-delete" type="button" onclick="handleDeleteRoleCreativeMemory('${escapeHtml(memory.id)}')" aria-label="删除记忆">删除</button>
        </div>
    `).join('');
}

function openRoleCreativeMemoryModal() {
    if (!currentRoleId) return;

    closeRoleCreativeMemoryModal();
    const role = wechatRoles.find(r => r.id === currentRoleId);
    const modal = document.createElement('div');
    modal.className = 'modal active role-memory-modal';
    modal.id = 'roleCreativeMemoryModal';
    modal.innerHTML = `
        <div class="modal-content role-memory-modal-content">
            <div class="modal-header role-memory-modal-header">
                <div>
                    <div class="modal-title role-memory-modal-title">创造记忆</div>
                    <div class="role-memory-modal-subtitle">${escapeHtml(role?.nickname || '当前角色')}</div>
                </div>
                <button class="modal-close role-memory-modal-close" type="button" aria-label="关闭" onclick="closeRoleCreativeMemoryModal()">×</button>
            </div>
            <div class="modal-body role-memory-modal-body">
                <div class="role-memory-editor">
                    <textarea id="roleCreativeMemoryInput" rows="5" maxlength="800" placeholder="写下这位角色需要记住的内容..."></textarea>
                    <div class="role-memory-editor-actions">
                        <button class="role-memory-btn secondary" type="button" onclick="cancelRoleCreativeMemoryEdit()">取消编辑</button>
                        <button class="role-memory-btn primary" type="button" onclick="saveRoleCreativeMemoryFromModal()">保存记忆</button>
                    </div>
                </div>
                <div class="role-memory-list" id="roleCreativeMemoryList"></div>
            </div>
        </div>
    `;

    modal.onclick = (event) => {
        if (event.target === modal) {
            closeRoleCreativeMemoryModal();
        }
    };

    document.body.appendChild(modal);
    renderRoleCreativeMemoryList();
}

function startEditRoleCreativeMemory(memoryId) {
    const memory = loadRoleCreativeMemories().find(item => String(item.id) === String(memoryId));
    const input = document.getElementById('roleCreativeMemoryInput');
    if (!memory || !input) return;

    activeRoleCreativeMemoryEditId = memory.id;
    input.value = memory.content;
    input.focus();
}

function cancelRoleCreativeMemoryEdit() {
    activeRoleCreativeMemoryEditId = null;
    const input = document.getElementById('roleCreativeMemoryInput');
    if (input) input.value = '';
}

function saveRoleCreativeMemoryFromModal() {
    const input = document.getElementById('roleCreativeMemoryInput');
    const content = input?.value || '';
    const text = content.replace(/\s+/g, ' ').trim();
    if (!text) {
        if (window.DataManager) DataManager.showToast('先写一点记忆内容');
        return;
    }

    const saved = activeRoleCreativeMemoryEditId
        ? updateRoleCreativeMemory(activeRoleCreativeMemoryEditId, text)
        : addRoleCreativeMemory(text);

    if (!saved) {
        if (window.DataManager) DataManager.showToast('记忆保存失败');
        return;
    }

    activeRoleCreativeMemoryEditId = null;
    if (input) input.value = '';
    renderRoleCreativeMemoryList();
    if (window.DataManager) DataManager.showToast('记忆已保存');
}

function handleDeleteRoleCreativeMemory(memoryId) {
    if (!memoryId) return;
    if (!confirm('确定删除这条记忆吗？')) return;

    if (deleteRoleCreativeMemory(memoryId)) {
        if (String(activeRoleCreativeMemoryEditId || '') === String(memoryId)) {
            cancelRoleCreativeMemoryEdit();
        }
        renderRoleCreativeMemoryList();
        if (window.DataManager) DataManager.showToast('记忆已删除');
    }
}

function editChatRole() {
    editingRoleId = currentRoleId;
    const role = wechatRoles.find(r => r.id === currentRoleId);
    
    if (role) {
        document.getElementById('editRoleModal').classList.add('active');
        
        setTimeout(() => {
            const editAvatarEl = document.getElementById('editAvatarPreview');
            applyAvatarRenderConfig(editAvatarEl, role.avatar, role.nickname || '?');
            document.getElementById('editNickname').value = role.nickname || '';
            document.getElementById('editRealName').value = role.realName || '';
            document.getElementById('editSystemPrompt').value = role.systemPrompt || '';

            const editVoiceEnabled = document.getElementById('editVoiceEnabled');
            const editVoiceId = document.getElementById('editVoiceId');
            const editVoiceReplyProbability = document.getElementById('editVoiceReplyProbability');
            const editVoiceReplyProbabilityValue = document.getElementById('editVoiceReplyProbabilityValue');
            const editProactiveEnabled = document.getElementById('editProactiveEnabled');
            const editProactiveFrequency = document.getElementById('editProactiveFrequency');

            if (editVoiceEnabled) editVoiceEnabled.checked = !!role.voiceEnabled;
            if (editVoiceId) editVoiceId.value = role.voiceId || '';
            if (editVoiceReplyProbability) {
                const probability = getRoleVoiceReplyProbability(role);
                editVoiceReplyProbability.value = probability;
                if (editVoiceReplyProbabilityValue) {
                    editVoiceReplyProbabilityValue.textContent = `${Math.round(probability * 100)}%`;
                }
            }
            if (editProactiveEnabled) editProactiveEnabled.checked = role.proactiveMessagesEnabled !== false;
            if (editProactiveFrequency) editProactiveFrequency.value = normalizeProactiveFrequency(role.proactiveMessageFrequency);
        }, 10);
    }
}

function deleteChatRole() {
    if (!currentRoleId) return;
    
    const role = wechatRoles.find(r => r.id === currentRoleId);
    if (!role) return;
    
    if (confirm(`确定要删除"${role.nickname}"吗？`)) {
        wechatRoles = wechatRoles.filter(r => r.id !== currentRoleId);
        localStorage.setItem('wechatRoles', JSON.stringify(wechatRoles));
        localStorage.removeItem(getChatStorageKey(currentRoleId, 'online'));
        localStorage.removeItem(getChatStorageKey(currentRoleId, 'offline'));
        localStorage.removeItem(getLegacyChatStorageKey(currentRoleId));
        localStorage.removeItem(getSharedEventsStorageKey(currentRoleId));
        localStorage.removeItem(getRoleCreativeMemoriesStorageKey(currentRoleId));
        
        currentRoleId = null;
        backToWechat();
        renderWechatChatList();
        
        if (window.DataManager) {
            DataManager.showToast('角色已删除');
        }
    }
}

function editRoleClick(roleId) {
    editingRoleId = roleId;
    const role = wechatRoles.find(r => r.id === roleId);
    if (!role) return;
    
    const menu = document.createElement('div');
    menu.className = 'modal active';
    menu.id = 'roleListMenu';
    menu.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: transparent; display: flex; align-items: flex-start; justify-content: flex-end; z-index: 1000;';
    
    const menuContent = document.createElement('div');
    menuContent.style.cssText = 'background: white; border: 0.5px solid rgba(60,60,67,0.12); border-radius: 8px; margin: 100px 10px 0 0; min-width: 120px; box-shadow: 0 1px 2px rgba(15,23,42,0.04);';
    
    menuContent.innerHTML = `
        <div style="padding: 10px 0; border-bottom: 1px solid #eee;">
            <div style="padding: 10px 15px; cursor: pointer; color: #007AFF;" onclick="openEditRoleModal(); document.getElementById('roleListMenu').remove();">
                编辑角色
            </div>
            <div style="padding: 10px 15px; cursor: pointer; color: #FF3B30;" onclick="deleteRoleFromList(); document.getElementById('roleListMenu').remove();">
                删除角色
            </div>
        </div>
        <div style="padding: 5px 0;">
            <div style="padding: 10px 15px; cursor: pointer; color: #666;" onclick="document.getElementById('roleListMenu').remove();">
                取消
            </div>
        </div>
    `;
    
    menu.appendChild(menuContent);
    menu.onclick = (e) => {
        if (e.target === menu) {
            menu.remove();
        }
    };
    
    document.getElementById('app-wechat').appendChild(menu);
}

function openEditRoleModal() {
    const role = wechatRoles.find(r => r.id === editingRoleId);
    if (role) {
        document.getElementById('editRoleModal').classList.add('active');
        setTimeout(() => {
            const editAvatarEl = document.getElementById('editAvatarPreview');
            applyAvatarRenderConfig(editAvatarEl, role.avatar, role.nickname || '?');
            document.getElementById('editNickname').value = role.nickname || '';
            document.getElementById('editRealName').value = role.realName || '';
            document.getElementById('editSystemPrompt').value = role.systemPrompt || '';

            const editVoiceEnabled = document.getElementById('editVoiceEnabled');
            const editVoiceId = document.getElementById('editVoiceId');
            const editVoiceReplyProbability = document.getElementById('editVoiceReplyProbability');
            const editVoiceReplyProbabilityValue = document.getElementById('editVoiceReplyProbabilityValue');
            const editProactiveEnabled = document.getElementById('editProactiveEnabled');
            const editProactiveFrequency = document.getElementById('editProactiveFrequency');

            if (editVoiceEnabled) editVoiceEnabled.checked = !!role.voiceEnabled;
            if (editVoiceId) editVoiceId.value = role.voiceId || '';
            if (editVoiceReplyProbability) {
                const probability = getRoleVoiceReplyProbability(role);
                editVoiceReplyProbability.value = probability;
                if (editVoiceReplyProbabilityValue) {
                    editVoiceReplyProbabilityValue.textContent = `${Math.round(probability * 100)}%`;
                }
            }
            if (editProactiveEnabled) editProactiveEnabled.checked = role.proactiveMessagesEnabled !== false;
            if (editProactiveFrequency) editProactiveFrequency.value = normalizeProactiveFrequency(role.proactiveMessageFrequency);
        }, 10);
    }
}

function deleteRoleFromList() {
    if (!editingRoleId) return;
    
    const role = wechatRoles.find(r => r.id === editingRoleId);
    if (!role) return;
    
    if (confirm(`确定要删除"${role.nickname}"吗？`)) {
        wechatRoles = wechatRoles.filter(r => r.id !== editingRoleId);
        localStorage.setItem('wechatRoles', JSON.stringify(wechatRoles));
        localStorage.removeItem(getChatStorageKey(editingRoleId, 'online'));
        localStorage.removeItem(getChatStorageKey(editingRoleId, 'offline'));
        localStorage.removeItem(getLegacyChatStorageKey(editingRoleId));
        localStorage.removeItem(getSharedEventsStorageKey(editingRoleId));
        localStorage.removeItem(getRoleCreativeMemoriesStorageKey(editingRoleId));
        renderWechatChatList();
        
        if (window.DataManager) {
            DataManager.showToast('角色已删除');
        }
    }
}

// ================= 世界书功能 =================
let worldRules = [];

function loadWorldRules() {
    const saved = localStorage.getItem('worldRules');
    if (saved) {
        try {
            worldRules = JSON.parse(saved);
        } catch (e) {
            worldRules = [];
        }
    } else {
        worldRules = [];
    }
}

function saveWorldRules() {
    localStorage.setItem('worldRules', JSON.stringify(worldRules));
}

function renderWorldRules() {
    const container = document.getElementById('worldbookList');
    const empty = document.getElementById('worldbookEmpty');
    if (!container || !empty) return;

    if (worldRules.length === 0) {
        container.innerHTML = '';
        empty.style.display = 'block';
        return;
    }

    empty.style.display = 'none';
    container.innerHTML = worldRules.map((rule, index) => `
        <div class="worldbook-item" onclick="editWorldRule(${index})">
            <div class="worldbook-item-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" class="ui-line-icon">
                    <path d="M5 5.5A2.5 2.5 0 0 1 7.5 3H20v15H7.5A2.5 2.5 0 0 0 5 20.5v-15Z"/>
                    <path d="M5 20.5A2.5 2.5 0 0 1 7.5 18H20"/>
                    <path d="M9 7h6M9 10h7"/>
                </svg>
            </div>
            <div class="worldbook-item-body">
                <div class="worldbook-item-name">${rule.name}</div>
                <div class="worldbook-item-content">${rule.content}</div>
            </div>
            <div class="worldbook-item-arrow">›</div>
        </div>
    `).join('');
}

function showAddWorldRuleModal() {
    const modal = document.getElementById('worldRuleModal');
    const titleEl = document.getElementById('worldRuleModalTitle');
    const nameInput = document.getElementById('worldRuleName');
    const contentInput = document.getElementById('worldRuleContent');
    const deleteBtn = document.getElementById('deleteWorldRuleBtn');

    if (!modal || !titleEl || !nameInput || !contentInput || !deleteBtn) {
        console.error('世界书弹窗节点缺失，无法打开创建规则弹窗');
        return;
    }

    titleEl.textContent = '添加规则';
    nameInput.value = '';
    contentInput.value = '';
    deleteBtn.style.display = 'none';
    modal.dataset.editIndex = '-1';
    modal.classList.add('active');

    setTimeout(() => {
        nameInput.focus();
    }, 0);
}

function editWorldRule(index) {
    const rule = worldRules[index];
    if (!rule) return;

    document.getElementById('worldRuleModalTitle').textContent = '编辑规则';
    document.getElementById('worldRuleName').value = rule.name;
    document.getElementById('worldRuleContent').value = rule.content;
    document.getElementById('deleteWorldRuleBtn').style.display = 'block';
    document.getElementById('worldRuleModal').dataset.editIndex = String(index);
    document.getElementById('worldRuleModal').classList.add('active');
}

function saveWorldRule() {
    const name = document.getElementById('worldRuleName').value.trim();
    const content = document.getElementById('worldRuleContent').value.trim();
    const editIndex = parseInt(document.getElementById('worldRuleModal').dataset.editIndex, 10);

    if (!name) {
        alert('请输入规则名称');
        return;
    }

    if (!content) {
        alert('请输入规则描述');
        return;
    }

    if (editIndex >= 0 && editIndex < worldRules.length) {
        // 编辑已有规则
        worldRules[editIndex] = { name, content };
    } else {
        // 添加新规则
        worldRules.push({ name, content });
    }

    saveWorldRules();
    renderWorldRules();
    closeModal('worldRuleModal');
}

function deleteWorldRule() {
    const editIndex = parseInt(document.getElementById('worldRuleModal').dataset.editIndex, 10);
    if (editIndex >= 0 && editIndex < worldRules.length) {
        worldRules.splice(editIndex, 1);
        saveWorldRules();
        renderWorldRules();
    }
    closeModal('worldRuleModal');
}

function getWorldRulesContext() {
    if (!Array.isArray(worldRules) || worldRules.length === 0) return '';
    const rulesText = worldRules.map((rule, index) => `${index + 1}. [${rule.name}] ${rule.content}`).join('\n');
    return `\n\n【世界观规则】\n以下规则是这个世界的基础设定，请严格遵守：\n${rulesText}`;
}

// ================= 创建AI角色 =================
function openWechatMenu() {
    console.log('openWechatMenu 被调用了');
    const menu = document.getElementById('wechatMenu');
    console.log('wechatMenu元素:', menu);
    if (menu) {
        menu.classList.add('active');
        console.log('已添加active类，当前classList:', menu.classList);
    } else {
        console.error('找不到wechatMenu元素');
    }
}

function showCreateRoleModal() {
    closeModal('wechatMenu');

    // 重置头像预览为默认字母头像
    const avatarPreview = document.getElementById('roleAvatarPreview');
    avatarPreview.style.background = DEFAULT_LETTER_AVATAR_COLOR;
    avatarPreview.style.backgroundSize = 'cover';
    avatarPreview.style.backgroundPosition = 'center';
    avatarPreview.innerHTML = getAvatarFallbackText('?');
    avatarPreview.style.color = '';
    avatarPreview.style.border = '';
    avatarPreview.style.display = '';
    avatarPreview.style.alignItems = '';
    avatarPreview.style.justifyContent = '';
    avatarPreview.style.fontSize = '';
    avatarPreview.style.color = '#ffffff';

    document.getElementById('roleNickname').value = '';
    document.getElementById('roleRealName').value = '';
    document.getElementById('roleSystemPrompt').value = '';

    const roleVoiceEnabled = document.getElementById('roleVoiceEnabled');
    const roleVoiceId = document.getElementById('roleVoiceId');
    const roleVoiceReplyProbability = document.getElementById('roleVoiceReplyProbability');
    const roleVoiceReplyProbabilityValue = document.getElementById('roleVoiceReplyProbabilityValue');

    if (roleVoiceEnabled) roleVoiceEnabled.checked = false;
    if (roleVoiceId) roleVoiceId.value = '';
    if (roleVoiceReplyProbability) {
        const probability = getRoleVoiceReplyProbability(null);
        roleVoiceReplyProbability.value = probability;
        if (roleVoiceReplyProbabilityValue) {
            roleVoiceReplyProbabilityValue.textContent = `${Math.round(probability * 100)}%`;
        }
    }

    const roleProactiveEnabled = document.getElementById('roleProactiveEnabled');
    const roleProactiveFrequency = document.getElementById('roleProactiveFrequency');
    if (roleProactiveEnabled) roleProactiveEnabled.checked = true;
    if (roleProactiveFrequency) roleProactiveFrequency.value = 'low';

    selectedAvatarColor = 'white';
    window.currentPersonaForAvatar = null;

    document.getElementById('createRoleModal').classList.add('active');
}

function showAvatarColorPicker() {
    document.getElementById('colorPickerModal').classList.add('active');
}

function selectAvatarColor(color) {
    const softColor = getSoftAvatarColorValue(color) || DEFAULT_LETTER_AVATAR_COLOR;
    selectedAvatarColor = softColor;
    document.getElementById('roleAvatarPreview').style.background = softColor;
    closeModal('colorPickerModal');
}

// ================= 随机人设生成 =================
const personaTemplates = {
    names: {
        chinese: {
            male: ['晨曦', '云深', '星河', '墨言', '清风', '夜澜', '寒江', '明轩', '逸尘', '凌霄', '子墨', '君临', '慕白', '景行', '思远'],
            female: ['雨桐', '诗涵', '婉清', '思语', '梦瑶', '若溪', '静姝', '语嫣', '芷若', '念慈', '雪柔', '晓梦', '依依', '素心', '清欢'],
            neutral: ['小智', '阿星', '小云', '墨墨', '小悠', '阿言', '小念', '悠然', '知秋', '听风'],
            language: '中文',
            nationality: '中国'
        },
        japanese: {
            male: ['悠斗', '陽翔', '蓮', '大和', '颯太', '樹', '湊', '陸', '翔', '蒼'],
            female: ['結衣', '陽菜', '咲良', '莉子', '美月', '花音', '凛', '葵', '杏', '澪'],
            neutral: ['ひかり', 'そら', 'あおい', 'ゆず', 'はる', 'つばさ', 'かえで', 'なぎ', 'れん', 'みお'],
            language: '日语',
            nationality: '日本'
        },
        korean: {
            male: ['민준', '서준', '예준', '도윤', '시우', '주원', '하준', '지호', '준서', '건우'],
            female: ['서연', '민서', '지우', '서현', '수아', '지아', '하은', '윤서', '채원', '지민'],
            neutral: ['하늘', '바다', '별', '달', '구름', '이슬', '나래', '새롬', '온유', '슬기'],
            language: '韩语',
            nationality: '韩国'
        },
        english: {
            male: ['Alex', 'Ryan', 'Noah', 'Ethan', 'Lucas', 'Oliver', 'James', 'Leo', 'Max', 'Jack'],
            female: ['Emma', 'Olivia', 'Sophia', 'Ava', 'Mia', 'Luna', 'Lily', 'Grace', 'Chloe', 'Zoe'],
            neutral: ['Taylor', 'Jordan', 'Riley', 'Casey', 'Morgan', 'Avery', 'Quinn', 'Sage', 'River', 'Sky'],
            language: '英语',
            nationality: '美国'
        },
        french: {
            male: ['Louis', 'Gabriel', 'Raphaël', 'Arthur', 'Jules', 'Adam', 'Lucas', 'Hugo', 'Léo', 'Maël'],
            female: ['Emma', 'Louise', 'Chloé', 'Léa', 'Manon', 'Jade', 'Zoé', 'Lina', 'Rose', 'Alice'],
            neutral: ['Camille', 'Dominique', 'Claude', 'Sacha', 'Lou', 'Charlie', 'Eden', 'Noa', 'Andrea', 'Alex'],
            language: '法语',
            nationality: '法国'
        }
    },
    personalities: [
        { trait: '温柔体贴', style: '说话轻声细语，常用"呢"、"哦"等语气词，关心对方感受' },
        { trait: '活泼开朗', style: '语气轻快，喜欢用"哈哈"、"嘿嘿"，经常用感叹号表达情绪' },
        { trait: '冷静理性', style: '措辞严谨，逻辑清晰，很少使用语气词，喜欢分析问题' },
        { trait: '幽默风趣', style: '喜欢开玩笑，偶尔自嘲，用词诙谐，善于化解尴尬' },
        { trait: '文艺浪漫', style: '用词优美，喜欢引用诗句，表达含蓄而富有意境' },
        { trait: '直率真诚', style: '有话直说，不拐弯抹角，用词简洁明了' },
        { trait: '神秘高冷', style: '话不多，回复简短，偶尔透露一些深刻见解' },
        { trait: '元气满满', style: '充满正能量，喜欢鼓励他人，常用"加油"、"你可以的"' },
        { trait: '成熟稳重', style: '说话沉稳有分寸，善于倾听，给人可靠的感觉' },
        { trait: '古灵精怪', style: '思维跳跃，喜欢出其不意，常有新奇想法' },
        { trait: '知性优雅', style: '谈吐得体，用词考究，展现良好的教养和见识' },
        { trait: '热情奔放', style: '情感表达直接热烈，喜欢用夸张的语气词和表情' },
        { trait: '温和谦逊', style: '说话委婉客气，常用"可能"、"也许"等词，不强加观点' },
        { trait: '机智敏锐', style: '反应快，善于抓住重点，回复简洁有力' },
        { trait: '细腻敏感', style: '善于察觉情绪变化，表达细腻，用词温柔' },
        { trait: '乐观积极', style: '总能看到事物好的一面，喜欢传递正能量' },
        { trait: '沉着冷静', style: '遇事不慌，分析透彻，给出理性建议' },
        { trait: '童心未泯', style: '保持好奇心，喜欢用可爱的语气词，充满童趣' },
        { trait: '独立自主', style: '有主见，鼓励独立思考，不盲从他人' },
        { trait: '温暖治愈', style: '话语温柔，善于安慰，让人感到被理解和支持' },
        { trait: '严谨认真', style: '注重细节，表达准确，对事物有深入思考' },
        { trait: '洒脱随性', style: '不拘小节，说话自然随意，给人轻松的感觉' },
        { trait: '睿智深邃', style: '见解独到，常有哲理性思考，引人深思' },
        { trait: '俏皮可爱', style: '说话带点小调皮，喜欢用"嘛"、"啦"等语气词，让人会心一笑' }
    ],
    interests: [
        '阅读', '音乐', '电影', '旅行', '摄影', '绘画', '写作', '运动',
        '美食', '游戏', '编程', '设计', '手工', '园艺', '天文', '历史',
        '舞蹈', '瑜伽', '烘焙', '咖啡', '茶艺', '收藏', '动漫', '戏剧',
        '心理学', '哲学', '冥想', '登山', '骑行', '潜水'
    ],
    relationships: [
        '知心朋友', '学习伙伴', '生活顾问', '情感倾听者',
        '创意伙伴', '运动搭子', '美食探索者', '精神导师',
        '旅行同伴', '阅读分享者', '音乐知己', '游戏队友',
        '职场导师', '心灵树洞', '灵感缪斯', '成长见证者',
        '深夜陪伴', '欢乐制造机'
    ],
    greetings: [
        '嗨，很高兴认识你~',
        '你好呀，有什么我可以帮你的吗？',
        'Hi，今天过怎么样？',
        '你来啦，等你好久了~',
        'Hello，很开心能和你聊天',
        '嘿，找我有什么事吗？',
        '你好，我一直都在这里',
        '终于等到你了，来聊聊吧'
    ]
};

function generateRandomPersona() {
    // 随机选择国家
    const countries = Object.keys(personaTemplates.names);
    const selectedCountry = countries[Math.floor(Math.random() * countries.length)];
    const countryData = personaTemplates.names[selectedCountry];

    // 随机选择性别倾向
    const genderTypes = ['male', 'female', 'neutral'];
    const selectedGender = genderTypes[Math.floor(Math.random() * genderTypes.length)];

    // 随机生成名字
    const nameList = countryData[selectedGender];
    const nickname = nameList[Math.floor(Math.random() * nameList.length)];

    // 获取语言和国籍
    const language = countryData.language;
    const nationality = countryData.nationality;

    // 随机选择性格
    const personality = personaTemplates.personalities[
        Math.floor(Math.random() * personaTemplates.personalities.length)
    ];

    // 随机选择2-3个兴趣爱好
    const shuffledInterests = [...personaTemplates.interests].sort(() => Math.random() - 0.5);
    const interests = shuffledInterests.slice(0, 2 + Math.floor(Math.random() * 2));

    // 随机选择关系定位
    const relationship = personaTemplates.relationships[
        Math.floor(Math.random() * personaTemplates.relationships.length)
    ];

    // 随机选择问候语
    const greeting = personaTemplates.greetings[
        Math.floor(Math.random() * personaTemplates.greetings.length)
    ];

    // 生成个性签名
    const signatures = [
        `${personality.trait}的${relationship}`,
        `喜欢${interests[0]}和${interests[1]}`,
        `${interests[0]}爱好者 | ${personality.trait}`,
        `一个${personality.trait}的人`,
        `${relationship} | ${interests[0]}中`
    ];
    const signature = signatures[Math.floor(Math.random() * signatures.length)];

    // 生成系统提示词
    const systemPrompt = `你是${nickname}，一个${personality.trait}的人。

国籍：${nationality}
语言：请用${language}和用户交流
性格特点：${personality.trait}
说话风格：${personality.style}
关系定位：你是用户的${relationship}
兴趣爱好：${interests.join('、')}

注意事项：
- 保持${personality.trait}的性格特点
- ${personality.style}
- 适当展现对${interests[0]}、${interests[1]}的了解和热情
- 不要过度热情或冷淡，保持自然的交流节奏
- 尊重隐私，不主动询问敏感信息`;

    return {
        nickname,
        realName: nickname,
        signature,
        personality: personality.trait,
        systemPrompt,
        interests: interests.join('、'),
        relationship,
        greeting,
        gender: selectedGender,
        language,
        nationality
    };
}

async function applyRandomPersona() {
    // 检查是否有已填写的内容
    const hasContent =
        document.getElementById('roleNickname').value.trim() ||
        document.getElementById('roleSystemPrompt').value.trim();

    if (hasContent) {
        const confirmed = confirm('当前已有内容，是否覆盖？');
        if (!confirmed) return;
    }

    const persona = generateRandomPersona();

    // 填充表单
    document.getElementById('roleNickname').value = persona.nickname;
    document.getElementById('roleRealName').value = persona.realName;
    document.getElementById('roleSystemPrompt').value = persona.systemPrompt;

    // 显示生成成功提示
    if (window.DataManager) {
        DataManager.showToast('已生成随机人设，可继续编辑');
    }

    // 存储当前人设信息，用于后续头像生成
    window.currentPersonaForAvatar = persona;
}

// ================= 头像生成 =================
let isGeneratingAvatar = false;

async function generateAvatarFromPersona() {
    if (isGeneratingAvatar) {
        if (window.DataManager) {
            DataManager.showToast('头像生成中，请稍候...');
        }
        return;
    }

    // 检查是否配置了图像生成服务
    if (!apiSettings.enableImageGeneration || !apiSettings.imageApiKey) {
        if (window.DataManager) {
            DataManager.showToast('当前未配置图像生成服务，可先使用预设头像或本地上传');
        }
        return;
    }

    // 获取当前人设信息
    const nickname = document.getElementById('roleNickname').value.trim();
    const systemPrompt = document.getElementById('roleSystemPrompt').value.trim();

    if (!nickname || !systemPrompt) {
        if (window.DataManager) {
            DataManager.showToast('请先填写角色名称和人设');
        }
        return;
    }

    // 从人设中提取关键信息生成头像提示词
    const persona = window.currentPersonaForAvatar || {};
    const personality = persona.personality || '友好';
    const gender = persona.gender || 'neutral';

    // 构建头像生成提示词
    let avatarPrompt = `A clean and elegant avatar portrait, ${personality} expression, `;

    if (gender === 'male') {
        avatarPrompt += 'young man, ';
    } else if (gender === 'female') {
        avatarPrompt += 'young woman, ';
    } else {
        avatarPrompt += 'androgynous person, ';
    }

    avatarPrompt += 'soft lighting, pastel colors, illustration style, clean background, suitable for circular avatar, high quality, detailed face, warm and friendly atmosphere';

    isGeneratingAvatar = true;
    const avatarPreview = document.getElementById('roleAvatarPreview');
    const originalBackground = avatarPreview.style.background;

    // 显示加载状态
    avatarPreview.style.background = '#f0f0f0';
    avatarPreview.innerHTML = '<div style="display: flex; align-items: center; justify-content: center; height: 100%; font-size: 12px; color: #999;">生成中...</div>';

    try {
        const result = await requestImageGeneration(avatarPrompt);

        if (result.status === 'succeeded' && result.dataUrl) {
            // 设置生成的头像
            selectedAvatarColor = `__IMAGE__${result.dataUrl}`;
            avatarPreview.style.background = `url('${result.dataUrl}')`;
            avatarPreview.style.backgroundSize = 'cover';
            avatarPreview.style.backgroundPosition = 'center';
            avatarPreview.innerHTML = '';

            if (window.DataManager) {
                DataManager.showToast('头像生成成功');
            }
        } else {
            throw new Error('头像生成失败');
        }
    } catch (error) {
        console.error('头像生成失败:', error);
        avatarPreview.style.background = originalBackground;
        avatarPreview.innerHTML = '';

        if (window.DataManager) {
            DataManager.showToast('头像生成失败，请使用预设头像或本地上传');
        }
    } finally {
        isGeneratingAvatar = false;
    }
}

// ================= 编辑页面的随机人设和头像生成 =================
async function applyRandomPersonaToEdit() {
    // 检查是否有已填写的内容
    const hasContent =
        document.getElementById('editNickname').value.trim() ||
        document.getElementById('editSystemPrompt').value.trim();

    if (hasContent) {
        const confirmed = confirm('当前已有内容，是否覆盖？');
        if (!confirmed) return;
    }

    const persona = generateRandomPersona();

    // 填充表单
    document.getElementById('editNickname').value = persona.nickname;
    document.getElementById('editRealName').value = persona.realName;
    document.getElementById('editSystemPrompt').value = persona.systemPrompt;

    // 显示生成成功提示
    if (window.DataManager) {
        DataManager.showToast('已生成随机人设，可继续编辑');
    }

    // 存储当前人设信息，用于后续头像生成
    window.currentPersonaForEdit = persona;
}

async function generateAvatarForEdit() {
    if (isGeneratingAvatar) {
        if (window.DataManager) {
            DataManager.showToast('头像生成中，请稍候...');
        }
        return;
    }

    // 检查是否配置了图像生成服务
    if (!apiSettings.enableImageGeneration || !apiSettings.imageApiKey) {
        if (window.DataManager) {
            DataManager.showToast('当前未配置图像生成服务，可先使用预设头像或本地上传');
        }
        return;
    }

    // 获取当前人设信息
    const nickname = document.getElementById('editNickname').value.trim();
    const systemPrompt = document.getElementById('editSystemPrompt').value.trim();

    if (!nickname || !systemPrompt) {
        if (window.DataManager) {
            DataManager.showToast('请先填写角色名称和人设');
        }
        return;
    }

    // 从人设中提取关键信息生成头像提示词
    const persona = window.currentPersonaForEdit || {};
    const personality = persona.personality || '友好';
    const gender = persona.gender || 'neutral';

    // 构建头像生成提示词
    let avatarPrompt = `A clean and elegant avatar portrait, ${personality} expression, `;

    if (gender === 'male') {
        avatarPrompt += 'young man, ';
    } else if (gender === 'female') {
        avatarPrompt += 'young woman, ';
    } else {
        avatarPrompt += 'androgynous person, ';
    }

    avatarPrompt += 'soft lighting, pastel colors, illustration style, clean background, suitable for circular avatar, high quality, detailed face, warm and friendly atmosphere';

    isGeneratingAvatar = true;
    const avatarPreview = document.getElementById('editAvatarPreview');
    const originalBackground = avatarPreview.style.background;

    // 显示加载状态
    avatarPreview.style.background = '#f0f0f0';
    avatarPreview.innerHTML = '<div style="display: flex; align-items: center; justify-content: center; height: 100%; font-size: 12px; color: #999;">生成中...</div>';

    try {
        const result = await requestImageGeneration(avatarPrompt);

        if (result.status === 'succeeded' && result.dataUrl) {
            // 设置生成的头像
            avatarPreview.style.background = `url('${result.dataUrl}')`;
            avatarPreview.style.backgroundSize = 'cover';
            avatarPreview.style.backgroundPosition = 'center';
            avatarPreview.innerHTML = '';
            avatarPreview.dataset.imageUrl = result.dataUrl;

            if (window.DataManager) {
                DataManager.showToast('头像生成成功');
            }
        } else {
            throw new Error('头像生成失败');
        }
    } catch (error) {
        console.error('头像生成失败:', error);
        avatarPreview.style.background = originalBackground;
        avatarPreview.innerHTML = '';

        if (window.DataManager) {
            DataManager.showToast('头像生成失败，请使用预设头像或本地上传');
        }
    } finally {
        isGeneratingAvatar = false;
    }
}

function createNewRole() {
    const nickname = document.getElementById('roleNickname').value.trim();
    const realName = document.getElementById('roleRealName').value.trim();
    const systemPrompt = document.getElementById('roleSystemPrompt').value.trim();
    const voiceEnabled = !!document.getElementById('roleVoiceEnabled')?.checked;
    const voiceId = document.getElementById('roleVoiceId')?.value.trim() || '';
    const voiceReplyProbability = parseFloat(document.getElementById('roleVoiceReplyProbability')?.value);
    const proactiveMessagesEnabled = !!document.getElementById('roleProactiveEnabled')?.checked;
    const proactiveMessageFrequency = normalizeProactiveFrequency(document.getElementById('roleProactiveFrequency')?.value);
    
    if (!nickname) {
        alert('请输入昵称');
        return;
    }
    
    if (!systemPrompt) {
        alert('请输入人设');
        return;
    }
    
    let avatar = selectedAvatarColor;
    if (avatar.startsWith('__IMAGE__')) {
        avatar = `url('${avatar.substring(9)}')`;
    }
    
    const newRole = {
        id: Date.now(),
        nickname: nickname,
        realName: realName || '未设置',
        avatar: avatar,
        type: 'ai',
        systemPrompt: systemPrompt,
        moodValue: 0,
        affectionValue: 0,
        affectionLevel: 'neutral',
        affectionByMask: {},
        voiceEnabled: voiceEnabled,
        voiceId: voiceId,
        voiceReplyProbability: Number.isFinite(voiceReplyProbability) ? voiceReplyProbability : 0.2,
        proactiveMessagesEnabled,
        proactiveMessageFrequency
    };
    
    wechatRoles.push(newRole);
    localStorage.setItem('wechatRoles', JSON.stringify(wechatRoles));
    renderWechatChatList();
    closeModal('createRoleModal');
    
    if (window.DataManager) {
        DataManager.showToast('角色创建成功');
    }
}

// ================= 添加好友 =================
function showAddFriendModal() {
    closeModal('wechatMenu');
    document.getElementById('friendName').value = '';
    document.getElementById('friendRealName').value = '';
    document.getElementById('friendAvatarPreview').style.background = friendAvatarColor;
    document.getElementById('addFriendModal').classList.add('active');
}

function showFriendAvatarPicker() {
    document.getElementById('colorPickerModal').classList.add('active');
}

function addNewFriend() {
    const friendName = document.getElementById('friendName').value.trim();
    const friendRealName = document.getElementById('friendRealName').value.trim();
    
    if (!friendName) {
        alert('请输入朋友昵称');
        return;
    }
    
    const newFriend = {
        id: Date.now(),
        nickname: friendName,
        realName: friendRealName || '未设置',
        avatar: friendAvatarColor,
        type: 'friend',
        description: '朋友',
        moodValue: 0,
        affectionValue: 0,
        affectionLevel: 'neutral',
        affectionByMask: {}
    };
    
    wechatRoles.push(newFriend);
    localStorage.setItem('wechatRoles', JSON.stringify(wechatRoles));
    renderWechatChatList();
    closeModal('addFriendModal');
    
    if (window.DataManager) {
        DataManager.showToast('好友添加成功');
    }
}

// ================= 角色编辑 =================
function showEditAvatarPicker() {
    document.getElementById('colorPickerModal').classList.add('active');
}

function saveRoleChanges() {
    if (!editingRoleId) return;
    
    const nickname = document.getElementById('editNickname').value.trim();
    const realName = document.getElementById('editRealName').value.trim();
    const systemPrompt = document.getElementById('editSystemPrompt').value.trim();
    const voiceEnabled = !!document.getElementById('editVoiceEnabled')?.checked;
    const voiceId = document.getElementById('editVoiceId')?.value.trim() || '';
    const voiceReplyProbability = parseFloat(document.getElementById('editVoiceReplyProbability')?.value);
    const proactiveMessagesEnabled = !!document.getElementById('editProactiveEnabled')?.checked;
    const proactiveMessageFrequency = normalizeProactiveFrequency(document.getElementById('editProactiveFrequency')?.value);
    
    if (!nickname) {
        alert('昵称不能为空');
        return;
    }
    
    if (!systemPrompt) {
        alert('人设不能为空');
        return;
    }
    
    const role = wechatRoles.find(r => r.id === editingRoleId);
    if (role) {
        role.nickname = nickname;
        role.realName = realName || '未设置';
        const editAvatarEl = document.getElementById('editAvatarPreview');
        if (editAvatarEl.dataset.imageUrl) {
            role.avatar = `url('${editAvatarEl.dataset.imageUrl}')`;
        } else {
            let avatarValue = editAvatarEl.dataset.avatarValue || editAvatarEl.style.backgroundImage || editAvatarEl.style.background || 'white';
            if (avatarValue.includes('url(')) {
                role.avatar = avatarValue;
            } else {
                role.avatar = editAvatarEl.style.background || 'white';
            }
        }
        role.systemPrompt = systemPrompt;
        role.voiceEnabled = voiceEnabled;
        role.voiceId = voiceId;
        role.voiceReplyProbability = Number.isFinite(voiceReplyProbability) ? voiceReplyProbability : 0.2;
        role.proactiveMessagesEnabled = proactiveMessagesEnabled;
        role.proactiveMessageFrequency = proactiveMessageFrequency;
        
        localStorage.setItem('wechatRoles', JSON.stringify(wechatRoles));
        renderWechatChatList();
        closeModal('editRoleModal');
        
        if (window.DataManager) {
            DataManager.showToast('角色已更新');
        }
    }
}

function deleteRole() {
    if (!editingRoleId) return;
    
    if (confirm('确定要删除这个角色吗？')) {
        wechatRoles = wechatRoles.filter(r => r.id !== editingRoleId);
        localStorage.setItem('wechatRoles', JSON.stringify(wechatRoles));
        renderWechatChatList();
        closeModal('editRoleModal');
        
        if (window.DataManager) {
            DataManager.showToast('角色已删除');
        }
    }
}

// ================= 文件上传处理 =================
function handleAvatarUpload(event, type) {
    const file = event.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (e) => {
        const imageData = e.target.result;
        
        if (type === 'role') {
            const el = document.getElementById('roleAvatarPreview');
            el.style.background = `url('${imageData}') center/cover no-repeat`;
            el.textContent = '';
            el.dataset.avatarValue = `url('${imageData}')`;
            selectedAvatarColor = `url('${imageData}')`;
        } else if (type === 'edit') {
            const el = document.getElementById('editAvatarPreview');
            el.style.background = `url('${imageData}') center/cover no-repeat`;
            el.style.backgroundSize = 'cover';
            el.style.backgroundPosition = 'center';
            el.textContent = '';
            // 保存图片数据到element的dataset，供saveRoleChanges读取
            el.dataset.imageUrl = imageData;
            el.dataset.avatarValue = `url('${imageData}')`;
        }
    };
    reader.readAsDataURL(file);
}

function handleWallpaperUpload(event) {
    const inputEl = event?.target;
    const file = inputEl?.files?.[0];
    if (!file) return;

    if (!/^image\//i.test(file.type || '')) {
        alert('请选择图片文件');
        if (inputEl) inputEl.value = '';
        return;
    }

    const reader = new FileReader();

    reader.onerror = () => {
        alert('图片读取失败，请重试');
        if (inputEl) inputEl.value = '';
    };

    reader.onload = async (e) => {
        const imageData = e?.target?.result;
        if (!imageData || typeof imageData !== 'string') {
            alert('图片数据无效，请重试');
            if (inputEl) inputEl.value = '';
            return;
        }

        const img = new Image();
        img.onerror = () => {
            alert('该图片格式当前环境不支持，请换一张常见格式（JPG/PNG）');
            if (inputEl) inputEl.value = '';
        };

        img.onload = async () => {
            if (!getHomeWallpaperContainer()) {
                alert('未找到主屏容器，无法应用墙纸');
                if (inputEl) inputEl.value = '';
                return;
            }

            let finalImageData = imageData;
            try {
                finalImageData = await compressImageDataUrl(imageData, {
                    maxWidth: 1280,
                    maxHeight: 1280,
                    quality: 0.8
                });
            } catch (compressError) {
                console.warn('墙纸压缩失败，回退原图:', compressError);
            }

            const wallpaperValue = `url('${finalImageData}')`;
            applyHomeWallpaper(wallpaperValue, 'image');

            try {
                localStorage.setItem('wallpaper', wallpaperValue);
                localStorage.setItem('wallpaperType', 'image');
                closeModal('wallpaperModal');
                if (window.DataManager) {
                    DataManager.showToast('墙纸已应用');
                }
            } catch (storageError) {
                console.error('保存墙纸失败:', storageError);
                alert('墙纸已临时应用，但保存失败（存储空间不足）');
            } finally {
                if (inputEl) inputEl.value = '';
            }
        };

        img.src = imageData;
    };

    reader.readAsDataURL(file);
}

function handleUserAvatarUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (e) => {
        const imageData = e.target.result;
        const previewEl = document.getElementById('userAvatarPreview');
        previewEl.style.backgroundImage = `url('${imageData}')`;
        previewEl.style.backgroundSize = 'cover';
        previewEl.style.backgroundPosition = 'center';
        previewEl.style.backgroundRepeat = 'no-repeat';
        previewEl.dataset.avatarValue = `url('${imageData}')`;
        previewEl.textContent = '';
    };
    reader.readAsDataURL(file);
}

// ================= 朋友圈背景管理 =================
let momentsBackgroundSettings = {
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    opacity: 1,
    scale: 100,
    blur: 0
};

// 背景选项预设 - 扩展到17个
const MOMENTS_BACKGROUND_PRESETS = [
    { name: '紫色渐变', value: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', preview: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' },
    { name: '粉色渐变', value: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)', preview: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)' },
    { name: '蓝色渐变', value: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)', preview: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)' },
    { name: '绿色渐变', value: 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)', preview: 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)' },
    { name: '橙色渐变', value: 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)', preview: 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)' },
    { name: '深蓝渐变', value: 'linear-gradient(135deg, #30cfd0 0%, #330867 100%)', preview: 'linear-gradient(135deg, #30cfd0 0%, #330867 100%)' },
    { name: '日落渐变', value: 'linear-gradient(135deg, #ff6b6b 0%, #ffa94d 50%, #ffd93d 100%)', preview: 'linear-gradient(135deg, #ff6b6b 0%, #ffa94d 50%, #ffd93d 100%)' },
    { name: '森林渐变', value: 'linear-gradient(135deg, #134e5e 0%, #71b280 100%)', preview: 'linear-gradient(135deg, #134e5e 0%, #71b280 100%)' },
    { name: '梦幻渐变', value: 'linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)', preview: 'linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)' },
    { name: '夜空渐变', value: 'linear-gradient(135deg, #0f2027 0%, #203a43 50%, #2c5364 100%)', preview: 'linear-gradient(135deg, #0f2027 0%, #203a43 50%, #2c5364 100%)' },
    { name: '樱花渐变', value: 'linear-gradient(135deg, #ffc0cb 0%, #ffb6c1 50%, #ff69b4 100%)', preview: 'linear-gradient(135deg, #ffc0cb 0%, #ffb6c1 50%, #ff69b4 100%)' },
    { name: '海洋渐变', value: 'linear-gradient(135deg, #001a4d 0%, #0066cc 50%, #00ccff 100%)', preview: 'linear-gradient(135deg, #001a4d 0%, #0066cc 50%, #00ccff 100%)' },
    { name: '晨曦渐变', value: 'linear-gradient(135deg, #1e3c72 0%, #2a5298 50%, #7aa8d1 100%)', preview: 'linear-gradient(135deg, #1e3c72 0%, #2a5298 50%, #7aa8d1 100%)' },
    { name: '燃烧渐变', value: 'linear-gradient(135deg, #ff0000 0%, #ff7f00 50%, #ffff00 100%)', preview: 'linear-gradient(135deg, #ff0000 0%, #ff7f00 50%, #ffff00 100%)' },
    { name: '薄荷渐变', value: 'linear-gradient(135deg, #a1c4fd 0%, #c2e9fb 100%)', preview: 'linear-gradient(135deg, #a1c4fd 0%, #c2e9fb 100%)' },
    { name: '黑色纯色', value: '#000000', preview: '#000000' },
    { name: '白色纯色', value: '#ffffff', preview: '#ffffff' }
];

function loadMomentsBackgroundSettings() {
    const saved = localStorage.getItem('momentsBackgroundSettings');
    if (saved) {
        try {
            momentsBackgroundSettings = JSON.parse(saved);
        } catch (e) {
            momentsBackgroundSettings = { background: MOMENTS_BACKGROUND_PRESETS[0].value };
        }
    }
    applyMomentsBackground();
}

function saveMomentsBackgroundSettings() {
    try {
        localStorage.setItem('momentsBackgroundSettings', JSON.stringify(momentsBackgroundSettings));
        return true;
    } catch (error) {
        console.error('保存朋友圈封面失败:', error);
        return false;
    }
}

function applyMomentsBackground() {
    const cover = document.getElementById('momentsCover');
    if (!cover || !momentsBackgroundSettings?.background) return;

    if (momentsBackgroundSettings.background.includes('url(')) {
        cover.style.background = momentsBackgroundSettings.background;
        cover.style.backgroundSize = 'cover';
        cover.style.backgroundPosition = 'center';
        cover.style.backgroundRepeat = 'no-repeat';
    } else {
        cover.style.background = momentsBackgroundSettings.background;
        cover.style.backgroundSize = '';
        cover.style.backgroundPosition = '';
        cover.style.backgroundRepeat = '';
    }
}

function showMomentsBackgroundSettings() {
    const modal = document.getElementById('momentsBackgroundModal');
    if (!modal) return;

    const grid = document.getElementById('momentsBgGrid');
    if (!grid) return;

    // 只保留自定义导入：不再渲染任何预设颜色/渐变选项
    grid.innerHTML = `
        <div class="moments-bg-thumb"
             style="background: #ccc; display: flex; align-items: center; justify-content: center; font-size: 24px; cursor: pointer;"
             onclick="document.getElementById('momentsBackgroundInput').click()">
            📁
        </div>
        <input type="file" id="momentsBackgroundInput" accept="image/*" style="display: none;" onchange="handleMomentsBackgroundUpload(event)">
    `;

    modal.classList.add('active');
}

function setMomentsBackground(background, index) {
    momentsBackgroundSettings.background = background;
    saveMomentsBackgroundSettings();
    applyMomentsBackground();
    renderMomentsCover();
    
    // 更新UI
    const thumbs = document.querySelectorAll('.moments-bg-thumb');
    thumbs.forEach((thumb, i) => {
        if (i === index) {
            thumb.classList.add('selected');
        } else {
            thumb.classList.remove('selected');
        }
    });
}

async function handleMomentsBackgroundUpload(event) {
    const inputEl = event?.target;
    const file = inputEl?.files?.[0];
    if (!file) return;

    const resetInput = () => {
        if (inputEl) inputEl.value = '';
    };

    if (!/^image\//i.test(file.type || '')) {
        alert('请选择图片文件');
        resetInput();
        return;
    }

    try {
        const rawDataUrl = await readFileAsDataURL(file);

        let finalImageData = rawDataUrl;
        try {
            finalImageData = await compressImageDataUrl(rawDataUrl, {
                maxWidth: 1600,
                maxHeight: 1600,
                quality: 0.82
            });
        } catch (compressError) {
            console.warn('朋友圈封面压缩失败，尝试使用原图:', compressError);
        }

        momentsBackgroundSettings = {
            ...momentsBackgroundSettings,
            background: `url('${finalImageData}')`
        };

        // 先应用到界面，避免保存失败时用户看起来“导入无效”
        applyMomentsBackground();
        renderMomentsCover();

        const saved = saveMomentsBackgroundSettings();
        closeModal('momentsBackgroundModal');

        if (window.DataManager) {
            DataManager.showToast(saved ? '封面已更换' : '封面已临时更换，但保存失败（存储空间不足）');
        } else if (!saved) {
            alert('封面已临时更换，但保存失败（存储空间不足）');
        }
    } catch (error) {
        console.error('朋友圈封面导入失败:', error);
        alert(`封面导入失败：${error?.message || '图片读取或处理失败，请重试'}`);
    } finally {
        resetInput();
    }
}

// 在DOMContentLoaded后加载朋友圈背景设置
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        loadMomentsBackgroundSettings();
    }, 500);
});

// ================= 屏幕尺寸选择功能 =================

function openScreenSizeSettings() {
    // 隐藏设置页面
    hideAppView(document.getElementById('app-settings'));

    // 显示屏幕尺寸选择页面
    showAppView(document.getElementById('app-screen-size'));

    // 更新选中状态
    updateAppearanceUI();
    updateScreenSizeSelection();
}

function backToSettings() {
    // 隐藏屏幕尺寸页面
    hideAppView(document.getElementById('app-screen-size'));

    // 显示设置页面
    showAppView(document.getElementById('app-settings'));
}

function selectScreenSize(size) {
    appearanceSettings.screenSize = size;
    appearanceSettings.displayMode = 'phone'; // 确保是手机模式

    // 保存设置
    persistAppearanceSettings(true);

    // 应用设置
    applyAppearanceSettings();

    // 更新UI
    updateScreenSizeSelection();
    updateAppearanceSummary();

    // 显示提示
    const sizeNames = {
        'medium': '适中尺寸 350×740',
        'iphone15': 'iPhone 15 425×860',
        'iphone15plus': 'iPhone 15 Plus 450×950',
        'small': '小屏 320×680',
        'large': '大屏 375×812'
    };

    if (window.DataManager && window.DataManager.showToast) {
        window.DataManager.showToast(`已切换到 ${sizeNames[size] || size}`);
    }

    // 不自动返回主屏幕，让用户留在设置页面查看效果
}

function updateScreenSizeSelection() {
    const options = document.querySelectorAll('.screen-size-option');
    options.forEach(option => {
        const size = option.getAttribute('data-size');
        if (!size) return;
        // 如果是全屏模式，不选中任何尺寸选项
        if (appearanceSettings.displayMode === 'fullscreen') {
            option.classList.remove('selected');
        } else if (size === appearanceSettings.screenSize) {
            option.classList.add('selected');
        } else {
            option.classList.remove('selected');
        }
    });
}

function showCustomSizeModal() {
    const modal = document.getElementById('customSizeModal');

    // 填充当前自定义尺寸
    document.getElementById('customWidth').value = appearanceSettings.customWidth || 375;
    document.getElementById('customHeight').value = appearanceSettings.customHeight || 812;

    modal.classList.add('active');
}

function applyCustomSize() {
    const width = parseInt(document.getElementById('customWidth').value);
    const height = parseInt(document.getElementById('customHeight').value);

    // 验证输入
    if (!width || !height || width < 280 || width > 600 || height < 500 || height > 1000) {
        alert('请输入有效的尺寸范围：\n宽度：280-600px\n高度：500-1000px');
        return;
    }

    // 保存自定义尺寸
    appearanceSettings.customWidth = width;
    appearanceSettings.customHeight = height;
    appearanceSettings.screenSize = 'custom';
    appearanceSettings.displayMode = 'phone';

    // 保存到localStorage
    persistAppearanceSettings(true);

    // 应用设置
    applyAppearanceSettings();

    // 更新UI
    updateScreenSizeSelection();
    updateAppearanceSummary();

    // 关闭弹窗
    closeModal('customSizeModal');

    // 显示提示
    if (window.DataManager && window.DataManager.showToast) {
        window.DataManager.showToast(`已应用自定义尺寸 ${width}×${height}`);
    }

    // 延迟返回主屏幕，让用户看到尺寸变化
    setTimeout(() => {
        goHome();
    }, 500);
}

function updateAppearanceSummary() {
    const summary = document.getElementById('appearanceSummary');
    if (!summary) return;

    if (appearanceSettings.displayMode === 'fullscreen') {
        summary.textContent = '全屏';
    } else {
        const sizeMap = {
            'small': '小屏',
            'medium': '适中',
            'large': '大屏',
            'iphone15': 'iPhone 15',
            'iphone15plus': 'iPhone 15 Plus',
            'custom': `自定义 ${appearanceSettings.customWidth}×${appearanceSettings.customHeight}`
        };
        summary.textContent = sizeMap[appearanceSettings.screenSize] || '手机模式';
    }
}
