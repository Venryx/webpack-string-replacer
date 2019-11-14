export const IsBool = any => typeof any === "boolean";
export const IsNumber = any => typeof any === "number";
export const IsString = any => typeof any === "string";
export const IsRegex = any => any instanceof RegExp;
//export const IsArray = any => typeof any === "array";
export const IsArray = any => Array.isArray(any);
export const IsObject = any => typeof any === "object";
export const IsFunction = any => typeof any === "function";
export const ToArray = any => IsArray(any) ? any : (any != null ? [any] : []);
export function EscapeForRegex(literalString) {
    //return literalString.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    // escape all control characters (probably more cautious than needed, but that's ok)
    return literalString.replace(/[-[\]{}()*+!<=:?.\/\\^$|#\s,]/g, '\\$&');
}
export function ToRegex(str) {
    if (IsRegex(str))
        return str;
    if (IsString(str))
        return new RegExp(EscapeForRegex(str), "g");
    throw new Error("Invalid pattern.");
}
export function Distinct(items) {
    return Array.from(new Set(items));
}
export function ChunkMatchToFunction(matchObj) {
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
export function FileMatchToFunction(val) {
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
export function SomeFuncsMatch(matchFuncs, val) {
    for (let i = 0; i < matchFuncs.length; i++) {
        if (matchFuncs[i](val) === true) {
            return true; // match *any* condition
        }
    }
    return false;
}
export function IsMatchCountCorrect(actualMatchCount, targetMatchCountOrRange) {
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
//# sourceMappingURL=Utils.js.map