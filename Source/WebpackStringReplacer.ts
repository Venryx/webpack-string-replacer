// @ts-check_disabled
import * as path from "path";
import * as webpack from "webpack";
import {LoaderContext, NormalModule} from "webpack";
import {ReplaceSource, Source} from "webpack-sources";
import {ApplyStage, Options, Replacement, Rule} from "./Options";
import {ChunkMatchToFunction, Distinct, FileMatchToFunction, GetModuleResourcePath, IsFunction, IsMatchCountCorrect, IsString, Log, Matches, ShouldValidate, Slice_NumberOrBool, SomeFuncsMatch, ToArray, ToRegex} from "./Utils";

const GetWebpack_NormalModule = (options: Options)=>options.webpackModule?.NormalModule ?? NormalModule;

export type Compilation = webpack.Compilation;
export type Module = webpack.Module;

export class CompilationRun {
	compilations = [] as Compilation[];
	//chunkEntryPaths_perChunk = [] as number[];
	compilationsCompleted = 0;

	ruleMetas = new Map<Rule, RuleMeta>();
	GetRuleMeta(rule: Rule, compilationIndex: number) {
		if (!this.ruleMetas.has(rule)) this.ruleMetas.set(rule, new RuleMeta());
		let ruleMeta = this.ruleMetas.get(rule);
		if (!ruleMeta.compilationMeta.has(compilationIndex)) ruleMeta.compilationMeta.set(compilationIndex, new RulePlusCompilationMeta());
		return ruleMeta.compilationMeta.get(compilationIndex);
	}
	replacementMetas = new Map<Replacement, ReplacementMeta>();
	GetReplacementMeta(replacement: Replacement, compilationIndex: number) {
		if (!this.replacementMetas.has(replacement)) this.replacementMetas.set(replacement, new ReplacementMeta());
		let replacementMeta = this.replacementMetas.get(replacement);
		if (!replacementMeta.compilationMeta.has(compilationIndex)) replacementMeta.compilationMeta.set(compilationIndex, new ReplacementPlusCompilationMeta());
		return replacementMeta.compilationMeta.get(compilationIndex);
	}
}
export class RuleMeta {
	compilationMeta = new Map<number, RulePlusCompilationMeta>();
}
export class ReplacementMeta {
	compilationMeta = new Map<number, ReplacementPlusCompilationMeta>();
}
export class RulePlusCompilationMeta {
	//compilationIsMatch = false;
	compilationIsMatch = null;
	outputFileMatchCount = 0;
	fileMatchCount = 0;
}
export class ReplacementPlusCompilationMeta {
	patternMatchCount = 0;
}

/*
term descriptions
==========
compilation: TODO
compilation-run: TODO
chunk: TODO
*/

const packageName = "webpack-string-replacer";
export class WebpackStringReplacer {
	//static instance;
	constructor(options: Options) {
		options = new Options(options);
		WebpackStringReplacer["instance"] = this;
		for (let [ruleIndex, rule] of options.rules.entries()) {
			// apply options from Rule-class default-values, and ruleBase
			rule = Object.assign(new Rule(), options.ruleBase, rule);
			for (let [replacementIndex, replacement] of rule.replacements.entries()) {
				replacement = Object.assign(new Replacement(), options.replacementBase, replacement);
				rule.replacements[replacementIndex] = replacement;
			}
			options.rules[ruleIndex] = rule;
		}
		this.options = options;
	}

	options: Options;
	
	currentRun: CompilationRun;
	// Note: For compilation-runs with more than one chunk, the execution order is as follows:
	// 	b1.compilation, b2.compilation, [many calls to normalModuleLoader for all chunks], b1.optimizeModules, b1.afterCompile, b2.optimizeModules, b2.afterCompile
	// The "compilation run state" below helps keep track of those executions, so we can figure out the chunk-count. (and thus when the compilation-run is fully over)
	ResetCurrentRun() {
		Log("Resetting");
		this.currentRun = new CompilationRun();
	}

