// from https://www.npmjs.com/package/html-escaper (MIT licensed)

const replace = ''.replace;
const pattern = /[&<>'"]/g;

const escapedMap: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    "'": '&#39;',
    '"': '&quot;'
};

/**
 * Safely escape HTML entities such as `&`, `<`, `>`, `"`, and `'`.
 * @param {string} x the input to safely escape
 * @returns {string} the escaped input, and it **throws** an error if
 *  the input type is unexpected, except for boolean and numbers,
 *  converted as string.
 */
export function escape(x: string): string {
    return replace.call(x, pattern, (ch => escapedMap[ch]));
}
