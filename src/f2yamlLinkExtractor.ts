import * as vscode from 'vscode';
import { Data } from './Data';
import { VsCodeUtils, Message } from './VsCodeUtils';
import { YamlTaskOperations } from './YamlOperations';
import { StringOperation } from './StringOperations';


export class F2yamlLinkExtractor {
    protected static extractedSymbols: Array<string> = [];

    public static async createF2YamlSummaryLink(activeDoc: vscode.TextDocument, cursorPosition: vscode.Position) {
        let F2YamlSummaryLink = '';
        let filePath = activeDoc.uri.fsPath;
        filePath = await this.removeRootPath(filePath);
        filePath = StringOperation.removeExtension(filePath);
        let yamlPath = await this.getYamlPath(activeDoc, cursorPosition);
        return F2YamlSummaryLink = Data.PATTERNS.START_OF_F2YAML_LINK + filePath + "\\" + "." + yamlPath + Data.PATTERNS.END_OF_F2YAML_LINK;
    }

    static async getYamlPath(activeDoc: vscode.TextDocument, cursorPosition: vscode.Position, yamlKeyType: string = '') {
        let yamlPath = '';
        let yamlKeys = await this.getYamlKeys(activeDoc, cursorPosition)
        let yamlKeyValues;
        yamlKeyValues = await YamlTaskOperations.getYamlKeyValues(yamlKeys, yamlKeyType, activeDoc);
        let betterDots = this.moveDots(yamlKeyValues);
        let yamlParts: string[] = this.removeStatus(betterDots);
        return yamlPath = yamlParts.join('.');
    }
    static moveDots(yamlKeyValues: string[]) { // TODO move this from here
        let betterDots = []
        for(const keyValue of yamlKeyValues){
            if (keyValue.startsWith('".')) {
                let a = StringOperation.removeQuoteWrapping(keyValue);
                a = StringOperation.removeDot(a);
                a = StringOperation.wrapInQuotes(a);
                a = '.' + a;
                betterDots.push(a);
                continue;
            }
            betterDots.push(keyValue);
        }
        return betterDots;
    }

    static removeStatus(yamlKeys: string[]): string[] {
        let cleanYamlKeys: string[] = []
        for (let yamlKey of yamlKeys) {
            cleanYamlKeys.push(StringOperation.removeFirstWordIfFollowedBySpaceAndDotIfWrappendInQuotes(yamlKey));
        }
        return cleanYamlKeys;
    }

    static async getYamlKeys(activeDoc: vscode.TextDocument, cursorPosition: vscode.Position) {
        VsCodeUtils.isThisYamlDoc();
        let allYamlKeys;

        if (allYamlKeys == undefined) { // this block is here because of the delay in vscode to load the symbols which result in undefined allYamlKeys
            let tries = 1
            while (true) {
                VsCodeUtils.sleep(5000);
                allYamlKeys = await F2yamlLinkExtractor.getVsCodeDocSymbols(activeDoc);
                tries++;
                if (tries >= 3) {
                    throw new Error(Data.MESSAGES.ERRORS.DOCUMENT_SYMBOL_PROVIDER_FAILED);
                } else if (allYamlKeys) break;
            }
        }

        let yamlKeysToCursor = this.extractYamlKeysToCursor(allYamlKeys, cursorPosition);
        return yamlKeysToCursor;
    }

    private static async getVsCodeDocSymbols(activeDoc: vscode.TextDocument) {
        return await vscode.commands.executeCommand<vscode.DocumentSymbol[]>(
            'vscode.executeDocumentSymbolProvider',
            activeDoc.uri
        );
    }

    static async removeRootPath(filePath: string) {
        let rootPath = VsCodeUtils.getRootPath();
        const config = VsCodeUtils.getConfig();
        await config.update(Data.CONFIG.WORKSPACE_PATH, rootPath, vscode.ConfigurationTarget.Global);

        if (!rootPath) {
            rootPath = config.get<string>(Data.CONFIG.WORKSPACE_PATH);
        }

        if(!rootPath) throw new Error(Data.MESSAGES.ERRORS.NO_ROOT_PATH);
        if (filePath.startsWith(rootPath)) {
            let shortFilePath = filePath.substring(rootPath.length);
            shortFilePath = shortFilePath.slice(1);
            return shortFilePath;
        } else {
            throw new Error(Data.MESSAGES.ERRORS.FILE_PATH_DOES_NOT_START_WITH_ROOTPATH);
        }
    }

    private static extractYamlKeysToCursor(
        allYamlKeys: vscode.DocumentSymbol[],
        cursorPosition: vscode.Position
    ): string[] {
        for (const key of allYamlKeys) {
            if (!key.range.contains(cursorPosition)) continue;

            const yamlKeys: string[] = [key.name];

            if (key.children && key.children.length > 0) {
                const childKeys = this.extractYamlKeysToCursor(key.children, cursorPosition);
                yamlKeys.push(...childKeys);
            }
            return yamlKeys; // return only the first matching path
        }
        return [];
    }

    static async createF2YamlIdLink(activeDoc: vscode.TextDocument, cursorPosition: vscode.Position) {
        let F2YamlIdLink = '';
        let filePath = activeDoc.uri.fsPath;
        filePath = await this.removeRootPath(filePath);
        filePath = StringOperation.removeExtension(filePath);
        let yamlPath = await this.getYamlPath(activeDoc, cursorPosition, "Id");
        return F2YamlIdLink = Data.PATTERNS.START_OF_F2YAML_LINK + filePath + "\\" + "." + yamlPath + Data.PATTERNS.END_OF_F2YAML_LINK;
    }
}