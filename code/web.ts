import {RawArticle, ArticleInfo, parse, populate} from "./parser.js";

function uiMessage(type: string, msg: string): void {
    console.log(msg);
}

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

function getArticlePathFromQString(): string | undefined {
    const urlParams = new URLSearchParams(window.location.search);
    const param = urlParams.get('article');
    if(param === null) {
        return undefined;
    }
    const fpath = articlesMap[param];
    if(fpath === undefined) {
        throw new Error(`article ${param} not found`);
    }
    const ext = getExt(fpath);
    if(ext !== 'html' && ext !== 'csv') {
        throw new Error(`file extension ${ext} is unsupported`);
    }
    return fpath;
}

async function fetchRawArticleFromPath(fpath: string): Promise<RawArticle> {
    const response = await fetch(fpath);
    if(!response.ok) {
        throw new Error(`fetch failed. status: ${response.status}, path: ${fpath}`);
    }
    const text = await response.text();
    const ext = getExt(fpath);
    return {ext: ext, text: text};
}

function loadArticle(articleInfo: ArticleInfo): void {
    const mainElem = document.getElementById('main')!;
    if(articleInfo.defaultLang) {
        populate(articleInfo, articleInfo.defaultLang);
    }
    console.log(articleInfo);
    mainElem.appendChild(articleInfo.root);
}

async function main(): Promise<void> {
    try {
        const fpath = getArticlePathFromQString();
        if(fpath !== undefined) {
            const rawArticle = await fetchRawArticleFromPath(fpath);
            const articleInfo = parse(rawArticle);
            loadArticle(articleInfo);
        }
    } catch (e) {
        if(e instanceof Error) {
            uiMessage('danger', e.message);
        }
        throw e;
    }
}

await main();
