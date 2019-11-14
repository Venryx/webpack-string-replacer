# Webpack String Replacer

Replace strings in webpack modules, with rich configuration and enforceable match-counts.

### Installation

```
npm install --save-dev webpack-string-replacer
```

### Usage

Example:
```
const StringReplacerPlugin = require("webpack-string-replacer");

webpackConfig.plugins.push(new StringReplacerPlugin({
	rules: [{
		chunkInclude: [{name: "chunk1"}, {name: "chunk2"}],
		chunkMatchCount: 2,
		fileInclude: /webpack-dev-server\/.+\/reloadApp.js$/,
		fileMatchCount: 1,
		replacements: [
			{
				pattern: 'rootWindow.location.reload();',
				patternMatchCount: {min: 4},
				replacement: '//rootWindow.location.reload();',
			},
		],
	}],
}));
```

### Options

`logFileMatches` - bool

If true, files matches by rules will have their paths logged for inspection.

`logFileMatchContents` - bool

If true, files matches by rules will have their complete contents logged for inspection.

`logAroundPatternMatches` - number

If set, locations where patterns are matched will have X characters of the source code (before and after) logged for inspection.

`rules` - Rule[]

Array of rules. (see below)

`rules.X.chunkInclude` - bool | {name: string} - or array of these

Identifies the chunks to be included. (includes, then filters/excludes)

Examples: "main", "vendor"

`rules.X.chunkExclude` - bool | {name: string} - or array of these

Identifies the chunks to be excluded. (includes, then filters/excludes)

Examples: "main", "vendor"

`rules.X.chunkMatchCount` - number | {min?: number, max?: number}

Examples: `1`, `{min: 3, max: 5}`

`rules.X.fileInclude` - bool | string | regex | function - or array of these

Identifies the files to be included. (includes, then filters/excludes)

Examples: `true`, `string to contain`, `/regex to contain match for/`, `str=>CustomMatchLogic(str)` 

`rules.X.fileExclude` - bool | string | regex | function - or array of these

Identifies the files to be excluded. (includes, then filters/excludes)

Examples: (see rules.X.fileInclude)

`rules.X.fileMatchCount` - number | {min?: number, max?: number}

Based on total file matches. (if a file was in a non-matching chunk, it doesn't count toward this total)

Examples: (see rules.X.chunkMatchCount)

`rules.X.replacements` - Replacement[]

Array of replacements. (see below)

`rules.X.replacements.X.pattern` - string

Examples: `"string to match"`, `/regex(p?) to match/g`

`rules.X.replacements.X.patternMatchCount` - number | {min?: number, max?: number}

Based on total pattern matches. (if a pattern was in a non-matching file or chunk, it doesn't count toward this total)

Examples: (see rules.X.chunkMatchCount)

`rules.X.replacements.X.replacement`

Examples: `"new value"`, `matchedStr=>matchedStr + "new portion"`