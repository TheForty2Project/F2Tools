import * as yaml from 'yaml';
import * as vscode from 'vscode';
import { Data } from './Data';
import { VsCodeUtils, Message } from './VsCodeUtils';
import { YamlTaskOperations } from './YamlOperations';
import { StringOperation } from './StringOperations';
import { Logger } from './Logger';
import { HackingFixes } from './HackingFixes';


export class F2yamlLinkExtractor {
  protected static extractedSymbols: Array<string> = [];

  public static async createF2YamlSummaryLink(activeDoc: vscode.TextDocument, cursorPosition: vscode.Position) {
    return this.createF2Link(activeDoc, cursorPosition, false);
  }

  static async createF2YamlIdLink(activeDoc: vscode.TextDocument, cursorPosition: vscode.Position) {
    return this.createF2Link(activeDoc, cursorPosition, true);
  }

  private static async createF2Link(activeDoc: vscode.TextDocument, cursorPosition: vscode.Position, idLink: boolean) {
    let filePath = await this.getFilePath(activeDoc);
    let yamlPath = await this.getYamlPath(activeDoc, cursorPosition, idLink);
    return Data.PATTERNS.START_OF_F2YAML_LINK + filePath + "\\" + "." + yamlPath + Data.PATTERNS.END_OF_F2YAML_LINK;
  }

  private static async getFilePath(activeDoc: vscode.TextDocument) {
    let filePath = activeDoc.uri.fsPath;
    filePath = await this.removeRootPath(filePath);
    filePath = StringOperation.removeExtension(filePath);
    return filePath;
  }

  private static async getYamlPath(activeDoc: vscode.TextDocument, cursorPosition: vscode.Position, idLink: boolean) {
    let yamlDocSymbolNames = await this.getYamlDocSymbolNames(activeDoc, cursorPosition);
    let propertyValues = await this.getPropertyValuesFor(yamlDocSymbolNames, idLink, activeDoc);
    let betterDots = this.moveDots(propertyValues);
    let yamlParts: string[] = this.removeStatus(betterDots);
    return yamlParts.join('.');
  }

  private static async getPropertyValuesFor(yamlDocSymbolNames: string[], idLink: boolean, activeDoc: vscode.TextDocument): Promise<string[]> {
    let yamlKeyValues: string[] = [];
    const yamlDoc = await YamlTaskOperations.parseYamlDoc(activeDoc.uri);
    let parentYamlObj = yamlDoc.get(yamlDocSymbolNames[0], true);
    let parentKeyValue = this.getParentValue(parentYamlObj, idLink, yamlDocSymbolNames[0]);
    yamlKeyValues.push(parentKeyValue);

    for (let index = 1; index < yamlDocSymbolNames.length; index++) 
    {
      let docSymbolName = yamlDocSymbolNames[index];
      const yamlObj = await this.getYamlObjFromParentObj(docSymbolName, parentYamlObj);
      let yamlKeyValue = idLink ? this.getValueOfIdProperty(yamlObj) : undefined;

      if (!yamlKeyValue) {
        const yamlKeySummary = StringOperation.wrapInQuotesIfMultiWord(docSymbolName);
        yamlKeyValues.push(yamlKeySummary);
        parentYamlObj = yamlObj;        
      }
      else
      {
        yamlKeyValues.push(yamlKeyValue);
        parentYamlObj = yamlObj;
      }
    }
    // first I need to get the actual yaml-obj from the yamlKeys
    // second I need to get the value of the yamlkeys form the objects and there if the yamlKeyType is not found then give the summary instead of the value of the key
    return yamlKeyValues;
  }

  private static getParentValue(parentYamlObj: any, idLink: boolean, yamlKey: string) :string 
  {
    let parentKeySummary;
    let parentKeyValue = idLink ? this.getValueOfIdProperty(parentYamlObj) : undefined
    if (!parentKeyValue) {
      if (yamlKey.startsWith('.')) {
        parentKeyValue = this.PutInQuotationAfterDot(yamlKey);
        return parentKeyValue
      }
      parentKeySummary = StringOperation.wrapInQuotesIfMultiWord(yamlKey);
      parentKeyValue = parentKeySummary;
    }
    return parentKeyValue;
  }

