import * as vscode from 'vscode';
import * as yaml from 'yaml';
import { Message, VsCodeUtils } from './VsCodeUtils';
import { Data } from './Data';
import { StringOperation } from './StringOperations';
import { HackingFixes } from './HackingFixes';

export class YamlTaskOperations {

    public static taskFileUri: vscode.Uri;
    private static taskYamlDoc: yaml.Document<yaml.Node, true>
    static taskYamlLink: string;
    public static lineCounter: any;

    static getYamlKeyValue(yamlObj: any): string {
        let value;
        try {
            value = yamlObj.key.value;
        } catch (error) {
            return '';
        }
        return value
    }

    static async getYamlObj(yamlKeys: string[], fileUri: vscode.Uri): Promise<any> { // TODO replace the strings with constants
        let yamlObj: any;
        const yamlDoc = await this.parseYamlDoc(fileUri);
        this.taskYamlDoc = yamlDoc;
        let parentYamlObj: any = yamlDoc.get(yamlKeys[0], true);

        if (!parentYamlObj) {
            parentYamlObj = YamlTaskOperations.getTopLevelTaskObj(yamlDoc, yamlKeys, yamlObj);
        }
        yamlObj = parentYamlObj; // because we are looking for this

        if (yamlKeys.length > 1) {
            for (let index = 1; index < yamlKeys.length; index++) {
                const yamlKey = yamlKeys[index];
                yamlObj = await this.getYamlSummaryObjFromParent(yamlKey, parentYamlObj);
                if (!yamlObj) yamlObj = await this.getYamlIdObjFromParentObj(yamlKey, parentYamlObj);

                if (!yamlObj) {
                    let editedKey = yamlKey.slice(1);
                    yamlObj = await this.getYamlIdObjFromParentObj(editedKey, parentYamlObj);
                }

                parentYamlObj = yamlObj;
            }
        }

        if (!yamlObj) throw new Error("Unable to find the Item");
        return yamlObj;
    }

    // private static getTopLevelTaskObj(yamlDoc: yaml.Document<yaml.Node, true>, yamlKeys: string[], yamlObj: any) { // TODO fix this
    //     let parentYamlObj;
    //     if (yaml.isMap(yamlDoc.contents)) {
    //         let itemsOfTheContent = yamlDoc.contents.items;
    //         for (let index = 0; index < itemsOfTheContent.length; index++) {
    //             const element = itemsOfTheContent[index];
    //             let taskSummryElementKey = (element.key as yaml.Scalar).value;
    //             let editedTaskSummaryElementKey = StringOperation.removeFirstWordIfFollowedBySpaceAndDot(taskSummryElementKey as string);
    //             if (editedTaskSummaryElementKey == yamlKeys[0] || StringOperation.wrapInQuotes(editedTaskSummaryElementKey) == yamlKeys[0] || StringOperation.removeDot(editedTaskSummaryElementKey) == StringOperation.removeQuoteWrapping(StringOperation.removeDot(yamlKeys[0]))) { // cause for somereason one on them is wrapped in quotes. // TODO Fix this monstrosity
    //                 parentYamlObj = element;
    //                 break;
    //             }
    //             if (!parentYamlObj) {
    //                 let x = (element.value as yaml.YAMLMap).items;
    //                 if (!x) x = (element as unknown as yaml.YAMLMap).items;
    //                 if (!x) continue;
    //                 for (let index = 0; index < x.length; index++) {
    //                     const e = x[index];
    //                     const yamlKey = yamlKeys[0].slice(1);
    //                     if ((e.key as yaml.Scalar).value == "Id" && (e.value as yaml.Scalar).value == yamlKey) {
    //                         return element;
    //                     }
    //                 }
    //             }
    //         }
    //     }
    //     if (!parentYamlObj) throw new Error("Unable to find the parentObj")
    //     return parentYamlObj;
    // }

