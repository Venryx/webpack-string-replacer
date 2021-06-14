"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
const WebpackStringReplacer_1 = require("./WebpackStringReplacer");
// exports
// ==========
__exportStar(require("./WebpackStringReplacer"), exports);
__exportStar(require("./Options"), exports);
// main export (as the default export, and the exports object itself)
// ==========
exports.default = WebpackStringReplacer_1.WebpackStringReplacer;
// make WebpackStringReplacer the module exports-obj itself
module.exports = WebpackStringReplacer_1.WebpackStringReplacer;
// update WebpackStringReplace (the new exports-obj) with the other exports put on the TypeScript-known "exports" object
Object.assign(WebpackStringReplacer_1.WebpackStringReplacer, exports);
//# sourceMappingURL=index.js.map