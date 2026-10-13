"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.JWT_EXPIRES_IN = exports.JWT_SECRET = void 0;
// src/config/env.ts
exports.JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret';
exports.JWT_EXPIRES_IN = (process.env.JWT_EXPIRES_IN || '7d');
