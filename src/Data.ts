export class Data {
    public static readonly MESSAGES = {
        ERRORS: {
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
    }

    public static readonly STATE_KEYS = {
        EXTRACTED_YAML_KEY: "extractedYamlKey",
        CAPTURED_DOCUMENT_URI: "capturedDocumentUri",
        DETECTED_YAML_LINK: "detectedYamlLink"
    }

    public static readonly PATTERNS = {
        LINK: /-->.*</,
        COLON: /:$/,
        REFERENCE: /\$@.*@\$/g,
        BACK_SLASH: /\\/g,
        DOUBLE_BACK_SLASH: /\\\\/g,
        START_OF_F2YAML_LINK: '-->',
        END_OF_F2YAML_LINK: '<',
        FIRST_WORD: /^\S+\s*/
    }

    public static readonly MISC = {
        EMPTY_STRING: "",
        YAML: "yaml",
        EXTENSION_NAME: "f2tools",
        FILE_DIVIDER: "//",
        DOUBLE_QUOTE: "\"",
        PATH_SEPERATOR: ".",
    }
    public static readonly CONFIG = {
        ROOT_PATH: "pathFromRoot",
        CSV_FIELDS: "csvFields",
        WORKSPACE_PATH: "workspacePath",
    }

    public static readonly TIME_KEYS = {
        START_TIME_KEY: 'timerStartTime',
        ACCUMULATED_TIME_KEY: 'timerAccumulatedTime',
        IS_PAUSED_KEY: 'timerIsPaused',
        START_TIME_ISO_KEY: 'timerStartTimeISO',
        PAUSE_RESUME_STATUS_KEY: 'timerPauseResumeStatus',
        DURATION_MINUTES_KEY: 'timerDurationMinutes'
    }
}
