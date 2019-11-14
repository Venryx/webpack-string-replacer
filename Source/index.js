// @ts-check_disabled
const path = require("path");
const {IsBool, IsString, IsArray, IsFunction, ToArray, EscapeForRegex, ToRegex, ChunkMatchToFunction, FileMatchToFunction, SomeFuncsMatch, IsMatchCountCorrect} = require("./Utils");

const packageName = "webpack-plugin-string-replace";
class StringReplacerPlugin {
	//static instance;
	constructor(options) {
		StringReplacerPlugin["instance"] = this;
		for (let [index, rule] of options.rules.entries()) {
			// normalize rule props
			rule = Object.assign({
				applyStage: "loader",
				chunkInclude: true, chunkExclude: false,
				outputFileInclude: true, outputFileExclude: false,
				fileInclude: true, fileExclude: false,
				replacements: []
			}, rule);
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
			chunks: [],
			chunkEntryPaths_perChunk: [],
			//chunkMeta: [],
			optimizeModules_chunksReached: 0,
		};
		// just store on objects under options
		for (let rule of this.options.rules) {
			rule.chunkIsMatch_perChunk = [];
			rule.fileMatchCounts_perChunk = [];
			for (let replacement of rule.replacements) {
				replacement.fileMatchCounts_perChunk = [];
			}
		}
	}
	InitChunkMetaForChunkIndex(chunkIndex) {
		//this.currentRun.chunkMeta[chunkIndex] = {}
		for (let rule of this.options.rules) {
			rule.chunkIsMatch_perChunk[chunkIndex] = null;
			rule.fileMatchCounts_perChunk[chunkIndex] = 0;
			for (let replacement of rule.replacements) {
				replacement.fileMatchCounts_perChunk[chunkIndex] = 0;
			}
		}
	}

	// now set up the StringReplacerPlugin.instance.SourceTransformer_CallFromLoader function (for the loader to call)
	SourceTransformer_CallFromLoader(source, options) {
		// some loaders botch the options-passing, so re-parse it if needed
		if (typeof options == "string") {
			try {
				let json = options.slice(options.indexOf("{"), options.lastIndexOf("}") + 1);
				options = JSON.parse(json);
			} catch (ex) {
				//console.error(`
				throw new Error(`
					The options object for webpack-plugin-string-replace was mangled by an earlier-running loader. Please update/remove/fix the other loader.
					Options string: ${options}
					Error: ${ex}
				`.trim());
			}
		}
		let {rulesToApply_indexes, chunkIndex} = options;
		const rulesToApply = rulesToApply_indexes.map(index=>this.options.rules[index]);
		for (let rule of rulesToApply) {
			source = this.ApplyRuleAsSourceTransform(rule, source, chunkIndex);
		}
		return source;
	}

