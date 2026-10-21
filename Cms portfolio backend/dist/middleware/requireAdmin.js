"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireAdmin = void 0;
// Re-exported from ./auth so existing imports keep working while the
// authorization logic lives in a single place.
var auth_1 = require("./auth");
Object.defineProperty(exports, "requireAdmin", { enumerable: true, get: function () { return auth_1.requireAdmin; } });
