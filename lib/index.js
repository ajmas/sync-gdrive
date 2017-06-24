const fs = require('fs-extra');

const Promise = require('bluebird');
const google = require('googleapis');
const OAuth2 = google.auth.OAuth2;


function sleep(timeout, value) {
    var startTime = new Date().getTime();
    return new Promise(function (resolve, reject) {
         setTimeout(function() {
            resolve(value);
         }, timeout);
    });
}

function timeAsSeconds(time) {
    if (typeof time === 'string') {
        return Date.parse(time) / 1000;
    } else if (time instanceof Date) {
        return time.getTime() / 1000;
    }
}

function isGDriveFileNewer(file, path) {
    try {
        var stats = fs.statSync(path);
        var fsModifiedTime = timeAsSeconds(stats.mtime);
        var driveModifiedTime = timeAsSeconds(file.modifiedTime);
        return (driveModifiedTime > fsModifiedTime);
    } catch (err) {
        if (err.code === 'ENOENT') {
            return true;
        } else {
            throw err;
        }
    }
}

function downloadFile(drive, file, path, callback) {
    var filePath = path.concat(file.name).join('/');
    if (isGDriveFileNewer(file, filePath)) {
        console.log('downloading newer: ', filePath);
        console.log('creating file: ', filePath);
        var dest = fs.createWriteStream(filePath);

        // For Google Docs files only
       return new Promise(function (resolve, reject) {
            drive.files.get({
                    fileId: file.id,
                    alt: 'media'
                })
                .on('end', function() {
                    console.log('Done, download: ', filePath);
                    fs.utimesSync(
                        filePath,
                        timeAsSeconds(file.createdTime),
                        timeAsSeconds(file.modifiedTime)
                    );
                    resolve({
                        file: filePath,
                        updated: true
                        });

                })
                .on('error', function(err) {
                    console.log('Error during download', err);
                    reject(err);
                })
                .pipe(dest);
            });
    } else {
        return Promise.resolve();
    }
}

function exportFile(drive, file, path, mimeType, suffix) {
    var name = file.name + suffix;
    var filePath = path.concat(name).join('/');

    if (isGDriveFileNewer(file, filePath)) {
        console.log('downloading newer: ', filePath);
        console.log('exporting to file: ', filePath);
        var dest = fs.createWriteStream(filePath);

        return new Promise(function (resolve, reject) {
            // For Google Docs files only
            drive.files.export({
                    fileId: file.id,
                    mimeType: mimeType
                }, {
                    encoding: null // Make sure we get the binary data
                })
                .on('end', function() {
                    console.log('Done, download: ', filePath);
                    fs.utimesSync(
                        filePath,
                        timeAsSeconds(file.createdTime),
                        timeAsSeconds(file.modifiedTime)
                    );
                    resolve({
                        file: filePath,
                        updated: true
                        });

                })
                .on('error', function(err) {
                    console.log('error', 'Error during download', err);
                    reject(err);
                })
                .pipe(dest);
            });
    } else {
        return Promise.resolve();
    }
}


function downloadContent(drive, file, path, callback) {

    var promise;

    if (file.mimeType === 'application/vnd.google-apps.document') {
        promise = exportFile(drive, file, path, 'application/pdf', '.pdf');
    } else if (file.mimeType === 'application/vnd.google-apps.spreadsheet') {
        promise = exportFile(drive, file, path, 'text/csv', '.csv');
    } else if (file.mimeType && file.mimeType.startsWith('application/vnd.google-apps')) {
        console.log('unhandled Google Doc type: ', file.mimeType);
        promise = new Promise.resolve({ unhandled: file.name });
    } else {
        promise = downloadFile(drive, file, path, callback);
    }

    return promise;
}


function visitDirectory(drive, fileId, parentPath, callback) {

    return new Promise(function(resolve, reject) {
        drive.files.list({
            includeRemoved: false,
            spaces: 'drive',
            fileId: fileId,
            fields: 'nextPageToken, files(id, name, parents, mimeType, createdTime, modifiedTime)',
            q: `'${fileId}' in parents`
        }, function(err, resp) {
            var promiseSeq = [];
            var allResults = [];
            var sequence = Promise.resolve([]);

            if (!err) {
                var i;
//                 console.log(resp);
                var files = resp.files;

                for (i = 0; i < files.length; i++) {
                    const file = files[i];
                    const idx = i;
                    if (file.mimeType == 'application/vnd.google-apps.folder') {
                        const path = parentPath.concat(file.name);
                        sequence = sequence.then(function () {
                            console.log(`Go ${path} ${idx}`);
                            try {
                                fs.mkdirp(path.join('/'));
                            } catch (err) {
                                // Ignored
                            }

                            return sleep(1000).then(visitDirectory(drive, file.id, path));
                        });

                    } else {
                        sequence = sequence.then(function ( value ) {
                            return downloadContent(drive, file, parentPath);
                        });
                    }

                    sequence = sequence.then(function (result) {
                        if (result) {
                            if (Array.isArray(result)) {
                                allResults = allResults.concat(result);
                            } else {
                                allResults.push(result);
                            }
                        }
                        return result;
                    });
                }

            } else {
                console.log('error: ', err);
            }


            sequence.then(function () {
                resolve(allResults);
                });

        });
    });
}

function fetchContents(drive, fileId, downloadDir) {
    return new Promise(function (resolve, reject) {
        drive.files.get({
            fileId: fileId,
            fields: 'id, name, parents, mimeType, createdTime, modifiedTime',
        }, function(err, resp) {
            if (err) {
                reject(err);
            } else if (resp) {
                if (resp.mimeType == 'application/vnd.google-apps.folder') {
                    return visitDirectory(drive, fileId, [downloadDir])
                        .then(function (result) {
                            resolve(result);
                        });
                } else {
                    return downloadContent(drive, resp, [downloadDir], callback)
                        .then(function (result) {
                            resolve(result);
                        });
                }
            }
        });
    })
}


function sync(fileFolderId, baseFolder, key) {
    return new Promise(function(resolve, reject) {
        var jwtClient = new google.auth.JWT(
            key.client_email,
            null,
            key.private_key, ['https://www.googleapis.com/auth/drive.readonly'],
            null
        );

        const drive = google.drive({
            version: 'v3',
            auth: jwtClient
        });

        jwtClient.authorize(function(err, tokens) {
            if (err) {
                reject(err)
                return;
            }

            // Note: only the callback for a single file has been tested.
            //       the callback for a directory is currently broken
            return fetchContents(drive, fileFolderId, baseFolder)
                .then(function(result) {
                    console.log('finished', result);
                    resolve(result);
                });
        });
    });
}

module.exports.sync = sync;

// ref: https://developers.google.com/drive/v3/web/folder
// ref: https://www.npmjs.com/package/googleapis
// ref: https://developers.google.com/drive/v3/web/search-parameters
// ref: https://developers.google.com/drive/v3/web/manage-downloads
// ref: https://developers.google.com/drive/v3/reference/files#resource