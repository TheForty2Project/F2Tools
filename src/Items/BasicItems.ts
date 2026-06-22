import * as yaml from 'yaml';
import { Data } from '../Data';
import { F2YamlUtils } from '../F2YamlUtils';
import { F2Link, ItemIdPart, PropertyIdPart, SummaryPart, TypeIdPart, YamlPathPart } from './F2Link';
import { IdString } from './IdString';
import { ItemList } from './ItemList';
import { OutputChannelLogger } from '../Messaging';
import { StringOperations } from '../StringOperations';

export type F2YamlWorkspaceItemPropertyScalarValue = string | number | boolean | Date;
export type F2YamlWorkspaceItemPropertyArrayValue = F2YamlWorkspaceItemPropertyScalarValue[];
export type F2YamlWorkspaceItemPropertyValue =
  | F2YamlWorkspaceItemPropertyScalarValue
  | F2YamlWorkspaceItemPropertyArrayValue
  | F2YamlWorkspaceItem
  | F2Link
  | F2Link[]
  | ItemList<F2YamlWorkspaceItem>
  | NotParsedYaml
  | null;

function isScalarValue(
  value: unknown
): value is F2YamlWorkspaceItemPropertyScalarValue
{
  return (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean" ||
    value instanceof Date
  );
}

function isScalarArrayValue(
  value: unknown
): value is F2YamlWorkspaceItemPropertyArrayValue
{
  return (
    Array.isArray(value) &&
    value.every(isScalarValue)
  );
}


export class NotParsedYaml
{
  constructor(public readonly yamlNode: yaml.Node | yaml.Pair<unknown, unknown>) { }

  public toString(): string
  {
    return String(yaml.stringify(this.yamlNode));
  }
}

export class F2YamlRange
{
  constructor(
    public readonly Start: number,
    public readonly ValueEnd: number,
    public readonly NodeEnd: number
  ) { }

  public static FromYamlRange(range: [number, number, number] | [number, number] | undefined): F2YamlRange | undefined
  {
    if (range === undefined)
      return undefined;

    const start = range[0];
    const valueEnd = range[1];
    const nodeEnd = range[2] ?? range[1];
    return new F2YamlRange(start, valueEnd, nodeEnd);
  }
}

export enum ItemRepresentationType
{
  Folder,
  File,
  Node
}

export enum ItemYamlHeaderType
{
  None,
  TypeId,
  Id,
  Summary
}

