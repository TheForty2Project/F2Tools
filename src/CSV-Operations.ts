import { Data } from "./Data";
import { HackingFixes } from "./HackingFixes";
import { StringOperations } from "./StringOperations";
import { VsCodeUtils } from "./VsCodeUtils";
import { YamlTaskOperations } from "./YamlOperations";
import { F2yamlLinkExtractor } from "./f2yamlLinkExtractor";
import * as vscode from 'vscode';
import * as yaml from 'yaml';
import { QueryDescripton, ReportHeader, WherePartOfQuery } from './Items/QueryDescripton';
import { IdString } from "./Items/IdString";
import { F2Link } from "./Items/F2Link";
import { EnumerationDefinition, F2YamlWorkspaceItem, F2YamlWorkspaceItemPropertyValue, ItemRepresentationType, LinkTypePreference, NotParsedYaml, StandardItem } from "./Items/BasicItems";
import { ItemHeader, ItemYamlHeaderType } from './Items/ItemHeader';
import { Folder } from './Items/Folder';
import * as path from "path";
import { OutputChannelLogger } from './Messaging';
import { ItemList } from "./Items/ItemList";
import * as fs from "fs";
import { IItemManager } from "./Items/ItemManager";

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

export class Duration
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

export function tryParseNumber(value: string): number | undefined
{
  const trimmed = value.trim();
  if (!/^[+-]?\d+(?:\.\d+)?$/.test(trimmed))
    return undefined;

  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export class CSVOperations extends YamlTaskOperations
{



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
