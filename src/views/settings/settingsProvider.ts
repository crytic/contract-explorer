import * as vscode from 'vscode';
import { state } from '../../extension';

export class SlitherSettingsProvider implements vscode.WebviewViewProvider {

    public static readonly view_id = 'slither-settings-webview';
    private _view?: vscode.WebviewView;

    constructor(
		private readonly context: vscode.ExtensionContext
	) {}

    resolveWebviewView(webviewView: vscode.WebviewView, context: vscode.WebviewViewResolveContext<unknown>, token: vscode.CancellationToken): void | Thenable<void> {
        // Set our internal view
        this._view = webviewView;

        // Set our webview options
        this._view.webview.options = {
            // Enable javascript scripts in our webview view.
            enableScripts: true,

            // Restrict resources to only load from our extension folder.
            localResourceRoots: [
                this.context.extensionUri
            ]
        }

        // Add our event handlers for messages from the webview.
        this._view.webview.onDidReceiveMessage(data => {
			switch (data.method) {
				case 'saveSettings':
					{
						// Get our settings from our message.
                        let settings: any = data.settings;

                        // TODO: Save these settings.
						break;
					}
			}
		});

        // Get our page content.
        this._view.webview.html = this.getWebviewViewContent();
        this._view.onDidChangeVisibility((e) => {
            this.refreshDetectors();
        });
        // Refresh detectors
        this.refreshDetectors();
    }

    public loadSettings(settings: any) {
        // If we have a view, send it our settings to load.
        if (this._view) {
            this._view.webview.postMessage({method: 'loadSettings', settings: settings});
        }
    }

    public refreshDetectors() {
        // If we have a view, send it our detectors list JSON.
        if (this._view) {
            this._view.webview.postMessage({method: 'refreshDetectors', detectors: state.detectors});
        }
    }

    private getWebviewViewContent(): string {
        // If we have no webview, stop
        if(this._view?.webview == undefined) {
            return "";
        }
        // Create our webview view content
        let content: string = "";

		// Get our script/stylesheet paths as links that work in the webview.
		const scriptUri = this._view.webview.asWebviewUri(vscode.Uri.joinPath(this.context.extensionUri, 'src', 'views', 'settings', 'settings.js'));
        const jQueryScriptUri = this._view.webview.asWebviewUri(vscode.Uri.joinPath(this.context.extensionUri, 'resources', 'jquery-3.6.0.min.js'));

        const styleUri = this._view.webview.asWebviewUri(vscode.Uri.joinPath(this.context.extensionUri, 'src', 'views', 'settings', 'settings.css'));
        const styleVSCodeUri = this._view.webview.asWebviewUri(vscode.Uri.joinPath(this.context.extensionUri, 'src', 'views', 'settings', 'vscode.css'));
        

        // Add our base page
        content +=
        `<!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <!--
            TODO: Use a content security policy to only allow loading images from https or from our extension directory,
            and only allow scripts that have a specific nonce.
            -->
            <meta name="viewport" content="width=device-width, initial-scale=1.0">

            <link href="${styleVSCodeUri}" rel="stylesheet">
            <link href="${styleUri}" rel="stylesheet">

        </head>
        <body>
            <script src="${jQueryScriptUri}"></script>
            <script src="${scriptUri}"></script>
            <ul class="menubar">
                <li><a onclick="setFocusedContainer('compilation_panel')">Compilation</a></li>
                <li><a onclick="setFocusedContainer('detector_filter_panel')">Detector Filters</a></li>
                <li><a onclick="setFocusedContainer('about_panel')">About</a></li>
            </ul>
            <div id="master_container_panel">
                <div id="compilation_panel" class="container_panel disable-select">
                    <h3 id="compilation_header">Compilation</h3>
                    <select id="dropdown_compilation_group"></select>
                    <div id="add_remove_compilation_group_panel">
                        <button type="button" id="btn_add_compilation_group" onclick="addCompilationGroup()">+</button>
                        <button type="button" id="btn_remove_compilation_group" onclick="removeCompilationGroup()">-</button>
                    </div>
                    <br><br>

                    <div id="compilation_group_panel">
                        <label>Target Type:</label> 
                        <label title="Basic compilation includes one target which is a path to either a single Solidity file, a directory of files, or the path to the root of a compilation/unit test project such as Truffle, Hardhat, etc.">
                            <input name="compilation_type" value="basic" type="radio" checked="checked" onclick="setCompilationTypeView(false)">
                            Basic
                        </label>
                        <label title="Custom compilation involves constructing a standard JSON compilation manifest from a list of targets. Targets can be added using context menu options in the Explorer. They can also be observed/removed below.">
                            <input name="compilation_type" value="custom" type="radio" onclick="setCompilationTypeView(true)">
                            Custom (Loose Files)
                        </label>
                        <div id="compilation_panel_basic" class="compilation_panel" style="display:block">
                            <label>Target(s): <input name="compilation_target" value="." type="text"></label>
                        </div>
                        <div id="compilation_panel_custom" class="compilation_panel" style="display:none">
                            <label>Target(s):</label>
                            <ul id="compilation_targets">
                                <li><label><input type="checkbox"> contracts/blah.sol</label></li>
                                <li><label><input type="checkbox"> contracts/version/whatever/blah/blah2.sol</label></li>
                            </ul>
                            <button type="button">Autopopulate</button>
                        </div>
                        <div id="compilation_panel_shared" class="compilation_panel">
                            <label>Path Remappings</label>
                            <table id="compilation_remappings">
                                <tr>
                                    <th><input name="remapping_src" placeholder="source" type="text"></th>
                                    <th><input name="remapping_dst" placeholder="destination" type="text"></th>
                                </tr>
                            </table>
                            <br>
                            <button type="button">Add remapping</button>
                        </div>
                    </div>
                    <br>
                    <hr>
                </div>
                
                <div id="detector_filter_panel" class="container_panel disable-select">
                    <h3 id="detector_filter_header">Detector Filters</h3>
                    <ul id="detector_filter_list"></ul>
                    <button type="button" onclick="toggleAllDetectorFilters()">Toggle All</button>
                    <br>
                    <hr>
                </div>

                <div id="about_panel" class="container_panel disable-select">
                    <h3 id="about_header">About</h3>
                    <ul>
                        <li><a href="https://trailofbits.com">Trail of Bits</a></li>
                        <li><a href="https://github.com/crytic/slither-vscode">slither-vscode GitHub</a></li>
                    <ul>
                    <br>
                    <hr>
                </div>
            </div>
            <br>
        </body>
        <footer>
            <button type="button">Save Settings</button>
        </footer>
        </html>
        `;

        // Return our generated content.
        return content;
    }
}