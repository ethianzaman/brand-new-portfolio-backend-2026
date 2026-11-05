import type { Request, Response } from "express";
import { publicMessage } from "../utils/request";

/** A failure the client caused and should be told about. */
export class HttpError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
  ) {
    super(message);
  }
}

export const badRequest = (message: string) => new HttpError(400, message);
export const notFound = (message: string) => new HttpError(404, message);
export const conflict = (message: string) => new HttpError(409, message);

interface FailurePolicy {
  /** Status for an unexpected error. */
  status: number;
  /** Shown when the error's own message isn't safe to show. */
  message: string;
  /** Hide even validation messages, for reads where they can't help the client. */
  hideDetails?: boolean;
}

export const READ_FAILURE: FailurePolicy = {
  status: 500,
  message: "Server error",
  hideDetails: true,
};
export const WRITE_FAILURE: FailurePolicy = { status: 400, message: "Request failed" };
export const hiddenFailure = (message: string): FailurePolicy => ({
  status: 500,
  message,
  hideDetails: true,
});

/**
 * Wraps a controller, so each one only describes success. An HttpError becomes
 * its response; anything else follows the policy and never leaks internals.
 */
export function handle(
  action: (req: Request, res: Response) => Promise<unknown>,
  failure: FailurePolicy = READ_FAILURE,
) {
  return async (req: Request, res: Response): Promise<void> => {
    try {
      await action(req, res);
    } catch (err: unknown) {
      if (err instanceof HttpError) {
        res.status(err.statusCode).json({ success: false, message: err.message });
        return;
      }
      if (failure.hideDetails) console.error(`[${failure.message}]`, err);
      res.status(failure.status).json({
        success: false,
        message: failure.hideDetails
          ? failure.message
          : publicMessage(err, failure.message),
      });
    }
  };
}
