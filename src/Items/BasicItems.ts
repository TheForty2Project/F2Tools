import * as yaml from 'yaml';
import { Data } from '../Data';
import { F2YamlUtils } from '../F2YamlUtils';
import { F2Link } from './F2Link';
import { IdString } from './IdString';
import { ItemList } from './ItemList';

export type F2YamlWorkspaceItemPropertyScalarValue = string | number | boolean | Date;
export type F2YamlWorkspaceItemPropertyArrayValue = F2YamlWorkspaceItemPropertyScalarValue[];
export type F2YamlWorkspaceItemPropertyValue =
  | F2YamlWorkspaceItemPropertyScalarValue
  | F2YamlWorkspaceItemPropertyArrayValue
  | F2YamlWorkspaceItem
  | F2Link
  | F2Link[]
  | ItemList<F2YamlWorkspaceItem>
  | null;

export class InvalidOperationError extends Error
{
  constructor(message?: string)
  {
    super();
    this.message = message ?? "Bug: Invalid operation.";
  }
}

export class ItemParsingError extends Error
{

  public ItemParsingErrorType: ItemParsingErrorType = ItemParsingErrorType.None;
  public AdditionalInformation: string | undefined;

  constructor(itemParsingErrorType: ItemParsingErrorType, additionalInformation?: string)
  {
    super();
    this.ItemParsingErrorType = itemParsingErrorType;
    this.AdditionalInformation = additionalInformation;
    this.message = "Item parsing error: " + ItemParsingErrorType[itemParsingErrorType] + (this.AdditionalInformation !== undefined ? " Additional information: " + additionalInformation : "");
  }
}

export enum ItemParsingErrorType
{
  None = 0,
  SpaceInIdValue = 1,
  IdSummaryHeaderCantBeFilledAll = 2,
  AllSeqElementsMustBeString = 3,
  InvalidSelectPropertyName = 4,
  InvalidSelectColumnName = 5,
  SelectPropertyEmptyOrInvalid = 6,
  FromPropertyEmptyOrInvalid = 7,
  InvalidF2LinkFormat = 8,
  InvalidF2LinkFilePath = 9,
  InvalidF2LinkYamlPath = 10,
  InvalidF2LinkIdentifier = 11,
  InvalidF2LinkSummary = 12,
  TypeIdMismatchInHeaderAndTypeProperty = 13,
  ItemHeaderIdOrSummaryMustStartWithADot,
  TypeMustBeIdString,
  CantParseAsBoolean,
  CantParseAsEnumerationMember
}

export class ItemHeader
{
  public Id?: IdString = undefined;
  public Summary?: string = undefined;
  public TypeId?: IdString = undefined;
  public Prefixes: IdString[] = [];

  private constructor() { };

  public static IsValidItemHeader(node: yaml.Scalar): boolean
  {
    try {
      const header = ItemHeader.ParseFromYamlScalar(node);
      return header.Id !== undefined
        || header.Summary !== undefined
        || header.TypeId !== undefined;
    }
    catch {
      return false;
    }
  }

  public static ParseFromYamlScalar(node: yaml.Scalar): ItemHeader
  {
    var result = new ItemHeader();

    if (!(typeof node.value === "string"))
      throw new InvalidOperationError();

    let headerValue: string = node.value;

    if (node instanceof yaml.Scalar && typeof node.value === "string")
    {
      node.range
      let words: string[] = headerValue.split(" ");
      let counter: number = 0;
      for (const word of words)
      {
        if (word.startsWith("."))
          continue;
        if (!IdString.IsValidIdString(word))
          throw new ItemParsingError(ItemParsingErrorType.ItemHeaderIdOrSummaryMustStartWithADot)
        result.Prefixes.push(IdString.ParseFromString(word));
        counter++;
      }


      //we are after the prefixes; first word must start with a . - so we remove it
      words[counter] = words[counter].substring(1);
      //do we have multiple words after OR it's not an IdString/classId? If yes, that's a summary
      if (words.length === counter + 1)
      {
        var idOrTypeId = words[counter];
        if (IdString.IsValidIdString(idOrTypeId)) 
        {
          result.Id = IdString.ParseFromString(idOrTypeId);
          return result;
        }
        else if (
          idOrTypeId.startsWith(Data.F2YAML_ELEMENTS.CLASS_START)
          && idOrTypeId.endsWith(Data.F2YAML_ELEMENTS.CLASS_END)
          && IdString.IsValidIdString(idOrTypeId.slice(1, idOrTypeId.length - 1))
        )
        {
          result.TypeId = IdString.ParseFromString(idOrTypeId.slice(1, idOrTypeId.length - 1));
          return result;
        }
      }
      result.Summary = words.slice(counter).join(" ");
    }
    return result;
  }

  public static get Empty() { return new ItemHeader(); }
}

export class ValidationResult
{
  private constructor(
    public readonly isValid: boolean,
    public readonly error?: Error
  ) { }

  static Success(): ValidationResult
  {
    return new ValidationResult(true);
  }

  static Failure(error: Error): ValidationResult
  {
    return new ValidationResult(false, error);
  }
}