    private static getTopLevelTaskObj(yamlDoc: yaml.Document<yaml.Node, true>, linkParts: string[], yamlObj: any) { // TODO fix this
        let parentYamlObj;
        if (yaml.isMap(yamlDoc.contents)) {
            let itemsOfTheContent = yamlDoc.contents.items;
            for (let index = 0; index < itemsOfTheContent.length; index++) {
                const element = itemsOfTheContent[index];
                let taskSummryElementKey = (element.key as yaml.Scalar).value;
                let editedTaskSummaryElementKey = StringOperation.removeFirstWordIfFollowedBySpaceAndDot(taskSummryElementKey as string);                
                if (editedTaskSummaryElementKey == linkParts[0] || StringOperation.wrapInQuotes(editedTaskSummaryElementKey) == linkParts[0] || StringOperation.removeDot(editedTaskSummaryElementKey) == StringOperation.removeQuoteWrapping(StringOperation.removeDot(linkParts[0]))) { // cause for somereason one on them is wrapped in quotes. // TODO Fix this monstrosity
                    // parentYamlObj = element;
                    parentYamlObj = yamlDoc.get(taskSummryElementKey, true);
                    break;
                }
                if (!parentYamlObj) {
                    let mapEntries = (element.value as yaml.YAMLMap).items;
                    if (!mapEntries) {
                            mapEntries = (element as unknown as yaml.YAMLMap).items; //not sure what's this case...
                        }
                    if (!mapEntries) {continue;}
                    for (let j = 0; j < mapEntries.length; j++) {
                        const mapEntry = mapEntries[j];
                        const currentLinkPart = linkParts[0].slice(1);        
                        if (mapEntry.key && yaml.isScalar(mapEntry.key) && mapEntry.value && yaml.isScalar(mapEntry.value) && (mapEntry.key as yaml.Scalar).value === "Id" && (mapEntry.value as yaml.Scalar).value === currentLinkPart){
                            return element;
                        }
                    }
                }
            }
        }
        if (!parentYamlObj) throw new Error("Unable to find the parentObj")
        return parentYamlObj;
    }

    static getYamlIdObjFromParentObj(yamlKey: string, parentYamlObj: any): any {
        let idObj;

        let parentObjItems = parentYamlObj.items;
        if (!parentObjItems) parentObjItems = parentYamlObj.value.items;

        for (const parentObjItem of parentObjItems) {
            let childObjItems = parentObjItem.items;
            if (!childObjItems) childObjItems = parentObjItem.value.items;
            if (!childObjItems) continue;
            for (const childObjItem of childObjItems) {
                if (childObjItem.value == yamlKey) {
                    idObj = parentObjItem;
                    return idObj;
                }
            }
        }
        return idObj;
    }

    static getYamlSummaryObjFromParent(yamlKey: string, parentYamlObj: any) { // TODO fix
        let summaryObj: any;
        let cleanYamlKey = StringOperation.removeQuotesWrappingAndDot(yamlKey);
        parentYamlObj = HackingFixes.getYamlMapFromPairOrYamlMap(parentYamlObj);
        let yamlObjItems = parentYamlObj.items;
        for (const item of yamlObjItems) {
            const valueOfKey = item.key.value;
            let { task } = StringOperation.seperateStatusCodeAndTask(valueOfKey); // TODO clean this
            // const valueOfKeyWithoutStatus = a[1] //
            if (cleanYamlKey == task || cleanYamlKey == valueOfKey) { // cause task is undefined sometimes
                // summaryObj = item;
                summaryObj = parentYamlObj.get(valueOfKey, true);
                break;
            }
        }
        return summaryObj;
    }


    public static async parseYamlDoc(docUri: vscode.Uri): Promise<yaml.Document<yaml.Node, true>> { // TODO chage name to parseYamlDoc
        const doc = await vscode.workspace.openTextDocument(docUri);
        const text = doc.getText();
        try {
            const lineCounter = new yaml.LineCounter();
            const yamlDoc: yaml.Document = yaml.parseDocument(text, { lineCounter });
            this.lineCounter = lineCounter;
            if (yamlDoc.errors.length > 0) {
                let error = yamlDoc.errors[0];
                throw new Error(Data.MESSAGES.ERRORS.PARSING_ERROR(error.message))
            }
            return yamlDoc;
        } catch (error: any) {
            throw new Error(Data.MESSAGES.ERRORS.FAILED_TO_PARSE_YAML)
        }
    }

