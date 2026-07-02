import * as yaml from 'yaml';
import { Data } from '../Data';
import { F2YamlUtils } from '../F2YamlUtils';
import { F2Link, InternalIdPart, ItemIdentiferPart, ItemIdPart, PropertyIdPart, SummaryPart, TypeIdPart, YamlPathPart } from './F2Link';
import { IdString } from './IdString';
import { ItemList, ItemListChangeType } from './ItemList';
import { Message, OutputChannelLogger, OutputChannelLogLevel } from '../Messaging';
import { StringOperations } from '../StringOperations';
import { ItemHeader, ItemYamlHeaderType } from './ItemHeader';
import { isNullOrUndefined } from 'util';
import { Console } from 'console';
import { LogLevel } from 'vscode';

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

function isNullOrEmpty(value: string | null | undefined): boolean
{
  // eslint-disable-next-line eqeqeq
  return value == null || value === "";
}

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

type EnumerationDefinition = {
  ID: string;
  TYPEIDS: string[];
  MEMBERS: string[];
};

let propertyIdByEnumerationMember: ReadonlyMap<string, string> | undefined;

function getPropertyIdByEnumerationMember(): ReadonlyMap<string, string>
{
  if (propertyIdByEnumerationMember !== undefined)
    return propertyIdByEnumerationMember;

  const propertyIdsByMember = new Map<string, string>();
  for (const enumeration of Object.values(Data.ENUMERATIONS) as EnumerationDefinition[])
  {
    for (const member of enumeration.MEMBERS)
    {
      if (!propertyIdsByMember.has(member))
        propertyIdsByMember.set(member, enumeration.ID);
    }
  }

  propertyIdByEnumerationMember = propertyIdsByMember;
  return propertyIdByEnumerationMember;
}

export class CaseNotImplementedError extends Error
{
  constructor()
  {
    super();
    this.message = "Bug: a case is not implemented.";
  }
}

export class NotParsedYaml
{
  constructor(public readonly yamlNode: yaml.Node | yaml.Pair<unknown, unknown>) 
  { 
    if (OutputChannelLogger.LogLevel ?? OutputChannelLogLevel.None >= OutputChannelLogLevel.Debug) 
      OutputChannelLogger.logDebug("NotParsedYaml created. Contents (JSON): " + yaml.stringify(this.yamlNode))
  }

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
  public FSEntryName: string = "";
  public HeaderPrefixPropertyIds: string[] = [];
  public AdditionalPropertiesPropertyIds: string[] = [];
  public PropertyIds: string[] = [];
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

  //TODO: this should be in StandardItem once there's proper parsing
  public Header: ItemHeader = ItemHeader.Empty;
  public Children: ItemList<F2YamlWorkspaceItem> = new ItemList<F2YamlWorkspaceItem>(this, undefined) //temporary measure until we have class and default item list flag support; right now we store the "sub" items here
  public BelongsToItem?: F2YamlWorkspaceItem;
  public BelongsToProperty?: string;
  public readonly InItemLists = new Set<ItemList<F2YamlWorkspaceItem>>();
  public readonly YamlRepresentation = new YamlRepresentationDescriptor();


