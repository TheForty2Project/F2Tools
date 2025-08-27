import { Data } from "./Data";
import { StringOperation } from "./StringOperations";
import { VsCodeUtils } from "./VsCodeUtils";
import { YamlTaskOperations } from "./YamlOperations";
import { F2yamlLinkExtractor } from "./f2yamlLinkExtractor";
import * as vscode from 'vscode';
import * as yaml from 'yaml';

export class CSVOperations extends YamlTaskOperations {

    static async generateCSV(activeDoc: vscode.TextDocument, cursorPosition: vscode.Position) {
        let csvEntry = "";
        const csvFields = CSVOperations.getCsvFields();
        let f2yamlSummaryLink = await F2yamlLinkExtractor.createF2YamlSummaryLink(activeDoc, cursorPosition);


        for (const field of csvFields) {
            if (field === "TaskStatus") {
                let statusCode = StringOperation.getStatusCode(activeDoc, cursorPosition);
                csvEntry += statusCode + ", ";
                continue;
            }

            if (field === "SummaryLink") {
                let Escapedf2yamlSummaryLink = StringOperation.escapeCharacter(f2yamlSummaryLink, Data.MISC.DOUBLE_QUOTE, Data.MISC.DOUBLE_QUOTE);
                let linkWrappedInQuotes = StringOperation.wrapInQuotes(Escapedf2yamlSummaryLink);
                csvEntry += linkWrappedInQuotes + ", ";
                continue;
            }

            if (field === "IdLink") {
                let idLink = await F2yamlLinkExtractor.createF2YamlIdLink(activeDoc, cursorPosition);
                let escapedIdLink = StringOperation.escapeCharacter(idLink, Data.MISC.DOUBLE_QUOTE, Data.MISC.DOUBLE_QUOTE);
                let linkWrappedInQuotes = StringOperation.wrapInQuotes(escapedIdLink);
                csvEntry += linkWrappedInQuotes + ", ";
                continue;
            }

            let taskObj = await this.getTaskObj(f2yamlSummaryLink);
            let items;
            if (taskObj.value != null) {
                items = taskObj.value.items
            }else{
                items = taskObj.items
            }
            if (items != null) {
                for (const taskProperty of items) {
                    if (taskProperty.key.value == field) {
                        const propertyValue = StringOperation.wrapInQuotesIfMultiWord(taskProperty.value.value);
                        csvEntry += propertyValue + ", ";
                        continue;
                    } else if (taskProperty.key.value == "+") {
                        let properties = taskProperty.value.items;
                        for (const property of properties) {
                            if (property.key.value === field) {
                                let propertyValue: string = "";
                                if (property.value instanceof yaml.Scalar){
                                    let yamlScalar: yaml.Scalar = property.value;
                                    propertyValue = StringOperation.wrapInQuotesIfMultiWord(yamlScalar.value as string);}
                                else if (property.value instanceof yaml.YAMLSeq){
                                    let yamlSequence:yaml.YAMLSeq = property.value as yaml.YAMLSeq;
                                    propertyValue = StringOperation.wrapInQuotesIfMultiWord(yamlSequence.items.join(", "));
                                }
                                else if (property.value instanceof yaml.YAMLMap){
                                    throw new Error("Maps as values are not supported during CSV generation. Property Id: " + field);
                                }
                                else {throw new Error("Unknown type as a value. Property Id:" + field);}
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