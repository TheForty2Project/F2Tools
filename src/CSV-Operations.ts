import { Data } from "./Data";
import { HackingFixes } from "./HackingFixes";
import { StringOperations } from "./StringOperations";
import { VsCodeUtils } from "./VsCodeUtils";
import { YamlTaskOperations } from "./YamlOperations";
import { F2yamlLinkExtractor } from "./f2yamlLinkExtractor";
import * as vscode from 'vscode';
import * as yaml from 'yaml';
import { QueryDescripton, WherePartOfQuery } from './Items/QueryDescripton';
import { IdString } from "./Items/IdString";
import { F2Link } from "./Items/F2Link";
import { EnumerationDefinition, F2YamlWorkspaceItem, F2YamlWorkspaceItemPropertyValue, ItemRepresentationType, LinkTypePreference, NotParsedYaml, StandardItem } from "./Items/BasicItems";
import { ItemHeader } from './Items/ItemHeader';
import { Folder } from './Items/Folder';
import * as path from "path";
import { OutputChannelLogger } from './Messaging';
import { ItemList } from "./Items/ItemList";
import * as fs from "fs";

function removeFrom(text: string, sequence: string): string
{
  const index = text.lastIndexOf(sequence);
  return index === -1 ? text : text.substring(0, index);
}

function replaceExtension(filePath: string, newExtension: string): string
{
  if (!newExtension.startsWith("."))
  {
    newExtension = "." + newExtension;
  }

  return path.join(
    path.dirname(filePath),
    path.basename(filePath, path.extname(filePath)) + newExtension
  );
}

class Duration
{
  public Seconds = 0;
  public Minutes = 0;
  public Hours = 0;
  public Days = 0;
  public Weeks = 0;

  public static TryParse(value: string): Duration | undefined
  {
    const match = /^([+-]?\d+(?:\.\d+)?)([mhsdw])$/.exec(value.trim());
    if (!match)
      return undefined;

    const amount = Number(match[1]);
    if (!Number.isFinite(amount))
      return undefined;

    const duration = new Duration();
    switch (match[2])
    {
      case "s":
        duration.Seconds = amount;
        break;
      case "m":
        duration.Minutes = amount;
        break;
      case "h":
        duration.Hours = amount;
        break;
      case "d":
        duration.Days = amount;
        break;
      case "w":
        duration.Weeks = amount;
        break;
      default:
        return undefined;
    }

    return duration;
  }

  public GetInSeconds(): number
  {
    return this.Seconds
      + this.Minutes * 60
      + this.Hours * 3600
      + this.Days * 86400
      + this.Weeks * 604800;
  }
}

