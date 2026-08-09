import { OutputChannelLogger, OutputChannelLogLevel } from "../Messaging";
import { F2YamlWorkspaceItem, ItemRepresentationType, StandardItem } from "./BasicItems";
import { F2Link} from "./F2Link";
import { Folder} from "./Folder";
import { IdString } from "./IdString";
import * as vscode from 'vscode';
import * as yaml from 'yaml';
import * as path from "path";
import * as fs from 'fs';
import { Data } from "../Data";

function removeFrom(text: string, sequence: string): string
{
  const index = text.lastIndexOf(sequence);
  return index === -1 ? text : text.substring(0, index);
}

function replaceExtension(filePath: string, newExtension: string): string
{
  if (!newExtension.startsWith("."))
  {
    newExtension = "." + newExtension;
  }

  return path.join(
    path.dirname(filePath),
    path.basename(filePath, path.extname(filePath)) + newExtension
  );
}



export interface ApplicationServices
{
  itemManager: IItemManager;
  itemRepository: IItemRepository;
}

export function createApplicationServices(
  workspaceRoot: string,
): ApplicationServices
{
  const yamlSerializer = new YamlSerializer();

  const itemRepository = new FileItemRepository(
    workspaceRoot,
    yamlSerializer,
  );


  const itemManager = new ItemManager(
    itemRepository,
    yamlSerializer
  );

  return {
    itemManager,
    itemRepository,
  };
}

export interface IItemRepository
{
  tryLoad(link: F2Link): Promise<F2YamlWorkspaceItem | undefined>;
  save(link: F2Link, item: F2YamlWorkspaceItem): Promise<void>;
}

export class FileItemRepository implements IItemRepository
{
  constructor(
    private readonly _workspaceRoot: string,
    private readonly yamlSerializer: IYamlSerializer
  )
  {
    this._fsWatcher = vscode.workspace.createFileSystemWatcher(
      new vscode.RelativePattern(
        _workspaceRoot,
        "**/*.{yml,yaml}",
      )
    );
    this._fsWatcher.onDidChange(this.fileChanged, this)
  }

  private fileChanged(uri: vscode.Uri)
  {
    const findItemWithPathRecursive = (item: F2YamlWorkspaceItem): F2YamlWorkspaceItem | undefined =>
    {
      if (item.YamlRepresentation.WSRelativePath === wsRelativePath)
        return item;
      for (let child of item.Children.Items)
      {
        const foundItem = findItemWithPathRecursive(child);
        if (foundItem)
          return foundItem;
      }
      return undefined;
    }

    let wsRelativePath = path.relative(this._workspaceRoot, uri.fsPath);
    const foundItem = findItemWithPathRecursive(this._workspace!);
    if (foundItem)
    {
      foundItem.YamlRepresentation.NeedsReload = true;
      if (OutputChannelLogger.LogLevel >= OutputChannelLogLevel.Debug)
        OutputChannelLogger.logDebug("File marked to be needing reload: " + foundItem.YamlRepresentation.WSRelativePath);
    }
    else    
      OutputChannelLogger.logWarning("Can't find Item for reload: " + uri.fsPath);    
  }

  //Plan with caching and fix:
  //  - Folder Item: 
  //    - item caching:
  //      - how do we say that its Items need to be reloaded?:
  //        - A flag: NeedsReload
  //        - If the link points to a Folder, before returning, it checks and reloads any files
  //        - we pass all file/folder to the "reloadIfNeeded" function - which reloads.
  //        - this is file based; Item based - to support Item level caching e.g. when Items are stored in the "cloud" - is next iterations somewhere
  //    - how do we find a link target?:
  //      - Ask the Folder to TryGetValue:
  //        - we need to update the TryGetValue function to support filepathparts as well
  //        - based on the storage method: if it's file/folder, then filepathpart
  //    - Item identification in Where:
  //      - IsDescendantOf(item: IF2YamlWorkspaceItem)  

  private _workspace?: F2YamlWorkspaceItem;
  private _fsWatcher: vscode.FileSystemWatcher;

