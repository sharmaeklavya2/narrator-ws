import {RawArticle, ArticleInfo, parseArticle, populate} from "./parser.js";
import * as fetchers from "./fetchers.js";

type Status = 'danger' | 'warning' | 'success';
let gArticleInfo: ArticleInfo | undefined = undefined;

const langNames = {
    'en': 'English',
    'te': 'Telugu',
    'hi': 'Hindi',
    'kn': 'Kannada',
}

function msgCloseBtnClickHandler(ev: Event): void {
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
        closeButton.addEventListener('click', msgCloseBtnClickHandler);
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
    mainElem.replaceChildren(articleInfo.root);
    enableButtons();
}

function enableButtons(): void {
    for(const btnName of ['prev', 'play', 'next', 'text-settings', 'voice-settings']) {
        const elem = document.getElementById('button-' + btnName)!;
        elem.removeAttribute('disabled');
    }
}

class MenuManager {
    menus: Map<string, HTMLElement>;
    selected: string | undefined;

    constructor() {
        this.menus = new Map();
        this.selected = undefined;
    }

    add(id: string): void {
        if(this.menus.has(id)) {
            throw new Error(`Attempt to re-add menu ${id}.`);
        }
        const elem = document.getElementById(id);
        if(elem === null) {
            throw new Error(`Could not find element with id ${id}.`);
        }
        this.menus.set(id, elem);
    }

    hide(): void {
        const id = this.selected;
        if(id !== undefined) {
            const elem = this.menus.get(id);
            elem!.classList.add('disabled');
        }
    }

    show(id: string): void {
        this.hide();
        const elem = this.menus.get(id);
        if(elem === undefined) {
            throw new Error(`Could not find element with id ${id}.`);
        }
        this.selected = id;
        elem.classList.remove('disabled');
    }
}

function setEventHandlers(): void {
    const fileLoaderElem = document.getElementById('file-loader')!;
    fileLoaderElem.addEventListener('change', function(ev: Event) {
            try {
                const files = (ev.currentTarget! as HTMLInputElement).files;
                const file = fetchers.getFileFromList(files);
                fetchers.fetchRawArticleFromFile(file)
                    .then(parseArticle).then(loadArticle).catch(logError);
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
                    .then(parseArticle).then(loadArticle).catch(logError);
            }
            catch(e) {
                logError(e);
            }
        }
    });

    const menuManager = new MenuManager();
    menuManager.add('text-settings-menu');
    menuManager.add('voice-settings-menu');
    menuManager.add('about-menu');

    function hideMenus(): void {menuManager.hide();}

    document.getElementById('modal-overlay')!.addEventListener('click', hideMenus);
    for(const [id, elem] of menuManager.menus.entries()) {
        console.log(id, elem);
        const closeBtn = elem.firstElementChild!.lastElementChild!;
        closeBtn.addEventListener('click', hideMenus);
    }

    document.getElementById('button-text-settings')!.addEventListener('click',
        () => menuManager.show('text-settings-menu'));
    document.getElementById('button-voice-settings')!.addEventListener('click',
        () => menuManager.show('voice-settings-menu'));
    document.getElementById('button-about')!.addEventListener('click',
        () => menuManager.show('about-menu'));
}

async function main(): Promise<void> {
    try {
        setEventHandlers();
        const fpath = fetchers.getArticlePathFromQString();
        if(fpath !== undefined) {
            const rawArticle = await fetchers.fetchRawArticleFromPath(fpath);
            const articleInfo = parseArticle(rawArticle);
            loadArticle(articleInfo);
        }
    } catch (e) {
        logError(e);
    }
}

await main();
