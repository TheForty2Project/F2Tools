import * as yaml from "yaml";

export class HackingFixes {
    static getYamlMapFromPairOrYamlMap(yamlObj: any): yaml.YAMLMap
    {
        let yamlMap: yaml.YAMLMap;
        if (yamlObj instanceof yaml.YAMLMap) {
            return yamlObj;
        }
        else if (yamlObj instanceof yaml.Pair && yamlObj.value instanceof yaml.YAMLMap) { 
            return yamlObj.value;
        }
        throw new Error("Bug: getYamlMapIfPairOrYamlMap: yamlObj is neither a yaml.YamlMap or a yaml.Pair");
    }
}