import {RawArticle, ArticleInfo, parseArticle, populate} from "./parser.js";
import * as fetchers from "./fetchers.js";

type Status = 'danger' | 'warning' | 'success';

const langNames: Record<string, string> = {
    'en': 'English',
    'te': 'Telugu',
    'hi': 'Hindi',
    'kn': 'Kannada',
}

interface Settings {
    srcLang: string;
    trnLangOrder: string[];
    voice?: SpeechSynthesisVoice;
}

interface State {
    currSent: number;
    speaking: boolean;
    speakingSent?: number;
}

interface Globals {
    menuManager?: MenuManager;
    articleInfo?: ArticleInfo;
    settings?: Settings;
    state?: State;
    voices?: SpeechSynthesisVoice[];
    voicesByLang?: Map<string, SpeechSynthesisVoice[]>;
}

const globals: Globals = {};
// @ts-ignore
window.globals = globals;

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

function deleteFromArray(a: string[], x?: string) {
    if(x !== undefined) {
        const i = a.indexOf(x);
        if(i !== -1) {
            a.splice(i, 1);
        }
    }
}

function loadArticle(articleInfo: ArticleInfo): void {
    if(articleInfo.warnings.length > 0) {
        for(const warning of articleInfo.warnings) {
            uiMessage('warning', warning.message);
        }
    }

    const firstLang = articleInfo.langs.size > 0 ? articleInfo.langs.values().next().value : undefined;
    const preferredLang = articleInfo.defaultLang || firstLang;
    if(preferredLang) {
        if(langNames[preferredLang] === undefined) {
            uiMessage('warning', `Unrecognized language ${preferredLang}.`);
        }
        const fails = populate(articleInfo, preferredLang);
        if(fails > 0) {
            uiMessage('warning', `${fails} sentences missing in lang ${preferredLang}.`);
        }
    }
    globals.settings = {srcLang: preferredLang, trnLangOrder: Array.from(articleInfo.langs)};
    deleteFromArray(globals.settings.trnLangOrder, preferredLang);
    loadTextSettingsMenu(globals.settings);

    console.debug(articleInfo);
    globals.articleInfo = articleInfo;
    const mainElem = document.getElementById('main')!;
    mainElem.replaceChildren(articleInfo.root);

    globals.state = {currSent: 0, speaking: false};
    if(articleInfo.sockets.length === 0) {
        uiMessage('warning', 'No tagged sentences found in article.');
    }
    else {
        articleInfo.sockets[0].classList.add('selected');
        showTrnInSpotlight(0);
    }

    for(const socket of articleInfo.sockets) {
        socket.addEventListener('click', function(ev: Event) {
            const sentId = Number(socket.dataset.sentId);
            showSentence(sentId);
        });
    }

    setVoice();
    enableButtons();
}

function showTrnInSpotlight(i: number) {
    const d = globals.articleInfo!.kids2[i];
    if(d === undefined) {
        console.warn(`showTrnInSpotlight: sentence ${i} doesn't exist.`);
        return;
    }
    const spotlightElem = document.getElementById('spotlight') as HTMLElement;
    spotlightElem.replaceChildren();
    for(const lang of globals.settings!.trnLangOrder) {
        const trnElem = d[lang];
        if(trnElem !== undefined) {
            spotlightElem.appendChild(trnElem);
            return;
        }
    }
}

function showSentence(j: number | '+' | '-'): void {
    const sockets = globals.articleInfo!.sockets;
    const i = globals.state!.currSent;
    if(j === '+') {
        if(i + 1 >= sockets.length) {
            return;
        }
        else {
            j = i + 1;
        }
    }
    else if(j === '-') {
        if(i === 0) {
            return;
        }
        else {
            j = i - 1;
        }
    }
    sockets[i].classList.remove('selected');
    sockets[j].classList.add('selected');
    globals.state!.currSent = j;
    sockets[j].scrollIntoView({'behavior': 'smooth', 'block': 'center', 'inline': 'nearest'});
    showTrnInSpotlight(j);
}

function loadTextSettingsMenu(settings: Settings): void {
    const srcLang = settings.srcLang;
    document.getElementById('src-lang')!.innerText = langNames[srcLang] ?? srcLang;
    const trnLangOrder = settings.trnLangOrder;
    const olElem = document.getElementById('trn-lang-list')!;
    olElem.replaceChildren();
    let i = 0;
    for(const trnLang of trnLangOrder) {
        const liElem = document.createElement('li');
        liElem.dataset.lang = trnLang;
        liElem.dataset.rank = '' + i;
        liElem.innerText = langNames[trnLang] ?? trnLang;
        olElem.appendChild(liElem);
        i++;
    }
}

