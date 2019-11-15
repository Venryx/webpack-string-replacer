# Webpack String Replacer

Replace strings in webpack modules, with configurable apply-stage and match-count requirements.

### Installation

```
npm install --save-dev webpack-string-replacer
```

### Usage

Basic example:
```
const WebpackStringReplacer = require("webpack-string-replacer");

webpackConfig.plugins.push(new WebpackStringReplacer({
	rules: [{
		fileInclude: "targetFile.js",
		replacements: [
			{
				pattern: "MY_API_TOKEN",
				patternMatchCount: {min: 4},
				replacement: "lPP5BxQESO6VU4aUcKJLFg",
			},
		],
	}],
}));
```

Advanced example:
```
const WebpackStringReplacer = require("webpack-string-replacer");

webpackConfig.plugins.push(new WebpackStringReplacer({
	logAroundPatternMatches: 200,
	rules: [{
		applyStage: "optimizeChunkAssets",
		outputFileInclude: /\.js$/,
		outputFileExclude: /vendors.js$/,
		outputFileMatchCount: 6,
		replacements: [
			{
				pattern: 'location.reload();',
				patternMatchCount: {min: 4, max: 10},
				replacement: '//location.reload();',
			},
			{
				pattern: /location\.href = (.+);/g,
				replacement: (match, sub1, offset, sourceStr)=> {
					return (
						`location.href_disabled = ${sub1};
						console.log("Redirect attempted to: " + location.href_disabled);`
					);
				},
			},
		],
	}],
}));
```

### Options

If you prefer viewing the raw TypeScript typings, you can open the "Source/Options.ts" file, or the "Dist/*.d.ts" files.

#### `logFileMatches` - bool

> If true, files matches by rules will have their paths logged for inspection.

#### `logFileMatchContents` - number

> If set, files matches by rules will have the first X characters of their contents logged for inspection.

#### `logAroundPatternMatches` - number

> If set, locations where patterns are matched will have X characters of the source code (before and after) logged for inspection. (not yet compatible with `optimizeChunkAssets`)

#### `rules` - Rule[]

> Array of rules. (see below)

#### `rules.X.applyStage` - "loader" | "optimizeModules" | "optimizeChunkAssets"

> **loader** (early)  
>> Time: Applies before other loaders or plugins have modified the source files.  
>> File basis: Replacements at this stage operate on the source-files, so include/exclude is based on source files (or chunk names), not the output files.  
>> Example: Applies on original typescript source files, before typescript and babel have applied their transformations.  
>> Compatibility: Using this mode prohibits use of the "outputFileInclude" and "outputFileExclude" props, since they can't be applied.
>
>**optimizeModules** (middle)  
>> Time: Applies after loaders, but alongside some other plugins (depends on exact hooks used, and plugin order).  
>> File basis: Replacements at this stage operate on partially modified files. Include/exclude is still based on source files (or chunk names) though, not the output files.  
>> Example: For Babel, there seems to currently be a conflict where Babel has only "partially applied" on certain files, leading to text malformations. (eg. if modifying webpack/hot/dev-server.js)  
>> Compatibility: Using this mode prohibits use of the "outputFileInclude" and "outputFileExclude" props, since they can't be applied.
>
>**optimizeChunkAssets** (late)  
>> Time: Applies briefly before the output-files are actually emitted (eg. written to disk).  
>> File basis: Replacements at this stage operate on the output-files, so include/exclude is based on output files (or chunk names), not the source files.  
>> Example: Applies on the outputs of typescript and babel. (Chrome devtools, with sourcemaps disabled, can be used to help construct the replacements)  
>> Compatibility: Using this mode prohibits use of the "fileInclude" and "fileExclude" props, since they can't be applied.

#### `rules.X.chunkInclude` - bool | {name: string} - or array of these

> Identifies chunks to be included. (includes, then filters/excludes)
>
> Examples: "main", "vendor"
>
> Note: Chunk inclusion/exclusion might not work how you expect. Webpack seems to process chunks differently internally (eg. grouping them together more) than one would assume based on defined entry points and such. It's usually easier to use output-file inclusion/exclusion, as it has a clear output-file meaning/boundary.

#### `rules.X.chunkExclude` - bool | {name: string} - or array of these

> Identifies chunks to be excluded. (includes, then filters/excludes)

#### `rules.X.chunkMatchCount` - number | {min?: number, max?: number}

> Examples: `1`, `{min: 3, max: 5}`

#### `rules.X.outputFileInclude` - bool | string | regex | function - or array of these

> Identifies output-files to be included. (includes, then filters/excludes)
>
> Examples: "bundle.js", "vendorBundle.js"

#### `rules.X.outputFileExclude` - bool | string | regex | function - or array of these

> Identifies output-files to be excluded. (includes, then filters/excludes)
>
> Examples: "bundle.js", "vendorBundle.js"

#### `rules.X.outputFileMatchCount` - number | {min?: number, max?: number}

> Examples: (see rules.X.chunkMatchCount)

#### `rules.X.fileInclude` - bool | string | regex | function - or array of these

> Identifies files to be included. (includes, then filters/excludes)
>
> Examples: `true`, `string to contain`, `/regex to contain match for/`, `str=>CustomMatchLogic(str)` 

#### `rules.X.fileExclude` - bool | string | regex | function - or array of these

> Identifies files to be excluded. (includes, then filters/excludes)
>
> Examples: (see rules.X.fileInclude)

#### `rules.X.fileMatchCount` - number | {min?: number, max?: number}

> Based on total file matches. (if a file was in a non-matching chunk, it doesn't count toward this total)
>
> Examples: (see rules.X.chunkMatchCount)

#### `rules.X.replacements` - Replacement[]

> Array of replacements. (see below)

#### `rules.X.replacements.X.pattern` - string

> Examples: `"string to match"`, `/regex(p?) to match/g`

#### `rules.X.replacements.X.patternMatchCount` - number | {min?: number, max?: number}

> Based on total pattern matches. (if a pattern was in a non-matching file or chunk, it doesn't count toward this total)
>
> Examples: (see rules.X.chunkMatchCount)

#### `rules.X.replacements.X.replacement`

> Examples: `"new value"`, `matchedStr=>matchedStr + "new portion"`

## Alternatives

If this particular implementation of plugin-based string-replacement doesn't suit your needs, here's a list of alternatives:

#### General-purpose string replacement

Apply stage - loader:
* https://github.com/jamesandersen/string-replace-webpack-plugin
* https://github.com/Va1/string-replace-loader
* https://github.com/EventMobi/regexp-replace-loader
* https://github.com/fongandrew/replace-loader

Apply stage - unknown:
* https://github.com/lukeed/webpack-plugin-replace
* https://github.com/artemirq/modify-source-webpack-plugin
* https://stackoverflow.com/a/50029942/2441655

#### More specialized or manual options

* https://github.com/iminif/html-replace-webpack-plugin
* https://webpack.js.org/plugins/define-plugin
* https://webpack.js.org/plugins/banner-plugin
* https://github.com/NMFR/last-call-webpack-plugin