import { ItemParsingError, ItemParsingErrorType } from './BasicItems';
import { IdString } from './IdString';

export class F2Link {
  public FilePathParts: string[] = [];
  public YamlPathParts: F2LinkPart[] = [];

  public get FilePathString(): string {
    return this.FilePathParts.join("\\") + "\\";
  }

  public get YamlPathString(): string {
    return this.YamlPathParts.join(".");
  }

  public get IsLocalLink(): boolean {
    return this.FilePathParts.length === 0 && this.YamlPathParts.length >= 0
  }

  public get IsPathLink(): boolean {
    return this.YamlPathString.length === 0 && this.FilePathParts.length >= 0
  }

  private constructor(filePathParts: string[], yamlPathParts: F2LinkPart[]) {
    this.FilePathParts = filePathParts;
    this.YamlPathParts = yamlPathParts;
  }

  public static TryParseString(f2LinkString: string): F2Link | ItemParsingError {
    const invalidFormat = () => new ItemParsingError(ItemParsingErrorType.InvalidF2LinkFormat, f2LinkString);
    const invalidFilePath = (value: string) => new ItemParsingError(ItemParsingErrorType.InvalidF2LinkFilePath, value);
    const invalidYamlPath = (value: string) => new ItemParsingError(ItemParsingErrorType.InvalidF2LinkYamlPath, value);
    const invalidIdentifier = (value: string) => new ItemParsingError(ItemParsingErrorType.InvalidF2LinkIdentifier, value);
    const invalidSummary = (value: string) => new ItemParsingError(ItemParsingErrorType.InvalidF2LinkSummary, value);

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

    const parseYamlPathParts = (yamlPathString: string): F2LinkPart[] | ItemParsingError => {
      if (yamlPathString.length === 0 || yamlPathString[0] !== ".")
        return invalidYamlPath(yamlPathString);

      const parts: F2LinkPart[] = [];
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

            parts.push(new InternalIdPart(yamlPathString.slice(start, i)));
            i++;
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

            parts.push(new SummaryPart(summary));
            i++;
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

          parts.push(new ItemIdPart(IdString.ParseFromString(itemId)));
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

        parts.push(new PropertyIdPart(IdString.ParseFromString(propertyId)));
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

export abstract class F2LinkPart { }

export class ItemIdPart extends F2LinkPart {
  public ItemId: IdString;

  constructor(itemId: IdString) {
    super();
    this.ItemId = itemId;
  }

  public toString(): string {
    return "." + this.ItemId.Value;
  }
}

export class PropertyIdPart extends F2LinkPart {
  public PropertyId: IdString;

  constructor(propertyId: IdString) {
    super();
    this.PropertyId = propertyId;
  }

  public toString(): string {
    return this.PropertyId.Value;
  }
}

export class InternalIdPart extends F2LinkPart {
  public InternalId: string;

  constructor(internalId: string) {
    super();
    this.InternalId = internalId;
  }

  public toString(): string {
    return ".{" + this.InternalId + "}";
  }
}

export class SummaryPart extends F2LinkPart {
  public Summary: string;

  constructor(summary: string) {
    super();
    this.Summary = summary;
  }

  public toString(): string {
    return ".\"" + this.Summary + "\"";
  }
}
