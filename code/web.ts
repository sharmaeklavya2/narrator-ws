import {RawArticle, ArticleInfo, parse, populate} from "./parser.js";
import * as fetchers from "./fetchers.js";

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
        const fpath = fetchers.getArticlePathFromQString();
        if(fpath !== undefined) {
            const rawArticle = await fetchers.fetchRawArticleFromPath(fpath);
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
