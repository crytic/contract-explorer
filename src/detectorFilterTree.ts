import * as vscode from 'vscode';
import * as slither from "./slither";
import * as slitherResults from "./slitherResults";
import { Logger } from "./logger";

// Generic tree node implementation.
export class DetectorFilterNode extends vscode.TreeItem {
    public readonly detector : slitherResults.SlitherDetector;
    public checked : boolean = true;
    constructor(detector : slitherResults.SlitherDetector, checked : boolean) {
        super(`${detector.check}: ${detector.title}\n${detector.description}`, vscode.TreeItemCollapsibleState.None);
        this.detector = detector;
        this.checked = checked;
        this.command = {
            title: "",
            command: "slither.clickedDetectorFilterNode",
            arguments: [this],
        };
    }
}

// The explorer/treeview for slither analysis results.
export class DetectorFilterTree implements vscode.TreeDataProvider<DetectorFilterNode> {

    // Create our event emitters for the changed tree event.
    public changeTreeEmitter: vscode.EventEmitter<any> = new vscode.EventEmitter<any>();
    public readonly onDidChangeTreeData: vscode.Event<any> = this.changeTreeEmitter.event;

    // Create a callback function for signaling 
    public changedEnabledFilters : (() => void)[] = [];

    // A node which is not rendered itself, but contains all nodes which will be shown.
    private detectorFilterNodes : DetectorFilterNode[] = [];

    constructor(private context: vscode.ExtensionContext) {

    }

    public async populateTree() {
        // Obtain a list of detectors and sort them by check name.
        slither.detectors.sort((a, b) => (a.check > b.check) ? 1 : -1);

        // Add a node for each detector to the tree.
        this.detectorFilterNodes = [];
        for (let detector of slither.detectors) {
            // Determine if this detector is visible or not
            let checked : boolean = true;
            if (slither.hiddenDetectors) {
                checked = !slither.hiddenDetectors.has(detector.check);
            }
            // Create the node for this detector and add it to the list.
            let detectorFilterNode : DetectorFilterNode = new DetectorFilterNode(detector, checked);
            this.refreshNodeIcon(detectorFilterNode);
            this.detectorFilterNodes.push(detectorFilterNode);
        }

        // Fire the event to refresh our tree and invoke any callback.
        await this.fireChangedEnabledFilters();
    }

    private async fireChangedEnabledFilters() {
        // Fire an event to change our detector filter tree
        this.changeTreeEmitter.fire();

        // If we have callback handlers, fire them all.
        if (this.changedEnabledFilters != null) {
            for(let callback of this.changedEnabledFilters) {
                await callback();
            }
        }
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

    public async toggleAll() {
        // If we have any items unchecked, we'll check all items. Otherwise we uncheck them all.
        let newCheckedState : boolean = false;
        for(let node of this.detectorFilterNodes) {
            if(!node.checked) {
                newCheckedState = true;
            }
        }

        // Set the checked state of all items.
        for(let node of this.detectorFilterNodes) {
            node.checked = newCheckedState;
            this.refreshNodeIcon(node);
        }

        // Fire the event to refresh our tree and invoke any callback.
        await this.fireChangedEnabledFilters();
    }

    public async getHiddenDetectors() : Promise<Set<string>> {
        // Create a new set
        let hiddenDetectors : Set<string> = new Set<string>();

        // For each hidden detector, add it to the set
        for(let node of this.detectorFilterNodes) {
            if (!node.checked) {
                hiddenDetectors.add(node.detector.check);
            }
        }

        // Return the resulting set.
        return hiddenDetectors;
    }

    public async clickedNode(node : DetectorFilterNode) {
        // Toggle the checked state
        node.checked = !node.checked;
        this.refreshNodeIcon(node);

        // Fire the event to refresh our tree and invoke any callback.
        await this.fireChangedEnabledFilters();
    }

    public getTreeItem(element: DetectorFilterNode): vscode.TreeItem {
        return element;
    }

    public getChildren(element?: DetectorFilterNode): DetectorFilterNode[] | Thenable<DetectorFilterNode[]> {
        // Obtain our list of detectors
        return this.detectorFilterNodes;
    }
}
