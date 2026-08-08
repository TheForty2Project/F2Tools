import { StandardItem } from './BasicItems';
import { IdString } from './IdString';
import { Data } from '../Data';

export class Folder extends StandardItem {
  constructor() {
    super();
    this.TypeId = Data.SYSTEM_CLASSES.FOLDER.TYPEID;
  }
}
