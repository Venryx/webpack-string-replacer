export class Options {
	constructor(initialProps: Partial<Options>) {
		Object.assign(this, initialProps);
	}

	logFileMatches = false;
	logFileMatchContents = false;
	logAroundPatternMatches = null as number;

	rules = [] as Rule[];
}

export class Rule {
	applyStage: ApplyStage;
	chunkInclude: ChunkMatch;
	chunkExclude: ChunkMatch;
	chunkMatchCount: MatchCountTarget;

	outputFileInclude: FileMatch;
	outputFileExclude: FileMatch;
	outputFileMatchCount: MatchCountTarget;

	fileInclude: FileMatch;
	fileExclude: FileMatch;
	fileMatchCount: MatchCountTarget;

	replacements: Replacement[];

	// internal metadata
	chunkIsMatch_perChunk: boolean[];
	fileMatchCounts_perChunk: number[];
}
export type ApplyStage = "loader" | "optimizeModules" | "optimizeChunkAssets";

export class Replacement {
	pattern: string | RegExp;
	patternMatchCount: MatchCountTarget;
	replacement: string | ((substring: string, ...args: (string | number)[])=>string);

	// internal metadata
	fileMatchCounts_perChunk: number[];
}

export type ChunkMatch = any;
export type FileMatch = FileMatch_Single | FileMatch_Single[];
export type FileMatch_Single = boolean | string | RegExp | ((str: string)=>boolean);
export type MatchCountTarget = number | {min?: number, max?: number}