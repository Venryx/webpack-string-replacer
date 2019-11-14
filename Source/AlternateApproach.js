const {ReplaceSource} = require('webpack-sources');
const {IsBool, IsString, IsArray, IsFunction, ToArray, EscapeForRegex, ToRegex, ChunkMatchToFunction, FileMatchToFunction, SomeFuncsMatch, IsMatchCountCorrect} = require("./Utils");

/*
Usage:
==========
const StringReplacerPlugin = require("webpack-string-replacer");
webpackConfig.plugins.push(new StringReplacerPlugin({
	chunkInclude: "chunk1",
	replacements: {
		"old": "new",
	},
}));
*/

class StringReplacerPlugin {
	constructor(options) {
		this.options = Object.assign({chunkInclude: true, chunkExclude: false}, options);
	}
	apply(compiler) {
		let {chunkInclude, chunkExclude} = this.options;
		const chunkIncludeFuncs = ToArray(chunkInclude).map(ChunkMatchToFunction);
		const chunkExcludeFuncs = ToArray(chunkExclude).map(ChunkMatchToFunction);

		compiler.plugin('compilation', (compilation) => {
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
					if (!SomeFuncsMatch(chunkIncludeFuncs, chunkInfo)) return false; // if chunk not included by rule, doesn't match
					if (SomeFuncsMatch(chunkExcludeFuncs, chunkInfo)) return false; // if chunk excluded by rule, doesn't match

					for (let file of chunk.files) {
						const originalSource = compilation.assets[file];
						let source;
						for (let entry of this.options.replacements) {
							let {pattern, replacement} = entry;
							const indices = GetAllIndexes(originalSource.source(), pattern);
							if (!indices.length) continue;
							if (!source) {
								source = new ReplaceSource(originalSource);
							}

							indices.forEach((startPos) => {
								const endPos = startPos + pattern.length - 1;
								source.replace(startPos, endPos, replacement);
							});
						}

						if (source) {
							compilation.assets[file] = source;
						}
					}
				}

				callback();
			});
		});
	}
}

module.exports = StringReplacerPlugin; // export as default
module.exports.StringReplacerPlugin = StringReplacerPlugin; // export named