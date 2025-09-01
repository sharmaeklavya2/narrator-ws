import articleEntries from "articleEntries.json" with { type: "json" };
;
const idToArticleEntry = new Map(articleEntries.map(ba => [ba.id, ba]));
const validExtSet = new Set(['html', 'csv', 'tsv', 'txt']);
export function getArticleEntryFromQString(location) {
    const urlParams = new URLSearchParams(location.search);
    const param = urlParams.get('article');
    if (param === null || param === '') {
        return undefined;
    }
    const ae = idToArticleEntry.get(param);
    if (ae === undefined) {
        throw new Error(`Article ${param} not found.`);
    }
    return ae;
}
export async function fetchRawArticleFromId(id) {
    const ae = idToArticleEntry.get(id);
    if (ae === undefined) {
        throw new Error(`Article with ID ${id} not found.`);
    }
    else {
        const rawArticle = await fetchRawArticleFromUrl(ae.path, true);
        rawArticle.id = id;
        return rawArticle;
    }
}
function getExt(fname) {
    const i = fname.lastIndexOf('.');
    if (i === -1) {
        return undefined;
    }
    return fname.slice(i + 1).toLowerCase();
}
export async function fetchRawArticleFromUrl(path, trust) {
    const response = await fetch(path);
    if (!response.ok) {
        throw new Error(`Fetch failed. status: ${response.status}, path: ${path}.`);
    }
    const text = await response.text();
    const ext = getExt(path);
    const lang = ext === 'txt' ? getExt(path.slice(0, path.length - 4)) : undefined;
    return { ext: ext, text: text, trust: trust, lang: lang };
}
export async function fetchRawArticleFromFile(file) {
    const ext = getExt(file.name);
    if (ext === undefined || !validExtSet.has(ext)) {
        throw new Error(`File extension ${ext} is unsupported.`);
    }
    const text = await file.text();
    return { ext: ext, text: text, trust: false };
}
export function getFileFromList(files) {
    if (files === null || files === undefined || files.length === 0) {
        throw new Error('Received empty file list.');
    }
    else if (files.length > 1) {
        throw new Error(`Received ${files.length} files.`);
    }
    const file = files.item(0);
    if (file === null) {
        throw new Error('Received a null file.');
    }
    return file;
}
//# sourceMappingURL=fetchers.js.map