import { Data } from '../Data';
import { ItemParsingError, ItemParsingErrorType } from './BasicItems';
import { IdString } from './IdString';


export class ItemHeader
{
  public Id?: IdString = undefined;
  public Summary?: string = undefined;
  public TypeId?: IdString = undefined;
  public Prefixes: IdString[] = [];

  public HeaderType: ItemYamlHeaderType = ItemYamlHeaderType.None;

  private constructor(headerType: ItemYamlHeaderType)
  {
    this.HeaderType = headerType;
  }

  public static IsValidItemHeader(headerValue: string): boolean
  {
    return (ItemHeader.TryParseFromString(headerValue) instanceof ItemHeader);
  }

  public static ParseFromString(headerValue: string): ItemHeader
  {
    let value = this.TryParseFromString(headerValue);
    if (value instanceof Error)
      throw value;
    return value;
  }

  public static TryParseFromString(headerValue: string): ItemHeader | Error
  {
    var prefixes: IdString[] = [];

    if (headerValue.indexOf("\n") >= 0 || headerValue.indexOf("\r") >= 0)
      return new ItemParsingError(ItemParsingErrorType.ItemHeaderCantContainNewLine);
    headerValue = headerValue.normalize().replaceAll("\t", " ").trim();
    while (headerValue.indexOf("  ") >= 0)
      headerValue = headerValue.replace("  ", " ");

    if (headerValue === "")
      return new ItemParsingError(ItemParsingErrorType.ItemHeaderCantBeEmpty);

    let words: string[] = headerValue.split(" ");
    let counter: number = 0;
    for (const word of words)
    {
      if (word.startsWith("."))
        break;
      if (!IdString.IsValidIdString(word))
        return new ItemParsingError(ItemParsingErrorType.ItemHeaderPrefixesMustBeIdStrings);
      prefixes.push(IdString.ParseFromString(word));
      counter++;
    }
    if (counter === words.length)
      return new ItemParsingError(ItemParsingErrorType.ItemHeaderIdOrSummaryPartsMustStartWithADot)

    //we are after the prefixes; first word must start with a . - so we remove it
    words[counter] = words[counter].substring(1);


    //do we have multiple words after OR it's not an IdString/classId? If yes, that's a summary
    if (words.length === counter + 1)
    {
      var idOrTypeId = words[counter];
      if (IdString.IsValidIdString(idOrTypeId))
      {
        let result = new ItemHeader(ItemYamlHeaderType.Id);
        result.Id = IdString.ParseFromString(idOrTypeId);
        return result;
      }
      else if (idOrTypeId.startsWith(Data.F2YAML_ELEMENTS.CLASS_START)
        && idOrTypeId.endsWith(Data.F2YAML_ELEMENTS.CLASS_END)
        && IdString.IsValidIdString(idOrTypeId.slice(1, idOrTypeId.length - 1)))
      {
        let result = new ItemHeader(ItemYamlHeaderType.TypeId);
        result.TypeId = IdString.ParseFromString(idOrTypeId.slice(1, idOrTypeId.length - 1));
        return result;
      }
    }

    //else  
    let result = new ItemHeader(ItemYamlHeaderType.Summary);
    result.Summary = words.slice(counter).join(" ");
    return result;
  }

  public static get Empty() { return new ItemHeader(ItemYamlHeaderType.None); }
}
export enum ItemYamlHeaderType
{
  None,
  TypeId,
  Id,
  Summary
}

