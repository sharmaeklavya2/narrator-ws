function myIndexOf(line: string, query: string, start: number): number {
    const j = line.indexOf(query, start);
    return j === -1 ? line.length : j;
}

export function splitIntoLines(text: string): string[] {
    return text.split('\r').join('').split('\n');
}

export function parseLine(line: string, delimiter: string, lineNo: number): string[] {
    if(!line.includes('"')) {
        return line.split(delimiter);
    }
    const cells: string[] = [], parts: string[] = [];
    const n = line.length;
    let i = 0;
    let inQuote = false;
    while(i <= n) {
        const jq = myIndexOf(line, '"', i);
        if(inQuote) {
            if(jq === n) {
                throw new Error(`Unclosed quote in CSV (line ${lineNo+1}).`);
            }
            else if(jq < n-1 && line[jq+1] === '"') {
                // double quotes
                parts.push(line.slice(i, jq+1));
                i = jq + 2;
            }
            else {
                // end of quote
                parts.push(line.slice(i, jq));
                i = jq + 1;
                inQuote = false;
            }
        }
        else {
            const jc = myIndexOf(line, delimiter, i);
            if(jc <= jq) {
                // end of cell
                parts.push(line.slice(i, jc));
                cells.push(parts.join(''));
                parts.length = 0;
                i = jc + 1;
            }
            else {
                // quotation starts
                parts.push(line.slice(i, jq));
                i = jq + 1;
                inQuote = true;
            }
        }
    }
    return cells;
}

/* Tests:
console.log(parseLine('', ','));
console.log(parseLine(',', ','));
console.log(parseLine('"",""""', ','));
console.log(parseLine('"a,b","""c,d"""', ','));
*/

function guessDelimiter(line: string): string {
    const chars = ',|;\t';
    let count = 0;
    let last: string = '';
    for(const c of chars) {
        if(line.includes(c)) {
            count++;
            last = c;
        }
    }
    if(count === 1) {
        return last;
    }
    else {
        throw new Error(`Unable to guess delimiter in ${JSON.stringify(line)}.`);
    }
}

export default function parse(text: string, delimiter?: string): [string[], Record<string, string>[]] {
    const lines = splitIntoLines(text.trim());
    if(lines.length === 0) {
        throw new Error('Empty CSV file.');
    }
    if(delimiter === undefined) {
        delimiter = guessDelimiter(lines[0]);
    }
    const header = parseLine(lines[0], delimiter, 0);
    const data = [];
    for(let i=1; i < lines.length; ++i) {
        const cells = parseLine(lines[i], delimiter, i);
        const m = Math.min(header.length, cells.length);
        const obj: Record<string, string> = {};
        for(let j=0; j<m; ++j) {
            obj[header[j]] = cells[j];
        }
        data.push(obj);
    }
    return [header, data];
}
