import webpack = require("webpack");

/*export enum ValidationLogType {
}*/
export type ValidationLogType = "error" | "logError" | "logWarning" | "log";
export type ShouldValidateData = {compilations: webpack.Compilation[]};
export type ShouldValidateCondition = boolean | ((data: ShouldValidateData)=>boolean);

export class Options {
	constructor(initialProps: Partial<Options>) {
		Object.assign(this, initialProps);
	}

	// todo: find way of defaulting to "on first compile" (or, fix the match-count checking system to work with incremental compiles)
	shouldValidate?: ShouldValidateCondition = true;
	//validationLogType = ValidationLogType.Error;
	validationLogType?: ValidationLogType = "logError"; // actual errors cause "ts-node-dev" to stop recompiling, so default to logError

	ruleBase?: Partial<Rule>;
	replacementBase?: Partial<Replacement>;
	rules = [] as Rule[];

	// user can supply this if they have webpack-string-replacer symlinked, to avoid "instanceof" fail from multiple "webpack" modules
	webpackModule?: typeof webpack;
}

export type ApplyStage = "loader" | "optimizeModules" | "optimizeChunkAssets";
export class Rule {
	//applyStage: ApplyStage;
	applyStage? = "loader" as ApplyStage | "loader" | "optimizeModules" | "optimizeChunkAssets";
	chunkInclude? = true as ChunkMatch;
	chunkExclude? = false as ChunkMatch;
	chunkMatchCount?: MatchCountTarget;

	outputFileInclude? = true as FileMatch;
	outputFileExclude? = false as FileMatch;
	outputFileMatchCount?: MatchCountTarget;

	fileInclude? = true as FileMatch;
	fileExclude? = false as FileMatch;
	fileMatchCount?: MatchCountTarget;
	logFileMatches? = false;
	logFileMatchContents?: boolean | number = false;

	replacements? = [] as Replacement[];
}

export class Replacement {
	pattern: string | RegExp;
	patternMatchCount?: MatchCountTarget;
	logAroundPatternMatches? = null as number;
	replacement: string | ((substring: string, ...args: (string | number)[])=>string);
}

export type ChunkMatch = any;
export type FileMatch = FileMatch_Single | FileMatch_Single[];
export type FileMatch_Single = boolean | string | RegExp | ((str: string)=>boolean);
export type MatchCountTarget = number | {min?: number, max?: number}