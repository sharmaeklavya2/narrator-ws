import {default as parseCsv} from "./csv.js";
import {escape} from "./escapeHtml.js";

function valuesAreEmpty(d: Record<string, string>): boolean {
    for(const [k, v] of Object.entries(d)) {
        if(v !== '') {
            return false;
        }
    }
    return true;
}

export function csvToHtml(text: string, delimiter?: string): string[] {
    const [header, data] = parseCsv(text, delimiter);
    const lines = [
        '<!DOCTYPE html>',
        `<html lang="${header[0]}">`,
        '<head>',
        '<meta charset="utf-8"/>',
        '</head>',
        '<body>',
        ];

    let inPara = false;
    for(const row of data) {
        if(valuesAreEmpty(row)) {
            if(inPara) {
                inPara = false;
                lines.push('</p>');
            }
        }
        else {
            if(!inPara) {
                inPara = true;
                lines.push('<p>');
            }
            for(const [lang, sentence] of Object.entries(row)) {
                if(sentence !== '') {
                    lines.push(`<span lang="${lang}">${escape(sentence)}</span>`);
                }
            }
        }
    }
    if(inPara) {
        lines.push('</p>');
    }
    lines.push('</body>', '</html>');
    return lines;
}
