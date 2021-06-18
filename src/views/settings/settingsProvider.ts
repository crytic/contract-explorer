import * as vscode from 'vscode';
import { state } from '../../extension';

export class SlitherSettingsProvider implements vscode.WebviewViewProvider {

    public static readonly view_id = 'slither-settings-webview';
    private _view?: vscode.WebviewView;
    private _unsavedState: any;

    constructor(
		private readonly context: vscode.ExtensionContext
	) {
        // Create a clean state (underlying default values will be set within the webview).
        this._unsavedState = null;
    }

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
                case 'storeUnsavedState': {
                    // Store our unsaved state.
                    this._unsavedState = data.state;
                    break;
                }
				case 'saveConfig': {
                        // Save our configuration
                        console.log(data.config);
                        // TODO: Save these settings.
						break;
					}
			}
		});

        // Get our page content.
        this._view.webview.html = this.getWebviewViewContent();

        // If this panel is hidden/shown, we'll need to save/restore state.
        this._view.onDidChangeVisibility((e) => {
            // If we're visible, we are reloading, trigger the relevant event
            if (this._view?.visible) {
                this.onReloaded();
            }
        });

        // Trigger our reloaded event since the above onDidChangeVisibility event isn't triggered the first time this is loaded.
        this.onReloaded();
    }

    private onReloaded() {
        // Initialize our UI from our config or some existing backed up state.
        this.initializeOrRestore();

        // Refresh our detector filter list
        this.refreshDetectors();
    }

    private initializeOrRestore() {
         // Ensure we have a view to operate on.
         if (this._view) {
            // If we have a previously unsaved state, restore it, otherwise flag it as a new initialization.
            if(this._unsavedState == null) {
                this._view.webview.postMessage({method: 'initialize', config: null});
            } else {
                this._view.webview.postMessage({method: 'restoreUnsavedState', state: this._unsavedState});
            }
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
                    <select id="dropdown_compilation_group" onchange="refreshCompilationGroupData()"></select>
                    <div id="add_remove_compilation_group_panel">
                        <button type="button" id="btn_add_compilation_group" onclick="addCompilationGroup()">+</button>
                        <button type="button" id="btn_remove_compilation_group" onclick="removeCompilationGroup()">-</button>
                    </div>
                    <br><br>

                    <div id="compilation_group_panel">
                        <label>Target Type:</label> 
                        <label title="Basic compilation includes one target which is a path to either a single Solidity file, a directory of files, or the path to the root of a compilation/unit test project such as Truffle, Hardhat, etc.">
                            <input type="radio" name="compilation_type" id="radio_compilation_type_basic" value="basic" checked="checked" onchange="setCompilationTypeView(false)">
                            Basic
                        </label>
                        <label title="Custom compilation involves constructing a standard JSON compilation manifest from a list of targets. Targets can be added using context menu options in the Explorer. They can also be observed/removed below.">
                            <input type="radio" name="compilation_type" id="radio_compilation_type_solc_standard_json" value="solc_standard_json" onchange="setCompilationTypeView(true)">
                            Standard JSON (Loose Files)
                        </label>
                        <div id="compilation_panel_basic" class="compilation_panel" style="display:block">
                            <label>Target(s): <input type="text" id="compilation_target" value="." onchange="setUnsavedBasicCompilationTarget()"></label>
                        </div>
                        <div id="compilation_panel_custom" class="compilation_panel" style="display:none">
                            <label>Target(s):</label>
                            <ul id="compilation_targets"></ul>
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
            <button type="button" onclick="saveConfig()">Save Settings</button>
        </footer>
        </html>
        `;

        // Return our generated content.
        return content;
    }
}