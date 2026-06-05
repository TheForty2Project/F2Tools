import * as yaml from 'yaml';
import { Data } from '../Data';
import { F2YamlUtils } from '../F2YamlUtils';
import { StandardItem, ItemParsingError, ItemParsingErrorType, ValidationResult, Item } from './BasicItems';
import { F2Link } from './F2Link';
import { IdString } from './IdString';
import { StringOperations } from '../StringOperations';


export class QueryDescripton extends StandardItem {
  public Select: string[] = [];
  public From: F2Link[] = [];
  public Where: WherePartOfQuery = new WherePartOfQuery();
  public BehaviorWhenDeletingRows: RowDeletingBehavior = RowDeletingBehavior.DoNothing;
  public AddSyncResultColumn: boolean = true;
  public OutputFile: string = "";

  override ImportFromYamlScalarMapPair(itemYamlPair: yaml.Pair<yaml.Scalar, yaml.YAMLMap>): QueryDescripton {
    super.ImportFromYamlScalarMapPair(itemYamlPair);

    let yamlMap: yaml.YAMLMap = itemYamlPair.value!;
    this.OutputFile = F2YamlUtils.TryGetStringPropertyValueFromYamlMap(yamlMap, Data.SYSTEM_CLASSES.QUERYDESCRIPTION.OUTPUTFILE.ID) ?? "";
    this.Select = F2YamlUtils.TryGetStringSequencePropertyValueFromYamlMap(yamlMap, Data.SYSTEM_CLASSES.QUERYDESCRIPTION.SELECT.ID) ?? [];
    this.From = F2Link.ParseFromStringArray(F2YamlUtils.TryGetStringSequencePropertyValueFromYamlMap(yamlMap, Data.SYSTEM_CLASSES.QUERYDESCRIPTION.FROM.ID) ?? []);
    var addSyncResultPropValue = F2YamlUtils.TryGetPropertyValueFromYamlMap(yamlMap, Data.SYSTEM_CLASSES.QUERYDESCRIPTION.ADDSYNCRESULTCOLUMN.ID);
    if (!F2YamlUtils.IsBoolean(addSyncResultPropValue))
      throw new ItemParsingError(ItemParsingErrorType.CantParseAsBoolean, "AddSyncResultColumn");
    this.AddSyncResultColumn = F2YamlUtils.IsTrue(addSyncResultPropValue);

    let rowDelBehavString = (F2YamlUtils.TryGetStringPropertyValueFromYamlMap(yamlMap, Data.SYSTEM_CLASSES.QUERYDESCRIPTION.BEHAVIORWHENDELETINGROWS.ID) ?? "")
      .trim()
      .toLowerCase()
      .replace(Data.SYSTEM_CLASSES.ROWDELETINGBEHAVIOR.TYPEID.toLowerCase() + ".", "");
    if (rowDelBehavString === Data.SYSTEM_CLASSES.ROWDELETINGBEHAVIOR.REMOVE.ID.toLowerCase())
      this.BehaviorWhenDeletingRows = RowDeletingBehavior.Remove;
    else if (rowDelBehavString === Data.SYSTEM_CLASSES.ROWDELETINGBEHAVIOR.COMMENTOUT.ID.toLowerCase())
      this.BehaviorWhenDeletingRows = RowDeletingBehavior.CommentOut;
    else if (rowDelBehavString === Data.SYSTEM_CLASSES.ROWDELETINGBEHAVIOR.DONOTHING.ID.toLowerCase())
      this.BehaviorWhenDeletingRows = RowDeletingBehavior.DoNothing;
    else throw new ItemParsingError(ItemParsingErrorType.CantParseAsEnumerationMember, "BehaviorWhenDeletingRows");

    const whereYamlMap = F2YamlUtils.TryGetPropertyValueFromYamlMap(yamlMap, Data.SYSTEM_CLASSES.QUERYDESCRIPTION.WHERE.ID);
    if (whereYamlMap instanceof yaml.YAMLMap)
      this.Where = new WherePartOfQuery().ImportFromYamlMap(whereYamlMap);

    return this;
  }

