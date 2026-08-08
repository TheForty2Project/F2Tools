import { F2YamlWorkspaceItem } from './BasicItems';

type ParentAwareItem = F2YamlWorkspaceItem & {
  SetParentItemAndProperty(parentItem: F2YamlWorkspaceItem, propertyId?: string, itemList?: ItemList<F2YamlWorkspaceItem>): void;
  RemoveFromItemList(itemList: ItemList<F2YamlWorkspaceItem>): void;
};

export enum ItemListChangeType {
  Add,
  Remove
}

//TODO: make this 
export class ItemList<TItem extends F2YamlWorkspaceItem> implements Iterable<TItem> {
  private readonly items: TItem[] = [];

  constructor(
    public readonly PartOfItem: F2YamlWorkspaceItem,
    public readonly PropertyId?: string
  ) { }

  public get Count(): number {
    return this.items.length;
  }

  public get(index: number): TItem
  {
    return this.items[index];
  }

  public set(index: number, value: TItem)
  {
    this.items[index] = value;
    (this.items[index] as ParentAwareItem).SetParentItemAndProperty(this.PartOfItem, this.PropertyId);
  }

  public removeAt(index: number)
  {
    this.items.splice(index);
    (this.items[index] as ParentAwareItem).RemoveFromItemList(this);
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
