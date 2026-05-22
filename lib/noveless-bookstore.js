const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFileSync } = require('child_process');

const NOVELESS_BASE = 'https://noveless.com';
const NOVELESS_DL_BASE = 'https://d.noveless.com/d/one/books';
const NOVELESS_ZIP_PASSWORD = 'noveless.com';
const BOOK_CACHE_DIR = path.join(os.tmpdir(), 'bht-p-books');
const FALLBACK_CATEGORIES = [
    { name: '精校.全本', count: 7, slug: 'uncategorized', url: `${NOVELESS_BASE}/category/uncategorized/` },
    { name: '精校全本', count: 681, slug: 'alltext', url: `${NOVELESS_BASE}/category/alltext/` },
    { name: '重生.穿越', count: 31, slug: 'reborn', url: `${NOVELESS_BASE}/category/reborn/` },
    { name: '推理.小说', count: 2, slug: 'detective', url: `${NOVELESS_BASE}/category/detective/` },
    { name: '都市.娱乐', count: 82, slug: 'city', url: `${NOVELESS_BASE}/category/city/` },
    { name: '在线阅读', count: 76, slug: 'online', url: `${NOVELESS_BASE}/category/online/` },
    { name: '科幻.灵异', count: 51, slug: 'sci-fi', url: `${NOVELESS_BASE}/category/sci-fi/` },
    { name: '历史.军事', count: 52, slug: 'history', url: `${NOVELESS_BASE}/category/history/` },
    { name: '网游.竞技', count: 55, slug: 'game', url: `${NOVELESS_BASE}/category/game/` },
    { name: '仙侠.武侠', count: 37, slug: 'magic', url: `${NOVELESS_BASE}/category/magic/` },
    { name: '玄幻.奇幻', count: 353, slug: 'fantasy', url: `${NOVELESS_BASE}/category/fantasy/` },
    { name: '末世.进化', count: 10, slug: 'evo', url: `${NOVELESS_BASE}/category/evo/` },
    { name: '精校TXT', count: 591, slug: '%25e7%25b2%25be%25e6%25a0%25a1txt', url: `${NOVELESS_BASE}/category/%25e7%25b2%25be%25e6%25a0%25a1txt/` },
    { name: '最值得看2', count: 10, slug: '%25e6%259c%2580%25e5%2580%25bc%25e5%25be%2597%25e7%259c%258b2', url: `${NOVELESS_BASE}/category/%25e6%259c%2580%25e5%2580%25bc%25e5%25be%2597%25e7%259c%258b2/` },
    { name: '最值得看', count: 10, slug: '%25e6%259c%2580%25e5%2580%25bc%25e5%25be%2597%25e7%259c%258b', url: `${NOVELESS_BASE}/category/%25e6%259c%2580%25e5%2580%25bc%25e5%25be%2597%25e7%259c%258b/` },
    { name: '言情小说', count: 12, slug: '%25e8%25a8%2580%25e6%2583%2585%25e5%25b0%258f%25e8%25af%25b4', url: `${NOVELESS_BASE}/category/%25e8%25a8%2580%25e6%2583%2585%25e5%25b0%258f%25e8%25af%25b4/` },
    { name: '书评', count: 4, slug: '%25e4%25b9%25a6%25e8%25af%2584', url: `${NOVELESS_BASE}/category/%25e4%25b9%25a6%25e8%25af%2584/` }
];

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

async function getNovelessCategories() {
    try {
        const html = await fetchUrl(`${NOVELESS_BASE}/`);
        const categoryNavMatch = html.match(/<!--分类category-->[\s\S]*?<!--\/循环输出分类-->/i);
        const source = categoryNavMatch ? categoryNavMatch[0] : html;
        const categories = parseCategoryLinks(source);
        return { categories: categories.length ? categories : FALLBACK_CATEGORIES };
    } catch (error) {
        return { categories: FALLBACK_CATEGORIES };
    }
}

async function getNovelessCategoryBooks(slug, page = 1) {
    const safeSlug = String(slug || '').trim().replace(/^\/+|\/+$/g, '');
    const safePage = Math.max(1, Number.parseInt(String(page || '1'), 10) || 1);
    if (!safeSlug) {
        const error = new Error('缺少分类参数 slug');
        error.statusCode = 400;
        throw error;
    }

    const category = FALLBACK_CATEGORIES.find(item => item.slug === safeSlug);
    const categoryUrl = category?.url || `${NOVELESS_BASE}/category/${safeSlug}/`;
    const pageUrl = safePage === 1 ? categoryUrl : new URL(`${safePage}/`, categoryUrl).toString();
    const html = await fetchUrl(pageUrl);
    const books = parseBookListFromHtml(html);
    const totalPages = getCategoryTotalPages(html) || Math.ceil(Number(category?.count || 0) / 5) || safePage;

    return {
        category: category || { name: safeSlug, count: 0, slug: safeSlug, url: categoryUrl },
        books,
        page: safePage,
        hasMore: safePage < totalPages,
        nextPage: safePage + 1,
        totalPages
    };
}

