import * as vscode from 'vscode';
import { Commands } from './Commands';
import { Message } from './VsCodeUtils';
export async function activate(context: vscode.ExtensionContext) {
    setTimeout(() => {
        // Message.info("HI")
        vscode.window.showInformationMessage("HI from extension");
    }, 5000); // delay 2 seconds
    await Commands.stopTask(context);

    const disposableForSr = vscode.commands.registerCommand('f2tools.specifyStandupReport', async () => {
        await Commands.specifyStandupReport(context);
    });

    const disposableForTaskSelection = vscode.commands.registerCommand('f2tools.taskSelection', async () => {
        await Commands.selectTask(context);
    });

    const disposableForPauseResumeTimer = vscode.commands.registerCommand('f2tools.pauseResumeTimer', async () => {
        Commands.pauseOrResumeTask();
    });

    const disposableForStopTimer = vscode.commands.registerCommand('f2tools.stopTimer', async () => {
        await Commands.stopTask(context);
    });

    const disposableForWorkLogGenerator = vscode.commands.registerCommand('f2tools.generateWorkLogs', async () => {
        await Commands.generateWorkLogs(context);
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

    context.subscriptions.push(
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
