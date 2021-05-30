import * as child_process from 'child_process';
import { print } from 'util';
import { RpcCommandRequest, RpcCommandResponse, ConsoleRpcCommandRequest, ConsoleRpcCommandResponse } from '../api/rpcCommand';
import { BaseRpcClient, CommandSuccessCallback, CommandErrorCallback} from './baseRpcClient'
import * as vscode from 'vscode';

export class ConsoleRpcClient extends BaseRpcClient {
    public rpc_process: child_process.ChildProcess | null = null;
    private command_sequence: number = 0;
    private command_callbacks: Map<number, [CommandSuccessCallback, CommandErrorCallback]> = new Map<number, [CommandSuccessCallback, CommandErrorCallback]>();
    constructor() {
        super()
    }

    public async start(): Promise<void> {
        // TODO: Add ability to specify command line arguments and cwd.
        let exec_cwd : string | undefined = undefined;
        if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
            exec_cwd = vscode.workspace.workspaceFolders[0].uri.fsPath;
        }
        this.rpc_process = child_process.spawn(`slither-rpc`, [], { cwd : exec_cwd});

        // Add our response handling callback, which simply routes responses to the correct callback using our map.
        let self = this;
        this.rpc_process.stdout.on('data', function(data) {
            // Parse the JSON response and return the deserialized object.
            let response: ConsoleRpcCommandResponse = JSON.parse(data.toString());
      
            // Verify we have a sequence number to identify which callback the response corresponds to
            if (response.sequence == undefined) {
                throw new Error("Console RPC command response did not contain a sequence number.");
            }

            // Obtain the callback from the map
            let callback = self.command_callbacks.get(response.sequence);
            if (callback == undefined) {
                throw new Error("Console RPC command response contained an invalid sequence number.");
            }

            // Delete the callback from our lookup
            self.command_callbacks.delete(response.sequence);

            // Execute the callback
            if (response.success) {
                callback[0](response);
            } else if (response.error != undefined) {
                callback[1](response.error);
            } else {
                callback[1]("Unknown error: Error message was not received in command response.");
            }
        });
    }

    public async send_command(command: RpcCommandRequest, success_cb: CommandSuccessCallback, error_cb: CommandErrorCallback): Promise<void> {

        // Verify we have an RPC process to send commands to.
        if (this.rpc_process == null) {
            throw new Error("No RPC process exists to send commands to.");
        }

        // Add a sequence number to the command by converting it to a ConsoleRpcCommandRequest.
        let sequenced_command: ConsoleRpcCommandRequest = {...command, sequence: this.command_sequence}
        
        // Set our callback for this sequence number in our map
        this.command_callbacks.set(this.command_sequence, [success_cb, error_cb]);
        this.command_sequence++;
        
        // Convert our command to JSON
        let command_str = JSON.stringify(sequenced_command);

        // Write the command string to stdin.
        let written = this.rpc_process.stdin.write(command_str + '\n');
    }
}