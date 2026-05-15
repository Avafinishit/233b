const http = require('http');
const https = require('https');

function corsHeaders(extra = {}) {
    return {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, Range',
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
            if (/^\d+$/.test(id) && url) audioUrlById.set(id, url);
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
        playable: Boolean(audioUrl)
    };
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
    return normalizeMusic163PlaylistSong(track, String(payloadData?.url || '').trim(), { allowMetadataOnly: false });
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

    let audioUrlById = new Map();
    try {
        audioUrlById = await resolveMusic163AudioUrls([normalizedId]);
    } catch (error) {
        console.warn('读取网易云歌曲播放地址失败:', error?.message || error);
    }
    let audioUrl = audioUrlById.get(normalizedId) || '';

    let track = null;
    try {
        const detailById = await requestMusic163SongDetails([normalizedId]);
        track = detailById.get(normalizedId) || null;
    } catch (error) {
        console.warn('读取网易云歌曲信息失败:', error?.message || error);
    }

    if (!audioUrl) {
        try {
            const fallbackSong = await resolveMusic163SongViaXfabe(normalizedId);
            if (fallbackSong?.url) return fallbackSong;
        } catch (error) {
            console.warn('备用接口解析网易云歌曲失败:', error?.message || error);
        }
    }

    if (!audioUrl && !allowMetadataOnly) return null;

    return normalizeMusic163PlaylistSong(
        track || { id: normalizedId, name: `链接歌曲 ${normalizedId}`, artists: [], album: {}, duration: 0 },
        audioUrl,
        { allowMetadataOnly }
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

    const officialUrl = new URL('https://music.163.com/api/song/lyric');
    officialUrl.searchParams.set('id', normalizedId);
    officialUrl.searchParams.set('lv', '1');
    officialUrl.searchParams.set('kv', '1');
    officialUrl.searchParams.set('tv', '-1');

    const data = await requestJsonFromUrl(officialUrl, {
        'Referer': `https://music.163.com/song?id=${encodeURIComponent(normalizedId)}`
    });
    const lyric = String(data?.lrc?.lyric || '').trim();
    if (!lyric) return null;

    return {
        id: normalizedId,
        version: Number(data?.lrc?.version || 0),
        lyric
    };
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

    const trackIds = tracks.map(track => String(track?.id || '').trim()).filter(idValue => /^\d+$/.test(idValue));
    let audioUrlById = new Map();
    try {
        audioUrlById = await resolveMusic163AudioUrls(trackIds);
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
        'User-Agent': requestHeaders['user-agent'] || 'Mozilla/5.0',
        'Accept': requestHeaders.accept || 'audio/*,*/*;q=0.8',
        'Referer': targetUrl.hostname.endsWith('music.126.net') ? 'https://music.163.com/' : `${targetUrl.protocol}//${targetUrl.hostname}/`,
        'Origin': targetUrl.hostname.endsWith('music.126.net') ? 'https://music.163.com' : undefined
    };
    if (requestHeaders.range) headers.Range = requestHeaders.range;
    Object.keys(headers).forEach(key => {
        if (headers[key] === undefined) delete headers[key];
    });

    try {
        const upstream = await requestBinaryFromUrl(targetUrl, headers);
        const responseHeaders = {
            'Content-Type': upstream.headers['content-type'] || 'audio/mpeg',
            'Accept-Ranges': upstream.headers['accept-ranges'] || 'bytes',
            'Cache-Control': 'no-store'
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
        const preferXfabe = ['1', 'true', 'xfabe', 'search'].includes(String(query.parser || query.source || query.prefer || '').trim().toLowerCase());
        const song = await resolveMusic163SongById(id, { preferXfabe });
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
        const songs = await searchMusic163Songs(keyword, { limit: query.limit || 20, offset: query.offset || 0 });
        return jsonResponse(200, { keyword, songs });
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

        const song = await resolveMusic163SongById(target.id, { allowMetadataOnly: false });
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