  async tryLoad(link: F2Link): Promise<F2YamlWorkspaceItem | undefined>
  {
    const reloadIfNeeded = async (item: F2YamlWorkspaceItem): Promise<F2YamlWorkspaceItem | undefined> => 
    {
      if (item.YamlRepresentation.RepresentationType === ItemRepresentationType.File)
      {
        if (item.YamlRepresentation.NeedsReload)        
          return this.ResolveItemFromFile(path.join(this._workspaceRoot, item.YamlRepresentation.WSRelativePath), item);        
        else          
          return item;
      }
      else if (item.YamlRepresentation.RepresentationType === ItemRepresentationType.Folder)
      {
        if (item.YamlRepresentation.NeedsReload)
          return this.ResolveItemFromFolder(path.join(this._workspaceRoot, item.YamlRepresentation.WSRelativePath), item)

        for (let i = 0; i < item.Children.Items.length; i++)
        {
          let reloadedItem = reloadIfNeeded(item.Children.Items[i]);
          if (reloadedItem === undefined)
          {
            item.Children.removeAt(i);
            i--;
          }
        }
        return item;
      }
      else return item;
    }
    


    if (link.FilePathParts.length === 0)
      return;

    if (this._workspace === undefined)
    {
      this._workspace = await this.LoadFileOrFolderFromLink(F2Link.Empty);
      if (this._workspace === undefined)
        throw new Error("Can't load workspace: " + this._workspaceRoot);
    }

    let f2LinkToFile = F2Link.CreateFromParts([...link.FilePathParts], []);
    let fileOrFolder: F2YamlWorkspaceItem | undefined = this._workspace.TryGetValue(f2LinkToFile) as F2YamlWorkspaceItem | undefined;

    if (fileOrFolder)    
    {      
      if (await reloadIfNeeded(fileOrFolder) === undefined) //i.e. the file got deleted
        throw new Error("Can't re-load file/folder: " + f2LinkToFile);
      
      return fileOrFolder.TryGetValue(F2Link.CreateFromParts([], [...link.YamlPathParts])) as F2YamlWorkspaceItem | undefined;
    }

    return undefined;
  }

  save(link: F2Link, item: F2YamlWorkspaceItem): Promise<void>
  {
    throw new Error("Method not implemented.");
  }

  async LoadFileOrFolderFromLink(link: F2Link): Promise<F2YamlWorkspaceItem | undefined>
  {
    const workspaceRelativePath = link.FilePathString;
    let filePath = path.join(this._workspaceRoot, workspaceRelativePath);

    try
    {      
      if (!fs.existsSync(filePath))
      {
        if (path.extname(filePath) !== "")
          throw new Error("Can't find file: " + filePath);
        filePath = replaceExtension(filePath, "yml");
        if (!fs.existsSync(filePath))
        {
          filePath = replaceExtension(filePath, "yaml");
          if (!fs.existsSync(filePath))
            throw new Error("Can't find file: " + filePath);
        }
      }

      const stat = await vscode.workspace.fs.stat(vscode.Uri.file(filePath));
      if ((stat.type & vscode.FileType.Directory) !== 0)
        return await this.ResolveItemFromFolder(filePath);

      if ((stat.type & vscode.FileType.File) !== 0)
      {
        return await this.ResolveItemFromFile(filePath);
      }
    }
    catch (err: any)
    {
      OutputChannelLogger.logWarning(`Unable to resolve link ${link.toString()}: ${String(err?.message ?? err)}`);
    }

    return;
  }

