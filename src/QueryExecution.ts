import * as yaml from "yaml";
import { tryParseNumber, Duration, CSVOperations } from "./CSV-Operations";
import { Data } from "./Data";
import { ItemRepresentationType, F2YamlWorkspaceItem, EnumerationDefinition, LinkTypePreference, NotParsedYaml } from "./Items/BasicItems";
import { F2Link } from "./Items/F2Link";
import { ItemHeader, ItemYamlHeaderType } from "./Items/ItemHeader";
import { ItemList } from "./Items/ItemList";
import { IItemManager } from "./Items/ItemManager";
import { QueryDescripton, ReportHeader, WherePartOfQuery } from "./Items/QueryDescripton";
import { OutputChannelLogger } from "./Messaging";
import { StringOperations } from "./StringOperations";
import { YamlTaskOperations } from "./YamlOperations";
import * as vscode from 'vscode';


enum MatchResult
{
  Match,
  SkipItem,
  SkipItemAndDescendants
}


export class QueryExecution
{
  constructor(
    private _itemManager: IItemManager
  ) { }

  public async ExtractAndVerifyQueryDescriptionUnderCursor(activeDoc: vscode.TextDocument, cursorPosition: vscode.Position): Promise<QueryDescripton>
  {
    let queryDescription = await this.GetQueryDescriptionUnderTheCursor(activeDoc, cursorPosition);
    this.VerifyQueryDescription(queryDescription);
    return queryDescription;
  }

  async GetQueryDescriptionUnderTheCursor(activeDoc: vscode.TextDocument, cursorPosition: vscode.Position): Promise<QueryDescripton>
  {

    let scalarAndMapPairAtCursor = await this.TryGetEnclosingItemScalarMapPairAtCursor(activeDoc, cursorPosition);
    if (scalarAndMapPairAtCursor === undefined)
      throw new Error(Data.MESSAGES.ERRORS.MUST_BE_ON_QUERYDESCRIPTION);

    let queryDescription = await new QueryDescripton(this._itemManager).ImportFromYamlScalarMapPair(scalarAndMapPairAtCursor)
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

  async TryGetEnclosingItemScalarMapPairAtCursor(activeDoc: vscode.TextDocument, cursorPosition: vscode.Position): Promise<yaml.Pair<yaml.Scalar, yaml.YAMLMap> | undefined>
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

  private VerifyQueryDescription(queryDescription: QueryDescripton)
  {
    var validationResult = queryDescription.IsValid();
    if (!validationResult.isValid)
      throw validationResult.error;
  }




  public async GenerateReport(queryDescription: QueryDescripton): Promise<string>
  {
    const fromLocations = await this.ResolveFromLocations(queryDescription);
    const rows = this.BuildReportRows(queryDescription, fromLocations);
    this.SortRows(rows, queryDescription);

    const lines = [
      this.BuildColumnHeaderRow(queryDescription),
      ...rows.map(row => row.map(value => this.EscapeCsvCell(value)).join(','))
    ];

    const reportHeader = new ReportHeader();
    reportHeader.QueryDescription = queryDescription;
    reportHeader.QueryDescriptionLink = queryDescription.GetF2Link();
    reportHeader.CreatedAt = new Date(Date.now());
    reportHeader.CreatedBy = YamlTaskOperations.getName();
    reportHeader.Log = ["Created at " + new Date(Date.now()).toISOString() + "; Added / Updated / Deleted: " + rows.length + " / 0 / 0"];
    reportHeader.YamlRepresentation.AdditionalPropertiesPropertyIds = [Data.SYSTEM_CLASSES.ITEM.CREATEDBY, Data.SYSTEM_CLASSES.ITEM.CREATEDAT];
    reportHeader.YamlRepresentation.HeaderType = ItemYamlHeaderType.TypeId;
    reportHeader.YamlRepresentation.PropertyIds = [Data.F2YAML_ELEMENTS.ADDITIONAL_PROPERTIES, Data.SYSTEM_CLASSES.REPORTHEADER.QUERYDESCRIPTIONLINK, Data.SYSTEM_CLASSES.REPORTHEADER.QUERYDESCRIPTION, Data.SYSTEM_CLASSES.REPORTHEADER.LOG];
    reportHeader.YamlRepresentation.RepresentationType = ItemRepresentationType.Node;

    const report = StringOperations.PrefixEachLine(reportHeader.toString(), Data.MISC.CSV_COMMENT_PREFIX) + "\n" + lines.join('\n');
    return report;
  }

  private BuildColumnHeaderRow(queryDescription: QueryDescripton): string
  {
    return queryDescription.Select.map(selectItem =>
    {
      const asIndex = selectItem.indexOf(' as ');
      const columnName = asIndex >= 0 ? selectItem.substring(asIndex + 4).trim() : selectItem.trim();
      return this.EscapeCsvCell(columnName);
    }).join(',');
  }

  private BuildReportRows(queryDescription: QueryDescripton, rootItems: F2YamlWorkspaceItem[]): string[][]
  {
    const rows: string[][] = [];
    const alreadyProcessedItems: Set<F2YamlWorkspaceItem> = new Set<F2YamlWorkspaceItem>();
    const selectMap = queryDescription.SelectFromPropertyIdsToColumNames;

    for (const item of rootItems)
    {
      this.AppendItemRows(selectMap, item, queryDescription.Where, rows, alreadyProcessedItems);
    }

    return rows;
  }

  private SortRows(rows: string[][], queryDescription: QueryDescripton): void
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

    const descriptors: { index: number; ascending: boolean; type: "number" | "duration" | "string"; }[] = [];
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
          comparison = leftValue - rightValue;

        else
          comparison = leftValue < rightValue ? -1 : leftValue > rightValue ? 1 : 0;

        if (comparison !== 0)
          return descriptor.ascending ? comparison : -comparison;
      }

