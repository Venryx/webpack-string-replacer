import { Options, ApplyStage, Rule } from "./Options";
import webpack from "webpack";
export declare type Compilation = webpack.compilation.Compilation;
export declare type Module = webpack.compilation.Module;
export declare class CompilationRun {
    compilations: webpack.compilation.Compilation[];
    compilationsCompleted: number;
}
export declare class WebpackStringReplacer {
    constructor(options: Options);
    options: Options;
    currentRun: CompilationRun;
    ResetCurrentRun(): void;
    InitCompilationMetaForCompilationIndex(compilationIndex: number): void;
    SourceTransformer_CallFromLoader(source: string, options: any): string;
    stages_cache: ApplyStage[];
    get Stages(): ApplyStage[];
    apply(compiler: any): void;
    PrepareToApplyRuleToModules(rule: Rule, modules: Module[], compilation: Compilation, compilationIndex: number): {
        matchingModules: webpack.compilation.Module[];
    };
    ApplyRuleAsSourceTransform(rule: Rule, moduleSource: string, compilationIndex: number): string;
    VerifyMatchCounts(): void;
}
