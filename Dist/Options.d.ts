export declare class Options {
    constructor(initialProps: Partial<Options>);
    logFileMatches?: boolean;
    logFileMatchContents?: boolean;
    logAroundPatternMatches?: number;
    rules: Rule[];
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
    replacements?: Replacement[];
    compilationIsMatch_perCompilation?: boolean[];
    fileOrOutputFileMatchCounts_perCompilation?: number[];
}
export declare class Replacement {
    pattern: string | RegExp;
    patternMatchCount?: MatchCountTarget;
    replacement: string | ((substring: string, ...args: (string | number)[]) => string);
    fileOrOutputFileMatchCounts_perCompilation?: number[];
}
export declare type ChunkMatch = any;
export declare type FileMatch = FileMatch_Single | FileMatch_Single[];
export declare type FileMatch_Single = boolean | string | RegExp | ((str: string) => boolean);
export declare type MatchCountTarget = number | {
    min?: number;
    max?: number;
};
