import * as vscode from 'vscode';
import * as state from '../../state';
import { Configuration } from '../../types/configTypes'

export class SettingsViewProvider implements vscode.WebviewViewProvider {

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
                    state.saveConfiguration(data.config);
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
                this.onReloaded(false);
            }
        });

        // If our state is initialized already, initialize the webview with our new configuration.
        // This will happen if the language server is started before the webview is rendered.
        if (state.isInitialized()) {
            this.onReloaded(true);
        }

        // Otherwise, in case the webview was rendered before the language server was started, we subscribe to the
        // state initialization event to initialize the webview with the data when it is available.
        state.onInitialized(() => {
            this.onReloaded(true);
        });
    }

    private onReloaded(forceNewInitialization=false) {
        // Initialize our UI from our config or some existing backed up state.
        if(forceNewInitialization) {
            this.initialize();
        } else {
            this.initializeOrRestore();
        }

        // Refresh our detector filter list
        this.refreshDetectors();
    }

    private initialize() {
         // Ensure we have a view to operate on.
         if (this._view) {
            // Reset any unsaved state so it is not restored over this initialization mistakenly.
            this._unsavedState = null;

            // Initialize from our state configuration.
            this._view.webview.postMessage({method: 'initialize', config: state.configuration});
         }
    }

    private initializeOrRestore() {
         // Ensure we have a view to operate on.
         if (!this._view) {
             return;
         }

        // If we have a previously unsaved state, restore it, otherwise flag it as a new initialization.
        if(this._unsavedState == null) {
            this.initialize();
        } else {
            this._view.webview.postMessage({method: 'restoreUnsavedState', state: this._unsavedState});
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
                <li><a id="navbar_item_compilations">Compilation</a></li>
                <li><a id="navbar_item_detector_filters">Detector Filters</a></li>
                <li><a id="navbar_item_about">About</a></li>
            </ul>
            <div id="master_container_panel">
                <div id="compilation_panel" class="container_panel disable-select">
                    <h3 id="compilation_header">Compilation</h3>
                    <select id="dropdown_compilation_group"></select>
                    <div id="add_remove_compilation_group_panel">
                        <button type="button" id="btn_add_compilation_group">+</button>
                        <button type="button" id="btn_remove_compilation_group">-</button>
                    </div>
                    <br><br>

                    <div id="compilation_group_panel">
                        <label>Target Type:</label> 
                        <label title="Basic compilation includes one target which is a path to either a single Solidity file, a directory of files, or the path to the root of a compilation/unit test project such as Truffle, Hardhat, etc.">
                            <input type="radio" name="compilation_type" id="radio_compilation_type_basic" value="basic" checked="checked">
                            Basic
                        </label>
                        <label title="Custom compilation involves constructing a standard JSON compilation manifest from a list of targets. Targets can be added using context menu options in the Explorer. They can also be observed/removed below.">
                            <input type="radio" name="compilation_type" id="radio_compilation_type_solc_standard_json" value="solc_standard_json">
                            Standard JSON (Loose Files)
                        </label>
                        <div id="compilation_panel_basic" class="compilation_panel" style="display:block">
                            <label>Target(s): <input type="text" id="compilation_target" value="."></label>
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
                    <button type="button" id="btn_toggle_all_detector_filters">Toggle All</button>
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
            <button type="button" id="btn_save_settings">Save Settings</button>
        </footer>
        </html>
        `;

        // Return our generated content.
        return content;
    }
}