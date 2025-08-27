# f2tools README

## Features

- Generates the was part when you specify a standup report and then select the task with time log

## Commmands

- Specify Standup report 
- Start Task
- Pause/Resume Task
- Stop Task

## Requirements

- F2ToolInterface

## Extension Settings

- The ignore word setting is pulled form the F2ToolInterface

## Known Issues

- Whenever there is special characters like single or double quotes a slash gets added to ecape them

### 0.0.1

Bug Fix : now the filename dosent come before the link

### 1.0.0

Added The feature for addition of workLog 

### 1.0.5

BugFixed: TimeTracking functionality does not support yaml extensions
BugFixed: TimeTracking functionality does not support empty Tasks
BugFixed: Empty standup reports are not supported or ones with a lowercase "was"
BugFixed: Starting the timer on a task which is already present in the SR creates a new entry
BugFixed: Random thigns are happenig when genereate worklog is used on file ending with .yml

### 1.0.6
BugFixed: The Worklog generator is only generating first worlkog and is working very randomly sometimes.

### 1.1.0
added the link and reference generation feature

### 1.2.0
added the feature to followLink

### 1.3.0
Now system can detect if the link pointing towards a task or not

### 1.4.0
The system can autocorrect the taskLink if the user is standing on a wrong place in a task and tries to select a task

### 1.4.10
- removed dependence on f2pInterface
- now single line tasks will not be rejected as a task
- now if the taskDoc's yaml structure is not proper the extension will not crash instead it will show a error
- BugFix: now if the taskURI is incorrect the extension dosent crash
- BugFix: now if the yamlStrucure of the srdoc is not correct during tht task select an error will be shown
- BugFix: now if the yamlStrucure of the srdoc is not correct during the stop task command an error will be shown
- BugFix: now if the yamlStrucure of the taskDoc is not correct during the GenerateWorkLog command an error will be shown
- improved error message when the task is not found
- BugFix: now if the yamlStrucure of the taskDoc is changed and then the generate worklog command is fired then an error will be shown
- BugFix: if there is task that has the same name and more amount of space it wont be mistaken for the actual task

### 1.4.12
- now the follow link in not broken
- now the follow lilnk works for the single line tasks too

### 1.5.0
Feature:
    - Can create a line of CSV from the Task

### 1.6.0
Feature:
    - Can create Idlinks and add it to the csv

### 1.6.3
Bugs:
    - Follow link should work on anyfile which have the link
    - Name of the extenion
    - Name of the publisher
### 1.6.8
Bugs:
    - Unable to find the link when there is a '' in the task summary
    - To Issue the GenerateWorkLogFromSR command SpecifyStandupReport command needs to be issued first
    - If GenerateWorkLogFromSR command is issued multiple times multiple duplicate worklogs get created
    - If there if more than one f2yamlLInk in a line then the follow link function follows the one which comes first
    - After running SpecifyStandupReport command on a new standup ID the SelectTask command at first stops the timer only and after issuing it again it selects the task
    
### 2.0.0
    - removed the reliance on the ignorewords setting.

### 2.0.1
    - The full file path is coming in the link

### 2.0.2
    - removed the rootPath setting
    
### 2.0.4
    - there was a \ coming before the link
    - the id link was not working
    
### 2.0.5
    - BugFix: Command do not match from the commands from requirement

### 2.0.6
    - BugFix: Command do not match from the commands from requirement

### 2.0.7
    - BugFix: Start timer on task" command gives error "This is not a task"
    
### 2.0.14
    - BugFix: Wrongly placed dot in the link
    - BugFix: CSV Line generation not working
    - BugFix: Non-Bug:_ No "Root path" in settings
    - BugFix: Ignore Words in settings
    - BugFix: Misleading error message when Stopping Timer on Task without Starting one
    - BugFix: Non-Bug:_ CSV line generator does not take properties in the "+:" section into account

### 2.0.17
    - BugFix: Double quotes are placed in between the dots in ID links (and maybe Summary links as well)
    - BugFix: Follow Link command does not work, giving the error "Cannot read properties of undefined (reading 'length')"
    - BugFix: Follow Link command does not work (on a link which might not be supported), giving the error "Cannot read properties of undefined (reading 'length')"
    
### 2.0.20
    - BugFix: Generate ID link clears the Root Path, generates wrong link and then the next time it does not work

### 2.0.22
    - BugFix: Cannot read property 'Symbol(Symbol.iterator)' of undefined when following links containing Id (Bobi)

### 2.0.23
    - Various further bugfixes around link following and CSV generation. (Bobi)

### Next
Bugs:
    - closing the vscode should stop the task
    - stating the vscode should start the extenion
Feature:

## For more information

Contact me - Gaurav & Bobi

**Enjoy!**