export class YamlRepresentationDescriptor
{
  public DocumentRange?: F2YamlRange;
  public HeaderType: ItemYamlHeaderType = ItemYamlHeaderType.None;
  public RepresentationType: ItemRepresentationType = ItemRepresentationType.Node;
  public WorkspaceRelativePath: string = "";
  public HeaderPrefixPropertyIds: IdString[] = [];
  public AdditionalPropertiesPropertyIds: IdString[] = [];
  public PropertyIds: IdString[] = [];
  public RenderDefaultListPropertyId: boolean = true;
}

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
    try
    {
      const header = ItemHeader.ParseFromYamlScalar(node);
      return header.Id !== undefined
        || header.Summary !== undefined
        || header.TypeId !== undefined;
    }
    catch
    {
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
  protected readonly PropertyValuesById = new Map<string, F2YamlWorkspaceItemPropertyValue>();
  public BelongsToItem?: F2YamlWorkspaceItem;
  public BelongsToProperty?: IdString;
  public readonly InItemLists = new Set<ItemList<F2YamlWorkspaceItem>>();
  public readonly YamlRepresentation = new YamlRepresentationDescriptor();

  public static IsItemYaml(yamlNode: yaml.Node | yaml.Pair<unknown, unknown> | null | undefined): boolean
  {
    if (yamlNode instanceof yaml.Pair)
      return this.IsStandardItemYaml(yamlNode) || this.IsHeaderOnlyItemYaml(yamlNode);

    if (yamlNode instanceof yaml.YAMLMap)
      return this.IsHeaderlessItemYaml(yamlNode);

    return false;
  }

  private static IsStandardItemYaml(yamlNode: yaml.Pair<unknown, unknown>): boolean
  {
    return yamlNode.key instanceof yaml.Scalar
      && ItemHeader.IsValidItemHeader(yamlNode.key)
      && yamlNode.value instanceof yaml.YAMLMap
      && yamlNode.value.items.every(property => property.key instanceof yaml.Scalar && typeof property.key.value === 'string');
  }

  private static IsHeaderlessItemYaml(yamlNode: yaml.YAMLMap): boolean
  {
    return yamlNode.items.every(property => property.key instanceof yaml.Scalar && typeof property.key.value === 'string');
  }

  private static IsHeaderOnlyItemYaml(yamlNode: yaml.Pair<unknown, unknown>): boolean
  {
    return yamlNode.key instanceof yaml.Scalar
      && ItemHeader.IsValidItemHeader(yamlNode.key)
      && yamlNode.value instanceof yaml.Scalar
      && (yamlNode.value.value === '' || yamlNode.value.value === null);
  }

  private static DetermineHeaderTypeFromHeader(header: ItemHeader): ItemYamlHeaderType
  {
    if (header.TypeId !== undefined)
      return ItemYamlHeaderType.TypeId;
    if (header.Id !== undefined)
      return ItemYamlHeaderType.Id;
    if (header.Summary !== undefined)
      return ItemYamlHeaderType.Summary;
    return ItemYamlHeaderType.None;
  }

  private CaptureYamlRepresentation(itemYamlNode: yaml.YAMLMap | yaml.Pair<yaml.Scalar, yaml.Node>, header: ItemHeader, yamlMap: yaml.YAMLMap): void
  {
    const nodeRange = itemYamlNode instanceof yaml.YAMLMap
      ? itemYamlNode.range ?? undefined
      : itemYamlNode.value?.range ?? undefined;
    this.YamlRepresentation.DocumentRange = F2YamlRange.FromYamlRange(nodeRange as [number, number, number] | [number, number] | undefined);
    this.YamlRepresentation.HeaderType = itemYamlNode instanceof yaml.Pair
      ? F2YamlWorkspaceItem.DetermineHeaderTypeFromHeader(header)
      : ItemYamlHeaderType.None;
    this.YamlRepresentation.RepresentationType = ItemRepresentationType.Node;
    this.YamlRepresentation.HeaderPrefixPropertyIds = [...header.Prefixes];
    this.YamlRepresentation.AdditionalPropertiesPropertyIds = [];
    this.YamlRepresentation.PropertyIds = [];
    this.YamlRepresentation.RenderDefaultListPropertyId = true;

    for (const property of yamlMap.items)
    {
      if (!(property.key instanceof yaml.Scalar) || typeof property.key.value !== 'string')
        continue;

      const propertyId = String(property.key.value);
      if (propertyId === Data.F2YAML_ELEMENTS.ADDITIONAL_PROPERTIES && property.value instanceof yaml.YAMLMap)
      {
        for (const additionalProperty of property.value.items)
        {
          if (additionalProperty.key instanceof yaml.Scalar
            && typeof additionalProperty.key.value === 'string'
            && IdString.IsValidIdString(String(additionalProperty.key.value)))
            this.YamlRepresentation.AdditionalPropertiesPropertyIds.push(IdString.ParseFromString(String(additionalProperty.key.value)));
        }
        continue;
      }

      if (IdString.IsValidIdString(propertyId))
        this.YamlRepresentation.PropertyIds.push(IdString.ParseFromString(propertyId));
    }
  }

  public get TypeId(): IdString
  {
    return this.GetIdStringPropertyValue(Data.F2YAML_ELEMENTS.PROPERTY_TYPE) ?? IdString.Empty;
  }

  public set TypeId(value: IdString)
  {
    this.SetPropertyValue(Data.F2YAML_ELEMENTS.PROPERTY_TYPE, value.Value);
  }

  public TryGetPropertyValue(propertyId: string): F2YamlWorkspaceItemPropertyValue | undefined
  {
    return this.PropertyValuesById.get(propertyId);
  }

  public SetPropertyValue(propertyId: string, value: F2YamlWorkspaceItemPropertyValue): void
  {
    this.PropertyValuesById.set(propertyId, value);
  }

  public HasProperty(propertyId: string): boolean
  {
    return this.PropertyValuesById.has(propertyId);
  }

  public SetParentItemAndProperty(parentItem: F2YamlWorkspaceItem, propertyId: IdString, itemList?: ItemList<F2YamlWorkspaceItem>): void
  {
    this.BelongsToItem = parentItem;
    this.BelongsToProperty = propertyId;
    if (itemList !== undefined)
      this.InItemLists.add(itemList);
  }

  public RemoveFromItemList(itemList: ItemList<F2YamlWorkspaceItem>): void
  {
    this.InItemLists.delete(itemList);
    if (this.InItemLists.size === 0)
    {
      this.BelongsToItem = undefined;
      this.BelongsToProperty = undefined;
    }
  }

  public GetStringPropertyValue(propertyId: string): string | undefined
  {
    const value = this.TryGetPropertyValue(propertyId);
    return typeof value === 'string' ? value : undefined;
  }

  public GetStringSequencePropertyValue(propertyId: string): string[] | undefined
  {
    const value = this.TryGetPropertyValue(propertyId);
    if (!Array.isArray(value))
      return undefined;

    const result: string[] = [];
    for (const item of value)
    {
      if (typeof item !== 'string')
        return undefined;
      result.push(item);
    }

    return result;
  }

  public GetIdStringPropertyValue(propertyId: string): IdString | undefined
  {
    const value = this.GetStringPropertyValue(propertyId);
    if (value === undefined || !IdString.IsValidIdString(value))
      return undefined;
    return IdString.ParseFromString(value);
  }

  protected ParsePropertyValue(yamlNode: yaml.Node | yaml.Pair<unknown, unknown>): F2YamlWorkspaceItemPropertyValue
  {
    if (yamlNode instanceof yaml.Scalar)
    {
      const scalarValue = yamlNode.value;
      if (typeof scalarValue === 'string' || typeof scalarValue === 'number' || typeof scalarValue === 'boolean' || scalarValue instanceof Date || scalarValue === null)
        return scalarValue;
      return new NotParsedYaml(yamlNode);
    }

    if (yamlNode instanceof yaml.YAMLSeq)
    {
      const parsedValues = yamlNode.items.map(item => this.ParsePropertyValue(item as yaml.Node));
      if (parsedValues.every(value => typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean' || value instanceof Date))
        return parsedValues as F2YamlWorkspaceItemPropertyArrayValue;
      return new NotParsedYaml(yamlNode);
    }

    if (yamlNode instanceof yaml.YAMLMap || yamlNode instanceof yaml.Pair)
    {
      if (F2YamlWorkspaceItem.IsItemYaml(yamlNode))
      {
        if (yamlNode instanceof yaml.YAMLMap)
          return new F2YamlWorkspaceItem().ImportFromYamlNode(yamlNode);

        if (yamlNode.key instanceof yaml.Scalar && yamlNode.value !== null && yamlNode.value !== undefined)
          return new F2YamlWorkspaceItem().ImportFromYamlNode(yamlNode as yaml.Pair<yaml.Scalar, yaml.Node>);
      }
      return new NotParsedYaml(yamlNode);
    }

    return new NotParsedYaml(yamlNode);
  }

  public IsValid(): ValidationResult
  {
    return ValidationResult.Success();
  }

  public ImportFromYamlNode(itemYamlNode: yaml.YAMLMap | yaml.Pair<yaml.Scalar, yaml.Node>, processedPropertyIds: string[] = []): F2YamlWorkspaceItem
  {
    let header = ItemHeader.Empty;
    let yamlMap: yaml.YAMLMap | undefined;

    if (itemYamlNode instanceof yaml.Pair)
    {
      if (!(itemYamlNode.key instanceof yaml.Scalar))
        throw new InvalidOperationError();

      header = ItemHeader.ParseFromYamlScalar(itemYamlNode.key);

      if (itemYamlNode.value instanceof yaml.YAMLMap)
        yamlMap = itemYamlNode.value;
      else if (itemYamlNode.value instanceof yaml.Scalar && (itemYamlNode.value.value === '' || itemYamlNode.value.value === null))
        yamlMap = new yaml.YAMLMap();
      else
        throw new InvalidOperationError();
    }
    else
    {
      yamlMap = itemYamlNode;
    }

    this.CaptureYamlRepresentation(itemYamlNode, header, yamlMap);

    for (const property of yamlMap.items)
    {
      if (!(property.key instanceof yaml.Scalar) || typeof property.key.value !== 'string')
        continue;

      const propertyId = String(property.key.value);
      if (processedPropertyIds.includes(propertyId))
        continue;

      if (propertyId === Data.F2YAML_ELEMENTS.ADDITIONAL_PROPERTIES && property.value instanceof yaml.YAMLMap)
      {
        for (const additionalProperty of property.value.items)
        {
          if (!(additionalProperty.key instanceof yaml.Scalar) || typeof additionalProperty.key.value !== 'string')
            continue;

          const additionalPropertyId = String(additionalProperty.key.value);
          if (processedPropertyIds.includes(additionalPropertyId))
            continue;

          this.SetPropertyValue(additionalPropertyId, this.ParsePropertyValue(additionalProperty.value as yaml.Node));
        }
        continue;
      }

      this.SetPropertyValue(propertyId, this.ParsePropertyValue(property.value as yaml.Node));
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

    OutputChannelLogger.logDebug(this.toString());
    return this;
  }

  public ImportFromYamlScalarMapPair(itemYamlPair: yaml.Pair<yaml.Scalar, yaml.YAMLMap>): F2YamlWorkspaceItem
  {
    return this.ImportFromYamlNode(itemYamlPair);
  }

  public GetF2Link(linkTypePreference: LinkTypePreference = LinkTypePreference.None): F2Link
  {
    const workspaceRelativePath = this.YamlRepresentation.WorkspaceRelativePath;
    const filePathParts = workspaceRelativePath.length > 0
      ? workspaceRelativePath.split(/[\\/]/g).filter(part => part.length > 0)
      : [];

    const yamlPathParts: YamlPathPart[] = [];

    const getOccurrenceIndex = (item: F2YamlWorkspaceItem, identifierFactory: (candidate: F2YamlWorkspaceItem) => string | undefined): number | undefined =>
    {
      const parent = item.BelongsToItem;
      const propertyId = item.BelongsToProperty;
      if (parent === undefined || propertyId === undefined)
        return undefined;

      const propertyValue = parent.TryGetPropertyValue(propertyId.Value);
      if (!(propertyValue instanceof ItemList))
        return undefined;

      const identifier = identifierFactory(item);
      if (identifier === undefined)
        return undefined;

      let sameIdentifierCount = 0;
      let occurrenceIndex = -1;
      for (const candidate of propertyValue)
      {
        const candidateIdentifier = identifierFactory(candidate);
        if (candidateIdentifier !== identifier)
          continue;

        if (candidate === item)
          occurrenceIndex = sameIdentifierCount;

        sameIdentifierCount++;
      }

      return sameIdentifierCount > 1 ? occurrenceIndex : undefined;
    };

    const createItemIdentifierPart = (item: F2YamlWorkspaceItem, preference: LinkTypePreference): YamlPathPart =>
    {
      const isStandardItem = item instanceof StandardItem;
      const idValue = isStandardItem ? item.Id.Value : "";
      const summaryValue = isStandardItem ? item.Summary : "";
      const typeValue = item.TypeId.Value;
      const itemId = isStandardItem ? item.Id : undefined;

      const createItemIdPart = () =>
      {
        const number = getOccurrenceIndex(item, candidate => candidate instanceof StandardItem && candidate.Id.Value.length > 0 ? candidate.Id.Value : undefined);
        if (itemId === undefined)
          throw new Error('Unable to generate Id-based F2Link part for non-standard item.');
        return new ItemIdPart(itemId, number);
      };

      const createSummaryPart = () =>
      {
        const number = getOccurrenceIndex(item, candidate => candidate instanceof StandardItem && candidate.Summary.length > 0 ? candidate.Summary : undefined);
        return new SummaryPart(summaryValue, number);
      };

      const createTypeIdPart = () =>
      {
        const number = getOccurrenceIndex(item, candidate => candidate.TypeId.Value.length > 0 ? candidate.TypeId.Value : undefined);
        return new TypeIdPart(item.TypeId, number);
      };

      if (preference === LinkTypePreference.Summary)
      {
        if (summaryValue.length > 0)
          return createSummaryPart();
        if (idValue.length > 0)
          return createItemIdPart();
        if (typeValue.length > 0)
          return createTypeIdPart();
      }
      else if (preference === LinkTypePreference.Id)
      {
        if (idValue.length > 0)
          return createItemIdPart();
        if (summaryValue.length > 0)
          return createSummaryPart();
        if (typeValue.length > 0)
          return createTypeIdPart();
      }
      else
      {
        switch (item.YamlRepresentation.HeaderType)
        {
          case ItemYamlHeaderType.Id:
            if (idValue.length > 0)
              return createItemIdPart();
            break;
          case ItemYamlHeaderType.Summary:
            if (summaryValue.length > 0)
              return createSummaryPart();
            break;
          case ItemYamlHeaderType.TypeId:
            if (typeValue.length > 0)
              return createTypeIdPart();
            break;
        }

        if (item.BelongsToItem !== undefined && item.BelongsToProperty !== undefined && !(item.BelongsToItem.TryGetPropertyValue(item.BelongsToProperty.Value) instanceof ItemList))
        {
          if (item.YamlRepresentation.HeaderType !== ItemYamlHeaderType.None)
            return createItemIdentifierPart(item, LinkTypePreference.Id);

          throw new Error('Headerless non-list property items should be skipped by the caller.');
        }

        if (idValue.length > 0)
          return createItemIdPart();
        if (summaryValue.length > 0)
          return createSummaryPart();
        if (typeValue.length > 0)
          return createTypeIdPart();
      }

      throw new Error('Unable to generate F2Link item identifier part.');
    };

    const buildYamlPathParts = (item: F2YamlWorkspaceItem): void =>
    {
      if (item.BelongsToItem !== undefined)
      {
        buildYamlPathParts(item.BelongsToItem);

        if (item.BelongsToProperty !== undefined)
        {
          const parentPropertyValue = item.BelongsToItem.TryGetPropertyValue(item.BelongsToProperty.Value);
          const isItemList = parentPropertyValue instanceof ItemList;
          const shouldRenderProperty = !isItemList || item.BelongsToItem.YamlRepresentation.RenderDefaultListPropertyId || item.BelongsToProperty.Value !== 'Items';
          if (shouldRenderProperty)
            yamlPathParts.push(new PropertyIdPart(item.BelongsToProperty));

          if (isItemList)
            yamlPathParts.push(createItemIdentifierPart(item, linkTypePreference));
        }
      }
      else
      {
        if (filePathParts.length === 0 && item.YamlRepresentation.WorkspaceRelativePath.length > 0)
          filePathParts.push(...item.YamlRepresentation.WorkspaceRelativePath.split(/[\\/]/g).filter(part => part.length > 0));

        yamlPathParts.push(createItemIdentifierPart(item, linkTypePreference));
      }
    };

    buildYamlPathParts(this);

    const yamlPathString = yamlPathParts.length > 0
      ? `.${yamlPathParts.join('.')}`
      : '';

    const linkString = `-->${filePathParts.length > 0 ? `${filePathParts.join("\\")}\\` : ''}${yamlPathString}<`;
    return F2Link.ParseFromStringArray([linkString])[0];
  }

  public toString(initialIndent: number = 0, ignoreRepresentationType: boolean = true): string
  {
    const getHeaderPrefixes = (): string =>
    {      
      let headerPrefixEntries: string[] = [];
      for (let propertyId of this.YamlRepresentation.HeaderPrefixPropertyIds)
      {
        var propValue = this.GetStringPropertyValue(propertyId.Value);
        if (!propValue)
          throw new InvalidOperationError(`Can't get string value for property "${propertyId.Value}"`);
        headerPrefixEntries.push(StringOperations.wrapInQuotesIfMultiWord(propValue));
      }

      return headerPrefixEntries.join(" ");
    }

    const renderPropertyValue = (value: F2YamlWorkspaceItemPropertyValue): string =>
    {
      if (isScalarValue(value))
      {
        if (value instanceof Date)
          return value.toISOString();
        return value.toString();
      }

      if (isScalarArrayValue(value))
      {

      }

      return "";
    }

    const getAdditionalProperties = (): string =>
    {
      let result: string[] = [];
      for (let propertyId of this.YamlRepresentation.AdditionalPropertiesPropertyIds)
      {
        var rawPropValue = this.TryGetPropertyValue(propertyId.Value);
        if (!rawPropValue)
          throw new InvalidOperationError(`Can't get value for property "${propertyId.Value}"`);
        result.push(`${propertyId}: ${renderPropertyValue(rawPropValue)}`);
      }
      return result.join("\n");
    }

    let result: string = "";
    let contentIndentation: number = 0;

    if (this.YamlRepresentation.HeaderType !== ItemYamlHeaderType.None)
    {
      contentIndentation = Data.CONFIG.DEFAULT_INDENT;
      let headerItemIdentifierPart: string = 
        this.YamlRepresentation.HeaderType === ItemYamlHeaderType.Id 
        ? this.GetStringPropertyValue(Data.F2YAML_ELEMENTS.PROPERTY_ID)!
          : this.YamlRepresentation.HeaderType === ItemYamlHeaderType.Summary
            ? "\"" + this.GetStringPropertyValue(Data.F2YAML_ELEMENTS.PROPERTY_SUMMARY)! + "\""
            : "<" + this.GetStringPropertyValue(Data.F2YAML_ELEMENTS.PROPERTY_TYPE)! + ">";

      result += getHeaderPrefixes() + " ." + headerItemIdentifierPart + "\n";
    }
    
    for (let propertyId of this.YamlRepresentation.PropertyIds)
    {
      if (propertyId.Value === Data.F2YAML_ELEMENTS.ADDITIONAL_PROPERTIES) {

      }
    }
      
    return result;
  }
}

export enum LinkTypePreference
{
  None,
  Id,
  Summary
}

export abstract class StandardItem extends F2YamlWorkspaceItem
{
  public Header: ItemHeader = ItemHeader.Empty;

  public get Id(): IdString
  {
    return this.GetIdStringPropertyValue(Data.F2YAML_ELEMENTS.PROPERTY_ID) ?? IdString.Empty;
  }

  public set Id(value: IdString)
  {
    this.SetPropertyValue(Data.F2YAML_ELEMENTS.PROPERTY_ID, value.Value);
  }

  public get Summary(): string
  {
    return this.GetStringPropertyValue(Data.F2YAML_ELEMENTS.PROPERTY_SUMMARY) ?? "";
  }

  public set Summary(value: string)
  {
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
