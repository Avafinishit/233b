const http = require('http');
const https = require('https');
const crypto = require('crypto');

const TOUBIEC_REFERER = 'https://wyapi.toubiec.cn/';
const TOUBIEC_API_ORIGINS = [
    process.env.TOUBIEC_API_ORIGIN,
    'https://nextmusic.toubiec.cn'
]
    .map(origin => String(origin || '').replace(/\/+$/, ''))
    .filter((origin, index, origins) => origin && origins.indexOf(origin) === index);
const TOUBIEC_DEFAULT_LEVEL = 'standard';
const DEFAULT_AUDIO_RANGE = 'bytes=0-1048575';
const TOUBIEC_INFO_TIMEOUT_MS = 2500;
const TOUBIEC_REQUEST_ATTEMPTS = 3;
const TOUBIEC_RESOLVE_CACHE_TTL_MS = 2 * 60 * 1000;
const toubiecResolveCache = new Map();

function corsHeaders(extra = {}) {
    return {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, Range',
        'Access-Control-Expose-Headers': 'Content-Length, Content-Range, Accept-Ranges',
        ...extra
    };
}

function jsonResponse(statusCode, payload, extraHeaders = {}) {
    return {
        statusCode,
        headers: corsHeaders({
            'Content-Type': 'application/json; charset=utf-8',
            ...extraHeaders
        }),
        body: JSON.stringify(payload)
    };
}

function binaryResponse(statusCode, buffer, headers = {}) {
    return {
        statusCode,
        headers: corsHeaders(headers),
        body: buffer,
        isBinary: true
    };
}

function getHeader(headers = {}, name = '') {
    const target = String(name || '').toLowerCase();
    for (const [key, value] of Object.entries(headers || {})) {
        if (String(key).toLowerCase() === target) {
            return Array.isArray(value) ? value[0] : value;
        }
    }
    return '';
}

function requestJsonFromUrl(targetUrl, headers = {}) {
    return new Promise((resolve, reject) => {
        const requestModule = targetUrl.protocol === 'http:' ? http : https;
        const upstreamReq = requestModule.request({
            protocol: targetUrl.protocol,
            hostname: targetUrl.hostname,
            port: targetUrl.port || (targetUrl.protocol === 'http:' ? 80 : 443),
            path: `${targetUrl.pathname}${targetUrl.search}`,
            method: 'GET',
            headers: {
                'User-Agent': 'Mozilla/5.0',
                'Accept': 'application/json,text/plain,*/*',
                ...headers
            },
            timeout: 15000
        }, (upstreamRes) => {
            let body = '';
            upstreamRes.setEncoding('utf8');
            upstreamRes.on('data', chunk => { body += chunk; });
            upstreamRes.on('end', () => {
                if ((upstreamRes.statusCode || 500) >= 400) {
                    reject(new Error(`上游请求失败（HTTP ${upstreamRes.statusCode}）`));
                    return;
                }

                try {
                    resolve(JSON.parse(body));
                } catch (error) {
                    reject(new Error('上游返回了无法解析的 JSON'));
                }
            });
        });

        upstreamReq.on('timeout', () => upstreamReq.destroy(new Error('请求超时')));
        upstreamReq.on('error', reject);
        upstreamReq.end();
    });
}

function requestJsonPostToUrl(targetUrl, payload = {}, headers = {}, options = {}) {
    return new Promise((resolve, reject) => {
        const requestModule = targetUrl.protocol === 'http:' ? http : https;
        const body = JSON.stringify(payload || {});
        const timeout = Math.max(1000, Number(options.timeout) || 15000);
        const upstreamReq = requestModule.request({
            protocol: targetUrl.protocol,
            hostname: targetUrl.hostname,
            port: targetUrl.port || (targetUrl.protocol === 'http:' ? 80 : 443),
            path: `${targetUrl.pathname}${targetUrl.search}`,
            method: 'POST',
            headers: {
                'User-Agent': 'Mozilla/5.0',
                'Accept': 'application/json,text/plain,*/*',
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(body),
                ...headers
            },
            timeout
        }, (upstreamRes) => {
            let responseBody = '';
            upstreamRes.setEncoding('utf8');
            upstreamRes.on('data', chunk => { responseBody += chunk; });
            upstreamRes.on('end', () => {
                if ((upstreamRes.statusCode || 500) >= 400) {
                    reject(new Error(`Upstream request failed (HTTP ${upstreamRes.statusCode})`));
                    return;
                }

                try {
                    resolve(JSON.parse(responseBody));
                } catch (error) {
                    reject(new Error('Upstream returned invalid JSON'));
                }
            });
        });

        upstreamReq.on('timeout', () => upstreamReq.destroy(new Error('Request timed out')));
        upstreamReq.on('error', reject);
        upstreamReq.write(body);
        upstreamReq.end();
    });
}

function requestTextFromUrl(targetUrl, headers = {}, redirectCount = 0) {
    return new Promise((resolve, reject) => {
        const requestModule = targetUrl.protocol === 'http:' ? http : https;
        const upstreamReq = requestModule.request({
            protocol: targetUrl.protocol,
            hostname: targetUrl.hostname,
            port: targetUrl.port || (targetUrl.protocol === 'http:' ? 80 : 443),
            path: `${targetUrl.pathname}${targetUrl.search}`,
            method: 'GET',
            headers: {
                'User-Agent': 'Mozilla/5.0',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                ...headers
            },
            timeout: 15000
        }, (upstreamRes) => {
            const statusCode = upstreamRes.statusCode || 500;
            const location = upstreamRes.headers.location;
            if ([301, 302, 303, 307, 308].includes(statusCode) && location && redirectCount < 6) {
                upstreamRes.resume();
                requestTextFromUrl(new URL(location, targetUrl), headers, redirectCount + 1)
                    .then(resolve)
                    .catch(reject);
                return;
            }

            let body = '';
            const maxBodyLength = 512 * 1024;
            upstreamRes.setEncoding('utf8');
            upstreamRes.on('data', chunk => {
                if (body.length >= maxBodyLength) return;
                body += String(chunk).slice(0, maxBodyLength - body.length);
            });
            upstreamRes.on('end', () => {
                if (statusCode >= 400) {
                    reject(new Error(`上游请求失败（HTTP ${statusCode}）`));
                    return;
                }

                resolve({
                    finalUrl: targetUrl.toString(),
                    statusCode,
                    headers: upstreamRes.headers,
                    body
                });
            });
        });

        upstreamReq.on('timeout', () => upstreamReq.destroy(new Error('请求超时')));
        upstreamReq.on('error', reject);
        upstreamReq.end();
    });
}

