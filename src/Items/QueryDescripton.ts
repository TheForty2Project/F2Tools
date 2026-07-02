import * as yaml from 'yaml';
import { Data } from '../Data';
import { F2YamlUtils } from '../F2YamlUtils';
import { StandardItem, ItemParsingError, ItemParsingErrorType, ValidationResult, F2YamlWorkspaceItem } from './BasicItems';
import { F2Link } from './F2Link';
import { IdString } from './IdString';
import { ItemList } from './ItemList';
import { StringOperations } from '../StringOperations';


export class QueryDescripton extends StandardItem {
  public get Select(): string[] {
    return this.GetStringSequencePropertyValue(Data.SYSTEM_CLASSES.QUERYDESCRIPTION.SELECT) ?? [];
  }

  public set Select(value: string[]) {
    this.SetPropertyValue(Data.SYSTEM_CLASSES.QUERYDESCRIPTION.SELECT, [...value]);
  }

  public get From(): F2Link[] {
    const value = this.TryGetPropertyValue(Data.SYSTEM_CLASSES.QUERYDESCRIPTION.FROM);
    return Array.isArray(value) && value.every(item => item instanceof F2Link) ? value : [];
  }

  public set From(value: F2Link[]) {
    this.SetPropertyValue(Data.SYSTEM_CLASSES.QUERYDESCRIPTION.FROM, [...value]);
  }

  public get Where(): WherePartOfQuery {
    const value = this.TryGetPropertyValue(Data.SYSTEM_CLASSES.QUERYDESCRIPTION.WHERE);
    return value instanceof WherePartOfQuery ? value : new WherePartOfQuery();
  }

  public set Where(value: WherePartOfQuery) {
    this.SetPropertyValue(Data.SYSTEM_CLASSES.QUERYDESCRIPTION.WHERE, value);
  }

  public get BehaviorWhenDeletingRows(): RowDeletingBehavior {
    const value = this.GetStringPropertyValue(Data.SYSTEM_CLASSES.QUERYDESCRIPTION.BEHAVIORWHENDELETINGROWS);
    if (value === Data.SYSTEM_CLASSES.ROWDELETINGBEHAVIOR.REMOVE.ID)
      return RowDeletingBehavior.Remove;
    if (value === Data.SYSTEM_CLASSES.ROWDELETINGBEHAVIOR.COMMENTOUT.ID)
      return RowDeletingBehavior.CommentOut;
    return RowDeletingBehavior.DoNothing;
  }

  public set BehaviorWhenDeletingRows(value: RowDeletingBehavior) {
    this.SetPropertyValue(
      Data.SYSTEM_CLASSES.QUERYDESCRIPTION.BEHAVIORWHENDELETINGROWS,
      value === RowDeletingBehavior.Remove
        ? Data.SYSTEM_CLASSES.ROWDELETINGBEHAVIOR.REMOVE.ID
        : value === RowDeletingBehavior.CommentOut
          ? Data.SYSTEM_CLASSES.ROWDELETINGBEHAVIOR.COMMENTOUT.ID
          : Data.SYSTEM_CLASSES.ROWDELETINGBEHAVIOR.DONOTHING.ID
    );
  }

  public get AddSyncResultColumn(): boolean {
    return this.TryGetPropertyValue(Data.SYSTEM_CLASSES.QUERYDESCRIPTION.ADDSYNCRESULTCOLUMN) === true;
  }

  public set AddSyncResultColumn(value: boolean) {
    this.SetPropertyValue(Data.SYSTEM_CLASSES.QUERYDESCRIPTION.ADDSYNCRESULTCOLUMN, value);
  }

  public get OutputFile(): string {
    return this.GetStringPropertyValue(Data.SYSTEM_CLASSES.QUERYDESCRIPTION.OUTPUTFILE) ?? "";
  }

  public set OutputFile(value: string) {
    this.SetPropertyValue(Data.SYSTEM_CLASSES.QUERYDESCRIPTION.OUTPUTFILE, value);
  }

  public readonly ChildItems = new ItemList<F2YamlWorkspaceItem>(this, Data.SYSTEM_CLASSES.QUERYDESCRIPTION.WHERE);

