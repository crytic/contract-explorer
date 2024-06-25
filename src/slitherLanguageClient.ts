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
import { AnalysisRequestParams } from "./types/analysisTypes";

export class SlitherLanguageClient {
  public languageClient: LanguageClient;
  private socket: Socket | null = null;

  constructor(slitherLspPath: string, port: integer | null) {
    // Define server options.
    let serverOptions: ServerOptions;
    if (port == null) {
      // If we weren't given a port, we use stdio. We keep the process attached so when we exit, it exits.
      serverOptions = {
        run: {
          command: slitherLspPath,
          args: [],
          options: { detached: false },
        },
        debug: {
          command: slitherLspPath,
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
}
