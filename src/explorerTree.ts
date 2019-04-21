import * as vscode from 'vscode';
import * as config from "./config"
import { DetectorFilterTree } from './detectorFilterTree';
import { Logger } from "./logger";
import * as slither from "./slither";
import * as slitherResults from "./slitherResults";
import * as sourceHelper from "./sourceHelper";

// Generic tree node implementation.
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

// A special type of node which denotes an issue.
export class CheckResultNode extends ExplorerNode {
    public result : slitherResults.SlitherResult;
    constructor(result : slitherResults.SlitherResult) {
        super(slitherResults.getSanitizedDescription(result), vscode.TreeItemCollapsibleState.None);
        this.result = result;
    }
}

// The explorer/treeview for slither analysis results.
export class SlitherExplorer implements vscode.TreeDataProvider<ExplorerNode> {

    public changeTreeEmitter: vscode.EventEmitter<any> = new vscode.EventEmitter<any>();
    public readonly onDidChangeTreeData: vscode.Event<any> = this.changeTreeEmitter.event;

    // Create our set of hidden detector types
    private hiddenDetectors : Set<string> = new Set<string>();

    // Nodes which contain check results, or maps to them by name.
    private byTypeNode : ExplorerNode = new ExplorerNode("By Type");
    private byTypeMap :  Map<string, ExplorerNode> = new Map<string, ExplorerNode>();
    private bySeverityNode : ExplorerNode = new ExplorerNode("By Severity");
    private bySeverityMap :  Map<string, ExplorerNode> = new Map<string, ExplorerNode>();

    // A node which is not rendered itself, but contains all nodes which will be shown.
    private rootNode : ExplorerNode = this.bySeverityNode;

    constructor(private context: vscode.ExtensionContext, private detectorFilterTree : DetectorFilterTree) {
        // Set up the severity nodes with their respective icons.
        let highSeverityNode = new ExplorerNode("High", vscode.TreeItemCollapsibleState.Expanded);
        highSeverityNode.iconPath = { 
            light: this.context.asAbsolutePath("resources/severity-high-light.svg"),
            dark: this.context.asAbsolutePath("resources/severity-high-dark.svg"),
        };
        let mediumSeverityNode = new ExplorerNode("Medium", vscode.TreeItemCollapsibleState.Expanded);
        mediumSeverityNode.iconPath = { 
            light: this.context.asAbsolutePath("resources/severity-medium-light.svg"),
            dark: this.context.asAbsolutePath("resources/severity-medium-dark.svg"),
        };
        let lowSeverityNode = new ExplorerNode("Low", vscode.TreeItemCollapsibleState.Expanded);
        lowSeverityNode.iconPath = { 
            light: this.context.asAbsolutePath("resources/severity-low-light.svg"),
            dark: this.context.asAbsolutePath("resources/severity-low-dark.svg"),
        };
        let informationalSeverityNode = new ExplorerNode("Informational", vscode.TreeItemCollapsibleState.Expanded);
        informationalSeverityNode.iconPath = { 
            light: this.context.asAbsolutePath("resources/severity-info-light.svg"),
            dark: this.context.asAbsolutePath("resources/severity-info-dark.svg"),
        };
        let severityNodes = [highSeverityNode, mediumSeverityNode, lowSeverityNode, informationalSeverityNode];
            
        // Set up the severity node map.
        for (let severityNode of severityNodes) {
            if(severityNode.label) { 
                this.bySeverityNode.nodes.push(severityNode);
                this.bySeverityMap.set(severityNode.label,  severityNode);
            }
        }

        // Subscribe to the detector filter changed event
        this.detectorFilterTree.changedEnabledFilters.push(async() => {
            await this.onDetectorFiltersChanged();
        });
    }

    private async refreshSeverityNodeCounts() : Promise<number> {
        // Refresh our counts for every severity
        let totalCount : number = 0;
        for (let severityNode of this.bySeverityNode.nodes) {
            let severityIssueCount = this.getFilteredChildren(severityNode.nodes).length;
            totalCount += severityIssueCount;
            severityNode.label = `${severityNode.originalLabel} (${severityIssueCount})`
        }
        return totalCount;
    }

    private async onDetectorFiltersChanged() {
        // Obtain our new hidden detector list.
        this.hiddenDetectors = await this.detectorFilterTree.getHiddenDetectors();

        // Update the hidden detectors in the user configuration and save changes.
        config.userConfiguration.hiddenDetectors = Array.from(this.hiddenDetectors);
        config.saveConfiguration();

        // Change the severity counts
        await this.refreshSeverityNodeCounts();

        // Fire the event to refresh our tree
        this.changeTreeEmitter.fire();
    }

    public async toggleTreeMode() {

        // Switch our root node
        if (this.rootNode == this.bySeverityNode) {
            this.rootNode = this.byTypeNode;
        }
        else {
            this.rootNode = this.bySeverityNode;
        }
        
        // Fire the event to refresh our tree
        this.changeTreeEmitter.fire();
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
        let issueCount : number = 0;
        for (let [workspaceFolder, workspaceResults] of slither.results) {
            // Organize the workspace results.
            workspaceResults.sort((a, b) => (a.description > b.description) ? 1 : -1);

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

        // Refresh our severity counts
        let filteredIssueCount = await this.refreshSeverityNodeCounts();

        // Print our message
        if (logging) {
            Logger.log(`Loaded ${issueCount} issues, displaying ${filteredIssueCount}`);
        }

        // Fire the event to refresh our tree
        this.changeTreeEmitter.fire();
    }

    public async clickedNode(node : ExplorerNode) {
        // If this is a check result node, go to it.
        if (node instanceof CheckResultNode) {
            let checkResultNode = node as CheckResultNode;
            sourceHelper.gotoResult(checkResultNode.result);
        }
    }

    public getTreeItem(element: ExplorerNode): vscode.TreeItem {
        return element;
    }

    private getFilteredChildren(children : ExplorerNode[]) : ExplorerNode[] {
        // Using our provided child list, we remove all items which do not conform to the enabled detector list.
        let filteredChildren : ExplorerNode[] = [];
        for(let childNode of children) {
            // If this is a result which is hidden, we skip it.
            if (childNode instanceof CheckResultNode) {
                if (this.hiddenDetectors.has(childNode.result.check)) {
                    continue;
                }
            }
            // Otherwise we add the item appropriately.
            filteredChildren.push(childNode);
        }
        return filteredChildren;
    }

    public getChildren(element?: ExplorerNode): ExplorerNode[] | Thenable<ExplorerNode[]> {
        // Create our resulting list
        let children : ExplorerNode[] = [];

        // If there is a provided node, return its subnodes.
        if (element) {
            children = element.nodes;
        } else if (this.rootNode.nodes.length == 0) {
            // If there is no provided node and we have no nodes, return a blank message.
            return [new ExplorerNode("<No analysis results>")];
        } else {
            // If we have nodes under our root nodes, return those.
            children = this.rootNode.nodes;
        }

        // Using our provided child list, we remove all items which do not conform to the enabled detector list.
        return this.getFilteredChildren(children);
    }
}