	apply(compiler) {
		this.ResetCurrentRun(); // reset for first run
		compiler.hooks.compilation.tap(packageName, (chunk, chunkParams) => {
			this.currentRun.chunks.push(chunk);
			const chunkIndex = this.currentRun.chunks.length - 1;
			this.InitChunkMetaForChunkIndex(chunkIndex);

			// stage 1 (if apply-stage early/mid): insert our transformer-loader for each file for which a rule applies; the transformer will soon be called, applying the rules
			if (this.options.applyStage == "loader" || this.options.applyStage == "optimizeModules") {
				chunk.hooks.normalModuleLoader.tap(packageName, (loaderContext, mod)=> {
					if (loaderContext._compilation != chunk) throw new Error("LoaderContext and chunk out of sync.");

					let rulesToApply = this.options.rules.filter(rule=>this.PrepareToApplyRuleToModules(rule, [mod], chunk, chunkIndex) != null);
					//console.log("Setting up loaderA:" + Object.keys(mod).join(",") + ";", mod.loaders.length);
					if (rulesToApply.length == 0) return;
					const rulesToApply_indexes = rulesToApply.map(rule=>this.options.rules.indexOf(rule));
					if (mod.loaders == null) return;

					if (this.options.applyStage == "loader") {
						//console.log("Setting up loader:" + Object.keys(mod).join(",") + ";", mod.loaders.length);
						mod.loaders.push({
						//mod.loaders.unshift({
							loader: path.resolve(__dirname, 'Loader.js'),
							options: {rulesToApply_indexes, chunkIndex},
						});
					}
				});
			}

			// stage 2 (if apply-stage early/mid): wait for last chunk to be done optimizing-modules, apply rules (if apply-stage is optimizeModules), then run the VerifyMatchCounts function
			if (this.options.applyStage == "loader" || this.options.applyStage == "optimizeModules") {
				chunk.hooks.optimizeModules.tap(packageName, modules=> {
					if (this.options.applyStage == "optimizeModules") {
						/*let chunk = this.currentRun.chunks.find(a=>a.modules == modules);
						if (chunk == null) throw new Error("Failed to find chunk for module-list in OnOptimizeModules.");
						this.currentRun.optimizeModules_chunksReached.push(chunk);
						let isLastChunk = this.currentRun.optimizeModules_chunksReached.length == this.currentRun.chunks.length;*/
						
						for (let rule of this.options.rules) {
							let {matchingModules} = this.PrepareToApplyRuleToModules(rule, modules, chunkIndex, chunk);
							for (let mod of matchingModules) {
								const sourceText = mod._source._value;
								mod._source._value = this.ApplyRuleAsSourceTransform(rule, mod, sourceText, chunkIndex);
							}
						}
					}

					this.currentRun.optimizeModules_chunksReached++;
					// if we just finished applying the rules for the last chunk, the compilation-run is complete
					let isLastChunk = this.currentRun.optimizeModules_chunksReached == this.currentRun.chunks.length;
					// if the compilation run is complete, verify the match counts
					if (isLastChunk) {
						this.VerifyMatchCounts();
						this.ResetCurrentRun(); // reset for next run
					}
				});
			}
			//chunk.hooks.afterOptimizeModules.tap(packageName, this.PostOptimizeModules.bind(this));

			// stage 3 (if apply-stage late)
			if (this.options.applyStage == "optimizeChunkAssets") {
				const chunkIncludeFuncs = ToArray(chunkInclude).map(ChunkMatchToFunction);
				const chunkExcludeFuncs = ToArray(chunkExclude).map(ChunkMatchToFunction);
				const outputFileIncludeFuncs = ToArray(outputFileInclude).map(FileMatchToFunction);
				const outputFileExcludeFuncs = ToArray(outputFileExclude).map(FileMatchToFunction);

				compilation.plugin('optimize-chunk-assets', (chunks, callback) => {
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
							definedChunkNames: [chunk.name].concat((chunk.entries || []).map(a=>a.name))
						};
						if (!SomeFuncsMatch(chunkIncludeFuncs, chunkInfo)) continue; // if chunk not included by rule, doesn't match
						if (SomeFuncsMatch(chunkExcludeFuncs, chunkInfo)) continue; // if chunk excluded by rule, doesn't match
	
						for (let [fileIndex, file] of chunk.files.entries()) {
							if (!SomeFuncsMatch(outputFileIncludeFuncs, file)) continue; // if output-file not included by rule, doesn't match
							if (SomeFuncsMatch(outputFileExcludeFuncs, file)) continue; // if output-file excluded by rule, doesn't match
	
							const originalSource = compilation.assets[file];
							let newSource;
							for (let entry of this.options.replacements) {
								let {pattern, replacement} = entry;
								const indices = GetAllIndexes(originalSource.source(), pattern);
								if (!indices.length) continue;
								if (!newSource) {
									newSource = new ReplaceSource(originalSource);
								}
	
								indices.forEach((startPos) => {
									const endPos = startPos + pattern.length - 1;
									//console.log("Replacing;", startPos, ";", endPos);
									newSource.replace(startPos, endPos, replacement);
								});
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
	
					this.VerifyMatchCounts();
					this.ResetCurrentRun(); // reset for next run
					callback();
				});
			}
		});
	}

	PrepareToApplyRuleToModules(rule, modules, chunk, chunkIndex) {
		const ruleIndex = this.options.rules.indexOf(rule);
		
		let chunkIsMatch = rule.chunkIsMatch_perChunk[chunkIndex];
		if (chunkIsMatch == null) {
			const chunkIncludeFuncs = ToArray(rule.chunkInclude).map(ChunkMatchToFunction);
			const chunkExcludeFuncs = ToArray(rule.chunkExclude).map(ChunkMatchToFunction);
			const chunkInfo = {
				index: chunkIndex,
				definedChunkNames: [chunk.name].concat((chunk.entries || []).map(a=>a.name)),
			};
			
			chunkIsMatch = SomeFuncsMatch(chunkIncludeFuncs, chunkInfo) && !SomeFuncsMatch(chunkExcludeFuncs, chunkInfo);
			rule.chunkIsMatch_perChunk[chunkIndex] = chunkIsMatch;
		}
		if (!chunkIsMatch) return null;

		const fileIncludeFuncs = ToArray(rule.fileInclude).map(FileMatchToFunction);
		const fileExcludeFuncs = ToArray(rule.fileExclude).map(FileMatchToFunction);
		const matchingModules = modules.filter(mod=> {
			let path = mod.resource; // path is absolute
			if (path == null) return false; // if module has no resource, doesn't match
			path = path.replace(/\\/g, "/") // normalize path to have "/" separators
			/*if (!SomeFuncsMatch(chunkIncludeFuncs, chunkInfo)) return false; // if chunk not included by rule, doesn't match
			if (SomeFuncsMatch(chunkExcludeFuncs, chunkInfo)) return false; // if chunk excluded by rule, doesn't match*/
			if (!SomeFuncsMatch(fileIncludeFuncs, path)) return false; // if module not included by rule, doesn't match
			if (SomeFuncsMatch(fileExcludeFuncs, path)) return false; // if module excluded by rule, doesn't match
			
			if (this.options.logFileMatches || this.options.logFileMatchContents) {
				console.log(`Found file match. @rule(${ruleIndex}) @path:` + path);
				if (this.options.logFileMatchContents) {
					console.log(`Contents:\n==========\n${mod._source._value}\n==========\n`);
				}
			}
			return true;
		});
		rule.fileMatchCounts_perChunk[chunkIndex] = matchingModules.length;

		return {matchingModules};
	}
	ApplyRuleAsSourceTransform(rule, moduleSource, chunkIndex) {
		//const ruleIndex = this.options.rules.indexOf(rule);

		let result = moduleSource;
		//console.log("Length:" + moduleSource.length);
		for (let replacement of rule.replacements) {
			let patternMatchCount = 0;
			let pattern_asRegex = ToRegex(replacement.pattern);
			if (!pattern_asRegex.global) throw new Error("Regex must have the 'g' flag added. (otherwise it will only have one match!)");

			if (this.options.logAroundPatternMatches != null) {
				let matches = [];
				let match;
				while (match = pattern_asRegex.exec(result)) {
					//if (matches.length && match.index == matches[matches.length - 1].index) break;
					matches.push(match);
				}
				pattern_asRegex.lastIndex = 0;
				for (let match of matches) {
					let sectionToLog = result.slice(
						Math.max(0, match.index - this.options.logAroundPatternMatches),
						Math.min(result.length, match.index + match[0].length + this.options.logAroundPatternMatches)
					);
					console.log(`Logging text around pattern match:\n==========\n${sectionToLog}\n==========\n`);
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
			replacement.fileMatchCounts_perChunk[chunkIndex] += patternMatchCount;
		}
		return result;
	}

	VerifyMatchCounts() {
		console.log("Verifying match counts...");
		for (let [ruleIndex, rule] of this.options.rules.entries()) {
			let chunksMatching = rule.chunkIsMatch_perChunk.filter(isMatch=>isMatch);
			if (!IsMatchCountCorrect(chunksMatching.length, rule.chunkMatchCount)) {
				throw new Error(`
					A rule did not have as many chunk-matches as it should have.
					Rule: #${ruleIndex} @include(${rule.include}) @exclude(${rule.exclude})
					Is-match (per chunk): [${rule.chunkIsMatch_perChunk}] @target(${JSON.stringify(rule.chunkMatchCount)})

					Ensure you have the correct versions for any npm modules involved.
				`);
			}

			let chunksWithCorrectRuleMatchCount = rule.fileMatchCounts_perChunk.filter(count=>IsMatchCountCorrect(count, rule.fileMatchCount));
			if (chunksWithCorrectRuleMatchCount.length == 0) {
				throw new Error(`
					A rule did not have as many file-matches as it should have (in any chunk).
					Rule: #${ruleIndex} @include(${rule.include}) @exclude(${rule.exclude})
					Match counts (per chunk): [${rule.fileMatchCounts_perChunk}] @target(${JSON.stringify(rule.fileMatchCount)})

					Ensure you have the correct versions for any npm modules involved.
				`);
			}
			
			for (let [index, replacement] of rule.replacements.entries()) {
				let chunksWithCorrectReplacementMatchCount = replacement.fileMatchCounts_perChunk.filter(count=>IsMatchCountCorrect(count, replacement.patternMatchCount));
				if (chunksWithCorrectReplacementMatchCount.length == 0) {
					throw new Error(`
						A string-replacement pattern did not have as many matches as it should have (in any chunk).
						Rule: #${ruleIndex} @include(${rule.include}) @exclude(${rule.exclude})
						Replacement: #${index} @pattern(${replacement.pattern})
						Match counts (per chunk): [${replacement.fileMatchCounts_perChunk}] @target(${JSON.stringify(replacement.patternMatchCount)})

						Ensure you have the correct versions for any npm modules involved.
					`);
				}
			}
		}
	};
}

module.exports = StringReplacerPlugin; // export as default
module.exports.StringReplacerPlugin = StringReplacerPlugin; // export named