  public TryGetValue(yamlPathParts: YamlPathPart[]): F2YamlWorkspaceItemPropertyValue | undefined
  {
    const itemMatchesPart = (item: F2YamlWorkspaceItem, part: ItemIdentiferPart): boolean =>
    {
      if (part.NumberSuffix)
        throw new Error("Number suffixes in F2LinkParts are not yet supported.");

      if (part instanceof ItemIdPart)
      {
        return item.GetStringPropertyValue(Data.F2YAML_ELEMENTS.PROPERTY_ID) === part.ItemId;
      }      
      else if (part instanceof SummaryPart)
      {
        return item.GetStringPropertyValue(Data.F2YAML_ELEMENTS.PROPERTY_SUMMARY) === part.Summary;
      }
      else if (part instanceof TypeIdPart)
      {
        return item.GetStringPropertyValue(Data.F2YAML_ELEMENTS.PROPERTY_TYPE) === part.TypeId;
      }
      
      throw new InvalidOperationError();
    }

    if (yamlPathParts.length === 0)
      return this;

    let currentPart = yamlPathParts[0];
    if (currentPart instanceof PropertyIdPart)
    {
      //TODO: once we have classDescription support, check whether the PropertyIdPart is pointing to the default list
      for (const [key, value] of this.PropertyValuesById)
      {
        if (key === currentPart.PropertyId)
        {
          if (yamlPathParts.length <= 1)
            return value;

          if (value instanceof F2YamlWorkspaceItem)
          {
            let nextPart = yamlPathParts[1];
            if (nextPart instanceof PropertyIdPart)
              return value.TryGetValue(yamlPathParts.slice(1))
            else if (nextPart instanceof ItemIdentiferPart)
            { 
              if (itemMatchesPart(value, nextPart))
              {
                if (yamlPathParts.length === 2)
                  return value;
                else return value.TryGetValue(yamlPathParts.slice(2));
              }
            }
            throw new CaseNotImplementedError();
          }

          if (value instanceof ItemList)
          {            
            let itemIdentifierPart = yamlPathParts[1];
            if (!(itemIdentifierPart instanceof ItemIdentiferPart))
            {
              OutputChannelLogger.logWarning("Expected ItemIdentifierPart");
              return;
            }
            for (const item of value)
            {
              if (itemMatchesPart(item, itemIdentifierPart))
                return item.TryGetValue(yamlPathParts.slice(1));
            }
          }
          
          OutputChannelLogger.logWarning("F2YamlWorkspaceItem.TryGetValue: F2Link points to an invalid location");
          return;
        }
      }
    }
    else if (currentPart instanceof ItemIdentiferPart)
    {
      for (const child of this.Children) //the "default" Items
        if (itemMatchesPart(child, currentPart))
          return child.TryGetValue(yamlPathParts.slice(1));
    }

    return;
  }

  public static IsItemYaml(yamlNode: yaml.Node | yaml.Pair<unknown, unknown> | null | undefined): boolean
  {
    if (yamlNode instanceof yaml.Pair)
      return this.IsDefaultItemYaml(yamlNode) || this.IsHeaderOnlyItemYaml(yamlNode);

    if (yamlNode instanceof yaml.YAMLMap)
      return this.IsHeaderlessItemYaml(yamlNode);

    return false;
  }

  private static IsDefaultItemYaml(yamlNode: yaml.Pair<unknown, unknown>): boolean
  {
    return yamlNode.key instanceof yaml.Scalar
      && typeof yamlNode.key.value === "string"
      && ItemHeader.IsValidItemHeader(yamlNode.key.value)
      && yamlNode.value instanceof yaml.YAMLMap
      && this.IsHeaderlessItemYaml(yamlNode.value);
  }

  private static IsHeaderlessItemYaml(yamlNode: yaml.YAMLMap): boolean
  {
    return yamlNode.items.every(
      property => property.key instanceof yaml.Scalar 
      && typeof property.key.value === "string"
      && (property.key.value === Data.F2YAML_ELEMENTS.ADDITIONAL_PROPERTIES 
        || IdString.IsValidIdString(property.key.value) 
        || ItemHeader.IsValidItemHeader(property.key.value))
    );
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
    //TODO: implement this properly once we have class support
    //this.YamlRepresentation.HeaderPrefixPropertyIds = [...header.Prefixes];
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
            this.YamlRepresentation.AdditionalPropertiesPropertyIds.push(String(additionalProperty.key.value));
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
        this.YamlRepresentation.PropertyIds.push(Data.F2YAML_ELEMENTS.ADDITIONAL_PROPERTIES);
        continue;
      }

