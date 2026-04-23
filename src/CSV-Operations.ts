import { Data } from "./Data";
import { HackingFixes } from "./HackingFixes";
import { StringOperation } from "./StringOperations";
import { VsCodeUtils } from "./VsCodeUtils";
import { YamlTaskOperations } from "./YamlOperations";
import { F2yamlLinkExtractor } from "./f2yamlLinkExtractor";
import * as vscode from 'vscode';
import * as yaml from 'yaml';

export class CSVOperations extends YamlTaskOperations {

  static async generateCSV(activeDoc: vscode.TextDocument, cursorPosition: vscode.Position) {
    let csvEntry = "";
    const csvColumns = CSVOperations.getCsvFields();
    let f2yamlSummaryLink = await F2yamlLinkExtractor.createF2YamlSummaryLink(activeDoc, cursorPosition);


    for (const csvColumnName of csvColumns) {
      if (csvColumnName === "TaskStatus") {
        let statusCode = StringOperation.getStatusCode(activeDoc, cursorPosition);
        csvEntry += statusCode + ", ";
        continue;
      }

      if (csvColumnName === "SummaryLink") {
        let Escapedf2yamlSummaryLink = StringOperation.escapeCharacter(f2yamlSummaryLink, Data.MISC.DOUBLE_QUOTE, Data.MISC.DOUBLE_QUOTE);
        let linkWrappedInQuotes = StringOperation.wrapInQuotes(Escapedf2yamlSummaryLink);
        csvEntry += linkWrappedInQuotes + ", ";
        continue;
      }

      if (csvColumnName === "IdLink") {
        let idLink = await F2yamlLinkExtractor.createF2YamlIdLink(activeDoc, cursorPosition);
        let escapedIdLink = StringOperation.escapeCharacter(idLink, Data.MISC.DOUBLE_QUOTE, Data.MISC.DOUBLE_QUOTE);
        let linkWrappedInQuotes = StringOperation.wrapInQuotes(escapedIdLink);
        csvEntry += linkWrappedInQuotes + ", ";
        continue;
      }

      let items = HackingFixes.getYamlMapFromPairOrYamlMap(await this.getTaskObj(f2yamlSummaryLink)).items; //at this point we're sure that it exists and its a map as we've just generated the f2yamlSummaryLink
      for (const taskProperty of items) {
        if (taskProperty.key instanceof yaml.Scalar) {
          if (taskProperty.key.value === csvColumnName) {
            if (taskProperty.value instanceof yaml.Scalar) {
              const propertyValue = StringOperation.wrapInQuotesIfMultiWord(taskProperty.value.value);
              csvEntry += propertyValue + ", ";
              continue;
            }
            else { throw new Error("The value of the property \"" + csvColumnName + "\" is not a scalar."); }
          }
          else if (taskProperty.key.value === "+" && taskProperty.value instanceof yaml.YAMLMap) {
            let properties = taskProperty.value.items;
            for (const property of properties) {
              if (property.key.value === csvColumnName) {
                let propertyValue: string = "";
                if (property.value instanceof yaml.Scalar) {
                  let yamlScalar: yaml.Scalar = property.value;
                  propertyValue = StringOperation.wrapInQuotesIfMultiWord(yamlScalar.value as string);
                }
                else if (property.value instanceof yaml.YAMLSeq) {
                  let yamlSequence: yaml.YAMLSeq = property.value as yaml.YAMLSeq;
                  propertyValue = StringOperation.wrapInQuotesIfMultiWord(yamlSequence.items.join(", "));
                }
                else if (property.value instanceof yaml.YAMLMap) {
                  throw new Error("Maps as values are not supported during CSV generation. Property Id: " + csvColumnName);
                }
                else { throw new Error("Unknown type as a value. Property Id:" + csvColumnName); }
                csvEntry += propertyValue + ", ";
                continue;
              }
            }
            break;
          }
        }
      }
      csvEntry += ", ";
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