export class F2YamlWorkspaceItem
{
  //TODO: implement it like StandardItem, based on this f2yaml class description (User, ClassDescription are classes inheriting StandardItem, InternalId is a string equivalent type with some restrictions):
  // class F2YamlWorkspaceItem:
  //   Summary:
  //   ClassDescriptionFlags: [Abstract]
  //   Properties:
  //     User CreatedBy:
  //     DateTime CreatedAt:
  //     string InternalId:
  //     ClassDescription Type:
  //     F2YamlWorkspaceItem BelongsTo:
  //     Entitlement[] Entitlements:
  //     bool IsDeleted:
  //       Summary: for soft-deleting an Item. #Note that it is still under consideration whether we need this; 80% we do.
  protected readonly PropertyValues = new Map<string, F2YamlWorkspaceItemPropertyValue>();
  public BelongsToItem?: F2YamlWorkspaceItem;
  public BelongsToProperty?: IdString;
  public readonly InItemLists = new Set<ItemList<F2YamlWorkspaceItem>>();

  public static IsItemYaml(yamlNode: yaml.Node | yaml.Pair<unknown, unknown> | null | undefined): boolean {
    if (yamlNode instanceof yaml.Pair)
      return this.IsStandardItemYaml(yamlNode) || this.IsHeaderOnlyItemYaml(yamlNode);

    if (yamlNode instanceof yaml.YAMLMap)
      return this.IsHeaderlessItemYaml(yamlNode);

    return false;
  }

  private static IsStandardItemYaml(yamlNode: yaml.Pair<unknown, unknown>): boolean {
    return yamlNode.key instanceof yaml.Scalar
      && ItemHeader.IsValidItemHeader(yamlNode.key)
      && yamlNode.value instanceof yaml.YAMLMap
      && yamlNode.value.items.every(property => property.key instanceof yaml.Scalar && typeof property.key.value === 'string');
  }

  private static IsHeaderlessItemYaml(yamlNode: yaml.YAMLMap): boolean {
    return yamlNode.items.every(property => property.key instanceof yaml.Scalar && typeof property.key.value === 'string');
  }

  private static IsHeaderOnlyItemYaml(yamlNode: yaml.Pair<unknown, unknown>): boolean {
    return yamlNode.key instanceof yaml.Scalar
      && ItemHeader.IsValidItemHeader(yamlNode.key)
      && yamlNode.value instanceof yaml.Scalar
      && (yamlNode.value.value === '' || yamlNode.value.value === null);
  }

  public get TypeId(): IdString {
    return this.GetIdStringPropertyValue(Data.F2YAML_ELEMENTS.PROPERTY_TYPE) ?? IdString.Empty;
  }

  public set TypeId(value: IdString) {
    this.SetPropertyValue(Data.F2YAML_ELEMENTS.PROPERTY_TYPE, value.Value);
  }

  public GetPropertyValue(propertyId: string): F2YamlWorkspaceItemPropertyValue | undefined {
    return this.PropertyValues.get(propertyId);
  }

  public SetPropertyValue(propertyId: string, value: F2YamlWorkspaceItemPropertyValue): void {
    this.PropertyValues.set(propertyId, value);
  }

  public HasProperty(propertyId: string): boolean {
    return this.PropertyValues.has(propertyId);
  }

  public SetParentItemAndProperty(parentItem: F2YamlWorkspaceItem, propertyId: IdString, itemList?: ItemList<F2YamlWorkspaceItem>): void {
    this.BelongsToItem = parentItem;
    this.BelongsToProperty = propertyId;
    if (itemList !== undefined)
      this.InItemLists.add(itemList);
  }

  public RemoveFromItemList(itemList: ItemList<F2YamlWorkspaceItem>): void {
    this.InItemLists.delete(itemList);
    if (this.InItemLists.size === 0) {
      this.BelongsToItem = undefined;
      this.BelongsToProperty = undefined;
    }
  }

  public GetStringPropertyValue(propertyId: string): string | undefined {
    const value = this.GetPropertyValue(propertyId);
    return typeof value === 'string' ? value : undefined;
  }

  public GetStringSequencePropertyValue(propertyId: string): string[] | undefined {
    const value = this.GetPropertyValue(propertyId);
    if (!Array.isArray(value))
      return undefined;

    const result: string[] = [];
    for (const item of value) {
      if (typeof item !== 'string')
        return undefined;
      result.push(item);
    }

    return result;
  }

  public GetIdStringPropertyValue(propertyId: string): IdString | undefined {
    const value = this.GetStringPropertyValue(propertyId);
    if (value === undefined || !IdString.IsValidIdString(value))
      return undefined;
    return IdString.ParseFromString(value);
  }

  public IsValid(): ValidationResult
  {
    return ValidationResult.Success();
  }

