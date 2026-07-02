import { ItemParsingError, ItemParsingErrorType } from './BasicItems';
import { IdString } from './IdString';

export class F2Link {
  private readonly filePathParts: readonly string[];
  private readonly yamlPathParts: readonly YamlPathPart[];

  public get FilePathParts(): readonly string[] {
    return this.filePathParts;
  }

  public get YamlPathParts(): readonly YamlPathPart[] {
    return this.yamlPathParts;
  }

  public get FilePathString(): string {
    return this.filePathParts.join("\\") + "\\";
  }

  public get YamlPathString(): string { 
    if (this.yamlPathParts.length === 0)
      return "";

    return "." + this.yamlPathParts.join(".");
  }

  private constructor(filePathParts: string[], yamlPathParts: YamlPathPart[]) {
    this.filePathParts = Object.freeze([...filePathParts]);
    this.yamlPathParts = Object.freeze([...yamlPathParts]); 
  }

  public GetPathLink(): F2Link
  {
    return new F2Link([...this.filePathParts], []);
  }

  public static CreateFromParts(filePathParts: string[], yamlPathParts: YamlPathPart[]): F2Link {
    return new F2Link(filePathParts, yamlPathParts);
  }

  public static TryParseString(f2LinkString: string): F2Link | ItemParsingError {
    const invalidFormat = () => new ItemParsingError(ItemParsingErrorType.InvalidF2LinkFormat, f2LinkString);
    const invalidFilePath = (value: string) => new ItemParsingError(ItemParsingErrorType.InvalidF2LinkFilePath, value);
    const invalidYamlPath = 
    (value: string) => 
      new ItemParsingError(ItemParsingErrorType.InvalidF2LinkYamlPath, value);
    const invalidIdentifier = (value: string) => new ItemParsingError(ItemParsingErrorType.InvalidF2LinkIdentifier, value);
    const invalidSummary = (value: string) => new ItemParsingError(ItemParsingErrorType.InvalidF2LinkSummary, value);

    const parseOptionalNumberSuffix = (value: string, index: number): { number: number | undefined; nextIndex: number } | ItemParsingError => {
      if (index >= value.length || value[index] !== "(")
        return { number: undefined, nextIndex: index };

      let i = index + 1;
      const digitsStart = i;
      while (i < value.length && value[i] >= "0" && value[i] <= "9")
        i++;

      if (i === digitsStart || i >= value.length || value[i] !== ")")
        return invalidYamlPath(value);

      return { number: Number.parseInt(value.slice(digitsStart, i), 10), nextIndex: i + 1 };
    };

    const parseFilePathParts = (filePathString: string, allowMissingTrailingSlash: boolean): string[] | ItemParsingError => {
      if (filePathString.length === 0)
        return invalidFilePath(filePathString);

      let end = filePathString.length;
      if (filePathString[end - 1] === "\\")
        end--;
      else if (!allowMissingTrailingSlash)
        return invalidFilePath(filePathString);

      if (end === 0)
        return invalidFilePath(filePathString);

      const parts: string[] = [];
      let partStart = 0;
      for (let i = 0; i <= end; i++) {
        const currentChar = filePathString[i];
        if (i === end || currentChar === "\\") {
          if (i === partStart)
            return invalidFilePath(filePathString);

          const part = filePathString.slice(partStart, i);
          for (let j = 0; j < part.length; j++) {
            const character = part[j];
            if (character < " " || character === "\"" || character === "*" || character === "/" || character === ":" || character === "<" || character === ">" || character === "?" || character === "\\" || character === "|")
              return invalidFilePath(part);
          }

          parts.push(part);
          partStart = i + 1;
        }
      }

      return parts;
    };

    const parseYamlPathParts = (yamlPathString: string): YamlPathPart[] | ItemParsingError => {
      if (yamlPathString.length === 0 || yamlPathString[0] !== ".")
        return invalidYamlPath(yamlPathString);

      const parts: YamlPathPart[] = [];
      let i = 0;
      while (i < yamlPathString.length) {
        if (yamlPathString[i] !== ".")
          return invalidYamlPath(yamlPathString);
        i++;

        if (i < yamlPathString.length && yamlPathString[i] === ".") {
          i++;
          if (i >= yamlPathString.length)
            return invalidYamlPath(yamlPathString);

          if (yamlPathString[i] === "{") {
            const start = ++i;
            while (i < yamlPathString.length && yamlPathString[i] !== "}") {
              const character = yamlPathString[i];
              const isDigit = character >= "0" && character <= "9";
              const isUpper = character >= "A" && character <= "Z";
              const isLower = character >= "a" && character <= "z";
              if (!isDigit && !isUpper && !isLower && character !== "-" && character !== "_")
                return invalidIdentifier(yamlPathString.slice(start - 1, i + 1));
              i++;
            }

            if (i === start || i >= yamlPathString.length || yamlPathString[i] !== "}")
              return invalidYamlPath(yamlPathString);

            const internalId = yamlPathString.slice(start, i);
            i++;
            const numberSuffix = parseOptionalNumberSuffix(yamlPathString, i);
            if (numberSuffix instanceof ItemParsingError)
              return numberSuffix;

            parts.push(new InternalIdPart(internalId, numberSuffix.number));
            i = numberSuffix.nextIndex;
            continue;
          }

          if (yamlPathString[i] === "<") {
            const start = ++i;
            while (i < yamlPathString.length && yamlPathString[i] !== ">") {
              const character = yamlPathString[i];
              const isDigit = character >= "0" && character <= "9";
              const isUpper = character >= "A" && character <= "Z";
              const isLower = character >= "a" && character <= "z";
              if (!isDigit && !isUpper && !isLower && character !== "-" && character !== "_")
                return invalidIdentifier(yamlPathString.slice(start - 1, i + 1));
              i++;
            }

            if (i === start || i >= yamlPathString.length || yamlPathString[i] !== ">")
              return invalidYamlPath(yamlPathString);

            const typeId = yamlPathString.slice(start, i);
            if (!IdString.IsValidIdString(typeId))
              return invalidIdentifier(typeId);

            i++;
            const numberSuffix = parseOptionalNumberSuffix(yamlPathString, i);
            if (numberSuffix instanceof ItemParsingError)
              return numberSuffix;

            parts.push(new TypeIdPart(typeId, numberSuffix.number));
            i = numberSuffix.nextIndex;
            continue;
          }

          if (yamlPathString[i] === "\"") {
            i++;
            let summary = "";
            let hasChar = false;
            while (i < yamlPathString.length) {
              const character = yamlPathString[i];
              if (character === "\"") {
                if (i + 1 < yamlPathString.length && yamlPathString[i + 1] === "\"") {
                  summary += "\"";
                  hasChar = true;
                  i += 2;
                  continue;
                }
                break;
              }
              summary += yamlPathString[i];
              hasChar = true;
              i++;
            }

            if (!hasChar)
              return invalidSummary(yamlPathString);
            if (i >= yamlPathString.length || yamlPathString[i] !== "\"")
              return invalidYamlPath(yamlPathString);

            i++;
            const numberSuffix = parseOptionalNumberSuffix(yamlPathString, i);
            if (numberSuffix instanceof ItemParsingError)
              return numberSuffix;

            parts.push(new SummaryPart(summary, numberSuffix.number));
            i = numberSuffix.nextIndex;
            continue;
          }

          const start = i;
          while (i < yamlPathString.length) {
            const character = yamlPathString[i];
            const isDigit = character >= "0" && character <= "9";
            const isUpper = character >= "A" && character <= "Z";
            const isLower = character >= "a" && character <= "z";
            if (!isDigit && !isUpper && !isLower && character !== "-" && character !== "_")
              break;
            i++;
          }

          if (i === start)
            return invalidYamlPath(yamlPathString);

          const itemId = yamlPathString.slice(start, i);
          if (!IdString.IsValidIdString(itemId))
            return invalidIdentifier(itemId);

          const numberSuffix = parseOptionalNumberSuffix(yamlPathString, i);
          if (numberSuffix instanceof ItemParsingError)
            return numberSuffix;

          parts.push(new ItemIdPart(itemId, numberSuffix.number));
          i = numberSuffix.nextIndex;
          continue;
        }

        const start = i;
        while (i < yamlPathString.length) {
          const character = yamlPathString[i];
          const isDigit = character >= "0" && character <= "9";
          const isUpper = character >= "A" && character <= "Z";
          const isLower = character >= "a" && character <= "z";
          if (!isDigit && !isUpper && !isLower && character !== "-" && character !== "_")
            break;
          i++;
        }

        if (i === start)
          return invalidYamlPath(yamlPathString);

        const propertyId = yamlPathString.slice(start, i);
        if (!IdString.IsValidIdString(propertyId))
          return invalidIdentifier(propertyId);

        parts.push(new PropertyIdPart(propertyId));
      }

      return parts;
    };

    if (!f2LinkString.startsWith("-->") || !f2LinkString.endsWith("<"))
      return invalidFormat();

    const body = f2LinkString.slice(3, -1);
    if (body.length === 0)
      return invalidFormat();

    if (body[0] === ".") {
      const yamlPathParts = parseYamlPathParts(body.slice(1));
      return yamlPathParts instanceof ItemParsingError ? yamlPathParts : new F2Link([], yamlPathParts);
    }

    const lastBackslashIndex = body.lastIndexOf("\\");
    if (lastBackslashIndex >= 0 && lastBackslashIndex + 1 < body.length && body[lastBackslashIndex + 1] === ".") {
      const filePathParts = parseFilePathParts(body.slice(0, lastBackslashIndex + 1), false);
      if (filePathParts instanceof ItemParsingError)
        return filePathParts;

      const yamlPathParts = parseYamlPathParts(body.slice(lastBackslashIndex + 1));
      return yamlPathParts instanceof ItemParsingError ? yamlPathParts : new F2Link(filePathParts, yamlPathParts);
    }

    const filePathParts = parseFilePathParts(body, true);
    return filePathParts instanceof ItemParsingError ? filePathParts : new F2Link(filePathParts, []);
  }