      return 0;
    });

    for (let i = 0; i < sortableRows.length; i++)
      rows[i] = sortableRows[i].row;
  }

  private MatchesWhere(item: F2YamlWorkspaceItem, where: WherePartOfQuery): MatchResult
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

      return Data.SYSTEM_CLASSES.FOLDER.TYPEID;


      OutputChannelLogger.logDebug("Couldn't determine typeid: " + item.GetF2Link().toString());
      return "";
    };

    for (let skipUnderItem of where.SkipUnderItems)
    {
      if (skipUnderItem === item)
        return MatchResult.SkipItemAndDescendants;
    }

    if (where.SkipFoldersAndFiles)
    {
      if (item.TypeId === Data.SYSTEM_CLASSES.FOLDER.TYPEID || item.YamlRepresentation.RepresentationType !== ItemRepresentationType.Node)
        return MatchResult.SkipItem;
    }

    if (where.LeavesOnly)
    {
      if (item.Children.Count > 0)
        return MatchResult.SkipItem;
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
        return MatchResult.SkipItem;
    }

    if (where.TaggedBy.length > 0)
    {
      let tags = item.GetStringSequencePropertyValue(Data.SYSTEM_CLASSES.STANDARDITEM.TAGS) ?? [];
      if (tags.every(tag => where.TaggedBy.every(wh => wh !== tag)))
        return MatchResult.SkipItem;
    }

    return MatchResult.Match;
  }



  private AppendItemRows(
    selectMap: Map<string, string | null>,
    item: F2YamlWorkspaceItem,
    where: WherePartOfQuery,
    rows: string[][],
    alreadyProcessedItems: Set<F2YamlWorkspaceItem>
  ): void
  {
    if (alreadyProcessedItems.has(item))
      return;
    alreadyProcessedItems.add(item);

    const matchResult = this.MatchesWhere(item, where)
    if (matchResult === MatchResult.Match)
    {
      const row: string[] = [];
      for (const propertyId of selectMap.keys())
        row.push(this.GetCellValue(item, propertyId));
      rows.push(row);
    }
    else if (matchResult === MatchResult.SkipItemAndDescendants)
      return;

    for (const child of item.Children.Items)
      this.AppendItemRows(selectMap, child, where, rows, alreadyProcessedItems);

    for (const value of (item as any).PropertyValuesById.values() as Iterable<unknown>)
    {
      if (value instanceof F2YamlWorkspaceItem)
        this.AppendItemRows(selectMap, value, where, rows, alreadyProcessedItems);
      else if (value instanceof ItemList && value !== item.Children)
        for (const childItem of value.Items)
          this.AppendItemRows(selectMap, childItem, where, rows, alreadyProcessedItems);
    }
  }

  private GetCellValue(item: F2YamlWorkspaceItem, propertyId: string): string
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
          let result: string[] = [];
          for (const item of value.Items)
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

  private EscapeCsvCell(value: string): string
  {
    if (value.includes(',') || value.includes('"') || value.includes('\n') || value.includes('\r'))
      return '"' + value.replace(/"/g, '""').replace(/\r?\n/g, '\\n') + '"';
    return value;
  }

  private async ResolveFromLocations(queryDescription: QueryDescripton): Promise<F2YamlWorkspaceItem[]>
  {
    let result: F2YamlWorkspaceItem[] = [];
    for (const link of queryDescription.From)
    {
      const item = await this._itemManager.tryGetItem(link);
      if (item)
        result.push(item);

      else
        OutputChannelLogger.logWarning("Can't find Item under link: " + link.toString());
    }

    return result;
  }
}
