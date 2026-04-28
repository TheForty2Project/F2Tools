import * as vscode from "vscode";

export class Logger {
  private static channel = vscode.window.createOutputChannel("My Extension");

  static info(message: string) {
    this.channel.appendLine(`[INFO] ${message}`);
  }

  static error(message: string, error?: unknown) {
    this.channel.appendLine(`[ERROR] ${message}`);
    if (error) {
      this.channel.appendLine(String(error));
    }
  }

  static show() {
    this.channel.show();
  }
}