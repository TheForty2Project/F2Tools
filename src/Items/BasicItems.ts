import * as yaml from 'yaml';
import { Data } from '../Data';
import { F2YamlUtils } from '../F2YamlUtils';
import { F2Link, ItemIdPart, PropertyIdPart, SummaryPart, TypeIdPart, YamlPathPart } from './F2Link';
import { IdString } from './IdString';
import { ItemList } from './ItemList';
import { Message, OutputChannelLogger } from '../Messaging';
import { StringOperations } from '../StringOperations';
import { ItemHeader, ItemYamlHeaderType } from './ItemHeader';

export type F2YamlWorkspaceItemPropertyScalarValue = string | number | boolean | Date | IdString;
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

// function isF2Link(value: unknown): value is F2Link
// {
//   return (
//     typeof value === "object" &&
//     value !== null &&
//     "target" in value &&
//     "text" in value
//   );
// }

function isF2LinkArray(value: unknown): value is F2Link[]
{
  return Array.isArray(value) &&
    value.every(v => v instanceof F2Link);
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
  Folder = 0,
  File = 1,
  Node = 2,
}

export enum YamlNodeKind
{
  Scalar = 0,
  Sequence = 1,
  Mapping = 2,
}

export enum YamlStringStyle
{
  Plain,
  QuoteSingle,
  QuoteDouble,
  BlockLiteral,
  BlockFolded
}

export class YamlPropertyRenderingDescriptor
{
  public NodeKind: YamlNodeKind = YamlNodeKind.Scalar;
  public IsFlowStyle: boolean = false;
  public StringStyle: YamlStringStyle = YamlStringStyle.Plain;
}

export class YamlRepresentationDescriptor
{
  public DocumentRange?: F2YamlRange;
  public HeaderType: ItemYamlHeaderType = ItemYamlHeaderType.None;
  public RepresentationType: ItemRepresentationType = ItemRepresentationType.Node;
  public IsMapFlowStyle: boolean = false;
  public WorkspaceRelativePath: string = "";
  public HeaderPrefixPropertyIds: IdString[] = [];
  public AdditionalPropertiesPropertyIds: IdString[] = [];
  public PropertyIds: IdString[] = [];
  public RenderDefaultListPropertyId: boolean = true;
  public PropertyRenderingById = new Map<string, YamlPropertyRenderingDescriptor>();
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
  ItemHeaderIdOrSummaryPartsMustStartWithADot = 14,
  TypeMustBeIdString = 15,
  CantParseAsBoolean = 16,
  CantParseAsEnumerationMember = 17,
  ItemHeaderCantBeEmpty = 18,
  ItemHeaderCantContainNewLine,
  ItemHeaderPrefixesMustBeIdStrings,
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

