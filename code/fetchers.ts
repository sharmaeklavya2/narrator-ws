import {RawArticle, ArticleInfo} from "./parser.js";

const articlesMap: Record<string, string> = {
    'ict20': 'articles/ict/l20.html',
};

function getExt(fname: string): string | undefined {
    const i = fname.lastIndexOf('.');
    if (i === -1) {
        return undefined;
    }
    return fname.slice(i+1).toLowerCase();
}

export function getArticlePathFromQString(): string | undefined {
    const urlParams = new URLSearchParams(window.location.search);
    const param = urlParams.get('article');
    if(param === null) {
        return undefined;
    }
    const fpath = articlesMap[param];
    if(fpath === undefined) {
        throw new Error(`Article ${param} not found.`);
    }
    const ext = getExt(fpath);
    if(ext !== 'html' && ext !== 'csv') {
        throw new Error(`File extension ${ext} is unsupported.`);
    }
    return fpath;
}

export async function fetchRawArticleFromPath(fpath: string): Promise<RawArticle> {
    const response = await fetch(fpath);
    if(!response.ok) {
        throw new Error(`Fetch failed. status: ${response.status}, path: ${fpath}.`);
    }
    const text = await response.text();
    const ext = getExt(fpath);
    return {ext: ext, text: text};
}
