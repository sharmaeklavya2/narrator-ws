#!/usr/bin/env node

import { readFile, writeFile } from 'node:fs/promises';
import { csvToHtml } from "../code/convert.js";
import yargs from 'yargs';

function getExt(fname) {
    const i = fname.lastIndexOf('.');
    if (i === -1) {
        return undefined;
    }
    return fname.slice(i+1).toLowerCase();
}

async function main() {
    const args = yargs(process.argv.slice(2))
        .option('input', {alias: 'i', type: 'string', demandOption: true,
            describe: "path to input file"})
        .option('output', {alias: 'o', type: 'string', demandOption: true,
            describe: "path to HTML output file"})
        .help()
        .parse();

    const ext = getExt(args.input);
    if(ext === 'csv' || ext === 'tsv') {
        const input = await readFile(args.input, {encoding: 'utf8'});
        const lines = csvToHtml(input);
        await writeFile(args.output, lines.join('\n'));
    }
    else {
        throw new Error('unknown input file type ' + fmt);
    }
}

await main();