function tryParseNumber(value: string): number | undefined
{
  const trimmed = value.trim();
  if (!/^[+-]?\d+(?:\.\d+)?$/.test(trimmed))
    return undefined;

  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export class CSVOperations extends YamlTaskOperations
{

  static async GenerateReport(queryDescription: QueryDescripton): Promise<string>
  {
    const items = await this.ResolveItemsFromQuery(queryDescription);
    const rows = this.BuildReportRows(queryDescription, items);
    this.SortRows(rows, queryDescription);

    const lines = [
      this.BuildHeaderRow(queryDescription),
      ...rows.map(row => row.map(value => this.EscapeCsvCell(value)).join(','))
    ];

    const report = lines.join('\n');
    return report;
  }

  static BuildHeaderRow(queryDescription: QueryDescripton): string
  {
    return queryDescription.Select.map(selectItem =>
    {
      const asIndex = selectItem.indexOf(' as ');
      const columnName = asIndex >= 0 ? selectItem.substring(asIndex + 4).trim() : selectItem.trim();
      return this.EscapeCsvCell(columnName);
    }).join(',');
  }

  static BuildReportRows(queryDescription: QueryDescripton, items: F2YamlWorkspaceItem[]): string[][]
  {
    const rows: string[][] = [];
    const selectMap = queryDescription.SelectFromPropertyIdsToColumNames;

    for (const item of items)
    {
      this.AppendItemRows(selectMap, item, queryDescription.Where, rows);
    }

    return rows;
  }

  private static SortRows(rows: string[][], queryDescription: QueryDescripton): void
  {
    const orderBy = queryDescription.OrderByPropertyIdsAscending;
    if (rows.length <= 1 || orderBy.size === 0)
      return;

    const columnIndexes = new Map<string, number>();
    let selectIndex = 0;
    for (const propertyId of queryDescription.SelectFromPropertyIdsToColumNames.keys())
    {
      columnIndexes.set(propertyId, selectIndex);
      selectIndex++;
    }

    const descriptors: { index: number; ascending: boolean; type: "number" | "duration" | "string" }[] = [];
    for (const [propertyId, ascending] of orderBy)
    {
      const index = columnIndexes.get(propertyId);
      if (index === undefined)
        continue;

      let isNumberColumn = true;
      let isDurationColumn = true;
      for (let rowIndex = 0; rowIndex < rows.length; rowIndex++)
      {
        const value = rows[rowIndex][index];
        if (value === "")
          continue;
        if (tryParseNumber(value) === undefined)
          isNumberColumn = false;
        if (Duration.TryParse(value) === undefined)
          isDurationColumn = false;
        if (!isNumberColumn && !isDurationColumn)
          break;
      }

      descriptors.push({
        index,
        ascending,
        type: isNumberColumn ? "number" : isDurationColumn ? "duration" : "string"
      });
    }

    if (descriptors.length === 0)
      return;

    const sortableRows = rows.map(row => ({
      row,
      normalized: descriptors.map(descriptor =>
      {
        const value = row[descriptor.index];
        if (descriptor.type === "number")
        {
          if (value === "") return 0;
          return tryParseNumber(value)!;
        }
        if (descriptor.type === "duration")
        {
          if (value === "") return 0;
          return Duration.TryParse(value)!.GetInSeconds();
        }
        return value;
      })
    }));

    sortableRows.sort((leftEntry, rightEntry) =>
    {
      for (let i = 0; i < descriptors.length; i++)
      {
        const descriptor = descriptors[i];
        const leftValue = leftEntry.normalized[i];
        const rightValue = rightEntry.normalized[i];

        let comparison = 0;
        if (typeof leftValue === "number" && typeof rightValue === "number")
        {
          comparison = leftValue - rightValue;
        }
        else
        {
          if (leftValue === "" || rightValue === "")
            OutputChannelLogger.logInfo(`${leftValue} < ${rightValue}: ` + String(leftValue < rightValue ? -1 : leftValue > rightValue ? 1 : 0));
          comparison = leftValue < rightValue ? -1 : leftValue > rightValue ? 1 : 0;
        }

        if (comparison !== 0)
          return descriptor.ascending ? comparison : -comparison;
      }

      return 0;
    });

    for (let i = 0; i < sortableRows.length; i++)
      rows[i] = sortableRows[i].row;
  }

  private static MatchesWhere(item: F2YamlWorkspaceItem, where: WherePartOfQuery): boolean
  {
    const getTypeId = (): string => 
    {
      if (item.TypeId !== undefined && item.TypeId.length > 0)
        return item.TypeId;

      //TODO: update this once we have DefaultTypes and class support - i.e. mostly remove
      for (const enumeration of Object.values(Data.ENUMERATIONS) as EnumerationDefinition[])
      {
        if (item.YamlRepresentation.HeaderPrefixPropertyIds.includes(enumeration.ID))
          return enumeration.TYPEIDS[0];
      }

      OutputChannelLogger.logDebug("Couldn't determine typeid: " + item.GetF2Link().toString());
      return "";
    }

    if (where.SkipFoldersAndFiles)
    {
      if (item.TypeId === Data.SYSTEM_CLASSES.FOLDER.TYPEID || item.YamlRepresentation.RepresentationType !== ItemRepresentationType.Node)
        return false;
    }
    
    if (where.LeavesOnly)
    {
      if (item.Children.Count > 0)
        return false;
      // for (const child of item.Children)
      // {
      //   if (this.MatchesWhere(child, where))
      //     return false;
      // }

      // for (const value of (item as any).PropertyValuesById.values() as Iterable<unknown>)
      // {
      //   if (!(value instanceof ItemList) || value === item.Children)
      //     continue;

      //   for (const childItem of value)
      //   {
      //     if (this.MatchesWhere(childItem, where))
      //       return false;
      //   }
      // }
    }
    
    if (where.ItemTypes.length > 0)
    {
      let typeId = getTypeId();
      if (typeId && typeId.length >= 0 && !where.ItemTypes.includes(typeId))           
        return false;      
    }

    if (where.TaggedBy.length > 0)
    {
      let tags = item.GetStringSequencePropertyValue(Data.SYSTEM_CLASSES.STANDARDITEM.TAGS) ?? [];      
      if (tags.every(tag => where.TaggedBy.every(wh => wh !== tag)))
        return false;
    }

    
    return true;
  }

  private static AppendItemRows(
    selectMap: Map<string, string | null>,
    item: F2YamlWorkspaceItem,
    where: WherePartOfQuery,
    rows: string[][]): void 
  {
    if (this.MatchesWhere(item, where))
    {
      const row: string[] = [];
      for (const propertyId of selectMap.keys())
        row.push(this.GetCellValue(item, propertyId));
      rows.push(row);
    }
    for (const child of item.Children)
      this.AppendItemRows(selectMap, child, where, rows);

    for (const value of (item as any).PropertyValuesById.values() as Iterable<unknown>)
    {
      if (value instanceof F2YamlWorkspaceItem)
        this.AppendItemRows(selectMap, value, where, rows);
      else if (value instanceof ItemList && value !== item.Children)
        for (const childItem of value)
          this.AppendItemRows(selectMap, childItem, where, rows);
    }
  }

  private static GetCellValue(item: F2YamlWorkspaceItem, propertyId: string): string
  {
    switch (propertyId.toUpperCase())
    {
      case 'EMPTY':
        return '';
      case 'SYNCRESULT':
        return 'N';
      case 'IDLINK':
        return item.GetF2Link(LinkTypePreference.Id).toString();
      case 'SUMMARYLINK':
        return item.GetF2Link(LinkTypePreference.Summary).toString();
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
        if (value instanceof F2YamlWorkspaceItem)
          return value.GetStringPropertyValue(Data.SYSTEM_CLASSES.STANDARDITEM.ID) ??
            value.GetStringPropertyValue(Data.SYSTEM_CLASSES.STANDARDITEM.SUMMARY) ??
            item.toString();
        if (value instanceof ItemList)
        {
          let result: string[] = []
          for (const item of value)
            result.push(item.GetStringPropertyValue(Data.SYSTEM_CLASSES.STANDARDITEM.ID) ??
              item.GetStringPropertyValue(Data.SYSTEM_CLASSES.STANDARDITEM.SUMMARY) ??
              item.toString());
          return result.join(", ");
        }
        if (value instanceof NotParsedYaml)
          return yaml.stringify(value.yamlNode, { collectionStyle: 'flow' });
        return String(value);
      }
    }
  }

  private static EscapeCsvCell(value: string): string
  {
    if (value.includes(',') || value.includes('"') || value.includes('\n') || value.includes('\r'))
      return '"' + value.replace(/"/g, '""').replace(/\r?\n/g, '\\n') + '"';
    return value;
  }

  static async ResolveItemsFromQuery(queryDescription: QueryDescripton): Promise<F2YamlWorkspaceItem[]>
  {
    const filesOrFolders: [F2YamlWorkspaceItem, F2Link][] = [];

    for (const link of queryDescription.From)
    {
      const item = await this.LoadFileOrFolderFromLink(link);
      if (item)
      {
        //OutputChannelLogger.logDebug(item.toString());
        filesOrFolders.push([item, link]);
      }
    }

    let result: F2YamlWorkspaceItem[] = [];
    for (const fileOrFolder of filesOrFolders)
    {
      var linkValue: F2YamlWorkspaceItemPropertyValue | undefined
      if (fileOrFolder[1].YamlPathParts.length > 0)
      {
        linkValue = fileOrFolder[0].TryGetValue([...fileOrFolder[1].YamlPathParts]);
        if (linkValue && linkValue instanceof (F2YamlWorkspaceItem))
          result.push(linkValue);
        else
        {
          OutputChannelLogger.logWarning("Can't find Item under link: " + fileOrFolder[1].toString());
        }
      }
      else result.push(fileOrFolder[0]);
    }

    return result;
  }

  public static async LoadFileOrFolderFromLink(link: F2Link): Promise<F2YamlWorkspaceItem | undefined>
  {
    // if (link.FilePathParts.length === 0)
    //   return [];

    const rootPath = VsCodeUtils.tryGetRootPath();
    if (!rootPath)
      throw new Error("There's no Workspace - please open the workspace/folder in VS Code, not just the yaml file.");

    const workspaceRelativePath = link.FilePathParts.join('\\');
    const targetUri = vscode.Uri.file(require('path').join(rootPath, workspaceRelativePath));

    try
    {
      let filePath = targetUri.fsPath;
      if (!fs.existsSync(filePath))
      {
        if (path.extname(filePath) !== "")
          throw new Error("Can't find file: " + filePath);
        filePath = replaceExtension(filePath, "yml");
        if (!fs.existsSync(filePath))
        {
          filePath = replaceExtension(filePath, "yaml");
          if (!fs.existsSync(filePath))
            throw new Error("Can't find file: " + filePath);
        }
      }

      const stat = await vscode.workspace.fs.stat(vscode.Uri.file(filePath));
      if ((stat.type & vscode.FileType.Directory) !== 0)
        return await this.ResolveItemFromFolder(vscode.Uri.file(filePath), rootPath);

      if ((stat.type & vscode.FileType.File) !== 0)
      {
        return await this.ResolveItemFromFile(filePath, rootPath);
      }
    }
    catch (err: any)
    {
      OutputChannelLogger.logWarning(`Unable to resolve link ${link.toString()}: ${String(err?.message ?? err)}`);
    }

    return;
  }

  private static async ResolveItemFromFolder(folderUri: vscode.Uri, rootPath: string): Promise<Folder>
  {
    const folder = new Folder();
    // folder.Id = path.basename(folderUri.fsPath.replace(/\.(yml|yaml)$/i, '')).replace(".", "_"); //TODO: store the filename (+path) in separate properties of the Item        
    folder.YamlRepresentation.WSRelativePath = path.relative(rootPath, folderUri.fsPath);
    folder.YamlRepresentation.RepresentationType = ItemRepresentationType.Folder;
    folder.Id = IdString.GenerateFromString(folder.YamlRepresentation.WSRelativePath).Value;
    folder.Summary = folder.YamlRepresentation.WSRelativePath;

    const fsEntries = await vscode.workspace.fs.readDirectory(folderUri);
    for (const [name, type] of fsEntries)
    {
      const childUri = vscode.Uri.joinPath(folderUri, name);

      if ((type & vscode.FileType.Directory) !== 0)
      {
        const nestedFolder = await this.ResolveItemFromFolder(childUri, rootPath);
        folder.Children.Add(nestedFolder);
        continue;
      }

      if ((type & vscode.FileType.File) !== 0 && (name.endsWith('.yml') || name.endsWith('.yaml')))
      {
        const item = await this.ResolveItemFromFile(childUri.fsPath, rootPath);
        if (item)
          folder.Children.Add(item);
      }
    }

    return folder;
  }

  private static async ResolveItemFromFile(filePath: string, rootPath: string): Promise<F2YamlWorkspaceItem | undefined>
  {
    try
    {
      const fileBytes = await vscode.workspace.fs.readFile(vscode.Uri.file(filePath));
      const content = removeFrom(Buffer.from(fileBytes).toString('utf8'), "<EOF>");
      const yamlDoc = yaml.parseDocument(content);
      const rootNode = yamlDoc.contents;
      if (!rootNode || !F2YamlWorkspaceItem.IsItemYaml(rootNode))
      {
        OutputChannelLogger.logWarning(`Skipping non-item yaml file: ${filePath}`);
        return undefined;
      }

      const item = new StandardItem();
      item.Id = IdString.GenerateFromString(path.basename(filePath).replace(/\.(yml|yaml)$/i, '')).Value;
      item.Summary = filePath;
      item.ImportFromYamlNode(rootNode as yaml.YAMLMap | yaml.Pair<yaml.Scalar, yaml.Node>);
      item.YamlRepresentation.WSRelativePath = path.relative(rootPath, filePath);
      item.YamlRepresentation.RepresentationType = ItemRepresentationType.File;
      return item;
    }
    catch (err: any)
    {
      OutputChannelLogger.logWarning(`Skipping invalid yaml file ${filePath}: ${String(err)}`);
      return undefined;
    }
  }

  static async ExtractAndVerifyQueryDescriptionUnderCursor(activeDoc: vscode.TextDocument, cursorPosition: vscode.Position): Promise<QueryDescripton>
  {
    let queryDescription = await CSVOperations.GetQueryDescriptionUnderTheCursor(activeDoc, cursorPosition);
    CSVOperations.VerifyQueryDescription(queryDescription);
    return queryDescription;
  }

  static async GetQueryDescriptionUnderTheCursor(activeDoc: vscode.TextDocument, cursorPosition: vscode.Position): Promise<QueryDescripton>
  {

    let scalarAndMapPairAtCursor = await this.TryGetEnclosingItemScalarMapPairAtCursor(activeDoc, cursorPosition);
    if (scalarAndMapPairAtCursor === undefined)
      throw new Error(Data.MESSAGES.ERRORS.MUST_BE_ON_QUERYDESCRIPTION);

    let queryDescription = new QueryDescripton().ImportFromYamlScalarMapPair(scalarAndMapPairAtCursor)
    if (queryDescription.TypeId !== Data.SYSTEM_CLASSES.QUERYDESCRIPTION.TYPEID)
      throw new Error(Data.MESSAGES.ERRORS.MUST_BE_ON_QUERYDESCRIPTION);
    return queryDescription;
  }

  static isValidItemHeader(node: yaml.Node): boolean
  {
    return node instanceof yaml.Scalar
      && typeof node.value === "string"
      && ItemHeader.IsValidItemHeader(node.value);
  }

  static async TryGetEnclosingItemScalarMapPairAtCursor(activeDoc: vscode.TextDocument, cursorPosition: vscode.Position): Promise<yaml.Pair<yaml.Scalar, yaml.YAMLMap> | undefined>
  {
    const yamlDoc = yaml.parseDocument(activeDoc.getText());
    const cursorOffset = activeDoc.offsetAt(cursorPosition);

    const getNodeRange = (node: yaml.Node | null | undefined): [number, number] | undefined =>
    {
      if (!node?.range) return undefined;
      const end = node.range[2] ?? node.range[1];
      return end === undefined ? undefined : [node.range[0], end];
    };

    const getPairRange = (pair: yaml.Pair<unknown, unknown>): [number, number] | undefined =>
    {
      const keyRange = getNodeRange(pair.key as yaml.Node | undefined);
      const valueRange = getNodeRange(pair.value as yaml.Node | undefined);
      if (!keyRange && !valueRange) return undefined;
      if (!keyRange) return valueRange;
      if (!valueRange) return keyRange;
      return [Math.min(keyRange[0], valueRange[0]), Math.max(keyRange[1], valueRange[1])];
    };

    const findEnclosingPair = (node: yaml.Node | null | undefined): yaml.Pair<yaml.Scalar, yaml.YAMLMap> | undefined =>
    {
      if (node instanceof yaml.YAMLMap)
      {
        for (const pair of node.items)
        {
          const pairRange = getPairRange(pair);
          if (!pairRange || cursorOffset < pairRange[0] || cursorOffset > pairRange[1])
          {
            continue;
          }

          if (pair.value instanceof yaml.YAMLMap)
          {
            const nestedMatch = findEnclosingPair(pair.value);
            if (nestedMatch)
            {
              return nestedMatch;
            }

            if (F2YamlWorkspaceItem.IsItemYaml(pair))
            {
              return pair as yaml.Pair<yaml.Scalar, yaml.YAMLMap>;
            }
          }

          if (pair.value instanceof yaml.YAMLSeq)
          {
            const nestedMatch = findEnclosingPair(pair.value);
            if (nestedMatch)
            {
              return nestedMatch;
            }
          }
        }
      }

      if (node instanceof yaml.YAMLSeq)
      {
        for (const item of node.items)
        {
          const itemRange = getNodeRange(item as yaml.Node | undefined);
          if (!itemRange || cursorOffset < itemRange[0] || cursorOffset > itemRange[1])
          {
            continue;
          }

          const nestedMatch = findEnclosingPair(item as yaml.Node | undefined);
          if (nestedMatch)
          {
            return nestedMatch;
          }
        }
      }

      return undefined;
    };

    return findEnclosingPair(yamlDoc.contents);
  }

  static VerifyQueryDescription(queryDescription: QueryDescripton)
  {
    var validationResult = queryDescription.IsValid();
    if (!validationResult.isValid)
      throw validationResult.error;
  }

  static async generateCSV(activeDoc: vscode.TextDocument, cursorPosition: vscode.Position)
  {
    let csvEntry = "";
    const csvColumns = CSVOperations.getCsvFields();
    let f2yamlSummaryLink = await F2yamlLinkExtractor.createF2YamlSummaryLink(activeDoc, cursorPosition);



    for (const csvColumnName of csvColumns)
    {
      let csvColumnValue: string = "";
      if (csvColumnName === "TaskStatus")
      {
        csvColumnValue = StringOperations.getStatusCode(activeDoc, cursorPosition);
      }
      else if (csvColumnName === "SummaryLink")
      {
        let Escapedf2yamlSummaryLink = StringOperations.escapeCharacter(f2yamlSummaryLink, Data.MISC.DOUBLE_QUOTE, Data.MISC.DOUBLE_QUOTE);
        csvColumnValue = StringOperations.wrapInQuotes(Escapedf2yamlSummaryLink);
      }
      else if (csvColumnName === "IdLink")
      {
        let idLink = await F2yamlLinkExtractor.createF2YamlIdLink(activeDoc, cursorPosition);
        let escapedIdLink = StringOperations.escapeCharacter(idLink, Data.MISC.DOUBLE_QUOTE, Data.MISC.DOUBLE_QUOTE);
        csvColumnValue = StringOperations.wrapInQuotes(escapedIdLink);
      }
      else
      {
        let items = HackingFixes.getYamlMapFromPairOrYamlMap(await this.getTaskObj(f2yamlSummaryLink)).items;
        for (const taskProperty of items)
        {
          if (taskProperty.key instanceof yaml.Scalar)
          {
            if (taskProperty.key.value === csvColumnName)
            {
              if (taskProperty.value instanceof yaml.Scalar)
              {
                csvColumnValue = StringOperations.wrapInQuotesIfMultiWord(taskProperty.value.value);
                continue;
              }
              else { throw new Error("The value of the property \"" + csvColumnName + "\" is not a scalar."); }
            }
            else if (taskProperty.key.value === Data.F2YAML_ELEMENTS.ADDITIONAL_PROPERTIES && taskProperty.value instanceof yaml.YAMLMap)
            {
              let properties = taskProperty.value.items;
              for (const property of properties)
              {
                if (property.key.value === csvColumnName)
                {
                  if (property.value instanceof yaml.Scalar)
                  {
                    let yamlScalar: yaml.Scalar = property.value;
                    csvColumnValue = StringOperations.wrapInQuotesIfMultiWord(yamlScalar.value as string);
                  }
                  else if (property.value instanceof yaml.YAMLSeq)
                  {
                    let yamlSequence: yaml.YAMLSeq = property.value as yaml.YAMLSeq;
                    csvColumnValue = StringOperations.wrapInQuotesIfMultiWord(yamlSequence.items.join(", "));
                  }
                  else if (property.value instanceof yaml.YAMLMap)
                  {
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



  private static getCsvFields()
  {
    const config = VsCodeUtils.getConfig()
    const csvFields = config.get<string[]>(Data.CONFIG.CSV_FIELDS, []);
    return csvFields;
  }
}
