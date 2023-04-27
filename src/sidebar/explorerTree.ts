import * as vscode from "vscode";
import { Logger } from "../utils/logger";

export class ExplorerNode extends vscode.TreeItem {
  public nodes: ExplorerNode[];
  public readonly originalLabel: string;
  constructor(
    originalLabel: string,
    collapsibleState?: vscode.TreeItemCollapsibleState
  ) {
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

export class SlitherExplorer implements vscode.TreeDataProvider<ExplorerNode> {
  private bySeverityNode: ExplorerNode = new ExplorerNode("By Severity");
  private bySeverityMap: Map<string, ExplorerNode> = new Map<
    string,
    ExplorerNode
  >();

  constructor(private context: vscode.ExtensionContext) {
    // Set up the severity nodes with their respective icons.
    let highSeverityNode = new ExplorerNode(
      "High",
      vscode.TreeItemCollapsibleState.Expanded
    );
    this.setIconBySeverity(highSeverityNode, <string>highSeverityNode.label);

    let mediumSeverityNode = new ExplorerNode(
      "Medium",
      vscode.TreeItemCollapsibleState.Expanded
    );
    this.setIconBySeverity(
      mediumSeverityNode,
      <string>mediumSeverityNode.label
    );

    let lowSeverityNode = new ExplorerNode(
      "Low",
      vscode.TreeItemCollapsibleState.Expanded
    );
    this.setIconBySeverity(lowSeverityNode, <string>lowSeverityNode.label);

    let informationalSeverityNode = new ExplorerNode(
      "Informational",
      vscode.TreeItemCollapsibleState.Expanded
    );
    this.setIconBySeverity(
      informationalSeverityNode,
      <string>informationalSeverityNode.label
    );

    let optimizationSeverityNode = new ExplorerNode(
      "Optimization",
      vscode.TreeItemCollapsibleState.Expanded
    );
    this.setIconBySeverity(
      optimizationSeverityNode,
      <string>optimizationSeverityNode.label
    );

    let severityNodes = [
      highSeverityNode,
      mediumSeverityNode,
      lowSeverityNode,
      informationalSeverityNode,
      optimizationSeverityNode,
    ];

    // Set up the severity node map.
    for (let severityNode of severityNodes) {
      if (severityNode.label) {
        this.bySeverityNode.nodes.push(severityNode);
        this.bySeverityMap.set(<string>severityNode.label, severityNode);
      }
    }
  }

  private setIconBySeverity(node: ExplorerNode, severity: string) {
    switch (severity) {
      case "High":
        node.iconPath = {
          light: this.context.asAbsolutePath(
            "resources/severity-high-light.svg"
          ),
          dark: this.context.asAbsolutePath("resources/severity-high-dark.svg"),
        };
        break;
      case "Medium":
        node.iconPath = {
          light: this.context.asAbsolutePath(
            "resources/severity-medium-light.svg"
          ),
          dark: this.context.asAbsolutePath(
            "resources/severity-medium-dark.svg"
          ),
        };
        break;
      case "Low":
        node.iconPath = {
          light: this.context.asAbsolutePath(
            "resources/severity-low-light.svg"
          ),
          dark: this.context.asAbsolutePath("resources/severity-low-dark.svg"),
        };
        break;
      case "Informational":
        node.iconPath = {
          light: this.context.asAbsolutePath(
            "resources/severity-info-light.svg"
          ),
          dark: this.context.asAbsolutePath("resources/severity-info-dark.svg"),
        };
        break;
      case "Optimization":
        node.iconPath = {
          light: this.context.asAbsolutePath(
            "resources/severity-info-light.svg"
          ),
          dark: this.context.asAbsolutePath("resources/severity-info-dark.svg"),
        };
        break;
    }
  }

  public getTreeItem(element: ExplorerNode): vscode.TreeItem {
    return element;
  }

  public getChildren(
    element?: ExplorerNode
  ): ExplorerNode[] | Thenable<ExplorerNode[]> {
    // Create our resulting list
    let children: ExplorerNode[] = [];

    // Return the children nodes
    return children;
  }
}
