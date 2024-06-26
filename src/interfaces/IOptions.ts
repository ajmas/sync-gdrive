interface IOptions {
    verbose?: boolean,
    callback?: Function,
    docsFileType?: string,
    sheetsFileType?: string,
    slidesFileType?: string,
    mapsFileType?: string,
    fallbackGSuiteFileType?: string,
    abortOnError?: boolean,
    logger?: any,
    sleepTime?: number,
    supportsAllDrives?: boolean,
    includeItemsFromAllDrives?: boolean
}

export default IOptions;