  private static PutInQuotationAfterDot(yamlKey: string) { // TODO move to stringOperations
    let withoutdot = yamlKey.slice(1);
    let newWord = StringOperation.wrapInQuotesIfMultiWord(withoutdot);
    newWord = '.' + newWord;
    return newWord;
  }


  private static getYamlObjFromParentObj(yamlKey: string, parentYamlObj: any) {
    let yamlObj: any;
    let yamlObjItems = parentYamlObj.items;
    if (!yamlObjItems) yamlObjItems = parentYamlObj.value.items;
    for (const item of yamlObjItems) {
      if (yamlKey === item.key.value) yamlObj = item;
    }
    return yamlObj;
  }

  private static getValueOfIdProperty(yamlObj: any): string | undefined {
    let yamlKeyValue;
    let yamlMap = HackingFixes.getYamlMapOrUndefinedFromPairOrYamlMap(yamlObj);
    if (yamlMap)
      for (const item of yamlMap.items)       
        if (item instanceof yaml.Pair && item.key instanceof yaml.Scalar)
        {
          if (item.key.value === Data.F2YAML_ELEMENTS.PROPERTY_ID && item.value instanceof yaml.Scalar)
          {
            yamlKeyValue = item.value
            break;
          }
          else if (item.key.value === Data.F2YAML_ELEMENTS.ADDITIONAL_PROPERTIES && item.value instanceof yaml.YAMLMap)
          {            
            for (const property of item.value.items)
              if (property instanceof yaml.Pair && property.key instanceof yaml.Scalar && property.key.value === Data.F2YAML_ELEMENTS.PROPERTY_ID && property.value instanceof yaml.Scalar)
              {
                yamlKeyValue = property.value.value;
                break;
              }
          }
        }
    if (yamlKeyValue !== undefined) return "." + yamlKeyValue; // a temp measure
    return undefined;
  }

  private static moveDots(yamlKeyValues: string[]) {
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

  private static removeStatus(yamlKeys: string[]): string[] {
    let cleanYamlKeys: string[] = [];
    for (let yamlKey of yamlKeys) {
      cleanYamlKeys.push(StringOperation.removeFirstWordIfFollowedBySpaceAndDotIfWrappendInQuotes(yamlKey));
    }
    return cleanYamlKeys;
  }

  private static async getYamlDocSymbolNames(activeDoc: vscode.TextDocument, cursorPosition: vscode.Position): Promise<string[]> {
    VsCodeUtils.isThisYamlDoc();

    for (let i = 0; i < 10; i++) {
      let allYamlKeys = await F2yamlLinkExtractor.getVsCodeDocSymbols(activeDoc);
      if (allYamlKeys) { return this.extractYamlKeysToCursor(allYamlKeys, cursorPosition); }

      await VsCodeUtils.sleep(1000);
    }

    throw new Error(Data.MESSAGES.ERRORS.DOCUMENT_SYMBOL_PROVIDER_FAILED);
  }

  private static async getVsCodeDocSymbols(activeDoc: vscode.TextDocument): Promise<Thenable<vscode.DocumentSymbol[]>> {
    return await vscode.commands.executeCommand<vscode.DocumentSymbol[]>(
      'vscode.executeDocumentSymbolProvider',
      activeDoc.uri
    );
  }

  private static async removeRootPath(filePath: string) {
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
    docSymbols: vscode.DocumentSymbol[],
    cursorPosition: vscode.Position
  ): string[] {
    for (const symbol of docSymbols) {
      if (!symbol.range.contains(cursorPosition)) {
        // Logger.info(`- The range of document symbol ${key.name} (${key.range.start.line}:${key.range.start.character} - ${key.range.end.line}:${key.range.end.character}) does not contain cursorposition: ${cursorPosition.line}:${cursorPosition.character})`);
        continue;
      }
      // Logger.info(`+ The range of document symbol ${key.name} (${key.range.start.line}:${key.range.start.character} - ${key.range.end.line}:${key.range.end.character}) does not contain cursorposition: ${cursorPosition.line}:${cursorPosition.character})`);


      const symbolNames: string[] = [symbol.name];

      if (symbol.children && symbol.children.length > 0) {
        const childSymbols = this.extractYamlKeysToCursor(symbol.children, cursorPosition);
        symbolNames.push(...childSymbols);
      }
      return symbolNames; // return only the first matching path
    }
    return [];
  }
}