  private _selectFromPropertyIdsToColumNames?: Map<IdString, string | null>;
  public get SelectFromPropertyIdsToColumNames(): Map<IdString, string | null> {
    if (this._selectFromPropertyIdsToColumNames === undefined)
      this.ParseSelect();
    return this._selectFromPropertyIdsToColumNames!;
  }

  private ParseSelect() {
    const result = new Map<IdString, string | null>();

    for (let i = 0; i < this.Select.length; i++) {
      const selectItem = this.Select[i];
      const asIndex = selectItem.indexOf(" as ");

      if (asIndex < 0) {
        if (!IdString.IsValidIdString(selectItem))
          throw new ItemParsingError(ItemParsingErrorType.InvalidSelectPropertyName, selectItem);
        result.set(IdString.ParseFromString(selectItem), null);
        continue;
      }

      const propertyName = selectItem.substring(0, asIndex).trim();
      const columnName = selectItem.substring(asIndex + 4).trim();

      if (!IdString.IsValidIdString(propertyName))
        throw new ItemParsingError(ItemParsingErrorType.InvalidSelectPropertyName, propertyName);

      result.set(IdString.ParseFromString(propertyName), columnName);
    }

    this._selectFromPropertyIdsToColumNames = result;
  }

  public IsValid(): ValidationResult {
    if (this.Select.length === 0)
      return ValidationResult.Failure(new ItemParsingError(ItemParsingErrorType.SelectPropertyEmptyOrInvalid));
    if (this.From.length === 0)
      return ValidationResult.Failure(new ItemParsingError(ItemParsingErrorType.FromPropertyEmptyOrInvalid));

    try {
      this.ParseSelect(); //this will throw errors if it's not parseable
    }
    catch (err) {
      return ValidationResult.Failure(err as ItemParsingError);
    }

    return this.Where.IsValid();
  }

  public override toString(): string
  {
    return `
<QueryDescription>:
  Id: ${this.Id}
  Summary: ${this.Summary}
  Select: [${this.Select.join(", ")}]
  From: [${this.From.join(", ")}]
  Where: ${StringOperations.indentLinesBy(this.Where.toString(), 4)}
  BehaviorWhenDeletingRows: RowDeletingBehavior.${this.BehaviorWhenDeletingRows === RowDeletingBehavior.CommentOut ? "CommentOut" : this.BehaviorWhenDeletingRows === RowDeletingBehavior.DoNothing ? "DoNothing" : "Remove"}
  AddSyncResultColumn: ${this.AddSyncResultColumn}
  OutputFile: ${this.OutputFile}`;
  }

}
enum RowDeletingBehavior {
  DoNothing,
  Remove,
  CommentOut
}
class WherePartOfQuery extends Item {
  public TaggedBy: IdString[] = [];
  public ItemTypes: IdString[] = [];
  public SkipUnder: F2Link[] = [];

  public ImportFromYamlMap(yamlMap: yaml.YAMLMap): WherePartOfQuery {
    this.TaggedBy = IdString.ParseFromStringArray(F2YamlUtils.TryGetStringSequencePropertyValueFromYamlMap(yamlMap, Data.SYSTEM_CLASSES.WHEREPARTOFQUERY.TAGGEDBY.ID) ?? []);
    this.ItemTypes = IdString.ParseFromStringArray(F2YamlUtils.TryGetStringSequencePropertyValueFromYamlMap(yamlMap, Data.SYSTEM_CLASSES.WHEREPARTOFQUERY.ITEMTYPES.ID) ?? []);
    this.SkipUnder = F2Link.ParseFromStringArray(F2YamlUtils.TryGetStringSequencePropertyValueFromYamlMap(yamlMap, Data.SYSTEM_CLASSES.WHEREPARTOFQUERY.SKIPUNDER.ID) ?? []);
    return this;
  }

  public override IsValid(): ValidationResult {
    var superIsValid = super.IsValid();
    if (!superIsValid.isValid)
      return superIsValid;

    return ValidationResult.Success(); //basically we don't have anything we can validate at this point
  }

  public override toString(): string
  {
    return `    
TaggedBy: [${this.TaggedBy.join(", ")}]
ItemTypes: [${this.ItemTypes.join(", ") }]
SkipUnder: [${this.SkipUnder.join(", ")}]`
  }
}
