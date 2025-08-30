export interface RawArticle {
    ext?: string;
    text: string;
}

export interface ArticleInfo {
    defaultLang?: string;
    root: HTMLElement;
    sockets: HTMLElement[];
    kids: Record<string, HTMLElement>[];
    kids2: Record<string, HTMLElement>[];
    warnings: Error[];
}

export function parse(rawArticle: RawArticle): ArticleInfo {
    if(rawArticle.ext !== 'html') {
        throw new Error(`Invalid file extension ${rawArticle.ext}.`);
    }
    // console.log('text:', text.slice(0, 200));
    const parser = new DOMParser();
    const articleDoc = parser.parseFromString(rawArticle.text, 'text/html');
    const defaultLang = articleDoc.documentElement.getAttribute('lang')
    const newRoot = document.createElement('div');
    const articleInfo: ArticleInfo = {defaultLang: defaultLang ?? undefined, root: newRoot,
        sockets: [], kids: [], kids2: [], warnings: []};
    outerParseHelper(articleDoc.body, newRoot, articleDoc, articleInfo);
    for(const kid of articleInfo.kids) {
        const kid2: Record<string, HTMLElement> = {};
        for(const [lang, elem] of Object.entries(kid)) {
            kid2[lang] = elem.cloneNode(true) as HTMLElement;
        }
        articleInfo.kids2.push(kid2);
    }
    return articleInfo;
}

function shallowCloneElem(elem: HTMLElement): HTMLElement {
    const elem2 = elem.cloneNode(false) as HTMLElement;
    elem2.removeAttribute('id');
    elem2.removeAttribute('lang');
    return elem2;
}

function assertNoLangInDescendants(elem: Element) {
    for(const child of elem.children) {
        if(child.hasAttribute('lang')) {
            throw new Error("Nested use of 'lang' attribute.");
        }
        assertNoLangInDescendants(child);
    }
}

function outerParseHelper(source: HTMLElement, dest: HTMLElement,
        articleDoc: HTMLDocument, articleInfo: ArticleInfo): void {
    let langKids: Record<string, HTMLElement> = {};
    let langBox: HTMLElement | undefined = undefined;
    for(const srcChild of source.childNodes) {
        if(srcChild instanceof HTMLElement) {
            const lang = srcChild.getAttribute('lang');
            if(lang === null) {
                const destChild = shallowCloneElem(srcChild);
                outerParseHelper(srcChild, destChild, articleDoc, articleInfo);
                dest.appendChild(destChild);
            }
            else {
                assertNoLangInDescendants(srcChild);
                const prevLangChild = langKids[lang];
                // refresh langBox and langKids
                if(prevLangChild !== undefined) {
                    if(langBox === undefined) {
                        throw new Error("Assertion error: langBox shouldn't be undefined here.");
                    }
                    langBox = undefined;
                    langKids = {};
                    if(articleInfo.defaultLang !== undefined && lang != articleInfo.defaultLang) {
                        articleInfo.warnings.push(Error(`Missing sentence in lang ${articleInfo.defaultLang} before\n`
                            + srcChild.outerHTML));
                    }
                }
                if(langBox === undefined) {
                    langBox = articleDoc.createElement('span');
                    langBox.id = 'sent-' + articleInfo.sockets.length;
                    langBox.classList.add('lang-box');
                    articleInfo.sockets.push(langBox);
                    articleInfo.kids.push(langKids);
                    dest.appendChild(langBox);
                }
                // register current tag
                const langKid = srcChild.cloneNode(true) as HTMLElement;
                langKids[lang] = langKid;
            }
        }
        else if(srcChild instanceof Text) {
            dest.appendChild(srcChild.cloneNode(false));
        }
        else {
            throw new Error(`Unidentified node type ${srcChild}.`);
        }
    }
}

export function populate(articleInfo: ArticleInfo, lang: string): number {
    let fails = 0;
    const n = articleInfo.sockets.length;
    for(let i=0; i<n; ++i) {
        const socket = articleInfo.sockets[i];
        const kid = articleInfo.kids[i][lang];
        if(kid === undefined) {
            fails++;
        }
        else {
            socket.replaceChildren(kid);
        }
    }
    return fails;
}
