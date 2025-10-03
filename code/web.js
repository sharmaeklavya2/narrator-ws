import { parseArticle, populate } from "./parser.js";
import { scriptsInfo } from "./trin.js";
import { buildScaffolding, trinAll } from "./trinUI.js";
import { getFileFromList, fetchRawArticleFromFile, articleEntries, fetchRawArticleFromId, getArticleEntryFromQString, fetchRawArticleFromUrl } from "./fetchers.js";
const defaultNTrnLangs = 2;
const speechPolicyValues = ['on-demand', 'proactive', 'continuous'];
const langsInfo = [
    { "code": "en", "name": "English" },
    { "code": "bn", "group": "Indian", "name": "Bengali", "nativeName": "বাংলা" },
    { "code": "gu", "group": "Indian", "name": "Gujarati", "nativeName": "ગુજરાતી" },
    { "code": "hi", "group": "Indian", "name": "Hindi", "nativeName": "हिंदी" },
    { "code": "kn", "group": "Indian", "name": "Kannada", "nativeName": "ಕನ್ನಡ" },
    { "code": "ml", "group": "Indian", "name": "Malayalam", "nativeName": "മലയാളം" },
    { "code": "mr", "group": "Indian", "name": "Marathi", "nativeName": "मराठी" },
    { "code": "or", "group": "Indian", "name": "Oriya", "nativeName": "ଓଡ଼ିଆ" },
    { "code": "pa", "group": "Indian", "name": "Punjabi", "nativeName": "ਪੰਜਾਬੀ" },
    { "code": "sa", "group": "Indian", "name": "Sanskrit", "nativeName": "संस्कृतम्" },
    { "code": "ta", "group": "Indian", "name": "Tamil", "nativeName": "தமிழ்" },
    { "code": "te", "group": "Indian", "name": "Telugu", "nativeName": "తెలుగు" },
    { "code": "fr", "group": "European", "name": "French", "nativeName": "Français" },
    { "code": "de", "group": "European", "name": "German", "nativeName": "Deutsch" },
    { "code": "it", "group": "European", "name": "Italian", "nativeName": "Italiano" },
    { "code": "es", "group": "European", "name": "Spanish", "nativeName": "Español" },
    { "code": "zh", "group": "East Asian", "name": "Chinese", "nativeName": "中文" },
    { "code": "ja", "group": "East Asian", "name": "Japanese", "nativeName": "日本語" },
    { "code": "ko", "group": "East Asian", "name": "Korean", "nativeName": "한국어" }
];
function getLangLabel(langInfo) {
    if (langInfo.nativeName) {
        return `${langInfo.name} (${langInfo.nativeName})`;
    }
    else {
        return langInfo.name;
    }
}
const langNames = new Map(langsInfo.map((x) => [x.code, getLangLabel(x)]));
const globals = {};
// @ts-ignore
window.globals = globals;
//=[ Error reporting ]==========================================================
function msgCloseBtnClickHandler(ev) {
    let closeBtn = ev.currentTarget; // will always be a span.close-btn element
    let LiElem = closeBtn.parentElement;
    let msgList = document.getElementById('msg-list');
    msgList.removeChild(LiElem);
}
function uiMessage(status, text) {
    let textArray;
    if (Array.isArray(text)) {
        textArray = text;
    }
    else {
        textArray = [text];
    }
    for (const text of textArray) {
        let liElem = document.createElement('li');
        if (status !== undefined) {
            liElem.classList.add(status);
        }
        let msgSpan = document.createElement('span');
        msgSpan.classList.add('msg-text');
        msgSpan.textContent = text;
        liElem.appendChild(msgSpan);
        let closeButton = document.createElement('span');
        closeButton.classList.add('close-btn');
        closeButton.addEventListener('click', msgCloseBtnClickHandler);
        liElem.appendChild(closeButton);
        let msgList = document.getElementById('msg-list');
        msgList.appendChild(liElem);
    }
}
function logError(e) {
    if (e instanceof Error) {
        uiMessage('danger', e.message);
    }
    throw e;
}
//=[ Before loading an article ]================================================
class MenuSwitcher {
    menus;
    selected;
    constructor() {
        this.menus = new Map();
        this.selected = undefined;
    }
    add(id) {
        if (this.menus.has(id)) {
            throw new Error(`Attempt to re-add menu ${id}.`);
        }
        const elem = document.getElementById(id);
        if (elem === null) {
            throw new Error(`Could not find element with id ${id}.`);
        }
        this.menus.set(id, elem);
    }
    hide() {
        const id = this.selected;
        if (id !== undefined) {
            const elem = this.menus.get(id);
            elem.classList.add('disabled');
            this.selected = undefined;
        }
    }
    show(id) {
        this.hide();
        const elem = this.menus.get(id);
        if (elem === undefined) {
            throw new Error(`Could not find element with id ${id}.`);
        }
        this.selected = id;
        elem.classList.remove('disabled');
    }
}
function deployMenuSwitcher() {
    const menuSwitcher = new MenuSwitcher();
    globals.menuSwitcher = menuSwitcher;
    menuSwitcher.add('open-menu');
    menuSwitcher.add('enlist-menu');
    menuSwitcher.add('edit-menu');
    menuSwitcher.add('about-menu');
    menuSwitcher.add('text-settings-menu');
    menuSwitcher.add('voice-settings-menu');
    function hideMenus() { menuSwitcher.hide(); }
    document.getElementById('modal-overlay').addEventListener('click', hideMenus);
    for (const [id, elem] of menuSwitcher.menus.entries()) {
        const closeBtn = elem.firstElementChild.lastElementChild;
        closeBtn.addEventListener('click', hideMenus);
    }
    document.getElementById('button-text-settings').addEventListener('click', () => menuSwitcher.show('text-settings-menu'));
    document.getElementById('button-voice-settings').addEventListener('click', () => menuSwitcher.show('voice-settings-menu'));
    document.getElementById('button-about').addEventListener('click', () => menuSwitcher.show('about-menu'));
    document.getElementById('button-open').addEventListener('click', () => menuSwitcher.show('open-menu'));
    document.getElementById('button-enlist').addEventListener('click', () => menuSwitcher.show('enlist-menu'));
    document.getElementById('button-edit').addEventListener('click', () => menuSwitcher.show('edit-menu'));
    document.getElementById('enlist-back').addEventListener('click', () => menuSwitcher.show('open-menu'));
    document.getElementById('edit-back').addEventListener('click', () => menuSwitcher.show('open-menu'));
}
function registerVoices() {
    if (globals.voicesByLang === undefined || globals.voicesByLang.size === 0) {
        const voices = speechSynthesis.getVoices();
        const voicesByLang = new Map();
        for (const voice of voices) {
            const lang = voice.lang.slice(0, 2);
            const voiceList = voicesByLang.get(lang);
            if (voiceList === undefined) {
                voicesByLang.set(lang, [voice]);
            }
            else {
                voiceList.push(voice);
            }
        }
        for (const [lang, voiceList] of voicesByLang.entries()) {
            const defaultVoices = voiceList.filter(voice => voice.default);
            const nonDefaultVoices = voiceList.filter(voice => !voice.default);
            voiceList.length = 0;
            voiceList.push(...defaultVoices, ...nonDefaultVoices);
        }
        globals.voicesByLang = voicesByLang;
        setVoice();
    }
}
function setupFileLoaders() {
    const fileLoaderElem = document.getElementById('file-loader');
    fileLoaderElem.addEventListener('change', function (ev) {
        try {
            const files = ev.currentTarget.files;
            const file = getFileFromList(files);
            fetchRawArticleFromFile(file)
                .then(parseArticle).then(loadArticle).catch(logError);
        }
        catch (e) {
            logError(e);
        }
    });
    document.getElementById('button-upload').addEventListener('click', function (ev) {
        fileLoaderElem.click();
    });
    document.body.addEventListener('dragover', function (ev) {
        ev.stopPropagation();
        ev.preventDefault();
        if (ev.dataTransfer) {
            ev.dataTransfer.dropEffect = 'copy';
        }
    });
    document.body.addEventListener('dragstart', function (ev) {
        console.debug('dragstart', ev.target);
        ev.preventDefault();
        return false;
    });
    document.body.addEventListener('drop', function (ev) {
        ev.stopPropagation();
        ev.preventDefault();
        if (ev.dataTransfer) {
            ev.dataTransfer.dropEffect = 'copy';
            try {
                const file = getFileFromList(ev.dataTransfer.files);
                fetchRawArticleFromFile(file)
                    .then(parseArticle).then(loadArticle).catch(logError);
            }
            catch (e) {
                logError(e);
            }
        }
    });
    const editLangSelect = document.getElementById('edit-lang');
    let prevLangGroup, optGroup;
    for (const langInfo of langsInfo) {
        const optionElem = document.createElement('option');
        optionElem.setAttribute('value', langInfo.code);
        optionElem.textContent = getLangLabel(langInfo);
        if (langInfo.group) {
            if (langInfo.group !== prevLangGroup) {
                optGroup = document.createElement('optgroup');
                optGroup.setAttribute('label', langInfo.group);
                editLangSelect.appendChild(optGroup);
            }
            optGroup.appendChild(optionElem);
        }
        else {
            editLangSelect.appendChild(optionElem);
        }
        prevLangGroup = langInfo.group;
    }
    const editForm = document.getElementById('edit-form');
    editForm.addEventListener('submit', (ev) => {
        ev.preventDefault();
        try {
            const formData = new FormData(editForm);
            const rawArticle = { ext: 'txt', trust: false,
                lang: formData.get('edit-lang'),
                text: formData.get('edit-text') };
            const article = parseArticle(rawArticle);
            console.log(rawArticle);
            loadArticle(article);
            globals.menuSwitcher.hide();
        }
        catch (e) {
            logError(e);
        }
    });
}
function disableButton(id) {
    const elem = document.getElementById(id);
    if (elem) {
        elem.setAttribute('disabled', '');
    }
    else {
        throw new Error(`Couldn't find element #${id}.`);
    }
}
//=[ After loading an article ]=================================================
function deleteFromArray(a, x) {
    if (x !== undefined) {
        const i = a.indexOf(x);
        if (i !== -1) {
            a.splice(i, 1);
        }
    }
}
function getSpeechPolicy() {
    for (const speechPolicy of speechPolicyValues) {
        const elem = document.getElementById('sp-' + speechPolicy);
        if (elem.checked) {
            return speechPolicy;
        }
    }
    throw new Error('No speech policy is selected.');
}
function voiceDescription(voice) {
    const locality = voice.localService ? 'local' : 'remote';
    return `${voice.name} (${voice.lang}, ${locality})`;
}
function setVoice() {
    if (globals.voicesByLang !== undefined && globals.settings !== undefined) {
        const voiceList = globals.voicesByLang.get(globals.settings.srcLang);
        const playButton = document.getElementById('button-play');
        const voiceSettingsButton = document.getElementById('button-voice-settings');
        const voiceInfoElem = document.getElementById('voice-info');
        if (voiceList !== undefined && voiceList.length > 0) {
            const voice = voiceList[0];
            globals.settings.voice = voice;
            voiceInfoElem.textContent = voiceDescription(voice);
            playButton.onclick = (() => playButtonClick());
            playButton.disabled = globals.articleInfo.sockets.length === 0;
            voiceSettingsButton.removeAttribute('disabled');
        }
        else {
            globals.settings.voice = undefined;
            voiceInfoElem.textContent = '';
            playButton.onclick = null;
            playButton.setAttribute('disabled', '');
            voiceSettingsButton.setAttribute('disabled', '');
        }
    }
}
function togglePrevNextButtons() {
    const prevButton = document.getElementById('button-prev');
    const nextButton = document.getElementById('button-next');
    const currSent = globals.state.currSent;
    const totalSents = globals.articleInfo.sockets.length;
    if (totalSents === 0) {
        prevButton.setAttribute('disabled', '');
        nextButton.setAttribute('disabled', '');
    }
    else if (currSent === 0) {
        prevButton.setAttribute('disabled', '');
        nextButton.removeAttribute('disabled');
    }
    else if (currSent + 1 === totalSents) {
        prevButton.removeAttribute('disabled');
        nextButton.setAttribute('disabled', '');
    }
    else {
        prevButton.removeAttribute('disabled');
        nextButton.removeAttribute('disabled');
    }
}
function loadArticle(articleInfo) {
    // show parsing warnings
    if (articleInfo.warnings.length > 0) {
        for (const warning of articleInfo.warnings) {
            uiMessage('warning', warning.message);
        }
    }
    globals.articleInfo = articleInfo;
    console.debug(articleInfo);
    // figure out the set of languages
    const firstLang = (articleInfo.langs.size > 0 ?
        articleInfo.langs.values().next().value : undefined);
    const srcLang = articleInfo.defaultLang || firstLang;
    if (srcLang === undefined) {
        throw new Error('No language found in text.');
    }
    if (langNames.get(srcLang) === undefined) {
        uiMessage('warning', `Unrecognized language ${srcLang}.`);
    }
    const trnLangs = Array.from(articleInfo.langs);
    deleteFromArray(trnLangs, srcLang);
    const pickedTrnLangs = trnLangs.slice(0, defaultNTrnLangs);
    // show content in reader
    const fails = populate(articleInfo, srcLang);
    if (fails > 0) {
        uiMessage('warning', `${fails} sentences missing in lang ${srcLang}.`);
    }
    const mainElem = document.getElementById('main');
    mainElem.replaceChildren(articleInfo.root);
    const newbieElem = document.getElementById('newbie-info');
    newbieElem.classList.add('hidden');
    const articleIsEmpty = articleInfo.sockets.length === 0;
    if (articleIsEmpty) {
        uiMessage('warning', 'No tagged sentences found in article.');
    }
    else {
        articleInfo.sockets[0].classList.add('selected');
    }
    for (const socket of articleInfo.sockets) {
        socket.addEventListener('click', function (ev) {
            const sentId = Number(socket.dataset.sentId);
            showSentence(sentId);
        });
    }
    // set settings and state
    const voiceSpeedElem = document.getElementById('voice-speed');
    const voiceSpeed = Number(voiceSpeedElem.value);
    globals.settings = {
        srcLang: srcLang,
        trnLangs: trnLangs,
        pickedTrnLangs: pickedTrnLangs,
        speechPolicy: getSpeechPolicy(),
        voiceSpeed: voiceSpeed
    };
    globals.state = { currSent: 0, speaking: false };
    // enable menus, buttons, voice
    document.getElementById('src-lang').textContent = langNames.get(srcLang) ?? srcLang;
    loadTextSettingsMenu();
    setVoice();
    togglePrevNextButtons();
    // show spotlight
    updatePickedLangs();
}
function loadTextSettingsMenu() {
    document.getElementById('button-text-settings').removeAttribute('disabled');
    const trnLangs = globals.settings.trnLangs;
    // hide/unhide relevant parts in text-settings
    const trnLangsNone = document.getElementById('trn-langs-none');
    const trnLangsOne = document.getElementById('trn-langs-one');
    const trnLangsMultiple = document.getElementById('trn-langs-multiple');
    if (trnLangs.length === 0) {
        trnLangsNone.classList.remove('hidden');
        trnLangsOne.classList.add('hidden');
        trnLangsMultiple.classList.add('hidden');
    }
    else if (trnLangs.length === 1) {
        trnLangsNone.classList.add('hidden');
        trnLangsOne.classList.remove('hidden');
        trnLangsMultiple.classList.add('hidden');
        document.getElementById('trn-lang-default').textContent = langNames.get(trnLangs[0]) ?? trnLangs[0];
    }
    else {
        trnLangsNone.classList.add('hidden');
        trnLangsOne.classList.add('hidden');
        trnLangsMultiple.classList.remove('hidden');
    }
    // add <select> menus in text-settings
    const trnLangSelects = [];
    trnLangsMultiple.replaceChildren();
    const pickedTrnLangs = globals.settings.pickedTrnLangs;
    for (let i = 0; i < trnLangs.length; ++i) {
        const menuRow = document.createElement('div');
        menuRow.classList.add('menu-row');
        const id = 'trn-lang-' + (i + 1);
        const label = document.createElement('label');
        label.classList.add('menu-item');
        label.setAttribute('for', id);
        label.textContent = `Translation language ${i + 1}:`;
        const select = document.createElement('select');
        select.classList.add('menu-item');
        select.setAttribute('id', id);
        select.setAttribute('name', id);
        select.addEventListener('change', updatePickedLangs);
        trnLangSelects.push(select);
        const noneOptionElem = document.createElement('option');
        noneOptionElem.value = 'none';
        noneOptionElem.textContent = '(None)';
        if (pickedTrnLangs[i] === undefined) {
            noneOptionElem.setAttribute('selected', '');
        }
        select.appendChild(noneOptionElem);
        for (const lang of trnLangs) {
            const optionElem = document.createElement('option');
            optionElem.value = lang;
            optionElem.textContent = langNames.get(lang) ?? lang;
            if (pickedTrnLangs[i] === lang) {
                optionElem.setAttribute('selected', '');
            }
            select.appendChild(optionElem);
        }
        menuRow.appendChild(label);
        menuRow.appendChild(select);
        trnLangsMultiple.appendChild(menuRow);
    }
    globals.trnLangSelects = trnLangSelects;
}
function showTrnInSpotlight(i) {
    const d = globals.articleInfo.kids2[i];
    if (d === undefined && i > 0) {
        console.warn(`showTrnInSpotlight: sentence ${i} doesn't exist.`);
    }
    const spotlightInner = document.getElementById('spotlight-inner');
    const pickedTrnLangs = globals.settings.pickedTrnLangs;
    if (spotlightInner.children.length !== pickedTrnLangs.length) {
        throw new Error('spotlightInner.children.length !== pickedTrnLangs.length');
    }
    for (let j = 0; j < pickedTrnLangs.length; ++j) {
        const trnLang = pickedTrnLangs[j];
        const trnContainer = spotlightInner.children.item(j);
        trnContainer.replaceChildren();
        if (d !== undefined) {
            const trnElem = d[trnLang];
            if (trnElem) {
                trnContainer.appendChild(trnElem);
            }
        }
    }
}
function showSentence(j) {
    if (globals.articleInfo === undefined) {
        return;
    }
    const sockets = globals.articleInfo.sockets;
    const i = globals.state.currSent;
    if (j === '+') {
        if (i + 1 >= sockets.length) {
            return;
        }
        else {
            j = i + 1;
        }
    }
    else if (j === '-') {
        if (i === 0) {
            return;
        }
        else {
            j = i - 1;
        }
    }
    sockets[i].classList.remove('selected');
    sockets[j].classList.add('selected');
    globals.state.currSent = j;
    showTrnInSpotlight(j);
    sockets[j].scrollIntoView({ 'behavior': 'smooth', 'block': 'center', 'inline': 'nearest' });
    togglePrevNextButtons();
    if (globals.settings.speechPolicy !== 'on-demand') {
        playButtonClick(true);
    }
}
function updatePickedLangs() {
    // get langs from <select> menus
    const pickedTrnLangs = globals.settings.pickedTrnLangs;
    pickedTrnLangs.length = 0;
    const seenSet = new Set();
    for (const select of globals.trnLangSelects) {
        const lang = select.value;
        if (lang !== 'none' && !seenSet.has(lang)) {
            pickedTrnLangs.push(lang);
            seenSet.add(lang);
        }
    }
    // make spotlight children
    const spotlight = document.getElementById('spotlight');
    const spotlightInner = document.getElementById('spotlight-inner');
    spotlightInner.replaceChildren();
    if (pickedTrnLangs.length === 0) {
        spotlight.classList.add('hidden');
    }
    else {
        spotlight.classList.remove('hidden');
        for (const lang of pickedTrnLangs) {
            const elem = document.createElement('div');
            elem.setAttribute('lang', lang);
            spotlightInner.appendChild(elem);
        }
    }
    showTrnInSpotlight(globals.state.currSent);
}
function keyHandler(ev) {
    if (globals.menuSwitcher && globals.menuSwitcher.selected) {
        return;
    }
    else if (globals.articleInfo === undefined) {
        return;
    }
    else if (ev.key === "ArrowRight") {
        showSentence('+');
        ev.preventDefault();
    }
    else if (ev.key === 'ArrowLeft') {
        showSentence('-');
        ev.preventDefault();
    }
    else if (ev.key === ' ') {
        playButtonClick();
        ev.preventDefault();
    }
}
function getCurrentUtterance() {
    if (globals.settings !== undefined && globals.settings.voice !== undefined) {
        const lang = globals.settings.srcLang;
        const sentId = globals.state.currSent;
        const text = globals.articleInfo.kids2[sentId][lang].textContent ?? '';
        const voice = globals.settings.voice;
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = lang;
        utterance.voice = voice;
        utterance.rate = globals.settings.voiceSpeed;
        utterance.addEventListener('error', (ev) => {
            if (ev.error !== 'interrupted' && ev.error !== 'canceled') {
                uiMessage('danger', `Speech error code ${ev.error}.`);
            }
        });
        utterance.addEventListener('end', (ev) => {
            console.debug(`Playback of sentence ${sentId} ended.`);
            if (!speechSynthesis.pending && !speechSynthesis.speaking) {
                globals.state.speaking = false;
                globals.state.speakingSent = undefined;
                document.getElementById('button-play').dataset.state = 'paused';
                if (globals.settings.speechPolicy === 'continuous') {
                    showSentence('+');
                }
            }
        });
        return utterance;
    }
}
function playButtonClick(force = false) {
    // force means cancel current speech (if speaking) and start speaking afresh
    if (globals.state !== undefined && globals.settings.voice !== undefined) {
        const speaking = speechSynthesis.speaking && !speechSynthesis.paused;
        const paused = speechSynthesis.speaking && speechSynthesis.paused;
        const stopped = !speechSynthesis.speaking;
        if (Number(speaking) + Number(paused) + Number(stopped) !== 1) {
            throw new Error(`Invalid speech state encountered: ss.speaking=${speechSynthesis.speaking}, ss.paused=${speechSynthesis.paused}, ss.pending=${speechSynthesis.pending}.`);
        }
        if (globals.state.speaking !== speaking) {
            console.warn('Speech state inconsistency detected.', 'Using force mode for current invocation.', 'Debug info:', `speaking=${globals.state.speaking},`, `ss.speaking=${speechSynthesis.speaking},`, `ss.paused=${speechSynthesis.paused},`, `ss.pending=${speechSynthesis.pending}.`);
            force = true;
        }
        const sentenceChanged = force || (globals.state.speakingSent !== undefined && globals.state.speakingSent !== globals.state.currSent);
        const playButton = document.getElementById('button-play');
        /* This table explains the 9 possibilities and the action to take in each.
         *                          |   speaking   |    paused    | stopped |
         * ------------------------------------------------------------------
         *          force           | cancel+speak | cancel+speak |  speak  |
         * !force & sentenceChanged |    pause     | cancel+speak |  speak  |
         *     !sentenceChanged     |    pause     |    resume    |  speak  |
         */
        if (!force && speaking) {
            console.debug('pausing speech');
            speechSynthesis.pause();
            globals.state.speaking = false;
            playButton.dataset.state = 'paused';
        }
        else {
            const cancelCondition = speaking || (paused && sentenceChanged);
            if (cancelCondition) {
                console.debug(`canceling speech of sentence ${globals.state.speakingSent}.`);
                speechSynthesis.cancel();
            }
            else if (paused) {
                console.debug('resuming speech');
                speechSynthesis.resume();
            }
            if (cancelCondition || stopped) {
                const utterance = getCurrentUtterance();
                console.debug(`Initiated speaking sentence ${globals.state.currSent}.`);
                speechSynthesis.speak(utterance);
            }
            globals.state.speakingSent = globals.state.currSent;
            globals.state.speaking = true;
            playButton.dataset.state = 'playing';
        }
    }
}
function getParentIfNeeded(ev) {
    if (ev === null || ev instanceof HTMLElement) {
        return ev;
    }
    else if (ev instanceof Text) {
        return ev.parentElement;
    }
    else {
        return null;
    }
}
function setupSlider(sliderId, numberId, f) {
    const sliderElem = document.getElementById(sliderId);
    const numberElem = document.getElementById(numberId);
    numberElem.textContent = sliderElem.value;
    sliderElem.addEventListener('input', (ev) => {
        numberElem.textContent = sliderElem.value;
        f(Number(sliderElem.value));
    });
}
function setupMenuListeners() {
    const menuSwitcher = globals.menuSwitcher;
    function hideMenus() { menuSwitcher.hide(); }
    const builtinsMenu = document.getElementById('enlist-body');
    const baIdPrefix = 'ba-';
    for (const ba of articleEntries) {
        const baElem = document.createElement('div');
        baElem.id = baIdPrefix + ba.id;
        baElem.classList.add('menu-item');
        baElem.textContent = ba.label;
        builtinsMenu.appendChild(baElem);
    }
    builtinsMenu.addEventListener('click', (ev) => {
        const elem = getParentIfNeeded(ev.target);
        if (elem === null || !elem.classList.contains('menu-item')) {
            return;
        }
        const id = elem.id.slice(baIdPrefix.length);
        fetchRawArticleFromId(id)
            .then(parseArticle).then(loadArticle).then(hideMenus).catch(logError);
    });
    setupSlider('voice-speed', 'voice-speed-number', (x) => {
        if (globals.settings !== undefined) {
            globals.settings.voiceSpeed = x;
        }
    });
    const mainElem = document.getElementById('main');
    setupSlider('text-size', 'text-size-number', (x) => {
        mainElem.style.fontSize = (x * 1.2) + 'em';
    });
    document.getElementById('speech-policy-group').addEventListener('change', (ev) => {
        if (globals.settings !== undefined) {
            globals.settings.speechPolicy = getSpeechPolicy();
        }
    });
    const trinLangElem = document.getElementById('trin-lang');
    const noTrinElem = document.createElement('option');
    noTrinElem.setAttribute('value', 'none');
    noTrinElem.textContent = '(None)';
    noTrinElem.setAttribute('selected', 'selected');
    trinLangElem.appendChild(noTrinElem);
    for (const scriptInfo of scriptsInfo) {
        const optionElem = document.createElement('option');
        optionElem.setAttribute('value', scriptInfo.code);
        optionElem.textContent = scriptInfo.name;
        trinLangElem.appendChild(optionElem);
    }
    const trinHovElem = document.getElementById('trin-hov');
    function trinMain() {
        const lang = trinLangElem.value === 'none' ? undefined : trinLangElem.value;
        buildScaffolding(mainElem);
        trinAll(lang, trinHovElem.checked);
    }
    trinLangElem.addEventListener('input', trinMain);
    trinHovElem.addEventListener('input', trinMain);
}
//=[ main ]=====================================================================
function setEventHandlers() {
    if (typeof speechSynthesis !== "undefined") {
        speechSynthesis.onvoiceschanged = registerVoices;
        setTimeout(registerVoices, 0);
    }
    else {
        console.warn('speech unavailable');
    }
    document.getElementById('spotlight-collapse-btn').addEventListener('click', (ev) => { ev.currentTarget.parentElement.classList.toggle('collapsed'); });
    for (const id of ['button-play', 'button-prev', 'button-next', 'button-text-settings', 'button-voice-settings']) {
        // disable buttons explicitly since browsers sometimes preserve form control states across page refresh
        disableButton(id);
    }
    document.getElementById('button-prev').onclick = () => showSentence('-');
    document.getElementById('button-next').onclick = () => showSentence('+');
    window.addEventListener('keydown', keyHandler);
    deployMenuSwitcher();
    setupFileLoaders();
    setupMenuListeners();
}
function main() {
    try {
        setEventHandlers();
        const ae = getArticleEntryFromQString();
        if (ae !== undefined) {
            fetchRawArticleFromUrl(ae.path, true)
                .then(parseArticle).then(loadArticle).catch(logError);
        }
    }
    catch (e) {
        logError(e);
    }
}
if (document.readyState === 'interactive') {
    main();
}
else {
    document.addEventListener('DOMContentLoaded', main);
}
//# sourceMappingURL=web.js.map