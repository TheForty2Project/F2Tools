import * as yaml from 'yaml';
import { Data } from '../Data';
import { F2YamlUtils } from '../F2YamlUtils';
import { IdString } from './IdString';

export class ItemParsingError extends Error {

  public ItemParsingErrorType: ItemParsingErrorType = ItemParsingErrorType.None;
  public AdditionalInformation: string | undefined;

  constructor(itemParsingErrorType: ItemParsingErrorType, additionalInformation?: string) {
    super();
    this.ItemParsingErrorType = itemParsingErrorType;
    this.AdditionalInformation = additionalInformation;
  }
}

export enum ItemParsingErrorType {
  None,
  SpaceInIdValue,
  IdSummaryHeaderCantBeFilledAll,
  AllSeqElementsMustBeString,
  InvalidSelectPropertyName,
  InvalidSelectColumnName,
  SelectPropertyCantBeEmpty,
  FromPropertyCantBeEmpty,
  InvalidF2LinkFormat,
  InvalidF2LinkFilePath,
  InvalidF2LinkYamlPath,
  InvalidF2LinkIdentifier,
  InvalidF2LinkSummary,
}

export class Item {
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
  public IsValid(): ValidationResult 
  {
    return ValidationResult.Success();
  }
  public ImportFromYamlScalarMapPair(itemYamlPair: yaml.Pair<yaml.Scalar, yaml.YAMLMap>): Item {
    return this;
  }
}

export class ValidationResult {
  private constructor(
    public readonly isValid: boolean,
    public readonly error?: Error
  ) { }

  static Success(): ValidationResult {
    return new ValidationResult(true);
  }

  static Failure(error: Error): ValidationResult {
    return new ValidationResult(false, error);
  }
}

export class StandardItem extends Item {
  public Id: string = "";
  public Summary: string = "";
  //copied from System/Types.yaml:

  public override ImportFromYamlScalarMapPair(itemYamlPair: yaml.Pair<yaml.Scalar, yaml.YAMLMap>): StandardItem {
    //valid cases for Id and summary - so how to compute Id and Summary if there's header (1) + it's a valid id (2)
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
    super.ImportFromYamlScalarMapPair(itemYamlPair);
    let headerValue: string = String(itemYamlPair.key.value);
    if (headerValue.startsWith(Data.F2YAML_ELEMENTS.CLASS_START) && headerValue.endsWith(Data.F2YAML_ELEMENTS.CLASS_END))
      headerValue = ""; //representing it's something from which a summary or an id can't be extracted from

    const idFromProperty = F2YamlUtils.TryGetStringPropertyValueFromYamlMap(itemYamlPair.value!, Data.F2YAML_ELEMENTS.PROPERTY_ID);
    let idPropHasValue = typeof idFromProperty === "string" && idFromProperty.length > 0;

    if (typeof idPropHasValue && !IdString.IsIdValid(String(idFromProperty)))
      throw new ItemParsingError(ItemParsingErrorType.SpaceInIdValue);

    const summaryFromProperty = F2YamlUtils.TryGetStringPropertyValueFromYamlMap(itemYamlPair.value!, Data.F2YAML_ELEMENTS.PROPERTY_SUMMARY);
    let summaryPropHasValue = typeof summaryFromProperty === "string" && summaryFromProperty.length > 0;

    if (headerValue.length > 0 && idPropHasValue && summaryPropHasValue)
      throw new ItemParsingError(ItemParsingErrorType.IdSummaryHeaderCantBeFilledAll)

    //Id:
    if (idPropHasValue)
      this.Id = String(idFromProperty);
    else if (IdString.IsIdValid(headerValue))
      this.Id = headerValue;
    //Summary:
    if (summaryPropHasValue)
      this.Summary = String(summaryFromProperty);
    else if (headerValue.length > 0)
      this.Summary = headerValue;
    //Id = F2YamlUtils.GetPropertyValueFromYamlMap()
    return this;
  }
}


