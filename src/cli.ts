#! /usr/bin/env node
/* eslint-disable no-console */
import fs from 'fs';
import syncGDrive, { IKeyConfig } from './';

async function main () {
    try {
        let okay = true;
        const clientEmail = process.env.GOOGLE_CLIENT_EMAIL;
        if (!clientEmail) {
            console.log('No client email specified. Be sure to set GOOGLE_CLIENT_EMAIL env variable.');
            okay = false;
        }

        let privateKey = process.env.GOOGLE_PRIVATE_KEY;
        if (!privateKey) {
            console.log('No Google API private key specified. Be sure to set GOOGLE_PRIVATE_KEY env variable.');
            okay = false;
        }

        if (!okay) {
            process.exit(1);
        }

        // Unescape new lines
        privateKey = privateKey.replace(/\\n/g, '\n');

        console.log('>>', clientEmail);
        console.log('>>', privateKey);
        if (process.argv.length < 4) {
            console.log('usage: sync-gdrive <drive_file_folder_id> <dest_path>');
            process.exit(1);
        }

        const fileFolderId = process.argv[2];
        const destFolder = process.argv[3];

        try {
            fs.accessSync(destFolder, fs.constants.R_OK | fs.constants.W_OK);
        } catch (error) {
            console.log(`Destination folder '${destFolder}' does not exist or is not writable by current user`);
            process.exit(1);
        }

        const keyConfig: IKeyConfig = {
            clientEmail: clientEmail,
            privateKey: privateKey
        };

        console.log(`Syncing Google Drive file/folder of id '${fileFolderId}' to '${destFolder}'`);
        await syncGDrive(fileFolderId, destFolder, keyConfig);
    } catch (error) {
        console.log(error);
    }
}

if (require.main === module) {
    main();
}