function requestBinaryFromUrl(targetUrl, headers = {}, redirectCount = 0) {
    return new Promise((resolve, reject) => {
        const requestModule = targetUrl.protocol === 'http:' ? http : https;
        const upstreamReq = requestModule.request({
            protocol: targetUrl.protocol,
            hostname: targetUrl.hostname,
            port: targetUrl.port || (targetUrl.protocol === 'http:' ? 80 : 443),
            path: `${targetUrl.pathname}${targetUrl.search}`,
            method: 'GET',
            headers,
            timeout: 30000
        }, (upstreamRes) => {
            const statusCode = upstreamRes.statusCode || 500;
            const location = upstreamRes.headers.location;
            if ([301, 302, 303, 307, 308].includes(statusCode) && location && redirectCount < 5) {
                upstreamRes.resume();
                requestBinaryFromUrl(new URL(location, targetUrl), headers, redirectCount + 1)
                    .then(resolve)
                    .catch(reject);
                return;
            }

            const chunks = [];
            upstreamRes.on('data', chunk => chunks.push(chunk));
            upstreamRes.on('end', () => {
                resolve({
                    statusCode,
                    headers: upstreamRes.headers,
                    buffer: Buffer.concat(chunks)
                });
            });
        });

        upstreamReq.on('timeout', () => upstreamReq.destroy(new Error('代理请求超时')));
        upstreamReq.on('error', reject);
        upstreamReq.end();
    });
}

function cleanMusicShareUrl(value = '') {
    return String(value || '')
        .trim()
        .replace(/&amp;/gi, '&')
        .replace(/[)\]}>）】』」》。，、；;!！?？]+$/g, '');
}

