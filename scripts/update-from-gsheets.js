import { readFile, writeFile } from 'node:fs/promises';

async function downloadFile(url, fname, prefix) {
    console.debug(`Fetching ${fname} from ${url}.`);
    const response = await fetch(url);
    if(!response.ok) {
        throw new Error(`Failed to fetch ${fname}.`);
    }
    const data = await response.arrayBuffer();
    const fullFname = (prefix === undefined) ? fname : prefix + '/' + fname;
    await writeFile(fullFname, Buffer.from(data));
    console.debug(`Wrote ${fname}.`);
}

async function main() {
    const g2cRaw = await readFile('gsheet-to-csv.json', {encoding: 'utf8'});
    const csvToIdMap = JSON.parse(g2cRaw);

    let fnames = process.argv.slice(2);
    if(fnames.length === 0) {
        fnames = Object.keys(csvToIdMap);
        // fnames.sort();
    }
    console.log('file names:', JSON.stringify(fnames));

    const promises = [];
    for(const fname of fnames) {
        const id = csvToIdMap[fname];
        const url = `https://docs.google.com/spreadsheets/d/${id}/export?format=csv`;
        promises.push(downloadFile(url, fname, 'articles'));
    }

    await Promise.all(promises);
}

await main();
