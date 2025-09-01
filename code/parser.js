import { default as parseCsv } from "./csv.js";
export function parseArticle(rawArticle) {
    if (rawArticle.ext === 'html') {
        return parseArticleFromHtml(rawArticle.text);
    }
    else if (rawArticle.ext === 'csv') {
        return parseArticleFromCsv(rawArticle.text, ',');
    }
    else if (rawArticle.ext === 'tsv') {
        return parseArticleFromCsv(rawArticle.text, '\t');
    }
    else if (rawArticle.ext === 'txt') {
        return parseArticleFromTxt(rawArticle.text, rawArticle.lang);
    }
    else {
        throw new Error(`Invalid file extension ${rawArticle.ext}.`);
    }
}
function postProcess(articleInfo) {
    for (const kid of articleInfo.kids) {
        const kid2 = {};
        for (const [lang, elem] of Object.entries(kid)) {
            kid2[lang] = elem.cloneNode(true);
        }
        articleInfo.kids2.push(kid2);
    }
}
function valuesAreEmpty(d) {
    for (const [k, v] of Object.entries(d)) {
        if (v !== '') {
            return false;
        }
    }
    return true;
}
function parseArticleFromCsv(text, delimiter) {
    const newRoot = document.createElement('div');
    const [header, data] = parseCsv(text, delimiter);
    const articleInfo = { defaultLang: header[0], root: newRoot,
        langs: new Set(header), sockets: [], kids: [], kids2: [], warnings: [] };
    let langKids = {};
    let langBox = undefined;
    let p = undefined;
    for (const row of data) {
        if (valuesAreEmpty(row)) {
            p = undefined;
        }
        else {
            if (p === undefined) {
                p = document.createElement('p');
                newRoot.appendChild(p);
            }
            langBox = document.createElement('span');
            langBox.dataset.sentId = '' + articleInfo.sockets.length;
            langBox.classList.add('lang-box');
            articleInfo.sockets.push(langBox);
            p.appendChild(langBox);
            p.appendChild(document.createTextNode(' '));
            const kids = {};
            for (const [lang, sentence] of Object.entries(row)) {
                if (sentence !== '') {
                    const langKid = document.createElement('span');
                    langKid.setAttribute('lang', lang);
                    langKid.innerText = sentence;
                    kids[lang] = langKid;
                }
            }
            articleInfo.kids.push(kids);
        }
    }
    postProcess(articleInfo);
    return articleInfo;
}
function parseArticleFromHtml(text) {
    // console.log('text:', text.slice(0, 200));
    const parser = new DOMParser();
    const articleDoc = parser.parseFromString(text, 'text/html');
    const defaultLang = articleDoc.documentElement.getAttribute('lang');
    const newRoot = document.createElement('div');
    const articleInfo = { defaultLang: defaultLang ?? undefined, root: newRoot,
        langs: new Set(), sockets: [], kids: [], kids2: [], warnings: [] };
    outerHtmlParseHelper(articleDoc.body, newRoot, articleDoc, articleInfo);
    postProcess(articleInfo);
    return articleInfo;
}
function shallowCloneElem(elem) {
    const elem2 = elem.cloneNode(false);
    elem2.removeAttribute('id');
    elem2.removeAttribute('lang');
    return elem2;
}
function assertNoLangInDescendants(elem) {
    for (const child of elem.children) {
        if (child.hasAttribute('lang')) {
            throw new Error("Nested use of 'lang' attribute.");
        }
        assertNoLangInDescendants(child);
    }
}
function outerHtmlParseHelper(source, dest, articleDoc, articleInfo) {
    let langKids = {};
    let langBox = undefined;
    for (const srcChild of source.childNodes) {
        if (srcChild instanceof HTMLElement) {
            const lang = srcChild.getAttribute('lang');
            if (lang === null) {
                const destChild = shallowCloneElem(srcChild);
                outerHtmlParseHelper(srcChild, destChild, articleDoc, articleInfo);
                dest.appendChild(destChild);
            }
            else {
                articleInfo.langs.add(lang);
                assertNoLangInDescendants(srcChild);
                const prevLangChild = langKids[lang];
                // refresh langBox and langKids
                if (prevLangChild !== undefined) {
                    if (langBox === undefined) {
                        throw new Error("Assertion error: langBox shouldn't be undefined here.");
                    }
                    langBox = undefined;
                    langKids = {};
                    if (articleInfo.defaultLang !== undefined && lang != articleInfo.defaultLang) {
                        articleInfo.warnings.push(Error(`Missing sentence in lang ${articleInfo.defaultLang} before\n`
                            + srcChild.outerHTML));
                    }
                }
                if (langBox === undefined) {
                    langBox = articleDoc.createElement('span');
                    langBox.dataset.sentId = '' + articleInfo.sockets.length;
                    langBox.classList.add('lang-box');
                    articleInfo.sockets.push(langBox);
                    articleInfo.kids.push(langKids);
                    dest.appendChild(langBox);
                }
                // register current tag
                const langKid = srcChild.cloneNode(true);
                langKids[lang] = langKid;
            }
        }
        else if (srcChild instanceof Text) {
            dest.appendChild(srcChild.cloneNode(false));
        }
        else {
            throw new Error(`Unidentified node type ${srcChild}.`);
        }
    }
}
function textToSentences(text) {
    let parts = [];
    const puncs = '.!?।';
    const n = text.length;
    let i = 0;
    while (i < n) {
        let j = n;
        for (const ch of puncs) {
            const j2 = text.indexOf(ch, i);
            if (j2 !== -1 && j2 < j) {
                j = j2;
            }
        }
        parts.push(text.slice(i, j + 1));
        i = j + 1;
    }
    return parts;
}
function parseArticleFromTxt(text, lang) {
    const paras = text.trim().split('\r').join('').split('\n\n');
    const newRoot = document.createElement('div');
    const articleInfo = { defaultLang: lang, root: newRoot,
        langs: new Set(lang ?? '?'), sockets: [], kids: [], kids2: [], warnings: [] };
    for (const para of paras) {
        const sentences = textToSentences(para.trim());
        const pElem = document.createElement('p');
        newRoot.appendChild(pElem);
        for (const sentence of sentences) {
            const langBox = document.createElement('span');
            langBox.dataset.sentId = 'sent-' + articleInfo.sockets.length;
            langBox.classList.add('lang-box');
            articleInfo.sockets.push(langBox);
            pElem.appendChild(langBox);
            pElem.appendChild(document.createTextNode(' '));
            const kidElem = document.createElement('span');
            kidElem.innerText = sentence;
            if (lang !== undefined) {
                kidElem.setAttribute('lang', lang);
            }
            const kids = {};
            kids[lang ?? '?'] = kidElem;
            articleInfo.kids.push(kids);
        }
    }
    postProcess(articleInfo);
    return articleInfo;
}
export function populate(articleInfo, lang) {
    let fails = 0;
    const n = articleInfo.sockets.length;
    for (let i = 0; i < n; ++i) {
        const socket = articleInfo.sockets[i];
        const kid = articleInfo.kids[i][lang];
        if (kid === undefined) {
            fails++;
        }
        else {
            socket.replaceChildren(kid);
        }
    }
    return fails;
}
//# sourceMappingURL=parser.js.map