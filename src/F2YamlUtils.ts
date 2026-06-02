import * as yaml from 'yaml';



export class F2YamlUtils {
  static IsTrue(arg: any): boolean {
    const str = String(arg);
    return str === "1" || str.toLowerCase() === "true" || str.toLowerCase() === "t";
  }
  static TryGetStringSequencePropertyValueFromYamlMap(yamlMap: yaml.YAMLMap, propertyId: string): string[] | undefined {
    let yamlSeq = F2YamlUtils.TryGetPropertyValueFromYamlMap(yamlMap, propertyId);
    if (yamlSeq instanceof yaml.YAMLSeq) {
      let result: string[] = [];
      const items = yamlSeq.items;
      for (const item of items) {
        if (item instanceof yaml.Scalar)
          result.push(String(item.value));
        else return undefined;
      };
      return result;
    }
    return undefined;
  }

  static TryGetStringPropertyValueFromYamlMap(yamlMap: yaml.YAMLMap, propertyId: string): string | undefined {
    let result = F2YamlUtils.TryGetPropertyValueFromYamlMap(yamlMap, propertyId);
    if (result !== undefined
      && !(result instanceof yaml.YAMLMap)
      && !(result instanceof yaml.YAMLSeq))
      return String(result);
    else return undefined;
  }

  static TryGetPropertyValueFromYamlMap(yamlMap: yaml.YAMLMap, propertyId: string): yaml.YAMLMap | yaml.YAMLSeq | any | undefined {
    for (const property of yamlMap.items)
      if (property.key instanceof yaml.Scalar && property.key.value === propertyId)
        if (property.value instanceof yaml.YAMLMap || property.value instanceof yaml.YAMLSeq)
          return property.value;
        else if (property.value instanceof yaml.Scalar)
          return property.value.value;

    return undefined;
  }

}