    private static async getSrObj(yamlDoc: yaml.Document, srCode: string) {
        const srNode = yamlDoc.get(srCode);
        if (!srNode || !(srNode instanceof yaml.YAMLMap)) {
            let srNode = this.createSRObj(yamlDoc, srCode);
            return srNode;
        }
        return srNode;
    }

    private static createSRObj(yamlDoc: yaml.Document, srCode: string) {
        const srCodeObj = new yaml.Scalar(srCode);
        yamlDoc.delete(srCode);
        let srNode = this.createSrNode();
        yamlDoc.set(srCodeObj, srNode);
        return srNode;
    }

    private static createSrNode(): yaml.YAMLMap<unknown, unknown> {
        const srMap = new yaml.YAMLMap();
        const wasObj = this.createObjWithEmptySeq("Was");
        const nextObj = this.createObjWithEmptySeq("Next");
        srMap.add(wasObj);
        srMap.add(nextObj);
        return srMap;
    }

    private static createObjWithEmptySeq(key: string) {
        const node = new yaml.YAMLSeq();
        const emptyItem = new yaml.Scalar(null);
        node.items.push(emptyItem);
        const wasObj = new yaml.Pair(
            new yaml.Scalar(key),
            node
        );
        return wasObj;
    }

    private static async getWasObj(yamlDoc: yaml.Document, srCode: string) {
        let srNode = await this.getSrObj(yamlDoc, srCode);
        // if (!srNode) return;
        let wasNode = srNode.get("Was");
        if (!wasNode) wasNode = srNode.get("was");
        if (!wasNode || !(wasNode instanceof yaml.YAMLSeq)) {
            srNode = this.createSRObj(yamlDoc, srCode);
            // if (!srNode) return;
            wasNode = srNode.get("Was");
        }
        return wasNode;
    }

    private static async insertEntryInNode(node: yaml.YAMLSeq, entry: any) {
        const emptyItemIndex = node.items.findIndex(item =>
            item === null ||
            (item instanceof yaml.Scalar && (item.value === '' || item.value === null)) ||
            (item instanceof yaml.YAMLMap && item.items.length === 0) ||
            (item instanceof yaml.YAMLSeq && item.items.length === 0)

        );

        if (emptyItemIndex !== -1) {
            node.items[emptyItemIndex] = entry;
        } else {
            node.add(entry);
        }
    }

    private static async applyEditToDoc(yamlDoc: yaml.Document, doc: vscode.TextDocument) {
        const edit = new vscode.WorkspaceEdit();
        let updatedYaml = yamlDoc.toString({
            defaultStringType: 'PLAIN',
            simpleKeys: true,
            lineWidth: 0 // Prevent wrapping
        });

        const fullRange = new vscode.Range(
            doc.positionAt(0),
            doc.positionAt(doc.getText().length)
        );
        edit.replace(doc.uri, fullRange, updatedYaml);

        await vscode.workspace.applyEdit(edit);
    }

    public static async moveEntryToWasInSr(srEntry: yaml.YAMLMap<unknown, unknown>, srCode: string, srDocUri: vscode.Uri) {
        const yamlDoc = await this.parseYamlDoc(srDocUri);
        // if (!yamlDoc) return;
        const wasNode = await this.getWasObj(yamlDoc, srCode);
        // if (!wasNode) return;

        await this.insertEntryInNode(wasNode, srEntry);
        const doc = await vscode.workspace.openTextDocument(srDocUri)
        this.applyEditToDoc(yamlDoc, doc);
    }

    private static async findSrEntry(srEntry: yaml.YAMLMap<unknown, unknown>, yamlDoc: yaml.Document, srCode: string) {  // TODO
        const wasNode = await this.getWasObj(yamlDoc, srCode);
        for (let i = wasNode.items.length - 1; i >= 0; i--) {
            const item = wasNode.items[i];
            if (item.items?.[0]?.key?.value === srEntry.items[0].key) {
                return i; // Return the index of the last matching item
            }
        }

        return -1;
    }

