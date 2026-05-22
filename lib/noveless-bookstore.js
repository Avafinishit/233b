const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const os = require('os');
const zlib = require('zlib');
const { TextDecoder } = require('util');
const { execFileSync } = require('child_process');

const NOVELESS_BASE = 'https://noveless.com';
const NOVELESS_DL_BASE = 'https://d.noveless.com/d/one/books';
const NOVELESS_ZIP_PASSWORD = 'noveless.com';
const BOOK_CACHE_ROOT = process.env.BHT_BOOK_CACHE_DIR ? path.resolve(process.env.BHT_BOOK_CACHE_DIR) : os.tmpdir();
const BOOK_CACHE_DIR = path.join(BOOK_CACHE_ROOT, 'bht-p-books');
let crcTable = null;
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
            extractNovelessZip(zipPath, extractDir);
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
    const content = readNovelessTextFile(txtFilePath);
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

function readNovelessTextFile(filePath) {
    const buffer = fs.readFileSync(filePath);
    const utf8Text = buffer.toString('utf-8');
    if (!looksMojibake(utf8Text)) return utf8Text;

    const nativeText = decodeTextWithNative(buffer);
    if (nativeText && !looksMojibake(nativeText)) return nativeText;

    const pythonText = decodeTextWithPython(filePath);
    if (pythonText && !looksMojibake(pythonText)) return pythonText;
    return utf8Text;
}

function decodeTextWithNative(buffer) {
    for (const encoding of ['utf-8', 'gb18030', 'gbk', 'big5']) {
        try {
            const text = new TextDecoder(encoding, { fatal: true }).decode(buffer);
            if (text) return text;
        } catch (error) { }
    }
    return '';
}

function looksMojibake(text) {
    const value = String(text || '').slice(0, 4000);
    if (!value) return false;
    const replacementCount = (value.match(/�/g) || []).length;
    const cjkCount = (value.match(/[一-鿿]/g) || []).length;
    const latinNoiseCount = (value.match(/[À-ÿ]/g) || []).length;
    return replacementCount > 8 || (latinNoiseCount > 30 && cjkCount < 20);
}

function decodeTextWithPython(filePath) {
    const script = [
        'import pathlib, sys',
        'p = pathlib.Path(sys.argv[1])',
        'data = p.read_bytes()',
        "for enc in ('utf-8-sig', 'gb18030', 'gbk', 'big5'):",
        '    try:',
        '        sys.stdout.buffer.write(data.decode(enc).encode("utf-8"))',
        '        raise SystemExit(0)',
        '    except UnicodeDecodeError:',
        '        pass',
        'raise SystemExit(1)'
    ].join('\n');

    for (const python of ['python', 'py']) {
        try {
            return execFileSync(python, ['-c', script, filePath], {
                encoding: 'utf-8',
                maxBuffer: 80 * 1024 * 1024,
                timeout: 30000
            });
        } catch (error) { }
    }
    return '';
}

function extractNovelessZip(zipPath, extractDir) {
    try {
        extractZipWithNodePassword(zipPath, extractDir, NOVELESS_ZIP_PASSWORD);
        return;
    } catch (nodeZipError) {
        if (!isNodeZipFallbackError(nodeZipError)) {
            throw nodeZipError;
        }
    }

    const preferredSevenZip = resolve7ZipExecutable();
    if (preferredSevenZip) {
        execFileSync(preferredSevenZip, ['x', '-y', `-p${NOVELESS_ZIP_PASSWORD}`, `-o${extractDir}`, zipPath], {
            stdio: 'pipe',
            timeout: 60000,
            encoding: 'utf-8'
        });
        return;
    }

    if (extractZipWithPythonPassword(zipPath, extractDir)) {
        return;
    }

    try {
        execFileSync('unzip', ['-o', '-P', NOVELESS_ZIP_PASSWORD, zipPath, '-d', extractDir], {
            stdio: 'pipe',
            timeout: 30000,
            encoding: 'utf-8'
        });
        return;
    } catch (unzipError) {
        const output = `${unzipError.stdout || ''}\n${unzipError.stderr || ''}\n${unzipError.message || ''}`;
        if (unzipError.code !== 'ENOENT' && !/compression method 99|unsupported compression method/i.test(output)) {
            throw unzipError;
        }
    }

    const sevenZip = resolve7ZipExecutable();
    if (!sevenZip) {
        throw new Error('这个压缩包的格式当前环境无法解压，请确认部署函数可以访问 Node zlib，或改用本地后端重试。');
    }

    execFileSync(sevenZip, ['x', '-y', `-p${NOVELESS_ZIP_PASSWORD}`, `-o${extractDir}`, zipPath], {
        stdio: 'pipe',
        timeout: 60000,
        encoding: 'utf-8'
    });
}

