const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const NOVELESS_BASE = 'https://noveless.com';
const NOVELESS_DL_BASE = 'https://d.noveless.com/d/one/books';
const NOVELESS_ZIP_PASSWORD = 'noveless.com';
const BOOK_CACHE_DIR = path.join(__dirname, '..', 'tmp', 'books');

function ensureBookCacheDir() {
    if (!fs.existsSync(BOOK_CACHE_DIR)) {
        fs.mkdirSync(BOOK_CACHE_DIR, { recursive: true });
    }
}

async function searchNovelessBooks(query) {
    const keyword = String(query || '').trim();
    if (!keyword) {
        const error = new Error('缺少搜索关键词 q');
        error.statusCode = 400;
        throw error;
    }

    const feedUrl = `${NOVELESS_BASE}/feed/search/${encodeURIComponent(keyword)}/`;
    const xml = await fetchUrl(feedUrl);
    const results = [];
    const itemRegex = /<item>([\s\S]*?)<\/item>/gi;
    let itemMatch;

    while ((itemMatch = itemRegex.exec(xml)) !== null) {
        const itemXml = itemMatch[1];
        const title = extractXmlText(itemXml, 'title');
        const link = extractXmlText(itemXml, 'link');
        const desc = extractXmlText(itemXml, 'description');
        const contentEncoded = extractXmlText(itemXml, 'content:encoded');
        const idMatch = link.match(/\/archives\/(\d+)/);
        const postId = idMatch ? idMatch[1] : '';

        let author = '佚名';
        const authorEncMatch = contentEncoded.match(/作者[：:]\s*([^<\n]+?)\s*(?:类别|$)/);
        if (authorEncMatch) author = authorEncMatch[1].trim();
        const authorDescMatch = desc.match(/作者[：:]\s*([^类<\n]+?)(?=类别|$)/);
        if (authorDescMatch && (!authorEncMatch || author === '佚名')) author = authorDescMatch[1].trim();

        let category = '';
        const catMatch = (contentEncoded || desc).match(/类别[：:]\s*([^<\n]+?)(?:内容简介|简介|$)/);
        if (catMatch) category = catMatch[1].trim();

        let summary = '';
        const summaryMatch = (contentEncoded || desc).match(/(?:内容简介|简介)[：:]\s*([^<]+?)(?:<\/|\n)/);
        if (summaryMatch) summary = summaryMatch[1].trim();

        const textDownloadMatch = contentEncoded.match(/href=['"]([^'"]+\/books\/\d+\.txt\.zip)['"]/i);
        if (!textDownloadMatch) continue;
        const textDownloadUrl = cleanHtmlEntities(textDownloadMatch[1]);

        results.push({
            id: postId,
            title: cleanHtmlEntities(title),
            authors: [author],
            category,
            summary,
            languages: ['TXT'],
            coverUrl: '',
            downloadCount: 0,
            sourceUrl: link,
            textUrl: textDownloadUrl,
            htmlUrl: '',
            downloadUrl: textDownloadUrl
        });
    }

    const limited = results.slice(0, 50);
    return { books: limited, total: limited.length };
}

async function prepareNovelessBook(bookId) {
    const safeBookId = String(bookId || '').trim();
    if (!safeBookId || !/^\d+$/.test(safeBookId)) {
        const error = new Error('书籍 id 不合法');
        error.statusCode = 400;
        throw error;
    }

    ensureBookCacheDir();

    const zipPath = path.join(BOOK_CACHE_DIR, `${safeBookId}.txt.zip`);
    const extractDir = path.join(BOOK_CACHE_DIR, safeBookId);
    const chunksDir = path.join(extractDir, 'chunks');
    const metadataPath = path.join(extractDir, 'book.json');
    const downloadUrl = `${NOVELESS_DL_BASE}/${safeBookId}.txt.zip`;

    if (fs.existsSync(metadataPath)) {
        return JSON.parse(fs.readFileSync(metadataPath, 'utf-8'));
    }

    if (!fs.existsSync(zipPath)) {
        await downloadFile(downloadUrl, zipPath);
    }

    if (!fs.existsSync(path.join(extractDir, '.extracted'))) {
        if (fs.existsSync(extractDir)) {
            fs.rmSync(extractDir, { recursive: true });
        }
        fs.mkdirSync(extractDir, { recursive: true });
        try {
            execFileSync('unzip', ['-o', '-P', NOVELESS_ZIP_PASSWORD, zipPath, '-d', extractDir], {
                stdio: 'pipe',
                timeout: 30000,
                encoding: 'utf-8'
            });
            fs.writeFileSync(path.join(extractDir, '.extracted'), '1');
        } catch (unzipError) {
            try { fs.rmSync(extractDir, { recursive: true }); } catch (e) { }
            throw new Error(`解压失败: ${unzipError.message}`);
        }
    }

    const files = fs.readdirSync(extractDir).filter(f => f.endsWith('.txt'));
    if (files.length === 0) {
        throw new Error('解压后未找到文本文件');
    }

    files.sort();
    const txtFile = files[0];
    const content = fs.readFileSync(path.join(extractDir, txtFile), 'utf-8');
    const cleanContent = cleanNovelessBookText(content);
    const chunkSize = 50000;
    const chunks = splitTextIntoChunks(cleanContent, chunkSize);

    if (fs.existsSync(chunksDir)) {
        fs.rmSync(chunksDir, { recursive: true });
    }
    fs.mkdirSync(chunksDir, { recursive: true });
    chunks.forEach((chunk, index) => {
        fs.writeFileSync(path.join(chunksDir, `${index}.txt`), chunk, 'utf-8');
    });

    const bookInfo = {
        id: safeBookId,
        title: txtFile.replace(/\.txt$/i, ''),
        fileSize: content.length,
        textLength: cleanContent.length,
        chunkCount: chunks.length,
        chunkSize
    };
    fs.writeFileSync(metadataPath, JSON.stringify(bookInfo), 'utf-8');
    return bookInfo;
}

