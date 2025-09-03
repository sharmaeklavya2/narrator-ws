import {RawArticle, ArticleInfo, parseArticle, populate} from "./parser.js";
import * as fetchers from "./fetchers.js";

//=[ Interfaces and global variables ]==========================================

type Status = 'danger' | 'warning' | 'success';
type SpeechPolicy = 'on-demand' | 'proactive' | 'continuous';
const speechPolicyValues: SpeechPolicy[] = ['on-demand', 'proactive', 'continuous'];

interface Settings {
    srcLang: string;
    trnLangOrder: string[];
    voice?: SpeechSynthesisVoice;
    speechPolicy: SpeechPolicy;
    voiceSpeed: number;
}

interface State {
    currSent: number;
    speaking: boolean;
    speakingSent?: number;
}

interface Globals {
    menuSwitcher?: MenuSwitcher;
    articleInfo?: ArticleInfo;
    settings?: Settings;
    state?: State;
    voices?: SpeechSynthesisVoice[];
    voicesByLang?: Map<string, SpeechSynthesisVoice[]>;
}

interface LangInfo {
    code: string;
    name: string;
    group?: string;
    nativeName?: string;
}

const langsInfo: LangInfo[] = [
{"code":"en", "name": "English"},

{"code":"bn", "group": "Indian", "name":"Bengali", "nativeName":"বাংলা"},
{"code":"gu", "group": "Indian", "name":"Gujarati", "nativeName":"ગુજરાતી"},
{"code":"hi", "group": "Indian", "name":"Hindi", "nativeName":"हिंदी"},
{"code":"kn", "group": "Indian", "name":"Kannada", "nativeName":"ಕನ್ನಡ"},
{"code":"ml", "group": "Indian", "name":"Malayalam", "nativeName":"മലയാളം"},
{"code":"mr", "group": "Indian", "name":"Marathi", "nativeName":"मराठी"},
{"code":"or", "group": "Indian", "name":"Oriya", "nativeName":"ଓଡ଼ିଆ"},
{"code":"pa", "group": "Indian", "name":"Punjabi", "nativeName":"ਪੰਜਾਬੀ"},
{"code":"sa", "group": "Indian", "name":"Sanskrit", "nativeName":"संस्कृतम्"},
{"code":"ta", "group": "Indian", "name":"Tamil", "nativeName":"தமிழ்"},
{"code":"te", "group": "Indian", "name":"Telugu", "nativeName":"తెలుగు"},

{"code":"fr", "group": "European", "name":"French", "nativeName":"Français"},
{"code":"de", "group": "European", "name":"German", "nativeName":"Deutsch"},
{"code":"it", "group": "European", "name":"Italian", "nativeName":"Italiano"},
{"code":"es", "group": "European", "name":"Spanish", "nativeName":"Español"},

{"code":"zh", "group": "East Asian", "name":"Chinese", "nativeName":"中文"},
{"code":"ja", "group": "East Asian", "name":"Japanese", "nativeName":"日本語"},
{"code":"ko", "group": "East Asian", "name":"Korean", "nativeName":"한국어"}
];

function getLangLabel(langInfo: LangInfo): string {
    if(langInfo.nativeName) {
        return `${langInfo.name} (${langInfo.nativeName})`;
    }
    else {
        return langInfo.name;
    }
}

const langNames = new Map(langsInfo.map((x) => [x.code, getLangLabel(x)]));

const globals: Globals = {};
// @ts-ignore
window.globals = globals;

//=[ Error reporting ]==========================================================

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

//=[ Before loading an article ]================================================