function isNodeZipFallbackError(error) {
    const message = String(error?.message || '');
    return /unsupported zip|zip64|aes|multi-disk|central directory|invalid zip|bad zip password|crc mismatch|entry outside/i.test(message);
}

function extractZipWithNodePassword(zipPath, extractDir, password) {
    const zip = fs.readFileSync(zipPath);
    const entries = readZipCentralDirectory(zip).filter(entry => !entry.isDirectory);
    if (entries.length === 0) {
        throw new Error('invalid zip: no file entries');
    }

    for (const entry of entries) {
        const outputPath = resolveSafeExtractPath(extractDir, entry.fileName);
        if (!outputPath) continue;

        const content = readZipEntryContent(zip, entry, password);
        fs.mkdirSync(path.dirname(outputPath), { recursive: true });
        fs.writeFileSync(outputPath, content);
    }
}

function readZipCentralDirectory(zip) {
    const eocdOffset = findEndOfCentralDirectory(zip);
    const diskNumber = zip.readUInt16LE(eocdOffset + 4);
    const centralDisk = zip.readUInt16LE(eocdOffset + 6);
    if (diskNumber !== 0 || centralDisk !== 0) {
        throw new Error('unsupported zip: multi-disk archive');
    }

    const totalEntries = zip.readUInt16LE(eocdOffset + 10);
    const centralDirOffset = zip.readUInt32LE(eocdOffset + 16);
    const entries = [];
    let offset = centralDirOffset;

    for (let index = 0; index < totalEntries; index += 1) {
        if (offset + 46 > zip.length || zip.readUInt32LE(offset) !== 0x02014b50) {
            throw new Error('invalid zip central directory');
        }

        const flags = zip.readUInt16LE(offset + 8);
        const compressionMethod = zip.readUInt16LE(offset + 10);
        const modifiedTime = zip.readUInt16LE(offset + 12);
        const crc32 = zip.readUInt32LE(offset + 16);
        const compressedSize = zip.readUInt32LE(offset + 20);
        const uncompressedSize = zip.readUInt32LE(offset + 24);
        const fileNameLength = zip.readUInt16LE(offset + 28);
        const extraLength = zip.readUInt16LE(offset + 30);
        const commentLength = zip.readUInt16LE(offset + 32);
        const localHeaderOffset = zip.readUInt32LE(offset + 42);
        const fileNameRaw = zip.slice(offset + 46, offset + 46 + fileNameLength);
        const fileName = decodeZipFileName(fileNameRaw, flags);

        if (compressedSize === 0xffffffff || uncompressedSize === 0xffffffff || localHeaderOffset === 0xffffffff) {
            throw new Error('unsupported zip64 archive');
        }

        entries.push({
            fileName,
            flags,
            compressionMethod,
            modifiedTime,
            crc32,
            compressedSize,
            uncompressedSize,
            localHeaderOffset,
            isDirectory: fileName.endsWith('/')
        });

        offset += 46 + fileNameLength + extraLength + commentLength;
    }

    return entries;
}

function findEndOfCentralDirectory(zip) {
    const minOffset = Math.max(0, zip.length - 0xffff - 22);
    for (let offset = zip.length - 22; offset >= minOffset; offset -= 1) {
        if (zip.readUInt32LE(offset) === 0x06054b50) {
            return offset;
        }
    }
    throw new Error('invalid zip: central directory not found');
}

function decodeZipFileName(raw, flags) {
    if ((flags & 0x0800) !== 0) return raw.toString('utf-8');
    const native = decodeTextWithNative(raw);
    return native || raw.toString('utf-8');
}

function readZipEntryContent(zip, entry, password) {
    const localOffset = entry.localHeaderOffset;
    if (localOffset + 30 > zip.length || zip.readUInt32LE(localOffset) !== 0x04034b50) {
        throw new Error('invalid zip local header');
    }

    const localNameLength = zip.readUInt16LE(localOffset + 26);
    const localExtraLength = zip.readUInt16LE(localOffset + 28);
    const dataOffset = localOffset + 30 + localNameLength + localExtraLength;
    const dataEnd = dataOffset + entry.compressedSize;
    if (dataEnd > zip.length) {
        throw new Error('invalid zip entry size');
    }

    let compressed = zip.slice(dataOffset, dataEnd);
    if ((entry.flags & 0x0001) !== 0) {
        compressed = decryptZipCrypto(compressed, password, entry);
    }

    let content;
    if (entry.compressionMethod === 0) {
        content = compressed;
    } else if (entry.compressionMethod === 8) {
        content = zlib.inflateRawSync(compressed);
    } else if (entry.compressionMethod === 99) {
        throw new Error('unsupported zip aes encryption');
    } else {
        throw new Error(`unsupported zip compression method ${entry.compressionMethod}`);
    }

    if (entry.uncompressedSize !== content.length) {
        throw new Error('invalid zip entry size after inflate');
    }

    if (crc32Buffer(content) !== entry.crc32) {
        throw new Error('zip entry crc mismatch');
    }

    return content;
}

