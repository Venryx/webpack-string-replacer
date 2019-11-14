/* var ReplaceSource;
try {
  ReplaceSource = require("webpack-core/lib/ReplaceSource");
} catch(e) {
  ReplaceSource = require("webpack-sources").ReplaceSource;
} */
const {ReplaceSource} = require('webpack-sources');

/*
Usage:
==========
const codeMapEntries = Object.entries({
	'const from = "complicated code from example";': 'const from = somethingSimpler;',
});
const ReplaceCodePlugin = require("webpack-string-replacer");
webpackConfig.plugins.push(new ReplaceCodePlugin({
	replacements: {
		"old": "new",
	},
}));
*/

class ReplaceCodePlugin {
	constructor(options) {
		this.options = options;
	}
	options;
	apply(compiler) {
		compiler.plugin('compilation', (compilation) => {
			compilation.plugin('optimize-chunk-assets', (chunks, callback) => {
				function getAllIndices(str, searchStr) {
					let i = -1;
					const indices = [];
					while ((i = str.indexOf(searchStr, i + 1)) !== -1) {
						indices.push(i);
					}
					return indices;
				}

				chunks.forEach((chunk) => {
					chunk.files.forEach((file) => {
						let source;
						const originalSource = compilation.assets[file];

						this.options.replacements.forEach(([fromCode, toCode]) => {
							const indices = getAllIndices(originalSource.source(), fromCode);
							if (!indices.length) {
								return;
							}

							if (!source) {
								source = new ReplaceSource(originalSource);
							}

							indices.forEach((startPos) => {
								const endPos = startPos + fromCode.length - 1;
								source.replace(startPos, endPos, toCode);
							});
						});

						if (source) {
							// eslint-disable-next-line no-param-reassign
							compilation.assets[file] = source;
						}

						callback();
					});
				});
			});
		});
	}
}