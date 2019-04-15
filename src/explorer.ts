import * as vscode from 'vscode';
import * as slither from "./slither";
import * as slitherResults from "./slitherResults";
import { Logger } from "./logger";
import * as config from "./config";
import { ExplorerNode, CheckResultNode } from "./explorerNode"

export class SlitherExplorer implements vscode.TreeDataProvider<ExplorerNode> {

    public changeTreeEmitter: vscode.EventEmitter<any> = new vscode.EventEmitter<any>();
    public readonly onDidChangeTreeData: vscode.Event<any> = this.changeTreeEmitter.event;

    // Nodes which contain check results, or maps to them by name.
    private byTypeNode : ExplorerNode = new ExplorerNode("By Type");
    private byTypeMap :  Map<string, ExplorerNode> = new Map<string, ExplorerNode>();
    private bySeverityNode : ExplorerNode = new ExplorerNode("By Severity");
    private bySeverityMap :  Map<string, ExplorerNode> = new Map<string, ExplorerNode>();

    // A node which is not rendered itself, but contains all nodes which will be shown.
    private rootNode : ExplorerNode = this.bySeverityNode;

    constructor(private context: vscode.ExtensionContext) {
        // Set up the severity nodes and map.
        let highSeverityNode = new ExplorerNode("High", vscode.TreeItemCollapsibleState.Expanded);
        let mediumSeverityNode = new ExplorerNode("Medium", vscode.TreeItemCollapsibleState.Expanded);
        let lowSeverityNode = new ExplorerNode("Low", vscode.TreeItemCollapsibleState.Expanded);
        let informationalSeverityNode = new ExplorerNode("Informational", vscode.TreeItemCollapsibleState.Expanded);
        let severityNodes = [highSeverityNode,mediumSeverityNode, lowSeverityNode, informationalSeverityNode];
            

        for (let severityNode of severityNodes) {
            if(severityNode.label) { 
                this.bySeverityNode.nodes.push(severityNode);
                this.bySeverityMap.set(severityNode.label, severityNode);
            }
        }
    }

    public async refreshExplorer(logging : boolean = true) {
        // Read our last slither results 
        let success : boolean = await slither.readResults(false);
        if (!success) {
            return;
        }

        // Print our refreshing explorer message.
        if (logging) {
            Logger.log("Refreshing explorer...");
        }

        // Clear our results by severity
        for (let severityNode of this.bySeverityNode.nodes) {
            severityNode.nodes = [];
        }

        // Clear our results by type
        for (let typeNode of this.byTypeNode.nodes) {
            typeNode.nodes = [];
        }
        
        // Loop for each result.
        let issueCount = 0;
        for (let [workspaceFolder, workspaceResults] of slither.results) {
            // Loop through all the results.
            for(let workspaceResult of workspaceResults) {
                // Create our issue node.
                let issueNode = new CheckResultNode(workspaceResult);

                // Add our issue by severity.
                let severityNode = this.bySeverityMap.get(workspaceResult.impact);
                if (severityNode) {
                    severityNode.nodes.push(issueNode);
                }

                // Add our issue by type
                let typeNode = this.byTypeMap.get(workspaceResult.check);
                if(!typeNode) {
                    typeNode = new ExplorerNode(workspaceResult.check, vscode.TreeItemCollapsibleState.Collapsed);
                    this.byTypeNode.nodes.push(typeNode);
                    this.byTypeMap.set(workspaceResult.check, typeNode);
                }
                typeNode.nodes.push(issueNode);
                issueCount++;
            }
        }

        // Refresh our counts for every severity
        for (let severityNode of this.bySeverityNode.nodes) {
            severityNode.label = `${severityNode.originalLabel} (${severityNode.nodes.length})`
        }

        // Print our message and fire our changed event.
        if (logging) {
            Logger.log(`Refreshed explorer with ${issueCount} results`);
        }
        this.changeTreeEmitter.fire();
    }

    public async clickedNode(node : ExplorerNode) {
        // If this is a check result node, go to it.
        if (node instanceof CheckResultNode) {
            let checkResultNode = node as CheckResultNode;
            slitherResults.gotoResult(checkResultNode.result);
        }
    }

    public getTreeItem(element: ExplorerNode): vscode.TreeItem {
        return element;
    }

    public getChildren(element?: ExplorerNode): ExplorerNode[] | Thenable<ExplorerNode[]> {
        // If there is a provided node, return its subnodes.
        if (element) {
            return element.nodes;
        }

        // If there are no items under the root node, we simply return a default node.
        if (this.rootNode.nodes.length == 0) {
            return [new ExplorerNode("<No analysis results>")];
        }

        // Otherwise we return our subnodes.
        return this.rootNode.nodes;
    }
}
