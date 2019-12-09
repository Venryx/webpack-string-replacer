"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// @ts-check_disabled
const path_1 = require("path");
const Utils_1 = require("./Utils");
const Options_1 = require("./Options");
const webpack_sources_1 = require("webpack-sources");
class CompilationRun {
    constructor() {
        this.compilations = [];
        //chunkEntryPaths_perChunk = [] as number[];
        this.compilationsCompleted = 0;
    }
}
exports.CompilationRun = CompilationRun;
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
        WebpackStringReplacer["instance"] = this;
        for (let [index, rule] of options.rules.entries()) {
            // normalize rule props
            rule = Object.assign(new Options_1.Rule(), rule);
            options.rules[index] = rule;
        }
        this.options = options;
    }
    // Note: For compilation-runs with more than one chunk, the execution order is as follows:
    // 	b1.compilation, b2.compilation, [many calls to normalModuleLoader for all chunks], b1.optimizeModules, b1.afterCompile, b2.optimizeModules, b2.afterCompile
    // The "compilation run state" below helps keep track of those executions, so we can figure out the chunk-count. (and thus when the compilation-run is fully over)
    ResetCurrentRun() {
        console.log("Resetting");
        this.currentRun = {
            compilations: [],
            //chunkEntryPaths_perChunk: [],
            //chunkMeta: [],
            compilationsCompleted: 0,
        };
        // just store on objects under options
        for (let rule of this.options.rules) {
            rule.compilationIsMatch_perCompilation = [];
            rule.fileOrOutputFileMatchCounts_perCompilation = [];
            for (let replacement of rule.replacements) {
                replacement.fileOrOutputFileMatchCounts_perCompilation = [];
            }
        }
    }
    InitCompilationMetaForCompilationIndex(compilationIndex) {
        //this.currentRun.chunkMeta[compilationIndex] = {}
        for (let rule of this.options.rules) {
            rule.compilationIsMatch_perCompilation[compilationIndex] = null;
            rule.fileOrOutputFileMatchCounts_perCompilation[compilationIndex] = 0;
            for (let replacement of rule.replacements) {
                replacement.fileOrOutputFileMatchCounts_perCompilation[compilationIndex] = 0;
            }
        }
    }
    // now set up the WebpackStringReplacer.instance.SourceTransformer_CallFromLoader function (for the loader to call)
    SourceTransformer_CallFromLoader(source, options) {
        // some loaders botch the options-passing, so re-parse it if needed
        if (typeof options == "string") {
            try {
                let json = options.slice(options.indexOf("{"), options.lastIndexOf("}") + 1);
                options = JSON.parse(json);
            }
            catch (ex) {
                //console.error(`
                throw new Error(`
					The options object for webpack-plugin-string-replace was mangled by an earlier-running loader. Please update/remove/fix the other loader.
					Options string: ${options}
					Error: ${ex}
				`.trim());
            }
        }
        let { rulesToApply_indexes, chunkIndex } = options;
        const rulesToApply = rulesToApply_indexes.map(index => this.options.rules[index]);
        for (let rule of rulesToApply) {
            source = this.ApplyRuleAsSourceTransform(rule, source, chunkIndex);
        }
        return source;
    }
    get Stages() {
        if (this.stages_cache == null) {
            this.stages_cache = Utils_1.Distinct(this.options.rules.map(a => a.applyStage));
        }
        return this.stages_cache;
    }
    apply(compiler) {
        const opt = this.options;
        this.ResetCurrentRun(); // reset for first run
        compiler.hooks.compilation.tap(packageName, (compilation, compilationParams) => {
            this.currentRun.compilations.push(compilation);
            const compilationIndex = this.currentRun.compilations.length - 1;
            this.InitCompilationMetaForCompilationIndex(compilationIndex);
            // stage 1 (if apply-stage early/mid): insert our transformer-loader for each file for which a rule applies; the transformer will soon be called, applying the rules
            if (this.Stages.includes("loader") || this.Stages.includes("optimizeModules")) {
                compilation.hooks.normalModuleLoader.tap(packageName, (loaderContext, mod) => {
                    if (loaderContext._compilation != compilation)
                        throw new Error("LoaderContext and chunk out of sync.");
                    let rulesToApply = this.options.rules.filter(rule => this.PrepareToApplyRuleToModules(rule, [mod], compilation, compilationIndex) != null);
                    if (rulesToApply.length == 0)
                        return;
                    const rulesToApply_indexes = rulesToApply.map(rule => this.options.rules.indexOf(rule));
                    //if (mod["loaders"] == null) return; // if no other loader is set to load it, we probably shouldn't either
                    if (loaderContext.loaders == null)
                        return; // if no other loader is set to load it, we probably shouldn't either
                    //console.log("Setting up loader:" + Object.keys(mod).join(",") + ";", mod.loaders.length);
                    //mod["loaders"].push({
                    loaderContext.loaders.push({
                        //mod.loaders.unshift({
                        loader: path_1.default.resolve(__dirname, 'Loader.js'),
                        options: { rulesToApply_indexes, compilationIndex },
                    });
                });
            }
            // stage 2 (if apply-stage early/mid): wait for last chunk to be done optimizing-modules, apply rules (if apply-stage is optimizeModules), then run the VerifyMatchCounts function
            if (this.Stages.includes("loader") || this.Stages.includes("optimizeModules")) {
                compilation.hooks.optimizeModules.tap(packageName, modules => {
                    if (this.Stages.includes("optimizeModules")) {
                        /*let chunk = this.currentRun.chunks.find(a=>a.modules == modules);
                        if (chunk == null) throw new Error("Failed to find chunk for module-list in OnOptimizeModules.");
                        this.currentRun.optimizeModules_chunksReached.push(chunk);
                        let isLastChunk = this.currentRun.optimizeModules_chunksReached.length == this.currentRun.chunks.length;*/
                        for (let rule of this.options.rules) {
                            let { matchingModules } = this.PrepareToApplyRuleToModules(rule, modules, compilation, compilationIndex);
                            for (let mod of matchingModules) {
                                const sourceText = mod._source._value;
                                mod._source._value = this.ApplyRuleAsSourceTransform(rule, sourceText, compilationIndex);
                            }
                        }
                    }
                });
            }
            // stage 3 (if apply-stage late)
            if (this.Stages.includes("optimizeChunkAssets")) {
                compilation.plugin('optimize-chunk-assets', (chunks, callback) => {
                    //console.log("Chunks files:", chunks);
                    for (let [ruleIndex, rule] of opt.rules.entries()) {
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
                            const chunkInfo = {
                                index: chunkIndex,
                                definedChunkNames: [chunk.name].concat((chunk.entries || []).map(a => a.name))
                            };
                            rule.compilationIsMatch_perCompilation[compilationIndex] = false;
                            if (!Utils_1.SomeFuncsMatch(chunkIncludeFuncs, chunkInfo))
                                continue; // if chunk not included by rule, doesn't match
                            if (Utils_1.SomeFuncsMatch(chunkExcludeFuncs, chunkInfo))
                                continue; // if chunk excluded by rule, doesn't match
                            rule.compilationIsMatch_perCompilation[compilationIndex] = true;
                            //const matchingFiles = chunk.files.filter(file=> {})
                            for (let [fileIndex, file] of chunk.files.entries()) {
                                if (!Utils_1.SomeFuncsMatch(outputFileIncludeFuncs, file))
                                    continue; // if output-file not included by rule, doesn't match
                                if (Utils_1.SomeFuncsMatch(outputFileExcludeFuncs, file))
                                    continue; // if output-file excluded by rule, doesn't match
                                rule.fileOrOutputFileMatchCounts_perCompilation[compilationIndex]++;
                                const originalSource = compilation.assets[file];
                                if (this.options.logFileMatches || this.options.logFileMatchContents) {
                                    console.log(`Found output-file match. @rule(${ruleIndex}) @file:` + file);
                                    if (this.options.logFileMatchContents) {
                                        console.log(`Contents:\n==========\n${originalSource.source().slice(0, this.options.logFileMatchContents)}\n==========\n`);
                                    }
                                }
                                let newSource;
                                for (let entry of rule.replacements) {
                                    if (!Utils_1.IsString(entry.pattern))
                                        throw new Error("Only string patterns are allowed for optimizeChunkAssets stage currently. (will fix later)");
                                    let patternStr = entry.pattern;
                                    const matchIndexes = GetAllIndexes(originalSource.source(), patternStr);
                                    if (!matchIndexes.length)
                                        continue;
                                    if (!newSource) {
                                        newSource = new webpack_sources_1.ReplaceSource(originalSource);
                                    }
                                    matchIndexes.forEach((startPos) => {
                                        const endPos = startPos + patternStr.length - 1;
                                        //console.log("Replacing;", startPos, ";", endPos);
                                        newSource.replace(startPos, endPos, entry.replacement);
                                    });
                                    entry.fileOrOutputFileMatchCounts_perCompilation[compilationIndex] += matchIndexes.length;
                                }
                                if (newSource) {
                                    /*let newFileName = "new_" + file;
                                    compilation.assets[newFileName] = newSource;
                                    console.log("Adding new source:", newFileName, ";Size:", newSource.size());
                                    chunk.files[fileIndex] = newFileName;*/
                                    compilation.assets[file] = newSource;
                                }
                            }
                        }
                    }
                    callback();
                });
            }
            // stage 4: detect when compilation is truly finished, then verify match counts, then reset for next run
            compilation.hooks.afterOptimizeChunkAssets.tap(packageName, (chunks, callback) => {
                this.currentRun.compilationsCompleted++;
                // if we just finished applying the rules for the last chunk, the compilation-run is complete
                let isLastCompilation = this.currentRun.compilationsCompleted == this.currentRun.compilations.length;
                // if the compilation run is complete, verify the match counts
                if (isLastCompilation) {
                    this.VerifyMatchCounts();
                    this.ResetCurrentRun(); // reset for next run
                }
            });
        });
    }
    PrepareToApplyRuleToModules(rule, modules, compilation, compilationIndex) {
        const ruleIndex = this.options.rules.indexOf(rule);
        // todo: fix that we are treating compilations as if they were chunks!
        let chunkIsMatch = rule.compilationIsMatch_perCompilation[compilationIndex];
        if (chunkIsMatch == null) {
            const chunkIncludeFuncs = Utils_1.ToArray(rule.chunkInclude).map(Utils_1.ChunkMatchToFunction);
            const chunkExcludeFuncs = Utils_1.ToArray(rule.chunkExclude).map(Utils_1.ChunkMatchToFunction);
            const chunkInfo = {
                index: compilationIndex,
                definedChunkNames: [compilation["name"]].concat((compilation.entries || []).map(a => a.name)),
            };
            chunkIsMatch = Utils_1.SomeFuncsMatch(chunkIncludeFuncs, chunkInfo) && !Utils_1.SomeFuncsMatch(chunkExcludeFuncs, chunkInfo);
            rule.compilationIsMatch_perCompilation[compilationIndex] = chunkIsMatch;
        }
        if (!chunkIsMatch)
            return null;
        const fileIncludeFuncs = Utils_1.ToArray(rule.fileInclude).map(Utils_1.FileMatchToFunction);
        const fileExcludeFuncs = Utils_1.ToArray(rule.fileExclude).map(Utils_1.FileMatchToFunction);
        const matchingModules = modules.filter(mod => {
            let path = mod._source; // path is absolute
            if (path == null)
                return false; // if module has no resource, doesn't match
            path = path.replace(/\\/g, "/"); // normalize path to have "/" separators
            /*if (!SomeFuncsMatch(chunkIncludeFuncs, chunkInfo)) return false; // if chunk not included by rule, doesn't match
            if (SomeFuncsMatch(chunkExcludeFuncs, chunkInfo)) return false; // if chunk excluded by rule, doesn't match*/
            if (!Utils_1.SomeFuncsMatch(fileIncludeFuncs, path))
                return false; // if module not included by rule, doesn't match
            if (Utils_1.SomeFuncsMatch(fileExcludeFuncs, path))
                return false; // if module excluded by rule, doesn't match
            if (this.options.logFileMatches || this.options.logFileMatchContents) {
                console.log(`Found file match. @rule(${ruleIndex}) @path:` + path);
                if (this.options.logFileMatchContents) {
                    console.log(`Contents:\n==========\n${mod._source._value.slice(0, this.options.logFileMatchContents)}\n==========\n`);
                }
            }
            return true;
        });
        rule.fileOrOutputFileMatchCounts_perCompilation[compilationIndex] = matchingModules.length;
        return { matchingModules };
    }
    ApplyRuleAsSourceTransform(rule, moduleSource, compilationIndex) {
        //const ruleIndex = this.options.rules.indexOf(rule);
        let result = moduleSource;
        //console.log("Length:" + moduleSource.length);
        for (let replacement of rule.replacements) {
            let patternMatchCount = 0;
            let pattern_asRegex = Utils_1.ToRegex(replacement.pattern);
            if (!pattern_asRegex.global)
                throw new Error("Regex must have the 'g' flag added. (otherwise it will only have one match!)");
            if (this.options.logAroundPatternMatches != null) {
                let matches = [];
                let match;
                while (match = pattern_asRegex.exec(result)) {
                    //if (matches.length && match.index == matches[matches.length - 1].index) break;
                    matches.push(match);
                }
                pattern_asRegex.lastIndex = 0;
                for (let match of matches) {
                    let sectionToLog = result.slice(Math.max(0, match.index - this.options.logAroundPatternMatches), Math.min(result.length, match.index + match[0].length + this.options.logAroundPatternMatches));
                    console.log(`Logging text around pattern match:\n==========\n${sectionToLog}\n==========\n`);
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
            replacement.fileOrOutputFileMatchCounts_perCompilation[compilationIndex] += patternMatchCount;
        }
        return result;
    }
    VerifyMatchCounts() {
        console.log(`Verifying match counts... @compilations(${this.currentRun.compilations.length})`);
        for (let [ruleIndex, rule] of this.options.rules.entries()) {
            let chunksMatching = rule.compilationIsMatch_perCompilation.filter(isMatch => isMatch);
            if (!Utils_1.IsMatchCountCorrect(chunksMatching.length, rule.chunkMatchCount)) {
                throw new Error(`
					A rule did not have as many chunk-matches as it should have.
					Rule: #${ruleIndex} @include(${rule.fileInclude}) @exclude(${rule.fileExclude})
					Is-match (per chunk): [${rule.compilationIsMatch_perCompilation}] @target(${JSON.stringify(rule.chunkMatchCount)})

					Ensure you have the correct versions for any npm modules involved.
				`);
            }
            const lateStage = rule.applyStage == "optimizeChunkAssets";
            let chunksWithCorrectRuleMatchCount = rule.fileOrOutputFileMatchCounts_perCompilation.filter(count => Utils_1.IsMatchCountCorrect(count, rule[lateStage ? "outputFileMatchCount" : "fileMatchCount"]));
            if (chunksWithCorrectRuleMatchCount.length == 0) {
                throw new Error(`
					A rule did not have as many ${lateStage ? "output-" : ""}file-matches as it should have (in any chunk).
					Rule: #${ruleIndex} @include(${rule.fileInclude}) @exclude(${rule.fileExclude})
					Match counts (per chunk): [${rule.fileOrOutputFileMatchCounts_perCompilation}] @target(${JSON.stringify(rule.fileMatchCount)})

					Ensure you have the correct versions for any npm modules involved.
				`);
            }
            for (let [index, replacement] of rule.replacements.entries()) {
                let chunksWithCorrectReplacementMatchCount = replacement.fileOrOutputFileMatchCounts_perCompilation.filter(count => Utils_1.IsMatchCountCorrect(count, replacement.patternMatchCount));
                if (chunksWithCorrectReplacementMatchCount.length == 0) {
                    throw new Error(`
						A string-replacement pattern did not have as many matches as it should have (in any chunk).
						Rule: #${ruleIndex} @include(${rule.fileInclude}) @exclude(${rule.fileExclude})
						Replacement: #${index} @pattern(${replacement.pattern})
						Match counts (per chunk): [${replacement.fileOrOutputFileMatchCounts_perCompilation}] @target(${JSON.stringify(replacement.patternMatchCount)})

						Ensure you have the correct versions for any npm modules involved.
					`);
                }
            }
        }
    }
    ;
}
exports.WebpackStringReplacer = WebpackStringReplacer;
//# sourceMappingURL=WebpackStringReplacer.js.map