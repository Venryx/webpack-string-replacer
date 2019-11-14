const {ReplaceSource} = require('webpack-sources');

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

				for (let chunk of chunks) {
					let {chunkInclude, chunkExclude} = this.options;
					let definedEntries = chunk.entries;
					const chunkNames = (definedEntries || []).map(a=>a.name);
					if (chunkInclude == true || chunkNames.find(a=>a == chunkInclude) == null) return;
					if (chunkExclude == true || chunkNames.find(a=>a == chunkExclude) != null) return;

					for (let file of chunk.files) {
						const originalSource = compilation.assets[file];
						let source;
						for (let entry of this.options.replacements) {
							let {pattern, replacement} = entry;
							const indices = GetAllIndexes(originalSource.source(), pattern);
							if (!indices.length) return;
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

						callback();
					}
				}
			});
		});
	}
}

module.exports = StringReplacerPlugin; // export as default
module.exports.StringReplacerPlugin = StringReplacerPlugin; // export named