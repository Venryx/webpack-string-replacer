"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GetModuleResourcePath = exports.Slice_NumberOrBool = exports.ShouldValidate = exports.IsMatchCountCorrect = exports.SomeFuncsMatch = exports.FileMatchToFunction = exports.ChunkMatchToFunction = exports.Distinct = exports.Log = exports.ToRegex = exports.EscapeForRegex = exports.ToArray = exports.IsFunction = exports.IsObject = exports.IsArray = exports.IsRegex = exports.IsString = exports.IsNumber = exports.IsBool = void 0;
function IsBool(any) { return typeof any === "boolean"; }
exports.IsBool = IsBool;
function IsNumber(any) { return typeof any === "number"; }
exports.IsNumber = IsNumber;
function IsString(any) { return typeof any === "string"; }
exports.IsString = IsString;
function IsRegex(any) { return any instanceof RegExp; }
exports.IsRegex = IsRegex;
//export function IsArray(any) { return typeof any === "array"; }
function IsArray(any) { return Array.isArray(any); }
exports.IsArray = IsArray;
function IsObject(any) { return typeof any === "object"; }
exports.IsObject = IsObject;
function IsFunction(any) { return typeof any === "function"; }
exports.IsFunction = IsFunction;
const ToArray = any => IsArray(any) ? any : (any != null ? [any] : []);
exports.ToArray = ToArray;
function EscapeForRegex(literalString) {
    //return literalString.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    // escape all control characters (probably more cautious than needed, but that's ok)
    return literalString.replace(/[-[\]{}()*+!<=:?.\/\\^$|#\s,]/g, '\\$&');
}
exports.EscapeForRegex = EscapeForRegex;
function ToRegex(str) {
    if (IsRegex(str))
        return str;
    if (IsString(str))
        return new RegExp(EscapeForRegex(str), "g");
    throw new Error("Invalid pattern.");
}
exports.ToRegex = ToRegex;
// proxy for console.log, which adds a new-line (otherwise, the log just gets appended to the other webpack log lines, making it hard to see)
function Log(...args) {
    return console.log("\n", ...args);
}
exports.Log = Log;
function Distinct(items) {
    return Array.from(new Set(items));
}
exports.Distinct = Distinct;
function ChunkMatchToFunction(matchObj) {
    if (IsBool(matchObj))
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
    if (IsBool(val))
        return path => val;
    if (IsRegex(val))
        return path => val.test(path);
    if (IsString(val))
        return path => path.includes(val);
    if (IsFunction(val))
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
exports.IsMatchCountCorrect = IsMatchCountCorrect;
function ShouldValidate(shouldValidate, shouldValidateData) {
    if (IsBool(shouldValidate))
        return shouldValidate;
    if (IsFunction(shouldValidate))
        return shouldValidate(shouldValidateData);
    throw new Error("Invalid shouldValidate condition.");
}
exports.ShouldValidate = ShouldValidate;
function Slice_NumberOrBool(str, length_orTrueForRest) {
    if (length_orTrueForRest == false)
        return "";
    if (length_orTrueForRest == true)
        return str;
    return str.slice(0, length_orTrueForRest);
}
exports.Slice_NumberOrBool = Slice_NumberOrBool;
// module helpers (due to @types/webpack being outdated)
// ==========
// todo: get working in webpack 5
/*export function GetModuleSource(mod: webpack.Module) {
    return mod._source._value;
}
export function SetModuleSource(mod: webpack.Module, newSource: string) {
    mod._source._value = newSource;
}*/
// path is absolute
function GetModuleResourcePath(mod, loaderContext) {
    return mod["resource"] || mod["request"] || (loaderContext === null || loaderContext === void 0 ? void 0 : loaderContext.resourcePath) || (loaderContext === null || loaderContext === void 0 ? void 0 : loaderContext.resource);
}
exports.GetModuleResourcePath = GetModuleResourcePath;
//# sourceMappingURL=Utils.js.map