	// now set up the WebpackStringReplacer.instance.SourceTransformer_CallFromLoader function (for the loader to call)
	SourceTransformer_CallFromLoader(source: string, options: {rulesToApply_indexes: number[], compilationIndex: number, modulePath: string}) {
		// some loaders botch the options-passing, so re-parse it if needed
		if (typeof options == "string") {
			let optionsStr = options as string;
			try {
				let json = optionsStr.slice(optionsStr.indexOf("{"), optionsStr.lastIndexOf("}") + 1);
				options = JSON.parse(json);
			} catch (ex) {
				//console.error(`
				throw new Error(`
					The options object for webpack-plugin-string-replace was mangled by an earlier-running loader. Please update/remove/fix the other loader.
					Options string: ${optionsStr}
					Error: ${ex}
				`.trim());
			}
		}

		//Log("Loader called with:", source);
		const {rulesToApply_indexes, compilationIndex, modulePath} = options;
		const rulesToApply = rulesToApply_indexes.map(index=>this.options.rules[index]);
		for (let rule of rulesToApply) {
			source = this.ApplyRuleAsSourceTransform(rule, source, compilationIndex, modulePath);
		}
		return source;
	}

	stages_cache: ApplyStage[];
	get Stages() {
		if (this.stages_cache == null) {
			this.stages_cache = Distinct(this.options.rules.map(a=>a.applyStage));
		}
		return this.stages_cache;
	}
	GetRulesForStage(stage: ApplyStage) {
		return this.options.rules.filter(a=>a.applyStage == stage);
	}

