// @ts-check
const path = require("path");

const IsBool = any => typeof any === "boolean";
const IsNumber = any => typeof any === "number";
const IsString = any => typeof any === "string";
const IsRegex = any => any instanceof RegExp;
//const IsArray = any => typeof any === "array";
const IsArray = any => Array.isArray(any);
const IsObject = any => typeof any === "object";
const IsFunction = any => typeof any === "function";

const ToArray = any => IsArray(any) ? any : (any != null ? [any] : []);
function EscapeForRegex(literalString) {
	//return literalString.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
	// escape all control characters (probably more cautious than needed, but that's ok)
	return literalString.replace(/[-[\]{}()*+!<=:?.\/\\^$|#\s,]/g, '\\$&');
}
function ToRegex(str) {
	if (IsRegex(str)) return str;
	if (IsString(str)) return new RegExp(EscapeForRegex(str), "g");
	throw new Error("Invalid pattern.");
}
function ChunkMatchToFunction(matchObj) {
	if (IsBool(matchObj)) return chunkInfo => matchObj;
	if (matchObj.name) {
		return chunkInfo=>chunkInfo.definedChunkNames.filter(name=>name == matchObj.name).length > 0;
	}
	// removed for now, as "name" works fine, and index might not match the end-developer's assumed meaning
	/*if (matchObj.index) {
		return chunkInfo=>chunkInfo.index == matchObj.index;
	}*/
	// removed for now, as "name" works fine, and entry-path retrieval is tricky
	/*if (matchObj.entryPath) {
		/* if (IsRegex(val)) return chunkInfo => val.test(chunkInfo.entryPath);
		if (IsString(val)) return chunkInfo => str.includes(chunkInfo.entryPath);
		if (IsFunction(val)) return chunkInfo => val(chunkInfo.entryPath); *#/
		const entryPathMatchFuncs = ToArray(matchObj.entryPath).map(FileMatchToFunction);
		return chunkInfo => {
			for (let entryPath of chunkInfo.entryPaths) {
				if (SomeFuncsMatch(entryPathMatchFuncs, entryPath)) return true;
			}
			return false;
		};
	}*/
	throw new Error("Invalid chunk-match.");
}
function FileMatchToFunction(val) {
	if (IsBool(val)) return path => val;
	if (IsRegex(val)) return path => val.test(path);
	if (IsString(val)) return path => path.includes(val);
	if (IsFunction(val)) return path => val(path);
	throw new Error("Invalid file-match.");
}

function SomeFuncsMatch(matchFuncs, val) {
	for (let i = 0; i < matchFuncs.length; i++) {
		if (matchFuncs[i](val) === true) {
			return true; // match *any* condition
		}
	}
	return false;
}

function IsMatchCountCorrect(actualMatchCount, targetMatchCountOrRange) {
	if (targetMatchCountOrRange == null) return true;
	if (IsNumber(targetMatchCountOrRange)) {
		return actualMatchCount == targetMatchCountOrRange;
	}
	if (IsObject(targetMatchCountOrRange)) {
		let satisfiesMin = actualMatchCount >= targetMatchCountOrRange.min || targetMatchCountOrRange.min == null;
		let satisfiesMax = actualMatchCount <= targetMatchCountOrRange.max || targetMatchCountOrRange.max == null;
		return satisfiesMin && satisfiesMax;
	}
	throw new Error("Match-count target must either be a number (for exact target), or a {min, max} object (for range).");
}

const packageName = "webpack-plugin-string-replace";
class StringReplacerPlugin {
	//static instance;
	constructor(options) {
		StringReplacerPlugin["instance"] = this;
		for (let [index, rule] of options.rules.entries()) {
			// normalize rule props
			//Object.assign(rule, Object.assign({include: true, exclude: false, replacements: []}, rule));
			rule = Object.assign({ chunkInclude: true, chunkExclude: false, fileInclude: true, fileExclude: false, replacements: [] }, rule);
			options.rules[index] = rule;

			// initialize internal metadata
			/*rule.chunkIsMatch_perChunk = [];
			rule.fileMatchCounts_perChunk = [];
			for (let replacement of rule.replacements) {
				replacement.fileMatchCounts_perChunk = [];
			}*/
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
			//optimizeModules_chunksReached: [],
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
		/*this.currentRun.chunkMeta[chunkIndex] = {
			ruleMeta: this.options.rules.map(rule=> ({
				fileMatchCountInChunk: 0,
				replacementMeta: rule.replacements.map(replacement=> ({
					fileMatchCountInChunk: 0,
				})),
			})),
		}*/
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
		//console.log(`Applying rules...`);
		for (let rule of rulesToApply) {
			//this.ApplyRule(rule, modules, chunkIndex, chunk);
			source = this.ApplyRuleToModule(rule, source, chunkIndex);
		}
		return source;
	};

	apply(compiler) {
		this.ResetCurrentRun(); // reset for first run
		compiler.hooks.compilation.tap(packageName, (chunk, chunkParams) => {
			this.currentRun.chunks.push(chunk);
			const chunkIndex = this.currentRun.chunks.length - 1;
			this.InitChunkMetaForChunkIndex(chunkIndex);

			// stage 1: while in the optimizeDependencies stage for each chunk, store the chunk's entry-paths; the paths get lost for certain chunks, if waiting till the normalModuleLoader stage
			//chunk.hooks.optimizeDependencies.tap(packageName+"_early", (modules)=> {
			/*chunk.hooks.buildModule.tap(packageName+"_early", (modules)=> {
				const chunkEntryPaths = chunk.entries.map(entry=>entry.resource);
				this.currentRun.chunkEntryPaths_perChunk = chunkEntryPaths;
				//console.log(`\n\n\n\n\n@index(${chunkIndex}) --- Chunk entry paths:`, chunkEntryPaths);
				//console.log("\nTEST1=======", chunk.entrypoints, "\nTEST2=======", chunk["_preparedEntrypoints"], "\nTEST3=======", chunk.entries);
				//console.log("\nTEST1=======", chunk.entrypoints, "\nTEST2=======", chunk["_preparedEntrypoints"]);
				console.log("\nEntry points:", chunk["_preparedEntrypoints"].map(a=>a.name).join(", "));
			});*/

			// stage 2: insert our transformer-loader for each file for which a rule applies; the transformer will soon be called, applying the rules
			// approach 1: use loaders to do the actual applying, earlier on (so has less conflict with other processes, as seen from trying to modify webpack/hot/dev-server.js)
			//chunk.hooks.buildModule.tap(packageName, mod=> {
			//chunk.hooks.succeedModule.tap(packageName, mod=> {
			//chunk.hooks.normalModuleLoader.tap(packageName, this.OnNormalModuleLoader.bind(this));
			chunk.hooks.normalModuleLoader.tap(packageName, (loaderContext, mod)=> {
				/*const chunk = loaderContext._compilation;
				const chunkIndex = this.currentRun.chunks.indexOf(chunk);
				if (chunkIndex == -1) throw new Error("Failed to find loader's chunk on the chunk-list for this compilation run.");*/

				// add our special loader, for this file (this lets our transformation occur before eslint, babel, etc.)
				//console.log("Setting up loader:" + Object.keys(mod).join(",") + ";", mod.loaders.length);
				//if (mod.loaders.filter(a=>a.loader.includes("html-webpack-plugin")).length) return; // temp fix
				//console.log("Setting up loader:", ["getResolve", "rootContext", "_compilation"].map(key=>loaderContext[key]));
				//console.log("Setting up loader:", (loaderContext._compilation.entries || []).map(a=>a.name).join(", "), "\n\nModules:", (loaderContext._compilation.modules || []).map(a=>a.name).join(", "));

				if (loaderContext._compilation != chunk) throw new Error("LoaderContext and chunk out of sync.");

				let rulesToApply = this.options.rules.filter(rule=>this.PrepareToApplyRuleToModules(rule, [mod], chunk, chunkIndex));
				//console.log("Setting up loaderA:" + Object.keys(mod).join(",") + ";", mod.loaders.length);
				if (rulesToApply.length == 0) return;
				const rulesToApply_indexes = rulesToApply.map(rule=>this.options.rules.indexOf(rule));

				if (mod.loaders == null) return;

				//console.log("Setting up loader:" + Object.keys(mod).join(",") + ";", mod.loaders.length);
				mod.loaders.push({
				//mod.loaders.unshift({
					loader: path.resolve(__dirname, 'loader.js'),
					//ident: `ref--123456`
					options: {rulesToApply_indexes, chunkIndex},
				});
			});

			// stage 3: wait for the last chunk to be done optimizing-modules, then run the VerifyMatchCounts function
			// approach 2: just modify the module source after loaders are done
			//chunk.hooks.optimizeDependencies.tap(packageName, this.OnOptimizeModules.bind(this));
			//chunk.hooks.optimizeModules.tap(packageName, this.OnOptimizeModules.bind(this));
			//chunk.hooks.optimizeDependencies.tap(packageName, modules=> {
			chunk.hooks.optimizeModules.tap(packageName, modules=> {
				/*let chunk = this.currentRun.chunks.find(a=>a.modules == modules);
				if (chunk == null) throw new Error("Failed to find chunk for module-list in OnOptimizeModules.");
				this.currentRun.optimizeModules_chunksReached.push(chunk);
				let isLastChunk = this.currentRun.optimizeModules_chunksReached.length == this.currentRun.chunks.length;
				
				for (let rule of this.options.rules) {
					this.ApplyRule(rule, modules, chunkIndex, chunk);
				}*/

				this.currentRun.optimizeModules_chunksReached++;
				// if we just finished applying the rules for the last chunk, the compilation-run is complete
				let isLastChunk = this.currentRun.optimizeModules_chunksReached == this.currentRun.chunks.length;
				// if the compilation run is complete, verify the match counts
				if (isLastChunk) {
					this.VerifyMatchCounts();
					this.ResetCurrentRun(); // reset for next run
				}
			});
			//chunk.hooks.afterOptimizeModules.tap(packageName, this.PostOptimizeModules.bind(this));
		});

		// verify replacement counts
		//compiler.hooks.afterCompile.tap(packageName, ()=> {
	}
	/*OnNormalModuleLoader(loaderContext, mod) {
		// moved to the above	
	};*/
	/*OnOptimizeModules(modules) {
		// moved to the above
	}*/

	PrepareToApplyRuleToModules(rule, modules, chunk, chunkIndex) {
		const ruleIndex = this.options.rules.indexOf(rule);
		
		let chunkIsMatch = rule.chunkIsMatch_perChunk[chunkIndex];
		if (chunkIsMatch == null) {
			const chunkIncludeFuncs = ToArray(rule.chunkInclude).map(ChunkMatchToFunction);
			const chunkExcludeFuncs = ToArray(rule.chunkExclude).map(ChunkMatchToFunction);
			/*const chunkEntryPaths_now = chunk.entries.map(entry=>entry.resource);
			const chunkEntryPaths = this.currentRun.chunkEntryPaths_perChunk[chunkIndex] || chunkEntryPaths_now;
			const chunkInfo = {index: chunkIndex, entryPaths: chunkEntryPaths};
			console.log(`\n\n\n\n\n@index(${chunkIndex}) Chunk entry paths:`, chunkEntryPaths, "Chunk entry paths_now:", chunkEntryPaths_now);*/
			const chunkInfo = {index: chunkIndex, definedChunkNames: [chunk.name]};
			/*let definedEntries = chunk["_preparedEntrypoints"];
			if (definedEntries) {
				chunkInfo.definedChunkNames = chunkInfo.definedChunkNames.concat(definedEntries.map(a=>a.name));
			}*/
			let definedEntries = chunk.entries;
			if (definedEntries) {
				chunkInfo.definedChunkNames = chunkInfo.definedChunkNames.concat(definedEntries.map(a=>a.name));
			}
			//console.log(`\n\n\n\n\nChunkInfo: `, JSON.stringify(chunkInfo));
			
			chunkIsMatch = SomeFuncsMatch(chunkIncludeFuncs, chunkInfo) && !SomeFuncsMatch(chunkExcludeFuncs, chunkInfo);
			//console.log("ChunkIndex:", chunkIndex, "IsMatch:", chunkIsMatch, "ChunkEntryPaths:", chunkInfo.entryPaths);
			//console.log("\nTEST1=======", chunk.entrypoints.size, "\nTEST2=======", chunk["_preparedEntrypoints"], "\nTEST3=======", chunk.entries);
			rule.chunkIsMatch_perChunk[chunkIndex] = chunkIsMatch;
		}
		if (!chunkIsMatch) return false;

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

		// this code would run to apply the rules, if we were still using the "direct" approach, and this method were still called ApplyRuleToModules (now we use loaders)
		/*for (let mod of matchingModules) {
			const sourceText = mod._source._value;
			mod._source._value = this.ApplyRuleToModule(rule, mod, sourceText, chunkIndex);
		}*/

		return true;
	}
	ApplyRuleToModule(rule, moduleSource, chunkIndex) {
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