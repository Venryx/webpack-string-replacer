import { Options, ApplyStage, Rule, Replacement } from "./Options";
import * as webpack from "webpack";
export declare type Compilation = webpack.compilation.Compilation;
export declare type Module = webpack.compilation.Module;
export declare class CompilationRun {
    compilations: webpack.compilation.Compilation[];
    compilationsCompleted: number;
    ruleMetas: Map<Rule, RuleMeta>;
    GetRuleMeta(rule: Rule, compilationIndex: number): RulePlusCompilationMeta;
    replacementMetas: Map<Replacement, ReplacementMeta>;
    GetReplacementMeta(replacement: Replacement, compilationIndex: number): ReplacementPlusCompilationMeta;
}
export declare class RuleMeta {
    compilationMeta: Map<number, RulePlusCompilationMeta>;
}
export declare class ReplacementMeta {
    compilationMeta: Map<number, ReplacementPlusCompilationMeta>;
}
export declare class RulePlusCompilationMeta {
    compilationIsMatch: any;
    outputFileMatchCount: number;
    fileMatchCount: number;
}
export declare class ReplacementPlusCompilationMeta {
    patternMatchCount: number;
}
export declare class WebpackStringReplacer {
    constructor(options: Options);
    options: Options;
    currentRun: CompilationRun;
    ResetCurrentRun(): void;
    SourceTransformer_CallFromLoader(source: string, options: {
        rulesToApply_indexes: number[];
        compilationIndex: number;
        modulePath: string;
    }): string;
    stages_cache: ApplyStage[];
    get Stages(): ApplyStage[];
    GetRulesForStage(stage: ApplyStage): Rule[];
    apply(compiler: any): void;
    GetModulesWhereRuleShouldBeApplied(rule: Rule, modules: Module[], compilation: Compilation, compilationIndex: number): {
        matchingModules: webpack.compilation.Module[];
    };
    ApplyRuleAsSourceTransform(rule: Rule, moduleSource: string, compilationIndex: number, modulePath: string): string;
    Assert(condition: any, messageOrMessageFunc: string | (() => string)): void;
    ValidateMatchCounts(): void;
}
