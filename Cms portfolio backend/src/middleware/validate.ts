import { Request, Response, NextFunction } from 'express'
import { ValidationChain, validationResult } from 'express-validator'

/**
 * Runs express-validator chains and rejects the request with 400 when any
 * check fails, returning the first error message per field.
 *
 *   router.post('/', protect, validate([...body('email').isEmail()]), handler)
 */
export function validate(validations: ValidationChain[]) {
  return async (req: Request, res: Response, next: NextFunction) => {
    for (const validation of validations) {
      await validation.run(req)
    }

    const errors = validationResult(req)
    if (errors.isEmpty()) return next()

    const first = errors.array()[0]
    res.status(400).json({
      success: false,
      message: String(first.msg),
      ...(first.type === "field" ? { field: first.path } : {}),
    })
  }
}
