;
export const articleEntries = [
    { id: 'ict-20', path: 'articles/ict/20.html', label: 'ICT Lesson 20' },
    { id: 'ict-33', path: 'articles/ict/33.html', label: 'ICT Lesson 33' },
    { id: 'sk1-02', path: 'articles/sk1/02.csv', label: 'SK1 Chapter 2' },
    { id: 'clarinette', path: 'articles/clarinette.fr.txt',
        label: "J'ai perdue le do de ma clarinette" },
];
const idToArticleEntry = new Map(articleEntries.map(ba => [ba.id, ba]));
const validExtSet = new Set(['html', 'csv', 'tsv', 'txt']);
export function getArticleEntryFromQString() {
    const urlParams = new URLSearchParams(window.location.search);
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