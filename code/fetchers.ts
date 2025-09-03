import {RawArticle, ArticleInfo} from "./parser.js";

const articlesMap: Record<string, string> = {
    'ict-20': 'articles/ict/l20.html',
    'sk1-02-sahakaara': 'articles/sk1/02-sahakaara.csv',
    'lipsum': 'articles/lipsum.txt',
};

function getExt(fname: string): string | undefined {
    const i = fname.lastIndexOf('.');
    if (i === -1) {
        return undefined;
    }
    return fname.slice(i+1).toLowerCase();
}

const validExtSet = new Set(['html', 'csv', 'tsv', 'txt']);

export function getArticlePathFromQString(): string | undefined {
    const urlParams = new URLSearchParams(window.location.search);
    const param = urlParams.get('article');
    if(param === null) {
        return undefined;
    }
    const path = articlesMap[param];
    if(path === undefined) {
        throw new Error(`Article ${param} not found.`);
    }
    const ext = getExt(path);
    if(ext === undefined || !validExtSet.has(ext)) {
        throw new Error(`File extension ${ext} is unsupported.`);
    }
    return path;
}

export async function fetchRawArticleFromUrl(path: string): Promise<RawArticle> {
    const response = await fetch(path);
    if(!response.ok) {
        throw new Error(`Fetch failed. status: ${response.status}, path: ${path}.`);
    }
    const text = await response.text();
    const ext = getExt(path);
    return {ext: ext, text: text};
}

export async function fetchRawArticleFromFile(file: File): Promise<RawArticle> {
    const ext = getExt(file.name);
    if(ext === undefined || !validExtSet.has(ext)) {
        throw new Error(`File extension ${ext} is unsupported.`);
    }
    const text = await file.text();
    return {ext: ext, text: text};
}

export function getFileFromList(files: FileList | null | undefined): File {
    if(files === null || files === undefined || files.length === 0) {
        throw new Error('Received empty file list.');
    }
    else if(files.length > 1) {
        throw new Error(`Received ${files.length} files.`);
    }
    const file = files.item(0);
    if(file === null) {
        throw new Error('Received a null file.');
    }
    return file;
}
