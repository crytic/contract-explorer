import * as vscode from 'vscode';
import * as slither from "./slither";
import { Logger } from "./logger";
import * as config from "./config";

export function refreshExplorer() {
    Logger.log("Refreshing explorer");
}