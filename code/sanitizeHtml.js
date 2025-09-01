const tagWhiteList = new Set([
    'body', 'div', 'span', 'p',
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'table', 'thead', 'tbody', 'tr', 'td', 'th',
    'ol', 'ul', 'li',
    'em', 'strong', 'b', 'i', 'u', 's',
    'sub', 'sup', 'code', 'kbd',
    'hr', 'br',
]);
const attrsWhiteList = new Set([
    'class', 'lang', 'title', 'dir', 'rowspan', 'colspan',
]);
const classWhiteList = new Set([
    'speaker',
]);
const tagReplacements = new Map([
    ['a', 'span'],
]);
function sanitizeHelper(node, warnings) {
    if (node instanceof Text) {
        return node.cloneNode(false);
    }
    else if (node instanceof HTMLElement) {
        const origTagName = node.tagName.toLowerCase();
        const tagName = tagReplacements.get(origTagName) ?? origTagName;
        if (origTagName !== tagName) {
            warnings.push(new Error(`Sanittizer: element <${origTagName}> was replaced by <${tagName}>.`));
        }
        if (tagWhiteList.has(tagName)) {
            const node2 = document.createElement(tagName);
            const attrs = node.getAttributeNames();
            for (const attr of attrs) {
                if (attrsWhiteList.has(attr)) {
                    const value = node.getAttribute(attr);
                    if (value !== null) {
                        node2.setAttribute(attr, value);
                    }
                }
                else {
                    warnings.push(new Error(`Sanitizer: attribute '${attr}' of <${origTagName}> was discarded.`));
                }
            }
            node2.setAttribute('class', '');
            const classes = [];
            for (const cls of node.classList) {
                if (classWhiteList.has(cls)) {
                    node2.classList.add(cls);
                }
                else {
                    warnings.push(new Error(`Sanitizer: class '${cls}' of <${origTagName}> was discarded.`));
                }
            }
            for (const child of node.childNodes) {
                const child2 = sanitizeHelper(child, warnings);
                if (child2 !== undefined) {
                    node2.appendChild(child2);
                }
            }
            return node2;
        }
        else {
            warnings.push(new Error(`Sanitizer: element of type <${origTagName}> was discarded.`));
        }
    }
    else {
        warnings.push(new Error(`Sanitizer: node of type ${node.nodeName} was discarded.`));
    }
    return undefined;
}
export function sanitize(elem) {
    const warnings = [];
    const elem2 = sanitizeHelper(elem, warnings);
    if (elem2 === undefined) {
        throw new Error('sanitize returned an empty document.');
    }
    else if (elem2 instanceof HTMLElement) {
        return [elem2, warnings];
    }
    else {
        throw new Error('sanitize returned a non-element.');
    }
}
//# sourceMappingURL=sanitizeHtml.js.map