function trnLangClickHandler(ev: Event): void {
    const trnLangOrder = globals.settings!.trnLangOrder;
    const liElem = ev.target! as HTMLElement;
    if(liElem.tagName === 'OL') {
        return;
    }
    const olElem = liElem.parentElement!;
    const trnLang = liElem.dataset.lang;
    const rank = Number(liElem.dataset.rank);
    if(trnLang !== trnLangOrder[rank]) {
        throw new Error("Assertion error: data-lang and data-rank don't match");
    }
    if(rank === 0) {
        return;
    }
    trnLangOrder[rank] = trnLangOrder[rank-1];
    trnLangOrder[rank-1] = trnLang;
    liElem.dataset.rank = '' + (rank - 1);
    (liElem.previousElementSibling as HTMLElement).dataset.rank = '' + rank;
    olElem.insertBefore(liElem, liElem.previousElementSibling);
    showTrnInSpotlight(globals.state!.currSent);
}

function keyHandler(ev: KeyboardEvent) {
    if(globals.menuManager && globals.menuManager.selected) {
        return;
    }
    if(ev.key === "ArrowRight") {
        showSentence('+');
        ev.preventDefault();
    }
    else if(ev.key === 'ArrowLeft') {
        showSentence('-');
        ev.preventDefault();
    }
    else if(ev.key === ' ') {
        playButtonClick();
        ev.preventDefault();
    }
}

function enableButtons(): void {
    let virgins = 0;
    for(const btnName of ['prev', 'next', 'text-settings']) {
        const elem = document.getElementById('button-' + btnName)!;
        if(elem.hasAttribute('disabled')) {
            virgins++;
        }
        elem.removeAttribute('disabled');
    }

    if(virgins) {
        document.getElementById('button-prev')!.addEventListener('click', () => showSentence('-'));
        document.getElementById('button-next')!.addEventListener('click', () => showSentence('+'));
        window.addEventListener('keydown', keyHandler);
    }

    const playButton = document.getElementById('button-play')!;
    const voiceSettingsButton = document.getElementById('button-voice-settings')!;
    if(globals.settings !== undefined && globals.settings.voice !== undefined) {
        playButton.onclick = playButtonClick;
        playButton.removeAttribute('disabled');
        voiceSettingsButton.removeAttribute('disabled');
    }
    else {
        playButton.onclick = null;
        playButton.setAttribute('disabled', '');
        voiceSettingsButton.setAttribute('disabled', '');
    }
}

function getCurrentUtterance(): SpeechSynthesisUtterance | undefined {
    if(globals.settings !== undefined && globals.settings.voice !== undefined) {
        const lang = globals.settings.srcLang;
        const sentId = globals.state!.currSent;
        const text = globals.articleInfo!.kids[sentId][lang].innerText;
        const voice = globals.settings.voice;
        const voiceSpeedElem = document.getElementById('voice-speed') as HTMLInputElement;

        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = lang;
        utterance.voice = voice;
        utterance.rate = Number(voiceSpeedElem.value);
        utterance.addEventListener('error', (ev) => uiMessage('danger', `Speech error code ${ev.error}.`));
        utterance.addEventListener('end', (ev) => {
            console.debug(`Playback of sentence ${sentId} ended.`);
            if(!speechSynthesis.pending && !speechSynthesis.speaking) {
                globals.state!.speaking = false;
                globals.state!.speakingSent = undefined;
                document.getElementById('button-play')!.dataset.state = 'paused';
            }
        });
        return utterance;
    }
}

