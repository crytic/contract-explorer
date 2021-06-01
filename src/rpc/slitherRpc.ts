import { Socket } from 'net';
import {
    integer,
	LanguageClient,
	LanguageClientOptions,
	ServerOptions,
    StreamInfo
} from 'vscode-languageclient/node';

const uninitializedRpcClient = new Error("RPC client was not initialized."); 
const slither_rpc = "slither-rpc";
export class SlitherRpc {
    private languageClient: LanguageClient;
    private socket: Socket | null = null;
    constructor(port: integer | undefined) {
        // Define server options.
        let serverOptions: ServerOptions;
        if (port === undefined) {
            // If we weren't given a port, we use stdio.
            serverOptions = {
                run: { command: slither_rpc, args: [] },
                debug: { command: slither_rpc, args: [] }
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
            'slither',
            'Slither',
            serverOptions,
            clientOptions
        );

        // Start the client (and inherently, the server)
       this.languageClient.start();
    }

    public async stop() {
        if (this.languageClient) {
            this.languageClient.stop();
        }
    }

    public async analyze(
        target: string, 
        success_cb: (analysis_key: number) => void, 
        error_cb: (msg: string) => void)
    {
        // Create our command to send.
        let args = { 'target': target };
        let response = await this.languageClient.sendRequest("$/slither/analyze", args);

        // TODO: Figure out receiving/notifications, or if we want to do this at all here.
    }
}