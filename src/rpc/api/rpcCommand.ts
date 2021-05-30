export interface RpcCommandRequest {
    command: string;
    analysis?: number;
    args?: {};
}

export interface RpcCommandResponse {
    success: boolean;
    error: string | null | undefined;
    result: any | undefined;
}

export interface ConsoleRpcCommandRequest extends RpcCommandRequest {
    sequence: number | undefined;
}

export interface ConsoleRpcCommandResponse extends RpcCommandResponse {
    sequence: number | undefined;
}