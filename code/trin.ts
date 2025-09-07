// Transliteration between Indic languages.
// Adapted from https://github.com/sharmaeklavya2/trin/.

const blockSize = 0x80;

interface ScriptInfo {
    'code': string;
    'name': string;
    'startPos': number;
}

export const scriptsInfo: ScriptInfo[] = [
    {'code': 'hi', 'name': 'Devanagari', 'startPos': 0x0900},
    {'code': 'bn', 'name': 'Bengali', 'startPos': 0x0980},
    {'code': 'pa', 'name': 'Gurmukhi', 'startPos': 0x0A00},
    {'code': 'gu', 'name': 'Gujarati', 'startPos': 0x0A80},
    {'code': 'or', 'name': 'Oriya', 'startPos': 0x0B00},
    {'code': 'ta', 'name': 'Tamil', 'startPos': 0x0B80},
    {'code': 'te', 'name': 'Telugu', 'startPos': 0x0C00},
    {'code': 'kn', 'name': 'Kannada', 'startPos': 0x0C80},
    {'code': 'ml', 'name': 'Malayalam', 'startPos': 0x0D00},
];

const devPunctCodePoints = new Set([0x0964, 0x0965, 0x0970]);

const scriptToStartPos = new Map(scriptsInfo.map(scriptInfo => [scriptInfo.code, scriptInfo.startPos]));
const startPosToScript = new Map(scriptsInfo.map(scriptInfo => [scriptInfo.startPos, scriptInfo.code]));

export function getScriptAndOffset(codePoint: number): [string | undefined, number] {
    const blockOffset = codePoint & (blockSize - 1);
    if(devPunctCodePoints.has(codePoint)) {
        return ['devDot', blockOffset];
    }
    const blockStartPoint = codePoint & (-blockSize);
    const script = startPosToScript.get(blockStartPoint);
    return [script, blockOffset];
}

export function trinWord(text: string, srcScript: string, targetScript: string): string {
    // adds an offset to all characters in a word
    const n = text.length;
    const newCodePoints = new Array(n);
    const srcPos = scriptToStartPos.get(srcScript);
    const targetPos = scriptToStartPos.get(targetScript);
    if(srcPos === undefined) {
        throw new Error(`trinWord: unknown source script ${srcScript}`);
    }
    if (targetPos === undefined) {
        throw new Error(`trinWord: unknown target script ${targetScript}`);
    }
    const offset = targetPos - srcPos;
    for(let i=0; i < n; ++i) {
        newCodePoints[i] = text.codePointAt(i)! + offset;
    }
    return String.fromCodePoint(...newCodePoints);
}

export function forEachWord(text: string | null | undefined, f: (word: string, script?: string) => void): void {
    // breaks text at word and script boundaries and calls f(word, script) for each word.
    if(text === undefined || text === null || text.length === 0) {
        return;
    }
    let [prevScript, prevOffset] = getScriptAndOffset(text[0].codePointAt(0)!);
    let prevI = 0;
    for(let i=1; i < text.length; ++i) {
        let [script, offset] = getScriptAndOffset(text[i].codePointAt(0)!);
        if(prevScript !== script) {
            const fragment = text.slice(prevI, i);
            f(fragment, prevScript);
            prevI = i;
            prevScript = script;
        }
    }
    f(text.slice(prevI), prevScript);
}

export function detectScripts(text: string): Set<string> {
    let scripts = new Set<string>();
    function f(word: string, script?: string) {
        if(script !== undefined) {
            scripts.add(script);
        }
    }
    forEachWord(text, f);
    return scripts;
}
