import fs from 'fs';
import path from 'path';
import os from 'os';
import { promisify } from 'util';

import { describe, before, after, it } from 'mocha';
import { expect } from 'chai';

import dotenv from 'dotenv';
import rimraf from 'rimraf';

import syncGDrive, { IKeyConfig } from '../src';

interface BasicFileInfo {
    path: string,
    size: number
}

const fsMkdtemp = promisify(fs.mkdtemp);
const fsReaddir = promisify(fs.readdir);
const fsStat = promisify(fs.stat);
const asyncRimraf = promisify(rimraf);


let expectedManifest: BasicFileInfo[];

const removeTmpFolder = false;
let tmpFolder = '';
let filefolderId;
let privateKey;
let clientEmail;

async function createdExpectedManifest (baseDir: string): Promise<BasicFileInfo[]> {
    const walkList: string[] = [];
    const manifest: BasicFileInfo[] = [];

    walkList.push(baseDir);
    while (walkList.length > 0) {
        const dirpath = walkList.pop() as string;
        const files = await fsReaddir(dirpath, { withFileTypes: true });
        for (let i = 0; i < files.length; i++) {
            if (files[i].isDirectory()) {
                walkList.push(path.join(dirpath, files[i].name));
            } else if (files[i].isFile()) {
                const filepath = path.join(dirpath, files[i].name);
                const stats = await fsStat(filepath);
                manifest.push({
                    path: filepath.substring(baseDir.length + 1),
                    size: stats.size
                })
            }
        }
    }

    return manifest;
}

describe('Endpoints', async () => {

    before(async () => {
        dotenv.config();

        filefolderId = process.env.GDRIVE_FILEFOLDER_ID;
        if (!filefolderId) {
            throw new Error('No Google Drive file or folder id specified. Be sure to set GDRIVE_FILEFOLDER_ID  env variable.');
        }

        clientEmail = process.env.GOOGLE_CLIENT_EMAIL;
        if (!clientEmail) {
            throw new Error('No client email specified. Be sure to set GOOGLE_CLIENT_EMAIL env variable.');
        }

        privateKey = process.env.GOOGLE_PRIVATE_KEY;
        if (!privateKey) {
            throw new Error('No Google API private key specified. Be sure to set GOOGLE_PRIVATE_KEY env variable.');
        }

        privateKey = privateKey.replace(/\\n/g, '\n').trim();

        tmpFolder = await fsMkdtemp(path.join(os.tmpdir(), 'tmp-sync-gdrive'));

        expectedManifest = await createdExpectedManifest('test_data');
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
        expect(syncedFileFolders).to.be.not.undefined;

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
