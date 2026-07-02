import { StandardItem } from './BasicItems';
import { IdString } from './IdString';
import { Data } from '../Data';

export class Folder extends StandardItem {
  public static readonly TYPE_ID = IdString.ParseFromString('Folder');
  //public readonly Items = new ItemList<F2YamlWorkspaceItem>(this, IdString.ParseFromString('Items'));

  constructor() {
    super();
    this.TypeId = Data.SYSTEM_CLASSES.FOLDER.TYPEID;
  }
}
