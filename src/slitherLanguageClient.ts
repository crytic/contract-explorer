import { Socket } from 'net';
import { print } from 'util';
import {
    Emitter,
    integer,
	LanguageClient,
	LanguageClientOptions,
	ServerOptions,
    StreamInfo
} from 'vscode-languageclient/node';
import { Logger } from './utils/logger';
import { CompilationTarget } from './types/configTypes';
import * as vscode from 'vscode'
import { CommandLineArgumentGroup, CreateAnalysisResult, SlitherDetectorType, VersionData } from './types/languageServerTypes';
import { AnalysisProgressParams, SetCompilationTargetsParams } from './types/analysisTypes';

// The name of the language server executable
const lsp_executable_name = "slither-lsp";

export class SlitherLanguageClient {
    
    public languageClient: LanguageClient;
    private socket: Socket | null = null;

    private _analysisProgressEmitter: Emitter<AnalysisProgressParams> = new Emitter<AnalysisProgressParams>();
    public onAnalysisProgress: vscode.Event<AnalysisProgressParams> = this._analysisProgressEmitter.event;

    constructor(port: integer | null) {
        // Define server options.
        let serverOptions: ServerOptions;
        if (port == null) {
            // If we weren't given a port, we use stdio. We keep the process attached so when we exit, it exits.
            serverOptions = {
                run: { command: lsp_executable_name, args: [], options: { detached: false} },
                debug: { command: lsp_executable_name, args: [], options: { detached: false}  }
            };
        } else {
            // If we were given a port, we establish a TCP socket connection to localhost.
            let socket = new Socket();
            this.socket = socket;
            
            // Once we connect, our socket should be used for read/write handles in StreamInfo.
            serverOptions = () => {
                return new Promise((resolve, reject) => {
                    socket.connect(port, "127.0.0.1", () => {
                        resolve(<StreamInfo>{ reader: this.socket, writer: this.socket})
                    });
                });
            };
        }

        // Define the language to register the server for.
        let clientOptions: LanguageClientOptions = {
            documentSelector: [{ scheme: 'file', language: 'solidity' }]
        };

        // Define the language
        this.languageClient = new LanguageClient(
            'slither-lsp',
            'Slither Language Server',
            serverOptions,
            clientOptions
        );

        // When our server is ready, register our notification handlers.
        this.onReady(() => {
            // Define handlers for some requests/notifications.
            this.languageClient.onNotification("$/analysis/reportAnalysisProgress", (params: AnalysisProgressParams) => {
                this._analysisProgressEmitter.fire(params);
            });
        })

        // Start the client (and inherently, the server)
        this.languageClient.start();
    }

    public async onReady(callback: () => void) {
        // When the language client is ready, execute the callback.
        this.languageClient.onReady().then(callback);
    }

    public async stop() {
        if (this.languageClient) {
            this.languageClient.stop();
        }
    }

    public async getVersionData(): Promise<VersionData> {
        // Obtain version data.
        return await this.languageClient.sendRequest("$/slither/getVersion", null);
    }

    //#region slither Methods

    public async getDetectorTypeList(): Promise<SlitherDetectorType[]> {
        // Obtain the list of all detectors our installation of slither has.
        return await this.languageClient.sendRequest("$/slither/getDetectorList", null);;
    }

    public async setCompilationTargets(compilationTargets: CompilationTarget[]): Promise<void> {
        // Create our params to send.
        let params: SetCompilationTargetsParams = { targets: compilationTargets };

        // Send the command and return the result.
        await this.languageClient.sendRequest("$/compilation/setCompilationTargets", params);
    }

    //#endregion

    //#region crytic-compile Methods

    public async getCompileCommandLineArguments(): Promise<CommandLineArgumentGroup[]> {
        // Create our params to send.
        let params = { };

        // Send the command and return the result.
        let results: CommandLineArgumentGroup[] = await this.languageClient.sendRequest("$/cryticCompile/getCommandLineArguments", params);
        return results;
    }

    public async generateSolcStandardJson(): Promise<any> {
        // Obtain the list of all detectors our installation of slither has.
        let folders: string[] = [];
        if (vscode.workspace.workspaceFolders) {
            for (let i = 0; i < (vscode.workspace.workspaceFolders?.length ?? 0); i++) {
                folders.push(vscode.workspace.workspaceFolders[i].uri.fsPath);
            }
        }
        
        // Obtain our array of solc standard json objects.
        let response = await this.languageClient.sendRequest(
            "$/cryticCompile/solcStandardJson/autogenerate", 
            { 
                'folders': folders, 
                'files': []
            }
        );
        
        // Return our response
        return response;
    }

    //#endregion
}