async function getNovelessChunk(bookId, chunkIndex) {
    const safeBookId = String(bookId || '').trim();
    const safeChunkIndex = Number.parseInt(String(chunkIndex ?? '0'), 10);

    if (!safeBookId || !/^\d+$/.test(safeBookId) || !Number.isInteger(safeChunkIndex) || safeChunkIndex < 0) {
        const error = new Error('请求参数不合法');
        error.statusCode = 400;
        throw error;
    }

    const bookInfo = await prepareNovelessBook(safeBookId);
    if (safeChunkIndex >= bookInfo.chunkCount) {
        const error = new Error('章节分段不存在');
        error.statusCode = 404;
        throw error;
    }

    const chunkPath = path.join(BOOK_CACHE_DIR, safeBookId, 'chunks', `${safeChunkIndex}.txt`);
    const text = fs.readFileSync(chunkPath, 'utf-8');
    return {
        ...bookInfo,
        chunkIndex: safeChunkIndex,
        text
    };
}

function cleanNovelessBookText(content) {
    return String(content || '')
        .replace(/^﻿/, '')
        .replace(/^\s*-{3,}=+[-=]+[\s\S]*?noveless\.com\)\s*-{3,}=+[-=]+\s*/i, '')
        .replace(/^\/\/===[\s\S]*?===\/\/\s*\n*/i, '')
        .trimStart();
}

function splitTextIntoChunks(text, targetSize) {
    const source = String(text || '');
    if (!source) return [''];

    const chunks = [];
    let start = 0;
    while (start < source.length) {
        let end = Math.min(start + targetSize, source.length);
        if (end < source.length) {
            const newlineIndex = source.lastIndexOf('\n', end);
            if (newlineIndex > start + targetSize * 0.6) {
                end = newlineIndex + 1;
            }
        }
        chunks.push(source.slice(start, end));
        start = end;
    }
    return chunks;
}

function fetchUrl(url) {
    return new Promise((resolve, reject) => {
        const mod = url.startsWith('https') ? https : http;
        const req = mod.get(url, { timeout: 20000, headers: { 'User-Agent': 'Mozilla/5.0 (compatible; BHT/1.0)' } }, (res) => {
            if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                fetchUrl(new URL(res.headers.location, url).toString()).then(resolve).catch(reject);
                return;
            }
            let data = '';
            res.setEncoding('utf8');
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    resolve(data);
                } else {
                    reject(new Error(`HTTP ${res.statusCode}`));
                }
            });
        });
        req.on('error', reject);
        req.on('timeout', () => {
            req.destroy();
            reject(new Error('请求超时'));
        });
    });
}

function downloadFile(url, destPath) {
    return new Promise((resolve, reject) => {
        const mod = url.startsWith('https') ? https : http;
        const file = fs.createWriteStream(destPath);
        const req = mod.get(url, { timeout: 60000, headers: { 'User-Agent': 'Mozilla/5.0 (compatible; BHT/1.0)' } }, (res) => {
            if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                file.close();
                fs.unlink(destPath, () => {});
                downloadFile(new URL(res.headers.location, url).toString(), destPath).then(resolve).catch(reject);
                return;
            }
            if (res.statusCode >= 200 && res.statusCode < 300) {
                res.pipe(file);
                file.on('finish', () => { file.close(); resolve(); });
            } else {
                file.close();
                fs.unlink(destPath, () => {});
                reject(new Error(`下载失败 HTTP ${res.statusCode}`));
            }
        });
        req.on('error', (err) => {
            file.close();
            try { fs.unlinkSync(destPath); } catch (e) { }
            reject(err);
        });
        req.on('timeout', () => {
            req.destroy();
            file.close();
            try { fs.unlinkSync(destPath); } catch (e) { }
            reject(new Error('下载超时'));
        });
    });
}

function extractXmlText(xml, tagName) {
    const regex = new RegExp(`<${tagName}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]>\\s*<\\/${tagName}>|<${tagName}[^>]*>([\\s\\S]*?)<\\/${tagName}>`);
    const match = String(xml || '').match(regex);
    if (match) return (match[1] || match[2] || '').trim();
    return '';
}

function cleanHtmlEntities(str) {
    if (!str) return '';
    return String(str)
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#039;/g, "'")
        .replace(/&#39;/g, "'")
        .replace(/&#x27;/g, "'");
}

module.exports = {
    searchNovelessBooks,
    prepareNovelessBook,
    getNovelessChunk
};