    private static async updateDuration(srEntryIndex: any, duration: number, yamlDoc: yaml.Document, srCode: string) {
        const wasNode = await this.getWasObj(yamlDoc, srCode);
        const srEntryObj = wasNode.items[srEntryIndex];
        let oldDurationWithM = srEntryObj.items[0].value.items[0].value;
        let oldDuation = oldDurationWithM.replace("m", "");
        oldDuation = Number(oldDuation);
        let timeElapsed = duration;
        const newDuration = oldDuation + timeElapsed;
        srEntryObj.items[0].value.items[0].value = `${newDuration}m`;
        wasNode.items[srEntryIndex] = srEntryObj;
        const updatedWorkLog = srEntryObj.items[0].value;
        return updatedWorkLog
    }

    public static async updateSrEntryDuration(srEntry: yaml.YAMLMap<unknown, unknown>, srCode: string, srDocUri: vscode.Uri, duration: number) {
        const yamlDoc = await this.parseYamlDoc(srDocUri);
        let srEntryIndex = await this.findSrEntry(srEntry, yamlDoc, srCode);
        await this.updateDuration(srEntryIndex, duration, yamlDoc, srCode);
        const doc = await vscode.workspace.openTextDocument(srDocUri);
        this.applyEditToDoc(yamlDoc, doc);
    }

    private static createWorkLog(startTime: string) {
        const workLogSeq = new yaml.YAMLSeq();
        workLogSeq.items = ["0m", "", startTime]
        workLogSeq.flow = true;
        return workLogSeq;
    }

    public static createSrEntry(yamlLink: string, startTime: string) {
        const workLog = YamlTaskOperations.createWorkLog(startTime);
        const srEntryMap = new yaml.YAMLMap();
        srEntryMap.set(yamlLink, workLog);
        return srEntryMap;
    }

    public static async getTaskObj(yamlLink: string) { // TODO 
        let taskObj: any;
        const { filePath, yamlPath } = StringOperation.parseF2yamlLink(yamlLink);
        const fileUri: vscode.Uri = await VsCodeUtils.getFileUri(filePath);
        const yamlKeys: string[] = StringOperation.parseYamlPath(yamlPath);
        return taskObj = await YamlTaskOperations.getYamlObj(yamlKeys, fileUri);
    }

    public static getCleanYamlKeys(yamlLink: string) {
        const cleanF2YamlLink = this.removeLinkSymbolsFromLink(yamlLink);
        const yamlKeys = this.parseF2YamlLink(cleanF2YamlLink);
        const cleanYamlKeys = this.removeEmptyKeys(yamlKeys);
        return cleanYamlKeys;
    }

    private static removeEmptyKeys(yamlKeys: string[]) {
        return yamlKeys.filter(str => str.trim() !== "");
    }

    private static parseF2YamlLink(cleanYamlLink: string) { // TODO remove all of this
        const yamlKeys = cleanYamlLink.split(".");
        let inDoubleQuotes = false;
        let newKeys = [];
        let buff = "";
        for (let index = 0; index < yamlKeys.length; index++) {
            if (yamlKeys[index] == "") {
                yamlKeys[index + 1] = "." + yamlKeys[index + 1];
            }

        }
        for (let index = 0; index < yamlKeys.length; index++) {
            let element = yamlKeys[index];

            if (element.includes("\"")) {
                if (inDoubleQuotes == true) {
                    inDoubleQuotes = false
                    buff += element;
                    newKeys.push(buff);

                } else {
                    inDoubleQuotes = true
                }
            }

            if (inDoubleQuotes == true) {
                buff += element;
            } else {
                if (!element.includes("\"")) {

                    newKeys.push(element);
                }
            }
        }


        for (let index = 0; index < newKeys.length; index++) {
            const element: string = newKeys[index];
            if (element.includes("-->")) {
                newKeys[index] = this.replaceSubLink(element, cleanYamlLink)
            }
        }
        return newKeys;
    }

