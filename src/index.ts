import fs from 'fs-extra';
import path from 'path';
import { promisify } from 'util';

import { google } from 'googleapis';
import mime from 'mime';

import IKeyConfig from './interfaces/IKeyConfig';
import IOptions from './interfaces/IOptions';

const fsStat = promisify(fs.stat);

function sleep(timeout: number = 1000, value?: any) {
    return new Promise(function (resolve, reject) {
        setTimeout(function() {
            resolve(value);
        }, timeout);
    });
}

// Provide a default log function
function log(level, ...message) {
    // eslint-disable-next-line no-console
    console.log(`[${level}] ${message.join(' ')}`);
}

/**
 * Initialise default options and validate user provided option
 * values are valid.
 *
 * @param options
 */
function initIOptions(options: IOptions = {}): IOptions {
    const defaultIOptions: IOptions = {
        verbose: false,
        callback: undefined,
        docsFileType: 'docx',
        sheetsFileType: 'xlsx',
        slidesFileType: 'pdf',
        fallbackGSuiteFileType: 'pdf',
        abortOnError: true,
        logger: {
            debug: log.bind(this, 'debug'),
            warn: log.bind(this, 'warn'),
            error: log.bind(this, 'error')
        },
        sleepTime: 1000
    };

    const mergedIOptions = Object.assign({}, defaultIOptions, options);

    // remove the leading fullstop, if provided
    if (mergedIOptions.docsFileType.startsWith('.')) {
        mergedIOptions.docsFileType = mergedIOptions.docsFileType.substring(1);
    }

    // remove the leading fullstop, if provided
    if (mergedIOptions.sheetsFileType.startsWith('.')) {
        mergedIOptions.sheetsFileType = mergedIOptions.sheetsFileType.substring(1);
    }

    // remove the leading fullstop, if provided
    if (mergedIOptions.slidesFileType.startsWith('.')) {
        mergedIOptions.slidesFileType = mergedIOptions.slidesFileType.substring(1);
    }

    if (!mime.getType(mergedIOptions.docsFileType)) {
        throw new Error(`Unable to resolve mime type for Google Docs export: ${mergedIOptions.docsFileType}`);
    }

    if (!mime.getType(mergedIOptions.sheetsFileType)) {
        throw new Error(`Unable to resolve mime type for Google Sheets export: ${mergedIOptions.sheetsFileType}`);
    }

    if (!mime.getType(mergedIOptions.slidesFileType)) {
        throw new Error(`Unable to resolve mime type for Google Sheets export: ${mergedIOptions.slidesFileType}`);
    }

    if (mergedIOptions.verbose && mergedIOptions.logger && !mergedIOptions.logger.debug) {
        throw new Error('Unable to use provided logger for verbose output');
    }

    return mergedIOptions;
}

/**
 * Converts time to seconds. If the input is
 * a number, then it is assumed to be in milliseconds.
 *
 * @param datetime
 */
function timeAsSeconds(datetime: number | Date) {
    if (typeof datetime === 'string') {
        return Date.parse(datetime) / 1000;
    } else if (datetime instanceof Date) {
        return datetime.getTime() / 1000;
    }
}

/**
 * Checkes to see if the GDrive file is newer than the local file
 *
 * @param file
 * @param path
 */
async function isGDriveFileNewer(gDriveFile, filePath: string) {
    try {
        const stats = await fsStat(filePath);
        const fsModifiedTime = timeAsSeconds(stats.mtime);
        const driveModifiedTime = timeAsSeconds(gDriveFile.modifiedTime);
        return (driveModifiedTime > fsModifiedTime);
    } catch (err) {
        if (err.code === 'ENOENT') {
            return true;
        } else {
            throw err;
        }
    }
}

async function downloadFile (drive, file, destFolder: string, options: IOptions = {}) {
    const filePath = path.join(destFolder, file.name);
    if (await isGDriveFileNewer(file, filePath)) {
        options.logger.debug('downloading newer: ', filePath);
        options.logger.debug('creating file: ', filePath);
        const dest = fs.createWriteStream(filePath);

        const response = await drive.files.get({
            fileId: file.id,
            alt: 'media'
        }, {
            responseType: 'stream'
        });

        return new Promise((resolve, reject) => {
            response.data
                .on('error', reject)
                .pipe(dest)
                .on('error', reject)
                .on('finish', () => {
                    // apply time stamp from the drive
                    fs.utimesSync(
                        filePath,
                        timeAsSeconds(file.createdTime),
                        timeAsSeconds(file.modifiedTime)
                    );
                    resolve({
                        file: filePath,
                        updated: true
                    });
                });
        });
    }

    return {
        file: filePath,
        updated: false
    };
}