  override ImportFromYamlScalarMapPair(itemYamlPair: yaml.Pair<yaml.Scalar, yaml.YAMLMap>, processedPropertyIds: string[] = []): QueryDescripton {
    let yamlMap: yaml.YAMLMap = itemYamlPair.value!;
    this.OutputFile = F2YamlUtils.TryGetStringPropertyValueFromYamlMap(yamlMap, Data.SYSTEM_CLASSES.QUERYDESCRIPTION.OUTPUTFILE) ?? "";
    this.Select = F2YamlUtils.TryGetStringSequencePropertyValueFromYamlMap(yamlMap, Data.SYSTEM_CLASSES.QUERYDESCRIPTION.SELECT) ?? [];
    this.From = F2Link.ParseFromStringArray(F2YamlUtils.TryGetStringSequencePropertyValueFromYamlMap(yamlMap, Data.SYSTEM_CLASSES.QUERYDESCRIPTION.FROM) ?? []);

    var addSyncResultPropValue = F2YamlUtils.TryGetPropertyValueFromYamlMap(yamlMap, Data.SYSTEM_CLASSES.QUERYDESCRIPTION.ADDSYNCRESULTCOLUMN) ?? true;
    if (!F2YamlUtils.IsBoolean(addSyncResultPropValue))
      throw new ItemParsingError(ItemParsingErrorType.CantParseAsBoolean, "AddSyncResultColumn");
    this.AddSyncResultColumn = F2YamlUtils.IsTrue(addSyncResultPropValue);

    let rowDelBehavString = (F2YamlUtils.TryGetStringPropertyValueFromYamlMap(yamlMap, Data.SYSTEM_CLASSES.QUERYDESCRIPTION.BEHAVIORWHENDELETINGROWS) ?? Data.SYSTEM_CLASSES.ROWDELETINGBEHAVIOR.COMMENTOUT.ID.toLowerCase())
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

    const whereYamlMap = F2YamlUtils.TryGetPropertyValueFromYamlMap(yamlMap, Data.SYSTEM_CLASSES.QUERYDESCRIPTION.WHERE);
    if (whereYamlMap instanceof yaml.YAMLMap) {
      this.Where = new WherePartOfQuery().ImportFromYamlMap(whereYamlMap);
      this.ChildItems.ResetTo([this.Where]);
    }
    else this.Where = new WherePartOfQuery();

    super.ImportFromYamlNode(itemYamlPair, processedPropertyIds?.concat([
      Data.SYSTEM_CLASSES.QUERYDESCRIPTION.OUTPUTFILE,
      Data.SYSTEM_CLASSES.QUERYDESCRIPTION.SELECT,
      Data.SYSTEM_CLASSES.QUERYDESCRIPTION.FROM,
      Data.SYSTEM_CLASSES.QUERYDESCRIPTION.ADDSYNCRESULTCOLUMN,
      Data.SYSTEM_CLASSES.QUERYDESCRIPTION.BEHAVIORWHENDELETINGROWS,
      Data.SYSTEM_CLASSES.QUERYDESCRIPTION.WHERE,
    ]));

    return this;
  }

  private _selectFromPropertyIdsToColumNames?: Map<string, string | null>;
  public get SelectFromPropertyIdsToColumNames(): Map<string, string | null> {
    if (this._selectFromPropertyIdsToColumNames === undefined)
      this.ParseSelect();
    return this._selectFromPropertyIdsToColumNames!;
  }

