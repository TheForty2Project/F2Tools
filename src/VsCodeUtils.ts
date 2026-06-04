import * as vscode from 'vscode';
import { Data } from './Data';
import path from 'path';


export class VsCodeUtils {

  static async getFileUri(filePath: any): Promise<vscode.Uri> {
    let fileUri: vscode.Uri;
    const rootPath = VsCodeUtils.getRootPath();
    try {
      const filePathFromRoot = rootPath + "\\" + filePath + ".yaml";
      fileUri = vscode.Uri.file(path.resolve(filePathFromRoot));
      await vscode.workspace.fs.stat(fileUri);
    } catch (error: any) {
      try {
        const filePathFromRoot = rootPath + "\\" + filePath + ".yml";
        fileUri = vscode.Uri.file(path.resolve(filePathFromRoot));
        await vscode.workspace.fs.stat(fileUri);
      } catch (e) {
        throw new Error(`${filePath} not found \n check if you have entered the correct rootPath or the fileName is Wrong`);
      }
    }
    return fileUri;
  }

  static getConfig() {
    return vscode.workspace.getConfiguration(Data.MISC.EXTENSION_NAME);
  } 

  static getRootPath() {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) {
      Message.err(Data.MESSAGES.ERRORS.NO_WORKSPACE);
      return;
    }
    const rootFolder = workspaceFolders[0];
    return rootFolder.uri.fsPath;
  }

  static getActiveDoc() {
    const activeEditor = this.getActiveEditor();
    return activeEditor.document;
  }

  static getActiveEditor() {
    const activeEditor = vscode.window.activeTextEditor;
    if (!activeEditor) throw new Error(Data.MESSAGES.ERRORS.NO_ACTIVE_TEXT_EDITOR);
    return activeEditor;
  }

  static isThisYamlDoc(): boolean {
    const activeDocument = this.getActiveDoc();
    if (activeDocument.languageId !== Data.MISC.YAML) {
      Message.err(Data.MESSAGES.ERRORS.THIS_COMMAND_ONLY_WORKS_WITH_YAML_FILES);
      return false;
    }
    return true
  }

  static getCursorPosition() {
    const activeEditor = this.getActiveEditor();
    return activeEditor.selection.active;
  }

  static sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  static pasteIntoClipboard(str: string) {
    return vscode.env.clipboard.writeText(str);
  }

}

export class Message {
  static getText(message: unknown)
  {
    return typeof message === "string"
      ? message
      : message instanceof Error
        ? message.stack ?? message.message
        : JSON.stringify(message, null, 2);
  }

  static info(message: unknown) {
    OutputChannelLogger.logInfo(message);
    vscode.window.showInformationMessage(Message.getText(message));
  }

  static err(message: any) {
    OutputChannelLogger.logError(message);
    vscode.window.showErrorMessage(Message.getText(message));
  }
}

const output = vscode.window.createOutputChannel("F2Tools");

export enum OutputChannelLogLevel
{
  None = 0,
  Error = 1,
  Warning = 2,
  Info = 3,
  Debug = 4
}

export class OutputChannelLogger {
  static LogLevel?: OutputChannelLogLevel = undefined;

  static parseLogLevel(value: string): OutputChannelLogLevel {
    switch (value) {
      case Data.CONFIG.LOG_LEVEL_NONE: return OutputChannelLogLevel.None;
      case Data.CONFIG.LOG_LEVEL_ERROR: return OutputChannelLogLevel.Error;
      case Data.CONFIG.LOG_LEVEL_WARNING: return OutputChannelLogLevel.Warning;
      case Data.CONFIG.LOG_LEVEL_INFO: return OutputChannelLogLevel.Info;
      case Data.CONFIG.LOG_LEVEL_DEBUG: return OutputChannelLogLevel.Debug;
      default: return OutputChannelLogLevel.Info;
    }
  }

  static log(message: unknown, logLevel: OutputChannelLogLevel)
  {
    if (this.LogLevel === undefined)
      this.LogLevel = OutputChannelLogger.parseLogLevel(vscode.workspace.getConfiguration(Data.MISC.EXTENSION_NAME).get<string>(Data.CONFIG.LOG_LEVEL, Data.CONFIG.LOG_LEVEL_DEBUG));

    if (logLevel >= this.LogLevel!)
    {
      output.appendLine(Message.getText(message));
      output.show();
    }
  }

  static logInfo(message: unknown) {
    this.log(message, OutputChannelLogLevel.Info);
  }
  static logDebug(message: unknown) {
    this.log(message, OutputChannelLogLevel.Debug);
  }
  static logError(message: unknown) {
    this.log(message, OutputChannelLogLevel.Error);
  }
  static logWarning(message: unknown) {
    this.log(message, OutputChannelLogLevel.Warning);
  }
}
