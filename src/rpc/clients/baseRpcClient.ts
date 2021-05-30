import * as child_process from 'child_process';
import { RpcCommandRequest, RpcCommandResponse } from '../api/rpcCommand'

export interface CommandSuccessCallback {
    (response: RpcCommandResponse): void
}

export interface CommandErrorCallback {
    (error: string): void
}

export abstract class BaseRpcClient {
    constructor() {

    }

    public abstract start(): Promise<void>;
    
    public abstract send_command(command: RpcCommandRequest, success_cb: CommandSuccessCallback, error_cb: CommandErrorCallback): Promise<void>;
}
