# Sync GDrive


This is a library to allow you to synchronise a file or directory in Google Drive with the local file system. Currently this solution provides a one way sync from Google Drive to the local file system.

This code was orginally developped for the maison-notman-house API server, but it was felt that it would have more value as module that could be used by other projects.

The orginal solution had been created with the idea of using Google Drive as a simple CMS and then periodically synchronising the specified folder with the local file system, for use with the running API server.

This current version is written in Typescript and leverages async/await internally.

**WARNING** Before using, note that any files or folders in your local sync folder will be overwitten,
so ensure you start with an empty folder.

Usage:

```js
// Regular JS
const gdriveSync = require('sync-gdrive');

const keyConfig = {
  clientEmail: process.env.GOOGLE_CLIENT_EMAIL,
  privateKey: process.env.GOOGLE_PRIVATE_KEY
};

const options = {};

await syncGDrive(fileOrFolderId, destFolder, keyConfig, options);
```

```ts
// Typescript
import syncGDrive, { IKeyConfig } from 'sync-gdrive';

const keyConfig: IKeyConfig = {
  clientEmail: process.env.GOOGLE_CLIENT_EMAIL,
  privateKey: process.env.GOOGLE_PRIVATE_KEY
};

const options = {};

await syncGDrive(fileOrFolderId, destFolder, keyConfig, options);
```

Where:

   - **fileOrFolderId** id of directory or file on Google Drive
   - **destFolder** local folder that should be synchronised. Note any existing files in this folder will be wiped if they don't correspond to something upstream.
   - **keyConfig** Your key generated from the [Google API console](https://console.developers.google.com/apis/dashboard).
   - **options** optional parameter, allowing for tweaking of certain functionality:

     - verbose: if true displays debug info (default: false)
     - callback: callback when a file is synced (default: undefined)
     - docsFileType: file type to use when exporting a Google Doc (default: docx )
     - sheetsFileType: file type to use when exporting a Google Sheet (default: xlsx)
     - slidesFileType: file type to use when exporting Google Slides (default: pdf)
     - fallbackGSuiteFileType: file type to use when exporting other GSuite files (default: pdf),
     - abortOnError: whether to abort on an error,
     - logger: logger to use in verbose mode, must have support for debug, warn and error functions
     - sleepTime: Rate limiter. How long to wait, in milleseconds, after downloading a file. (default: 500)


Further reading:

   - [googleapis](https://www.npmjs.com/package/googleapis) npm module
   - [supported export types](https://developers.google.com/drive/api/v3/ref-export-formats)

## CLI

There is now a basic CLI, so you can use this package without needing to integrate it into
a JS application first. You can install it either globally (assuming a Unix type environment):

```bash
npm install -g sync-gdrive
export GOOGLE_CLIENT_EMAIL="xxxxxx"
export GOOGLE_PRIVATE_KEY="xxxxxx"
sync-gdrive "filefolderid" "dest_folder"
```

or if you already installed it as a dependency of your project:

```bash
export GOOGLE_CLIENT_EMAIL="xxxxxx"
export GOOGLE_PRIVATE_KEY="xxxxxx"
./node_modules/.bin/sync-gdrive "filefolderid" "dest_folder"
```

### Targeted environments

This project will not work in the browser, due to dependencies on the
file system.

Targeted node.js versions are 10.12+

## Contributions & Feedback

Contributions and feedback is welcome. Please open
a ticket in the issue tracker for the project on GitHub

## Contributors


  * Andre John Mas

## License


Licensed using the MIT license. See: https://opensource.org/licenses/MIT
