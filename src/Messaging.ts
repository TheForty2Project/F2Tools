import * as vscode from 'vscode';
import { Data } from './Data';


export class Message
{
  static getTextFromObject(message: string | Error | any): string
  {
    return typeof message === "string"
      ? message
      : message instanceof Error
        ? message.stack ?? message.message
        : JSON.stringify(message, null, 2);
  }

  static info(message: string)
  {
    OutputChannelLogger.logInfo(message);
    vscode.window.showInformationMessage(Message.getTextFromObject(message));
  }

  static err(message: string | Error)
  {
    let text = Message.getTextFromObject(message);
    OutputChannelLogger.logError(text);
    vscode.window.showErrorMessage(text);
  }
}

//export const output = vscode.window.createOutputChannel("F2Tools");

export class OutputChannelLogger
{
  static LogLevel?: OutputChannelLogLevel = undefined;
  static Output?: vscode.LogOutputChannel = undefined;

  static parseLogLevel(value: string): OutputChannelLogLevel
  {
    switch (value)
    {
      case Data.CONFIG.LOG_LEVEL_NONE: return OutputChannelLogLevel.None;
      case Data.CONFIG.LOG_LEVEL_ERROR: return OutputChannelLogLevel.Error;
      case Data.CONFIG.LOG_LEVEL_WARNING: return OutputChannelLogLevel.Warning;
      case Data.CONFIG.LOG_LEVEL_INFO: return OutputChannelLogLevel.Info;
      case Data.CONFIG.LOG_LEVEL_DEBUG: return OutputChannelLogLevel.Debug;
      default: return OutputChannelLogLevel.Info;
    }
  }

  static log(message: string, logLevel: OutputChannelLogLevel)
  {
    if (this.LogLevel === undefined)
      this.LogLevel = OutputChannelLogger.parseLogLevel(vscode.workspace.getConfiguration(Data.MISC.EXTENSION_NAME).get<string>(Data.CONFIG.LOG_LEVEL, Data.CONFIG.LOG_LEVEL_DEBUG));
    if (this.Output === undefined)
    {
      try
      {
        this.Output = vscode.window.createOutputChannel("F2Tools", {log: true});
      }
      catch (err: any)
      {
        vscode.window.showErrorMessage("Error when creating output channel for logging: \n" + Message.getTextFromObject(err) + "\n\nThe message which should have been logged:\n" + message);
        return;
      }
    }

    if (this.LogLevel! >= logLevel)
    {            
      if (logLevel === OutputChannelLogLevel.Debug)
        this.Output.debug(message);
      else if (logLevel === OutputChannelLogLevel.Info)
        this.Output.info(message)
      else if (logLevel === OutputChannelLogLevel.Warning)
        this.Output.warn(message);
      else if (logLevel === OutputChannelLogLevel.Error)
        this.Output.error(message);

      OutputChannelLogger.Output!.show();
    }
  }

  static logInfo(message: string)
  {
    this.log(message, OutputChannelLogLevel.Info);
  }
  static logDebug(message: string)
  {
    this.log(message, OutputChannelLogLevel.Debug);
  }
  static logError(message: string | Error)
  {
    this.log(Message.getTextFromObject(message), OutputChannelLogLevel.Error);
  }
  static logWarning(message: string)
  {
    this.log(message, OutputChannelLogLevel.Warning);
  }
}

export enum OutputChannelLogLevel
{
  None = 0,
  Error = 1,
  Warning = 2,
  Info = 3,
  Debug = 4
}