    static replaceSubLink(element: any, cleanYamlLink: string): any {
        let cleanSubLink = YamlTaskOperations.getSubLink(cleanYamlLink);

        const [firstPart, rest] = element.split("-->");
        const [linkPart, end] = rest.split("<");

        let newLink = firstPart + "-->" + cleanSubLink + "<" + end;

        return newLink;
    }

    private static getSubLink(cleanYamlLink: string) {
        let linkParts = cleanYamlLink.split("-->");
        let linkPartWithEndingChar = linkParts[1];
        linkParts = linkPartWithEndingChar.split("<");
        let cleanSubLink = linkParts[0];
        return cleanSubLink;
    }

    private static removeLinkSymbolsFromLink(yamlLink: string) { // TODO remove this
        const lengthOfFrontLinkSymbols = 3;
        const lengthOfBackLinkSymbols = 1;
        const cleanYamlLink = yamlLink.slice(lengthOfFrontLinkSymbols, -lengthOfBackLinkSymbols);
        return cleanYamlLink;
    }

    private static createWorkLogObj() {

        const workLogObj = new yaml.Pair(
            new yaml.Scalar('WorkLog'),
            new yaml.YAMLSeq()
        );
        const emptyItem = new yaml.Scalar(null);
        (workLogObj.value as yaml.YAMLSeq).items.push(emptyItem);

        return workLogObj;
    }

    private static addNullValueInWorkLog(workLogObj: any) {
        const newSeq = new yaml.YAMLSeq();
        newSeq.items.push(new yaml.Scalar(null));

        workLogObj.value = newSeq;
    }

    private static async getWorkLogObj(taskObj: any) {
        if (!taskObj.value.items) {
            let newMap = new yaml.YAMLMap()
            taskObj.value = newMap;
        }

        let workLogObj = taskObj.value.items.find((item: any) => item.key.value == "WorkLog");
        if (!workLogObj) {
            workLogObj = this.createWorkLogObj();
            taskObj.value.items.push(workLogObj);
        }
        if (!workLogObj.value.items) this.addNullValueInWorkLog(workLogObj);
        return workLogObj.value;
    }

    private static getName() {
        const config = vscode.workspace.getConfiguration(Data.MISC.EXTENSION_NAME);
        const userName = config.get('userName');
        return userName;
    }

    private static async addWorkLogInTask(workLog: any, yamlLink: string) {
        const taskObj = await this.getTaskObj(yamlLink);
        if (!taskObj) return;
        const workLogObj = await this.getWorkLogObj(taskObj);
        if (!workLogObj) return;
        let name = this.getName();
        name = new yaml.Scalar(name);
        workLog.items.unshift(name);

        // let isThisDuplicateWorkLog: boolean;

        let isThisDuplicateWorkLog = YamlTaskOperations.checkDuplicateWorklog(workLogObj, workLog);
        if (isThisDuplicateWorkLog == false) {

            await this.insertEntryInNode(workLogObj, workLog);
            return true;
        }
        return false;
    }

    private static checkDuplicateWorklog(workLogObj: any, workLog: any) {
        for (let index = 0; index < workLogObj.items.length; index++) {
            const element = workLogObj.items[index];
            let taskObjWorkLogDate;
            let taskObjWorkLogName;
            try {
                taskObjWorkLogDate = element.items[3].value
                taskObjWorkLogName = element.items[0].value
            } catch (error: any) {
                return false
            }
            let srObjWorkLogDate = workLog.items[3].value
            let srObjWorkLogName = workLog.items[0].value
            // if (!taskObjWorkLogDate) return false;
            if (taskObjWorkLogDate == srObjWorkLogDate && taskObjWorkLogName == srObjWorkLogName) {
                return true;
            }
        }
        return false;
    }

    public static async checkIfTaskIsAlreadyInSr(srEntry: yaml.YAMLMap<unknown, unknown>, srCode: string, srDocUri: vscode.Uri) {
        const yamlDoc = await this.parseYamlDoc(srDocUri);
        // if (!yamlDoc) return;
        const wasNode = await this.getWasObj(yamlDoc, srCode);
        // if (!wasNode) return;
        let srIndex = await this.findSrEntry(srEntry, yamlDoc, srCode);
        return srIndex;

    }