function extractHttpUrlsFromText(value = '') {
    const matches = String(value || '').match(/https?:\/\/[^\s"'<>()\[\]{}（）]+/gi) || [];
    return [...new Set(matches.map(cleanMusicShareUrl).filter(Boolean))];
}

function isMusic163PageHost(hostname = '') {
    const host = String(hostname || '').toLowerCase();
    return host === 'music.163.com' || host.endsWith('.music.163.com');
}

function isAllowedMusic163ShareHost(hostname = '') {
    const host = String(hostname || '').toLowerCase();
    return isMusic163PageHost(host) || host === '163cn.tv' || host.endsWith('.163cn.tv');
}

function getMusic163UrlInfo(value = '') {
    let parsed;
    try {
        parsed = new URL(cleanMusicShareUrl(value));
    } catch (error) {
        return null;
    }

    if (!isMusic163PageHost(parsed.hostname)) return null;

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
}

function hasMusic163PathType(pathname = '', type = 'song') {
    return String(pathname || '').split('/').filter(Boolean).includes(type);
}

function extractMusic163IdByTypeFromUrl(value = '', type = 'song') {
    const info = getMusic163UrlInfo(value);
    if (!info) return '';

    const pathnameMatches = hasMusic163PathType(info.pathname, type);
    const hashMatches = hasMusic163PathType(info.hashPath, type);
    if (!pathnameMatches && !hashMatches) return '';

    const id = info.searchParams.get('id') || info.hashParams.get('id') || '';
    return /^\d+$/.test(id) ? id : '';
}

function extractMusic163TargetFromUrl(value = '') {
    const playlistId = extractMusic163IdByTypeFromUrl(value, 'playlist');
    if (playlistId) return { type: 'playlist', id: playlistId, pageUrl: cleanMusicShareUrl(value) };

    const songId = extractMusic163IdByTypeFromUrl(value, 'song');
    if (songId) return { type: 'song', id: songId, pageUrl: cleanMusicShareUrl(value) };

    return null;
}

function extractMusic163TargetFromText(value = '') {
    const text = String(value || '').replace(/&amp;/gi, '&');

    for (const url of extractHttpUrlsFromText(text)) {
        const target = extractMusic163TargetFromUrl(url);
        if (target) return target;
    }

    const playlistMatch = text.match(/(?:#\/?|\/)?playlist\?[^"'<>\\\s]*\bid=(\d+)/i);
    if (playlistMatch) return { type: 'playlist', id: playlistMatch[1], pageUrl: '' };

    const songMatch = text.match(/(?:#\/?|\/)?song\?[^"'<>\\\s]*\bid=(\d+)/i);
    if (songMatch) return { type: 'song', id: songMatch[1], pageUrl: '' };

    return null;
}

function extractLooseMusic163Target(value = '') {
    const text = String(value || '').replace(/&amp;/gi, '&');
    const playlistMatch = text.match(/playlist[\s\S]*?[?&]id=(\d+)/i);
    if (playlistMatch) return { type: 'playlist', id: playlistMatch[1], pageUrl: cleanMusicShareUrl(value) };

    const songMatch = text.match(/song[\s\S]*?[?&]id=(\d+)/i);
    if (songMatch) return { type: 'song', id: songMatch[1], pageUrl: cleanMusicShareUrl(value) };

    return null;
}

async function resolveMusic163ShareTarget(rawValue) {
    const rawText = String(rawValue || '').trim();
    const looseTarget = extractLooseMusic163Target(rawText);
    if (looseTarget) return looseTarget;

    const candidateUrls = extractHttpUrlsFromText(rawText);
    const candidates = candidateUrls.length ? candidateUrls : [cleanMusicShareUrl(rawText)];
    let lastError = null;

    for (const candidate of candidates) {
        let parsed;
        try {
            parsed = new URL(candidate);
        } catch (error) {
            continue;
        }

        if (!isAllowedMusic163ShareHost(parsed.hostname)) continue;

        const directTarget = extractMusic163TargetFromUrl(candidate);
        if (directTarget) return directTarget;

        try {
            const expanded = await requestTextFromUrl(parsed, {
                'Referer': 'https://music.163.com/'
            });
            const finalTarget = extractMusic163TargetFromUrl(expanded.finalUrl);
            if (finalTarget) return finalTarget;

            const bodyTarget = extractMusic163TargetFromText(expanded.body);
            if (bodyTarget) {
                return {
                    ...bodyTarget,
                    pageUrl: bodyTarget.pageUrl || expanded.finalUrl || candidate
                };
            }
        } catch (error) {
            lastError = error;
        }
    }

    if (lastError) throw lastError;
    return null;
}

async function resolveMusic163AudioUrls(songIds) {
    const audioUrlById = new Map();
    const normalizedIds = [...new Set(songIds.map(id => String(id || '').trim()).filter(id => /^\d+$/.test(id)))];
    const chunkSize = 50;

    for (let index = 0; index < normalizedIds.length; index += chunkSize) {
        const chunk = normalizedIds.slice(index, index + chunkSize);
        const idsParam = encodeURIComponent(JSON.stringify(chunk.map(id => Number(id))));
        const apiUrl = new URL(`https://music.163.com/api/song/enhance/player/url?id=${encodeURIComponent(chunk[0])}&ids=${idsParam}&br=320000`);
        const data = await requestJsonFromUrl(apiUrl, {
            'Referer': 'https://music.163.com/'
        });

        (Array.isArray(data?.data) ? data.data : []).forEach(item => {
            const id = String(item?.id || '').trim();
            const url = String(item?.url || '').trim();
            if (/^\d+$/.test(id) && url) {
                audioUrlById.set(id, url);
            }
        });
    }

    return audioUrlById;
}

async function requestMusic163SongDetails(songIds) {
    const detailById = new Map();
    const normalizedIds = [...new Set(songIds.map(id => String(id || '').trim()).filter(id => /^\d+$/.test(id)))];
    const chunkSize = 200;

    for (let index = 0; index < normalizedIds.length; index += chunkSize) {
        const chunk = normalizedIds.slice(index, index + chunkSize);
        const idsParam = encodeURIComponent(JSON.stringify(chunk.map(id => Number(id))));
        const apiUrl = new URL(`https://music.163.com/api/song/detail?ids=${idsParam}`);
        const data = await requestJsonFromUrl(apiUrl, {
            'Referer': 'https://music.163.com/'
        });

        (Array.isArray(data?.songs) ? data.songs : []).forEach(song => {
            const id = String(song?.id || '').trim();
            if (/^\d+$/.test(id)) detailById.set(id, song);
        });
    }

    return detailById;
}

function getMusic163ArtistText(track) {
    const artists = Array.isArray(track?.artists)
        ? track.artists
        : (Array.isArray(track?.ar) ? track.ar : []);
    const names = artists.map(artist => String(artist?.name || '').trim()).filter(Boolean);
    return names.join(' / ') || String(track?.artistsname || '').trim() || '链接导入';
}

function normalizeMusic163PlaylistSong(track, audioUrl, options = {}) {
    const id = String(track?.id || '').trim();
    const title = String(track?.name || '').trim();
    if (!/^\d+$/.test(id) || !title) return null;
    const allowMetadataOnly = Boolean(options.allowMetadataOnly);
    if (!audioUrl && !allowMetadataOnly) return null;

    const album = track.album || track.al || {};
    const durationMs = Number(track.duration || track.dt || 0);
    const picId = String(album.picId || track.album?.picId || '').trim();
    const fallbackCover = picId && /^\d+$/.test(picId)
        ? `https://p2.music.126.net/${picId}.jpg`
        : '';

    return {
        id,
        music163Id: id,
        title,
        artist: getMusic163ArtistText(track),
        duration: durationMs > 0 ? Math.round(durationMs / 1000) : 0,
        url: audioUrl || '',
        proxyUrl: audioUrl ? `/api/music-audio-proxy?url=${encodeURIComponent(audioUrl)}` : '',
        cover: String(track.picurl || album.picUrl || album.img1v1Url || fallbackCover || '').trim(),
        pageUrl: `https://music.163.com/song?id=${encodeURIComponent(id)}`,
        playable: Boolean(audioUrl),
        parser: options.parser || '',
        resolver: options.resolver || options.parser || ''
    };
}

function toBase64Url(buffer) {
    return Buffer.from(buffer).toString('base64');
}

function fromBase64Url(value) {
    return Buffer.from(String(value || ''), 'base64');
}

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, Math.max(0, Number(ms) || 0)));
}

function withTimeout(promise, timeoutMs, fallbackValue) {
    return new Promise(resolve => {
        const timer = setTimeout(() => resolve(fallbackValue), Math.max(1, Number(timeoutMs) || 1));
        Promise.resolve(promise)
            .then(value => {
                clearTimeout(timer);
                resolve(value);
            })
            .catch(() => {
                clearTimeout(timer);
                resolve(fallbackValue);
            });
    });
}

async function requestToubiecSessionKey(apiOrigin) {
    const apiUrl = new URL('/api/key', apiOrigin);
    const data = await requestJsonPostToUrl(apiUrl, {}, {
        'Referer': TOUBIEC_REFERER,
        'Origin': TOUBIEC_REFERER.replace(/\/$/, '')
    });
    if (Number(data?.code) !== 200 || !data?.data?.key || !data?.data?.keyId || !data?.data?.keyToken) {
        throw new Error(data?.message || 'Failed to get music parser session');
    }
    return data.data;
}

function encryptToubiecPayload(payload, keyText) {
    const key = fromBase64Url(keyText);
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    const encrypted = Buffer.concat([
        cipher.update(JSON.stringify(payload || {}), 'utf8'),
        cipher.final()
    ]);
    const tag = cipher.getAuthTag();
    return `${toBase64Url(iv)}.${toBase64Url(tag)}.${toBase64Url(encrypted)}`;
}

function decryptToubiecPayload(ciphertext, keyText) {
    const [ivText, tagText, encryptedText] = String(ciphertext || '').split('.');
    if (!ivText || !tagText || !encryptedText) return null;

    const decipher = crypto.createDecipheriv('aes-256-gcm', fromBase64Url(keyText), fromBase64Url(ivText));
    decipher.setAuthTag(fromBase64Url(tagText));
    const decrypted = Buffer.concat([
        decipher.update(fromBase64Url(encryptedText)),
        decipher.final()
    ]);
    return JSON.parse(decrypted.toString('utf8'));
}

function isRetryableToubiecError(error) {
    const message = String(error?.message || error || '');
    return /HTTP\s+(400|404|408|425|429|500|502|503|504)|timed out|timeout|ECONNRESET|EAI_AGAIN|socket hang up/i.test(message);
}

async function requestToubiecApi(pathname, payload = {}, options = {}) {
    let lastError = null;
    const attempts = Math.max(1, Number(options.attempts) || TOUBIEC_REQUEST_ATTEMPTS);

    for (const apiOrigin of TOUBIEC_API_ORIGINS) {
        for (let attempt = 1; attempt <= attempts; attempt += 1) {
            try {
                const session = await requestToubiecSessionKey(apiOrigin);
                const apiUrl = new URL(pathname, apiOrigin);
                const encryptedPayload = encryptToubiecPayload({
                    ...payload,
                    timestamp: Date.now()
                }, session.key);
                const response = await requestJsonPostToUrl(apiUrl, {
                    keyId: session.keyId,
                    keyToken: session.keyToken,
                    data: encryptedPayload
                }, {
                    'Referer': TOUBIEC_REFERER,
                    'Origin': TOUBIEC_REFERER.replace(/\/$/, '')
                }, options);

                if (response?.ciphertext) {
                    const decrypted = decryptToubiecPayload(response.ciphertext, session.key);
                    if (!decrypted) throw new Error('Failed to decrypt music parser response');
                    return decrypted;
                }

                return response;
            } catch (error) {
                lastError = error;
                if (attempt < attempts && isRetryableToubiecError(error)) {
                    await delay(120 * attempt);
                    continue;
                }
                console.warn(`Toubiec parser endpoint failed (${apiOrigin}):`, error?.message || error);
                break;
            }
        }
    }

    throw lastError || new Error('Toubiec parser request failed');
}

function createMusic163TrackFromToubiecInfo(info, fallbackId) {
    if (!info || typeof info !== 'object') return null;

    const id = String(info.id || info.songId || fallbackId || '').trim();
    const name = String(info.name || info.title || '').trim();
    if (!/^\d+$/.test(id) || !name) return null;

    const artistText = String(info.singer || info.artist || info.artistsname || '').trim();
    const duration = Number(info.duration || info.dt || 0);
    return {
        id,
        name,
        artistsname: artistText,
        artists: artistText
            ? artistText.split(/\s*[\/,&]\s*/).filter(Boolean).map(artistName => ({ name: artistName }))
            : [],
        album: {
            name: String(info.album || info.albumName || '').trim(),
            picUrl: String(info.picimg || info.picUrl || info.cover || '').trim()
        },
        picurl: String(info.picimg || info.picUrl || info.cover || '').trim(),
        duration: duration > 0 && duration < 10000 ? duration * 1000 : duration
    };
}

async function resolveMusic163SongViaToubiec(id, options = {}) {
    const normalizedId = String(id || '').trim();
    if (!/^\d+$/.test(normalizedId)) return null;

    const level = String(options.level || TOUBIEC_DEFAULT_LEVEL).trim() || TOUBIEC_DEFAULT_LEVEL;
    const cacheKey = `${normalizedId}:${level}`;
    const forceRefresh = Boolean(options.force || options.refresh || options.noCache);
    const cached = toubiecResolveCache.get(cacheKey);
    if (!forceRefresh && cached?.song && cached.expiresAt > Date.now()) return cached.song;
    if (!forceRefresh && cached?.promise && cached.expiresAt > Date.now()) return cached.promise;
    if (cached) toubiecResolveCache.delete(cacheKey);

    const resolvePromise = (async () => {
        const urlPayload = await requestToubiecApi('/api/getSongUrl', { id: normalizedId, level });
        if (Number(urlPayload?.code) === 429) throw new Error(urlPayload.message || 'Music parser rate limit');
        const audioUrl = String(urlPayload?.data?.url || '').replace(/`/g, '').trim();
        if (Number(urlPayload?.code) !== 200 || !audioUrl) return null;

        const infoPromise = requestToubiecApi('/api/getSongInfo', { id: normalizedId }, {
            timeout: Math.max(1000, TOUBIEC_INFO_TIMEOUT_MS)
        }).catch(error => {
            console.warn('Toubiec music metadata failed:', error?.message || error);
            return null;
        });
        const infoPayload = await withTimeout(infoPromise, TOUBIEC_INFO_TIMEOUT_MS, null);
        if (Number(infoPayload?.code) === 429) throw new Error(infoPayload.message || 'Music parser rate limit');
        const infoData = Number(infoPayload?.code) === 200 && infoPayload?.data ? infoPayload.data : null;

        const track = createMusic163TrackFromToubiecInfo(infoData, normalizedId);
        const song = normalizeMusic163PlaylistSong(
            track || { id: normalizedId, name: `Music ${normalizedId}`, artists: [], album: {}, duration: 0 },
            audioUrl,
            { allowMetadataOnly: false }
        );
        return song ? { ...song, parser: 'toubiec', resolver: 'toubiec' } : null;
    })();

    toubiecResolveCache.set(cacheKey, {
        promise: resolvePromise,
        expiresAt: Date.now() + TOUBIEC_RESOLVE_CACHE_TTL_MS
    });

    try {
        const song = await resolvePromise;
        if (song?.url) {
            toubiecResolveCache.set(cacheKey, {
                song,
                expiresAt: Date.now() + TOUBIEC_RESOLVE_CACHE_TTL_MS
            });
        } else {
            toubiecResolveCache.delete(cacheKey);
        }
        return song;
    } catch (error) {
        toubiecResolveCache.delete(cacheKey);
        throw error;
    }
}

async function searchMusic163SongsViaToubiec(keyword, options = {}) {
    const query = String(keyword || '').trim();
    if (!query) return [];

    const limit = Math.min(30, Math.max(1, Number(options.limit) || 20));
    const offset = Math.max(0, Number(options.offset) || 0);
    const data = await requestToubiecApi('/api/search', {
        keyword: query,
        type: 1,
        limit,
        offset
    });
    if (Number(data?.code) === 429) throw new Error(data.message || 'Music search rate limit');
    if (Number(data?.code) !== 200 || !data?.data) return [];

    const rawSongs = Array.isArray(data.data) ? data.data : (data.data.songs || data.data.list || []);
    return rawSongs
        .map(item => normalizeMusic163SearchSong(createMusic163TrackFromToubiecInfo(item, item?.id)))
        .map(song => (song ? { ...song, parser: 'toubiec', resolver: 'toubiec' } : null))
        .filter(Boolean);
}

function getXfabePayloadData(payload) {
    if (!payload || typeof payload !== 'object') return null;
    if ('code' in payload && Number(payload.code) !== 200) return null;
    return payload.data && typeof payload.data === 'object' ? payload.data : payload;
}

function createMusic163TrackFromXfabePayload(payload, fallbackId) {
    const data = getXfabePayloadData(payload);
    if (!data || typeof data !== 'object') return null;

    const id = String(data.music163Id || data.id || fallbackId || '').trim();
    const name = String(data.name || '').trim();
    const url = String(data.url || '').trim();
    if (!/^\d+$/.test(id) || !name || !url) return null;

    const artistText = String(data.artistsname || data.artist || '').trim();
    const duration = Number(data.duration || 0);
    return {
        id,
        name,
        artistsname: artistText,
        artists: artistText
            ? artistText.split(/\s*[\/,，、&]\s*/).filter(Boolean).map(artistName => ({ name: artistName }))
            : [],
        album: {
            name: String(data.album || '').trim(),
            picUrl: String(data.picurl || data.cover || '').trim()
        },
        picurl: String(data.picurl || data.cover || '').trim(),
        duration: duration > 0 && duration < 10000 ? duration * 1000 : duration
    };
}

function createMusic163TrackFromXfabeSearchSong(song) {
    if (!song || typeof song !== 'object') return null;

    const id = String(song.music163Id || song.id || '').trim();
    const name = String(song.name || song.title || '').trim();
    if (!/^\d+$/.test(id) || !name) return null;

    const artistText = String(song.artistsname || song.artist || '').trim();
    const duration = Number(song.duration || 0);
    const album = song.album && typeof song.album === 'object'
        ? song.album
        : { name: String(song.album || '').trim() };

    return {
        id,
        name,
        artistsname: artistText,
        artists: artistText
            ? artistText.split(/\s*[\/,&]\s*/).filter(Boolean).map(artistName => ({ name: artistName }))
            : [],
        album: {
            ...album,
            name: String(album.name || song.album || '').trim(),
            picUrl: String(album.picUrl || song.picurl || song.cover || '').trim()
        },
        picurl: String(song.picurl || song.cover || '').trim(),
        duration: duration > 0 && duration < 10000 ? duration * 1000 : duration
    };
}

function getXfabeSearchSongs(payload) {
    const data = getXfabePayloadData(payload);
    if (Array.isArray(data)) return data;
    if (Array.isArray(data?.songs)) return data.songs;
    if (Array.isArray(payload?.songs)) return payload.songs;
    return [];
}

async function resolveMusic163SongViaXfabe(id) {
    const normalizedId = String(id || '').trim();
    if (!/^\d+$/.test(normalizedId)) return null;

    const apiUrl = new URL('https://node.api.xfabe.com/api/wangyi/music');
    apiUrl.searchParams.set('type', 'json');
    apiUrl.searchParams.set('id', normalizedId);

    const data = await requestJsonFromUrl(apiUrl, {
        'Referer': 'https://node.api.xfabe.com/'
    });
    const track = createMusic163TrackFromXfabePayload(data, normalizedId);
    if (!track) return null;

    const payloadData = getXfabePayloadData(data);
    return normalizeMusic163PlaylistSong(track, String(payloadData?.url || '').trim(), { allowMetadataOnly: false, parser: 'xfabe', resolver: 'xfabe' });
}

async function resolveMusic163SongById(id, options = {}) {
    const normalizedId = String(id || '').trim();
    if (!/^\d+$/.test(normalizedId)) return null;

    const allowMetadataOnly = Boolean(options.allowMetadataOnly);
    const preferXfabe = Boolean(options.preferXfabe);

    if (preferXfabe && !allowMetadataOnly) {
        try {
            const xfabeSong = await resolveMusic163SongViaXfabe(normalizedId);
            if (xfabeSong?.url) return xfabeSong;
        } catch (error) {
            console.warn('Preferred music parser failed:', error?.message || error);
        }
    }

    if (!allowMetadataOnly) {
        try {
            const toubiecSong = await resolveMusic163SongViaToubiec(normalizedId, options);
            if (toubiecSong?.url) return toubiecSong;
        } catch (error) {
            console.warn('Toubiec music parser failed:', error?.message || error);
        }
    }

    if (!allowMetadataOnly) {
        try {
            const fallbackSong = await resolveMusic163SongViaXfabe(normalizedId);
            if (fallbackSong?.url) return fallbackSong;
        } catch (error) {
            console.warn('备用接口解析网易云歌曲失败:', error?.message || error);
        }
        return null;
    }

    let track = null;
    try {
        const detailById = await requestMusic163SongDetails([normalizedId]);
        track = detailById.get(normalizedId) || null;
    } catch (error) {
        console.warn('读取网易云歌曲信息失败:', error?.message || error);
    }

    return normalizeMusic163PlaylistSong(
        track || { id: normalizedId, name: `链接歌曲 ${normalizedId}`, artists: [], album: {}, duration: 0 },
        '',
        { allowMetadataOnly: true }
    );
}

function normalizeMusic163SearchSong(track) {
    const song = normalizeMusic163PlaylistSong(track, '', { allowMetadataOnly: true });
    return song ? { ...song, playable: true } : null;
}

async function searchMusic163SongsViaXfabe(keyword, options = {}) {
    const query = String(keyword || '').trim();
    if (!query) return [];

    const limit = Math.min(30, Math.max(1, Number(options.limit) || 20));
    const apiUrl = new URL('https://node.api.xfabe.com/api/wangyi/search');
    apiUrl.searchParams.set('search', query);
    apiUrl.searchParams.set('limit', String(limit));

    const data = await requestJsonFromUrl(apiUrl, {
        'Referer': 'https://node.api.xfabe.com/'
    });

    return getXfabeSearchSongs(data)
        .map(createMusic163TrackFromXfabeSearchSong)
        .map(normalizeMusic163SearchSong)
        .filter(Boolean);
}

async function searchMusic163Songs(keyword, options = {}) {
    const query = String(keyword || '').trim();
    if (!query) return [];

    const limit = Math.min(30, Math.max(1, Number(options.limit) || 20));
    const offset = Math.max(0, Number(options.offset) || 0);
    const strictToubiec = true;

    try {
        const toubiecSongs = await searchMusic163SongsViaToubiec(query, { limit, offset });
        if (toubiecSongs.length || strictToubiec) return toubiecSongs;
    } catch (error) {
        console.warn('Toubiec music search failed:', error?.message || error);
        if (strictToubiec) throw error;
    }

    if (offset === 0) {
        try {
            const xfabeSongs = await searchMusic163SongsViaXfabe(query, { limit });
            if (xfabeSongs.length) return xfabeSongs;
        } catch (error) {
            console.warn('备用接口搜索网易云歌曲失败:', error?.message || error);
        }
    }

    const apiUrl = new URL('https://music.163.com/api/search/get');
    apiUrl.searchParams.set('csrf_token', '');
    apiUrl.searchParams.set('hlpretag', '');
    apiUrl.searchParams.set('hlposttag', '');
    apiUrl.searchParams.set('s', query);
    apiUrl.searchParams.set('type', '1');
    apiUrl.searchParams.set('offset', String(offset));
    apiUrl.searchParams.set('total', offset === 0 ? 'true' : 'false');
    apiUrl.searchParams.set('limit', String(limit));

    const data = await requestJsonFromUrl(apiUrl, {
        'Referer': 'https://music.163.com/'
    });
    const rawSongs = Array.isArray(data?.result?.songs) ? data.result.songs : [];

    return rawSongs.map(normalizeMusic163SearchSong).filter(Boolean);
}

function normalizeMusic163UserPlaylist(item) {
    if (!item || typeof item !== 'object') return null;
    const id = String(item.id || '').trim();
    if (!/^\d+$/.test(id)) return null;

    return {
        id,
        title: String(item.name || `歌单 ${id}`).trim(),
        cover: String(item.coverImgUrl || item.picUrl || '').trim(),
        trackCount: Math.max(0, Number(item.trackCount) || 0),
        creator: String(item?.creator?.nickname || '').trim(),
        description: String(item.description || '').trim(),
        pageUrl: `https://music.163.com/playlist?id=${encodeURIComponent(id)}`
    };
}

async function resolveMusic163UserPlaylists(uid) {
    const normalizedUid = String(uid || '').trim();
    const apiUrl = new URL('https://music.163.com/api/user/playlist');
    apiUrl.searchParams.set('uid', normalizedUid);
    apiUrl.searchParams.set('limit', '50');
    apiUrl.searchParams.set('offset', '0');

    const data = await requestJsonFromUrl(apiUrl, {
        'Referer': `https://music.163.com/user/home?id=${encodeURIComponent(normalizedUid)}`
    });
    const rawPlaylists = Array.isArray(data?.playlist) ? data.playlist : [];

    return rawPlaylists.map(normalizeMusic163UserPlaylist).filter(Boolean);
}

async function resolveMusic163LyricsViaXfabe(id) {
    const normalizedId = String(id || '').trim();
    if (!/^\d+$/.test(normalizedId)) return null;

    try {
        const apiUrl = new URL('https://node.api.xfabe.com/api/wangyi/lyrics');
        apiUrl.searchParams.set('id', normalizedId);

        const data = await requestJsonFromUrl(apiUrl, {
            'Referer': 'https://node.api.xfabe.com/'
        });
        const payloadData = getXfabePayloadData(data);
        const lyric = String(payloadData?.lyric || '').trim();
        if (lyric) {
            return {
                id: normalizedId,
                version: Number(payloadData?.version || 0),
                lyric
            };
        }
    } catch (error) {
        console.warn('备用歌词接口失败，尝试网易云歌词接口:', error?.message || error);
    }

    return null;
}

async function resolveMusic163PlaylistById(id) {
    const normalizedId = String(id || '').trim();
    const apiUrl = new URL(`https://music.163.com/api/playlist/detail?id=${encodeURIComponent(normalizedId)}`);
    const data = await requestJsonFromUrl(apiUrl, {
        'Referer': 'https://music.163.com/'
    });
    const playlist = data?.result || data?.playlist || {};
    let tracks = Array.isArray(playlist?.tracks) ? playlist.tracks : [];

    if (!tracks.length && Array.isArray(playlist?.trackIds)) {
        const detailIds = playlist.trackIds
            .map(item => String(item?.id || '').trim())
            .filter(idValue => /^\d+$/.test(idValue));
        const detailById = await requestMusic163SongDetails(detailIds);
        tracks = detailIds.map(idValue => detailById.get(idValue)).filter(Boolean);
    }

    if (!tracks.length) {
        return {
            id: normalizedId,
            title: String(playlist?.name || '').trim(),
            songs: [],
            unavailableCount: 0
        };
    }

    const trackIds = [];
    let audioUrlById = new Map();
    try {
        audioUrlById = new Map();
    } catch (error) {
        console.warn('读取网易云歌单播放地址失败，改用歌曲元数据导入:', error?.message || error);
    }

    const songs = tracks
        .map(track => normalizeMusic163PlaylistSong(
            track,
            audioUrlById.get(String(track?.id || '').trim()) || '',
            { allowMetadataOnly: true }
        ))
        .filter(Boolean);

    return {
        id: normalizedId,
        title: String(playlist?.name || '').trim(),
        songs,
        playableCount: songs.filter(song => song.playable).length,
        unavailableCount: songs.filter(song => !song.playable).length
    };
}

async function handleAudioProxy(query, requestHeaders = {}) {
    const target = String(query.url || '').trim();
    let targetUrl;
    try {
        targetUrl = new URL(target);
    } catch (error) {
        return jsonResponse(400, { error: { message: '无效的音频链接' } });
    }

    if (!['http:', 'https:'].includes(targetUrl.protocol)) {
        return jsonResponse(400, { error: { message: '仅支持 http/https 音频链接' } });
    }

    const headers = {
        'User-Agent': getHeader(requestHeaders, 'user-agent') || 'Mozilla/5.0',
        'Accept': getHeader(requestHeaders, 'accept') || 'audio/*,*/*;q=0.8',
        'Referer': targetUrl.hostname.endsWith('music.126.net') ? 'https://music.163.com/' : `${targetUrl.protocol}//${targetUrl.hostname}/`,
        'Origin': targetUrl.hostname.endsWith('music.126.net') ? 'https://music.163.com' : undefined
    };
    headers.Range = getHeader(requestHeaders, 'range') || DEFAULT_AUDIO_RANGE;
    Object.keys(headers).forEach(key => {
        if (headers[key] === undefined) delete headers[key];
    });

    try {
        const upstream = await requestBinaryFromUrl(targetUrl, headers);
        const responseHeaders = {
            'Content-Type': upstream.headers['content-type'] || 'audio/mpeg',
            'Accept-Ranges': upstream.headers['accept-ranges'] || 'bytes',
            'Cache-Control': 'public, max-age=300, s-maxage=300'
        };
        if (upstream.headers['content-length']) responseHeaders['Content-Length'] = upstream.headers['content-length'];
        if (upstream.headers['content-range']) responseHeaders['Content-Range'] = upstream.headers['content-range'];
        return binaryResponse(upstream.statusCode, upstream.buffer, responseHeaders);
    } catch (error) {
        return jsonResponse(502, { error: { message: `音频代理失败: ${error.message || '未知错误'}` } });
    }
}

async function handleImageProxy(query, requestHeaders = {}) {
    const target = String(query.url || '').trim();
    let targetUrl;
    try {
        targetUrl = new URL(target);
    } catch (error) {
        return jsonResponse(400, { error: { message: '无效的图片链接' } });
    }

    if (!['http:', 'https:'].includes(targetUrl.protocol)) {
        return jsonResponse(400, { error: { message: '仅支持 http/https 图片链接' } });
    }

    try {
        const upstream = await requestBinaryFromUrl(targetUrl, {
            'User-Agent': requestHeaders['user-agent'] || 'Mozilla/5.0',
            'Accept': requestHeaders.accept || 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
            'Referer': 'https://music.163.com/'
        });
        return binaryResponse(upstream.statusCode, upstream.buffer, {
            'Content-Type': upstream.headers['content-type'] || 'image/jpeg',
            'Cache-Control': 'public, max-age=86400'
        });
    } catch (error) {
        return jsonResponse(502, { error: { message: `图片代理失败: ${error.message || '未知错误'}` } });
    }
}

async function handleMusic163Action(action, query) {
    if (action === 'resolve') {
        const id = String(query.id || '').trim();
        if (!/^\d+$/.test(id)) return jsonResponse(400, { error: { message: '无效的歌曲 ID' } });
        const force = ['1', 'true', 'yes'].includes(String(query.force || query.refresh || '').trim().toLowerCase());
        const song = await resolveMusic163SongById(id, { strictToubiec: true, force });
        return song
            ? jsonResponse(200, song)
            : jsonResponse(404, { error: { message: '该歌曲暂时没有可播放链接', code: 'MUSIC_UNAVAILABLE' } });
    }

    if (action === 'lyrics') {
        const id = String(query.id || '').trim();
        if (!/^\d+$/.test(id)) return jsonResponse(400, { error: { message: '无效的歌曲 ID', code: 'MUSIC_LYRIC_INVALID_ID' } });
        const lyricData = await resolveMusic163LyricsViaXfabe(id);
        return lyricData?.lyric
            ? jsonResponse(200, lyricData)
            : jsonResponse(404, { error: { message: '该歌曲暂时没有歌词', code: 'MUSIC_LYRIC_UNAVAILABLE' } });
    }

    if (action === 'search') {
        const keyword = String(query.q || query.keyword || query.search || '').trim();
        if (!keyword) return jsonResponse(400, { error: { message: '请输入要搜索的歌曲', code: 'MUSIC_SEARCH_EMPTY' } });
        const songs = await searchMusic163Songs(keyword, {
            limit: query.limit || 20,
            offset: query.offset || 0,
            strictToubiec: true
        });
        return jsonResponse(200, { keyword, parser: 'toubiec', songs });
    }

    if (action === 'user-playlists') {
        const uid = String(query.uid || '').trim();
        if (!/^\d+$/.test(uid)) return jsonResponse(400, { error: { message: '无效的网易云 UID', code: 'MUSIC_UID_INVALID' } });
        const playlists = await resolveMusic163UserPlaylists(uid);
        return playlists.length
            ? jsonResponse(200, { uid, playlists })
            : jsonResponse(404, { error: { message: '没有找到公开歌单', code: 'MUSIC_USER_PLAYLIST_EMPTY' } });
    }

    if (action === 'playlist') {
        const id = String(query.id || '').trim();
        if (!/^\d+$/.test(id)) return jsonResponse(400, { error: { message: '无效的歌单 ID' } });
        const playlistData = await resolveMusic163PlaylistById(id);
        return playlistData.songs.length
            ? jsonResponse(200, playlistData)
            : jsonResponse(404, { error: { message: '歌单里暂时没有可导入的歌曲', code: 'MUSIC_PLAYLIST_EMPTY' } });
    }

    if (action === 'import') {
        const rawValue = String(query.url || query.text || '').trim();
        if (!rawValue) return jsonResponse(400, { error: { message: '缺少网易云分享链接', code: 'MUSIC_SHARE_UNSUPPORTED' } });

        const directPlaylistMatch = rawValue.replace(/&amp;/gi, '&').match(/playlist[\s\S]*?[?&]id=(\d+)/i);
        if (directPlaylistMatch) {
            const playlistData = await resolveMusic163PlaylistById(directPlaylistMatch[1]);
            return playlistData.songs.length
                ? jsonResponse(200, { type: 'playlist', resolvedUrl: cleanMusicShareUrl(rawValue), ...playlistData })
                : jsonResponse(404, { error: { message: '歌单里暂时没有可导入的歌曲', code: 'MUSIC_PLAYLIST_EMPTY' } });
        }

        const target = await resolveMusic163ShareTarget(rawValue);
        if (!target) return jsonResponse(400, { error: { message: '暂不支持该网易云分享链接', code: 'MUSIC_SHARE_UNSUPPORTED' } });

        if (target.type === 'playlist') {
            const playlistData = await resolveMusic163PlaylistById(target.id);
            return playlistData.songs.length
                ? jsonResponse(200, { type: 'playlist', resolvedUrl: target.pageUrl, ...playlistData })
                : jsonResponse(404, { error: { message: '歌单里暂时没有可导入的歌曲', code: 'MUSIC_PLAYLIST_EMPTY' } });
        }

        const song = await resolveMusic163SongById(target.id, { allowMetadataOnly: false, strictToubiec: true });
        return song
            ? jsonResponse(200, { type: 'song', resolvedUrl: target.pageUrl, songs: [song] })
            : jsonResponse(404, { error: { message: '该歌曲暂时没有可播放链接', code: 'MUSIC_UNAVAILABLE' } });
    }

    return jsonResponse(404, { error: { message: '未知的音乐接口' } });
}

async function handleMusicRequest({ path = '', query = {}, method = 'GET', headers = {} }) {
    if (method === 'OPTIONS') {
        return { statusCode: 204, headers: corsHeaders(), body: '' };
    }
    if (method !== 'GET') {
        return jsonResponse(405, { error: { message: 'Method Not Allowed' } });
    }

    try {
        const pathname = String(path || '').split('?')[0].replace(/\/+$/, '');
        if (pathname.endsWith('/api/music-audio-proxy') || pathname.endsWith('/music-audio-proxy')) {
            return await handleAudioProxy(query, headers);
        }
        if (pathname.endsWith('/api/music-image-proxy') || pathname.endsWith('/music-image-proxy')) {
            return await handleImageProxy(query, headers);
        }

        const segments = pathname.split('/').filter(Boolean);
        const action = String(query.action || segments[segments.length - 1] || '').trim();
        return await handleMusic163Action(action, query);
    } catch (error) {
        return jsonResponse(502, {
            error: {
                message: error?.message || '音乐服务请求失败',
                code: 'MUSIC_API_FAILED'
            }
        });
    }
}

module.exports = {
    handleMusicRequest
};
