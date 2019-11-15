import { Options, ApplyStage } from "./Options";
export declare class CompilationRun {
    chunks: any[];
    chunkEntryPaths_perChunk: number[];
    optimizeModules_chunksReached: number;
}
export declare class WebpackStringReplacer {
    constructor(options: Options);
    options: Options;
    currentRun: CompilationRun;
    ResetCurrentRun(): void;
    InitChunkMetaForChunkIndex(chunkIndex: any): void;
    SourceTransformer_CallFromLoader(source: any, options: any): any;
    stages_cache: ApplyStage[];
    readonly Stages: ApplyStage[];
    apply(compiler: any): void;
    PrepareToApplyRuleToModules(rule: any, modules: any, chunk: any, chunkIndex: any): {
        matchingModules: any;
    };
    ApplyRuleAsSourceTransform(rule: any, moduleSource: any, chunkIndex: any): any;
    VerifyMatchCounts(): void;
}
export default WebpackStringReplacer;
