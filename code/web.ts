import * as parser from "./parser.js";

function uiMessage(type: string, msg: string): void {
    console.log(msg);
}

const articlesMap: Record<string, string> = {
    'ict20': 'articles/ict/l20.html',
};

function getExt(fname: string): string | undefined {
    const i = fname.lastIndexOf('.');
    if (i === -1) {
        return undefined;
    }
    return fname.slice(i+1).toLowerCase();
}

async function loadArticleTextFromQString() {
    // returns a Promise that resolves to the contents of the article fetched from the querystring
    const urlParams = new URLSearchParams(window.location.search);
    const param = urlParams.get('article');
    if(param !== null) {
        const fpath = articlesMap[param];
        if(fpath === undefined) {
            throw new Error(`article ${param} not found`);
        }
        const ext = getExt(fpath);
        // console.log('fetching article', fpath);
        const response = await window.fetch(fpath);
        if(!response.ok) {
            throw new Error(`fetch failed. status: ${response.status}, path: ${fpath}`);
        }
        const text = await response.text();
        return [ext, text]
    }
    else {
        return [undefined, undefined];
    }
}

async function main(): Promise<void> {
    try {
        const [ext, text] = await loadArticleTextFromQString();
        if(text !== undefined) {
            const mainElem = document.getElementById('main')!;
            const docInfo = parser.parse({ext: ext, text: text});
            if(docInfo.defaultLang) {
                parser.populate(docInfo, docInfo.defaultLang);
            }
            mainElem.appendChild(docInfo.root);
            console.log(docInfo);
        }
    } catch (e) {
        if(e instanceof Error) {
            uiMessage('danger', e.message);
        }
        throw e;
    }
}

await main();
