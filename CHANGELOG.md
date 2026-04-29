# Change Log

All notable changes to the F2Tools extension are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project partially adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html):
  - The major version (first number) represent "groundbreaking" changes, not API incomaptibility - as there's no API in this extension
  - The minor version represent additional funcionalities
  - The patch version represent bugfixes

>You can take a closer look on the DeepDive section of The Forty2 Project site: [deepdive.tf2p.org](https://deepdive.tf2p.org), also, send us a message if you're interested in participating in its development. The links ("F2Links"; the path-looking strings in between --> and <) refer to the Items in its "The Abyss" section (inside "Deep Dive" one) in a way that the parts up until the last "\" represent nodes from the tree - well, file system paths originally but we mirror our file system to the site - and the ones separated by "." (dot) represent a yaml path.


## UNRELEASED

### Bugs:

  - .The value of Id field is not taken into account if it's inside the additional properties part

    -->Tasks\Software\F2ToolsExtension\.Bugs.."The value of Id field is not taken into account if it's inside the additional properties part"<

## 2.0.26

### Bugs:

  - During Id link generation the value of the "Summary" field is used instead of the "Id" field

    -->Tasks\Software\F2ToolsExtension\.Bugs.."During Id link generation the value of the "Summary" field is used instead of the "Id" field"<

## 2.0.25

### Bugs:

  - During CSV Generation if the value of a property is not a string, it fails

    -->Tasks\Software\F2ToolsExtension\.Bugs.."During CSV Generation if the value of a property is not a string, it fails"<
  - During CSV Generation extra fields are added

    -->Tasks\Software\F2ToolsExtension\.Bugs.."During CSV Generation extra fields are added"<

## 2.0.1 - 2.0.24

- Lots of bugfixes

## 2.0.0

- First "public" version; up until this point the extension was only used internally