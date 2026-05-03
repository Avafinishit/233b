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

let currentApp = null;
let chatHistory = [];
let apiSettings = {};
let wechatRoles = [];
let currentRoleId = null;
let selectedAvatarColor = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
let editingRoleId = null;
let friendAvatarColor = 'linear-gradient(135deg, #00ff9d 0%, #00cc7d 100%)';
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
const CHAT_MEDIA_DB_NAME = 'chatMediaDB';
const CHAT_MEDIA_DB_VERSION = 1;
const CHAT_MEDIA_STORE_NAME = 'images';
const CHAT_IMAGE_SESSION_CACHE_KEY = 'chatImageSessionCache';
const CHAT_IMAGE_SESSION_CACHE_LIMIT = 20;
const MEDIA_REF_PREFIX = 'media:';
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

    if (content.type === 'image') {
        return {
            type: 'image',
            imageId: content.imageId || null,
            name: content.name || '聊天图片'
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
    normalizedUrl = normalizedUrl.replace(/\/t2a_v2$/i, '');

    return normalizedUrl || CONFIG.DEFAULT_MINIMAX_API_URL;
}

function getMinimaxSpeechModel() {
    return CONFIG.DEFAULT_MINIMAX_SPEECH_MODEL;
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
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), ttsTimeoutMs);

    let response = null;
    try {
        const ttsProxyUrl = window.location.port === '8000' ? '/tts' : 'http://localhost:8000/tts';
        response = await fetch(ttsProxyUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
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
            }),
            signal: controller.signal
        });
    } catch (error) {
        if (error?.name === 'AbortError') {
            throw new Error(`Minimax 语音请求超时（>${ttsTimeoutMs / 1000}s）`);
        }

        const rawMessage = String(error?.message || '').toLowerCase();
        if (rawMessage.includes('failed to fetch')) {
            throw new Error('Minimax 语音网络请求失败（可能是 CORS/网络拦截/证书问题）');
        }

        throw new Error(`Minimax 语音请求异常: ${error?.message || '网络请求失败'}`);
    } finally {
        clearTimeout(timeoutId);
    }

    let data = null;
    try {
        data = await response.json();
    } catch (error) {
        data = null;
    }

    if (!response.ok) {
        const detail = extractErrorMessage(data, '').trim();
        const fallback = `Minimax TTS 请求失败 (${response.status}${response.statusText ? ` ${response.statusText}` : ''})`;
        throw new Error(detail ? `${fallback}: ${detail}` : fallback);
    }

    if (Number(data?.base_resp?.status_code) !== 0) {
        throw new Error(extractErrorMessage(data, 'Minimax TTS 返回失败'));
    }

    const rawAudioUrl = data?.data?.audio
        || data?.data?.audio_url
        || data?.audio
        || data?.audio_url
        || data?.data?.audio_file
        || data?.audio_file
        || data?.data?.audioUrl
        || data?.audioUrl
        || data?.data?.audio_file_url
        || data?.audio_file_url
        || data?.data?.audio?.url
        || data?.audio?.url
        || data?.data?.audio?.link
        || data?.audio?.link
        || data?.data?.audio?.src
        || data?.audio?.src;

    const rawAudioBase64 = data?.data?.audio_base64
        || data?.audio_base64
        || data?.data?.audioBase64
        || data?.audioBase64
        || data?.data?.base64
        || data?.base64
        || data?.data?.audio_data
        || data?.audio_data
        || data?.data?.audio?.base64
        || data?.audio?.base64
        || data?.data?.audio?.data
        || data?.audio?.data;

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

    return {
        type: 'voice',
        url: resolvedAudioUrl,
        text: String(text).trim(),
        voiceId: String(role.voiceId).trim(),
        duration: data?.data?.duration || data?.duration || null,
        model: getMinimaxSpeechModel()
    };
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

    saveChatHistory();
    addSharedEvent({
        sourceMode: getCurrentChatMode(),
        speakerRole: 'assistant',
        content: voiceContent,
        timestamp
    });

    const chatBox = document.getElementById('chatBox');
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
function saveChatHistory() {
    if (!currentRoleId) return true;
    
    const key = getChatStorageKey(currentRoleId);

    try {
        const historyToStore = chatHistory.map(msg => ({
            ...msg,
            content: stripChatContentForStorage(msg.content)
        }));
        localStorage.setItem(key, JSON.stringify(historyToStore));
        return true;
    } catch (error) {
        console.error('保存聊天记录失败:', error);
        showAIError('聊天记录保存失败，可能是图片过大或存储空间不足');
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
    maxSummaryLength = 68
} = {}) {
    if (!roleId) {
        return {
            memoryText: '',
            count: 0,
            sourceMode: currentMode === 'offline' ? 'online' : 'offline'
        };
    }

    const oppositeMode = currentMode === 'offline' ? 'online' : 'offline';
    const allEvents = loadSharedEvents(roleId).filter((event) => event?.sourceMode === oppositeMode);
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
        .replace(/[“”"'『』「」]/g, '')
        .replace(/\s+/g, ' ')
        .trim();

    if (!normalized) return '';

    const compact = normalized.length > maxLength
        ? `${normalized.slice(0, maxLength).trim()}…`
        : normalized;

    return compact;
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
                <div class="exit-offline-mode-modal-intro">请选择退出方式</div>
                <div class="exit-offline-mode-modal-actions">
                    <button
                        class="exit-offline-mode-btn exit-offline-mode-btn-primary"
                        type="button"
                        onclick="handleExitOfflineMode(false)"
                    >
                        结束且不总结
                        <span class="exit-offline-mode-btn-caption">推荐 · 直接结束，不写入跨模式记忆</span>
                    </button>
                    <button
                        class="exit-offline-mode-btn exit-offline-mode-btn-secondary"
                        type="button"
                        onclick="handleExitOfflineMode(true)"
                    >
                        结束并总结
                    </button>
                </div>
                <div class="exit-offline-mode-modal-note">
                    <div class="exit-offline-mode-modal-note-item">
                        <span class="exit-offline-mode-modal-note-label">不总结</span>
                        <span class="exit-offline-mode-modal-note-text">结束当前剧情，不自动写入跨模式记忆。</span>
                    </div>
                    <div class="exit-offline-mode-modal-note-item">
                        <span class="exit-offline-mode-modal-note-label">并总结</span>
                        <span class="exit-offline-mode-modal-note-text">生成线下剧情摘要，并写入记忆系统供另一模式读取。</span>
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
                chatBox.appendChild(createUserBubble(msg.content, true, messageId));
            } else if (msg.role === 'assistant') {
                chatBox.appendChild(createAIBubble(msg.content, true, role, messageId));
            }
        });

        chatBox.scrollTop = chatBox.scrollHeight;
    }

    syncOfflineModeUI();
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
        toggleBtn.textContent = isOfflineMode ? '清除聊天' : '线下模式';
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
    // 初始化测试数据（如果还没有的话）
    initializeTestData();
    
    loadAPISettings();
    loadChatHistory();
    loadNotes();
    loadWechatUser();
    loadMoments();
    loadOfflineModePreference();
    loadChatStickerLibrary();
    initAppearance();  // 确保这行有，且前面没有语法错误
    loadWechatRoles();
    
    // 先调用一次更新时间
    setTimeout(() => {
        updateClock();
        console.log('初始时间更新完成');
    }, 100);
    
    // 每秒更新时间
    setInterval(() => {
        updateClock();
    }, 1000);
    
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
                avatar: 'white',
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
        const appearanceSettings = {
            displayMode: 'phone',
            screenSize: 'medium',
            showStatusBar: true
        };
        localStorage.setItem('appearanceSettings', JSON.stringify(appearanceSettings));
    }
    
    // 标记已完成初始化
    localStorage.setItem('isInitialized', 'true');
}
// ================= 应用导航 =================
function openApp(appName) {
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
    appEl.style.display = 'flex';
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
    }
}

