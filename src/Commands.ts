import { Timer } from "./timer";
import { VsCodeUtils } from "./VsCodeUtils";
import { OutputChannelLogger } from './Messaging';
import { StringOperations } from "./StringOperations";
import { Message } from './Messaging';
import * as vscode from 'vscode';
import * as yaml from 'yaml';
import { F2yamlLinkExtractor } from "./f2yamlLinkExtractor";
import { YamlTaskOperations } from "./YamlOperations";
import { LinkFollower } from "./linkFollower";
import { Data } from "./Data";
import { CSVOperations } from "./CSV-Operations";
import { ItemParsingError } from "./Items/BasicItems";
import { ItemParsingErrorType } from "./Items/BasicItems";
import path from "path";


export class Commands {    
    public static async executeQuery() {
      const activeDoc = VsCodeUtils.getActiveDoc();
      const cursorPosition = VsCodeUtils.getCursorPosition();

      try
      {
        let queryDescription = await CSVOperations.ExtractAndVerifyQueryDescriptionUnderCursor(activeDoc, cursorPosition);
        OutputChannelLogger.logDebug("Extracted QueryDescription:\n" + queryDescription?.toString());
        let generatedCSV = await CSVOperations.GenerateReport(queryDescription);                

        let outputFilePath = queryDescription.OutputFile.trim();
        if (outputFilePath.length > 0) {
          if (!path.isAbsolute(outputFilePath)) {
            outputFilePath = path.join(VsCodeUtils.getRootPath() ?? path.dirname(activeDoc.uri.fsPath), outputFilePath);
          }
        } else {
          const sourceDir = path.dirname(activeDoc.uri.fsPath);
          const sourceFileName = path.parse(activeDoc.uri.fsPath).name;
          outputFilePath = path.join(sourceDir, `${sourceFileName}.csv`);

          let suffix = 1;
          while (true) {
            try {
              await vscode.workspace.fs.stat(vscode.Uri.file(outputFilePath));
              outputFilePath = path.join(sourceDir, `${sourceFileName}(${suffix}).csv`);
              suffix++;
            } catch {
              break;
            }
          }
        }

        await vscode.workspace.fs.writeFile(
          vscode.Uri.file(outputFilePath),
          Buffer.from(generatedCSV, 'utf8')
        );

        Message.info("Csv generated into: " + outputFilePath);
      }
      catch (err: any)
      {
        Message.err(err.message);
      }

    }
    public static async writeBackFromReport() {
      throw new Error('Method not implemented.');
    }

    private static srCode?: string;
    private static srDocUri?: vscode.Uri;
    private static srEntry?: yaml.YAMLMap<unknown, unknown>;

    public static async specifyStandupReport() {
        try {
            if (Timer.isTaskRunnig()) await this.stopTask();
            const srDoc = VsCodeUtils.getActiveDoc();
            const srCode = StringOperations.extractSrCode(srDoc);
            this.srDocUri = srDoc.uri;
            this.srCode = srCode;

            Message.info(Data.MESSAGES.INFO.SR_SPECIFIED(srCode));
        } catch (error: any) {
            Message.err(error.message);
        }
    }

    public static async selectTask(): Promise<void> {
        try {
            const activeDoc = VsCodeUtils.getActiveDoc();
            const cursorPosition = VsCodeUtils.getCursorPosition();
            if (!this.srCode || !this.srDocUri) throw new Error(Data.MESSAGES.ERRORS.RUN_SPECIFY_SR_FIRST);

            if (Timer.isTaskRunnig()) await this.stopTask();
            let yamlLink = await StringOperations.getYamlLink(activeDoc, cursorPosition);
            if (!yamlLink) yamlLink = await F2yamlLinkExtractor.createF2YamlSummaryLink(activeDoc, cursorPosition);

            const isthisTask = StringOperations.isThisTask(yamlLink);

            if (!isthisTask) throw new Error(Data.MESSAGES.ERRORS.NOT_A_TASK);

            await Timer.startTimer();
            const startTime = await Timer.giveStartTime();
            const srEntry = YamlTaskOperations.createSrEntry(yamlLink, startTime);

            let srEntryIndex = await YamlTaskOperations.checkIfTaskIsAlreadyInSr(srEntry, this.srCode, this.srDocUri);
            if (srEntryIndex === -1) await YamlTaskOperations.moveEntryToWasInSr(srEntry, this.srCode, this.srDocUri);

            this.srEntry = srEntry;

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

    public static async stopTask() {
        try {
            if (!this.srDocUri || !this.srEntry || !this.srCode || !Timer.isTaskRunnig()) throw new Error(Data.MESSAGES.ERRORS.NO_ACTIVE_TASK);
            const duration = Timer.stopTimer();
            await YamlTaskOperations.updateSrEntryDuration(this.srEntry, this.srCode, this.srDocUri, duration);
            this.srEntry = undefined;
        } catch (error: any) {
            Message.err(error.message);
        }
    }

    public static async generateWorkLogs() {
        const srDoc = VsCodeUtils.getActiveDoc();
        const srCode = StringOperations.extractSrCode(srDoc);
        try {
            if (srCode === this.srCode && Timer.isTaskRunnig()) await this.stopTask();
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
            let f2YamlSymmaryLink = await StringOperations.getYamlLink(activeDoc, cursorPosition);
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
            let f2YamlIdLink = await StringOperations.getYamlLink(activeDoc, cursorPosition);
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
            let yamlLink = await StringOperations.getYamlLink(activeDoc, cursorPosition);
            if(!yamlLink) throw new Error(Data.MESSAGES.ERRORS.NO_LINK_FOUND);
            if (activeDoc.languageId === "csv") yamlLink = StringOperations.removeExtraQuotes(yamlLink);
            LinkFollower.followF2yamlLink(yamlLink);
        } catch (error: any) {
            Message.err(error.message);
        }
    }
}
