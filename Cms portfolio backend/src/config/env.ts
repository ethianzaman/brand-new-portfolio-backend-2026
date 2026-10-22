import jwt from 'jsonwebtoken'

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
const DEFAULT_DEV_SECRET = 'fallback_secret'

function resolveJwtSecret(): string {
  const secret = process.env.JWT_SECRET?.trim()

  if (secret && secret.length > 0) {
    if (secret === DEFAULT_DEV_SECRET && process.env.NODE_ENV === 'production') {
      throw new Error(
        'JWT_SECRET must be set to a unique value in production. Refusing to start with the development fallback secret.'
      )
    }
    return secret
  }

  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'JWT_SECRET is required in production. Refusing to start without a signing secret.'
    )
  }

  return DEFAULT_DEV_SECRET
}

export const JWT_SECRET = resolveJwtSecret()

export const JWT_EXPIRES_IN = (process.env.JWT_EXPIRES_IN || '7d') as jwt.SignOptions['expiresIn']
