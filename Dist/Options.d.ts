import webpack = require("webpack");
export declare type ValidationLogType = "error" | "logError" | "logWarning" | "log";
export declare type ShouldValidateData = {
    compilations: webpack.Compilation[];
};
export declare type ShouldValidateCondition = boolean | ((data: ShouldValidateData) => boolean);
export declare class Options {
    constructor(initialProps: Partial<Options>);
    shouldValidate?: ShouldValidateCondition;
    validationLogType?: ValidationLogType;
    ruleBase?: Partial<Rule>;
    replacementBase?: Partial<Replacement>;
    rules: Rule[];
    webpackModule?: typeof webpack;
}
export declare type ApplyStage = "loader" | "optimizeModules" | "optimizeChunkAssets";
export declare class Rule {
    applyStage?: ApplyStage;
    chunkInclude?: any;
    chunkExclude?: any;
    chunkMatchCount?: MatchCountTarget;
    outputFileInclude?: FileMatch;
    outputFileExclude?: FileMatch;
    outputFileMatchCount?: MatchCountTarget;
    fileInclude?: FileMatch;
    fileExclude?: FileMatch;
    fileMatchCount?: MatchCountTarget;
    logFileMatches?: boolean;
    logFileMatchContents?: boolean | number;
    replacements?: Replacement[];
}
export declare class Replacement {
    pattern: string | RegExp;
    patternMatchCount?: MatchCountTarget;
    logAroundPatternMatches?: number;
    replacement: string | ((substring: string, ...args: (string | number)[]) => string);
}
export declare type ChunkMatch = any;
export declare type FileMatch = FileMatch_Single | FileMatch_Single[];
export declare type FileMatch_Single = boolean | string | RegExp | ((str: string) => boolean);
export declare type MatchCountTarget = number | {
    min?: number;
    max?: number;
};
