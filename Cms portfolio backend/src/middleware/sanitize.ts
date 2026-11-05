import type { NextFunction, Request, Response } from "express";

function hasOperatorKey(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;

  return Object.entries(value).some(
    ([key, nested]) => key.startsWith("$") || hasOperatorKey(nested),
  );
}

/**
 * Rejects MongoDB operators in client input. Express parses `?category[$ne]=x`
 * into an object, which would otherwise reach a query as an operator.
 */
export function rejectMongoOperators(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (hasOperatorKey(req.query) || hasOperatorKey(req.body)) {
    res.status(400).json({ success: false, message: "Invalid request." });
    return;
  }
  next();
}