      if (IdString.IsValidIdString(pairKeyValue))
      {
        this.YamlRepresentation.PropertyIds.push(pairKeyValue);
        this.YamlRepresentation.PropertyRenderingById.set(
          pairKeyValue,
          F2YamlWorkspaceItem.CreatePropertyRenderingDescriptor(pair.value as yaml.Node | null | undefined)
        );
      }
    }
  }

  public get TypeId(): string
  {
    return this.GetStringPropertyValue(Data.F2YAML_ELEMENTS.PROPERTY_TYPE) ?? "";
  }

  public set TypeId(value: string)
  {
    this.SetPropertyValue(Data.F2YAML_ELEMENTS.PROPERTY_TYPE, value);
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

  public SetParentItemAndProperty(parentItem: F2YamlWorkspaceItem, propertyId?: string, itemList?: ItemList<F2YamlWorkspaceItem>): void
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

  protected ParsePropertyValue(yamlNode: yaml.Node | yaml.Pair<unknown, unknown>, parentItem: F2YamlWorkspaceItem, parentProperty?: string): F2YamlWorkspaceItemPropertyValue
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
      const parsedValues = yamlNode.items.map(item => this.ParsePropertyValue(item as yaml.Node, parentItem, parentProperty));

      if (parsedValues.every(value => 
        typeof value === 'string' 
        || typeof value === 'number' 
        || typeof value === 'boolean' 
        || value instanceof Date)
      )
        return parsedValues as F2YamlWorkspaceItemPropertyArrayValue;      
      if (parsedValues.every(value => value instanceof F2YamlWorkspaceItem))
      {
        let itemList = new ItemList(parentItem, parentProperty);
        itemList.AddRange(parsedValues);
        return itemList;
      }

      return new NotParsedYaml(yamlNode);
    }

    if (yamlNode instanceof yaml.YAMLMap || yamlNode instanceof yaml.Pair)
    {
      if (F2YamlWorkspaceItem.IsItemYaml(yamlNode))
      {
        let item = new F2YamlWorkspaceItem();
        if (yamlNode instanceof yaml.YAMLMap)          
          item = new F2YamlWorkspaceItem().ImportFromYamlNode(yamlNode);
        else if (yamlNode.key instanceof yaml.Scalar && yamlNode.value !== null && yamlNode.value !== undefined)
          item = new F2YamlWorkspaceItem().ImportFromYamlNode(yamlNode as yaml.Pair<yaml.Scalar, yaml.Node>);

        item.BelongsToItem = parentItem;
        item.BelongsToProperty = parentProperty;
        return item;
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
      //TODO: remove/reconsider this part once there's proper item handling - so like when this method is static with all the upgrades handling this
      if (header.HeaderType === ItemYamlHeaderType.Id)
        this.SetPropertyValue(Data.F2YAML_ELEMENTS.PROPERTY_ID, header.Id ?? "");
      if (header.HeaderType === ItemYamlHeaderType.Summary)
        this.SetPropertyValue(Data.F2YAML_ELEMENTS.PROPERTY_SUMMARY, header.Summary ?? "");
      if (header.HeaderType === ItemYamlHeaderType.TypeId && header.TypeId)
        this.TypeId = header.TypeId

      this.Header = header;


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

          const additionalPropertyId = additionalProperty.key.value;
          if (!additionalPropertyId)
          {
            OutputChannelLogger.logWarning("Invalid additional property Id: " + additionalProperty.key.value)
          }
          else
          {
            if (processedPropertyIds.includes(additionalPropertyId))
              continue;

            this.SetPropertyValue(additionalPropertyId, this.ParsePropertyValue(additionalProperty.value as yaml.Node, this, additionalPropertyId));
          }
        }
        continue;
      }

      let propertyId = keyValue;
      if (IdString.IsValidIdString(propertyId))
      {
        if (processedPropertyIds.includes(propertyId))
          continue;

        //TODO: reconsider/remove this "if" when there's proper parsing - i.e. it's StandardItem's job to handle this maybe
        if (propertyId === Data.F2YAML_ELEMENTS.PROPERTY_ID && header.HeaderType === ItemYamlHeaderType.Id
          || propertyId === Data.F2YAML_ELEMENTS.PROPERTY_SUMMARY && header.HeaderType === ItemYamlHeaderType.Summary
          || propertyId === Data.F2YAML_ELEMENTS.PROPERTY_TYPE && header.HeaderType === ItemYamlHeaderType.TypeId)
        {
          OutputChannelLogger.logWarning(new ItemParsingError(ItemParsingErrorType.IdSummaryHeaderCantBeFilledAll).message);          
          continue;
        }

        this.SetPropertyValue(propertyId, this.ParsePropertyValue(pair.value as yaml.Node, this, propertyId));
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

    const typeFromProperty = F2YamlUtils.TryGetStringPropertyValueFromYamlMap(yamlMap, Data.F2YAML_ELEMENTS.PROPERTY_TYPE);
    if (typeFromProperty !== undefined)
    {
      if (header.TypeId && header.TypeId !== typeFromProperty)
        throw new ItemParsingError(ItemParsingErrorType.TypeIdMismatchInHeaderAndTypeProperty);
      if (!IdString.IsValidIdString(typeFromProperty))
        throw new ItemParsingError(ItemParsingErrorType.TypeMustBeIdString)
      this.TypeId = typeFromProperty;
    }

    const propertyIdByMember = getPropertyIdByEnumerationMember();
    let counter = 1;
    for (const headerPrefix of header.Prefixes)
    {
      let propertyId = propertyIdByMember.get(headerPrefix);
      if (!propertyId)
      {
        OutputChannelLogger.logWarning("Unknown header prefix: " + headerPrefix);
        propertyId = "Unknown" + counter++;
      }

      this.SetPropertyValue(propertyId, headerPrefix);
      this.YamlRepresentation.HeaderPrefixPropertyIds.push(propertyId);
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
    const buildFilePathParts = (item: F2YamlWorkspaceItem): void =>
    {
      if (item.BelongsToItem !== undefined)      
        buildFilePathParts(item.BelongsToItem);      

      if (item.YamlRepresentation.RepresentationType === ItemRepresentationType.Node)
        return;

      let filePathPartValue = item.YamlRepresentation.FSEntryName;
      if (isNullOrEmpty(filePathPartValue))
        throw new InvalidOperationError("Bug: item.YamlRepresentation.FSEntryName should not be empty.");
      
      if (item.YamlRepresentation.RepresentationType === ItemRepresentationType.File)
        filePathPartValue = filePathPartValue.replace(/\.(yml|yaml)$/i, '');

      filePathParts.push(filePathPartValue);
    };
    
    const filePathParts: string[] = [];
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
      const idValue = item.GetStringPropertyValue(Data.F2YAML_ELEMENTS.PROPERTY_ID) ?? "";
      const summaryValue = item.GetStringPropertyValue(Data.F2YAML_ELEMENTS.PROPERTY_SUMMARY) ?? "";
      const typeValue = item.TypeId;

      const createItemIdPart = () =>
      {
        const number = getOccurrenceIndex(item, candidate => candidate instanceof StandardItem && candidate.Id.length > 0 ? candidate.Id : undefined);
        return new ItemIdPart(idValue, number);
      };

      const createSummaryPart = () =>
      {
        const number = getOccurrenceIndex(item, candidate => candidate instanceof StandardItem && candidate.Summary.length > 0 ? candidate.Summary : undefined);
        return new SummaryPart(summaryValue, number);
      };

      const createTypeIdPart = () =>
      {
        const number = getOccurrenceIndex(item, candidate => candidate.TypeId.length > 0 ? candidate.TypeId : undefined);
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

      OutputChannelLogger.logWarning("Unable to generate F2Link item identifier part.")
      return new ItemIdPart("ERROR");
    };

    const buildYamlPathParts = (item: F2YamlWorkspaceItem): void =>
    {
      if (item.YamlRepresentation.RepresentationType !== ItemRepresentationType.Node)
        return;
      else if (item.BelongsToItem !== undefined && item.BelongsToItem.YamlRepresentation.RepresentationType === ItemRepresentationType.Node)
      {
        buildYamlPathParts(item.BelongsToItem);

        if (item.BelongsToProperty !== undefined)
        {
          const parentPropertyValue = item.BelongsToItem.TryGetPropertyValue(item.BelongsToProperty);
          const isItemList = parentPropertyValue instanceof ItemList;
          const shouldRenderProperty = !isItemList || item.BelongsToItem.YamlRepresentation.RenderDefaultListPropertyId || item.BelongsToProperty !== 'Items';
          if (shouldRenderProperty)
            yamlPathParts.push(new PropertyIdPart(item.BelongsToProperty));

          if (isItemList)
            yamlPathParts.push(createItemIdentifierPart(item, linkTypePreference));
        }

        yamlPathParts.push(createItemIdentifierPart(item, linkTypePreference));
      }
      else
      {
        // if (filePathParts.length === 0 && item.YamlRepresentation.WorkspaceRelativePath.length > 0)
        //   filePathParts.push(...item.YamlRepresentation.WorkspaceRelativePath.split(/[\\/]/g).filter(part => part.length > 0));

        yamlPathParts.push(createItemIdentifierPart(item, linkTypePreference));
      }
    };

    buildFilePathParts(this);
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
          throw new InvalidOperationError(`Can't get string value for property "${propertyId}"`);
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
          throw new InvalidOperationError(`Can't get value for property "${propertyId}"`);
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
          ? this.GetStringPropertyValue(Data.F2YAML_ELEMENTS.PROPERTY_ID)!
          : this.YamlRepresentation.HeaderType === ItemYamlHeaderType.Summary
            ? "\"" + this.GetStringPropertyValue(Data.F2YAML_ELEMENTS.PROPERTY_SUMMARY)! + "\""
            : "<" + this.GetStringPropertyValue(Data.F2YAML_ELEMENTS.PROPERTY_TYPE)! + ">";

      header = getHeaderPrefixes() + " ." + headerItemIdentifierPart + ": ";
    }

    let propertiesRendered: string[] = [];

    for (let propertyId of this.YamlRepresentation.PropertyIds)
    {
      let propertyValue: string = "";
      if (propertyId === Data.F2YAML_ELEMENTS.ADDITIONAL_PROPERTIES) 
      {
        if (this.YamlRepresentation.AdditionalPropertiesPropertyIds.length === 0)
          continue;

        propertyValue = getAdditionalPropertiesValue();
      }
      else
      {
        if (!this.HasProperty(propertyId))
          throw new InvalidOperationError();

        propertyValue = renderPropertyValue(this.YamlRepresentation.PropertyRenderingById.get(propertyId)!, this.TryGetPropertyValue(propertyId)!);
      }

      propertiesRendered.push(propertyId + ": " + propertyValue);
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
  public get Id(): string
  {
    return this.GetStringPropertyValue(Data.F2YAML_ELEMENTS.PROPERTY_ID) ?? "";
  }

  public set Id(value: string)
  {
    this.SetPropertyValue(Data.F2YAML_ELEMENTS.PROPERTY_ID, value);
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

    const idFromProperty = F2YamlUtils.TryGetStringPropertyValueFromYamlMap(yamlMap, Data.F2YAML_ELEMENTS.PROPERTY_ID);
    let idPropHasValue = typeof idFromProperty === "string" && idFromProperty.length > 0;

    if (idPropHasValue && !IdString.IsValidIdString(String(idFromProperty)))
      throw new ItemParsingError(ItemParsingErrorType.SpaceInIdValue);

    const summaryFromProperty = F2YamlUtils.TryGetStringPropertyValueFromYamlMap(yamlMap, Data.F2YAML_ELEMENTS.PROPERTY_SUMMARY);
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
      this.Id = idFromProperty!;
    else if (this.Header.Id)
      this.Id = this.Header.Id;

    if (summaryPropHasValue)
      this.Summary = String(summaryFromProperty);
    else if (this.Header.Summary)
      this.Summary = this.Header.Summary;

    super.ImportFromYamlNode(yamlMap, processedPropertyIds?.concat([
      Data.F2YAML_ELEMENTS.PROPERTY_ID,
      Data.F2YAML_ELEMENTS.PROPERTY_SUMMARY,
    ]));

    return this;
  }

  public override ImportFromYamlScalarMapPair(itemYamlPair: yaml.Pair<yaml.Scalar, yaml.YAMLMap>, processedPropertyIds?: string[]): StandardItem
  {    
    return this.ImportFromYamlNode(itemYamlPair, processedPropertyIds);

  }
}
