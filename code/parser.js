import { default as parseCsv } from "./csv.js";
import { sanitize } from "./sanitizeHtml.js";
import langsInfo from "langsInfo.json" with { type: "json" };
export function parseArticle(rawArticle) {
    let articleInfo;
    if (rawArticle.ext === 'html') {
        articleInfo = parseArticleFromHtml(rawArticle.text, rawArticle.trust);
    }
    else if (rawArticle.ext === 'csv') {
        articleInfo = parseArticleFromCsv(rawArticle.text, ',');
    }
    else if (rawArticle.ext === 'tsv') {
        articleInfo = parseArticleFromCsv(rawArticle.text, '\t');
    }
    else if (rawArticle.ext === 'txt') {
        articleInfo = parseArticleFromTxt(rawArticle.text, rawArticle.lang);
    }
    else {
        throw new Error(`Invalid file extension ${rawArticle.ext}.`);
    }
    articleInfo.id = rawArticle.id;
    postProcess(articleInfo);
    return articleInfo;
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
const knownTags = new Set(['ul', 'ol', 'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6']);
function tagFromValues(d) {
    let tag;
    for (const [k, v] of Object.entries(d)) {
        if (v !== '') {
            if (v.length < 2 || v[0] !== '<' || v[v.length - 1] !== '>') {
                return undefined;
            }
            const vTag = v.slice(1, v.length - 1);
            if (knownTags.has(vTag)) {
                if (tag === undefined) {
                    tag = vTag;
                }
                else if (tag !== vTag) {
                    return undefined;
                }
            }
            else {
                return undefined;
            }
        }
    }
    return tag ?? 'p';
}
const langCodes = new Set(langsInfo.map(lang => lang.code));
function parseArticleFromCsv(text, delimiter) {
    const newRoot = document.createElement('div');
    const [header, data] = parseCsv(text, delimiter);
    const langs = new Set(header.filter(langCode => langCodes.has(langCode)));
    const articleInfo = {
        defaultLang: header[0], root: newRoot, langs: langs,
        sockets: [], kids: [], kids2: [], warnings: []
    };
    let langKids = {};
    let langBox = undefined;
    let p = undefined;
    let outerTag = 'p', innerTag = 'span';
    for (const row of data) {
        const foundTag = tagFromValues(row);
        if (foundTag) {
            p = undefined;
            outerTag = foundTag;
            innerTag = (foundTag === 'ol' || foundTag === 'ul') ? 'li' : 'span';
        }
        else {
            if (p === undefined) {
                p = document.createElement(outerTag);
                newRoot.appendChild(p);
            }
            langBox = document.createElement(innerTag);
            langBox.dataset.sentId = '' + articleInfo.sockets.length;
            langBox.classList.add('lang-box');
            articleInfo.sockets.push(langBox);
            p.appendChild(langBox);
            p.appendChild(document.createTextNode(' '));
            const kids = {};
            for (const [lang, sentence] of Object.entries(row)) {
                if (langs.has(lang) && sentence !== '') {
                    const langKid = document.createElement('span');
                    langKid.setAttribute('lang', lang);
                    langKid.textContent = sentence.trim();
                    kids[lang] = langKid;
                }
            }
            articleInfo.kids.push(kids);
        }
    }
    return articleInfo;
}
function parseArticleFromHtml(text, trust) {
    // console.log('text:', text.slice(0, 200));
    const parser = new DOMParser();
    const articleDoc = parser.parseFromString(text, 'text/html');
    const defaultLang = articleDoc.documentElement.getAttribute('lang');
    const newRoot = document.createElement('div');
    let articleDocBody;
    let warnings;
    if (trust) {
        articleDocBody = articleDoc.body;
        warnings = [];
    }
    else {
        [articleDocBody, warnings] = sanitize(articleDoc.body);
    }
    const articleInfo = { defaultLang: defaultLang ?? undefined, root: newRoot,
        langs: new Set(), sockets: [], kids: [], kids2: [], warnings: warnings };
    outerHtmlParseHelper(articleDocBody, newRoot, articleInfo);
    return articleInfo;
}
function assertNoLangInDescendants(elem) {
    for (const child of elem.children) {
        if (child.hasAttribute('lang')) {
            throw new Error("Nested use of 'lang' attribute.");
        }
        assertNoLangInDescendants(child);
    }
}
function modifyElem(elem) {
    if (elem.tagName === 'A' && !elem.hasAttribute('target')) {
        elem.setAttribute('target', '_blank');
    }
}
function outerHtmlParseHelper(source, dest, articleInfo) {
    let langKids = {};
    let langBox = undefined;
    for (const srcChild of source.childNodes) {
        if (srcChild instanceof HTMLElement) {
            const lang = srcChild.getAttribute('lang');
            if (lang === null) {
                const destChild = srcChild.cloneNode(false);
                modifyElem(destChild);
                outerHtmlParseHelper(srcChild, destChild, articleInfo);
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
                    langBox = document.createElement('span');
                    langBox.dataset.sentId = '' + articleInfo.sockets.length;
                    langBox.classList.add('lang-box');
                    articleInfo.sockets.push(langBox);
                    articleInfo.kids.push(langKids);
                    dest.appendChild(langBox);
                }
                // register current tag
                const langKid = srcChild.cloneNode(true);
                modifyElem(langKid);
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
        langs: new Set([lang ?? '?']), sockets: [], kids: [], kids2: [], warnings: [] };
    for (const para of paras) {
        const sentences = textToSentences(para.trim());
        const pElem = document.createElement('p');
        newRoot.appendChild(pElem);
        for (const sentence of sentences) {
            const langBox = document.createElement('span');
            langBox.dataset.sentId = '' + articleInfo.sockets.length;
            langBox.classList.add('lang-box');
            articleInfo.sockets.push(langBox);
            pElem.appendChild(langBox);
            pElem.appendChild(document.createTextNode(' '));
            const kidElem = document.createElement('span');
            kidElem.textContent = sentence.trim();
            if (lang !== undefined) {
                kidElem.setAttribute('lang', lang);
            }
            const kids = {};
            kids[lang ?? '?'] = kidElem;
            articleInfo.kids.push(kids);
        }
    }
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