  public ImportFromYamlScalarMapPair(itemYamlPair: yaml.Pair<yaml.Scalar, yaml.YAMLMap>): F2YamlWorkspaceItem
  {        
    let header = ItemHeader.ParseFromYamlScalar(itemYamlPair.key);
    const yamlMap = itemYamlPair.value!;
 
    for (const property of yamlMap.items) {
      if (!(property.key instanceof yaml.Scalar))
        continue;

      if (property.value instanceof yaml.YAMLSeq) {
        const sequenceValues: Array<string | number | boolean | Date> = [];
        let canStoreSequence = true;
        for (const item of property.value.items) {
          if (!(item instanceof yaml.Scalar)) {
            canStoreSequence = false;
            break;
          }

          const scalarValue = item.value;
          if (typeof scalarValue === 'string' || typeof scalarValue === 'number' || typeof scalarValue === 'boolean' || scalarValue instanceof Date)
            sequenceValues.push(scalarValue);
          else {
            canStoreSequence = false;
            break;
          }
        }

        if (canStoreSequence)
          this.SetPropertyValue(String(property.key.value), sequenceValues);
      }
      else if (property.value instanceof yaml.Scalar)
        this.SetPropertyValue(String(property.key.value), property.value.value as string | number | boolean | Date | null);
    }

    if (header.TypeId)
      this.TypeId = header.TypeId;

    const typeFromProperty = F2YamlUtils.TryGetStringPropertyValueFromYamlMap(yamlMap, Data.F2YAML_ELEMENTS.PROPERTY_TYPE);
    if (typeFromProperty !== undefined)
    {
      if (header.TypeId && header.TypeId.Value !== typeFromProperty)
        throw new ItemParsingError(ItemParsingErrorType.TypeIdMismatchInHeaderAndTypeProperty);
      if (!IdString.IsValidIdString(typeFromProperty))
        throw new ItemParsingError(ItemParsingErrorType.TypeMustBeIdString)
      this.TypeId = IdString.ParseFromString(typeFromProperty);
    }
    
    return this;
  }
}

export abstract class StandardItem extends F2YamlWorkspaceItem
{
  public Header: ItemHeader = ItemHeader.Empty;

  public get Id(): IdString {
    return this.GetIdStringPropertyValue(Data.F2YAML_ELEMENTS.PROPERTY_ID) ?? IdString.Empty;
  }

  public set Id(value: IdString) {
    this.SetPropertyValue(Data.F2YAML_ELEMENTS.PROPERTY_ID, value.Value);
  }

  public get Summary(): string {
    return this.GetStringPropertyValue(Data.F2YAML_ELEMENTS.PROPERTY_SUMMARY) ?? "";
  }

  public set Summary(value: string) {
    this.SetPropertyValue(Data.F2YAML_ELEMENTS.PROPERTY_SUMMARY, value);
  }

  //copied from System/Types.yaml:

  public override ImportFromYamlScalarMapPair(itemYamlPair: yaml.Pair<yaml.Scalar, yaml.YAMLMap>): StandardItem
  {
    super.ImportFromYamlScalarMapPair(itemYamlPair);

    this.Header = ItemHeader.ParseFromYamlScalar(itemYamlPair.key);

    const idFromProperty = F2YamlUtils.TryGetStringPropertyValueFromYamlMap(itemYamlPair.value!, Data.F2YAML_ELEMENTS.PROPERTY_ID);
    let idPropHasValue = typeof idFromProperty === "string" && idFromProperty.length > 0;

    if (idPropHasValue && !IdString.IsValidIdString(String(idFromProperty)))
      throw new ItemParsingError(ItemParsingErrorType.SpaceInIdValue);

    const summaryFromProperty = F2YamlUtils.TryGetStringPropertyValueFromYamlMap(itemYamlPair.value!, Data.F2YAML_ELEMENTS.PROPERTY_SUMMARY);
    let summaryPropHasValue = typeof summaryFromProperty === "string" && summaryFromProperty.length > 0;


    //valid cases for Id and summary - so how to compute Id and Summary if there's header (1) + it's a valid id (2):
    //
    //Header exists + is IdString, Id has value, Summary has value, Computed Id, Computed Summary
    //                          0,            0,                 0, -          , -
    //                          0,            0,                 1, -          , Summary
    //                          0,            1,                 0, Id         , -
    //                          0,            1,                 1, Id         , Summary
    //                          1,            0,                 0, -          , Header
    //                          1,            0,                 1, -          , Summary
    //                          1,            1,                 0, Id         , Header
    //                          1,            1,                 1, Id         , Summary
    //                          2,            0,                 0, Header     , -
    //                          2,            0,                 1, Header     , Summary
    //                          2,            1,                 0, Id         , Header
    //                          2,            1,                 1, ERROR      , ERROR

    if ((this.Header.Id || this.Header.Summary) && idPropHasValue && summaryPropHasValue)
      throw new ItemParsingError(ItemParsingErrorType.IdSummaryHeaderCantBeFilledAll)

    if (idPropHasValue)
      this.Id = IdString.ParseFromString(idFromProperty!);
    else if (this.Header.Id)
      this.Id = this.Header.Id;

    if (summaryPropHasValue)
      this.Summary = String(summaryFromProperty);
    else if (this.Header.Summary)
      this.Summary = this.Header.Summary;

    return this;
  }
}
