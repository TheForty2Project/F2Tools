import { F2YamlWorkspaceItem } from './BasicItems';
import { IdString } from './IdString';

type ParentAwareItem = F2YamlWorkspaceItem & {
  SetParentItemAndProperty(parentItem: F2YamlWorkspaceItem, propertyId: IdString, itemList?: ItemList<F2YamlWorkspaceItem>): void;
  RemoveFromItemList(itemList: ItemList<F2YamlWorkspaceItem>): void;
};

export enum ItemListChangeType {
  Add,
  Remove
}

export class ItemList<TItem extends F2YamlWorkspaceItem> implements Iterable<TItem> {
  private readonly items: TItem[] = [];

  constructor(
    public readonly PartOfItem: F2YamlWorkspaceItem,
    public readonly PropertyId: IdString
  ) { }

  public get Count(): number {
    return this.items.length;
  }

  public Add(item: TItem): void {
    this.items.push(item);
    (item as ParentAwareItem).SetParentItemAndProperty(this.PartOfItem, this.PropertyId, this);
  }

  public AddRange(items: Iterable<TItem>): void {
    for (const item of items)
      this.Add(item);
  }

  public Remove(item: TItem): boolean {
    const index = this.items.indexOf(item);
    if (index < 0)
      return false;

    this.items.splice(index, 1);
    (item as ParentAwareItem).RemoveFromItemList(this);
    return true;
  }

  public RemoveAll(item: TItem): void {
    while (this.Remove(item)) {
      // remove all duplicates if present
    }
  }

  public Clear(): void {
    for (const item of [...this.items])
      this.Remove(item);
  }

  public ResetTo(items: Iterable<TItem>): void {
    this.Clear();
    this.AddRange(items);
  }

  public [Symbol.iterator](): Iterator<TItem> {
    return this.items[Symbol.iterator]();
  }
}
