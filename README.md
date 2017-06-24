Sync GDrive
===========

This is a library to allow you to synchronise a file or directory in Google Drive with the local file system. Currently this solution provides a one way sync from Google Drive to the local file system.

This code was orginally developped for the maison-notman-house API server, but it was felt that it would have more value as module that could be used by other projects.

The orginal solution had been created with the idea of using Google Drive as a simple CMS and then periodically synchronising the specified folder with the local file system, for use with the running API server.

Code is written with ES6 in mind.

**WARNING** Before using, note that any files or folders in your local sync folder will be wiped, so ensure you start with an empty folder.

Usage:

```
const gdriveSync = require('sync-gdrive');
gdriveSync(fileOrFolderId, baseFolder, key);
```

Where:

   * **fileOrFolderId** id of directory or file on Google Drive
   * **baseFolder** local folder that should be synchronised. Note any existing files in this folder will be wiped if they don't correspond to something upstream.
   * **key** Your key generated from the [Google API console](https://console.developers.google.com/apis/dashboard).

   
Further reading:

   * [googleapis](https://www.npmjs.com/package/googleapis) npm module

Contributors
------------

  * Andre John Mas

License
-------

Licensed using the MIT license. See: https://opensource.org/licenses/MIT
