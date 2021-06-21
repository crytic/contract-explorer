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
import { SlitherDetector, SlitherVersionData } from './types/detectorOutputTypes';

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

    public async getVersionData(): Promise<SlitherVersionData> {
        // Obtain version data.
        let response: SlitherVersionData = await this.languageClient.sendRequest("$/slither/getVersion", null);
        return response;
    }

    public async getDetectorList(): Promise<SlitherDetector[]> {
        // Obtain the list of all detectors our installation of slither has.
        let response: SlitherDetector[] = await this.languageClient.sendRequest("$/slither/getDetectorList", null);
        return response;
    }


    public async analyze(
        target: string, 
        success_cb: (analysis_key: number) => void, 
        error_cb: (msg: string) => void)
    {
        // Create our command to send.
        try{
            let args = { 'target': target };

            let response = await this.languageClient.sendRequest("$/slither/analyze", args);

            // TODO: Figure out receiving/notifications, or if we want to do this at all here.
            Logger.log(String(response));
        } catch(err) {
            error_cb(err.msg);
        }
    }
}