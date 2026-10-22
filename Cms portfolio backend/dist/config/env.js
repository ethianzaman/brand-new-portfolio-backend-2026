"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.JWT_EXPIRES_IN = exports.JWT_SECRET = void 0;
// src/config/env.ts
/**
 * The JWT signing secret.
 *
 * A hard-coded fallback is only acceptable for local development, where a
 * stable secret keeps existing sessions valid across restarts. In production
 * a missing/weak secret must stop the process instead of silently signing
 * tokens with a value that is publicly known (anyone could then forge an
 * admin token).
 */
const DEFAULT_DEV_SECRET = 'fallback_secret';
function resolveJwtSecret() {
    const secret = process.env.JWT_SECRET?.trim();
    if (secret && secret.length > 0) {
        if (secret === DEFAULT_DEV_SECRET && process.env.NODE_ENV === 'production') {
            throw new Error('JWT_SECRET must be set to a unique value in production. Refusing to start with the development fallback secret.');
        }
        return secret;
    }
    if (process.env.NODE_ENV === 'production') {
        throw new Error('JWT_SECRET is required in production. Refusing to start without a signing secret.');
    }
    return DEFAULT_DEV_SECRET;
}
exports.JWT_SECRET = resolveJwtSecret();
exports.JWT_EXPIRES_IN = (process.env.JWT_EXPIRES_IN || '7d');
