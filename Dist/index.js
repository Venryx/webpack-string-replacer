"use strict";
function __export(m) {
    for (var p in m) if (!exports.hasOwnProperty(p)) exports[p] = m[p];
}
Object.defineProperty(exports, "__esModule", { value: true });
const WebpackStringReplacer_1 = require("./WebpackStringReplacer");
// exports
// ==========
__export(require("./WebpackStringReplacer"));
__export(require("./Options"));
// main export (as the default export, and the exports object itself)
// ==========
exports.default = WebpackStringReplacer_1.WebpackStringReplacer;
// make WebpackStringReplacer the module exports-obj itself
module.exports = WebpackStringReplacer_1.WebpackStringReplacer;
// update WebpackStringReplace (the new exports-obj) with the other exports put on the TypeScript-known "exports" object
Object.assign(WebpackStringReplacer_1.WebpackStringReplacer, exports);
//# sourceMappingURL=index.js.map