function parseCategoryLinks(html) {
    const categories = [];
    const linkRegex = /<a\s+[^>]*href=["']([^"']*\/category\/([^"']+)\/)["'][^>]*>([\s\S]*?)<\/a>/gi;
    let match;

    while ((match = linkRegex.exec(html)) !== null) {
        const inner = match[3];
        const countMatch = inner.match(/<b[^>]*>\s*(\d+)\s*<\/b>/i);
        const name = cleanHtmlEntities(inner.replace(/<b[\s\S]*?<\/b>/gi, '').replace(/<[^>]+>/g, '').trim());
        if (!name) continue;
        categories.push({
            name,
            count: countMatch ? Number(countMatch[1]) : 0,
            slug: match[2].replace(/\/$/, ''),
            url: cleanHtmlEntities(match[1])
        });
    }

    return categories;
}

function parseBookListFromHtml(html) {
    const books = [];
    const titleRegex = /<h[23][^>]*class=["'][^"']*index-post-title[^"']*["'][\s\S]*?<a\s+[^>]*href=["']([^"']*\/archives\/(\d+)\/)["'][^>]*>([\s\S]*?)<\/a>/gi;
    let match;

    while ((match = titleRegex.exec(html)) !== null) {
        const id = match[2];
        if (books.some(book => String(book.id) === id)) continue;

        const title = cleanPostTitle(cleanHtmlEntities(stripHtml(match[3])));
        const nearby = html.slice(match.index, Math.min(html.length, match.index + 1200));
        const metaText = cleanHtmlEntities(stripHtml(nearby)).replace(/\s+/g, ' ');
        const imageMatch = nearby.match(/<img\s+[^>]*src=["']([^"']+)["']/i);
        const authorMatch = metaText.match(/作者[：:]?\s*([^类\s]+?)(?=类别|内容简介|\s|$)/);
        const categoryMatch = metaText.match(/类别[：:]?\s*([^内\s]+?)(?=内容简介|\s|$)/);
        const summaryMatch = metaText.match(/内容简介\s*([^<]{0,120})/);

        books.push({
            id,
            title,
            authors: [authorMatch ? authorMatch[1].trim() : '佚名'],
            category: categoryMatch ? categoryMatch[1].trim() : '',
            summary: summaryMatch ? summaryMatch[1].trim() : '',
            languages: ['TXT'],
            coverUrl: imageMatch ? cleanHtmlEntities(imageMatch[1]) : '',
            downloadCount: 0,
            sourceUrl: cleanHtmlEntities(match[1]),
            textUrl: `${NOVELESS_DL_BASE}/${id}.txt.zip`,
            htmlUrl: '',
            downloadUrl: `${NOVELESS_DL_BASE}/${id}.txt.zip`
        });
    }

    return books;
}

function getCategoryTotalPages(html) {
    const pages = [];
    const pageRegex = /\/category\/[^"']+\/(\d+)\//gi;
    let match;
    while ((match = pageRegex.exec(String(html || ''))) !== null) {
        pages.push(Number(match[1]));
    }
    return pages.length ? Math.max(...pages) : 0;
}

function cleanPostTitle(title) {
    return String(title || '').replace(/^精校(?:全本)?\s*/i, '').replace(/\s*TXT\s*$/i, '').trim() || String(title || '').trim();
}

function stripHtml(str) {
    return String(str || '').replace(/<[^>]+>/g, '');
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

    const files = listFilesRecursive(extractDir).filter(file => file.toLowerCase().endsWith('.txt'));
    if (files.length === 0) {
        throw new Error('解压后未找到文本文件');
    }

    files.sort();
    const txtFilePath = files[0];
    const txtFile = path.basename(txtFilePath);
    const content = fs.readFileSync(txtFilePath, 'utf-8');
    const cleanContent = cleanNovelessBookText(content);
    const chunkSize = 12000;
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

function listFilesRecursive(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    const files = [];
    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            files.push(...listFilesRecursive(fullPath));
        } else if (entry.isFile()) {
            files.push(fullPath);
        }
    }
    return files;
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
    getNovelessCategories,
    getNovelessCategoryBooks,
    prepareNovelessBook,
    getNovelessChunk
};
