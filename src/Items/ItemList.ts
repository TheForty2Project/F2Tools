import { F2YamlWorkspaceItem, ItemOrF2Link } from './BasicItems';

// type ParentAwareItem = F2YamlWorkspaceItem & {
//   SetParentItemAndProperty(parentItem: F2YamlWorkspaceItem, propertyId?: string, itemList?: ItemList): void;
//   RemoveFromItemList(itemList: ItemList): void;
// };

export enum ItemListChangeType {
  Add,
  Remove
}

//TODO: make this 
export class ItemList implements Iterable<ItemOrF2Link> {
  private readonly items: ItemOrF2Link[] = [];

  constructor(
    public readonly PartOfItem: F2YamlWorkspaceItem,
    public readonly PropertyId?: string
  ) { }

  public get Count(): number {
    return this.items.length;
  }

  public get(index: number): ItemOrF2Link
  {
    return this.items[index];
  }

  public set(index: number, itemOrF2Link: ItemOrF2Link)
  {
    this.items[index] = itemOrF2Link;
    if (itemOrF2Link instanceof F2YamlWorkspaceItem)
      itemOrF2Link.SetParentItemAndProperty(this.PartOfItem, this.PropertyId);
  }

  public removeAt(index: number)
  {    
    const removedElement = this.items.splice(index);
    if (removedElement instanceof F2YamlWorkspaceItem)
      removedElement.SetParentItemAndProperty(this.PartOfItem, this.PropertyId);
  }

  public Add(itemOrF2Link: ItemOrF2Link): void {
    this.items.push(itemOrF2Link);
    if (itemOrF2Link instanceof F2YamlWorkspaceItem)
      itemOrF2Link.SetParentItemAndProperty(this.PartOfItem, this.PropertyId);
  }

  public AddRange(items: Iterable<ItemOrF2Link>): void {
    for (const item of items)
      this.Add(item);
  }

  public Remove(item: ItemOrF2Link): boolean {
    const index = this.items.indexOf(item);
    if (index >= 0)
    {
      this.removeAt(index);
      return true;
    }
    
    return false;
  }

  public RemoveAll(item: ItemOrF2Link): void {
    while (this.Remove(item)) {
      // remove all duplicates if present
    }
  }

  public Clear(): void {
    for (const item of [...this.items])
      this.Remove(item);
  }

  public ResetTo(items: Iterable<ItemOrF2Link>): void {
    this.Clear();
    this.AddRange(items);
  }

  public get Items(): readonly F2YamlWorkspaceItem[]
  {
    return this.items.filter(item => item instanceof F2YamlWorkspaceItem);
  }  

  public [Symbol.iterator](): Iterator<ItemOrF2Link> {
    return this.items[Symbol.iterator]();
  }
}
