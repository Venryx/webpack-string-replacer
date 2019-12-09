export class Options {
	constructor(initialProps: Partial<Options>) {
		Object.assign(this, initialProps);
	}

	logAroundPatternMatches? = null as number; // todo: make a rule option

	ruleBase?: Partial<Rule>;
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
	logFileMatchContents? = false;

	replacements? = [] as Replacement[];

	// internal metadata
	compilationIsMatch_perCompilation?: boolean[];
	fileOrOutputFileMatchCounts_perCompilation?: number[];
}

export class Replacement {
	pattern: string | RegExp;
	patternMatchCount?: MatchCountTarget;
	replacement: string | ((substring: string, ...args: (string | number)[])=>string);

	// internal metadata
	fileOrOutputFileMatchCounts_perCompilation?: number[];
}

export type ChunkMatch = any;
export type FileMatch = FileMatch_Single | FileMatch_Single[];
export type FileMatch_Single = boolean | string | RegExp | ((str: string)=>boolean);
export type MatchCountTarget = number | {min?: number, max?: number}