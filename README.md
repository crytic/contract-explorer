# Slither (Visual Studio Code Extension)
Visual Studio Code integration for [Slither](https://github.com/crytic/slither), a Solidity static analysis framework.

This extension offers Visual Studio Code integration for Slither, a Solidity static analysis framework written in Python 3. With Slither for Visual Studio Code, users can run a suite of vulnerability detectors on their Solidity smart contracts to annotate potentially dangerous code and receive suggested fixes.

<img src="https://raw.githubusercontent.com/crytic/slither-vscode/master/resources/screenshot.png" alt="Logo" width="900"/>


## Features
* Analyze open workspaces
* Explore results in a custom tree, sorted by issue type or severity
* View results as native Visual Studio Code information/warnings/errors
* See annotations for relevant source code for each issue
* Print detailed issue description and recommendations
* Filter issues by type (per workspace configuration)
* Specify custom solc path (per workspace configuration)
* Solidity Syntax Highlighting

## Requirements
* [Slither](https://github.com/crytic/slither) ( >= 0.6.4 )
* [Visual Studio Code](https://code.visualstudio.com/download)
* Optional: Any desired build/test frameworks supported by Slither, such as Truffle.

** Slither must be accessible via the `slither` command in order for this extension to invoke it.

## Installation

### From the Visual Studio Marketplace

Install `Slither` from the Visual Studio Marketplace within the Extensions tab of Visual Studio Code.

### From source

```
git clone https://github.com/crytic/slither-vscode
cd slither-vscode
npm i
npm install -g vsce
vsce package
```
`slither-vscode-X.X.X.vsix` will be created.

Install the VSIX file in Visual Studio through `Extensions`, under the `...` menu.

## Getting Started

After installing the extension, simply open a workspace containing any Solidity (*.sol) files. The extension will activate, revealing the Slither logo on the action bar. Click it to reveal a new container with a results explorer and detector filter tree. Hovering over the explorer tree will reveal buttons on the top title bar which can be used to run slither, refresh, change viewing mode, and delete results.

Clicking a detector filter will toggle its visibility. Hovering over the detector filter tree will reveal a button with a flag icon, which is used as a toggle all button.

Left clicking a result in the result explorer will navigate to the result's code. Right clicking it will reveal additional options such as displaying additional information. If source is changed since the previous slither run, and a source mapping mismatch occurs, the problem and its annotations will disappear and an "out-of-sync" icon will appear to the left of the result in the explorer tree, indicating slither analysis should be re-run. 


## License
AGPL-3.0
