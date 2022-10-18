import { utimesSync, createWriteStream, promises as fs} from 'fs';
import path from 'path';

import { google, drive_v3 } from 'googleapis';
import mime from 'mime';

import IKeyConfig from './interfaces/IKeyConfig';
import IOptions from './interfaces/IOptions';
import ISyncState from './interfaces/ISyncState';

type Drive = drive_v3.Drive;
type File = drive_v3.Schema$File;

function sleep(timeout: number = 1000, value?: any) {
    return new Promise(function (resolve, reject) {
        setTimeout(function() {
            resolve(value);
        }, timeout);
    });
}

function sanitiseFilename(filename: string) {
    return filename.replace(/[/\\\r\n\t]/g, '_');
}

// Provide a default log function
function log(level: string, ...message: any[]) {
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
        mapsFileType: 'kml',
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
function timeAsSeconds(datetime: string | number | Date): number {
    let timeInMilliseconds = 0;
    if (typeof datetime === 'string') {
        timeInMilliseconds = Date.parse(datetime);
    } else if (datetime instanceof Date) {
        timeInMilliseconds = datetime.getTime();
    } else {
        timeInMilliseconds = datetime as number;
    }

    return timeInMilliseconds / 1000;
}

/**
 * Checkes to see if the GDrive file is newer than the local file
 *
 * @param file
 * @param path
 */
async function isGDriveFileNewer(gDriveFile: File, filePath: string) {
    try {
        const stats = await fs.stat(filePath);
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

async function downloadFile (drive: Drive, file, destFolder: string, options: IOptions = {}) {
    const filePath = path.join(destFolder, sanitiseFilename(file.name));
    if (await isGDriveFileNewer(file, filePath)) {
        if (options.verbose) {
            options.logger.debug('downloading newer: ', filePath);
            options.logger.debug('creating file: ', filePath);
        }
        const dest = createWriteStream(filePath);

        let fileId = file.id;
        if (file.shortcutDetails) {
            fileId = file.shortcutDetails.targetId;
        }

        const response = await drive.files.get({
            fileId: fileId,
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
                    utimesSync(
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

async function exportFile (drive: Drive, file: File, destFolder: string, mimeType: string, suffix: string, options: IOptions = {}): Promise<ISyncState> {
    const name = sanitiseFilename(file.name) + suffix;
    const filePath = path.join(destFolder, name);

    if (await isGDriveFileNewer(file, filePath)) {
        if (options.verbose) {
            options.logger.debug('downloading newer: ', filePath);
            options.logger.debug('exporting to file: ', filePath);
        }

        const dest = createWriteStream(filePath);

        let fileId = file.id;
        if (file.shortcutDetails) {
            fileId = file.shortcutDetails.targetId;
        }

        // For Google Docs files only
        const response = await drive.files.export({
            fileId, mimeType
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
                    utimesSync(
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


async function downloadContent (drive: Drive, file: File, path: string, options: IOptions) {
    let result;

    let fileMimeType = file.mimeType;
    if (file.shortcutDetails) {
        fileMimeType = file.shortcutDetails.targetMimeType;
    }

    if (file.mimeType === 'application/vnd.google-apps.document') {
        const exportimeType = mime.getType(options.docsFileType);
        result = await exportFile(drive, file, path, exportimeType, `.${options.docsFileType}`, options);
    } else if (fileMimeType === 'application/vnd.google-apps.spreadsheet') {
        const exportimeType = mime.getType(options.sheetsFileType);
        result = await exportFile(drive, file, path, exportimeType, `.${options.sheetsFileType}`, options);
    } else if (fileMimeType === 'application/vnd.google-apps.presentation') {
        const exportimeType = mime.getType(options.slidesFileType);
        result = await exportFile(drive, file, path, exportimeType, `.${options.slidesFileType}`, options);
    } else if (fileMimeType === 'application/vnd.google-apps.map') {
        const exportimeType = mime.getType(options.mapsFileType);
        result = await exportFile(drive, file, path, exportimeType, `.${options.mapsFileType}`, options);
    } else if (fileMimeType && fileMimeType.startsWith('application/vnd.google-apps')) {
        // eslint-disable-next-line no-console
        const exportimeType = mime.getType(options.fallbackGSuiteFileType);
        result = await exportFile(drive, file, path, exportimeType, `.${options.fallbackGSuiteFileType}`, options);
    } else {
        // eslint-disable-next-line no-console
        result = await downloadFile(drive, file, path, options);
    }

    return result;
}


async function visitDirectory (drive: Drive, fileId: string, folderPath: string, options: IOptions, callback?: Function): Promise<ISyncState[]> {

    let nextPageToken;
    let allSyncStates: ISyncState[] = [];

    do {
        const response = await drive.files.list({
            pageToken: nextPageToken,
            spaces: 'drive',
            fields: 'nextPageToken, files(id, name, parents, mimeType, createdTime, modifiedTime, shortcutDetails)',
            q: `'${fileId}' in parents`,
            pageSize: 200
        });

        // Needed to get further results
        nextPageToken = response.data.nextPageToken;

        const files = response.data.files;

        for (let i = 0; i < files.length; i++) {
            const file = files[i];

            if (file.mimeType === 'application/vnd.google-apps.folder') {
                const childFolderPath = path.join(folderPath, file.name);

                if (options.verbose) {
                    options.logger.debug('DIR', file.id, childFolderPath, file.name)
                }

                await fs.mkdir(childFolderPath, { recursive: true });
                if (options.sleepTime) {
                    await sleep(options.sleepTime);
                }
                const syncState = await visitDirectory(drive, file.id, childFolderPath, options);
                allSyncStates = allSyncStates.concat(syncState);
            } else {
                if (options.verbose) {
                    options.logger.debug('DIR', file.id, folderPath, file.name)
                }
                const syncState = await downloadContent(drive, file, folderPath, options);
                allSyncStates.push(syncState);
            }
        }
    // continue until there is no next page
    } while (nextPageToken);

    return allSyncStates;
}

async function fetchContents(drive: Drive, fileId: string, destFolder: string, options: IOptions) {
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


async function syncGDrive (fileFolderId: string, destFolder: string, keyConfig: IKeyConfig, options?: IOptions) {
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

        return fetchContents(drive, fileFolderId, destFolder, initIOptions(options));
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
