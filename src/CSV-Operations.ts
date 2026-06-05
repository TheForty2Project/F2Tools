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
import { ItemHeader } from "./Items/BasicItems";

export class CSVOperations extends YamlTaskOperations {

  static async ExtractAndVerifyQueryDescriptionUnderCursor(activeDoc: vscode.TextDocument, cursorPosition: vscode.Position): Promise<QueryDescripton> {
    let queryDescription = await CSVOperations.GetQueryDescriptionUnderTheCursor(activeDoc, cursorPosition);
    CSVOperations.VerifyQueryDescription(queryDescription);
    return queryDescription;
  }

  static async GetQueryDescriptionUnderTheCursor(activeDoc: vscode.TextDocument, cursorPosition: vscode.Position): Promise<QueryDescripton> {
  
    let scalarAndMapPairAtCursor = await this.TryGetEnclosingItemScalarMapPairAtCursor(activeDoc, cursorPosition);    
    if (scalarAndMapPairAtCursor === undefined
      || ((F2YamlUtils.TryGetPropertyValueFromYamlMap(scalarAndMapPairAtCursor.value!, Data.F2YAML_ELEMENTS.PROPERTY_TYPE) !== Data.SYSTEM_CLASSES.QUERYDESCRIPTION.TYPEID)
      && ItemHeader.ParseFromYamlScalar(scalarAndMapPairAtCursor.key).TypeId?.Value !== Data.SYSTEM_CLASSES.QUERYDESCRIPTION.TYPEID)
    )
      throw new Error(Data.MESSAGES.ERRORS.MUST_BE_ON_QUERYDESCRIPTION);

    return new QueryDescripton().ImportFromYamlScalarMapPair(scalarAndMapPairAtCursor);
  }

  static isValidItemHeader(node: yaml.Node): boolean {
    //pattern is (bnf): <IdString>* "." <charsExceptColon>+
    if (node instanceof yaml.Scalar && typeof node.value === "string") {

      let words: string[] = node.value.split(" ");
      for (const word of words)
      {        
        if (word.startsWith("."))
          return true;
        if (!IdString.IsValidIdString(word))
          return false;
      }
    }
    return false;
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

            if (pair.key instanceof yaml.Scalar && this.isValidItemHeader(pair.key)) {
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