async function exportFile (drive, file, destFolder: string, mimeType: string, suffix: string, options: IOptions = {}) {
    const name = file.name + suffix;
    const filePath = path.join(destFolder, name);

    if (await isGDriveFileNewer(file, filePath)) {
        if (options.verbose) {
            options.logger.debug('downloading newer: ', filePath);
            options.logger.debug('exporting to file: ', filePath);
        }

        const dest = fs.createWriteStream(filePath);

        // For Google Docs files only
        const response = await drive.files.export({
            fileId: file.id,
            mimeType: mimeType
        }, {
            responseType: 'stream'
        });

        return new Promise((resolve, reject) => {
            response.data
                .on('error', reject)
                .pipe(dest)
                .on('error', reject)
                .on('finish', () => {
                    // apply time stamp from the drive
                    fs.utimesSync(
                        filePath,
                        timeAsSeconds(file.createdTime),
                        timeAsSeconds(file.modifiedTime)
                    );
                    resolve({
                        file: filePath,
                        updated: true
                    });
                });
        });
    }

    return {
        file: filePath,
        updated: false
    };
}


async function downloadContent (drive, file, path: string, options: IOptions) {
    let result;

    if (file.mimeType === 'application/vnd.google-apps.document') {
        const mimeType = mime.getType(options.docsFileType);
        result = await exportFile(drive, file, path, mimeType, `.${options.docsFileType}`, options);
    } else if (file.mimeType === 'application/vnd.google-apps.spreadsheet') {
        const mimeType = mime.getType(options.sheetsFileType);
        result = await exportFile(drive, file, path, mimeType, `.${options.sheetsFileType}`, options);
    } else if (file.mimeType === 'application/vnd.google-apps.presentation') {
        const mimeType = mime.getType(options.slidesFileType);
        result = await exportFile(drive, file, path, mimeType, `.${options.slidesFileType}`, options);
    } else if (file.mimeType && file.mimeType.startsWith('application/vnd.google-apps')) {
        const mimeType = mime.getType(options.fallbackGSuiteFileType);
        result = await exportFile(drive, file, path, mimeType, `.${options.fallbackGSuiteFileType}`, options);
    } else {
        result = await downloadFile(drive, file, path, options);
    }

    return result;
}


async function visitDirectory (drive, fileId: string, folderPath: string, options: IOptions, callback?: Function) {
    const response = await drive.files.list({
        includeRemoved: false,
        spaces: 'drive',
        fileId: fileId,
        fields: 'nextPageToken, files(id, name, parents, mimeType, createdTime, modifiedTime)',
        q: `'${fileId}' in parents`
    });

    const { files } = response.data;
    let allSyncStates = [];
    let syncState;

    for (let i = 0; i < files.length; i++) {
        const file = files[i];

        if (file.mimeType === 'application/vnd.google-apps.folder') {
            const childFolderPath = path.join(folderPath, file.name);

            if (options.verbose) {
                options.logger.debug('DIR', file.id, childFolderPath, file.name)
            }

            await fs.mkdirp(childFolderPath);
            if (options.sleepTime) {
                await sleep(options.sleepTime);
            }
            syncState = await visitDirectory(drive, file.id, childFolderPath, options);
            allSyncStates = allSyncStates.concat(syncState);
        } else {
            if (options.verbose) {
                options.logger.debug('DIR', file.id, folderPath, file.name)
            }
            syncState = await downloadContent(drive, file, folderPath, options);
            allSyncStates.push(syncState);
        }
    }

    return allSyncStates;
}

async function fetchContents(drive, fileId: string, destFolder: string, options: IOptions) {
    const response = await drive.files.get({
        fileId: fileId,
        fields: 'id, name, parents, mimeType, createdTime, modifiedTime'
    });

    const { data } = response;

    if (data.mimeType === 'application/vnd.google-apps.folder') {
        return await visitDirectory(drive, fileId, destFolder, options);
    } else {
        return await downloadContent(drive, data, destFolder, options);
    }
}


async function syncGDrive (fileFolderId, destFolder: string, keyConfig: IKeyConfig, options?: IOptions) {
    try {
        const auth = new google.auth.JWT(
            keyConfig.clientEmail,
            null,
            keyConfig.privateKey,
            [
                'https://www.googleapis.com/auth/drive',
                'https://www.googleapis.com/auth/drive.appdata',
                'https://www.googleapis.com/auth/drive.file',
                'https://www.googleapis.com/auth/drive.metadata',
                'https://www.googleapis.com/auth/drive.metadata.readonly',
                'https://www.googleapis.com/auth/drive.photos.readonly',
                'https://www.googleapis.com/auth/drive.readonly'
            ],
            null
        );

        google.options({auth});

        const drive = google.drive('v3');

        return await fetchContents(drive, fileFolderId, destFolder, initIOptions(options));
    } catch (error) {
        log(error);
    }
}

export { syncGDrive, IKeyConfig, IOptions };
export default syncGDrive;

// ref: https://developers.google.com/drive/v3/web/folder
// ref: https://www.npmjs.com/package/googleapis
// ref: https://developers.google.com/drive/v3/web/search-parameters
// ref: https://developers.google.com/drive/v3/web/manage-downloads
// ref: https://developers.google.com/drive/v3/reference/files#resource
