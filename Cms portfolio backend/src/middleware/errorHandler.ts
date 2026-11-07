import { Request, Response, NextFunction } from 'express'
import multer from 'multer'

export interface AppError extends Error {
  statusCode?: number
}

export function errorHandler(
  err:  AppError,
  req:  Request,
  res:  Response,
  _next: NextFunction
): void {
  const isUploadError = err instanceof multer.MulterError
  const statusCode = err.statusCode ?? (isUploadError ? 400 : 500)
  // Multer says "Unexpected file field" when a field gets more files than it allows.
  const tooManyFiles =
    err instanceof multer.MulterError && err.code === 'LIMIT_UNEXPECTED_FILE'
  const message =
    statusCode >= 500
      ? 'Internal Server Error'
      : tooManyFiles
        ? `Too many files for ${err.field ?? 'this field'}`
        : err.message

  console.error(`[${req.method}] ${req.path} → ${statusCode}: ${err.message}`)

  res.status(statusCode).json({
    success: false,
    message,
  })
}