function playButtonClick(): void {
    if(globals.state !== undefined && globals.settings!.voice !== undefined) {
        const playButton = document.getElementById('button-play')!;
        if(speechSynthesis.speaking && !speechSynthesis.paused) {
            speechSynthesis.pause();
            globals.state.speaking = false;
            playButton.dataset.state = 'paused';
        }
        else {
            if(speechSynthesis.speaking && speechSynthesis.paused) {  // paused
                if(globals.state.speakingSent === globals.state.currSent) {
                    speechSynthesis.resume();
                }
                else {
                    console.debug(`cancelling speech of sentence ${globals.state.speakingSent}.`);
                    speechSynthesis.cancel();
                    const utterance = getCurrentUtterance()!;
                    speechSynthesis.speak(utterance);
                    console.debug(`Initiated speaking sentence ${globals.state.currSent}.`);
                }
            }
            else {  // stopped
                const utterance = getCurrentUtterance()!;
                speechSynthesis.speak(utterance);
                console.debug(`Initiated speaking sentence ${globals.state.currSent}.`);
            }
            globals.state.speakingSent = globals.state.currSent;
            globals.state.speaking = true;
            playButton.dataset.state = 'playing';
        }
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
            this.selected = undefined;
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
    globals.menuManager = menuManager;
    menuManager.add('edit-menu');
    menuManager.add('text-settings-menu');
    menuManager.add('voice-settings-menu');
    menuManager.add('about-menu');

    function hideMenus(): void {menuManager.hide();}

    document.getElementById('modal-overlay')!.addEventListener('click', hideMenus);
    for(const [id, elem] of menuManager.menus.entries()) {
        const closeBtn = elem.firstElementChild!.lastElementChild!;
        closeBtn.addEventListener('click', hideMenus);
    }

    document.getElementById('button-text-settings')!.addEventListener('click',
        () => menuManager.show('text-settings-menu'));
    document.getElementById('button-voice-settings')!.addEventListener('click',
        () => menuManager.show('voice-settings-menu'));
    document.getElementById('button-about')!.addEventListener('click',
        () => menuManager.show('about-menu'));
    document.getElementById('button-edit')!.addEventListener('click',
        () => menuManager.show('edit-menu'));

    document.getElementById('trn-lang-list')!.addEventListener('click', trnLangClickHandler);

    const voiceSpeedElem = document.getElementById('voice-speed')!;
    const voiceSpeedNumber = document.getElementById('voice-speed-number')!;
    voiceSpeedElem.addEventListener('input', (ev) => {
            voiceSpeedNumber.innerText = (ev.currentTarget as HTMLInputElement).value;
        });

    const editForm = document.getElementById('edit-form') as HTMLFormElement;
    const editLangSelect = document.getElementById('edit-lang') as HTMLElement;
    for(const [lang, langName] of Object.entries(langNames)) {
        const optionElem = document.createElement('option');
        optionElem.setAttribute('value', lang);
        optionElem.innerText = langName;
        editLangSelect.appendChild(optionElem);
    }
    editForm.addEventListener('submit', (ev) => {
        ev.preventDefault();
        try {
            const formData = new FormData(editForm);
            const rawArticle = {'ext': 'txt',
                'lang': formData.get('edit-lang') as string,
                'text': formData.get('edit-text') as string};
            const article = parseArticle(rawArticle);
            console.log(rawArticle);
            loadArticle(article);
        }
        catch (e) {
            logError(e);
        }
    });
}

function setVoice(): void {
    if(globals.voicesByLang !== undefined && globals.settings !== undefined) {
        const voiceList = globals.voicesByLang.get(globals.settings.srcLang);
        if(voiceList !== undefined && voiceList.length > 0) {
            const voice = voiceList[0];
            globals.settings.voice = voice;
            const voiceInfoElem = document.getElementById('voice-info')!;
            voiceInfoElem.innerText = `${voice.name} (${voice.lang})`;
        }
    }
}

function registerVoices(): void {
    if(globals.voicesByLang === undefined || globals.voicesByLang.size === 0) {
        const voices = speechSynthesis.getVoices();
        const voicesByLang = new Map<string, SpeechSynthesisVoice[]>();
        for(const voice of voices) {
            const lang = voice.lang.slice(0, 2);
            const voiceList = voicesByLang.get(lang);
            if(voiceList === undefined) {
                voicesByLang.set(lang, [voice]);
            }
            else {
                voiceList.push(voice);
            }
        }
        for(const [lang, voiceList] of voicesByLang.entries()) {
            const defaultVoices = voiceList.filter(voice => voice.default);
            const nonDefaultVoices = voiceList.filter(voice => !voice.default);
            voiceList.length = 0;
            voiceList.push(...defaultVoices, ...nonDefaultVoices);
        }
        globals.voicesByLang = voicesByLang;
        setVoice();
    }
}

async function main(): Promise<void> {
    try {
        if(typeof speechSynthesis !== "undefined") {
            speechSynthesis.onvoiceschanged = registerVoices;
            setTimeout(registerVoices, 0);
        }
        else {
            console.log('speech unavailable');
        }
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
