"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class Options {
    constructor(initialProps) {
        this.rules = [];
        Object.assign(this, initialProps);
    }
}
exports.Options = Options;
class Rule {
    constructor() {
        //applyStage: ApplyStage;
        this.applyStage = "loader";
        this.chunkInclude = true;
        this.chunkExclude = false;
        this.outputFileInclude = true;
        this.outputFileExclude = false;
        this.fileInclude = true;
        this.fileExclude = false;
        this.logFileMatches = false;
        this.logFileMatchContents = false;
        this.replacements = [];
    }
}
exports.Rule = Rule;
class Replacement {
    constructor() {
        this.logAroundPatternMatches = null;
    }
}
exports.Replacement = Replacement;
//# sourceMappingURL=Options.js.map