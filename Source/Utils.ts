import webpack = require("webpack");
import {ShouldValidateCondition, ShouldValidateData} from "./Options";

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

// proxy for console.log, which adds a new-line (otherwise, the log just gets appended to the other webpack log lines, making it hard to see)
export function Log(...args) {
	return console.log("\n[wsr]", ...args);
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

export function ShouldValidate(shouldValidate: ShouldValidateCondition, shouldValidateData: ShouldValidateData) {
	if (IsBool(shouldValidate)) return shouldValidate;
	if (IsFunction(shouldValidate)) return shouldValidate(shouldValidateData);
	throw new Error("Invalid shouldValidate condition.");
}

export function Slice_NumberOrBool(str: string, length_orTrueForRest: number | boolean) {
	if (length_orTrueForRest == false) return "";
	if (length_orTrueForRest == true) return str;
	return str.slice(0, length_orTrueForRest);
}

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
export function GetModuleResourcePath(mod: webpack.Module, loaderContext?: webpack.LoaderContext<any>) {
	return mod["resource"] || mod["request"] || loaderContext?.resourcePath || loaderContext?.resource;
}

export function Matches(self: String, strOrRegex: string | RegExp): RegExpMatchArray[] {
	let result = [] as RegExpMatchArray[];

	if (typeof strOrRegex == "string") {
		let str = strOrRegex;
		let lastMatchIndex = -1;
		while (true) {
			let matchIndex = self.indexOf(str, lastMatchIndex + 1);
			if (matchIndex == -1) break; // if another match was not found
			const entry: RegExpMatchArray = [self.slice(matchIndex, matchIndex + str.length)];
			// use defineProperties, so they're non-enumerable (and so don't show if the match is passed to console.log)
			Object.defineProperties(entry, {
				index: {value: matchIndex},
				input: {value: self.toString()},
			});
			result.push(entry);
			lastMatchIndex = matchIndex;
		}
	} else {
		let regex = strOrRegex;
		if (!regex.global) {
			//throw new Error("Regex must have the 'g' flag added. (otherwise an infinite loop occurs)");
			regex = new RegExp(regex.source, regex.flags + "g");
		}
		
		let match;
		while (match = regex.exec(self as string)) {
			result.push(match);
		}
	}

	return result;
}