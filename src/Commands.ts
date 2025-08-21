import { Timer } from "./timer";
import { VsCodeUtils } from "./VsCodeUtils";
import { StringOperation } from "./StringOperations";
import { Message } from './VsCodeUtils';
import * as vscode from 'vscode';
import * as yaml from 'yaml';
import { F2yamlLinkExtractor } from "./f2yamlLinkExtractor";
import { YamlTaskOperations } from "./YamlOperations";
import { LinkFollower } from "./linkFollower";
import { Data } from "./Data";
import { CSVOperations } from "./CSV-Operations";


export class Commands {

    private static srCode?: string;
    private static srDocUri?: vscode.Uri;
    private static srEntry?: yaml.YAMLMap<unknown, unknown>;

    public static async specifyStandupReport(context: vscode.ExtensionContext) {
        try {
            if (Timer.isTaskRunnig()) await this.stopTask(context);
            const srDoc = VsCodeUtils.getActiveDoc();
            const srCode = StringOperation.extractSrCode(srDoc);
            this.srDocUri = srDoc.uri;
            this.srCode = srCode;

            await context.globalState.update("srCode", this.srCode);
            await context.globalState.update("srDocUri", this.srDocUri?.toString());
            Message.info(Data.MESSAGES.INFO.SR_SPECIFIED(srCode));
        } catch (error: any) {
            Message.err(error.message);
        }
    }

    public static async selectTask(context: vscode.ExtensionContext): Promise<void> {
        try {
            const activeDoc = VsCodeUtils.getActiveDoc();
            const cursorPosition = VsCodeUtils.getCursorPosition();
            if (!this.srCode || !this.srDocUri) throw new Error(Data.MESSAGES.ERRORS.RUN_SPECIFY_SR_FIRST);

            if (Timer.isTaskRunnig()) await this.stopTask(context);
            let yamlLink = await StringOperation.getYamlLink(activeDoc, cursorPosition);
            if (!yamlLink) yamlLink = await F2yamlLinkExtractor.createF2YamlSummaryLink(activeDoc, cursorPosition);

            const isthisTask = StringOperation.isThisTask(yamlLink);

            if (!isthisTask) throw new Error(Data.MESSAGES.ERRORS.NOT_A_TASK);

            await Timer.startTimer();
            const startTime = await Timer.giveStartTime();
            const srEntry = YamlTaskOperations.createSrEntry(yamlLink, startTime);

            let srEntryIndex = await YamlTaskOperations.checkIfTaskIsAlreadyInSr(srEntry, this.srCode, this.srDocUri);
            if (srEntryIndex == -1) await YamlTaskOperations.moveEntryToWasInSr(srEntry, this.srCode, this.srDocUri);

            this.srEntry = srEntry;
            await context.globalState.update("srEntry", (this.srEntry as yaml.YAMLMap<unknown, unknown> | undefined)?.toJSON());


            Message.info(Data.MESSAGES.INFO.TASK_SELECTED(yamlLink));
        } catch (error: any) {
            Message.err(error.message);
        }
    }

    public static pauseOrResumeTask() {
        if (!Timer.isTaskRunnig()) {
            Message.err(Data.MESSAGES.ERRORS.NO_ACTIVE_TASK);
            return;
        }
        Timer.pauseResumeTimer();
    }

