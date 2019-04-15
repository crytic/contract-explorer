
import * as vscode from 'vscode'
import { SlitherResult } from './slitherResult';

export class ExplorerNode extends vscode.TreeItem {
    public nodes : ExplorerNode[];
    public readonly originalLabel : string;
    constructor(originalLabel: string, collapsibleState?: vscode.TreeItemCollapsibleState) {
        super(originalLabel, collapsibleState);
        this.originalLabel = originalLabel;
        this.nodes = [];
        this.command = {
            title: "",
            command: "slither.clickedExplorerNode",
            arguments: [this],
        };
    }
}

export class CheckResultNode extends ExplorerNode {
    public result : SlitherResult;
    constructor(result : SlitherResult) {
        super(String(result.description), vscode.TreeItemCollapsibleState.None);
        this.result = result;
    }
}