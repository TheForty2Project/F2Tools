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
      if (filePathString.charCodeAt(end - 1) === 92)
        end--;
      else if (!allowMissingTrailingSlash)
        return invalidFilePath(filePathString);

      if (end === 0)
        return invalidFilePath(filePathString);

      const parts: string[] = [];
      let partStart = 0;
      for (let i = 0; i <= end; i++) {
        if (i === end || filePathString.charCodeAt(i) === 92) {
          if (i === partStart)
            return invalidFilePath(filePathString);

          const part = filePathString.slice(partStart, i);
          for (let j = 0; j < part.length; j++) {
            const charCode = part.charCodeAt(j);
            if (charCode < 32 || charCode === 34 || charCode === 42 || charCode === 47 || charCode === 58 || charCode === 60 || charCode === 62 || charCode === 63 || charCode === 92 || charCode === 124)
              return invalidFilePath(part);
          }

          parts.push(part);
          partStart = i + 1;
        }
      }

      return parts;
    };

    const parseYamlPathParts = (yamlPathString: string): F2LinkPart[] | ItemParsingError => {
      if (yamlPathString.length === 0 || yamlPathString.charCodeAt(0) !== 46)
        return invalidYamlPath(yamlPathString);

      const parts: F2LinkPart[] = [];
      let i = 0;
      while (i < yamlPathString.length) {
        if (yamlPathString.charCodeAt(i) !== 46)
          return invalidYamlPath(yamlPathString);
        i++;

        if (i < yamlPathString.length && yamlPathString.charCodeAt(i) === 46) {
          i++;
          if (i >= yamlPathString.length)
            return invalidYamlPath(yamlPathString);

          if (yamlPathString.charCodeAt(i) === 123) {
            const start = ++i;
            while (i < yamlPathString.length && yamlPathString.charCodeAt(i) !== 125) {
              const charCode = yamlPathString.charCodeAt(i);
              const isDigit = charCode >= 48 && charCode <= 57;
              const isUpper = charCode >= 65 && charCode <= 90;
              const isLower = charCode >= 97 && charCode <= 122;
              if (!isDigit && !isUpper && !isLower && charCode !== 45 && charCode !== 95)
                return invalidIdentifier(yamlPathString.slice(start - 1, i + 1));
              i++;
            }

            if (i === start || i >= yamlPathString.length || yamlPathString.charCodeAt(i) !== 125)
              return invalidYamlPath(yamlPathString);

            parts.push(new InternalIdPart(yamlPathString.slice(start, i)));
            i++;
            continue;
          }

          if (yamlPathString.charCodeAt(i) === 34) {
            i++;
            let summary = "";
            let hasChar = false;
            while (i < yamlPathString.length) {
              const charCode = yamlPathString.charCodeAt(i);
              if (charCode === 34) {
                if (i + 1 < yamlPathString.length && yamlPathString.charCodeAt(i + 1) === 34) {
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
            if (i >= yamlPathString.length || yamlPathString.charCodeAt(i) !== 34)
              return invalidYamlPath(yamlPathString);

            parts.push(new SummaryPart(summary));
            i++;
            continue;
          }

          const start = i;
          while (i < yamlPathString.length) {
            const charCode = yamlPathString.charCodeAt(i);
            const isDigit = charCode >= 48 && charCode <= 57;
            const isUpper = charCode >= 65 && charCode <= 90;
            const isLower = charCode >= 97 && charCode <= 122;
            if (!isDigit && !isUpper && !isLower && charCode !== 45 && charCode !== 95)
              break;
            i++;
          }

          if (i === start)
            return invalidYamlPath(yamlPathString);

          const itemId = yamlPathString.slice(start, i);
          if (!IdString.IsIdValid(itemId))
            return invalidIdentifier(itemId);

          parts.push(new ItemIdPart(IdString.ParseFromString(itemId)));
          continue;
        }

        const start = i;
        while (i < yamlPathString.length) {
          const charCode = yamlPathString.charCodeAt(i);
          const isDigit = charCode >= 48 && charCode <= 57;
          const isUpper = charCode >= 65 && charCode <= 90;
          const isLower = charCode >= 97 && charCode <= 122;
          if (!isDigit && !isUpper && !isLower && charCode !== 45 && charCode !== 95)
            break;
          i++;
        }

        if (i === start)
          return invalidYamlPath(yamlPathString);

        const propertyId = yamlPathString.slice(start, i);
        if (!IdString.IsIdValid(propertyId))
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

    if (body.charCodeAt(0) === 46) {
      const yamlPathParts = parseYamlPathParts(body.slice(1));
      return yamlPathParts instanceof ItemParsingError ? yamlPathParts : new F2Link([], yamlPathParts);
    }

    const lastBackslashIndex = body.lastIndexOf("\\");
    if (lastBackslashIndex >= 0 && lastBackslashIndex + 1 < body.length && body.charCodeAt(lastBackslashIndex + 1) === 46) {
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
    for (const f2LinkString in f2LinkStrings) {
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
    return "{" + this.InternalId + "}";
  }
}

export class SummaryPart extends F2LinkPart {
  public Summary: string;

  constructor(summary: string) {
    super();
    this.Summary = summary;
  }

  public toString(): string {
    return "\"" + this.Summary + "\"";
  }
}