function goHome() {
    closeCommentInput();
    closeChatMediaPanel();
    resetChatSelectionState();

    const homeScreen = document.getElementById('homeScreen');

    // 隐藏所有应用（带关闭过渡）
    document.querySelectorAll('.app-view').forEach(el => {
        if (el.style.display !== 'none') {
            el.classList.remove('app-opening');
            el.classList.add('app-closing');
            setTimeout(() => {
                el.style.display = 'none';
                el.classList.remove('app-closing');
            }, 220);
        } else {
            el.style.display = 'none';
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
    
    document.getElementById('app-chat').style.display = 'none';
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

    document.getElementById('app-chat').style.display = 'none';
    document.getElementById('app-wechat').style.display = 'flex';
    currentApp = 'wechat';
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

    const navAction = document.querySelector('#app-wechat .nav-action');
    if (navAction) {
        navAction.textContent = '+';
        navAction.onclick = tab === 'moments'
            ? function() { openMomentPostPage(); }
            : function() { openWechatMenu(); };
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

function loadWechatUser() {
    const saved = localStorage.getItem('wechatUser');
    if (saved) {
        wechatUser = JSON.parse(saved);
    }
}

function saveWechatUser() {
    localStorage.setItem('wechatUser', JSON.stringify(wechatUser));
}

function renderUserProfile() {
    const container = document.getElementById('userProfile');
    if (!container) return;
    
    let avatarContent = wechatUser.nickname.charAt(0);
    let avatarStyle = 'background: white; border: 1px solid #eee; color: #999; font-size: 48px; display: flex; align-items: center; justify-content: center;';
    
    if (wechatUser.avatar) {
        if (wechatUser.avatar.includes('url(')) {
            avatarStyle = `background: ${wechatUser.avatar}; background-size: cover; background-position: center; border: 1px solid #eee;`;
            avatarContent = '';
        } else if (wechatUser.avatar !== 'white') {
            avatarStyle = `background: ${wechatUser.avatar}; border: 1px solid #eee;`;
            avatarContent = '';
        }
    }
    
    const safeBio = wechatUser.bio && wechatUser.bio.trim()
        ? wechatUser.bio
        : '添加一句签名，让朋友更了解你';

    container.innerHTML = `
        <div class="profile-hero-card">
            <div class="profile-hero-glow profile-hero-glow-left"></div>
            <div class="profile-hero-glow profile-hero-glow-right"></div>
            <div class="profile-header">
                <div class="profile-avatar-wrap">
                    <div class="profile-avatar profile-avatar-large" style="${avatarStyle}" onclick="showEditUserModal()">
                        ${avatarContent}
                    </div>
                    <button class="profile-avatar-edit" onclick="showEditUserModal()">更换头像</button>
                </div>
                <div class="profile-name-row">
                    <div class="profile-name">${wechatUser.nickname}</div>
                </div>
                <div class="profile-real-name">${wechatUser.realName}</div>
                <div class="profile-bio-card">
                    <div class="profile-bio-label">个性签名</div>
                    <div class="profile-bio">${safeBio}</div>
                </div>
                <button class="profile-edit-btn" onclick="showEditUserModal()">编辑个人信息</button>
            </div>
        </div>
        <div class="profile-section-card">
            <div class="profile-section-title">常用功能</div>
            <div class="profile-quick-grid">
                <div class="profile-quick-item">
                    <div class="profile-quick-icon status">✦</div>
                    <div class="profile-quick-text">
                        <div class="profile-quick-name">我的状态</div>
                        <div class="profile-quick-desc">记录今天的心情</div>
                    </div>
                </div>
                <div class="profile-quick-item">
                    <div class="profile-quick-icon favorite">★</div>
                    <div class="profile-quick-text">
                        <div class="profile-quick-name">收藏</div>
                        <div class="profile-quick-desc">保存重要内容</div>
                    </div>
                </div>
                <div class="profile-quick-item">
                    <div class="profile-quick-icon album">◉</div>
                    <div class="profile-quick-text">
                        <div class="profile-quick-name">相册</div>
                        <div class="profile-quick-desc">查看精彩瞬间</div>
                    </div>
                </div>
                <div class="profile-quick-item">
                    <div class="profile-quick-icon settings">⚙</div>
                    <div class="profile-quick-text">
                        <div class="profile-quick-name">设置</div>
                        <div class="profile-quick-desc">管理账号与外观</div>
                    </div>
                </div>
            </div>
        </div>
        <div class="profile-section-card profile-tips-card">
            <div class="profile-section-title">个人主页</div>
            <div class="profile-tip-row">
                <span class="profile-tip-dot"></span>
                <span>完善头像、昵称和签名，让“我”的页面更有个人风格</span>
            </div>
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
    
    let avatarDisplay = wechatUser.nickname.charAt(0);
    let avatarStyle = 'background: white; border: 1px solid #eee; color: #999; font-size: 48px; display: flex; align-items: center; justify-content: center;';
    
    if (wechatUser.avatar) {
        if (wechatUser.avatar.includes('url(')) {
            avatarStyle = `background: ${wechatUser.avatar}; background-size: cover; background-position: center; border: 1px solid #eee;`;
            avatarDisplay = '';
        } else if (wechatUser.avatar !== 'white') {
            avatarStyle = `background: ${wechatUser.avatar}; border: 1px solid #eee;`;
            avatarDisplay = '';
        }
    }
    
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
                        <div class="avatar-preview" id="userAvatarPreview" style="${avatarStyle}" onclick="document.getElementById('userAvatarFileInput').click()">${avatarDisplay}</div>
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
    const bgValue = previewEl.style.backgroundImage || previewEl.style.background || 'white';
    const urlMatch = bgValue.match(/url\((['"]?)(.*?)\1\)/i);
    if (urlMatch && urlMatch[2]) {
        wechatUser.avatar = `url('${urlMatch[2]}')`;
    } else {
        wechatUser.avatar = bgValue;
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
                <div class="color-option" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);" onclick="selectUserAvatarColor('linear-gradient(135deg, #667eea 0%, #764ba2 100%)')"></div>
                <div class="color-option" style="background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);" onclick="selectUserAvatarColor('linear-gradient(135deg, #f093fb 0%, #f5576c 100%)')"></div>
                <div class="color-option" style="background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);" onclick="selectUserAvatarColor('linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)')"></div>
                <div class="color-option" style="background: linear-gradient(135deg, #43e97b 0%, #38f9d7 100%);" onclick="selectUserAvatarColor('linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)')"></div>
                <div class="color-option" style="background: linear-gradient(135deg, #fa709a 0%, #fee140 100%);" onclick="selectUserAvatarColor('linear-gradient(135deg, #fa709a 0%, #fee140 100%)')"></div>
                <div class="color-option" style="background: linear-gradient(135deg, #30cfd0 0%, #330867 100%);" onclick="selectUserAvatarColor('linear-gradient(135deg, #30cfd0 0%, #330867 100%)')"></div>
                <div class="color-option" style="background: linear-gradient(135deg, #a8edea 0%, #fed6e3 100%);" onclick="selectUserAvatarColor('linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)')"></div>
                <div class="color-option" style="background: linear-gradient(135deg, #ff9a56 0%, #ff6a88 100%);" onclick="selectUserAvatarColor('linear-gradient(135deg, #ff9a56 0%, #ff6a88 100%)')"></div>
            </div>
        </div>
    `;
    document.getElementById('app-wechat').appendChild(picker);
}

function selectUserAvatarColor(color) {
    document.getElementById('userAvatarPreview').style.background = color;
    document.getElementById('userColorPicker').remove();
}

function getAvatarRenderConfig(avatar, nickname = '?') {
    const normalizedAvatar = typeof avatar === 'string' ? avatar.trim() : '';
    const fallbackText = nickname ? nickname.charAt(0) : '?';

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
            avatarStyle: `background-image: ${safeImageValue}; background-size: cover; background-position: center; background-repeat: no-repeat;`
        };
    }

    if (isWhiteAvatar) {
        return {
            avatarContent: fallbackText,
            avatarStyle: 'background: #fdfdfd; border: 1px solid #e8e8e8; color: #333;'
        };
    }

    return {
        avatarContent: fallbackText,
        avatarStyle: `background: ${normalizedAvatar}; color: #ffffff; text-shadow: 0 2px 4px rgba(0,0,0,0.3), 0 0 8px rgba(0,0,0,0.2);`
    };
}

// ================= 通讯录功能 =================
function renderContactsList() {
    const container = document.getElementById('contactsList');
    if (!container) return;
    
    const contacts = wechatRoles.filter(role => role.type !== 'me');
    
    if (contacts.length === 0) {
        container.innerHTML = '<div style="padding: 20px; text-align: center; color: #999;">暂无联系人</div>';
        return;
    }
    
    container.innerHTML = contacts.map(contact => {
        const avatarConfig = getAvatarRenderConfig(contact.avatar, contact.nickname);

        return `
            <div class="chat-item" onclick="selectAndEnterChat(${contact.id})">
                <div class="avatar" style="${avatarConfig.avatarStyle}">${avatarConfig.avatarContent}</div>
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

function markRoleInteractedWithMoment(state, roleId, momentId, detail = {}) {
    if (!state?.[roleId]?.interactedMoments) return;
    state[roleId].interactedMoments[momentId] = {
        liked: !!detail.liked,
        commented: !!detail.commented,
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

function shouldRoleLikeMoment(role, moment) {
    const profile = getRolePersonalityProfile(role);
    let score = profile.likeProbability;

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

    if (dailyCount >= profile.dailyCommentLimit) {
        return false;
    }

    let score = profile.commentProbability;

    if (typeof moment?.content === 'string' && moment.content.length > 40) {
        score += 0.06;
    }

    const commentsCount = Array.isArray(moment?.comments) ? moment.comments.length : 0;
    if (commentsCount >= 3) {
        score -= 0.08;
    }

    return Math.random() < Math.min(0.72, Math.max(0.01, score));
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

    const prompt = `你是${role.nickname}，性格：${role.systemPrompt}。
${getRoleMomentPreferenceHint(role)}
现在要给一条朋友圈写评论。
动态内容：${moment?.content || '（无文字）'}
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

                // 已互动过则跳过
                if (hasRoleInteractedWithMoment(state, roleId, momentId)) continue;

                const authorName = String(moment.author || '').trim();
                if (authorName && authorName === role.nickname) continue;

                let liked = false;
                let commented = false;

                if (!isRoleAlreadyLikedMoment(moment, role.nickname) && shouldRoleLikeMoment(role, moment)) {
                    if (!Array.isArray(moment.likes)) moment.likes = [];
                    moment.likes.push({
                        name: role.nickname,
                        avatar: role.avatar || 'white'
                    });
                    liked = true;
                    changed = true;
                }

                if (shouldRoleCommentMoment(role, moment, state, dateKey)) {
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

                if (liked || commented) {
                    markRoleInteractedWithMoment(state, roleId, momentId, { liked, commented });
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
    if (wechatUser.avatar) {
        if (wechatUser.avatar.includes('url(')) {
            userAvatar.style.background = wechatUser.avatar;
            userAvatar.style.backgroundSize = 'cover';
            userAvatar.style.backgroundPosition = 'center';
            userAvatar.textContent = '';
        } else if (wechatUser.avatar !== 'white') {
            userAvatar.style.background = wechatUser.avatar;
            userAvatar.textContent = '';
        } else {
            userAvatar.style.background = '#fff';
            userAvatar.textContent = wechatUser.nickname ? wechatUser.nickname.charAt(0) : '我';
        }
    } else {
        userAvatar.style.background = '#fff';
        userAvatar.textContent = wechatUser.nickname ? wechatUser.nickname.charAt(0) : '我';
    }
    
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
    
    // 头像样式
    let avatarContent = authorName.charAt(0);
    let avatarStyle = '';
    
    if (authorAvatar) {
        if (authorAvatar.includes('url(')) {
            avatarStyle = `${authorAvatar}; background-size: cover; background-position: center;`;
            avatarContent = '';
        } else if (authorAvatar !== 'white' && authorAvatar.includes('gradient')) {
            avatarStyle = `${authorAvatar};`;
            avatarContent = '';
        } else if (authorAvatar === 'white' || !authorAvatar) {
            avatarStyle = 'background: #f0f0f0; border: 1px solid #eee; color: #999;';
        } else {
            avatarStyle = `background: ${authorAvatar};`;
            avatarContent = '';
        }
    } else {
        avatarStyle = 'background: #f0f0f0; color: #999;';
    }
    
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
                        <button class="moment-action-link${userLiked ? ' is-active' : ''}" type="button" onclick="likeMoment(${index})" aria-label="点赞">
                            <span class="moment-action-symbol" aria-hidden="true">♡</span>
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

    wechatApp.style.display = 'none';
    postApp.style.display = 'flex';
    currentApp = 'moment-post';

    resetMomentPostPage();

    setTimeout(() => {
        if (textarea) textarea.focus();
    }, 100);
}

function backToMomentsFromPost() {
    const wechatApp = document.getElementById('app-wechat');
    const postApp = document.getElementById('app-moment-post');

    if (postApp) postApp.style.display = 'none';
    if (wechatApp) wechatApp.style.display = 'flex';

    currentApp = 'wechat';
    renderMomentsList();
}

function resetMomentPostPage() {
    momentPostImages = [];

    const textarea = document.getElementById('momentPostContent');
    const input = document.getElementById('momentImageInput');

    if (textarea) {
        textarea.value = '';
    }

    if (input) {
        input.value = '';
    }

    updateMomentPostCounter();
    renderMomentPostImagePreview();
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
    if (!container) return;

    if (momentPostImages.length === 0) {
        container.innerHTML = '';
        return;
    }

    container.innerHTML = momentPostImages.map((img, index) => `
        <div class="moment-post-preview-item">
            <img src="${img}" alt="预览图片 ${index + 1}">
            <button class="moment-post-preview-remove" onclick="removeMomentPostImage(${index})">×</button>
        </div>
    `).join('');
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
    document.getElementById('app-wechat').style.display = 'none';
    document.getElementById('app-chat').style.display = 'flex';
    currentApp = 'chat';
    closeChatMediaPanel();
    resetChatModeToOnline();
    resetChatSelectionState();

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
            chatBox.appendChild(createUserBubble(msg.content, true, messageId));
        } else if (msg.role === 'assistant') {
            chatBox.appendChild(createAIBubble(msg.content, true, role, messageId));
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
        const preview = typeof lastMsg.content === 'string'
            ? lastMsg.content
            : lastMsg.content?.type === 'image'
                ? '[图片]'
                : lastMsg.content?.type === 'sticker'
                    ? `[表情包] ${lastMsg.content.label || ''}`.trim()
                    : lastMsg.content?.type === 'voice'
                        ? `[语音] ${lastMsg.content.text || ''}`.trim()
                        : '[消息]';
        updateLastMessage(preview);
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
    };

    bubble.addEventListener('pointerdown', (event) => {
        if (event.pointerType === 'mouse' && event.button !== 0) return;

        clearPressTimer();
        chatLongPressTimer = setTimeout(() => {
            selectedChatMessageIds.add(resolvedMessageId);
            setChatSelectionMode(true);
            updateSingleBubbleSelectionVisual(bubble);
            updateChatSelectionToolbar();
            if (navigator.vibrate) navigator.vibrate(20);
        }, CHAT_LONG_PRESS_MS);
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

// 创建用户消息气泡（不包含时间戳）
// 参数：text(消息内容), showAvatar(是否显示头像)
function createUserBubble(text, showAvatar = true, messageId = null) {
    const userMsg = document.createElement('div');
    userMsg.className = 'msg-bubble-user';
    
    if (showAvatar) {
        // 显示头像
        const userAvatar = document.createElement('div');
        userAvatar.className = 'msg-avatar';
        if (wechatUser.avatar) {
            if (wechatUser.avatar.includes('url(')) {
                userAvatar.style.background = `${wechatUser.avatar}`;
                userAvatar.style.backgroundSize = 'cover';
                userAvatar.style.backgroundPosition = 'center';
                userAvatar.textContent = '';
            } else if (wechatUser.avatar !== 'white') {
                userAvatar.style.background = wechatUser.avatar;
                userAvatar.textContent = '';
            } else {
                userAvatar.style.background = 'white';
                userAvatar.style.border = '1px solid #eee';
                userAvatar.style.color = '#999';
                userAvatar.style.fontSize = '24px';
                userAvatar.style.display = 'flex';
                userAvatar.style.alignItems = 'center';
                userAvatar.style.justifyContent = 'center';
                userAvatar.textContent = wechatUser.nickname.charAt(0);
            }
        }
        userMsg.appendChild(userAvatar);
    } else {
        // 隐藏头像，创建同等宽度的空白占位符保持对齐
        const spacer = document.createElement('div');
        spacer.className = 'msg-avatar';
        spacer.style.background = 'transparent';
        spacer.style.border = 'none';
        spacer.style.width = '50px';
        spacer.style.height = '50px';
        spacer.style.flexShrink = '0';
        userMsg.appendChild(spacer);
    }
    
    const bubbleDiv = createMessageContentElement(text);
    userMsg.appendChild(bubbleDiv);
    bindChatBubbleSelectionBehavior(userMsg, messageId);
    
    return userMsg;
}

// 创建AI消息气泡（不包含时间戳）
// 参数：text(消息内容), showAvatar(是否显示头像), role(角色信息)
function createAIBubble(text, showAvatar, role, messageId = null) {
    const aiMsg = document.createElement('div');
    aiMsg.className = 'msg-bubble-ai';
    
    if (showAvatar) {
        // 显示头像 - 只要 showAvatar 为 true 就显示
        const aiAvatar = document.createElement('div');
        aiAvatar.className = 'msg-avatar';
        
        if (role && role.avatar) {
            if (role.avatar.includes('url(')) {
                aiAvatar.style.background = `${role.avatar}`;
                aiAvatar.style.backgroundSize = 'cover';
                aiAvatar.style.backgroundPosition = 'center';
                aiAvatar.textContent = '';
            } else if (role.avatar !== 'white') {
                aiAvatar.style.background = role.avatar;
                aiAvatar.textContent = '';
            } else {
                aiAvatar.style.background = 'white';
                aiAvatar.style.border = '1px solid #eee';
                aiAvatar.style.color = '#999';
                aiAvatar.style.fontSize = '24px';
                aiAvatar.style.display = 'flex';
                aiAvatar.style.alignItems = 'center';
                aiAvatar.style.justifyContent = 'center';
                aiAvatar.textContent = role.nickname.charAt(0);
            }
        } else if (role) {
            // role 存在但 avatar 为空，使用默认白色背景加首字母
            aiAvatar.style.background = 'white';
            aiAvatar.style.border = '1px solid #eee';
            aiAvatar.style.color = '#999';
            aiAvatar.style.fontSize = '24px';
            aiAvatar.style.display = 'flex';
            aiAvatar.style.alignItems = 'center';
            aiAvatar.style.justifyContent = 'center';
            aiAvatar.textContent = role.nickname ? role.nickname.charAt(0) : '?';
        } else {
            // role 不存在时，也显示一个默认头像
            aiAvatar.style.background = 'white';
            aiAvatar.style.border = '1px solid #eee';
            aiAvatar.style.color = '#999';
            aiAvatar.style.fontSize = '24px';
            aiAvatar.style.display = 'flex';
            aiAvatar.style.alignItems = 'center';
            aiAvatar.style.justifyContent = 'center';
            aiAvatar.textContent = '?';
        }
        aiMsg.appendChild(aiAvatar);
    } else {
        // 隐藏头像，创建同等宽度的空白占位符保持对齐
        const spacer = document.createElement('div');
        spacer.className = 'msg-avatar';
        spacer.style.background = 'transparent';
        spacer.style.border = 'none';
        spacer.style.width = '50px';
        spacer.style.height = '50px';
        spacer.style.flexShrink = '0';
        aiMsg.appendChild(spacer);
    }
    
    const bubbleDiv = createMessageContentElement(text);
    aiMsg.appendChild(bubbleDiv);
    bindChatBubbleSelectionBehavior(aiMsg, messageId);
    
    return aiMsg;
}

function createMessageContentElement(content) {
    const bubbleDiv = document.createElement('div');
    bubbleDiv.className = 'msg-text';

    if (content && typeof content === 'object') {
        if (content.type === 'image') {
            if (content.url) {
                bubbleDiv.classList.add('msg-image');
                const image = document.createElement('img');
                image.src = content.url;
                image.alt = content.name || '发送的图片';
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

            const voiceRow = document.createElement('div');
            voiceRow.className = 'voice-row';

            const playBtn = document.createElement('button');
            playBtn.type = 'button';
            playBtn.className = 'voice-play-btn';
            playBtn.textContent = '▶';

            const waveform = document.createElement('div');
            waveform.className = 'voice-waveform';
            waveform.innerHTML = '<span></span><span></span><span></span><span></span><span></span><span></span>';

            const duration = document.createElement('div');
            duration.className = 'voice-duration';
            duration.textContent = '0″';

            voiceRow.appendChild(playBtn);
            voiceRow.appendChild(waveform);
            voiceRow.appendChild(duration);
            bubbleDiv.appendChild(voiceRow);

            if (content.url) {
                const audio = document.createElement('audio');
                audio.preload = 'metadata';
                audio.src = content.url;
                audio.className = 'voice-audio-core';
                bubbleDiv.appendChild(audio);

                const syncPlayState = () => {
                    const playing = !audio.paused && !audio.ended;
                    bubbleDiv.classList.toggle('playing', playing);
                    playBtn.textContent = playing ? '❚❚' : '▶';
                };

                playBtn.onclick = () => {
                    if (audio.paused) {
                        audio.play().catch(() => {
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
                    duration.textContent = '失败';
                    playBtn.disabled = true;
                };
            } else {
                duration.textContent = '无音频';
                playBtn.disabled = true;
            }

            if (content.text) {
                const transcript = document.createElement('div');
                transcript.className = 'voice-transcript';
                transcript.textContent = content.text;
                bubbleDiv.appendChild(transcript);
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
            stickerPill.textContent = content.value || content.label || '🐰';
            bubbleDiv.appendChild(stickerPill);
            return bubbleDiv;
        }
    }

    bubbleDiv.textContent = typeof content === 'string' ? content : '';
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

    return '';
}

function buildChatHistoryForAPI(history, useVision = false) {
    return history
        .map((msg) => {
            const normalizedContent = buildMessageContentForAPI(msg.content, msg.role, useVision);
            if (!normalizedContent || (Array.isArray(normalizedContent) && normalizedContent.length === 0)) {
                return null;
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
        return `data:image/png;base64,${value}`;
    }

    const imageUrlCandidate =
        data?.data?.[0]?.url
        || data?.data?.[0]?.image_url
        || data?.data?.[0]?.src
        || data?.data?.[0]?.link;

    if (typeof imageUrlCandidate === 'string' && imageUrlCandidate.trim()) {
        return imageUrlCandidate.trim();
    }

    return '';
}

async function requestImageGeneration(promptText) {
    if (!apiSettings.enableImageGeneration) {
        throw new Error('请先在设置中启用图片生成');
    }

    const apiKey = String(apiSettings.imageApiKey || apiSettings.apiKey || '').trim();
    if (!apiKey) {
        throw new Error('缺少图片 API Key');
    }

    const payload = {
        model: apiSettings.imageModelName || CONFIG.DEFAULT_IMAGE_MODEL,
        prompt: String(promptText || '').trim(),
        size: apiSettings.imageSize || CONFIG.DEFAULT_IMAGE_SIZE
    };

    const response = await fetch(buildImageApiUrl(CONFIG.IMAGE_GENERATIONS_PATH), {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
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
        throw new Error(extractErrorMessage(data, `图片生成失败（HTTP ${response.status}）`));
    }

    const dataUrl = extractImageDataUrlFromResponse(data);
    if (!dataUrl) {
        throw new Error('图片接口未返回可用图片数据');
    }

    return {
        dataUrl,
        mimeType: getDataImageMimeType(dataUrl) || 'image/png',
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

async function generateAssistantImageReply(promptText) {
    const chatBox = document.getElementById('chatBox');
    const loadingMsg = document.createElement('div');
    loadingMsg.className = 'msg-bubble-ai system';
    loadingMsg.textContent = '正在生成图片...';
    loadingMsg.id = 'imageLoadingMsg';
    chatBox.appendChild(loadingMsg);
    chatBox.scrollTop = chatBox.scrollHeight;

    try {
        const role = wechatRoles.find(r => r.id === currentRoleId);
        const { dataUrl, mimeType, revisedPrompt } = await requestImageGeneration(promptText);
        const imageId = await saveChatImageToDB(
            { name: promptText.slice(0, 30) || 'AI生成图片', type: mimeType },
            dataUrl
        );

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

        if (shouldShowTime(chatHistory.length > 1 ? chatHistory[chatHistory.length - 2].timestamp : null, timestamp)) {
            chatBox.appendChild(createTimeDivider(timestamp));
        }

        chatBox.appendChild(createAIBubble(imageContent, true, role, messageId));
        chatBox.scrollTop = chatBox.scrollHeight;
        updateLastMessage('[图片]');
        renderWechatChatList();
    } catch (error) {
        const loading = document.getElementById('imageLoadingMsg');
        if (loading) loading.remove();
        showAIError(getReadableAppErrorMessage(error, '图片生成失败，请稍后重试'));
    }
}

async function handleDrawCommand(rawPrompt) {
    const promptText = String(rawPrompt || '').trim();
    if (!promptText) {
        showAIError('用法：/draw 你想生成的画面描述');
        return;
    }

    sendUserChatContent(`/draw ${promptText}`, `/draw ${promptText}`);
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

    const naturalImageRequest = parseNaturalLanguageImageRequest(text);
    if (naturalImageRequest) {
        sendUserChatContent(text);

        if (naturalImageRequest.needsDescription) {
            const defaultPrompt = '一张适合聊天场景分享的精致图片，二次元风格，画面干净，氛围自然，可爱，适合微信聊天发送';
            await generateAssistantImageReply(defaultPrompt);
            return;
        }

        await generateAssistantImageReply(naturalImageRequest.promptText);
        return;
    }

    sendUserChatContent(text);
}

function sendUserChatContent(content, previewText) {
    const chatBox = document.getElementById('chatBox');
    const timestamp = Date.now();
    const messageId = `msg_${timestamp}_${Math.random().toString(36).slice(2, 8)}`;

    if (chatHistory.length === 0 || shouldShowTime(chatHistory[chatHistory.length - 1].timestamp, timestamp)) {
        const timeDivider = createTimeDivider(timestamp);
        chatBox.appendChild(timeDivider);
    }

    const userMsg = createUserBubble(content, true, messageId);
    chatBox.appendChild(userMsg);
    chatBox.scrollTop = chatBox.scrollHeight;

    chatHistory.push({ id: messageId, role: 'user', content, timestamp });
    if (chatHistory.length > CONFIG.MAX_HISTORY) {
        chatHistory = chatHistory.slice(-CONFIG.MAX_HISTORY);
    }

    saveChatHistory();
    addSharedEvent({
        sourceMode: getCurrentChatMode(),
        speakerRole: 'user',
        content,
        timestamp
    });

    const fallbackPreview = typeof content === 'string'
        ? content
        : content?.type === 'image'
            ? '[图片]'
            : content?.label || '[表情包]';

    lastUserMessage = content;
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

    if (homeView) homeView.classList.toggle('active', currentChatMediaSection === 'home');
    if (stickerView) stickerView.classList.toggle('active', currentChatMediaSection === 'stickers');
    if (imageView) imageView.classList.toggle('active', currentChatMediaSection === 'images');
    if (gamesView) gamesView.classList.toggle('active', currentChatMediaSection === 'games');

    if (subtitle) {
        subtitle.textContent = currentChatMediaSection === 'stickers'
            ? '挑选收藏的表情包，或继续导入新的表情包'
            : currentChatMediaSection === 'images'
                ? '发送临时图片，不会自动加入表情包库'
                : currentChatMediaSection === 'games'
                    ? '选择小游戏，和当前角色亲自互动'
                    : '发送图片 / 表情包 / 更多内容';
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
    }

    panel.classList.toggle('active', isChatMediaPanelOpen);
    trigger.classList.toggle('active', isChatMediaPanelOpen);
}

function openChatMediaSection(section) {
    currentChatMediaSection = section;

    if (section === 'stickers') {
        renderChatStickerLibrary();
    }

    updateChatMediaPanelView();
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

            sendUserChatContent(
                {
                    type: 'image',
                    imageId,
                    url: preparedImage.dataUrl,
                    name: file.name || '聊天图片'
                },
                '[图片]'
            );
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
async function replyWithEmoji() {
    let userMessage = lastUserMessage;

    if (!userMessage) {
        const lastUserChat = [...chatHistory].reverse().find(msg => msg.role === 'user');
        userMessage = lastUserChat ? lastUserChat.content : '';
    }
    
    // 如果用户没有发送消息，使用隐藏的系统消息让AI主动找话题
    if (!userMessage) {
        userMessage = '[用户没有说话，请你主动找话题，符合你的性格自然说一句话。]';
    }
    
    // 调用AI（隐藏消息不会显示在聊天框，只传给API）
    await callAIWithUserInfo(userMessage);
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

    return {
        ...role,
        thirdPersonPronoun,
        genderIdentity
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
        .replace(/\r\n?/g, '\n')
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

    return paragraphs.join('\n');
}

function hasOfflineNarrativeQuality(text = '') {
    const normalized = String(text || '')
        .replace(/\r\n?/g, '\n')
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
    const crossModeMemorySection = crossModeMemoryText
        ? `\n\n${crossModeMemoryText}\n请把这些跨模式经历当作你和对方共同发生过的真实记忆，在当前回复里保持前后连贯。`
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
11. 你和对方是普通朋友关系，不是亲密恋人。保持符合${role.systemPrompt}性格的自然距离感，不要自作主张升温关系。
12. 默认以文字聊天为主；当用户明确要求“发图/来张图/画一张图/生成图片”等，且当前已开启图片生成功能时，允许你发送图片。若用户没说明想看什么图，就先简短追问需求；不要再说自己“发不了图”。
13. 不要因为角色是${roleIdentity}就自动推导说话方式、气质、动作偏好或性格模板；角色怎么说话、怎么相处，只由“性格”和当前情境决定。
14. 【线上模式】标点按自然聊天习惯使用，不要堆叠感叹号、省略号或连续语气词；避免每句都用问号结尾。
15. 【线上模式强制】绝对禁止旁白叙述、动作描写、场景描写、心理描写、第三人称叙事；只允许输出可直接发送到聊天气泡里的“说的话”。线下模式不受此限制。${offlineNarrativeSection}${crossModeMemorySection}${styleAnchorSection}

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
        .replace(/\r\n?/g, '\n')
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
async function callAIWithUserInfo(userText) {
    const chatBox = document.getElementById('chatBox');
    const role = wechatRoles.find(r => r.id === currentRoleId);
    const titleEl = document.querySelector('#app-chat .nav-title');
    const originalTitle = role ? role.nickname : '对话';
    
    // 检查API配置
    if (!apiSettings.apiKey) {
        showAIError('请先配置API密钥（设置 > AI连接配置）');
        return;
    }
    
    // 检查角色是否存在
    if (!role) {
        showAIError('请先选择一个角色');
        return;
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
        maxEvents: 8
    });
    const styleAnchorText = buildStyleAnchorFromHistory({
        roleId: currentRoleId,
        maxSamples: 6,
        maxLength: 18
    });

    let systemPrompt = `${buildRoleplaySystemPrompt(role, currentDate, currentTime, crossModeMemory.memoryText, styleAnchorText)}${getActiveGamePromptContext()}`;
    
    // 显示加载中 - 隐藏以避免视觉混乱
    const loadingMsg = document.createElement('div');
    loadingMsg.className = 'msg-bubble-ai system';
    loadingMsg.textContent = '对方正在输入...';
    loadingMsg.id = 'loadingMsg';
    loadingMsg.style.visibility = 'hidden';  // 隐藏，不占据空间
    chatBox.appendChild(loadingMsg);
    chatBox.scrollTop = chatBox.scrollHeight;
    
    try {
        const { data, downgradedFromVision, visionFallbackReason } = await requestChatCompletionWithFallback({
            systemPrompt,
            history: chatHistory.slice(-10),
            userContent: userText,
            temperature: apiSettings.temperature !== undefined ? apiSettings.temperature : 0.7,
            topP: 0.95,
            frequencyPenalty: 0.5,
            presencePenalty: 0.6,
            maxTokens: 500
        });
        
        // 移除加载提示
        const loading = document.getElementById('loadingMsg');
        if (loading) loading.remove();

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
        reply = removeHardTimestampIfNotAsked(reply, normalizeChatContentForAPI(userText, 'user'), isOfflineMode);

        // 线下模式：强制小说化叙事 + 标点兜底
        if (isOfflineMode) {
            reply = formatOfflineNarrativeText(reply, role.nickname);
            reply = dedupeOfflineNarrativeText(reply);
            reply = enforceOfflineLengthRange(reply, 100, 250);

            if (!hasOfflineNarrativeQuality(reply)) {
                const strongerPrompt = `${systemPrompt}

【线下重写强约束】
必须是“旁白叙述 + 自然对白”的线下小说片段：
- 固定3段：①括号场景/动作 ②对白+神态 ③停顿后情绪推进；
- 文字里必须出现景色变化、动作细节、神态细节；
- 绝对禁止复读同一句；
- 不要总结收尾。`;
                return await retryAICall(userText, role, chatBox, strongerPrompt);
            }
        } else {
            reply = enforceOnlineSpeechOnly(reply);
        }
        
        // 检测是否仍然包含禁止词汇，如果有则触发重试
        if (/AI|人工智能|助手|程序|模型|算法/i.test(reply)) {
            console.warn('检测到AI身份暴露，触发重试...');
            // 重新调用一次（最多一次重试以避免无限循环）
            return await retryAICall(userText, role, chatBox, systemPrompt);
        }
        
        // 普通聊天可拆句显示；线下小说模式必须保留段落结构，不能按标点硬拆
        let messages_display = isOfflineMode
            ? [reply]
            : splitAssistantReplyForDisplay(reply, { preserveParagraphs: false });

        // 仅在线聊天模式做去重
        if (!isOfflineMode) {
            messages_display = deduplicateMessages(messages_display);
            console.log('去重后消息数:', messages_display.length);
        }

        // 线上 1~4 句；线下整段直出 1 条
        messages_display = isOfflineMode
            ? messages_display.filter(Boolean).slice(0, 1)
            : messages_display.filter(Boolean).slice(0, 4);

        if (messages_display.length < 1) {
            console.warn('回复为空，触发重试...');
            const loading = document.getElementById('loadingMsg');
            if (loading) loading.remove();
            return await retryAICall(userText, role, chatBox, systemPrompt);
        }

        let hasSentVoiceOnly = false;
        try {
            const voiceContent = await maybeSendRoleVoiceReply(role, messages_display);
            hasSentVoiceOnly = !!voiceContent;
        } catch (voiceError) {
            notifyRoleVoiceReplyFailure(voiceError);
        }

        if (hasSentVoiceOnly) {
            if (titleEl) {
                titleEl.textContent = originalTitle;
            }
            return;
        }
        
        // 逐条显示消息（视觉效果）- 使用统一的createAIBubble函数
        const assistantBatch = messages_display.map((msg, idx) => {
            const messageTimestamp = Date.now() + idx;
            return {
                id: `msg_${messageTimestamp}_${Math.random().toString(36).slice(2, 8)}`,
                content: msg,
                timestamp: messageTimestamp
            };
        });

        for (let i = 0; i < assistantBatch.length; i++) {
            await new Promise(resolve => {
                setTimeout(() => {
                    const showAvatar = true;  // 每条都显示头像
                    const aiMsg = createAIBubble(assistantBatch[i].content, showAvatar, role, assistantBatch[i].id);
                    chatBox.appendChild(aiMsg);
                    chatBox.scrollTop = chatBox.scrollHeight;
                    
                    if (navigator.vibrate) navigator.vibrate(30);
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

        if (isOfflineMode) {
            renderOfflineStoryFeed();
        }

        // 所有消息显示完毕后恢复标题为角色昵称
        if (titleEl) {
            titleEl.textContent = originalTitle;
        }
        
    } catch (error) {
        const loading = document.getElementById('loadingMsg');
        if (loading) loading.remove();
        showAIError(getReadableAppErrorMessage(error, '消息发送失败，请稍后重试'));
        
        // 发生错误时也恢复标题
        if (titleEl) {
            titleEl.textContent = originalTitle;
        }
    }
}

// 重试机制
async function retryAICall(userText, role, chatBox, previousPrompt) {
    const titleEl = document.querySelector('#app-chat .nav-title');
    const originalTitle = role ? role.nickname : '对话';
    
    try {
        const modeWarning = isOfflineMode
            ? '3. 线下模式：简短叙事+自然对白，100~250字，不限制段数。'
            : '3. 线上模式：短句口语，限制1~4句，不要每句都问号。';
        const retryToneHint = isOfflineMode
            ? '请重写得更口语、更有画面感，不要模板腔，不要堆标点。'
            : '请重写得更口语、更短，不要模板腔，不要堆标点。';
        const retryPrompt = `${previousPrompt}

【重写要求】上条回复太像机器。${retryToneHint}
1. 不要提及AI、程序、模型
2. 按角色性格“${role.systemPrompt}”回复
3. 不刻意迎合，不强互动，不拉长句
4. 总句数严格1~4句（默认1~2句）
${modeWarning}`;
        
        const { data, downgradedFromVision, visionFallbackReason } = await requestChatCompletionWithFallback({
            systemPrompt: retryPrompt,
            history: chatHistory.slice(-10),
            userContent: userText,
            temperature: 0.75,
            maxTokens: 500
        });

        if (downgradedFromVision) {
            showAIError(getVisionFallbackMessage(visionFallbackReason));
        }

        let reply = data.choices[0].message.content;
        reply = sanitizeAIResponse(reply, role.nickname);
        reply = removeHardTimestampIfNotAsked(reply, normalizeChatContentForAPI(userText, 'user'), isOfflineMode);

        if (isOfflineMode) {
            reply = formatOfflineNarrativeText(reply, role.nickname);
            reply = dedupeOfflineNarrativeText(reply);
            reply = enforceOfflineLengthRange(reply, 100, 250);
        } else {
            reply = enforceOnlineSpeechOnly(reply);
        }
        
        let messages_display = isOfflineMode
            ? [reply]
            : splitAssistantReplyForDisplay(reply, { preserveParagraphs: false });

        if (!isOfflineMode) {
            messages_display = deduplicateMessages(messages_display);
        }

        // 重试后同样：线下整段直出
        messages_display = isOfflineMode
            ? messages_display.filter(Boolean).slice(0, 1)
            : messages_display.filter(Boolean).slice(0, 4);
        if (messages_display.length < 1) {
            messages_display = ['嗯'];
        }

        let hasSentVoiceOnly = false;
        try {
            const voiceContent = await maybeSendRoleVoiceReply(role, messages_display);
            hasSentVoiceOnly = !!voiceContent;
        } catch (voiceError) {
            notifyRoleVoiceReplyFailure(voiceError);
        }

        if (hasSentVoiceOnly) {
            if (titleEl) {
                titleEl.textContent = originalTitle;
            }
            return;
        }
        
        // 逐条显示消息（视觉效果）- 使用统一的createAIBubble函数
        const assistantBatch = messages_display.map((msg, idx) => {
            const messageTimestamp = Date.now() + idx;
            return {
                id: `msg_${messageTimestamp}_${Math.random().toString(36).slice(2, 8)}`,
                content: msg,
                timestamp: messageTimestamp
            };
        });

        for (let i = 0; i < assistantBatch.length; i++) {
            await new Promise(resolve => {
                setTimeout(() => {
                    const showAvatar = true;  // 每条都显示头像
                    const aiMsg = createAIBubble(assistantBatch[i].content, showAvatar, role, assistantBatch[i].id);
                    chatBox.appendChild(aiMsg);
                    chatBox.scrollTop = chatBox.scrollHeight;
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

        if (isOfflineMode) {
            renderOfflineStoryFeed();
        }

        // 恢复标题为角色昵称
        if (titleEl) {
            titleEl.textContent = originalTitle;
        }
    } catch (error) {
        showAIError(getReadableAppErrorMessage(error, '重新生成回复失败，请稍后重试'));
        
        // 发生错误时也恢复标题
        if (titleEl) {
            titleEl.textContent = originalTitle;
        }
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
        maxEvents: 8
    });
    const styleAnchorText = buildStyleAnchorFromHistory({
        roleId: currentRoleId,
        maxSamples: 6,
        maxLength: 18
    });

    const systemPrompt = buildRoleplaySystemPrompt(
        role,
        new Date().toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' }),
        new Date().toLocaleString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false }),
        crossModeMemory.memoryText,
        styleAnchorText
    );

    
    const loadingMsg = document.createElement('div');
    loadingMsg.className = 'msg-bubble-ai system';
    loadingMsg.textContent = '输入中...';
    loadingMsg.id = 'loadingMsg';
    chatBox.appendChild(loadingMsg);
    chatBox.scrollTop = chatBox.scrollHeight;
    
    try {
        const { data, downgradedFromVision, visionFallbackReason } = await requestChatCompletionWithFallback({
            systemPrompt,
            history: chatHistory.slice(-10),
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

        if (isOfflineMode) {
            reply = formatOfflineNarrativeText(reply, role.nickname);
        } else {
            reply = enforceOnlineSpeechOnly(reply);
        }
        
        // 检测并重试
        if (/AI|人工智能|助手|程序|模型/i.test(reply)) {
            console.warn('检测到AI身份暴露，触发重试...');
            return await retryAICall(userText, role, chatBox, systemPrompt);
        }
        
        const aiMsg = document.createElement('div');
        aiMsg.className = 'msg-bubble-ai';
        const aiAvatar = document.createElement('div');
        aiAvatar.className = 'msg-avatar';
        if (role && role.avatar) {
            if (role.avatar.includes('url(')) {
                aiAvatar.style.background = `${role.avatar}`;
                aiAvatar.style.backgroundSize = 'cover';
                aiAvatar.style.backgroundPosition = 'center';
                aiAvatar.textContent = '';
            } else if (role.avatar !== 'white') {
                aiAvatar.style.background = role.avatar;
                aiAvatar.textContent = '';
            } else {
                aiAvatar.style.background = 'white';
                aiAvatar.style.border = '1px solid #eee';
                aiAvatar.style.color = '#999';
                aiAvatar.style.fontSize = '24px';
                aiAvatar.style.display = 'flex';
                aiAvatar.style.alignItems = 'center';
                aiAvatar.style.justifyContent = 'center';
                aiAvatar.textContent = role.nickname.charAt(0);
            }
        }
        const bubbleDiv = document.createElement('div');
        bubbleDiv.className = 'msg-text';
        bubbleDiv.textContent = reply;
        const timeDiv = document.createElement('div');
        timeDiv.className = 'msg-time';
        timeDiv.textContent = new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
        aiMsg.appendChild(aiAvatar);
        aiMsg.appendChild(bubbleDiv);
        aiMsg.appendChild(timeDiv);
        chatBox.appendChild(aiMsg);
        chatBox.scrollTop = chatBox.scrollHeight;
        
        const messageTimestamp = Date.now();
        chatHistory.push({role: 'assistant', content: reply, timestamp: messageTimestamp});
        saveChatHistory();
        addSharedEvent({
            sourceMode: getCurrentChatMode(),
            speakerRole: 'assistant',
            content: reply,
            timestamp: messageTimestamp
        });

        try {
            await maybeSendRoleVoiceReply(role, reply);
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
    setSpeechModelStatus(
        apiSettings.minimaxGroupId && apiSettings.minimaxApiKey
            ? '可点击“拉取模型”刷新 Speech 可选列表'
            : '请先填写 Minimax Group ID 和 API Key 后拉取 Speech 模型列表'
    );

    document.getElementById('apiModal').classList.add('active');
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
        minimaxApiUrl: normalizeMinimaxApiUrl(apiSettings.minimaxApiUrl || CONFIG.DEFAULT_MINIMAX_API_URL),
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

function setWallpaper(wallpaper) {
    const container = document.querySelector('.ios-container');
    if (!container) return;

    const applyWallpaperValue = (value) => {
        container.style.setProperty('--ios-bg', value);
        container.style.backgroundImage = value;
        container.style.background = value;
    };

    let savedValue = wallpaper;
    let savedType = 'color';

    if (wallpaper.startsWith('http')) {
        const value = `url('${wallpaper}')`;
        applyWallpaperValue(value);
        savedValue = value;
        savedType = 'url';
    } else if (wallpaper === 'dark') {
        applyWallpaperValue('#000');
        savedValue = '#000';
        savedType = 'color';
    } else {
        const gradients = {
            'gradient1': 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            'gradient2': 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
            'gradient3': 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)'
        };
        const value = gradients[wallpaper] || gradients.gradient1;
        applyWallpaperValue(value);
        savedValue = value;
        savedType = 'gradient';
    }

    localStorage.setItem('wallpaper', savedValue);
    localStorage.setItem('wallpaperType', savedType);
    
    closeModal('wallpaperModal');
}

// 加载保存的壁纸
(function loadWallpaper() {
    const saved = localStorage.getItem('wallpaper');
    const type = localStorage.getItem('wallpaperType');
    const container = document.querySelector('.ios-container');

    if (!saved || !container) return;

    const applyWallpaperValue = (value) => {
        container.style.setProperty('--ios-bg', value);
        container.style.backgroundImage = value;
        container.style.background = value;
    };

    if (type === 'url' || type === 'image') {
        const cleanedWallpaper = String(saved)
            .replace(/\s+center\/cover\s*$/i, '')
            .trim();
        applyWallpaperValue(/^url\(/i.test(cleanedWallpaper) ? cleanedWallpaper : `url('${cleanedWallpaper}')`);
    } else {
        applyWallpaperValue(saved);
    }
})();

// ================= 通用函数 =================
function closeModal(modalId) {
    document.getElementById(modalId).classList.remove('active');
}

function updateClock() {
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const timeString = `${hours}:${minutes}`;
    
    // 更新状态栏时间
    const statusTime = document.getElementById('statusTime');
    if (statusTime) statusTime.textContent = timeString;
    
    // 更新小组件时间（如果有的话）
    const widgetTime = document.getElementById('clock');
    if (widgetTime) widgetTime.textContent = timeString;
    
    // 同步所有应用界面的状态栏时间
    const appStatusTimes = document.querySelectorAll('.app-status-time');
    appStatusTimes.forEach(el => {
        el.textContent = timeString;
    });
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
function newMessage() {
    const num = prompt('输入号码:');
    if (num) {
        alert(`将创建与 ${num} 的对话`);
    }
}

// ================= 备忘录功能 =================
let notes = [];

function loadNotes() {
    const saved = localStorage.getItem('notes');
    if (saved) {
        notes = JSON.parse(saved);
        renderNotes();
    }
}

function createNote() {
    const title = prompt('标题:');
    if (!title) return;
    
    const note = {
        id: Date.now(),
        title: title,
        content: '',
        date: new Date().toLocaleDateString('zh-CN')
    };
    
    notes.unshift(note);
    saveNotes();
    renderNotes();
    editNote(0);
}

function renderNotes() {
    const container = document.getElementById('notesContainer');
    if (!container || notes.length === 0) return;
    
    container.innerHTML = notes.map((note, index) => `
        <div class="note-card" onclick="editNote(${index})">
            <div class="note-title">${note.title}</div>
            <div class="note-date">${note.date}</div>
            <div class="note-snippet">${note.content.substring(0, 50) || '无内容'}...</div>
        </div>
    `).join('');
}

function editNote(index) {
    const note = notes[index];
    const newContent = prompt(`${note.title}\n\n编辑内容:`, note.content);
    if (newContent !== null) {
        note.content = newContent;
        note.date = new Date().toLocaleDateString('zh-CN');
        saveNotes();
        renderNotes();
    }
}

function saveNotes() {
    localStorage.setItem('notes', JSON.stringify(notes));
}

// ================= 音乐控制 =================
let isPlaying = false;

function toggleMusic() {
    isPlaying = !isPlaying;
    document.getElementById('playBtn').textContent = isPlaying ? '⏸' : '▶';
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

// ================= 聊天记录导入/导出 =================
function exportData() {
    try {
        window.DataManager.exportChatData();
    } catch (e) {
        console.error('导出聊天记录失败:', e);
        alert('导出聊天记录失败：' + (e?.message || e));
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

            await window.DataManager.importChatData(data);
        } catch (err) {
            console.error('导入聊天记录失败:', err);
            alert(`聊天记录文件导入失败: ${err?.message || '文件格式错误'}`);
        } finally {
            resetInput();
        }
    };

    reader.onerror = () => {
        resetInput();
        alert('聊天记录文件读取失败');
    };

    reader.readAsText(file, 'utf-8');
}

function resetWallpaperCache() {
    localStorage.removeItem('wallpaper');
    localStorage.removeItem('wallpaperType');

    const container = document.querySelector('.ios-container');
    if (container) {
        container.style.removeProperty('--ios-bg');
    }
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

function stripImageMessagesFromHistory(history) {
    if (!Array.isArray(history)) return history;

    return history.map((message) => {
        if (message && typeof message === 'object' && message.content && typeof message.content === 'object') {
            if (message.content.type === 'image') {
                return {
                    ...message,
                    content: `[图片缓存已清理${message.content.name ? `：${message.content.name}` : ''}]`
                };
            }
        }

        return message;
    });
}

function clearStoredMediaReferences() {
    for (let index = 0; index < localStorage.length; index += 1) {
        const key = localStorage.key(index);
        if (!key) continue;

        if (key === 'chatHistory' || key.startsWith('roleChat_')) {
            const history = safeReadStorageJSON(key, null);
            if (Array.isArray(history)) {
                safeWriteStorageJSON(key, stripImageMessagesFromHistory(history));
            }
        }
    }

    if (Array.isArray(chatHistory) && chatHistory.length > 0) {
        chatHistory = stripImageMessagesFromHistory(chatHistory);
    }

    // 按用户要求：仅清理聊天图片，不清理朋友圈动态图片
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
    resetStickerLibraryCache();
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
    // 1. 清除会话级图片缓存
    clearChatImageSessionCache();

    // 2. 清除 localStorage 中聊天记录里的图片引用
    clearStoredMediaReferences();

    // 3. 删除 IndexedDB 中的聊天图片媒体库
    try {
        await deleteChatMediaDatabase();
    } catch (error) {
        console.error('清理聊天图片媒体库失败:', error);
    }
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

function clearSpecificCache(type) {
    const cacheMap = {
        stickers: {
            label: '表情包缓存',
            action: () => resetStickerLibraryCache()
        },
        chatImages: {
            label: '聊天图片缓存',
            action: () => clearChatImages()
        }
    };

    const target = cacheMap[type];
    if (!target) return;

    target.action();
    refreshCacheManagementUI();
    showCacheToast(`${target.label}已清理`);
}

async function clearSelectedCaches() {
    if (!confirm('确定要一键清理所有缓存吗？\n\n将清空本地所有缓存数据，包括聊天记录、图片、表情包、墙纸、封面、设置及其他本地存储内容。')) {
        return;
    }

    try {
        clearGomokuTurnTimer();
        closeChatMediaPanel();
        resetChatSelectionState();

        localStorage.clear();
        sessionStorage.clear();

        try {
            await deleteChatMediaDatabase();
        } catch (error) {
            console.error('清理媒体缓存数据库失败:', error);
        }

        alert('所有缓存已清理，即将刷新');
        location.reload();
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
    displayMode: 'phone',  // 'fullscreen' 或 'phone'
    screenSize: 'medium',  // 'small', 'medium', 'large'
    showStatusBar: true
};

function showAppearanceSettings() {
    // 加载当前设置
    const saved = localStorage.getItem('appearanceSettings');
    if (saved) {
        appearanceSettings = JSON.parse(saved);
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
    if (appearanceSettings.showStatusBar) {
        toggle.classList.remove('inactive');
    } else {
        toggle.classList.add('inactive');
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
    
    applyAppearanceSettings();
    updateAppearanceUI();
    
    // 显示提示
    if (window.DataManager) {
        const modeText = recommendedMode === 'fullscreen' ? '全屏' : '手机';
        const sizeText = recommendedSize === 'small' ? '小屏' : recommendedSize === 'large' ? '大屏' : '中等';
        DataManager.showToast(`已适配为${modeText}(${sizeText})模式`);
    }
}

// 快速全屏切换
function toggleFullscreenQuick() {
    if (appearanceSettings.displayMode === 'fullscreen') {
        appearanceSettings.displayMode = 'phone';
        appearanceSettings.screenSize = 'medium';
    } else {
        appearanceSettings.displayMode = 'fullscreen';
    }
    
    applyAppearanceSettings();
    updateAppearanceUI();
}

function setDisplayMode(mode) {
    appearanceSettings.displayMode = mode;
    applyAppearanceSettings();
    updateAppearanceUI();
}

function setScreenSize(size) {
    appearanceSettings.screenSize = size;
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
        appearanceSettings = JSON.parse(saved);
    }
    applyAppearanceSettings();  // 立即应用
    updateAppearanceUI();
}

function applyAppearanceSettings() {
    const container = document.getElementById('homeScreen');
    const statusBar = document.getElementById('globalStatusBar');
    
    // 清除所有模式类
    container.classList.remove(
        'fullscreen-mode',
        'phone-mode-small',
        'phone-mode-medium',
        'phone-mode-large',
        'hide-status-bar'
    );
    
    // 应用模式
    if (appearanceSettings.displayMode === 'fullscreen') {
        container.classList.add('fullscreen-mode');
        document.body.style.background = '#000';  // 全屏时黑背景
        
        // 全屏模式下状态栏宽度100%
        if (statusBar) {
            statusBar.style.width = '100%';
            statusBar.style.left = '0';
            statusBar.style.transform = 'none';
            statusBar.style.top = '0';
            statusBar.style.marginTop = '0';
        }
    } else {
        container.classList.add(`phone-mode-${appearanceSettings.screenSize}`);
        document.body.style.background = '#e5e5e5';  // 手机模式时浅灰背景
        
        // 确保手机模式下容器居中显示
        document.body.style.display = 'flex';
        document.body.style.justifyContent = 'center';
        document.body.style.alignItems = 'center';
        document.body.style.height = '100vh';
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
    if (!appearanceSettings.showStatusBar) {
        container.classList.add('hide-status-bar');
    }
    
    // 更新摘要文字
    const summary = document.getElementById('appearanceSummary');
    if (summary) {
        summary.textContent = appearanceSettings.displayMode === 'fullscreen' ? '全屏' : '手机';
    }
    
    localStorage.setItem('appearanceSettings', JSON.stringify(appearanceSettings));
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
            <div style="flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; color: #999;">
                <div style="font-size: 48px; margin-bottom: 10px;">💬</div>
                <div>还没有聊天对象</div>
                <div style="font-size: 12px; margin-top: 5px;">点击右上角 + 创建</div>
            </div>
        `;
        return;
    }
    
    chatList.innerHTML = wechatRoles.map(role => {
        // 获取该角色的最后一条消息
        const currentModeKey = getChatStorageKey(role.id, getCurrentChatMode());
        const roleChat = safeReadStorageJSON(currentModeKey, []);
        let lastMsg = roleChat.length > 0 ? roleChat[roleChat.length - 1].content : '';

        if (typeof lastMsg === 'object' && lastMsg !== null) {
            if (lastMsg.type === 'image') {
                lastMsg = '[图片]';
            } else if (lastMsg.type === 'sticker') {
                lastMsg = `[表情包] ${lastMsg.label || ''}`.trim();
            } else if (lastMsg.type === 'voice') {
                lastMsg = `[语音] ${lastMsg.text || ''}`.trim();
            } else {
                lastMsg = '[消息]';
            }
        }

        if (!lastMsg) {
            lastMsg = '点击开始对话...';
        }

        // 关键：对预览内容也进行脱敏
        lastMsg = sanitizeAIResponse(lastMsg, role.nickname);
        const preview = lastMsg.substring(0, 30) + (lastMsg.length > 30 ? '...' : '');
        
        const avatarBaseStyle = 'width: 50px; height: 50px; border-radius: 10px; overflow: hidden; display: flex; align-items: center; justify-content: center; font-size: 24px; font-weight: 700; line-height: 1; text-align: center; box-shadow: 0 1px 3px rgba(0,0,0,0.05);';
        const avatarConfig = getAvatarRenderConfig(role.avatar, role.nickname);
        const avatarStyle = `${avatarBaseStyle} ${avatarConfig.avatarStyle}`;
        
        return `
            <div class="chat-item" onclick="selectAndEnterChat(${role.id})">
                <div class="avatar" style="${avatarStyle}">${avatarConfig.avatarContent}</div>
                <div class="chat-info">
                    <div class="chat-name">${role.nickname}</div>
                    <div class="chat-preview">${preview}</div>
                </div>
            </div>
        `;
    }).join('');
}

function selectAndEnterChat(roleId) {
    currentRoleId = roleId;
    
    // 加载该角色的聊天历史
    loadChatHistory();
    
    enterChat();
    
    // 更新聊天窗口标题
    const role = wechatRoles.find(r => r.id === roleId);
    if (role) {
        document.querySelector('#app-chat .nav-title').textContent = role.nickname;
    }

    syncOfflineModeUI();
    
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
    menuContent.style.cssText = 'background: white; border-radius: 8px; margin: 50px 10px 0 0; min-width: 120px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);';
    
    menuContent.innerHTML = `
        <div style="padding: 10px 0; border-bottom: 1px solid #eee;">
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

function editChatRole() {
    editingRoleId = currentRoleId;
    const role = wechatRoles.find(r => r.id === currentRoleId);
    
    if (role) {
        document.getElementById('editRoleModal').classList.add('active');
        
        setTimeout(() => {
            const editAvatarEl = document.getElementById('editAvatarPreview');
            if (role.avatar) {
                if (role.avatar.includes('url(')) {
                    editAvatarEl.style.background = `${role.avatar}`;
                    editAvatarEl.style.backgroundSize = 'cover';
                    editAvatarEl.style.backgroundPosition = 'center';
                    editAvatarEl.textContent = '';
                } else if (role.avatar !== 'white') {
                    editAvatarEl.style.background = role.avatar;
                    editAvatarEl.textContent = '';
                } else {
                    editAvatarEl.style.background = 'white';
                    editAvatarEl.style.border = '1px solid #eee';
                    editAvatarEl.style.color = '#999';
                    editAvatarEl.style.fontSize = '48px';
                    editAvatarEl.style.display = 'flex';
                    editAvatarEl.style.alignItems = 'center';
                    editAvatarEl.style.justifyContent = 'center';
                    editAvatarEl.textContent = role.nickname.charAt(0);
                }
            }
            document.getElementById('editNickname').value = role.nickname || '';
            document.getElementById('editRealName').value = role.realName || '';
            document.getElementById('editSystemPrompt').value = role.systemPrompt || '';

            const editVoiceEnabled = document.getElementById('editVoiceEnabled');
            const editVoiceId = document.getElementById('editVoiceId');
            const editVoiceReplyProbability = document.getElementById('editVoiceReplyProbability');
            const editVoiceReplyProbabilityValue = document.getElementById('editVoiceReplyProbabilityValue');

            if (editVoiceEnabled) editVoiceEnabled.checked = !!role.voiceEnabled;
            if (editVoiceId) editVoiceId.value = role.voiceId || '';
            if (editVoiceReplyProbability) {
                const probability = getRoleVoiceReplyProbability(role);
                editVoiceReplyProbability.value = probability;
                if (editVoiceReplyProbabilityValue) {
                    editVoiceReplyProbabilityValue.textContent = `${Math.round(probability * 100)}%`;
                }
            }
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
    menuContent.style.cssText = 'background: white; border-radius: 8px; margin: 100px 10px 0 0; min-width: 120px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);';
    
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
            if (role.avatar) {
                if (role.avatar.includes('url(')) {
                    editAvatarEl.style.background = `${role.avatar}`;
                    editAvatarEl.style.backgroundSize = 'cover';
                    editAvatarEl.style.backgroundPosition = 'center';
                    editAvatarEl.textContent = '';
                } else if (role.avatar !== 'white') {
                    editAvatarEl.style.background = role.avatar;
                    editAvatarEl.textContent = '';
                } else {
                    editAvatarEl.style.background = 'white';
                    editAvatarEl.style.border = '1px solid #eee';
                    editAvatarEl.style.color = '#999';
                    editAvatarEl.style.fontSize = '48px';
                    editAvatarEl.style.display = 'flex';
                    editAvatarEl.style.alignItems = 'center';
                    editAvatarEl.style.justifyContent = 'center';
                    editAvatarEl.textContent = role.nickname.charAt(0);
                }
            }
            document.getElementById('editNickname').value = role.nickname || '';
            document.getElementById('editRealName').value = role.realName || '';
            document.getElementById('editSystemPrompt').value = role.systemPrompt || '';

            const editVoiceEnabled = document.getElementById('editVoiceEnabled');
            const editVoiceId = document.getElementById('editVoiceId');
            const editVoiceReplyProbability = document.getElementById('editVoiceReplyProbability');
            const editVoiceReplyProbabilityValue = document.getElementById('editVoiceReplyProbabilityValue');

            if (editVoiceEnabled) editVoiceEnabled.checked = !!role.voiceEnabled;
            if (editVoiceId) editVoiceId.value = role.voiceId || '';
            if (editVoiceReplyProbability) {
                const probability = getRoleVoiceReplyProbability(role);
                editVoiceReplyProbability.value = probability;
                if (editVoiceReplyProbabilityValue) {
                    editVoiceReplyProbabilityValue.textContent = `${Math.round(probability * 100)}%`;
                }
            }
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
            <div class="worldbook-item-icon">📖</div>
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
    document.getElementById('roleAvatarPreview').style.background = 'white';
    document.getElementById('roleAvatarPreview').style.color = '#999';
    document.getElementById('roleAvatarPreview').style.border = '1px solid #eee';
    document.getElementById('roleAvatarPreview').style.display = 'flex';
    document.getElementById('roleAvatarPreview').style.alignItems = 'center';
    document.getElementById('roleAvatarPreview').style.justifyContent = 'center';
    document.getElementById('roleAvatarPreview').style.fontSize = '48px';
    document.getElementById('roleAvatarPreview').textContent = '?';
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

    selectedAvatarColor = 'white';
    document.getElementById('createRoleModal').classList.add('active');
}

function showAvatarColorPicker() {
    document.getElementById('colorPickerModal').classList.add('active');
}

function selectAvatarColor(color) {
    selectedAvatarColor = color;
    document.getElementById('roleAvatarPreview').style.background = color;
    closeModal('colorPickerModal');
}

function createNewRole() {
    const nickname = document.getElementById('roleNickname').value.trim();
    const realName = document.getElementById('roleRealName').value.trim();
    const systemPrompt = document.getElementById('roleSystemPrompt').value.trim();
    const voiceEnabled = !!document.getElementById('roleVoiceEnabled')?.checked;
    const voiceId = document.getElementById('roleVoiceId')?.value.trim() || '';
    const voiceReplyProbability = parseFloat(document.getElementById('roleVoiceReplyProbability')?.value);
    
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
        voiceEnabled: voiceEnabled,
        voiceId: voiceId,
        voiceReplyProbability: Number.isFinite(voiceReplyProbability) ? voiceReplyProbability : 0.2
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
        description: '朋友'
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
            let avatarValue = editAvatarEl.style.backgroundImage || editAvatarEl.style.background || 'white';
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
            selectedAvatarColor = `url('${imageData}')`;
        } else if (type === 'edit') {
            const el = document.getElementById('editAvatarPreview');
            el.style.background = `url('${imageData}') center/cover no-repeat`;
            el.style.backgroundSize = 'cover';
            el.style.backgroundPosition = 'center';
            el.textContent = '';
            // 保存图片数据到element的dataset，供saveRoleChanges读取
            el.dataset.imageUrl = imageData;
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
            const container = document.querySelector('.ios-container');
            if (!container) {
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
            container.style.setProperty('--ios-bg', wallpaperValue);
            container.style.backgroundImage = wallpaperValue;
            container.style.background = wallpaperValue;

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
