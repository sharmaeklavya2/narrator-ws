import {RawArticle, ArticleInfo, parse, populate} from "./parser.js";
import * as fetchers from "./fetchers.js";

type Status = 'danger' | 'warning' | 'success';
let gArticleInfo: ArticleInfo | undefined = undefined;

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

function logError(e: unknown): void {
    if(e instanceof Error) {
        uiMessage('danger', e.message);
    }
    throw e;
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
    console.debug(articleInfo);
    gArticleInfo = articleInfo;
    mainElem.appendChild(articleInfo.root);
    enableButtons();
}

function enableButtons(): void {
    for(const btnName of ['prev', 'play', 'next', 'text-settings', 'voice-settings']) {
        const elem = document.getElementById('button-' + btnName)!;
        elem.removeAttribute('disabled');
    }
}

function setEventHandlers(): void {
    const fileLoaderElem = document.getElementById('file-loader')!;
    fileLoaderElem.addEventListener('change', function(ev: Event) {
            try {
                const files = (ev.currentTarget! as HTMLInputElement).files;
                const file = fetchers.getFileFromList(files);
                fetchers.fetchRawArticleFromFile(file)
                    .then(parse).then(loadArticle).catch(logError);
            }
            catch(e) {
                logError(e);
            }
        });
    document.getElementById('button-open')!.addEventListener('click', function(ev: Event) {
            fileLoaderElem.click();
        });

    document.body.addEventListener('dragover', function(ev) {
            ev.stopPropagation();
            ev.preventDefault();
            if(ev.dataTransfer) {
                ev.dataTransfer.dropEffect = 'copy';
            }
        });
    document.body.addEventListener('dragstart', function(ev) {
        console.debug('dragstart', ev.target);
        ev.preventDefault();
        return false;
    });
    document.body.addEventListener('drop', function(ev) {
        ev.stopPropagation();
        ev.preventDefault();
        if(ev.dataTransfer) {
            ev.dataTransfer.dropEffect = 'copy';
            try {
                const file = fetchers.getFileFromList(ev.dataTransfer.files);
                fetchers.fetchRawArticleFromFile(file)
                    .then(parse).then(loadArticle).catch(logError);
            }
            catch(e) {
                logError(e);
            }
        }
    });
}

async function main(): Promise<void> {
    try {
        setEventHandlers();
        const fpath = fetchers.getArticlePathFromQString();
        if(fpath !== undefined) {
            const rawArticle = await fetchers.fetchRawArticleFromPath(fpath);
            const articleInfo = parse(rawArticle);
            loadArticle(articleInfo);
        }
    } catch (e) {
        logError(e);
    }
}

await main();
