import webpack = require("webpack");

export function IsBool(any): any is boolean { return typeof any === "boolean"; }
export function IsNumber(any): any is number { return typeof any === "number"; }
export function IsString(any): any is string { return typeof any === "string"; }
export function IsRegex(any): any is RegExp { return any instanceof RegExp; }
//export function IsArray(any) { return typeof any === "array"; }
export function IsArray(any): any is Array<any> { return Array.isArray(any); }
export function IsObject(any): any is Object { return typeof any === "object"; }
export function IsFunction(any): any is Function { return typeof any === "function"; }

export const ToArray = any => IsArray(any) ? any : (any != null ? [any] : []);
export function EscapeForRegex(literalString) {
	//return literalString.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
	// escape all control characters (probably more cautious than needed, but that's ok)
	return literalString.replace(/[-[\]{}()*+!<=:?.\/\\^$|#\s,]/g, '\\$&');
}
export function ToRegex(str) {
	if (IsRegex(str)) return str;
	if (IsString(str)) return new RegExp(EscapeForRegex(str), "g");
	throw new Error("Invalid pattern.");
}

export function Distinct(items: any[]) {
	return Array.from(new Set(items));
}

export function ChunkMatchToFunction(matchObj) {
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
export function FileMatchToFunction(val) {
	if (IsBool(val)) return path => val;
	if (IsRegex(val)) return path => val.test(path);
	if (IsString(val)) return path => path.includes(val);
	if (IsFunction(val)) return path => val(path);
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

export function Slice_NumberOrBool(str: string, length_orTrueForRest: number | boolean) {
	if (length_orTrueForRest == false) return "";
	if (length_orTrueForRest == true) return str;
	return str.slice(0, length_orTrueForRest);
}

// module helpers (due to @types/webpack being outdated)
// ==========

export function GetModuleSource(mod: webpack.compilation.Module) {
	return mod._source._value;
}
export function SetModuleSource(mod: webpack.compilation.Module, newSource: string) {
	mod._source._value = newSource;
}

// path is absolute
export function GetModuleResourcePath(mod: webpack.compilation.Module, loaderContext?: webpack.loader.LoaderContext) {
	return mod["resource"] || mod["request"] || loaderContext?.resourcePath || loaderContext?.resource;
}