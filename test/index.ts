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

const removeTmpFolder = false;
let tmpFolder = '';

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

describe('Endpoints', async () => {

    before(async () => {
        dotenv.config();

        if (!process.env.GDRIVE_FILEFOLDER_ID) {
            throw new Error('No Google Drive file or folder id specified. Be sure to set env GDRIVE_FILEFOLDER_ID.');
        }

        if (!process.env.GOOGLE_CLIENT_EMAIL) {
            throw new Error('No client email specified. Be sure to set GOOGLE_CLIENT_EMAIL.');
        }

        if (!process.env.GOOGLE_PRIVATE_KEY) {
            throw new Error('No Google API privaye key specified. Be sure to set GOOGLE_PRIVATE_KEY.');
        }

        const x = process.env.GOOGLE_PRIVATE_KEY.replace(' ', '');
        console.log('XXX',x, x.length);
        tmpFolder = await fsMkdtemp(path.join(os.tmpdir(), `tmp-sync-gdrive}`));

    });

    it('Should sync files from folder on drive', async function () {
        this.timeout(30000);

        const keyConfig: IKeyConfig = {
            clientEmail: process.env.GOOGLE_CLIENT_EMAIL,
            privateKey: process.env.GOOGLE_PRIVATE_KEY
        };

        const folderId = process.env.GDRIVE_FILEFOLDER_ID;

        const syncedFileFolders = await syncGDrive(folderId, tmpFolder, keyConfig, { verbose: false });

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
