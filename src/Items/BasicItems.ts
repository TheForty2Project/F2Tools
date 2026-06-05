import * as yaml from 'yaml';
import { Data } from '../Data';
import { F2YamlUtils } from '../F2YamlUtils';
import { IdString } from './IdString';

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

export class Item
{
  //TODO: implement it like StandardItem, based on this f2yaml class description (User, ClassDescription are classes inheriting StandardItem, InternalId is a string equivalent type with some restrictions):
  // class Item:
  //   Summary:
  //   ClassDescriptionFlags: [Abstract]
  //   Properties:
  //     User CreatedBy:
  //     DateTime CreatedAt:
  //     InternalId InternalId:
  //     ClassDescription Type:
  //     Item BelongsTo:
  //     Entitlement[] Entitlements:
  //     bool IsDeleted:
  //       Summary: for soft-deleting an Item. #Note that it is still under consideration whether we need this; 80% we do.
  public TypeId: IdString = IdString.Empty;

  public IsValid(): ValidationResult
  {
    return ValidationResult.Success();
  }
  public ImportFromYamlScalarMapPair(itemYamlPair: yaml.Pair<yaml.Scalar, yaml.YAMLMap>): Item
  {    
    let header = ItemHeader.ParseFromYamlScalar(itemYamlPair.key);
    if (header.TypeId)
      this.TypeId = header.TypeId;

    const typeFromProperty = F2YamlUtils.TryGetStringPropertyValueFromYamlMap(itemYamlPair.value!, Data.F2YAML_ELEMENTS.PROPERTY_TYPE);
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

export class ItemHeader
{
  public Id?: IdString = undefined;
  public Summary?: string = undefined;
  public TypeId?: IdString = undefined;
  public Prefixes: IdString[] = [];

  private constructor() { };

  public static ParseFromYamlScalar(node: yaml.Scalar): ItemHeader
  {
    var result = new ItemHeader();

    if (!(typeof node.value === "string"))
      throw new InvalidOperationError();

    let headerValue: string = node.value;

    if (node instanceof yaml.Scalar && typeof node.value === "string")
    {
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

export abstract class StandardItem extends Item
{
  public Id: IdString = IdString.Empty;
  public Summary: string = "";
  public Header: ItemHeader = ItemHeader.Empty;

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


