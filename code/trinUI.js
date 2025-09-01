import { forEachWord, getScriptAndOffset, trinWord } from "./trin.js";
export function buildScaffolding(elem) {
    let count = 0;
    if (!(elem.classList.contains('trin-scaff-elem') || elem.classList.contains('no-trin-scaff'))) {
        const children = Array.from(elem.childNodes);
        for (const child of children) {
            if (child instanceof Text) {
                const wns = []; // words n' scripts
                forEachWord(child.nodeValue, (word, script) => { wns.push([word, script]); });
                if (wns.length >= 2 || (wns.length === 1 && wns[0][1] !== undefined)) {
                    for (const [word, script] of wns) {
                        let newChild = null;
                        if (script !== undefined) {
                            newChild = document.createElement('span');
                            newChild.textContent = word;
                            newChild.classList.add('trin-scaff-elem');
                            newChild.setAttribute('data-orig-text', word);
                            count += 1;
                        }
                        else {
                            newChild = document.createTextNode(word);
                        }
                        elem.insertBefore(newChild, child);
                    }
                    elem.removeChild(child);
                }
            }
            else if (child instanceof HTMLElement) {
                count += buildScaffolding(child);
            }
        }
    }
    return count;
}
export function trinElem(elem, targetScript, onHoverOnly = false) {
    const origWord = elem.dataset.origText;
    if (origWord === undefined || origWord.length === 0) {
        return;
    }
    const [origScript, origOffset] = getScriptAndOffset(origWord.codePointAt(0));
    if (origScript === undefined) {
        return;
    }
    const newWord = targetScript === undefined ? origWord : trinWord(origWord, origScript, targetScript);
    elem.textContent = onHoverOnly ? origWord : newWord;
    const hovWord = onHoverOnly ? newWord : origWord;
    if (targetScript !== undefined && targetScript !== origScript) {
        const hovElem = document.createElement('span');
        hovElem.classList.add('trin-hover');
        hovElem.textContent = hovWord;
        elem.appendChild(hovElem);
    }
}
export function trinAll(targetScript, onHoverOnly = false) {
    const trinScaffElems = document.getElementsByClassName('trin-scaff-elem');
    for (const elem of trinScaffElems) {
        trinElem(elem, targetScript, onHoverOnly);
    }
}
//# sourceMappingURL=trinUI.js.map