export function parseLine(line: string, delimiter: string): string[] {
    if(line.includes('"')) {
        throw new Error('Quotes are not yet implemented in CSV parsing.');
    }
    return line.split(delimiter);
}

export default function parse(text: string, delimiter: string): [string[], Record<string, string>[]] {
    const lines = text.trim().split('\n');
    if(lines.length === 0) {
        throw new Error('Empty CSV file.');
    }
    const header = parseLine(lines[0], delimiter);
    const data = [];
    for(let i=1; i < lines.length; ++i) {
        const cells = parseLine(lines[i], delimiter);
        const m = Math.min(header.length, cells.length);
        const obj: Record<string, string> = {};
        for(let j=0; j<m; ++j) {
            obj[header[j]] = cells[j];
        }
        data.push(obj);
    }
    return [header, data];
}