	apply(compiler) {
		const opt = this.options;
		this.ResetCurrentRun(); // reset for first run
		compiler.hooks.compilation.tap(packageName, (compilation: Compilation, compilationParams) => {
			this.currentRun.compilations.push(compilation);
			const compilationIndex = this.currentRun.compilations.length - 1;

			// stage 1 (if apply-stage early): insert our transformer-loader for each file for which a rule applies; the transformer will soon be called, applying the rules
			if (this.Stages.includes("loader")) {
				//compilation.hooks.normalModuleLoader.tap(packageName, (loaderContext: webpack.loader.LoaderContext, mod)=> {
				//NormalModule.getCompilationHooks(compilation).loader.tap(packageName, (loaderContext: LoaderContext<Options>, mod)=> {
				GetWebpack_NormalModule(this.options).getCompilationHooks(compilation).loader.tap(packageName, (loaderContext: LoaderContext<Options>, mod)=> {
					if (loaderContext._compilation != compilation) throw new Error("LoaderContext and chunk out of sync.");

					let rulesToApply = this.GetRulesForStage("loader").filter(rule=> {
						return this.GetModulesWhereRuleShouldBeApplied(rule, [mod], compilation, compilationIndex).matchingModules.length == 1;
					});
					if (rulesToApply.length == 0) return;
					const rulesToApply_indexes = rulesToApply.map(rule=>this.options.rules.indexOf(rule));
					//if (loaderContext.loaders == null) { // @types/webpack says it's on loaderContext, but runtime says no; types must be outdated
					let modulePath = GetModuleResourcePath(mod);
					if (mod["loaders"] == null) {
						//mod["loaders"] = [];
						Log(`LoaderStage: Ignoring file at path "${modulePath}", since it has no other loaders. (intercepting may break some other plugins, eg. html-webpack-plugin)`);
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
						options: {rulesToApply_indexes, compilationIndex, modulePath},
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
				compilation.hooks.optimizeChunkAssets.tap(packageName, chunks=> {
					//Log("Chunks files:", chunks);
					for (let [ruleIndex, rule] of this.GetRulesForStage("optimizeChunkAssets").entries()) {
						let ruleMeta = this.currentRun.GetRuleMeta(rule, compilationIndex);
						const chunkIncludeFuncs = ToArray(rule.chunkInclude).map(ChunkMatchToFunction);
						const chunkExcludeFuncs = ToArray(rule.chunkExclude).map(ChunkMatchToFunction);
						const outputFileIncludeFuncs = ToArray(rule.outputFileInclude).map(FileMatchToFunction);
						const outputFileExcludeFuncs = ToArray(rule.outputFileExclude).map(FileMatchToFunction);
		
						for (let [chunkIndex, chunk] of chunks.entries()) {
							const allChunksInside = [
								...chunk.getAllAsyncChunks(),
								...chunk.getAllInitialChunks(),
								...chunk.getAllReferencedChunks(),
							];
							const chunkInfo = {
								index: chunkIndex,
								//definedChunkNames: [chunk.name].concat((chunk.entries || []).map(a=>a.name))
								definedChunkNames: Array.from(new Set([chunk.name, ...allChunksInside.map(a=>a.name)])),
							};
							ruleMeta.compilationIsMatch = false;
							if (!SomeFuncsMatch(chunkIncludeFuncs, chunkInfo)) continue; // if chunk not included by rule, doesn't match
							if (SomeFuncsMatch(chunkExcludeFuncs, chunkInfo)) continue; // if chunk excluded by rule, doesn't match
							ruleMeta.compilationIsMatch = true;
		
							//const matchingFiles = chunk.files.filter(file=> {})
							for (let [fileIndex, file] of chunk.files.entries()) {
								if (!SomeFuncsMatch(outputFileIncludeFuncs, file)) continue; // if output-file not included by rule, doesn't match
								if (SomeFuncsMatch(outputFileExcludeFuncs, file)) continue; // if output-file excluded by rule, doesn't match
								ruleMeta.outputFileMatchCount++;

								const originalSource = compilation.assets[file] as Source;
								if (rule.logFileMatches || rule.logFileMatchContents) {
									Log(`Found output-file match. @rule(${ruleIndex}) @file:` + file);
									if (rule.logFileMatchContents) {
										Log(`Contents:\n==========\n${Slice_NumberOrBool(originalSource.source(), rule.logFileMatchContents)}\n==========\n`);
									}
								}
		
								let newSource;
								for (let replacement of rule.replacements) {
									let replacementMeta = this.currentRun.GetReplacementMeta(replacement, compilationIndex);

									/*if (!IsString(replacement.pattern)) throw new Error("Only string patterns are allowed for optimizeChunkAssets stage currently. (will fix later)");
									let patternStr = replacement.pattern as string;
									const matchIndexes = GetAllIndexes(originalSource.source(), patternStr);*/
									//const matchIndexes = GetAllIndexes(originalSource.source(), replacement.pattern);
									const matches = Matches(originalSource.source(), replacement.pattern);
									//console.log("Matches:", matches.length, "@replacement:", replacement.replacement.toString());

									if (!matches.length) continue;
									if (!newSource) {
										newSource = new ReplaceSource(originalSource);
									}
		
									matches.forEach(match=>{
										const startPos = match.index;
										//const endPos = startPos + patternStr.length - 1;
										const endPos = startPos + (match[0].length - 1);
										const newStr = typeof replacement.replacement == "string" ? replacement.replacement : replacement.replacement(match[0], ...match.slice(1));
										//Log(`Replacing match. @range(${startPos}-${endPos}) @old(${match[0]}) @new(${newStr})`);
										newSource.replace(startPos, endPos, newStr);
									});
									replacementMeta.patternMatchCount += matches.length;
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
			compilation.hooks.afterOptimizeChunkAssets.tap(packageName, chunks=> {
				this.currentRun.compilationsCompleted++;
				// if we just finished applying the rules for the last chunk, the compilation-run is complete
				let isLastCompilation = this.currentRun.compilationsCompleted == this.currentRun.compilations.length;
				// if the compilation run is complete, and the should-validate condition passes, validate the match counts
				if (isLastCompilation && ShouldValidate(this.options.shouldValidate, {compilations: this.currentRun.compilations})) {
					this.ValidateMatchCounts();
					this.ResetCurrentRun(); // reset for next run
				}
			});
		});
	}

	GetModulesWhereRuleShouldBeApplied(rule: Rule, modules: Module[], compilation: Compilation, compilationIndex: number) {
		const ruleMeta = this.currentRun.GetRuleMeta(rule, compilationIndex);
		
		// todo: fix that we are treating compilations as if they were chunks!
		if (ruleMeta.compilationIsMatch == null) {
			const chunkIncludeFuncs = ToArray(rule.chunkInclude).map(ChunkMatchToFunction);
			const chunkExcludeFuncs = ToArray(rule.chunkExclude).map(ChunkMatchToFunction);
			const chunkInfo = {
				index: compilationIndex,
				//definedChunkNames: [compilation["name"]].concat((compilation.entries || []).map(a=>a.name)),
				//definedChunkNames: [compilation["name"]].concat(Array.from(compilation.entries.keys())),
				definedChunkNames: [compilation["name"]].concat(Array.from(compilation.chunks).map(a=>a.name)),
			};
			
			ruleMeta.compilationIsMatch = SomeFuncsMatch(chunkIncludeFuncs, chunkInfo) && !SomeFuncsMatch(chunkExcludeFuncs, chunkInfo);
		}
		if (!ruleMeta.compilationIsMatch) return null;

		const fileIncludeFuncs = ToArray(rule.fileInclude).map(FileMatchToFunction);
		const fileExcludeFuncs = ToArray(rule.fileExclude).map(FileMatchToFunction);
		const matchingModules = modules.filter(mod=> {
			let modulePath = GetModuleResourcePath(mod);
			if (modulePath == null) return false; // if module has no resource, doesn't match
			modulePath = modulePath.replace(/\\/g, "/") // normalize path to have "/" separators
			/*if (!SomeFuncsMatch(chunkIncludeFuncs, chunkInfo)) return false; // if chunk not included by rule, doesn't match
			if (SomeFuncsMatch(chunkExcludeFuncs, chunkInfo)) return false; // if chunk excluded by rule, doesn't match*/
			if (!SomeFuncsMatch(fileIncludeFuncs, modulePath)) return false; // if module not included by rule, doesn't match
			if (SomeFuncsMatch(fileExcludeFuncs, modulePath)) return false; // if module excluded by rule, doesn't match

			/*if (rule.logFileMatches || rule.logFileMatchContents) {
				Log(`Found file match. @rule(${this.options.rules.indexOf(rule)}) @path:` + modulePath);
			}*/

			return true;
		});
		// for a given rule, this function gets called for every module (if applying at loader phase), thus we have to increment, not set
		ruleMeta.fileMatchCount += matchingModules.length;

		return {matchingModules};
	}
	ApplyRuleAsSourceTransform(rule: Rule, moduleSource: string, compilationIndex: number, modulePath: string) {
		// do the logging here (instead of PrepareToApplyRuleToModules), because if using apply-stage "loader", the source isn't accessible when Prepare... is called
		if (rule.logFileMatches || rule.logFileMatchContents) {
			Log(`Found file match. @rule(${this.options.rules.indexOf(rule)}) @path:` + modulePath);
			if (rule.logFileMatchContents) {
				//console.dir(mod);
				//Log(`Contents:\n==========\n${GetModuleSource(mod).slice(0, rule.logFileMatchContents)}\n==========\n`);
				Log(`Contents:\n==========\n${Slice_NumberOrBool(moduleSource, rule.logFileMatchContents)}\n==========\n`);
			}
		}

		let result = moduleSource;
		//Log("Length:" + moduleSource.length);
		for (let replacement of rule.replacements) {
			let replacementMeta = this.currentRun.GetReplacementMeta(replacement, compilationIndex);
			let patternMatchCount = 0;
			let pattern_asRegex = ToRegex(replacement.pattern);
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
					let sectionToLog = result.slice(
						Math.max(0, match.index - replacement.logAroundPatternMatches),
						Math.min(result.length, match.index + match[0].length + replacement.logAroundPatternMatches)
					);
					Log(`Logging text around pattern match:\n==========\n${sectionToLog}\n==========\n`);
				}
			}

			result = result.replace(pattern_asRegex, (substring, ...args)=> {
				patternMatchCount++;
				if (IsString(replacement.replacement)) return replacement.replacement;
				if (IsFunction(replacement.replacement)) return replacement.replacement(substring, ...args);
				throw new Error("Rule.replacement must be a string or function.");
			});
			//replacement.fileMatchCounts_perChunk[chunkIndex] = (replacement.fileMatchCounts_perChunk[chunkIndex]|0) + patternMatchCount;
			//this.currentRun.chunkMeta[chunkIndex].ruleMeta[ruleIndex].replacementMeta[replacementIndex].
			replacementMeta.patternMatchCount += patternMatchCount;
		}
		return result;
	}

	Assert(condition: any, messageOrMessageFunc: string | (()=>string)) {
		if (condition) return;
		let message = IsString(messageOrMessageFunc) ? messageOrMessageFunc : messageOrMessageFunc();
		let logType = this.options.validationLogType;
		//if (logType == "error") throw new Error("\n" + message); // commented; asserts don't need new-line, since they already have one added
		if (logType == "error") throw new Error(message);
		else if (logType == "logError") console.error(message);
		else if (logType == "logWarning") console.warn(message);
		else if (logType == "log") console.log(message);
		else throw new Error(`Invalid validationLogType: ${logType}`);
	}

	ValidateMatchCounts() {
		Log(`Verifying match counts... @compilations(${this.currentRun.compilations.length}) @rules(${this.options.rules.length})`);
		for (let [ruleIndex, rule] of this.options.rules.entries()) {
			let ruleMeta = this.currentRun.ruleMetas.get(rule) || new RuleMeta();
			let ruleCompilationMetas = this.currentRun.compilations.map((c, index)=>ruleMeta.compilationMeta.get(index) || new RulePlusCompilationMeta());

			this.Assert(IsMatchCountCorrect(ruleCompilationMetas.filter(a=>a.compilationIsMatch).length, rule.chunkMatchCount), `
				A rule did not have as many chunk-matches as it should have.
				Rule: #${ruleIndex} @include(${rule.fileInclude}) @exclude(${rule.fileExclude})
				Chunk-is-match (per compilation): [${ruleCompilationMetas.map(a=>a.compilationIsMatch)}] @target(${JSON.stringify(rule.chunkMatchCount)})

				Ensure you have the correct versions for any npm modules involved.
			`);

			this.Assert(ruleCompilationMetas.find(a=>IsMatchCountCorrect(a.outputFileMatchCount, rule.outputFileMatchCount)), `
				A rule did not have as many output-file-matches as it should have (in any compilation).
				Rule: #${ruleIndex} @include(${rule.outputFileInclude}) @exclude(${rule.outputFileExclude})
				Match counts (per compilation): [${ruleCompilationMetas.map(a=>a.outputFileMatchCount)}] @target(${JSON.stringify(rule.outputFileMatchCount)})

				Ensure you have the correct versions for any npm modules involved.
			`);

			this.Assert(ruleCompilationMetas.find(a=>IsMatchCountCorrect(a.fileMatchCount, rule.fileMatchCount)), `
				A rule did not have as many file-matches as it should have (in any compilation).
				Rule: #${ruleIndex} @include(${rule.fileInclude}) @exclude(${rule.fileExclude})
				Match counts (per compilation): [${ruleCompilationMetas.map(a=>a.fileMatchCount)}] @target(${JSON.stringify(rule.fileMatchCount)})

				Ensure you have the correct versions for any npm modules involved.
			`);
			
			for (let [index, replacement] of rule.replacements.entries()) {
				let replacementMeta = this.currentRun.replacementMetas.get(replacement) || new ReplacementMeta();
				let replacementCompilationMetas = this.currentRun.compilations.map((c, index)=>replacementMeta.compilationMeta.get(index) || new ReplacementPlusCompilationMeta());

				//console.log(`Checking replacement. @rule(${ruleIndex}) @replacement(${index}) @target(${replacement.patternMatchCount}) @actual(${replacementCompilationMetas.map(a=>a.patternMatchCount)})`);
				this.Assert(replacementCompilationMetas.find(a=>IsMatchCountCorrect(a.patternMatchCount, replacement.patternMatchCount)), `
					A string-replacement pattern did not have as many matches as it should have (in any compilation).
					Rule: #${ruleIndex} @include(${rule.fileInclude}) @exclude(${rule.fileExclude})
					Replacement: #${index} @pattern(${replacement.pattern})
					Match counts (per compilation): [${replacementCompilationMetas.map(a=>a.patternMatchCount)}] @target(${JSON.stringify(replacement.patternMatchCount)})

					Ensure you have the correct versions for any npm modules involved.
				`);
			}
		}
	};
}