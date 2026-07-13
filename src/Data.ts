import { Folder } from "./Items/Folder";

export class Data
{
  public static readonly ENUMERATIONS = {
    TASK_STATUS: {
      ID: "Status",
      TYPEIDS: ["Task", "Bug"],
      MEMBERS: ["DraftTODO", "TODO", "EstTODO", "InProgress", "Done", "CurrentFocus", "Blocked", "NEXT", "Scheduled", "OnGoing", "OnHold", "Cancelled", "Paused", "Closed"]
    },
    REQUIREMENT_STATUS:
    {
      ID: "ReqStatus",
      TYPEIDS: ["Requirement", "Milestone"],
      MEMBERS: ["New", "Drafting", "Draft", "Reviewed", "ReadyForDev", "InDev", "Implemented", "InQA", "BugFixing", "QAPassed", "Done", "Closed"]
    },   
    ARTICLE_MATURITY:
    {
      ID: "Maturity",
      TYPEIDS: ["Article"],
      MEMBERS: ["0-New", "1-SomeProgress", "2-HighLevel", "3-Detailing", "4-AlmostDone", "5-Done", "6-Reviewed", "7-Mature", "8-Gandalf"]
    },
    BUG_LEVELS: {
      ID: "Severity",
      TYPEIDS: ["Bug"],
      MEMBERS: ["0-Zero", "1-VeryLow", "2-Low", "3-Average", "4-High", "5-VeryHigh", "6-Extreme", "7-OMG"]
    },
    BUG_STATUS: {
      ID: "BugStatus",
      TYPEIDS: ["Bug"],
      MEMBERS: ["New", "Accepted", "Rejected", "Fixing", "Fixed", "Retesting", "RetestFail", "RetestSuccess", "Closed", "OnHold"]
    },
    UC_STATUS:{
      ID: "UCStatus",
      TYPEIDS: ["UseCase"],
      MEMBERS: ["0-New", "1-SomeProgress", "2-HighLevel", "3-Detailing", "4-AlmostDone", "5-Done", "6-Reviewed", "7-Mature", "8-Gandalf"]
    }
  };

  public static readonly SYSTEM_CLASSES = {
    ITEM:
    {
      TYPEID: "Item",
      CREATEDBY: "CreatedBy",
      CREATEDAT: "CreatedAt"
    },
    STANDARDITEM: {
      TYPEID: "StandardItem",
      ID: "Id",
      SUMMARY: "Summary",
      NOTES: "Notes",
      COMMENTS: "Comments",
      TAGS: "Tags",
    },
    FOLDER: {
      TYPEID: "Folder"
    },
    QUERYDESCRIPTION: {
      TYPEID: "QueryDescription",
      FROM: "From",
      SELECT: "Select",
      OUTPUTFILE: "OutputFile",
      ADDSYNCRESULTCOLUMN: "AddSyncResultColumn",
      BEHAVIORWHENDELETINGROWS: "BehaviorWhenDeletingRows",
      WHERE: "Where",
      ORDERBY: "OrderBy"
    },
    REPORTHEADER: {
      TYPEID: "ReportHeader",
      QUERYDESCRIPTIONLINK: "QueryDescriptionLink",
      QUERYDESCRIPTION: "QueryDescription",
      LOG: "Log",
    },
    WHEREPARTOFQUERY: {
      TYPEID: "WherePartOfQuery",
      TAGGEDBY: "TaggedBy",
      ITEMTYPES: "ItemTypes",
      SKIPUNDER: "SkipUnder",
      LEAVESONLY: "LeavesOnly",
      SKIPFOLDERSANDFILES: "SkipFoldersAndFiles",
    },
    ROWDELETINGBEHAVIOR: {
      TYPEID: "RowDeletingBehavior",
      REMOVE: { ID: "Remove" },
      COMMENTOUT: { ID: "CommentOut" },
      DONOTHING: { ID: "DoNothing" },
    }
  };

  public static readonly F2YAML_ELEMENTS = {
    CLASS_START: "<",
    CLASS_END: ">",
    ADDITIONAL_PROPERTIES: "+",
    PROPERTY_ID: "Id",
    PROPERTY_SUMMARY: "Summary",
    PROPERTY_TYPE: "Type"
  };

