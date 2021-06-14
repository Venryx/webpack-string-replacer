"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WebpackStringReplacer = exports.ReplacementPlusCompilationMeta = exports.RulePlusCompilationMeta = exports.ReplacementMeta = exports.RuleMeta = exports.CompilationRun = void 0;
// @ts-check_disabled
const path = require("path");
const Utils_1 = require("./Utils");
const Options_1 = require("./Options");
const webpack_sources_1 = require("webpack-sources");
const webpack_1 = require("webpack");
class CompilationRun {
    constructor() {
        this.compilations = [];
        //chunkEntryPaths_perChunk = [] as number[];
        this.compilationsCompleted = 0;
        this.ruleMetas = new Map();
        this.replacementMetas = new Map();
    }
    GetRuleMeta(rule, compilationIndex) {
        if (!this.ruleMetas.has(rule))
            this.ruleMetas.set(rule, new RuleMeta());
        let ruleMeta = this.ruleMetas.get(rule);
        if (!ruleMeta.compilationMeta.has(compilationIndex))
            ruleMeta.compilationMeta.set(compilationIndex, new RulePlusCompilationMeta());
        return ruleMeta.compilationMeta.get(compilationIndex);
    }
    GetReplacementMeta(replacement, compilationIndex) {
        if (!this.replacementMetas.has(replacement))
            this.replacementMetas.set(replacement, new ReplacementMeta());
        let replacementMeta = this.replacementMetas.get(replacement);
        if (!replacementMeta.compilationMeta.has(compilationIndex))
            replacementMeta.compilationMeta.set(compilationIndex, new ReplacementPlusCompilationMeta());
        return replacementMeta.compilationMeta.get(compilationIndex);
    }
}
exports.CompilationRun = CompilationRun;
class RuleMeta {
    constructor() {
        this.compilationMeta = new Map();
    }
}
exports.RuleMeta = RuleMeta;
class ReplacementMeta {
    constructor() {
        this.compilationMeta = new Map();
    }
}
exports.ReplacementMeta = ReplacementMeta;
class RulePlusCompilationMeta {
    constructor() {
        //compilationIsMatch = false;
        this.compilationIsMatch = null;
        this.outputFileMatchCount = 0;
        this.fileMatchCount = 0;
    }
}
exports.RulePlusCompilationMeta = RulePlusCompilationMeta;
class ReplacementPlusCompilationMeta {
    constructor() {
        this.patternMatchCount = 0;
    }
}
exports.ReplacementPlusCompilationMeta = ReplacementPlusCompilationMeta;
/*
term descriptions
==========
compilation: TODO
compilation-run: TODO
chunk: TODO
*/
const packageName = "webpack-string-replacer";
class WebpackStringReplacer {
    //static instance;
    constructor(options) {
        options = new Options_1.Options(options);
        WebpackStringReplacer["instance"] = this;
        for (let [ruleIndex, rule] of options.rules.entries()) {
            // apply options from Rule-class default-values, and ruleBase
            rule = Object.assign(new Options_1.Rule(), options.ruleBase, rule);
            for (let [replacementIndex, replacement] of rule.replacements.entries()) {
                replacement = Object.assign(new Options_1.Replacement(), options.replacementBase, replacement);
                rule.replacements[replacementIndex] = replacement;
            }
            options.rules[ruleIndex] = rule;
        }
        this.options = options;
    }
    // Note: For compilation-runs with more than one chunk, the execution order is as follows:
    // 	b1.compilation, b2.compilation, [many calls to normalModuleLoader for all chunks], b1.optimizeModules, b1.afterCompile, b2.optimizeModules, b2.afterCompile
    // The "compilation run state" below helps keep track of those executions, so we can figure out the chunk-count. (and thus when the compilation-run is fully over)
    ResetCurrentRun() {
        Utils_1.Log("Resetting");
        this.currentRun = new CompilationRun();
    }
    // now set up the WebpackStringReplacer.instance.SourceTransformer_CallFromLoader function (for the loader to call)
    SourceTransformer_CallFromLoader(source, options) {
        // some loaders botch the options-passing, so re-parse it if needed
        if (typeof options == "string") {
            let optionsStr = options;
            try {
                let json = optionsStr.slice(optionsStr.indexOf("{"), optionsStr.lastIndexOf("}") + 1);
                options = JSON.parse(json);
            }
            catch (ex) {
                //console.error(`
                throw new Error(`
					The options object for webpack-plugin-string-replace was mangled by an earlier-running loader. Please update/remove/fix the other loader.
					Options string: ${optionsStr}
					Error: ${ex}
				`.trim());
            }
        }
        //Log("Loader called with:", source);
        const { rulesToApply_indexes, compilationIndex, modulePath } = options;
        const rulesToApply = rulesToApply_indexes.map(index => this.options.rules[index]);
        for (let rule of rulesToApply) {
            source = this.ApplyRuleAsSourceTransform(rule, source, compilationIndex, modulePath);
        }
        return source;
    }
    get Stages() {
        if (this.stages_cache == null) {
            this.stages_cache = Utils_1.Distinct(this.options.rules.map(a => a.applyStage));
        }
        return this.stages_cache;
    }
    GetRulesForStage(stage) {
        return this.options.rules.filter(a => a.applyStage == stage);
    }
    apply(compiler) {
        const opt = this.options;
        this.ResetCurrentRun(); // reset for first run
        compiler.hooks.compilation.tap(packageName, (compilation, compilationParams) => {
            this.currentRun.compilations.push(compilation);
            const compilationIndex = this.currentRun.compilations.length - 1;
            // stage 1 (if apply-stage early): insert our transformer-loader for each file for which a rule applies; the transformer will soon be called, applying the rules
            if (this.Stages.includes("loader")) {
                //compilation.hooks.normalModuleLoader.tap(packageName, (loaderContext: webpack.loader.LoaderContext, mod)=> {
                webpack_1.NormalModule.getCompilationHooks(compilation).loader.tap(packageName, (loaderContext, mod) => {
                    if (loaderContext._compilation != compilation)
                        throw new Error("LoaderContext and chunk out of sync.");
                    let rulesToApply = this.GetRulesForStage("loader").filter(rule => {
                        return this.GetModulesWhereRuleShouldBeApplied(rule, [mod], compilation, compilationIndex).matchingModules.length == 1;
                    });
                    if (rulesToApply.length == 0)
                        return;
                    const rulesToApply_indexes = rulesToApply.map(rule => this.options.rules.indexOf(rule));
                    //if (loaderContext.loaders == null) { // @types/webpack says it's on loaderContext, but runtime says no; types must be outdated
                    let modulePath = Utils_1.GetModuleResourcePath(mod);
                    if (mod["loaders"] == null) {
                        //mod["loaders"] = [];
                        Utils_1.Log(`LoaderStage: Ignoring file at path "${modulePath}", since it has no other loaders. (intercepting may break some other plugins, eg. html-webpack-plugin)`);
                        return;
                    }
                    //Log("Setting up loader:", Object.keys(mod).join(","), ";", Object.keys(loaderContext).join(","), ";", mod["loaders"].length);
                    //Log(`Setting up loader. @modPath(${modulePath}}`);
                    //loaderContext.loaders.push({ // @types/webpack says it's on loaderContext, but runtime says no; types must be outdated
                    //mod["loaders"].unshift({
                    mod["loaders"].push({
                        type: null,
                        //ident: "webpack-string-replacer_Loader.js",
                        ident: null,
                        loader: path.resolve(__dirname, 'Loader.js'),
                        options: { rulesToApply_indexes, compilationIndex, modulePath },
                    });
                });
            }
            // stage 2 (if apply-stage mid): wait for last chunk to be done optimizing-modules, then apply rules
            if (this.Stages.includes("optimizeModules")) {
                throw new Error(`Plugin has not yet been updated to support "optimizeModules"-stage-replacements in Webpack 5.`);
                /*compilation.hooks.optimizeModules.tap(packageName, modules=> {
                    /*let chunk = this.currentRun.chunks.find(a=>a.modules == modules);
                    if (chunk == null) throw new Error("Failed to find chunk for module-list in OnOptimizeModules.");
                    this.currentRun.optimizeModules_chunksReached.push(chunk);
                    let isLastChunk = this.currentRun.optimizeModules_chunksReached.length == this.currentRun.chunks.length;*#/
                    
                    for (let rule of this.GetRulesForStage("optimizeModules")) {
                        let {matchingModules} = this.GetModulesWhereRuleShouldBeApplied(rule, Array.from(modules), compilation, compilationIndex);
                        for (let mod of matchingModules) {
                            SetModuleSource(mod, this.ApplyRuleAsSourceTransform(rule, GetModuleSource(mod), compilationIndex, GetModuleResourcePath(mod)));
                        }
                    }
                });*/
            }
            // stage 3 (if apply-stage late)
            if (this.Stages.includes("optimizeChunkAssets")) {
                compilation.hooks.optimizeChunkAssets.tap(packageName, chunks => {
                    //Log("Chunks files:", chunks);
                    for (let [ruleIndex, rule] of this.GetRulesForStage("optimizeChunkAssets").entries()) {
                        let ruleMeta = this.currentRun.GetRuleMeta(rule, compilationIndex);
                        const chunkIncludeFuncs = Utils_1.ToArray(rule.chunkInclude).map(Utils_1.ChunkMatchToFunction);
                        const chunkExcludeFuncs = Utils_1.ToArray(rule.chunkExclude).map(Utils_1.ChunkMatchToFunction);
                        const outputFileIncludeFuncs = Utils_1.ToArray(rule.outputFileInclude).map(Utils_1.FileMatchToFunction);
                        const outputFileExcludeFuncs = Utils_1.ToArray(rule.outputFileExclude).map(Utils_1.FileMatchToFunction);
                        function GetAllIndexes(str, searchStr) {
                            let i = -1;
                            const indices = [];
                            while ((i = str.indexOf(searchStr, i + 1)) !== -1) {
                                indices.push(i);
                            }
                            return indices;
                        }
                        for (let [chunkIndex, chunk] of chunks.entries()) {
                            const allChunksInside = [
                                ...chunk.getAllAsyncChunks(),
                                ...chunk.getAllInitialChunks(),
                                ...chunk.getAllReferencedChunks(),
                            ];
                            const chunkInfo = {
                                index: chunkIndex,
                                //definedChunkNames: [chunk.name].concat((chunk.entries || []).map(a=>a.name))
                                definedChunkNames: Array.from(new Set([chunk.name, ...allChunksInside.map(a => a.name)])),
                            };
                            ruleMeta.compilationIsMatch = false;
                            if (!Utils_1.SomeFuncsMatch(chunkIncludeFuncs, chunkInfo))
                                continue; // if chunk not included by rule, doesn't match
                            if (Utils_1.SomeFuncsMatch(chunkExcludeFuncs, chunkInfo))
                                continue; // if chunk excluded by rule, doesn't match
                            ruleMeta.compilationIsMatch = true;
                            //const matchingFiles = chunk.files.filter(file=> {})
                            for (let [fileIndex, file] of chunk.files.entries()) {
                                if (!Utils_1.SomeFuncsMatch(outputFileIncludeFuncs, file))
                                    continue; // if output-file not included by rule, doesn't match
                                if (Utils_1.SomeFuncsMatch(outputFileExcludeFuncs, file))
                                    continue; // if output-file excluded by rule, doesn't match
                                ruleMeta.outputFileMatchCount++;
                                const originalSource = compilation.assets[file];
                                if (rule.logFileMatches || rule.logFileMatchContents) {
                                    Utils_1.Log(`Found output-file match. @rule(${ruleIndex}) @file:` + file);
                                    if (rule.logFileMatchContents) {
                                        Utils_1.Log(`Contents:\n==========\n${Utils_1.Slice_NumberOrBool(originalSource.source(), rule.logFileMatchContents)}\n==========\n`);
                                    }
                                }
                                let newSource;
                                for (let replacement of rule.replacements) {
                                    let replacementMeta = this.currentRun.GetReplacementMeta(replacement, compilationIndex);
                                    if (!Utils_1.IsString(replacement.pattern))
                                        throw new Error("Only string patterns are allowed for optimizeChunkAssets stage currently. (will fix later)");
                                    let patternStr = replacement.pattern;
                                    const matchIndexes = GetAllIndexes(originalSource.source(), patternStr);
                                    if (!matchIndexes.length)
                                        continue;
                                    if (!newSource) {
                                        newSource = new webpack_sources_1.ReplaceSource(originalSource);
                                    }
                                    matchIndexes.forEach((startPos) => {
                                        const endPos = startPos + patternStr.length - 1;
                                        //Log("Replacing;", startPos, ";", endPos);
                                        newSource.replace(startPos, endPos, replacement.replacement);
                                    });
                                    replacementMeta.patternMatchCount += matchIndexes.length;
                                }
                                if (newSource) {
                                    /*let newFileName = "new_" + file;
                                    compilation.assets[newFileName] = newSource;
                                    Log("Adding new source:", newFileName, ";Size:", newSource.size());
                                    chunk.files[fileIndex] = newFileName;*/
                                    compilation.assets[file] = newSource;
                                }
                            }
                        }
                    }
                });
            }
            // stage 4: detect when compilation is truly finished, then verify match counts, then reset for next run
            compilation.hooks.afterOptimizeChunkAssets.tap(packageName, chunks => {
                this.currentRun.compilationsCompleted++;
                // if we just finished applying the rules for the last chunk, the compilation-run is complete
                let isLastCompilation = this.currentRun.compilationsCompleted == this.currentRun.compilations.length;
                // if the compilation run is complete, and the should-validate condition passes, validate the match counts
                if (isLastCompilation && Utils_1.ShouldValidate(this.options.shouldValidate, { compilations: this.currentRun.compilations })) {
                    this.ValidateMatchCounts();
                    this.ResetCurrentRun(); // reset for next run
                }
            });
        });
    }
    GetModulesWhereRuleShouldBeApplied(rule, modules, compilation, compilationIndex) {
        const ruleMeta = this.currentRun.GetRuleMeta(rule, compilationIndex);
        // todo: fix that we are treating compilations as if they were chunks!
        if (ruleMeta.compilationIsMatch == null) {
            const chunkIncludeFuncs = Utils_1.ToArray(rule.chunkInclude).map(Utils_1.ChunkMatchToFunction);
            const chunkExcludeFuncs = Utils_1.ToArray(rule.chunkExclude).map(Utils_1.ChunkMatchToFunction);
            const chunkInfo = {
                index: compilationIndex,
                //definedChunkNames: [compilation["name"]].concat((compilation.entries || []).map(a=>a.name)),
                //definedChunkNames: [compilation["name"]].concat(Array.from(compilation.entries.keys())),
                definedChunkNames: [compilation["name"]].concat(Array.from(compilation.chunks).map(a => a.name)),
            };
            ruleMeta.compilationIsMatch = Utils_1.SomeFuncsMatch(chunkIncludeFuncs, chunkInfo) && !Utils_1.SomeFuncsMatch(chunkExcludeFuncs, chunkInfo);
        }
        if (!ruleMeta.compilationIsMatch)
            return null;
        const fileIncludeFuncs = Utils_1.ToArray(rule.fileInclude).map(Utils_1.FileMatchToFunction);
        const fileExcludeFuncs = Utils_1.ToArray(rule.fileExclude).map(Utils_1.FileMatchToFunction);
        const matchingModules = modules.filter(mod => {
            let modulePath = Utils_1.GetModuleResourcePath(mod);
            if (modulePath == null)
                return false; // if module has no resource, doesn't match
            modulePath = modulePath.replace(/\\/g, "/"); // normalize path to have "/" separators
            /*if (!SomeFuncsMatch(chunkIncludeFuncs, chunkInfo)) return false; // if chunk not included by rule, doesn't match
            if (SomeFuncsMatch(chunkExcludeFuncs, chunkInfo)) return false; // if chunk excluded by rule, doesn't match*/
            if (!Utils_1.SomeFuncsMatch(fileIncludeFuncs, modulePath))
                return false; // if module not included by rule, doesn't match
            if (Utils_1.SomeFuncsMatch(fileExcludeFuncs, modulePath))
                return false; // if module excluded by rule, doesn't match
            /*if (rule.logFileMatches || rule.logFileMatchContents) {
                Log(`Found file match. @rule(${this.options.rules.indexOf(rule)}) @path:` + modulePath);
            }*/
            return true;
        });
        // for a given rule, this function gets called for every module (if applying at loader phase), thus we have to increment, not set
        ruleMeta.fileMatchCount += matchingModules.length;
        return { matchingModules };
    }
    ApplyRuleAsSourceTransform(rule, moduleSource, compilationIndex, modulePath) {
        // do the logging here (instead of PrepareToApplyRuleToModules), because if using apply-stage "loader", the source isn't accessible when Prepare... is called
        if (rule.logFileMatches || rule.logFileMatchContents) {
            Utils_1.Log(`Found file match. @rule(${this.options.rules.indexOf(rule)}) @path:` + modulePath);
            if (rule.logFileMatchContents) {
                //console.dir(mod);
                //Log(`Contents:\n==========\n${GetModuleSource(mod).slice(0, rule.logFileMatchContents)}\n==========\n`);
                Utils_1.Log(`Contents:\n==========\n${Utils_1.Slice_NumberOrBool(moduleSource, rule.logFileMatchContents)}\n==========\n`);
            }
        }
        let result = moduleSource;
        //Log("Length:" + moduleSource.length);
        for (let replacement of rule.replacements) {
            let replacementMeta = this.currentRun.GetReplacementMeta(replacement, compilationIndex);
            let patternMatchCount = 0;
            let pattern_asRegex = Utils_1.ToRegex(replacement.pattern);
            if (!pattern_asRegex.global) {
                //throw new Error("Regex must have the 'g' flag added. (otherwise it will only have one match!)");
                pattern_asRegex = new RegExp(pattern_asRegex.source, "g" + pattern_asRegex.flags);
            }
            if (replacement.logAroundPatternMatches != null) {
                let matches = [];
                let match;
                while (match = pattern_asRegex.exec(result)) {
                    //if (matches.length && match.index == matches[matches.length - 1].index) break;
                    matches.push(match);
                }
                pattern_asRegex.lastIndex = 0; // reset, so that result.replace call succeeds
                for (let match of matches) {
                    let sectionToLog = result.slice(Math.max(0, match.index - replacement.logAroundPatternMatches), Math.min(result.length, match.index + match[0].length + replacement.logAroundPatternMatches));
                    Utils_1.Log(`Logging text around pattern match:\n==========\n${sectionToLog}\n==========\n`);
                }
            }
            result = result.replace(pattern_asRegex, (substring, ...args) => {
                patternMatchCount++;
                if (Utils_1.IsString(replacement.replacement))
                    return replacement.replacement;
                if (Utils_1.IsFunction(replacement.replacement))
                    return replacement.replacement(substring, ...args);
                throw new Error("Rule.replacement must be a string or function.");
            });
            //replacement.fileMatchCounts_perChunk[chunkIndex] = (replacement.fileMatchCounts_perChunk[chunkIndex]|0) + patternMatchCount;
            //this.currentRun.chunkMeta[chunkIndex].ruleMeta[ruleIndex].replacementMeta[replacementIndex].
            replacementMeta.patternMatchCount += patternMatchCount;
        }
        return result;
    }
    Assert(condition, messageOrMessageFunc) {
        if (condition)
            return;
        let message = Utils_1.IsString(messageOrMessageFunc) ? messageOrMessageFunc : messageOrMessageFunc();
        let logType = this.options.validationLogType;
        //if (logType == "error") throw new Error("\n" + message); // commented; asserts don't need new-line, since they already have one added
        if (logType == "error")
            throw new Error(message);
        else if (logType == "logError")
            console.error(message);
        else if (logType == "logWarning")
            console.warn(message);
        else if (logType == "log")
            console.log(message);
        else
            throw new Error(`Invalid validationLogType: ${logType}`);
    }
    ValidateMatchCounts() {
        Utils_1.Log(`Verifying match counts... @compilations(${this.currentRun.compilations.length}) @rules(${this.options.rules.length})`);
        for (let [ruleIndex, rule] of this.options.rules.entries()) {
            let ruleMeta = this.currentRun.ruleMetas.get(rule) || new RuleMeta();
            let ruleCompilationMetas = this.currentRun.compilations.map((c, index) => ruleMeta.compilationMeta.get(index) || new RulePlusCompilationMeta());
            this.Assert(Utils_1.IsMatchCountCorrect(ruleCompilationMetas.filter(a => a.compilationIsMatch).length, rule.chunkMatchCount), `
				A rule did not have as many chunk-matches as it should have.
				Rule: #${ruleIndex} @include(${rule.fileInclude}) @exclude(${rule.fileExclude})
				Chunk-is-match (per compilation): [${ruleCompilationMetas.map(a => a.compilationIsMatch)}] @target(${JSON.stringify(rule.chunkMatchCount)})

				Ensure you have the correct versions for any npm modules involved.
			`);
            this.Assert(ruleCompilationMetas.find(a => Utils_1.IsMatchCountCorrect(a.outputFileMatchCount, rule.outputFileMatchCount)), `
				A rule did not have as many output-file-matches as it should have (in any compilation).
				Rule: #${ruleIndex} @include(${rule.outputFileInclude}) @exclude(${rule.outputFileExclude})
				Match counts (per compilation): [${ruleCompilationMetas.map(a => a.outputFileMatchCount)}] @target(${JSON.stringify(rule.outputFileMatchCount)})

				Ensure you have the correct versions for any npm modules involved.
			`);
            this.Assert(ruleCompilationMetas.find(a => Utils_1.IsMatchCountCorrect(a.fileMatchCount, rule.fileMatchCount)), `
				A rule did not have as many file-matches as it should have (in any compilation).
				Rule: #${ruleIndex} @include(${rule.fileInclude}) @exclude(${rule.fileExclude})
				Match counts (per compilation): [${ruleCompilationMetas.map(a => a.fileMatchCount)}] @target(${JSON.stringify(rule.fileMatchCount)})

				Ensure you have the correct versions for any npm modules involved.
			`);
            for (let [index, replacement] of rule.replacements.entries()) {
                let replacementMeta = this.currentRun.replacementMetas.get(replacement) || new ReplacementMeta();
                let replacementCompilationMetas = this.currentRun.compilations.map((c, index) => replacementMeta.compilationMeta.get(index) || new ReplacementPlusCompilationMeta());
                //console.log(`Checking replacement. @rule(${ruleIndex}) @replacement(${index}) @target(${replacement.patternMatchCount}) @actual(${replacementCompilationMetas.map(a=>a.patternMatchCount)})`);
                this.Assert(replacementCompilationMetas.find(a => Utils_1.IsMatchCountCorrect(a.patternMatchCount, replacement.patternMatchCount)), `
					A string-replacement pattern did not have as many matches as it should have (in any compilation).
					Rule: #${ruleIndex} @include(${rule.fileInclude}) @exclude(${rule.fileExclude})
					Replacement: #${index} @pattern(${replacement.pattern})
					Match counts (per compilation): [${replacementCompilationMetas.map(a => a.patternMatchCount)}] @target(${JSON.stringify(replacement.patternMatchCount)})

					Ensure you have the correct versions for any npm modules involved.
				`);
            }
        }
    }
    ;
}
exports.WebpackStringReplacer = WebpackStringReplacer;
//# sourceMappingURL=WebpackStringReplacer.js.map