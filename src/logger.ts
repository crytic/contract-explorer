import * as vscode from "vscode";

export class Logger {
  private static outputChannel: vscode.OutputChannel =
    vscode.window.createOutputChannel("Slither Extension");

  public static show(): void {
    // Reveal this channel in the UI.
    this.outputChannel.show();
  }

  public static log(msg: string): void {
    // Output the base message.
    this.outputChannel.appendLine(msg);
  }

  public static info(msg: string): void {
    // Output the info to console
    this.outputChannel.appendLine(msg);
  }

  public static error(msg: string, showErrorDialog: boolean = true): void {
    // Prefix the error
    msg = `Error: ${msg}`;

    // Output the error to console
    this.outputChannel.appendLine(msg);

    // Show our error dialog if desired
    if (showErrorDialog) {
      vscode.window.showErrorMessage(msg);
    }

    // Show our output channel
    this.show();
  }
}
