import * as vscode from 'vscode';
import * as state from '../../state';
import { Configuration } from '../../types/configTypes'
import * as path from 'path';
import * as fs from 'fs';

export class SettingsViewProvider implements vscode.WebviewViewProvider {

    public static readonly view_id = 'slither-settings-webview';
    private _view?: vscode.WebviewView;

    constructor(
		private readonly context: vscode.ExtensionContext
	) { }

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
            
        });

        // If our state is initialized already, initialize the webview with our new configuration.
        // This will happen if the language server is started before the webview is rendered.
        if (state.isInitialized()) {
            // Initialize the view with our configuration.
            this.initialize();
        }

        // Otherwise, in case the webview was rendered before the language server was started, we subscribe to the
        // state initialization event to initialize the webview with the data when it is available.
        state.onInitialized(() => {
            // Initialize the view with our configuration.
            this.initialize();
        });

        vscode.workspace.onDidChangeWorkspaceFolders((e: vscode.WorkspaceFoldersChangeEvent) => {
            this.refreshWorkspaceFolders();
        });
    }

    private initialize() {
        // Initialize from our state configuration.
        this._view?.webview?.postMessage({method: 'initialize', config: state.configuration});

        // Refresh our detector types for detector settings.
        this.refreshDetectorTypes();

        // Refresh our selection of workspace folders for compilation settings.
        this.refreshWorkspaceFolders();
    }

    public refreshDetectorTypes() {
        // If we have a view, send it our detectors list JSON.
        this._view?.webview?.postMessage({method: 'refreshDetectorTypes', detectors: state.detectorTypes});
    }

    public refreshWorkspaceFolders() {
        // If we have a view, send it our workspace folders.
        this._view?.webview?.postMessage({method: 'refreshWorkspaceFolders', folders: vscode.workspace.workspaceFolders});
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