  public Children: ItemList<F2YamlWorkspaceItem> = new ItemList<F2YamlWorkspaceItem>(this, IdString.Empty) //temporary measure until we have class and default item list flag support; right now we store the "sub" items here
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
      && typeof yamlNode.key.value === "string"
      && ItemHeader.IsValidItemHeader(yamlNode.key.value)
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
      && typeof yamlNode.key.value === "string"
      && ItemHeader.IsValidItemHeader(yamlNode.key.value)
      && yamlNode.value instanceof yaml.Scalar
      && (yamlNode.value.value === '' || yamlNode.value.value === null);
  }

  private static DetermineYamlNodeKind(node: yaml.Node | null | undefined): YamlNodeKind
  {
    if (node instanceof yaml.YAMLMap)
      return YamlNodeKind.Mapping;
    if (node instanceof yaml.YAMLSeq)
      return YamlNodeKind.Sequence;
    return YamlNodeKind.Scalar;
  }

  private static DetermineYamlStringStyle(node: yaml.Node | null | undefined): YamlStringStyle
  {
    if (!(node instanceof yaml.Scalar) || typeof node.value !== 'string')
      return YamlStringStyle.Plain;

    switch (node.type)
    {
      case yaml.Scalar.QUOTE_SINGLE:
        return YamlStringStyle.QuoteSingle;
      case yaml.Scalar.QUOTE_DOUBLE:
        return YamlStringStyle.QuoteDouble;
      case yaml.Scalar.BLOCK_LITERAL:
        return YamlStringStyle.BlockLiteral;
      case yaml.Scalar.BLOCK_FOLDED:
        return YamlStringStyle.BlockFolded;
      case yaml.Scalar.PLAIN:
      default:
        return YamlStringStyle.Plain;
    }
  }

  private static CreatePropertyRenderingDescriptor(node: yaml.Node | null | undefined): YamlPropertyRenderingDescriptor
  {
    const descriptor = new YamlPropertyRenderingDescriptor();
    descriptor.NodeKind = this.DetermineYamlNodeKind(node);
    descriptor.IsFlowStyle = node instanceof yaml.YAMLMap || node instanceof yaml.YAMLSeq ? node.flow === true : false;
    descriptor.StringStyle = this.DetermineYamlStringStyle(node);
    return descriptor;
  }

  private CaptureYamlRepresentation(itemYamlNode: yaml.YAMLMap | yaml.Pair<yaml.Scalar, yaml.Node>, header: ItemHeader, yamlMap: yaml.YAMLMap): void
  {
    const nodeRange = itemYamlNode instanceof yaml.YAMLMap
      ? itemYamlNode.range ?? undefined
      : itemYamlNode.value?.range ?? undefined;
    this.YamlRepresentation.DocumentRange = F2YamlRange.FromYamlRange(nodeRange as [number, number, number] | [number, number] | undefined);
    this.YamlRepresentation.HeaderType = itemYamlNode instanceof yaml.Pair
      ? header.HeaderType
      : ItemYamlHeaderType.None;
    this.YamlRepresentation.RepresentationType = ItemRepresentationType.Node;
    this.YamlRepresentation.IsMapFlowStyle = yamlMap.flow === true;
    this.YamlRepresentation.HeaderPrefixPropertyIds = [...header.Prefixes];
    this.YamlRepresentation.AdditionalPropertiesPropertyIds = [];
    this.YamlRepresentation.PropertyIds = [];
    this.YamlRepresentation.RenderDefaultListPropertyId = true;
    this.YamlRepresentation.PropertyRenderingById = new Map<string, YamlPropertyRenderingDescriptor>();

    for (const pair of yamlMap.items)
    {
      if (!(pair.key instanceof yaml.Scalar) || typeof pair.key.value !== 'string')
        continue;

      const pairKeyValue = String(pair.key.value);
      if (pairKeyValue === Data.F2YAML_ELEMENTS.ADDITIONAL_PROPERTIES && pair.value instanceof yaml.YAMLMap)
      {
        for (const additionalProperty of pair.value.items)
        {
          if (additionalProperty.key instanceof yaml.Scalar
            && typeof additionalProperty.key.value === 'string'
            && IdString.IsValidIdString(String(additionalProperty.key.value)))
          {
            this.YamlRepresentation.AdditionalPropertiesPropertyIds.push(IdString.ParseFromString(String(additionalProperty.key.value)));
            this.YamlRepresentation.PropertyRenderingById.set(
              String(additionalProperty.key.value),
              F2YamlWorkspaceItem.CreatePropertyRenderingDescriptor(additionalProperty.value as yaml.Node | null | undefined)
            );
          }
          else
          {
            OutputChannelLogger.logWarning("Invalid element in additional properties:" + additionalProperty.key);
          }
        }
        this.YamlRepresentation.PropertyIds.push(IdString.AdditionalProperties);
        continue;
      }

      if (IdString.IsValidIdString(pairKeyValue))
      {
        this.YamlRepresentation.PropertyIds.push(IdString.ParseFromString(pairKeyValue));
        this.YamlRepresentation.PropertyRenderingById.set(
          pairKeyValue,
          F2YamlWorkspaceItem.CreatePropertyRenderingDescriptor(pair.value as yaml.Node | null | undefined)
        );
      }
    }
  }

  public get TypeId(): IdString
  {
    return this.GetIdStringPropertyValue(Data.F2YAML_ELEMENTS.PROPERTY_TYPE.ID_STRING) ?? IdString.Empty;
  }

  public set TypeId(value: IdString)
  {
    this.SetPropertyValue(Data.F2YAML_ELEMENTS.PROPERTY_TYPE.ID_STRING, value.Value);
  }

  public TryGetPropertyValue(propertyId: IdString): F2YamlWorkspaceItemPropertyValue | undefined
  {
    return this.PropertyValuesById.get(propertyId.Value);
  }

  public SetPropertyValue(propertyId: IdString, value: F2YamlWorkspaceItemPropertyValue): void
  {
    this.PropertyValuesById.set(propertyId.Value, value);
  }

  public HasProperty(propertyId: IdString): boolean
  {
    return this.PropertyValuesById.has(propertyId.Value);
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

  public GetStringPropertyValue(propertyId: IdString): string | undefined
  {
    const value = this.TryGetPropertyValue(propertyId);
    return typeof value === 'string' ? value : undefined;
  }

  public GetStringSequencePropertyValue(propertyId: IdString): string[] | undefined
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

  public GetIdStringPropertyValue(propertyId: IdString): IdString | undefined
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

  //TODO: make this a static method which returns an F2YamlItem (based on the determined type, so StandardItem if there's an Id, etc)  
  public ImportFromYamlNode(itemYamlNode: yaml.YAMLMap | yaml.Pair<yaml.Scalar, yaml.Node>, processedPropertyIds: string[] = []): F2YamlWorkspaceItem
  {
    let header = ItemHeader.Empty;
    let yamlMap: yaml.YAMLMap | undefined;

    if (itemYamlNode instanceof yaml.Pair)
    {
      if (!(itemYamlNode.key instanceof yaml.Scalar) || typeof itemYamlNode.key.value !== "string")
        throw new InvalidOperationError();

      header = ItemHeader.ParseFromString(itemYamlNode.key.value);

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

    //TODO: remove/reconsider this part once there's proper item handling - so like when this method is static with all the upgrades handling this
    if (header.HeaderType === ItemYamlHeaderType.Id)
      this.SetPropertyValue(Data.F2YAML_ELEMENTS.PROPERTY_ID.ID_STRING, header.Id?.Value ?? IdString.Empty);
    if (header.HeaderType === ItemYamlHeaderType.Summary)
      this.SetPropertyValue(Data.F2YAML_ELEMENTS.PROPERTY_SUMMARY.ID_STRING, header.Summary ?? "");
    if (header.HeaderType === ItemYamlHeaderType.TypeId && header.TypeId)
      this.TypeId = header.TypeId


    for (const pair of yamlMap.items)
    {
      if (!(pair.key instanceof yaml.Scalar) || typeof pair.key.value !== 'string')
        continue;

      let keyValue: string = pair.key.value;

      if (keyValue === Data.F2YAML_ELEMENTS.ADDITIONAL_PROPERTIES && pair.value instanceof yaml.YAMLMap)
      {
        for (const additionalProperty of pair.value.items)
        {
          if (!(additionalProperty.key instanceof yaml.Scalar) || typeof additionalProperty.key.value !== 'string')
            continue;

          const additionalPropertyId = IdString.TryParseFromString(additionalProperty.key.value);
          if (!additionalPropertyId)
          {
            OutputChannelLogger.logWarning("Invalid additional property Id: " + additionalProperty.key.value)
          }
          else
          {
            if (processedPropertyIds.includes(additionalPropertyId.Value))
              continue;

            this.SetPropertyValue(additionalPropertyId, this.ParsePropertyValue(additionalProperty.value as yaml.Node));
          }
        }
        continue;
      }

      let propertyId = IdString.TryParseFromString(keyValue);
      if (propertyId)      
      {
        if (processedPropertyIds.includes(propertyId.Value))
          continue;
        this.SetPropertyValue(propertyId, this.ParsePropertyValue(pair.value as yaml.Node));
        continue;
      }

      if (F2YamlWorkspaceItem.IsItemYaml(pair))
      {
        var item = new F2YamlWorkspaceItem().ImportFromYamlNode(pair as yaml.Pair<yaml.Scalar, yaml.Node>);
        this.Children.Add(item);
        continue;
      }

      let f2Link = F2Link.TryParseString(keyValue)
      if (f2Link instanceof F2Link)
      {
        //TODO: Idea is that we'd create a type something like export type ItemOrRef = {F2YamlWorkspaceItem | ItemReference} and ItemLists would store these, with some lazy-resolving maybe. Probably we need to introduce some ItemManager for resolving links
        OutputChannelLogger.logDebug("F2Link as key is not implemented yet.");
        continue;
      }
    }

    if (header.TypeId)
      this.TypeId = header.TypeId;

    const typeFromProperty = F2YamlUtils.TryGetStringPropertyValueFromYamlMap(yamlMap, Data.F2YAML_ELEMENTS.PROPERTY_TYPE.ID_STRING.Value);
    if (typeFromProperty !== undefined)
    {
      if (header.TypeId && header.TypeId.Value !== typeFromProperty)
        throw new ItemParsingError(ItemParsingErrorType.TypeIdMismatchInHeaderAndTypeProperty);
      if (!IdString.IsValidIdString(typeFromProperty))
        throw new ItemParsingError(ItemParsingErrorType.TypeMustBeIdString)
      this.TypeId = IdString.ParseFromString(typeFromProperty);
    }

    //OutputChannelLogger.logDebug(this.toString());
    return this;
  }

  public ImportFromYamlScalarMapPair(itemYamlPair: yaml.Pair<yaml.Scalar, yaml.YAMLMap>, processedPropertyIds: string[] = []): F2YamlWorkspaceItem
  {
    return this.ImportFromYamlNode(itemYamlPair, processedPropertyIds);
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

      const propertyValue = parent.TryGetPropertyValue(propertyId);
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

        if (item.BelongsToItem !== undefined && item.BelongsToProperty !== undefined && !(item.BelongsToItem.TryGetPropertyValue(item.BelongsToProperty) instanceof ItemList))
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
          const parentPropertyValue = item.BelongsToItem.TryGetPropertyValue(item.BelongsToProperty);
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

    return F2Link.CreateFromParts(filePathParts, yamlPathParts);
  }

  public toString(initialIndent: number = 0, ignoreRepresentationType: boolean = true): string
  {
    const getHeaderPrefixes = (): string =>
    {
      let headerPrefixEntries: string[] = [];
      for (let propertyId of this.YamlRepresentation.HeaderPrefixPropertyIds)
      {
        var propValue = this.GetStringPropertyValue(propertyId);
        if (!propValue)
          throw new InvalidOperationError(`Can't get string value for property "${propertyId.Value}"`);
        headerPrefixEntries.push(StringOperations.wrapInQuotesIfMultiWord(propValue));
      }

      return headerPrefixEntries.join(" ");
    }

    const renderPropertyValue = (propRenderingDescriptor: YamlPropertyRenderingDescriptor, value: F2YamlWorkspaceItemPropertyValue): string =>
    {
      if (value === null) return "";
      if (isScalarValue(value) || value instanceof F2Link || value instanceof NotParsedYaml || value instanceof F2YamlWorkspaceItem)
      {
        if (value instanceof Date)
          return value.toISOString();
        //TODO:
        // - if it's a plain string but starts with a not allowed character - e.g. double quote - then prefix it with "\"; at parsing as well        
        else if (typeof value === "string")
        {
          switch (propRenderingDescriptor.StringStyle)
          {
            case YamlStringStyle.QuoteSingle:
              return `'${value.replace(/'/g, "''")}'`;
            case YamlStringStyle.QuoteDouble:
              return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
            case YamlStringStyle.BlockLiteral:
              return `|\n${StringOperations.indentLinesBy(value, 2)}`;
            case YamlStringStyle.BlockFolded:
              return `>\n${StringOperations.indentLinesBy(value, 2)}`;
            case YamlStringStyle.Plain:
            default:
              return value;
          }
        }

        return value.toString();
      }

      if (isScalarArrayValue(value) || value instanceof ItemList || isF2LinkArray(value))
      {
        let isFlowStyle = propRenderingDescriptor.IsFlowStyle;
        let isMap = propRenderingDescriptor.NodeKind === YamlNodeKind.Mapping; //if it was Scalar somehow... - single element? Shouldn't be allowed.
        const renderedValues: string[] = [];

        let tempPropRenderingDescr = new YamlPropertyRenderingDescriptor(); //TODO: store rendering descriptor for each sequence element as well, use that and remove this block
        tempPropRenderingDescr.IsFlowStyle = propRenderingDescriptor.IsFlowStyle;
        tempPropRenderingDescr.NodeKind = YamlNodeKind.Scalar; //kind of the most common...
        tempPropRenderingDescr.StringStyle = YamlStringStyle.QuoteDouble; //same

        for (const item of value)
        {
          renderedValues.push(renderPropertyValue(tempPropRenderingDescr, item)); //TODO: store rendering information for 
        }

        if (isFlowStyle)
          return isMap ? `{${renderedValues.join(", ")}}` : `[${renderedValues.join(", ")}]`;

        if (isMap)
          return renderedValues.length > 0
            ? `\n${renderedValues.map(item => StringOperations.indentLinesBy(item, 2)).join("\n")}`
            : "";

        return renderedValues.length > 0
          ? `\n${renderedValues.map(item => `- ${item.replace(/\n/g, "\n  ")}`).join("\n")}`
          : "[]";
      }

      throw new InvalidOperationError("The value has an incorrect type. String(value):" + String(value));
    }

    const getAdditionalPropertiesValue = (): string =>
    {
      let additionalPropRenderingDescr: YamlPropertyRenderingDescriptor = new YamlPropertyRenderingDescriptor();
      additionalPropRenderingDescr.IsFlowStyle = true;
      additionalPropRenderingDescr.NodeKind = YamlNodeKind.Scalar;

      let renderedProperties: string[] = [];
      for (let propertyId of this.YamlRepresentation.AdditionalPropertiesPropertyIds)
      {
        let rawPropValue = this.TryGetPropertyValue(propertyId);
        if (rawPropValue === undefined)
          throw new InvalidOperationError(`Can't get value for property "${propertyId.Value}"`);
        renderedProperties.push(`${propertyId}: ${renderPropertyValue(additionalPropRenderingDescr, rawPropValue)}`);
      }

      return "{" + renderedProperties.join(", ") + "}";
    }

    let result: string = "";
    let header: string = "";
    let contentIndentation: number = 0;

    if (this.YamlRepresentation.HeaderType !== ItemYamlHeaderType.None)
    {
      contentIndentation = Data.CONFIG.DEFAULT_INDENT;
      let headerItemIdentifierPart: string =
        this.YamlRepresentation.HeaderType === ItemYamlHeaderType.Id
          ? this.GetStringPropertyValue(Data.F2YAML_ELEMENTS.PROPERTY_ID.ID_STRING)!
          : this.YamlRepresentation.HeaderType === ItemYamlHeaderType.Summary
            ? "\"" + this.GetStringPropertyValue(Data.F2YAML_ELEMENTS.PROPERTY_SUMMARY.ID_STRING)! + "\""
            : "<" + this.GetStringPropertyValue(Data.F2YAML_ELEMENTS.PROPERTY_TYPE.ID_STRING)! + ">";

      header = getHeaderPrefixes() + " ." + headerItemIdentifierPart + ": ";
    }

    let propertiesRendered: string[] = [];

    for (let propertyId of this.YamlRepresentation.PropertyIds)
    {
      let propertyValue: string = "";
      if (propertyId.Value === IdString.AdditionalProperties.Value) 
      {
        if (this.YamlRepresentation.AdditionalPropertiesPropertyIds.length === 0)
          continue;

        propertyValue = getAdditionalPropertiesValue();
      }
      else
      {
        if (!this.HasProperty(propertyId))
          throw new InvalidOperationError();

        propertyValue = renderPropertyValue(this.YamlRepresentation.PropertyRenderingById.get(propertyId.Value)!, this.TryGetPropertyValue(propertyId)!);
      }

      propertiesRendered.push(propertyId.Value + ": " + propertyValue);
    }

    let childrenRendered: string[] = [];
    for (let childItem of this.Children)
    {
      childrenRendered.push(childItem.toString());
    }
    //now render, with indendation and sheeit:

    result += header;
    if (this.YamlRepresentation.IsMapFlowStyle)
    {
      result += "{" + propertiesRendered.join(", ") + childrenRendered.join(", ") + "}";
    }
    else 
    {
      const indentString = "".padEnd(contentIndentation, " ");
      result += "\n" + indentString + propertiesRendered.join("\n" + indentString) + "\n" + indentString + childrenRendered.join("\n" + indentString) + "\n";
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

export class StandardItem extends F2YamlWorkspaceItem
{
  public Header: ItemHeader = ItemHeader.Empty;

  public get Id(): IdString
  {
    return this.GetIdStringPropertyValue(Data.F2YAML_ELEMENTS.PROPERTY_ID.ID_STRING) ?? IdString.Empty;
  }

  public set Id(value: IdString)
  {
    this.SetPropertyValue(Data.F2YAML_ELEMENTS.PROPERTY_ID.ID_STRING, value.Value);
  }

  public get Summary(): string
  {
    return this.GetStringPropertyValue(Data.F2YAML_ELEMENTS.PROPERTY_SUMMARY.ID_STRING) ?? "";
  }

  public set Summary(value: string)
  {
    this.SetPropertyValue(Data.F2YAML_ELEMENTS.PROPERTY_SUMMARY.ID_STRING, value);
  }

  //copied from System/Types.yaml:

  public override ImportFromYamlNode(itemYamlNode: yaml.YAMLMap | yaml.Pair<yaml.Scalar, yaml.Node>, processedPropertyIds?: string[]): StandardItem
  {
    let header = ItemHeader.Empty;
    let yamlMap: yaml.YAMLMap | undefined;

    if (itemYamlNode instanceof yaml.Pair)
    {
      if (!(itemYamlNode.key instanceof yaml.Scalar) || typeof itemYamlNode.key.value !== "string")
        throw new InvalidOperationError();

      header = ItemHeader.ParseFromString(itemYamlNode.key.value);

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

    this.Header = header;

    const idFromProperty = F2YamlUtils.TryGetStringPropertyValueFromYamlMap(yamlMap, Data.F2YAML_ELEMENTS.PROPERTY_ID.ID_STRING.Value);
    let idPropHasValue = typeof idFromProperty === "string" && idFromProperty.length > 0;

    if (idPropHasValue && !IdString.IsValidIdString(String(idFromProperty)))
      throw new ItemParsingError(ItemParsingErrorType.SpaceInIdValue);

    const summaryFromProperty = F2YamlUtils.TryGetStringPropertyValueFromYamlMap(yamlMap, Data.F2YAML_ELEMENTS.PROPERTY_SUMMARY.ID_STRING.Value);
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

    super.ImportFromYamlNode(yamlMap, processedPropertyIds?.concat([
      Data.F2YAML_ELEMENTS.PROPERTY_ID.ID_STRING.Value,
      Data.F2YAML_ELEMENTS.PROPERTY_SUMMARY.ID_STRING.Value,
    ]));

    return this;
  }

  public override ImportFromYamlScalarMapPair(itemYamlPair: yaml.Pair<yaml.Scalar, yaml.YAMLMap>, processedPropertyIds?: string[]): StandardItem
  {    
    return this.ImportFromYamlNode(itemYamlPair, processedPropertyIds);

  }
}