class MenuSwitcher {
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

function deployMenuSwitcher(): void {
    const menuSwitcher = new MenuSwitcher();
    globals.menuSwitcher = menuSwitcher;
    menuSwitcher.add('edit-menu');
    menuSwitcher.add('text-settings-menu');
    menuSwitcher.add('voice-settings-menu');
    menuSwitcher.add('about-menu');

    function hideMenus(): void {menuSwitcher.hide();}

    document.getElementById('modal-overlay')!.addEventListener('click', hideMenus);
    for(const [id, elem] of menuSwitcher.menus.entries()) {
        const closeBtn = elem.firstElementChild!.lastElementChild!;
        closeBtn.addEventListener('click', hideMenus);
    }

    document.getElementById('button-text-settings')!.addEventListener('click',
        () => menuSwitcher.show('text-settings-menu'));
    document.getElementById('button-voice-settings')!.addEventListener('click',
        () => menuSwitcher.show('voice-settings-menu'));
    document.getElementById('button-about')!.addEventListener('click',
        () => menuSwitcher.show('about-menu'));
    document.getElementById('button-edit')!.addEventListener('click',
        () => menuSwitcher.show('edit-menu'));
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

function setupFileLoaders(): void {
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

    const editLangSelect = document.getElementById('edit-lang') as HTMLElement;
    let prevLangGroup: string | undefined, optGroup: HTMLElement | undefined;
    for(const langInfo of langsInfo) {
        const optionElem = document.createElement('option');
        optionElem.setAttribute('value', langInfo.code);
        optionElem.innerText = getLangLabel(langInfo);
        if(langInfo.group) {
            if(langInfo.group !== prevLangGroup) {
                optGroup = document.createElement('optgroup');
                optGroup.setAttribute('label', langInfo.group);
                editLangSelect.appendChild(optGroup);
            }
            optGroup!.appendChild(optionElem);
        }
        else {
            editLangSelect.appendChild(optionElem);
        }
        prevLangGroup = langInfo.group;
    }

    const editForm = document.getElementById('edit-form') as HTMLFormElement;
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
            globals.menuSwitcher!.hide();
        }
        catch (e) {
            logError(e);
        }
    });
}

//=[ After loading an article ]=================================================

function deleteFromArray(a: string[], x?: string) {
    if(x !== undefined) {
        const i = a.indexOf(x);
        if(i !== -1) {
            a.splice(i, 1);
        }
    }
}

function getSpeechPolicy(): SpeechPolicy {
    for(const speechPolicy of speechPolicyValues) {
        const elem = document.getElementById('sp-' + speechPolicy) as HTMLInputElement;
        if(elem.checked) {
            return speechPolicy;
        }
    }
    throw new Error('No speech policy is selected.');
}

function voiceDescription(voice: SpeechSynthesisVoice): string {
    const locality = voice.localService ? 'local' : 'remote';
    return `${voice.name} (${voice.lang}, ${locality})`;
}

