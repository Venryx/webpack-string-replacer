/*export enum ValidationLogType {
}*/
export type ValidationLogType = "error" | "logError" | "logWarning" | "log";
export class Options {
	constructor(initialProps: Partial<Options>) {
		Object.assign(this, initialProps);
	}

	//validationLogType = ValidationLogType.Error;
	validationLogType?: ValidationLogType = "error";

	ruleBase?: Partial<Rule>;
	replacementBase?: Partial<Replacement>;
	rules = [] as Rule[];
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