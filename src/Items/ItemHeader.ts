import { Data } from '../Data';
import { ItemParsingError, ItemParsingErrorType } from './BasicItems';
import { IdString } from './IdString';


export class ItemHeader
{
  public Id?: string = undefined;
  public Summary?: string = undefined;
  public TypeId?: string = undefined;
  public Prefixes: string[] = [];

  public HeaderType: ItemYamlHeaderType = ItemYamlHeaderType.None;

  private constructor(headerType: ItemYamlHeaderType)
  {
    this.HeaderType = headerType;
  }

  public static IsValidItemHeader(headerValue: string): boolean
  {
    var parsingResult = ItemHeader.TryParseFromString(headerValue);
    if (parsingResult instanceof ItemHeader)
      return true;
    return false;
    //return (ItemHeader.TryParseFromString(headerValue) instanceof ItemHeader);
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
    var prefixes: string[] = [];

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
      prefixes.push(word);
      counter++;
    }
    if (counter === words.length)
      return new ItemParsingError(ItemParsingErrorType.ItemHeaderIdOrSummaryPartsMustStartWithADot)

    //we are after the prefixes; first word must start with a . - so we remove it
    words[counter] = words[counter].substring(1);


    let result: ItemHeader;

    //do we have multiple words after OR it's not an IdString/classId? If yes, that's a summary
    if (words.length === counter + 1)
    {
      let idOrTypeId = words[counter];
      if (IdString.IsValidIdString(idOrTypeId))
      {
        result = new ItemHeader(ItemYamlHeaderType.Id);
        result.Prefixes = prefixes;
        result.Id = idOrTypeId;
        return result;
      }
      else if (idOrTypeId.startsWith(Data.F2YAML_ELEMENTS.CLASS_START)
        && idOrTypeId.endsWith(Data.F2YAML_ELEMENTS.CLASS_END)
        && IdString.IsValidIdString(idOrTypeId.slice(1, idOrTypeId.length - 1)))
      {
        result = new ItemHeader(ItemYamlHeaderType.TypeId);
        result.Prefixes = prefixes;
        result.TypeId = idOrTypeId.slice(1, idOrTypeId.length - 1);
        return result;
      }
    }

    //else  
    result = new ItemHeader(ItemYamlHeaderType.Summary);
    result.Prefixes = prefixes;
    result.Summary = words.slice(counter).join(" ");
    return result;
  }

  public static get Empty() { return new ItemHeader(ItemYamlHeaderType.None); }

  public toString()
  {
    if (this.HeaderType === ItemYamlHeaderType.None)
      return "";

    let prefixes: string = this.Prefixes?.join(" ") ?? ""; 
    let result: string = prefixes.length === 0 ? "." : prefixes + " .";
    switch (this.HeaderType)
    {
      case (ItemYamlHeaderType.Id):
        result += this.Id;
        break;
      case (ItemYamlHeaderType.Summary):
        result += this.Summary;
        break;
      case (ItemYamlHeaderType.TypeId):
        result += "<" + this.TypeId + ">";
        break;
    }
    return result;
  }
}
export enum ItemYamlHeaderType
{
  None,
  TypeId,
  Id,
  Summary
}