    public static async stopTask(context: vscode.ExtensionContext) {
        Message.info("this works")
        try {

            this.srCode = context.globalState.get<string>("srCode");

            const uriStr = context.globalState.get<string>("srDocUri");
            this.srDocUri = uriStr ? vscode.Uri.parse(uriStr) : undefined;

            const srEntryObj = context.globalState.get<any>("srEntry");
            if (srEntryObj) {
                const entry = new yaml.YAMLMap();
                Object.entries(srEntryObj).forEach(([k, v]) =>
                    entry.add({ key: k, value: v })
                );
                this.srEntry = entry;
            }
            await Timer.stopTimer(context);

            const durationMinutes = context.globalState.get<number>("durationMinutes");
            if (!this.srDocUri || !this.srEntry || !this.srCode || !durationMinutes || !Timer.isTaskRunnig()) throw new Error(Data.MESSAGES.ERRORS.NO_ACTIVE_TASK);

            await YamlTaskOperations.updateSrEntryDuration(this.srEntry, this.srCode, this.srDocUri, durationMinutes);
            this.srEntry = undefined;

            await context.globalState.update("srCode", this.srCode);
            await context.globalState.update("srDocUri", this.srDocUri?.toString());
            await context.globalState.update("durationMinutes", durationMinutes);
            await context.globalState.update("srEntry", (this.srEntry as yaml.YAMLMap<unknown, unknown> | undefined)?.toJSON());

        } catch (error: any) {
            Message.err(error.message);
        }
    }

    public static async generateWorkLogs(context: vscode.ExtensionContext) {
        const srDoc = VsCodeUtils.getActiveDoc();
        const srCode = StringOperation.extractSrCode(srDoc);
        try {
            if (srCode == this.srCode && Timer.isTaskRunnig()) await this.stopTask(context);
            let workLogGenerated = await YamlTaskOperations.generateWorkLogs(srCode, srDoc.uri);
            if (!workLogGenerated) return
            Message.info(Data.MESSAGES.INFO.WORKLOG_GENERATED);
        } catch (error: any) {
            Message.err(error.message);
        }
    }

    static async generateCSV() {
        try {
            const activeDoc = VsCodeUtils.getActiveDoc();
            const cursorPosition = VsCodeUtils.getCursorPosition();
            const csvEntry = await CSVOperations.generateCSV(activeDoc, cursorPosition);
            Message.info(Data.MESSAGES.INFO.COPIED_TO_CLIPBOARD(csvEntry));
            VsCodeUtils.pasteIntoClipboard(csvEntry);
        } catch (error: any) {
            Message.err(error.message);
        }
    }

    public static async extractF2YamlSummaryLink() {
        try {
            const activeDoc = VsCodeUtils.getActiveDoc();
            const cursorPosition = VsCodeUtils.getCursorPosition();
            let f2YamlSymmaryLink = await StringOperation.getYamlLink(activeDoc, cursorPosition);
            if (!f2YamlSymmaryLink) f2YamlSymmaryLink = await F2yamlLinkExtractor.createF2YamlSummaryLink(activeDoc, cursorPosition);
            Message.info(Data.MESSAGES.INFO.COPIED_TO_CLIPBOARD(f2YamlSymmaryLink));
            VsCodeUtils.pasteIntoClipboard(f2YamlSymmaryLink);
        } catch (error: any) {
            Message.err(error.message);
        }
    }

    static async extractF2YamlIdLink() {
        try {
            const activeDoc = VsCodeUtils.getActiveDoc();
            const cursorPosition = VsCodeUtils.getCursorPosition();
            let f2YamlIdLink = await StringOperation.getYamlLink(activeDoc, cursorPosition);
            if (!f2YamlIdLink) f2YamlIdLink = await F2yamlLinkExtractor.createF2YamlIdLink(activeDoc, cursorPosition);
            Message.info(Data.MESSAGES.INFO.COPIED_TO_CLIPBOARD(f2YamlIdLink));
            VsCodeUtils.pasteIntoClipboard(f2YamlIdLink);
        } catch (error: any) {
            Message.err(error.message);
        }
    }

    public static async followF2yamlLink() {
        try {
            const activeDoc = VsCodeUtils.getActiveDoc();
            const cursorPosition = VsCodeUtils.getCursorPosition();
            let yamlLink = await StringOperation.getYamlLink(activeDoc, cursorPosition);
            if (!yamlLink) throw new Error(Data.MESSAGES.ERRORS.NO_LINK_FOUND);
            if (activeDoc.languageId == "csv") yamlLink = StringOperation.removeExtraQuotes(yamlLink);
            LinkFollower.followF2yamlLink(yamlLink);
        } catch (error: any) {
            Message.err(error.message);
        }
    }
}