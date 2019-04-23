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

// A special type of parent node which denotes a type of issue.
export class CheckTypeNode extends ExplorerNode {
    public check : string;
    constructor(detector : slitherResults.SlitherDetector) {
        super(`${detector.check}: ${detector.title}\n${detector.description}\n\nImpact: ${detector.impact}\nConfidence: ${detector.confidence}`, vscode.TreeItemCollapsibleState.Collapsed);
        this.check = detector.check;
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
        this.setIconBySeverity(highSeverityNode, <string>highSeverityNode.label);

        let mediumSeverityNode = new ExplorerNode("Medium", vscode.TreeItemCollapsibleState.Expanded);
        this.setIconBySeverity(mediumSeverityNode, <string>mediumSeverityNode.label);

        let lowSeverityNode = new ExplorerNode("Low", vscode.TreeItemCollapsibleState.Expanded);
        this.setIconBySeverity(lowSeverityNode, <string>lowSeverityNode.label);

        let informationalSeverityNode = new ExplorerNode("Informational", vscode.TreeItemCollapsibleState.Expanded);
        this.setIconBySeverity(informationalSeverityNode, <string>informationalSeverityNode.label);

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

    private setIconBySeverity(node : ExplorerNode, severity : string) {
        // Set the node icon according to severity.
        switch(severity) {
            case "High":
                node.iconPath = { 
                    light: this.context.asAbsolutePath("resources/severity-high-light.svg"),
                    dark: this.context.asAbsolutePath("resources/severity-high-dark.svg"),
                };
                break;
            case "Medium":
                node.iconPath = { 
                    light: this.context.asAbsolutePath("resources/severity-medium-light.svg"),
                    dark: this.context.asAbsolutePath("resources/severity-medium-dark.svg"),
                };
                break;
            case "Low":
                node.iconPath = { 
                    light: this.context.asAbsolutePath("resources/severity-low-light.svg"),
                    dark: this.context.asAbsolutePath("resources/severity-low-dark.svg"),
                };
                break;
            case "Informational":
                node.iconPath = { 
                    light: this.context.asAbsolutePath("resources/severity-info-light.svg"),
                    dark: this.context.asAbsolutePath("resources/severity-info-dark.svg"),
                };
                break;
        }
    }

    private async refreshSeverityNodeCounts() : Promise<number> {
        // Refresh our counts for every severity class
        let totalCount : number = 0;
        for (let severityNode of this.bySeverityNode.nodes) {
            let severityIssueCount = this.getFilteredChildren(severityNode.nodes).length;
            totalCount += severityIssueCount;
            severityNode.label = `${severityNode.originalLabel} (${severityIssueCount})`
        }

        // Return our filtered/displayed count
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

        // Populate all types of detectors
        for (let detector of slither.detectors) {
            let typeNode = new CheckTypeNode(detector);
            this.setIconBySeverity(typeNode, detector.impact);
            this.byTypeNode.nodes.push(typeNode);
            this.byTypeMap.set(detector.check, typeNode);
        }
        
        // Loop for each result.
        let issueCount : number = 0;
        for (let [workspaceFolder, workspaceResults] of slither.results) {
            // Organize the workspace results.
            workspaceResults.sort((a, b) => (a.description > b.description) ? 1 : -1);

            // Loop through all the results.
            for(let workspaceResult of workspaceResults) {
                // Add to our issue count
                issueCount++;

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
                    vscode.window.showErrorMessage(`Failed to populate results of unknown detector type "${workspaceResult.check}"`);
                    continue;
                }
                typeNode.nodes.push(issueNode);
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
        } else if (this.rootNode.nodes.length != 0) {
            // If we have nodes under our root nodes, return those.
            children = this.rootNode.nodes;
        }

        // Filter accordingly, depending on view
        if (element && this.rootNode == this.bySeverityNode) {
            // We filter the children under each severity node
            children = this.getFilteredChildren(children);
        } else if(!element && this.rootNode == this.byTypeNode) {
            // We filter all type nodes
            children = children.filter(x => !this.hiddenDetectors.has((<CheckTypeNode>x).check) && x.nodes.length > 0);

            // Sort the types appropriately.
            children.sort((a, b) => ((<CheckTypeNode>a).check > (<CheckTypeNode>b).check) ? 1 : -1);
        }

        // If we are populated root nodes and have no results, return a node to represent that.
        if (!element && children.length == 0) {
            return [new ExplorerNode("<No analysis results>")];
        }

        // Return the children nodes
        return children;
    }
}
