export interface DocInfo {
    defaultLang?: string;
    root: HTMLElement;
    sockets: HTMLElement[];
    kids: Record<string, HTMLElement>[];
    kids2: Record<string, HTMLElement>[];
}

export function parse({ext: ext, text: text}: {ext?: string, text: string}): DocInfo {
    if(ext !== 'html') {
        throw new Error(`invalid file extension ${ext}`);
    }
    // console.log('text:', text.slice(0, 200));
    const parser = new DOMParser();
    const article = parser.parseFromString(text, 'text/html');
    console.log(article);
    const defaultLang = article.documentElement.getAttribute('lang')
    const newRoot = document.createElement('div');
    const docInfo: DocInfo = {defaultLang: defaultLang ?? undefined, root: newRoot,
        sockets: [], kids: [], kids2: []};
    outerParseHelper(article, article.body, newRoot, docInfo);
    for(const kid of docInfo.kids) {
        const kid2: Record<string, HTMLElement> = {};
        for(const [lang, elem] of Object.entries(kid)) {
            kid2[lang] = elem.cloneNode(true) as HTMLElement;
        }
        docInfo.kids2.push(kid2);
    }
    return docInfo;
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
            throw new Error("nested use of 'lang' attribute");
        }
        assertNoLangInDescendants(child);
    }
}

function outerParseHelper(article: HTMLDocument, source: HTMLElement, dest: HTMLElement, docInfo: DocInfo): void {
    let langKids: Record<string, HTMLElement> = {};
    let langBox: HTMLElement | undefined = undefined;
    for(const srcChild of source.childNodes) {
        if(srcChild instanceof HTMLElement) {
            const lang = srcChild.getAttribute('lang');
            if(lang === null) {
                const destChild = shallowCloneElem(srcChild);
                outerParseHelper(article, srcChild, destChild, docInfo);
                dest.appendChild(destChild);
            }
            else {
                assertNoLangInDescendants(srcChild);
                const prevLangChild = langKids[lang];
                // refresh langBox and langKids
                if(prevLangChild !== undefined) {
                    if(langBox === undefined) {
                        throw new Error("assertion error: langBox shouldn't be undefined here.");
                    }
                    langBox = undefined;
                    langKids = {};
                }
                if(langBox === undefined) {
                    langBox = article.createElement('span');
                    langBox.id = 'sent-' + docInfo.sockets.length;
                    langBox.classList.add('lang-box');
                    docInfo.sockets.push(langBox);
                    docInfo.kids.push(langKids);
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
            throw new Error(`unidentified node type ${srcChild}`);
        }
    }
}

export function populate(docInfo: DocInfo, lang: string): number {
    let fails = 0;
    const n = docInfo.sockets.length;
    for(let i=0; i<n; ++i) {
        const socket = docInfo.sockets[i];
        const kid = docInfo.kids[i][lang];
        if(kid === undefined) {
            fails++;
        }
        else {
            socket.replaceChildren(kid);
        }
    }
    return fails;
}
