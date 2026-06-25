import { F2YamlWorkspaceItem, StandardItem } from './BasicItems';
import { ItemList } from './ItemList';
import { IdString } from './IdString';

export class Folder extends StandardItem {
  public static readonly TYPE_ID = IdString.ParseFromString('Folder');
  public readonly Items = new ItemList<F2YamlWorkspaceItem>(this, IdString.ParseFromString('Items'));

  constructor() {
    super();
    this.TypeId = Folder.TYPE_ID;
  }
}
