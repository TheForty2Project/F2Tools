import { Data } from "./Data";
import { HackingFixes } from "./HackingFixes";
import { StringOperations } from "./StringOperations";
import { VsCodeUtils } from "./VsCodeUtils";
import { YamlTaskOperations } from "./YamlOperations";
import { F2yamlLinkExtractor } from "./f2yamlLinkExtractor";
import * as vscode from 'vscode';
import * as yaml from 'yaml';
import { QueryDescripton } from './Items/QueryDescripton';
import { F2YamlUtils } from './F2YamlUtils';
import { IdString } from "./Items/IdString";
import { F2Link } from "./Items/F2Link";
import { F2YamlWorkspaceItem, ItemHeader } from "./Items/BasicItems";
import { Folder } from './Items/Folder';
import { Message, OutputChannelLogger } from './Messaging';

export class CSVOperations extends YamlTaskOperations {
  
  static async GenerateReport(queryDescription: QueryDescripton): Promise<string>
  {
    const items = await this.ResolveItemsFromQuery(queryDescription);
    const rows = this.BuildReportRows(queryDescription, items);
    const lines = [
      this.BuildHeaderRow(queryDescription),
      ...rows.map(row => row.join(','))
    ];

    const report = lines.join('\n');
    OutputChannelLogger.logDebug(report);
    return report;
  }

  static BuildHeaderRow(queryDescription: QueryDescripton): string {
    return queryDescription.Select.map(selectItem => {
      const asIndex = selectItem.indexOf(' as ');
      const columnName = asIndex >= 0 ? selectItem.substring(asIndex + 4).trim() : selectItem.trim();
      return this.EscapeCsvCell(columnName);
    }).join(',');
  }

  static BuildReportRows(queryDescription: QueryDescripton, items: F2YamlWorkspaceItem[]): string[][] {
    const rows: string[][] = [];
    const selectMap = queryDescription.SelectFromPropertyIdsToColumNames;

    for (const item of items)
      this.AppendItemRows(selectMap, item, rows);

    return rows;
  }

  private static AppendItemRows(
    selectMap: Map<IdString, string | null>,
    item: F2YamlWorkspaceItem,
    rows: string[][]
  ): void {
    const row: string[] = [];
    for (const propertyId of selectMap.keys())
      row.push(this.EscapeCsvCell(this.GetCellValue(item, propertyId)));
    rows.push(row);

    if (item instanceof Folder) {
      for (const child of item.Items)
        this.AppendItemRows(selectMap, child, rows);
    }
  }

  private static GetCellValue(item: F2YamlWorkspaceItem, propertyId: IdString): string {
    switch (propertyId.Value.toUpperCase()) {
      case 'EMPTY':
        return '';
      case 'SYNCRESULT':
        return 'N';
      case 'IDLINK':
        return item.GetF2Link().toString();
      case 'SUMMARYLINK':
        return item.GetF2Link(1).toString();
      default: {
        const value = item.TryGetPropertyValue(propertyId);
        if (value === undefined || value === null)
          return '';
        if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean')
          return String(value);
        if (value instanceof Date)
          return value.toISOString();
        if (value instanceof F2Link)
          return value.toString();
        if (Array.isArray(value))
          return value.map(entry => String(entry)).join(', ');
        return 'NOTSUPPORTED';
      }
    }
  }

