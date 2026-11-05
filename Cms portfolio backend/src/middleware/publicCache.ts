import type { NextFunction, Request, Response } from "express";
import { cacheGet, cacheSet } from "../lib/cache";

/**
 * Serves a public GET from memory instead of the database. Entries live under
 * the same tag as `publishChange(tag)`, which clears them on every write, so a
 * dashboard edit shows straight away.
 */
export function publicCache(tag: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const key = `public:${tag}:${req.originalUrl}`;
    const hit = cacheGet<string>(key);

    if (hit !== undefined) {
      res.type("application/json").send(hit);
      return;
    }

    const sendJson = res.json.bind(res);
    res.json = (body: unknown) => {
      if (res.statusCode === 200) cacheSet(key, JSON.stringify(body));
      return sendJson(body);
    };

    next();
  };
}
