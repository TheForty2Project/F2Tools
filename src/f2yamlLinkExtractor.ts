import * as yaml from 'yaml';
import * as vscode from 'vscode';
import { Data } from './Data';
import { VsCodeUtils, Message } from './VsCodeUtils';
import { YamlTaskOperations } from './YamlOperations';
import { StringOperation } from './StringOperations';


export class F2yamlLinkExtractor {
  protected static extractedSymbols: Array<string> = [];

  public static async createF2YamlSummaryLink(activeDoc: vscode.TextDocument, cursorPosition: vscode.Position) {
    return this.createF2Link(activeDoc, cursorPosition, false);
  }

  static async createF2YamlIdLink(activeDoc: vscode.TextDocument, cursorPosition: vscode.Position) {
    return this.createF2Link(activeDoc, cursorPosition, true);
  }

  static async createF2Link(activeDoc: vscode.TextDocument, cursorPosition: vscode.Position, idLink: boolean) {
    let filePath = activeDoc.uri.fsPath;
    filePath = await this.removeRootPath(filePath);
    filePath = StringOperation.removeExtension(filePath);
    let yamlPath = await this.getYamlPath(activeDoc, cursorPosition, idLink);
    return Data.PATTERNS.START_OF_F2YAML_LINK + filePath + "\\" + "." + yamlPath + Data.PATTERNS.END_OF_F2YAML_LINK;
  }

  static async getYamlPath(activeDoc: vscode.TextDocument, cursorPosition: vscode.Position, idLink: boolean) {
    let yamlPath = '';
    let yamlKeys = await this.getYamlKeys(activeDoc, cursorPosition);
    let yamlKeyValues = await this.getPropertyValuesFor(yamlKeys, idLink, activeDoc);
    let betterDots = this.moveDots(yamlKeyValues);
    let yamlParts: string[] = this.removeStatus(betterDots);
    return yamlPath = yamlParts.join('.');
  }

  static async getPropertyValuesFor(yamlKeys: string[], idLink: boolean, activeDoc: vscode.TextDocument): Promise<string[]> {
    let yamlKeyValues: string[] = [];
    const yamlDoc = await YamlTaskOperations.parseYamlDoc(activeDoc.uri);
    let parentYamlObj: any = yamlDoc.get(yamlKeys[0], true);
    let parentKeyValue = this.getParentValue(parentYamlObj, idLink ? "Id" : "", yamlKeys[0]);
    yamlKeyValues.push(parentKeyValue);

    for (let index = 1; index < yamlKeys.length; index++) {
      const yamlKey = yamlKeys[index];
      const yamlObj = await this.getYamlObjFromParentObj(yamlKey, yamlDoc, parentYamlObj);
      const yamlKeyValue = await this.getYamlKeyValueBasedOnKeyType(yamlObj, idLink ? "Id" : "");
      if (!yamlKeyValue) {
        const yamlKeySummary = StringOperation.wrapInQuotesIfMultiWord(yamlKey);
        yamlKeyValues.push(yamlKeySummary);
        parentYamlObj = yamlObj;
        continue;
      }
      yamlKeyValues.push(yamlKeyValue);
      parentYamlObj = yamlObj;
    }
    // first I need to get the actual yaml-obj from the yamlKeys
    // second I need to get the value of the yamlkeys form the objects and there if the yamlKeyType is not found then give the summary instead of the value of the key
    return yamlKeyValues;
  }

  private static getParentValue(parentYamlObj: any, yamlKeyType: string, yamlKey: string) {
    let parentKeyValue = this.getYamlKeyValueBasedOnKeyType(parentYamlObj, yamlKeyType);
    let parentKeySummary;
    if (!parentKeyValue) {
      if (yamlKey.startsWith('.')) {
        parentKeyValue = this.TheDotSettelment(yamlKey);
        return parentKeyValue
      }
      parentKeySummary = StringOperation.wrapInQuotesIfMultiWord(yamlKey);
      parentKeyValue = parentKeySummary;
    }
    return parentKeyValue;
  }

  private static TheDotSettelment(yamlKey: string) { // TODO move to stringOperations
    let withoutdot = yamlKey.slice(1);
    let newWord = StringOperation.wrapInQuotesIfMultiWord(withoutdot);
    newWord = '.' + newWord;
    return newWord;
  }


  static getYamlObjFromParentObj(yamlKey: string, yamlDoc: yaml.Document<yaml.Node, true>, parentYamlObj: any) {
    let yamlObj: any;
    let yamlObjItems = parentYamlObj.items;
    if (!yamlObjItems) yamlObjItems = parentYamlObj.value.items;
    for (const item of yamlObjItems) {
      if (yamlKey == item.key.value) yamlObj = item;
    }
    return yamlObj;
  }

  static getYamlKeyValueBasedOnKeyType(yamlObj: any, yamlKeyType: string) { // TODO 
    let yamlKeyValue;
    if (!yamlKeyType || !yamlObj.value) return;
    try {
      for (const item of yamlObj.value.items) {
        if (item.key.value == yamlKeyType) {
          yamlKeyValue = item.value.value;
        }
      }
    } catch (error1: any) {
      try {

        for (const item of yamlObj.items) {
          if (item.key.value == yamlKeyType) {
            yamlKeyValue = item.value.value;
          }
        }
      } catch (error2: any) {
        //Message.err(error1.message + error2.message);
      }
    }
    if (yamlKeyType == "Id" && yamlKeyValue != undefined) return "." + yamlKeyValue; // a temp mesue
    return yamlKeyValue;
  }

  static moveDots(yamlKeyValues: string[]) {
    let betterDots = [];
    for (const keyValue of yamlKeyValues) {
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
    let cleanYamlKeys: string[] = [];
    for (let yamlKey of yamlKeys) {
      cleanYamlKeys.push(StringOperation.removeFirstWordIfFollowedBySpaceAndDotIfWrappendInQuotes(yamlKey));
    }
    return cleanYamlKeys;
  }

  static async getYamlKeys(activeDoc: vscode.TextDocument, cursorPosition: vscode.Position) {
    VsCodeUtils.isThisYamlDoc();
    let allYamlKeys;

    if (allYamlKeys == undefined) { // this block is here because of the delay in vscode to load the symbols which result in undefined allYamlKeys
      let tries = 1;
      while (true) {
        VsCodeUtils.sleep(5000);
        allYamlKeys = await F2yamlLinkExtractor.getVsCodeDocSymbols(activeDoc);
        tries++;
        if (tries >= 3) {
          throw new Error(Data.MESSAGES.ERRORS.DOCUMENT_SYMBOL_PROVIDER_FAILED);
        } else if (allYamlKeys) { break; }
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
    if (rootPath) { await config.update(Data.CONFIG.WORKSPACE_PATH, rootPath, vscode.ConfigurationTarget.Global); }

    if (!rootPath) {
      rootPath = config.get<string>(Data.CONFIG.WORKSPACE_PATH);
    }

    if (!rootPath) { throw new Error(Data.MESSAGES.ERRORS.NO_ROOT_PATH); }
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
      if (!key.range.contains(cursorPosition)) { continue; }

      const yamlKeys: string[] = [key.name];

      if (key.children && key.children.length > 0) {
        const childKeys = this.extractYamlKeysToCursor(key.children, cursorPosition);
        yamlKeys.push(...childKeys);
      }
      return yamlKeys; // return only the first matching path
    }
    return [];
  }
}