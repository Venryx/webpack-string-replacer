import webpack = require("webpack");
import { ShouldValidateCondition, ShouldValidateData } from "./Options";
export declare function IsBool(any: any): any is boolean;
export declare function IsNumber(any: any): any is number;
export declare function IsString(any: any): any is string;
export declare function IsRegex(any: any): any is RegExp;
export declare function IsArray(any: any): any is Array<any>;
export declare function IsObject(any: any): any is Object;
export declare function IsFunction(any: any): any is Function;
export declare const ToArray: (any: any) => any[];
export declare function EscapeForRegex(literalString: any): any;
export declare function ToRegex(str: any): RegExp;
export declare function Log(...args: any[]): void;
export declare function Distinct(items: any[]): any[];
export declare function ChunkMatchToFunction(matchObj: any): (chunkInfo: any) => boolean;
export declare function FileMatchToFunction(val: any): (path: any) => any;
export declare function SomeFuncsMatch(matchFuncs: any, val: any): boolean;
export declare function IsMatchCountCorrect(actualMatchCount: any, targetMatchCountOrRange: any): boolean;
export declare function ShouldValidate(shouldValidate: ShouldValidateCondition, shouldValidateData: ShouldValidateData): boolean;
export declare function Slice_NumberOrBool(str: string, length_orTrueForRest: number | boolean): string;
export declare function GetModuleResourcePath(mod: webpack.Module, loaderContext?: webpack.LoaderContext<any>): any;
export declare function Matches(self: String, strOrRegex: string | RegExp): RegExpMatchArray[];