  private ParseSelect() {
    const result = new Map<string, string | null>();

    for (let i = 0; i < this.Select.length; i++) {
      const selectItem = this.Select[i];
      const asIndex = selectItem.indexOf(" as ");

      if (asIndex < 0) {
        if (!IdString.IsValidIdString(selectItem))
          throw new ItemParsingError(ItemParsingErrorType.InvalidSelectPropertyName, selectItem);
        result.set(selectItem, null);
        continue;
      }

      const propertyName = selectItem.substring(0, asIndex).trim();
      const columnName = selectItem.substring(asIndex + 4).trim();

      if (!IdString.IsValidIdString(propertyName))
        throw new ItemParsingError(ItemParsingErrorType.InvalidSelectPropertyName, propertyName);

      result.set(propertyName, columnName);
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

//   public override toString(): string
//   {
//     return `
// <QueryDescription>:
//   Id: ${this.Id}
//   Summary: ${this.Summary}
//   Select: [${this.Select.join(", ")}]
//   From: [${this.From.join(", ")}]
//   Where: ${StringOperations.indentLinesBy(this.Where.toString(), 4)}
//   BehaviorWhenDeletingRows: RowDeletingBehavior.${this.BehaviorWhenDeletingRows === RowDeletingBehavior.CommentOut ? "CommentOut" : this.BehaviorWhenDeletingRows === RowDeletingBehavior.DoNothing ? "DoNothing" : "Remove"}
//   AddSyncResultColumn: ${this.AddSyncResultColumn}
//   OutputFile: ${this.OutputFile}`;
//   }

}
enum RowDeletingBehavior {
  DoNothing,
  Remove,
  CommentOut
}

class WherePartOfQuery extends F2YamlWorkspaceItem {
  public get TaggedBy(): IdString[] {
    const values = this.GetStringSequencePropertyValue(Data.SYSTEM_CLASSES.WHEREPARTOFQUERY.TAGGEDBY) ?? [];
    return IdString.ParseFromStringArray(values);
  }

  public set TaggedBy(value: IdString[]) {
    this.SetPropertyValue(Data.SYSTEM_CLASSES.WHEREPARTOFQUERY.TAGGEDBY, value.map(item => item.Value));
  }

  public get ItemTypes(): IdString[] {
    const values = this.GetStringSequencePropertyValue(Data.SYSTEM_CLASSES.WHEREPARTOFQUERY.ITEMTYPES) ?? [];
    return IdString.ParseFromStringArray(values);
  }

  public set ItemTypes(value: IdString[]) {
    this.SetPropertyValue(Data.SYSTEM_CLASSES.WHEREPARTOFQUERY.ITEMTYPES, value.map(item => item.Value));
  }

  public get SkipUnder(): F2Link[] {
    const value = this.TryGetPropertyValue(Data.SYSTEM_CLASSES.WHEREPARTOFQUERY.SKIPUNDER);
    return Array.isArray(value) && value.every(item => item instanceof F2Link) ? value : [];
  }

  public set SkipUnder(value: F2Link[]) {
    this.SetPropertyValue(Data.SYSTEM_CLASSES.WHEREPARTOFQUERY.SKIPUNDER, value);
  }

  public ImportFromYamlMap(yamlMap: yaml.YAMLMap, processedPropertyIds: string[] = []): WherePartOfQuery {
    this.TaggedBy = IdString.ParseFromStringArray(F2YamlUtils.TryGetStringSequencePropertyValueFromYamlMap(yamlMap, Data.SYSTEM_CLASSES.WHEREPARTOFQUERY.TAGGEDBY) ?? []);
    this.ItemTypes = IdString.ParseFromStringArray(F2YamlUtils.TryGetStringSequencePropertyValueFromYamlMap(yamlMap, Data.SYSTEM_CLASSES.WHEREPARTOFQUERY.ITEMTYPES) ?? []);
    this.SkipUnder = F2Link.ParseFromStringArray(F2YamlUtils.TryGetStringSequencePropertyValueFromYamlMap(yamlMap, Data.SYSTEM_CLASSES.WHEREPARTOFQUERY.SKIPUNDER) ?? []);
    super.ImportFromYamlNode(yamlMap, processedPropertyIds?.concat([
      Data.SYSTEM_CLASSES.WHEREPARTOFQUERY.TAGGEDBY,
      Data.SYSTEM_CLASSES.WHEREPARTOFQUERY.ITEMTYPES,
      Data.SYSTEM_CLASSES.WHEREPARTOFQUERY.SKIPUNDER,
    ]));
    return this;
  }

  public override IsValid(): ValidationResult {
    var superIsValid = super.IsValid();
    if (!superIsValid.isValid)
      return superIsValid;

    return ValidationResult.Success(); //basically we don't have anything we can validate at this point
  }

//   public override toString(): string
//   {
//     return `    
// TaggedBy: [${this.TaggedBy.join(", ")}]
// ItemTypes: [${this.ItemTypes.join(", ") }]
// SkipUnder: [${this.SkipUnder.join(", ")}]`
//   }
}
