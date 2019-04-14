import * as path from 'path';
import * as shell from "shelljs";

export const minimumSlitherVersion : string = '0.4.0'; // minimum supported slither version.
export const solcPath : string = "solc"; // solc command path
export const slitherPath : string = "slither"; // slither command path
export const slitherStoragePath : string = "./.slither"; // Directory relative to workspace to store files.
export const storageResultsFileName : string = "slither-results.json";

export function isDebuggingExtension() : boolean {
    const debugRegex = /^--inspect(-brk)?=?/;
    return process.execArgv ? process.execArgv.some(arg => debugRegex.test(arg)) : false;
}

export function createStorageDirectory(workspaceFolder : string) {
    let storageDirectory : string = getStorageDirectoryPath(workspaceFolder);
    shell.mkdir("-p", storageDirectory);
}

export function getStorageDirectoryPath(workspaceFolder : string) {
    return path.join(workspaceFolder, slitherStoragePath);
}

export function getStorageFilePath(workspaceFolder : string, fileName : string) {
    let storageDirectory : string = getStorageDirectoryPath(workspaceFolder);
    return path.join(storageDirectory, storageResultsFileName);
}