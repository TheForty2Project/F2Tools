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
        if(!workspaceFolders) {
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

    static pasteIntoClipboard(str: string){
        return vscode.env.clipboard.writeText(str);
    }

}

export class Message {
    static info(message: any) {
        vscode.window.showInformationMessage(message);
    }
    static err(message: any) {
        vscode.window.showErrorMessage(message);
    }
}