function setVoice(): void {
    if(globals.voicesByLang !== undefined && globals.settings !== undefined) {
        const voiceList = globals.voicesByLang.get(globals.settings.srcLang);
        const playButton = document.getElementById('button-play')!;
        const voiceSettingsButton = document.getElementById('button-voice-settings')!;
        const voiceInfoElem = document.getElementById('voice-info')!;
        if(voiceList !== undefined && voiceList.length > 0) {
            const voice = voiceList[0];
            globals.settings.voice = voice;
            voiceInfoElem.innerText = voiceDescription(voice);
            playButton.onclick = (() => playButtonClick());
            playButton.removeAttribute('disabled');
            voiceSettingsButton.removeAttribute('disabled');
        }
        else {
            globals.settings.voice = undefined;
            voiceInfoElem.innerText = '';
            playButton.onclick = null;
            playButton.setAttribute('disabled', '');
            voiceSettingsButton.setAttribute('disabled', '');
        }
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
        document.getElementById('button-prev')!.onclick = () => showSentence('-');
        document.getElementById('button-next')!.onclick = () => showSentence('+');
        window.addEventListener('keydown', keyHandler);
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
        if(langNames.get(preferredLang) === undefined) {
            uiMessage('warning', `Unrecognized language ${preferredLang}.`);
        }
        const fails = populate(articleInfo, preferredLang);
        if(fails > 0) {
            uiMessage('warning', `${fails} sentences missing in lang ${preferredLang}.`);
        }
    }
    const voiceSpeedElem = document.getElementById('voice-speed') as HTMLInputElement;
    const voiceSpeed = Number(voiceSpeedElem.value);
    globals.settings = {srcLang: preferredLang, trnLangOrder: Array.from(articleInfo.langs),
        speechPolicy: getSpeechPolicy(), voiceSpeed: voiceSpeed};
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

function loadTextSettingsMenu(settings: Settings): void {
    const srcLang = settings.srcLang;
    document.getElementById('src-lang')!.innerText = langNames.get(srcLang) ?? srcLang;
    const trnLangOrder = settings.trnLangOrder;
    const olElem = document.getElementById('trn-lang-list')!;
    olElem.replaceChildren();
    let i = 0;
    for(const trnLang of trnLangOrder) {
        const liElem = document.createElement('li');
        liElem.dataset.lang = trnLang;
        liElem.dataset.rank = '' + i;
        liElem.innerText = langNames.get(trnLang) ?? trnLang;
        olElem.appendChild(liElem);
        i++;
    }
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

    if(globals.settings!.speechPolicy !== 'on-demand') {
        playButtonClick(true);
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
    if(globals.menuSwitcher && globals.menuSwitcher.selected) {
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

function getCurrentUtterance(): SpeechSynthesisUtterance | undefined {
    if(globals.settings !== undefined && globals.settings.voice !== undefined) {
        const lang = globals.settings.srcLang;
        const sentId = globals.state!.currSent;
        const text = globals.articleInfo!.kids[sentId][lang].innerText;
        const voice = globals.settings.voice;

        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = lang;
        utterance.voice = voice;
        utterance.rate = globals.settings.voiceSpeed;
        utterance.addEventListener('error', (ev) => uiMessage('danger', `Speech error code ${ev.error}.`));
        utterance.addEventListener('end', (ev) => {
            console.debug(`Playback of sentence ${sentId} ended.`);
            if(!speechSynthesis.pending && !speechSynthesis.speaking) {
                globals.state!.speaking = false;
                globals.state!.speakingSent = undefined;
                document.getElementById('button-play')!.dataset.state = 'paused';
                if(globals.settings!.speechPolicy === 'continuous') {
                    showSentence('+');
                }
            }
        });
        return utterance;
    }
}

function playButtonClick(force: boolean = false): void {
    // force means cancel current speech (if speaking) and start speaking afresh
    if(globals.state !== undefined && globals.settings!.voice !== undefined) {
        const speaking = speechSynthesis.speaking && !speechSynthesis.paused;
        const paused = speechSynthesis.speaking && speechSynthesis.paused;
        const stopped = !speechSynthesis.speaking;
        const sentenceChanged = force || (globals.state.speakingSent !== undefined && globals.state.speakingSent !== globals.state.currSent);
        if(Number(speaking) + Number(paused) + Number(stopped) !== 1) {
            throw new Error(`Invalid speech state encountered: ss.speaking=${speechSynthesis.speaking}, ss.paused=${speechSynthesis.paused}, ss.pending=${speechSynthesis.pending}.`);
        }
        const playButton = document.getElementById('button-play')!;

        /* This table explains the 9 possibilities and the action to take in each.
         *                          |   speaking   |    paused    | stopped |
         * ------------------------------------------------------------------
         *          force           | cancel+speak | cancel+speak |  speak  |
         * !force & sentenceChanged |    pause     | cancel+speak |  speak  |
         *     !sentenceChanged     |    pause     |    resume    |  speak  |
         */
        if(!force && speaking) {
            speechSynthesis.pause();
            globals.state.speaking = false;
            playButton.dataset.state = 'paused';
        }
        else {
            const cancelCondition = speaking || (paused && sentenceChanged);
            if(cancelCondition) {
                console.debug(`canceling speech of sentence ${globals.state.speakingSent}.`);
                speechSynthesis.cancel();
            }
            else if(paused) {
                speechSynthesis.resume();
            }
            if(cancelCondition || stopped) {
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

function setupMenuListeners(): void {
    document.getElementById('trn-lang-list')!.addEventListener('click', trnLangClickHandler);

    const voiceSpeedElem = document.getElementById('voice-speed')!;
    const voiceSpeedNumber = document.getElementById('voice-speed-number')!;
    voiceSpeedElem.addEventListener('input', (ev) => {
        const voiceSpeedText = (ev.currentTarget as HTMLInputElement).value;
        voiceSpeedNumber.innerText = voiceSpeedText;
        if(globals.settings !== undefined) {
            globals.settings.voiceSpeed = Number(voiceSpeedText);
        }
    });

    document.getElementById('speech-policy-group')!.addEventListener('change', (ev: Event) => {
        if(globals.settings) {
            globals.settings.speechPolicy = getSpeechPolicy();
        }
    });
}

//=[ main ]=====================================================================

function setEventHandlers(): void {
    if(typeof speechSynthesis !== "undefined") {
        speechSynthesis.onvoiceschanged = registerVoices;
        setTimeout(registerVoices, 0);
    }
    else {
        console.log('speech unavailable');
    }
    document.getElementById('spotlight-collapse-btn')!.addEventListener('click',
        (ev) => {(ev.currentTarget as HTMLElement).parentElement!.classList.toggle('collapsed');});

    deployMenuSwitcher();
    setupFileLoaders();
    setupMenuListeners();
}

function main(): void {
    try {
        setEventHandlers();
        const path = fetchers.getArticlePathFromQString();
        if(path !== undefined) {
            fetchers.fetchRawArticleFromUrl(path)
                .then(parseArticle).then(loadArticle).catch(logError);
        }
    } catch (e) {
        logError(e);
    }
}

main();