  private async ResolveItemFromFolder(folderPath: string, folder: F2YamlWorkspaceItem | undefined = undefined): Promise<F2YamlWorkspaceItem>
  {
    //const filePath = folderUri.fsPath;
    OutputChannelLogger.logDebug("Parsing folder: " + folderPath);
    if (folder === undefined)
      folder = new Folder();
    else folder.Reset()
    const fileNameWoExt = path.parse(folderPath).name;
    folder.SetPropertyValue(Data.SYSTEM_CLASSES.STANDARDITEM.ID, IdString.GenerateFromString(fileNameWoExt).Value);
    folder.SetPropertyValue(Data.SYSTEM_CLASSES.STANDARDITEM.SUMMARY, fileNameWoExt);
    folder.YamlRepresentation.WSRelativePath = path.relative(this._workspaceRoot, folderPath);
    folder.YamlRepresentation.RepresentationType = ItemRepresentationType.Folder;

    const fsEntries = await vscode.workspace.fs.readDirectory(vscode.Uri.file(folderPath));    
    for (const [name, type] of fsEntries)
    {
      const childPath = path.join(folderPath, name);

      if ((type & vscode.FileType.Directory) !== 0)
      {
        const nestedFolder = await this.ResolveItemFromFolder(childPath);
        folder.Children.Add(nestedFolder);
        continue;
      }

      if ((type & vscode.FileType.File) !== 0 && (name.endsWith('.yml') || name.endsWith('.yaml')))
      {
        const item = await this.ResolveItemFromFile(childPath);
        if (item)
          folder.Children.Add(item);
      }
    }

    return folder;
  }

  private async ResolveItemFromFile(filePath: string, item: F2YamlWorkspaceItem | undefined = undefined): Promise<F2YamlWorkspaceItem | undefined>
  {
    try
    {
      OutputChannelLogger.logDebug("Parsing file: " + filePath);
      const fileBytes = await vscode.workspace.fs.readFile(vscode.Uri.file(filePath));
      const content = removeFrom(Buffer.from(fileBytes).toString('utf8'), "<EOF>");
      const yamlDoc = yaml.parseDocument(content);
      const rootNode = yamlDoc.contents;
      if (!rootNode || !F2YamlWorkspaceItem.IsItemYaml(rootNode))
      {
        OutputChannelLogger.logInfo(`Skipping non-item yaml file: ${filePath}`);
        return undefined;
      }
      
      if (item === undefined)
        item = new F2YamlWorkspaceItem();
      else 
        item.Reset();

      await item.ImportFromYamlNode(rootNode as yaml.YAMLMap | yaml.Pair<yaml.Scalar, yaml.Node>);
      const fileNameWoExt = path.parse(filePath).name;
      item.SetPropertyValue(Data.SYSTEM_CLASSES.STANDARDITEM.ID, IdString.GenerateFromString(fileNameWoExt).Value);
      item.SetPropertyValue(Data.SYSTEM_CLASSES.STANDARDITEM.SUMMARY, fileNameWoExt);      
      item.YamlRepresentation.WSRelativePath = path.relative(this._workspaceRoot, filePath);
      item.YamlRepresentation.RepresentationType = ItemRepresentationType.File;
      return item;
    }
    catch (err: any)
    {
      OutputChannelLogger.logWarning(`Skipping invalid yaml file ${filePath}: ${String(err)}`);
      return undefined;
    }
  }

}

export interface IYamlSerializer
{
  parse<T>(content: string): T;
  stringify<T>(value: T): string;
}

export class YamlSerializer implements IYamlSerializer
{
  parse<T>(content: string): T
  {
    throw new Error("Method not implemented.");
  }
  stringify<T>(value: T): string
  {
    throw new Error("Method not implemented.");
  }

}

export interface IItemManager
{
  tryGetItem(f2Link: F2Link): Promise<F2YamlWorkspaceItem | undefined>;

  // updateItem(filePath: string,
  //   modify: (item: F2YamlWorkspaceItem) => void,
  // ): Promise<F2YamlWorkspaceItem>;
}

export class ItemManager implements IItemManager
{
  constructor(
    private readonly repository: IItemRepository,
    private readonly yaml: IYamlSerializer,
  ) { }

  async tryGetItem(f2Link: F2Link): Promise<F2YamlWorkspaceItem | undefined>
  {
    return await this.repository.tryLoad(f2Link);
  }

  // async updateItem(
  //   filePath: string,
  //   modify: (item: F2YamlWorkspaceItem) => void,
  // ): Promise<F2YamlWorkspaceItem>
  // {
  //   const item = await this.repository.tryLoad(F2Link.CreateFromParts([filePath], []));

  //   if (!item)
  //     throw new Error(`Unable to load item for path: ${filePath}`);

  //   modify(item);

  //   await this.repository.save(F2Link.CreateFromParts([filePath], []), item);

  //   return item;
  // }
}