  public static readonly MESSAGES = {
    ERRORS: {
      MUST_BE_ON_QUERYDESCRIPTION: "The cursor must be on/inside of an explicitly defined QueryDescription Item (having the property \"" + this.F2YAML_ELEMENTS.PROPERTY_TYPE + "\" set to the value \"" + Data.SYSTEM_CLASSES.QUERYDESCRIPTION.TYPEID + "\")",
      NOT_A_PROPER_TASK: "This is not a proper task as it does not have any items inside it",
      FAILED_TO_PARSE_YAML: "Failed to parse YAML",
      NO_ACTIVE_TASK: "There is no active task",
      RUN_SPECIFY_SR_FIRST: "run specify Standup report first",
      NO_SR_CODE: "There is no SR Code under the cursor",
      NO_ACTIVE_TEXT_EDITOR: "No active text editor.",
      NO_WORD_AT_CURSOR: "No word found at cursor position. Place cursor on a YAML key.",
      NO_LINK_FOUND: "No link found containing the cursor.",
      THIS_COMMAND_ONLY_WORKS_WITH_YAML_FILES: "This command only works with YAML files.",
      LINK_ITEM_NOT_FOUND: "Could not find the item where the link is pointing",
      UNABLE_TO_FIND_FILE: (something: any) => `Unable to find the file ${something}`,
      PARSING_ERROR: (error: any) => `YAML parsing error: ${error}`,
      UNABLE_TO_FIND_TASK: (taskName: string) => `Unable to find: ${taskName}`,
      NO_ROOT_PATH: "Please enter the root path in the settings",
      NOT_VALID_LINK: "Not a valid link",
      NOT_A_TASK: "This is not a   task",
      NO_WORKSPACE: "No workspace found",
      DOCUMENT_SYMBOL_PROVIDER_FAILED: "executeDocumentSymbolProvider failed",
      FILE_PATH_DOES_NOT_START_WITH_ROOTPATH: "File path does not start with the rootPath",
    },
    INFO: {
      COPIED_TO_CLIPBOARD: (something: string) => `'${something}' copied to your clipboard`,
      TIMER_RESUMED: "Timer resumed.",
      TIMER_PAUSED: "Timer paused.",
      TIMER_STOPPED: (durationMinutes: number) => `Timer stopped. Duration: ${durationMinutes} minutes`,
      TASK_SELECTED: (f2YamlLink: string) => `The timer has started on Task: ${f2YamlLink}`,
      SR_SPECIFIED: (srCode: string) => `${srCode} is selected as the Standup Report. Please select a Task and issue the Start timer on Task command`,
      WORKLOG_GENERATED: "Worklog Generated",
    }
  };

  public static readonly STATE_KEYS = {
    EXTRACTED_YAML_KEY: "extractedYamlKey",
    CAPTURED_DOCUMENT_URI: "capturedDocumentUri",
    DETECTED_YAML_LINK: "detectedYamlLink"
  };

  public static readonly PATTERNS = {
    LINK: /-->.*</,
    COLON: /:$/,
    REFERENCE: /\$@.*@\$/g,
    BACK_SLASH: /\\/g,
    DOUBLE_BACK_SLASH: /\\\\/g,
    START_OF_F2YAML_LINK: '-->',
    END_OF_F2YAML_LINK: '<',
    FIRST_WORD: /^\S+\s*/
  };

  public static readonly MISC = {
    CSV_COMMENT_PREFIX: "#",
    EMPTY_STRING: "",
    YAML: "yaml",
    EXTENSION_NAME: "F2Tools",
    FILE_DIVIDER: "//",
    DOUBLE_QUOTE: "\"",
    PATH_SEPERATOR: ".",
  };

  public static readonly CONFIG = {
    DEFAULT_INDENT: 2,
    ROOT_PATH: "pathFromRoot",
    CSV_FIELDS: "csvFields",
    WORKSPACE_PATH: "workspacePath",
    LOG_LEVEL: "logLevel",
    LOG_LEVEL_NONE: "None",
    LOG_LEVEL_ERROR: "Error",
    LOG_LEVEL_WARNING: "Warning",
    LOG_LEVEL_INFO: "Info",
    LOG_LEVEL_DEBUG: "Debug"
  };

  public static readonly TIME_KEYS = {
    START_TIME_KEY: 'timerStartTime',
    ACCUMULATED_TIME_KEY: 'timerAccumulatedTime',
    IS_PAUSED_KEY: 'timerIsPaused',
    START_TIME_ISO_KEY: 'timerStartTimeISO',
    PAUSE_RESUME_STATUS_KEY: 'timerPauseResumeStatus',
    DURATION_MINUTES_KEY: 'timerDurationMinutes'
  };


}
