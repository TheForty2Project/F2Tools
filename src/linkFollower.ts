import { Data } from "./Data";
import { HackingFixes } from "./HackingFixes";
import { StringOperation } from "./StringOperations";
import { Message, VsCodeUtils } from "./VsCodeUtils";
import { YamlTaskOperations } from "./YamlOperations";
import * as vscode from 'vscode';
import { LineCounter } from "yaml";
import * as yaml from "yaml";

export class LinkFollower {

    static async followF2yamlLink(yamlLink: string) { // TODO clean this later
        try {
            const { filePath, yamlPath } = StringOperation.parseF2yamlLink(yamlLink);
            const fileUri: vscode.Uri = await VsCodeUtils.getFileUri(filePath);
            const yamlKeys: string[] = StringOperation.parseYamlPath(yamlPath);
            const yamlObj: any = await YamlTaskOperations.getYamlObj(yamlKeys, fileUri);
            const docOftheLink = await vscode.workspace.openTextDocument(fileUri);    
            let from: number;
            let to: number;
            if (yamlObj instanceof yaml.Scalar)
            {
                from = yamlObj.range?.[0] as number;
                to = yamlObj.range?.[1] as number;
            }
            else
            {
                let yamlMap: yaml.YAMLMap = HackingFixes.getYamlMapFromPairOrYamlMap(yamlObj);
                from = yamlMap.range?.[0] as number;
                to = yamlMap.range?.[2] as number;
            }

            const range = this.toVsRange(from, to, YamlTaskOperations.lineCounter);

            const editor = await vscode.window.showTextDocument(docOftheLink, { preview: false });
            editor.selection = new vscode.Selection(range.start, range.end);
            editor.revealRange(range, vscode.TextEditorRevealType.InCenter);

        } catch (error: any) {
            Message.err(error.message);
        }
    }


    static toVsRange(from: number, to: number, lineCounter: LineCounter): vscode.Range { // TODO move this to someplace else
        //const [start, , end] = yamlObj.range;

        const startPos = lineCounter.linePos(from);
        const endPos = lineCounter.linePos(to);

        return new vscode.Range(
            new vscode.Position(startPos.line - 1, startPos.col - 1),
            new vscode.Position(endPos.line - 1, endPos.col - 1)
        );
    }
    // static async followF2yamlLink(yamlLink: string) {
    //     try {
    //         const { filePath, yamlPath } = StringOperation.parseF2yamlLink(yamlLink);
    //         const fileUri: vscode.Uri = await VsCodeUtils.getFileUri(filePath);
    //         const yamlKeys: string[] = StringOperation.parseYamlPath(yamlPath);
    //         const yamlObj: any = await YamlTaskOperations.getYamlObj(yamlKeys, fileUri);
    //         const keyValueOfYamlObj: string = YamlTaskOperations.getYamlKeyValue(yamlObj)
    //         const keyValueWithSpaces = this.addSpacesInKey(keyValueOfYamlObj, yamlKeys);
    //         const docOftheLink = await vscode.workspace.openTextDocument(fileUri);
    //         const cleanKeyValue = StringOperation.escapeSpecialCharacters(keyValueWithSpaces)
    //         const taskSummaryRegex = new RegExp("^\s*" + cleanKeyValue, "im") // what are those magic strings
    //         await this.findTheTask(taskSummaryRegex, docOftheLink);
    //     } catch (error: any) {
    //         Message.err(error.message);
    //     }
    // }

    static addSpacesInKey(keyValueOfYamlObj: string, yamlKeys: string[]) {
        let keyWithSpaces = '';
        let spaces = '';
        for (let index = 0; index < yamlKeys.length - 1; index++) {
            spaces += "  ";
        }
        keyWithSpaces = spaces + keyValueOfYamlObj;
        if (!keyValueOfYamlObj) keyWithSpaces = yamlKeys[0]; // becaue the parent obj dosent come with keyvalue
        return keyWithSpaces;
    }

    static async findTheTask(taskSummaryRegex: RegExp, taskDoc: vscode.TextDocument) {
        const text = taskDoc.getText();
        const match = taskSummaryRegex.exec(text);

        if (!match || match.index === undefined) throw new Error(Data.MESSAGES.ERRORS.LINK_ITEM_NOT_FOUND);

        const startPos = taskDoc.positionAt(match.index);
        const endPos = taskDoc.positionAt(match.index + match[0].length);
        const range = new vscode.Range(startPos, endPos);

        const editor = await vscode.window.showTextDocument(taskDoc, { preview: false });
        editor.selection = new vscode.Selection(startPos, endPos);
        editor.revealRange(range, vscode.TextEditorRevealType.InCenter);
    }

    async giveExactSummaryWithSpaces(yamlLink: string) {
        const taskObj = await YamlTaskOperations.getTaskObj(yamlLink)
        if (!taskObj) return;
        let exactSummary = taskObj.key.value;
        if (!exactSummary) exactSummary = taskObj.key;
        const yamlKeys = YamlTaskOperations.getCleanYamlKeys(yamlLink);
        if (!yamlKeys) return;
        let spaces: string = "";
        for (let index = 1; index < yamlKeys.length; index++) {
            spaces += "  ";
        }
        const summaryWithSpaces = spaces + exactSummary;
        return summaryWithSpaces;
    }
}