"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.IsBool = any => typeof any === "boolean";
exports.IsNumber = any => typeof any === "number";
exports.IsString = any => typeof any === "string";
exports.IsRegex = any => any instanceof RegExp;
//export const IsArray = any => typeof any === "array";
exports.IsArray = any => Array.isArray(any);
exports.IsObject = any => typeof any === "object";
exports.IsFunction = any => typeof any === "function";
exports.ToArray = any => exports.IsArray(any) ? any : (any != null ? [any] : []);
function EscapeForRegex(literalString) {
    //return literalString.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    // escape all control characters (probably more cautious than needed, but that's ok)
    return literalString.replace(/[-[\]{}()*+!<=:?.\/\\^$|#\s,]/g, '\\$&');
}
exports.EscapeForRegex = EscapeForRegex;
function ToRegex(str) {
    if (exports.IsRegex(str))
        return str;
    if (exports.IsString(str))
        return new RegExp(EscapeForRegex(str), "g");
    throw new Error("Invalid pattern.");
}
exports.ToRegex = ToRegex;
function Distinct(items) {
    return Array.from(new Set(items));
}
exports.Distinct = Distinct;
function ChunkMatchToFunction(matchObj) {
    if (exports.IsBool(matchObj))
        return chunkInfo => matchObj;
    if (matchObj.name) {
        return chunkInfo => chunkInfo.definedChunkNames.filter(name => name == matchObj.name).length > 0;
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
exports.ChunkMatchToFunction = ChunkMatchToFunction;
function FileMatchToFunction(val) {
    if (exports.IsBool(val))
        return path => val;
    if (exports.IsRegex(val))
        return path => val.test(path);
    if (exports.IsString(val))
        return path => path.includes(val);
    if (exports.IsFunction(val))
        return path => val(path);
    throw new Error("Invalid file-match.");
}
exports.FileMatchToFunction = FileMatchToFunction;
function SomeFuncsMatch(matchFuncs, val) {
    for (let i = 0; i < matchFuncs.length; i++) {
        if (matchFuncs[i](val) === true) {
            return true; // match *any* condition
        }
    }
    return false;
}
exports.SomeFuncsMatch = SomeFuncsMatch;
function IsMatchCountCorrect(actualMatchCount, targetMatchCountOrRange) {
    if (targetMatchCountOrRange == null)
        return true;
    if (exports.IsNumber(targetMatchCountOrRange)) {
        return actualMatchCount == targetMatchCountOrRange;
    }
    if (exports.IsObject(targetMatchCountOrRange)) {
        let satisfiesMin = actualMatchCount >= targetMatchCountOrRange.min || targetMatchCountOrRange.min == null;
        let satisfiesMax = actualMatchCount <= targetMatchCountOrRange.max || targetMatchCountOrRange.max == null;
        return satisfiesMin && satisfiesMax;
    }
    throw new Error("Match-count target must either be a number (for exact target), or a {min, max} object (for range).");
}
exports.IsMatchCountCorrect = IsMatchCountCorrect;
//# sourceMappingURL=Utils.js.map