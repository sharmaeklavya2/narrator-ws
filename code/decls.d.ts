declare module "articleEntries.json" {
    const articleEntries: {id: string, category: string, path: string, shortLabel?: string, label: string}[];
    export default articleEntries;
}

declare module "langsInfo.json" {
    const langsInfo: {code: string, name: string, group?: string, nativeName?: string}[];
    export default langsInfo;
}