  private static EscapeCsvCell(value: string): string {
    if (value.includes(',') || value.includes('"') || value.includes('\n') || value.includes('\r'))
      return '"' + value.replace(/"/g, '""').replace(/\r?\n/g, '\\n') + '"';
    return value;
  }

  static async ResolveItemsFromQuery(queryDescription: QueryDescripton): Promise<F2YamlWorkspaceItem[]> {
    const result: F2YamlWorkspaceItem[] = [];

    for (const link of queryDescription.From) {
      const items = await this.ResolveItemsFromLink(link);
      result.push(...items);
    }

    return result;
  }

  static async ResolveItemsFromLink(link: F2Link): Promise<F2YamlWorkspaceItem[]> {
    if (link.FilePathParts.length === 0)
      return [];

    const rootPath = VsCodeUtils.getRootPath();
    if (!rootPath)
      return [];

    const workspaceRelativePath = link.FilePathParts.join('\\');
    const targetUri = vscode.Uri.file(require('path').join(rootPath, workspaceRelativePath));

    try {
      const stat = await vscode.workspace.fs.stat(targetUri);
      if ((stat.type & vscode.FileType.Directory) !== 0)
        return await this.ResolveItemsFromFolder(targetUri, workspaceRelativePath);

      if ((stat.type & vscode.FileType.File) !== 0) {
        const item = await this.ResolveItemFromFile(targetUri, workspaceRelativePath);
        return item ? [item] : [];
      }
    }
    catch (err: any) {
      OutputChannelLogger.logWarning(`Unable to resolve link ${link.toString()}: ${String(err?.message ?? err)}`);
    }

    return [];
  }

  private static async ResolveItemsFromFolder(folderUri: vscode.Uri, workspaceRelativePath: string): Promise<F2YamlWorkspaceItem[]> {
    const folder = new Folder();
    folder.YamlRepresentation.WorkspaceRelativePath = workspaceRelativePath;
    folder.YamlRepresentation.RepresentationType = 0;

    const entries = await vscode.workspace.fs.readDirectory(folderUri);
    for (const [name, type] of entries) {
      const childRelativePath = workspaceRelativePath.length > 0 ? `${workspaceRelativePath}\\${name}` : name;
      const childUri = vscode.Uri.joinPath(folderUri, name);

      if ((type & vscode.FileType.Directory) !== 0) {
        const nestedFolders = await this.ResolveItemsFromFolder(childUri, childRelativePath);
        for (const nestedFolder of nestedFolders)
          folder.Items.Add(nestedFolder);
        continue;
      }

      if ((type & vscode.FileType.File) !== 0 && (name.endsWith('.yml') || name.endsWith('.yaml'))) {
        const item = await this.ResolveItemFromFile(childUri, childRelativePath);
        if (item)
          folder.Items.Add(item);
      }
    }

    return [folder];
  }

  private static async ResolveItemFromFile(fileUri: vscode.Uri, workspaceRelativePath: string): Promise<F2YamlWorkspaceItem | undefined> {
    try {
      const fileBytes = await vscode.workspace.fs.readFile(fileUri);
      const content = Buffer.from(fileBytes).toString('utf8');
      const yamlDoc = yaml.parseDocument(content);
      const rootNode = yamlDoc.contents;
      if (!rootNode || !F2YamlWorkspaceItem.IsItemYaml(rootNode)) {
        OutputChannelLogger.logWarning(`Skipping non-item yaml file: ${workspaceRelativePath}`);
        return undefined;
      }

      const item = new F2YamlWorkspaceItem().ImportFromYamlNode(rootNode as yaml.YAMLMap | yaml.Pair<yaml.Scalar, yaml.Node>);
      item.YamlRepresentation.WorkspaceRelativePath = workspaceRelativePath.replace(/\.(yml|yaml)$/i, '');
      item.YamlRepresentation.RepresentationType = 1;
      return item;
    }
    catch (err: any) {
      OutputChannelLogger.logWarning(`Skipping invalid yaml file ${workspaceRelativePath}: ${String(err?.message ?? err)}`);
      return undefined;
    }
  }

  static async ExtractAndVerifyQueryDescriptionUnderCursor(activeDoc: vscode.TextDocument, cursorPosition: vscode.Position): Promise<QueryDescripton> {
    let queryDescription = await CSVOperations.GetQueryDescriptionUnderTheCursor(activeDoc, cursorPosition);
    CSVOperations.VerifyQueryDescription(queryDescription);
    return queryDescription;
  }

  static async GetQueryDescriptionUnderTheCursor(activeDoc: vscode.TextDocument, cursorPosition: vscode.Position): Promise<QueryDescripton> {
  
    let scalarAndMapPairAtCursor = await this.TryGetEnclosingItemScalarMapPairAtCursor(activeDoc, cursorPosition);        
    if (scalarAndMapPairAtCursor === undefined)
      throw new Error(Data.MESSAGES.ERRORS.MUST_BE_ON_QUERYDESCRIPTION);

    let queryDescription = new QueryDescripton().ImportFromYamlScalarMapPair(scalarAndMapPairAtCursor)
    if (queryDescription.TypeId.Value !== Data.SYSTEM_CLASSES.QUERYDESCRIPTION.TYPEID)
      throw new Error(Data.MESSAGES.ERRORS.MUST_BE_ON_QUERYDESCRIPTION);
    return queryDescription;
  }

  static isValidItemHeader(node: yaml.Node): boolean {
    return node instanceof yaml.Scalar
      && typeof node.value === "string"
      && ItemHeader.IsValidItemHeader(node.value);
  }

  static async TryGetEnclosingItemScalarMapPairAtCursor(activeDoc: vscode.TextDocument, cursorPosition: vscode.Position): Promise<yaml.Pair<yaml.Scalar, yaml.YAMLMap> | undefined> {
    const yamlDoc = yaml.parseDocument(activeDoc.getText());
    const cursorOffset = activeDoc.offsetAt(cursorPosition);

    const getNodeRange = (node: yaml.Node | null | undefined): [number, number] | undefined => {
      if (!node?.range) return undefined;
      const end = node.range[2] ?? node.range[1];
      return end === undefined ? undefined : [node.range[0], end];
    };

    const getPairRange = (pair: yaml.Pair<unknown, unknown>): [number, number] | undefined => {
      const keyRange = getNodeRange(pair.key as yaml.Node | undefined);
      const valueRange = getNodeRange(pair.value as yaml.Node | undefined);
      if (!keyRange && !valueRange) return undefined;
      if (!keyRange) return valueRange;
      if (!valueRange) return keyRange;
      return [Math.min(keyRange[0], valueRange[0]), Math.max(keyRange[1], valueRange[1])];
    };

    const findEnclosingPair = (node: yaml.Node | null | undefined): yaml.Pair<yaml.Scalar, yaml.YAMLMap> | undefined => {
      if (node instanceof yaml.YAMLMap) {
        for (const pair of node.items) {
          const pairRange = getPairRange(pair);
          if (!pairRange || cursorOffset < pairRange[0] || cursorOffset > pairRange[1]) {
            continue;
          }

          if (pair.value instanceof yaml.YAMLMap) {
            const nestedMatch = findEnclosingPair(pair.value);
            if (nestedMatch) {
              return nestedMatch;
            }

            if (F2YamlWorkspaceItem.IsItemYaml(pair)) {
              return pair as yaml.Pair<yaml.Scalar, yaml.YAMLMap>;
            }
          }

          if (pair.value instanceof yaml.YAMLSeq) {
            const nestedMatch = findEnclosingPair(pair.value);
            if (nestedMatch) {
              return nestedMatch;
            }
          }
        }
      }

      if (node instanceof yaml.YAMLSeq) {
        for (const item of node.items) {
          const itemRange = getNodeRange(item as yaml.Node | undefined);
          if (!itemRange || cursorOffset < itemRange[0] || cursorOffset > itemRange[1]) {
            continue;
          }

          const nestedMatch = findEnclosingPair(item as yaml.Node | undefined);
          if (nestedMatch) {
            return nestedMatch;
          }
        }
      }

      return undefined;
    };

    return findEnclosingPair(yamlDoc.contents);
  }

  static VerifyQueryDescription(queryDescription: QueryDescripton) {
    var validationResult = queryDescription.IsValid();
    if (!validationResult.isValid)
      throw validationResult.error;
  }

  static async generateCSV(activeDoc: vscode.TextDocument, cursorPosition: vscode.Position) {
    let csvEntry = "";
    const csvColumns = CSVOperations.getCsvFields();
    let f2yamlSummaryLink = await F2yamlLinkExtractor.createF2YamlSummaryLink(activeDoc, cursorPosition);



    for (const csvColumnName of csvColumns) {
      let csvColumnValue: string = "";
      if (csvColumnName === "TaskStatus") {
        csvColumnValue = StringOperations.getStatusCode(activeDoc, cursorPosition);
      }
      else if (csvColumnName === "SummaryLink") {
        let Escapedf2yamlSummaryLink = StringOperations.escapeCharacter(f2yamlSummaryLink, Data.MISC.DOUBLE_QUOTE, Data.MISC.DOUBLE_QUOTE);
        csvColumnValue = StringOperations.wrapInQuotes(Escapedf2yamlSummaryLink);
      }
      else if (csvColumnName === "IdLink") {
        let idLink = await F2yamlLinkExtractor.createF2YamlIdLink(activeDoc, cursorPosition);
        let escapedIdLink = StringOperations.escapeCharacter(idLink, Data.MISC.DOUBLE_QUOTE, Data.MISC.DOUBLE_QUOTE);
        csvColumnValue = StringOperations.wrapInQuotes(escapedIdLink);
      }
      else {
        let items = HackingFixes.getYamlMapFromPairOrYamlMap(await this.getTaskObj(f2yamlSummaryLink)).items;
        for (const taskProperty of items) {
          if (taskProperty.key instanceof yaml.Scalar) {
            if (taskProperty.key.value === csvColumnName) {
              if (taskProperty.value instanceof yaml.Scalar) {
                csvColumnValue = StringOperations.wrapInQuotesIfMultiWord(taskProperty.value.value);
                continue;
              }
              else { throw new Error("The value of the property \"" + csvColumnName + "\" is not a scalar."); }
            }
            else if (taskProperty.key.value === Data.F2YAML_ELEMENTS.ADDITIONAL_PROPERTIES && taskProperty.value instanceof yaml.YAMLMap) {
              let properties = taskProperty.value.items;
              for (const property of properties) {
                if (property.key.value === csvColumnName) {
                  if (property.value instanceof yaml.Scalar) {
                    let yamlScalar: yaml.Scalar = property.value;
                    csvColumnValue = StringOperations.wrapInQuotesIfMultiWord(yamlScalar.value as string);
                  }
                  else if (property.value instanceof yaml.YAMLSeq) {
                    let yamlSequence: yaml.YAMLSeq = property.value as yaml.YAMLSeq;
                    csvColumnValue = StringOperations.wrapInQuotesIfMultiWord(yamlSequence.items.join(", "));
                  }
                  else if (property.value instanceof yaml.YAMLMap) {
                    throw new Error("Maps as values are not supported during CSV generation. Property Id: " + csvColumnName);
                  }
                  else { throw new Error("Unknown type as a value. Property Id:" + csvColumnName); }
                  continue;
                }
              }
            }
          }
        }
      }

      csvEntry += csvColumnValue + ", ";
    }

    csvEntry = csvEntry.slice(0, -2); // for removing the trailing space and comma in the end

    return csvEntry;
  }



  private static getCsvFields() {
    const config = VsCodeUtils.getConfig()
    const csvFields = config.get<string[]>(Data.CONFIG.CSV_FIELDS, []);
    return csvFields;
  }
}
