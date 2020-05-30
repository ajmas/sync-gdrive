import fs from 'fs';
import path from 'path';
import os from 'os';
import { promisify } from 'util';

import { describe, before, after, it } from 'mocha';
import chai, { expect } from 'chai';

import dotenv from 'dotenv';
import rimraf from 'rimraf';

import syncGDrive, { IKeyConfig } from '../src';

const fsMkdtemp = promisify(fs.mkdtemp);
const asyncRimraf = promisify(rimraf);

const expectedManifest = [{
   path: 'gsuite-docs/Hello doc.docx',
   size: 6099
}, {
    path: 'gsuite-docs/Hello slides.pdf',
    size: 15787
}, {
    path: 'gsuite-docs/Hello sheets.xlsx',
    size: 4709
}];

const removeTmpFolder = false;
let tmpFolder = '';
let filefolderId;
let privateKey;
let clientEmail;

describe('Endpoints', async () => {

    before(async () => {
        dotenv.config();

        filefolderId = process.env.GDRIVE_FILEFOLDER_ID;
        if (!filefolderId) {
            throw new Error('No Google Drive file or folder id specified. Be sure to set env GDRIVE_FILEFOLDER_ID.');
        }

        clientEmail = process.env.GOOGLE_CLIENT_EMAIL;
        if (!clientEmail) {
            throw new Error('No client email specified. Be sure to set GOOGLE_CLIENT_EMAIL.');
        }

        privateKey = process.env.GOOGLE_PRIVATE_KEY;
        if (!privateKey) {
            throw new Error('No Google API privaye key specified. Be sure to set GOOGLE_PRIVATE_KEY.');
        }

        privateKey = privateKey.trim();

        tmpFolder = await fsMkdtemp(path.join(os.tmpdir(), `tmp-sync-gdrive}`));

    });

    it('Should sync files from folder on drive', async function () {
        this.timeout(30000);

        const keyConfig: IKeyConfig = {
            clientEmail: clientEmail,
            privateKey: privateKey
        };

        const syncedFileFolders = await syncGDrive(filefolderId, tmpFolder, keyConfig, { verbose: false });

        const filefolderByPath = {};

        expect(syncedFileFolders).to.be.not.null;

        syncedFileFolders.forEach(filefolder => {
            filefolderByPath[filefolder.file] = filefolder;
        })

        // loop through the manifest of expected files and check they
        // match expectations
        expectedManifest.forEach(filefolder => {
            const filefolderPath = path.join(tmpFolder, filefolder.path);

            expect(syncedFileFolders).to.be.not.null;
            expect(filefolderByPath).to.have.property(filefolderPath);

            const stats = fs.statSync(filefolderPath);

            expect(stats.size).to.equal(filefolder.size);
        });
    });

    after(async () => {
        if (removeTmpFolder) {
            await asyncRimraf(tmpFolder);
        }
    });
});
