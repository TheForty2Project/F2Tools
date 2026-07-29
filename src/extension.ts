import * as vscode from 'vscode';
import { Commands } from './Commands';
import { createApplicationServices } from './Items/ItemManager';
import { Message } from './Messaging';
export function activate(context: vscode.ExtensionContext) {


  const disposableForReportsWriteBack = vscode.commands.registerCommand('F2Tools.Reports.WriteBack', async () => {
    await Commands.writeBackFromReport();
  });

  const disposableForSr = vscode.commands.registerCommand('f2tools.specifyStandupReport', async () => {
    await Commands.specifyStandupReport();
  });

  const disposableForTaskSelection = vscode.commands.registerCommand('f2tools.taskSelection', async () => {
    await Commands.selectTask();
  });

  const disposableForPauseResumeTimer = vscode.commands.registerCommand('f2tools.pauseResumeTimer', async () => {
    Commands.pauseOrResumeTask();
  });

  const disposableForStopTimer = vscode.commands.registerCommand('f2tools.stopTimer', async () => {
    await Commands.stopTask();
  });

  const disposableForWorkLogGenerator = vscode.commands.registerCommand('f2tools.generateWorkLogs', async () => {
    await Commands.generateWorkLogs();
  });

  const disposableForF2yamlSummaryLinkExtractor = vscode.commands.registerCommand('f2tools.extractF2YamlSummaryLink', async () => {
    await Commands.extractF2YamlSummaryLink();
  });

  const disposableForF2yamlIdLinkExtractor = vscode.commands.registerCommand('f2tools.extractF2YamlIdLink', async () => {
    await Commands.extractF2YamlIdLink();
  });

  const disposableForF2yamlLinkFollower = vscode.commands.registerCommand('f2tools.followF2yamlLink', async () => {
    await Commands.followF2yamlLink();
  });

  const disposableForCSVGeneration = vscode.commands.registerCommand('f2tools.generateCSV', async () => {
    await Commands.generateCSV();
  });

  vscode.window.showInformationMessage("Start");
  
  const workspaceRoot =
    vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;

  if (!workspaceRoot)
  {
    Message.err("no workspace root");
    return;
  }

  const services = createApplicationServices(workspaceRoot);

  context.subscriptions.push(    
    vscode.commands.registerCommand('F2Tools.Reports.Execute', async () =>
      {
        await Commands.executeQuery(services.itemManager);
      }),
    disposableForReportsWriteBack,
    disposableForSr,
    disposableForTaskSelection,
    disposableForPauseResumeTimer,
    disposableForStopTimer,
    disposableForWorkLogGenerator,
    disposableForF2yamlSummaryLinkExtractor,
    disposableForF2yamlIdLinkExtractor,
    disposableForF2yamlLinkFollower,
    disposableForCSVGeneration
  );
  


}

export function deactivate() { }
