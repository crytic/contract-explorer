import { Socket } from 'net';
import { print } from 'util';
import {
    integer,
	LanguageClient,
	LanguageClientOptions,
	ServerOptions,
    StreamInfo
} from 'vscode-languageclient/node';
import { Logger } from './utils/logger';
import { SlitherDetector, SlitherDetectorResult } from './types/slitherTypes';
import { CompilationSettings } from './types/configTypes';
import * as vscode from 'vscode'
import { CommandLineArgumentGroup, CreateAnalysisResult, VersionData } from './types/languageServerTypes';

// The name of the language server executable
const lsp_executable_name = "slither-lsp";

export class SlitherLanguageClient {
    
    public languageClient: LanguageClient;
    private socket: Socket | null = null;

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

    public async getDetectorList(): Promise<SlitherDetector[]> {
        // Obtain the list of all detectors our installation of slither has.
        return await this.languageClient.sendRequest("$/slither/getDetectorList", null);;
    }

    public async runDetectors(analysisId: number): Promise<SlitherDetectorResult[]> {
        // Create our params to send.
        let params = { 'analysisId': analysisId };

        // Run detectors and obtain the results
        return await this.languageClient.sendRequest("$/slither/runDetectors", params);
    }

    public async createAnalysis(compilationSettings: CompilationSettings): Promise<number> {
        // Create our params to send.
        let params = { 'compilationSettings': compilationSettings };

        // Send the command and return the result.
        let result: CreateAnalysisResult = await this.languageClient.sendRequest("$/slither/analysis/create", params);
        return result.analysisId;
    }

    public async deleteAnalysis(analysisId: number): Promise<void> {
        // Create our params to send.
        let params = { 'analysisId': analysisId };

        // Send the command to delete. There is no return value.
        await this.languageClient.sendRequest("$/slither/analysis/delete", params);
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