import merge from "ts-deepmerge";
import * as shell from "shelljs";

export function deepClone<T>(obj: T): T {
  // Serialize and then deserialize the object for a deep clone.
  return JSON.parse(JSON.stringify(obj));
}

export function deepMerge(...objects: object[]): object {
  // Use ts-deepmerge to merge all subkeys under provided objects.
  return merge(...objects);
}

export function createDirectory(dirPath: string) {
  // Create a directory at the given path. This does not throw an error if the directory already exists.
  shell.mkdir("-p", dirPath);
}

export function isDebuggingExtension(): boolean {
  const debugRegex = /^--inspect(-brk)?=?/;
  return process.execArgv
    ? process.execArgv.some((arg) => debugRegex.test(arg))
    : false;
}
