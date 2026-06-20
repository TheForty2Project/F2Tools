import { F2YamlWorkspaceItem } from './BasicItems';
import { ItemList } from './ItemList';
import { IdString } from './IdString';

export class Folder extends F2YamlWorkspaceItem {
  public static readonly TYPE_ID = IdString.ParseFromString('Folder');
  public readonly Items = new ItemList<F2YamlWorkspaceItem>(this, IdString.ParseFromString('Items'));

  constructor() {
    super();
    this.TypeId = Folder.TYPE_ID;
  }
}
