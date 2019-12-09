import {WebpackStringReplacer} from "./WebpackStringReplacer";

// exports
// ==========

export * from "./WebpackStringReplacer";
export * from "./Options";

// main export (as the default export, and the exports object itself)
// ==========

export default WebpackStringReplacer;
// make WebpackStringReplacer the module exports-obj itself
module.exports = WebpackStringReplacer;
// update WebpackStringReplace (the new exports-obj) with the other exports put on the TypeScript-known "exports" object
Object.assign(WebpackStringReplacer, exports);
