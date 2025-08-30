import {RawArticle, ArticleInfo, parse, populate} from "./parser.js";

type Status = 'danger' | 'warning' | 'success';

function closeBtnClickHandler(ev: Event): void {
    let closeBtn = ev.currentTarget as HTMLElement;  // will always be a span.close-btn element
    let LiElem = closeBtn.parentElement!;
    let msgList = document.getElementById('msg-list')!;
    msgList.removeChild(LiElem);
}

function uiMessage(status: Status | undefined, text: string | string[]): void {
    let textArray;
    if(Array.isArray(text)) {
        textArray = text;
    }
    else {
        textArray = [text];
    }
    for(const text of textArray) {
        let liElem = document.createElement('li');
        if(status !== undefined) {
            liElem.classList.add(status);
        }
        let msgSpan = document.createElement('span');
        msgSpan.classList.add('msg-text');
        msgSpan.innerText = text;
        liElem.appendChild(msgSpan);
        let closeButton = document.createElement('span');
        closeButton.classList.add('close-btn');
        closeButton.addEventListener('click', closeBtnClickHandler);
        liElem.appendChild(closeButton);
        let msgList = document.getElementById('msg-list')!;
        msgList.appendChild(liElem);
    }
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
        throw new Error(`Article ${param} not found.`);
    }
    const ext = getExt(fpath);
    if(ext !== 'html' && ext !== 'csv') {
        throw new Error(`File extension ${ext} is unsupported.`);
    }
    return fpath;
}

async function fetchRawArticleFromPath(fpath: string): Promise<RawArticle> {
    const response = await fetch(fpath);
    if(!response.ok) {
        throw new Error(`Fetch failed. status: ${response.status}, path: ${fpath}.`);
    }
    const text = await response.text();
    const ext = getExt(fpath);
    return {ext: ext, text: text};
}

function loadArticle(articleInfo: ArticleInfo): void {
    if(articleInfo.warnings.length > 0) {
        for(const warning of articleInfo.warnings) {
            uiMessage('warning', warning.message);
        }
    }
    const mainElem = document.getElementById('main')!;
    if(articleInfo.defaultLang) {
        const fails = populate(articleInfo, articleInfo.defaultLang);
        if(fails > 0) {
            uiMessage('warning', `${fails} sentences missing in lang ${articleInfo.defaultLang}.`);
        }
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
