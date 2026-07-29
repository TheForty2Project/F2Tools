import { OutputChannelLogger } from "../Messaging";
import { F2YamlWorkspaceItem, ItemRepresentationType, StandardItem } from "./BasicItems";
import { F2Link, PropertyIdPart } from "./F2Link";
import { Folder } from "./Folder";
import { IdString } from "./IdString";
import * as vscode from 'vscode';
import * as yaml from 'yaml';
import * as path from "path";
import * as fs from 'fs';

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
  ){}

  private itemCache: F2YamlWorkspaceItem[] = [];

  async tryLoad(link: F2Link): Promise<F2YamlWorkspaceItem | undefined>
  {
    if (link.FilePathParts.length === 0)
      return;

    for (let item of this.itemCache)
    {
      if (item.YamlRepresentation.WSRelativePath === link.FilePathParts[0])
        return item;
    }

    let fileOrFolder = await this.LoadFileOrFolderFromLink(F2Link.CreateFromParts([link.FilePathParts[0]], []));

    if (fileOrFolder)    
    {
      this.itemCache.push(fileOrFolder);
      return fileOrFolder.TryGetValue(link.YamlPathParts) as F2YamlWorkspaceItem | undefined;
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
    const targetUri = vscode.Uri.file(path.join(this._workspaceRoot, workspaceRelativePath));

    try
    {
      let filePath = targetUri.fsPath;
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
        return await this.ResolveItemFromFolder(vscode.Uri.file(filePath), this._workspaceRoot);

      if ((stat.type & vscode.FileType.File) !== 0)
      {
        return await this.ResolveItemFromFile(filePath, this._workspaceRoot);
      }
    }
    catch (err: any)
    {
      OutputChannelLogger.logWarning(`Unable to resolve link ${link.toString()}: ${String(err?.message ?? err)}`);
    }

    return;
  }

  private async ResolveItemFromFolder(folderUri: vscode.Uri, rootPath: string): Promise<Folder>
  {
    const folder = new Folder();
    // folder.Id = path.basename(folderUri.fsPath.replace(/\.(yml|yaml)$/i, '')).replace(".", "_"); //TODO: store the filename (+path) in separate properties of the Item        
    folder.YamlRepresentation.WSRelativePath = path.relative(rootPath, folderUri.fsPath);
    folder.YamlRepresentation.RepresentationType = ItemRepresentationType.Folder;
    folder.Id = IdString.GenerateFromString(folder.YamlRepresentation.WSRelativePath).Value;
    folder.Summary = folder.YamlRepresentation.WSRelativePath;

    const fsEntries = await vscode.workspace.fs.readDirectory(folderUri);
    for (const [name, type] of fsEntries)
    {
      const childUri = vscode.Uri.joinPath(folderUri, name);

      if ((type & vscode.FileType.Directory) !== 0)
      {
        const nestedFolder = await this.ResolveItemFromFolder(childUri, rootPath);
        folder.Children.Add(nestedFolder);
        continue;
      }

      if ((type & vscode.FileType.File) !== 0 && (name.endsWith('.yml') || name.endsWith('.yaml')))
      {
        const item = await this.ResolveItemFromFile(childUri.fsPath, rootPath);
        if (item)
          folder.Children.Add(item);
      }
    }

    return folder;
  }

  private async ResolveItemFromFile(filePath: string, rootPath: string): Promise<F2YamlWorkspaceItem | undefined>
  {
    try
    {
      const fileBytes = await vscode.workspace.fs.readFile(vscode.Uri.file(filePath));
      const content = removeFrom(Buffer.from(fileBytes).toString('utf8'), "<EOF>");
      const yamlDoc = yaml.parseDocument(content);
      const rootNode = yamlDoc.contents;
      if (!rootNode || !F2YamlWorkspaceItem.IsItemYaml(rootNode))
      {
        OutputChannelLogger.logWarning(`Skipping non-item yaml file: ${filePath}`);
        return undefined;
      }

      const item = new StandardItem();
      item.Id = IdString.GenerateFromString(path.basename(filePath).replace(/\.(yml|yaml)$/i, '')).Value;
      item.Summary = filePath;
      item.ImportFromYamlNode(rootNode as yaml.YAMLMap | yaml.Pair<yaml.Scalar, yaml.Node>);
      item.YamlRepresentation.WSRelativePath = path.relative(rootPath, filePath);
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
    return this.repository.tryLoad(f2Link);
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