    public static async generateWorkLogs(srCode: string, srDocUri: vscode.Uri) {
        const yamlDoc = await this.parseYamlDoc(srDocUri);
        // if (!yamlDoc) return;
        const wasNode = await this.getWasObj(yamlDoc, srCode);
        // if (!wasNode) return;
        // let checkDocStructure = await YamlTaskOperations.parseYaml(this.taskFileUri);
        // if (!checkDocStructure) return;
        let workLogAddedToTask;
        for (let index = 0; index < wasNode.items.length; index++) {
            const currentYamlLink = wasNode.items[index].items[0].key.value;
            const workLog = wasNode.items[index].items[0].value;
            workLogAddedToTask = await this.addWorkLogInTask(workLog, currentYamlLink);
            // if (workLogAddedToTask == undefined) return;
            let { filePath } = StringOperation.parseF2yamlLink(currentYamlLink);
            let fileUri = await VsCodeUtils.getFileUri(filePath);
            const taskDoc = await vscode.workspace.openTextDocument(fileUri);
            // const taskYamlDoc = await this.parseYaml(fileUri);
            await this.applyEditToDoc(this.taskYamlDoc, taskDoc);
        }
        return workLogAddedToTask;
    }

    static removeLastKeyOfYamlLink(cleanYamlLink: string) {
        const arrayOfYamlKeys = this.getCleanYamlKeys(cleanYamlLink);
        for (let index = 0; index < arrayOfYamlKeys.length; index++) {
            if (index == arrayOfYamlKeys.length - 1) {
                arrayOfYamlKeys.pop();
            }
        }
        const jointYamlKeys = arrayOfYamlKeys.join(".");
        const newYamlLink = `-->${jointYamlKeys}<`;
        return newYamlLink;
    }


    static removeSeqNumberFromYamlLink(yamlLink: string) {
        const arrayOfYamlKeys = this.getCleanYamlKeys(yamlLink);
        if (!arrayOfYamlKeys) return;
        for (let index = 0; index < arrayOfYamlKeys.length; index++) {
            const element = arrayOfYamlKeys[index];
            const match = element.match(/^\d+$/); // match full numeric parts only
            if (match) {
                // Slice up to the numeric part (excluding it), and join with '.'
                const result = arrayOfYamlKeys.slice(0, index).join(".");
                return `-->${result}<`;
            }
        }
        // If no number is found, return the original string
        return yamlLink;
    }

    static async getYamlKeyValues(yamlKeys: string[], yamlKeyType: string, activeDoc: vscode.TextDocument): Promise<string[]> {
        let yamlKeyValues: string[] = [];
        const yamlDoc = await this.parseYamlDoc(activeDoc.uri);
        let parentYamlObj: any = yamlDoc.get(yamlKeys[0], true);
        let parentKeyValue = YamlTaskOperations.getParentValue(parentYamlObj, yamlKeyType, yamlKeys[0]);
        yamlKeyValues.push(parentKeyValue);

        for (let index = 1; index < yamlKeys.length; index++) {
            const yamlKey = yamlKeys[index];
            const yamlObj = await this.getYamlObjFromParentObj(yamlKey, yamlDoc, parentYamlObj);
            const yamlKeyValue = await this.getYamlKeyValueBasedOnKeyType(yamlObj, yamlKeyType);
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
                parentKeyValue = YamlTaskOperations.TheDotSettelment(yamlKey);
                return parentKeyValue
            }
            parentKeySummary = StringOperation.wrapInQuotesIfMultiWord(yamlKey);
            parentKeyValue = parentKeySummary;
        }
        return parentKeyValue;
    }

    static TheDotSettelment(yamlKey: string) { // TODO move to stringOperations
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
                Message.err(error1.message + error2.message);
            }
        }
        if (yamlKeyType == "Id" && yamlKeyValue != undefined) return "." + yamlKeyValue; // a temp mesue
        return yamlKeyValue;
    }

}