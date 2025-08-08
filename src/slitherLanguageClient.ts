import * as vscode from "vscode";
import { Socket } from "net";
import {
  integer,
  LanguageClient,
  LanguageClientOptions,
  ServerOptions,
  StreamInfo,
} from "vscode-languageclient/node";
import { DetectorSettings } from "./types/configTypes";
import {
  CommandLineArgumentGroup,
  SlitherDetectorType,
  VersionData,
} from "./types/languageServerTypes";
import { AnalysisRequestParams, SliceParams, IntervalAnalysisParams, IntervalAnalysisResult } from "./types/analysisTypes";

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
        run: {
          command: lsp_executable_name,
          args: [],
          options: { detached: false },
        },
        debug: {
          command: lsp_executable_name,
          args: [],
          options: { detached: false },
        },
      };
    } else {
      // If we were given a port, we establish a TCP socket connection to localhost.
      let socket = new Socket();
      this.socket = socket;

      // Once we connect, our socket should be used for read/write handles in StreamInfo.
      serverOptions = () => {
        return new Promise((resolve, reject) => {
          socket.connect(port, "127.0.0.1", () => {
            resolve(<StreamInfo>{ reader: this.socket, writer: this.socket });
          });
        });
      };
    }

    // Define the language to register the server for.
    let clientOptions: LanguageClientOptions = {
      documentSelector: [{ scheme: "file", language: "solidity" }],
    };

    // Define the language
    this.languageClient = new LanguageClient(
      "slither-lsp",
      "Slither Language Server",
      serverOptions,
      clientOptions
    );
  }

  public async start(callback: () => void) {
    // When the language client is ready, execute the callback.
    await this.languageClient.start().then(callback);
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
    return await this.languageClient.sendRequest(
      "$/slither/getDetectorList",
      null
    );
  }

  public async setDetectorSettings(
    detectorSettings: DetectorSettings
  ): Promise<void> {
    // Send the command and return the result.
    await this.languageClient.sendRequest(
      "$/slither/setDetectorSettings",
      detectorSettings
    );
  }

  //#endregion

  //#region crytic-compile Methods

  public async getCompileCommandLineArguments(): Promise<
    CommandLineArgumentGroup[]
  > {
    // Create our params to send.
    let params = {};

    // Send the command and return the result.
    let results: CommandLineArgumentGroup[] =
      await this.languageClient.sendRequest(
        "$/cryticCompile/getCommandLineArguments",
        params
      );
    return results;
  }

  //#endregion

  public analyze(params: AnalysisRequestParams): Promise<void> {
    return this.languageClient.sendRequest("$/slither/analyze", params);
  }

  public async forward_slice(params: SliceParams): Promise<vscode.Location[]> {
    return this.languageClient.sendRequest("$/slither/forwardSlice", params);
  }

  public async backward_slice(params: SliceParams): Promise<vscode.Location[]> {
    return this.languageClient.sendRequest("$/slither/backwardSlice", params);
  }

  public async intervalAnalysis(params: IntervalAnalysisParams): Promise<IntervalAnalysisResult> {
    // Call the Python script directly since the language server doesn't support this yet
    const { spawn } = require('child_process');
    const path = require('path');
    
    return new Promise((resolve, reject) => {
      // Convert file:// URI to file path
      let filePath = params.uri;
      if (filePath.startsWith('file://')) {
        filePath = filePath.substring(7);
      }
      
      // Path to the interval analysis script in the slither repo
      const scriptPath = '/Volumes/CaseSensitive/slither/slither/analyses/data_flow/interval_enhanced/tests/testing_extension.py';
      
      // Use the slither virtual environment
      const pythonProcess = spawn('/Volumes/CaseSensitive/slither/env/bin/python', [scriptPath, filePath]);
      
      let output = '';
      let error = '';
      
      pythonProcess.stdout.on('data', (data: Buffer) => {
        output += data.toString();
      });
      
      pythonProcess.stderr.on('data', (data: Buffer) => {
        error += data.toString();
      });
      
                 pythonProcess.on('close', (code: number) => {
             if (code === 0) {
               try {
                 // Extract JSON from the output (handle mixed log + JSON output)
                 const jsonMatch = output.match(/\{[\s\S]*\}/);
                 if (jsonMatch) {
                   const jsonOutput = jsonMatch[0];
                   const result: IntervalAnalysisResult = JSON.parse(jsonOutput);
                   resolve(result);
                 } else {
                   reject(new Error('No JSON found in output'));
                 }
               } catch (e) {
                 reject(new Error(`Failed to parse result: ${e}`));
               }
             } else {
               reject(new Error(`Python script failed with code ${code}: ${error}`));
             }
           });
      
      pythonProcess.on('error', (err: Error) => {
        reject(new Error(`Failed to start Python process: ${err.message}`));
      });
    });
  }

}
