function Export(obj) {
	Object.assign(module.exports, obj);
}
module.exports = {};

const IsBool = any => typeof any === "boolean";
Export({IsBool});
const IsNumber = any => typeof any === "number";
Export({IsNumber});
const IsString = any => typeof any === "string";
Export({IsString});
const IsRegex = any => any instanceof RegExp;
Export({IsRegex});
//const IsArray = any => typeof any === "array";
const IsArray = any => Array.isArray(any);
Export({IsArray});
const IsObject = any => typeof any === "object";
Export({IsObject});
const IsFunction = any => typeof any === "function";
Export({IsFunction});

const ToArray = any => IsArray(any) ? any : (any != null ? [any] : []);
Export({ToArray});
function EscapeForRegex(literalString) {
	//return literalString.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
	// escape all control characters (probably more cautious than needed, but that's ok)
	return literalString.replace(/[-[\]{}()*+!<=:?.\/\\^$|#\s,]/g, '\\$&');
}
Export({EscapeForRegex});
function ToRegex(str) {
	if (IsRegex(str)) return str;
	if (IsString(str)) return new RegExp(EscapeForRegex(str), "g");
	throw new Error("Invalid pattern.");
}
Export({ToRegex});
function ChunkMatchToFunction(matchObj) {
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
Export({ChunkMatchToFunction});
function FileMatchToFunction(val) {
	if (IsBool(val)) return path => val;
	if (IsRegex(val)) return path => val.test(path);
	if (IsString(val)) return path => path.includes(val);
	if (IsFunction(val)) return path => val(path);
	throw new Error("Invalid file-match.");
}
Export({FileMatchToFunction});

function SomeFuncsMatch(matchFuncs, val) {
	for (let i = 0; i < matchFuncs.length; i++) {
		if (matchFuncs[i](val) === true) {
			return true; // match *any* condition
		}
	}
	return false;
}
Export({SomeFuncsMatch});

function IsMatchCountCorrect(actualMatchCount, targetMatchCountOrRange) {
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
Export({IsMatchCountCorrect});
