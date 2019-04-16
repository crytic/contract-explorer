import * as vscode from 'vscode';
import * as slither from "./slither";
import * as slitherResults from "./slitherResults";
import { Logger } from "./logger";
import * as config from "./config";
import { SlitherResult } from './slitherResults';
import { SlitherExplorer } from './explorerTree';

// Generic tree node implementation.
export class DetectorFilterNode extends vscode.TreeItem {
    public readonly detector : slitherResults.SlitherDetector;
    public checked : boolean = true;
    constructor(detector : slitherResults.SlitherDetector) {
        super(`${detector.check}: ${detector.title}`, vscode.TreeItemCollapsibleState.None);
        this.detector = detector;
        this.command = {
            title: "",
            command: "slither.clickedDetectorFilterNode",
            arguments: [this],
        };
    }
}

// The explorer/treeview for slither analysis results.
export class DetectorFilterTree implements vscode.TreeDataProvider<DetectorFilterNode> {

    public changeTreeEmitter: vscode.EventEmitter<any> = new vscode.EventEmitter<any>();
    public readonly onDidChangeTreeData: vscode.Event<any> = this.changeTreeEmitter.event;

    // A node which is not rendered itself, but contains all nodes which will be shown.
    private detectorFilterNodes : DetectorFilterNode[] = [];

    constructor(private context: vscode.ExtensionContext) {

    }

    public async populateTree() {
        // Obtain a list of detectors and sort them by check name.
        let detectors : slitherResults.SlitherDetector[] = await slither.getDetectors();
        detectors.sort((a, b) => (a.check > b.check) ? 1 : -1);

        // Add a node for each detector to the tree.
        this.detectorFilterNodes = [];
        for (let detector of detectors) {
            // Create a tree node to add to our root node
            let detectorFilterNode : DetectorFilterNode = new DetectorFilterNode(detector);
            this.refreshNodeIcon(detectorFilterNode);
            this.detectorFilterNodes.push(detectorFilterNode);
        }

        // Fire the event to refresh our tree
        this.changeTreeEmitter.fire();
    }

    private refreshNodeIcon (node :DetectorFilterNode) {
        if (node.checked) {
            node.iconPath = { 
                light: this.context.asAbsolutePath("resources/check-light.svg"),
                dark: this.context.asAbsolutePath("resources/check-dark.svg"),
            };
        }
        else {
            node.iconPath = undefined;
        }
    }

    public async clickedNode(node : DetectorFilterNode) {
        // Toggle the checked state
        node.checked = !node.checked;
        this.refreshNodeIcon(node);

        // Fire the event to refresh our tree
        this.changeTreeEmitter.fire();
    }

    public getTreeItem(element: DetectorFilterNode): vscode.TreeItem {
        return element;
    }

    public getChildren(element?: DetectorFilterNode): DetectorFilterNode[] | Thenable<DetectorFilterNode[]> {
        // Obtain our list of detectors
        return this.detectorFilterNodes;
    }
}
