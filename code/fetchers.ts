import {RawArticle, ArticleInfo} from "./parser.js";

interface BuiltinArticle {
    id: string;
    path: string;
    label: string;
};

export const builtinArticles = [
    {id: 'ict-20', path: 'articles/ict/20.html', label: 'ICT Lesson 20'},
    {id: 'ict-33', path: 'articles/ict/33.html', label: 'ICT Lesson 33'},
    {id: 'sk1-02', path: 'articles/sk1/02.csv', label: 'SK1 Chapter 2'},
];

const builtinArticlesIdToPath = new Map(builtinArticles.map(ba => [ba.id, ba.path]));

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
    const path = builtinArticlesIdToPath.get(param);
    if(path === undefined) {
        throw new Error(`Article ${param} not found.`);
    }
    const ext = getExt(path);
    if(ext === undefined || !validExtSet.has(ext)) {
        throw new Error(`File extension ${ext} is unsupported.`);
    }
    return path;
}

export async function fetchBuiltinRawArticleFromId(id: string): Promise<RawArticle> {
    const path = builtinArticlesIdToPath.get(id);
    if(path === undefined) {
        throw new Error(`Article with ID ${id} not found.`);
    }
    else {
        return await fetchRawArticleFromUrl(path);
    }
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