function decryptZipCrypto(encrypted, password, entry) {
    if (encrypted.length < 12) {
        throw new Error('invalid zip encrypted entry');
    }

    const keys = createZipCryptoKeys(password);
    const decrypted = Buffer.allocUnsafe(encrypted.length);

    for (let index = 0; index < encrypted.length; index += 1) {
        const plain = encrypted[index] ^ zipCryptoDecryptByte(keys);
        decrypted[index] = plain;
        updateZipCryptoKeys(keys, plain);
    }

    const checkByte = decrypted[11];
    const expected = [
        (entry.crc32 >>> 24) & 0xff,
        (entry.modifiedTime >>> 8) & 0xff
    ];
    if (!expected.includes(checkByte)) {
        throw new Error('bad zip password');
    }

    return decrypted.slice(12);
}

function createZipCryptoKeys(password) {
    const keys = [0x12345678, 0x23456789, 0x34567890];
    const bytes = Buffer.from(String(password || ''), 'utf-8');
    for (const byte of bytes) {
        updateZipCryptoKeys(keys, byte);
    }
    return keys;
}

function updateZipCryptoKeys(keys, byte) {
    keys[0] = crc32UpdateByte(keys[0], byte);
    keys[1] = (Math.imul((keys[1] + (keys[0] & 0xff)) >>> 0, 134775813) + 1) >>> 0;
    keys[2] = crc32UpdateByte(keys[2], keys[1] >>> 24);
}

function zipCryptoDecryptByte(keys) {
    const temp = (keys[2] | 2) >>> 0;
    return (Math.imul(temp, temp ^ 1) >>> 8) & 0xff;
}

function resolveSafeExtractPath(extractDir, entryName) {
    const normalizedName = String(entryName || '')
        .replace(/\\/g, '/')
        .replace(/^[A-Za-z]:/, '')
        .replace(/^\/+/, '');
    if (!normalizedName || normalizedName.includes('\0')) return '';

    const outputPath = path.resolve(extractDir, normalizedName);
    const root = path.resolve(extractDir);
    if (outputPath !== root && !outputPath.startsWith(root + path.sep)) {
        throw new Error('zip entry outside target directory');
    }
    return outputPath;
}

function getCrcTable() {
    if (crcTable) return crcTable;
    crcTable = new Uint32Array(256);
    for (let index = 0; index < 256; index += 1) {
        let value = index;
        for (let bit = 0; bit < 8; bit += 1) {
            value = (value & 1) ? (0xedb88320 ^ (value >>> 1)) : (value >>> 1);
        }
        crcTable[index] = value >>> 0;
    }
    return crcTable;
}

function crc32UpdateByte(crc, byte) {
    const table = getCrcTable();
    return ((crc >>> 8) ^ table[(crc ^ byte) & 0xff]) >>> 0;
}

function crc32Buffer(buffer) {
    let crc = 0xffffffff;
    for (const byte of buffer) {
        crc = crc32UpdateByte(crc, byte);
    }
    return (crc ^ 0xffffffff) >>> 0;
}

function extractZipWithPythonPassword(zipPath, extractDir) {
    const script = [
        'import pathlib, sys, zipfile',
        'zip_path = pathlib.Path(sys.argv[1])',
        'extract_dir = pathlib.Path(sys.argv[2])',
        'password = sys.argv[3].encode("utf-8")',
        'with zipfile.ZipFile(zip_path) as archive:',
        '    archive.extractall(extract_dir, pwd=password)'
    ].join('\n');

    for (const python of ['python', 'py']) {
        try {
            execFileSync(python, ['-c', script, zipPath, extractDir, NOVELESS_ZIP_PASSWORD], {
                stdio: 'pipe',
                timeout: 60000,
                encoding: 'utf-8'
            });
            return true;
        } catch (error) {
            if (error?.code !== 'ENOENT') return false;
        }
    }
    return false;
}

function resolve7ZipExecutable() {
    const candidates = [
        '7z',
        '7zz',
        '7za',
        path.join(__dirname, '..', 'tools', '7zip', '7z.exe'),
        path.join(__dirname, '..', 'tools', '7za.exe'),
        'C:\\Program Files\\7-Zip\\7z.exe',
        'C:\\Program Files (x86)\\7-Zip\\7z.exe'
    ];

    for (const candidate of candidates) {
        try {
            execFileSync(candidate, ['i'], { stdio: 'ignore', timeout: 3000 });
            return candidate;
        } catch (error) { }
    }
    return '';
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
