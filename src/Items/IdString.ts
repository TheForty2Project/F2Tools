
export class IdString {
  private _value: string = "";

  public get Value(): string {
    return this._value;
  }

  public toString(): string {
    return this._value;
  }

  private constructor(value: string) { this._value = value; };

  public static IsValidIdString(id: string): boolean {
    if (id.length === 0) return false;

    switch (id.toLowerCase()) {
      case "new":
      case "class":
      case "enum":
      case "namespace":
      case "string":
      case "integer":
      case "float":
      case "bool":
      case "boolean":
      case "duration":
      case "datetime":
      case "using":
        return false;
    }

    for (let i = 0; i < id.length; i++) {
      const charCode = id.charCodeAt(i);
      const isDigit = charCode >= 48 && charCode <= 57;
      const isUpper = charCode >= 65 && charCode <= 90;
      const isLower = charCode >= 97 && charCode <= 122;
      if (!isDigit && !isUpper && !isLower && charCode !== 45 && charCode !== 95) {
        return false;
      }
    }

    return true;
  }

  public static ParseFromString(idString: string): IdString {
    if (this.IsValidIdString(idString))
      return new IdString(idString);
    throw new Error("Invalid IdString: " + idString);
  }

  public static ParseFromStringArray(idStrings: string[]): IdString[] {
    let result: IdString[] = [];
    for (const idString of idStrings)
      result.push(this.ParseFromString(idString));
    return result;
  }

}
