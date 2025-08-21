import { Data } from "./Data";
import { StringOperation } from "./StringOperations";
import { VsCodeUtils } from "./VsCodeUtils";
import { YamlTaskOperations } from "./YamlOperations";
import { F2yamlLinkExtractor } from "./f2yamlLinkExtractor";
import * as vscode from 'vscode';


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
            if (taskObj.value.items != null) {
                for (const taskProperty of taskObj.value.items) {
                    if (taskProperty.key.value == field) {
                        const propertyValue = StringOperation.wrapInQuotesIfMultiWord(taskProperty.value.value);
                        csvEntry += propertyValue + ", ";
                        continue;
                    } else if (taskProperty.key.value == "+") {
                        let properties = taskProperty.value.items;
                        for (const property of properties) {
                            if (property.key.value == field) {
                                const propertyValue = StringOperation.wrapInQuotesIfMultiWord(property.value.value);
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