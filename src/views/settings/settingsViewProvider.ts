import * as vscode from 'vscode';
import * as state from '../../state';
import { Configuration } from '../../types/configTypes'
import * as path from 'path';
import * as fs from 'fs';

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
                case 'autogenerateSolcStandardJson': {
                    // Generate our solc standard json
                    if (state.client) {
                        state.client.generateSolcStandardJson().then((v) => {
                            if (this._view) {
                                this._view.webview.postMessage({method: 'setAutogeneratedSolcStandardJson', manifests: v});
                            }
                        });
                    }
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

        // Obtain our HTML page
        const htmlUri = path.resolve(this.context.extensionPath, 'src/views/settings/settings.html');
        let content = "<b>ERROR:</b> The settings view could not be loaded!";
        if (fs.existsSync(htmlUri)) {
            content = fs.readFileSync(htmlUri).toString();
        }

		// Get our script/stylesheet paths as links that work in the webview.
		const scriptUri = this._view.webview.asWebviewUri(vscode.Uri.joinPath(this.context.extensionUri, 'src', 'views', 'settings', 'settings.js'));
        const jQueryScriptUri = this._view.webview.asWebviewUri(vscode.Uri.joinPath(this.context.extensionUri, 'resources', 'jquery-3.6.0.min.js'));

        const styleUri = this._view.webview.asWebviewUri(vscode.Uri.joinPath(this.context.extensionUri, 'src', 'views', 'settings', 'settings.css'));
        const styleVSCodeUri = this._view.webview.asWebviewUri(vscode.Uri.joinPath(this.context.extensionUri, 'src', 'views', 'settings', 'vscode.css'));
        

        // Define some templated variables to replace.
        let templateVars = new Map<string, string>();
        templateVars.set("SCRIPT_MAIN_URI", scriptUri.toString());
        templateVars.set("SCRIPT_JQUERY", jQueryScriptUri.toString());

        templateVars.set("STYLE_MAIN_URI", styleUri.toString());
        templateVars.set("STYLE_VSCODE_URI", styleVSCodeUri.toString());

        // Loop for each template variable and perform the content replacement.
        for (let [templateKey, templateValue] of templateVars) {
            content = content.replace(`{{${templateKey}}}`, templateValue);
        }

        // Return our generated content.
        return content;
    }
}