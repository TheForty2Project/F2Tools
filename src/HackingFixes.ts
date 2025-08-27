import * as yaml from "yaml";

export class HackingFixes {
    static getYamlMapFromPairOrYamlMap(yamlObj: any): yaml.YAMLMap
    {
        let yamlMap: yaml.YAMLMap;
        if (yamlObj instanceof yaml.YAMLMap) {
            yamlMap = yamlObj;
        }
        else if (yamlObj instanceof yaml.Pair && yamlObj.value instanceof yaml.YAMLMap) { 
            yamlMap = yamlObj.value; 
        }
        else { throw new Error("Bug: unknown structure."); }

        return yamlMap;
    }
}