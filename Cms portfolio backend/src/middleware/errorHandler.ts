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
  const message =
    statusCode >= 500 ? 'Internal Server Error' : err.message

  console.error(`[${req.method}] ${req.path} → ${statusCode}: ${err.message}`)

  res.status(statusCode).json({
    success: false,
    message,
  })
}