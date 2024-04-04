# Slither (Visual Studio Code Extension)

Visual Studio Code integration for [Slither](https://github.com/crytic/slither), a Solidity static analysis framework.

This extension offers Visual Studio Code integration for Slither, a Solidity static analysis framework written in Python 3. With Slither for Visual Studio Code, users can run a suite of vulnerability detectors on their Solidity smart contracts to annotate potentially dangerous code and receive suggested fixes.

<img src="https://raw.githubusercontent.com/crytic/slither-vscode/master/resources/screenshot.png" alt="Logo" width="900"/>

## Features

- Analyze open workspaces
- Explore results in a custom tree, sorted by issue type or severity
- View results as native Visual Studio Code information/warnings/errors
- See annotations for relevant source code for each issue
- Print detailed issue description and recommendations
- Filter issues by type (per workspace configuration)
- Specify custom solc path (per workspace configuration)
- Solidity Syntax Highlighting

## Requirements

- [slither-lsp](https://github.com/crytic/slither-lsp)
- [Visual Studio Code](https://code.visualstudio.com/download)
- Optional: Any desired build/test frameworks supported by Slither, such as Truffle.

> [!NOTE]
> slither-lsp must be accessible via the `slither-lsp` command in order for this extension to invoke it. Use `pip install slither-lsp` to install it.

## Installation

### From the Visual Studio Marketplace

Install `Slither` from the Visual Studio Marketplace within the Extensions tab of Visual Studio Code.

### From source

```sh
git clone https://github.com/crytic/slither-vscode
cd slither-vscode
npm i
npm install -g vsce
vsce package
```

`slither-vscode-X.X.X.vsix` will be created.

Install the VSIX file in Visual Studio through `Extensions`, under the `...` menu.

## Getting Started

After installing the extension, simply open a workspace containing any Solidity (\*.sol) files. The extension will activate, revealing the Slither logo on the action bar. Click it to reveal a settings pane, from which you will be able to select which detector results will be shown after a workspace folder has finished analysing.

Once analysis of a folder is done, you will be able to explore the codebase by using the familiar VSCode tools "Go to implementations", "Go to definitions", "Find all references", and showing call and type hierarchies.

## License

AGPL-3.0