  public static ParseFromStringArray(f2LinkStrings: string[]): F2Link[] {
    const result: F2Link[] = [];
    for (let f2LinkString of f2LinkStrings) {
      const f2Link = F2Link.TryParseString(f2LinkString);
      if (f2Link instanceof ItemParsingError) throw f2Link;
      result.push(f2Link);
    }
    return result;
  }

  public toString(): string {
    return "-->" + this.FilePathString + this.YamlPathString + "<";
  }
}

export abstract class YamlPathPart{}

export class PropertyIdPart extends YamlPathPart
{
  public PropertyId: string;

  constructor(propertyId: string)
  {
    super();
    this.PropertyId = propertyId;
  }

  public toString(): string
  {
    return this.PropertyId;
  }
}

export abstract class ItemIdentiferPart extends YamlPathPart
{ 
  public readonly NumberSuffix?: string;

  constructor(number?: number)
  {
    super();
    if (number)
      this.NumberSuffix = "(" + String(number) + ")";
  }

}

export class ItemIdPart extends ItemIdentiferPart {
  public ItemId: string;

  constructor(itemId: string, number?: number ) {
    super(number);
    this.ItemId = itemId;
  }

  public toString(): string {
    return "." + this.ItemId + (this.NumberSuffix ?? "");
  }
}

export class InternalIdPart extends ItemIdentiferPart {
  public InternalId: string;

  constructor(internalId: string, number?: number)
  {
    super(number);
    this.InternalId = internalId;
  }

  public toString(): string {
    return ".{" + this.InternalId + "}" + (this.NumberSuffix ?? "");
  }
}

export class TypeIdPart extends ItemIdentiferPart
{
  public TypeId: string;

  constructor(typeId: string, number?: number)
  {
    super(number);
    this.TypeId = typeId;
  }

  public toString(): string
  {
    return ".<" + this.TypeId + ">" + (this.NumberSuffix ?? "");
  }
}

export class SummaryPart extends ItemIdentiferPart {
  public Summary: string;

  constructor(summary: string, number?: number)
  {
    super(number);
    this.Summary = summary;
  }

  public toString(): string {
    return ".\"" + this.Summary + "\"" + (this.NumberSuffix ?? "");
  }
}
