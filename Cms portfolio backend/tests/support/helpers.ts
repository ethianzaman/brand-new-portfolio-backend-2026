import request from "supertest";
import app from "../../src/app";
import { User, type UserRole } from "../../src/models/User";

export const api = request(app);
export const PASSWORD = "Str0ng-Test-Pass-77!";

/** Creates an account and returns the session cookie to send with requests. */
export async function signIn(
  role: UserRole = "super_admin",
  email = `${role}@test.invalid`,
): Promise<string> {
  await User.create({ email, password: PASSWORD, role, isActive: true });
  const res = await api.post("/api/auth/login").send({ email, password: PASSWORD });
  if (res.status !== 200) throw new Error(`Login failed: ${res.status}`);
  return res.headers["set-cookie"][0].split(";")[0];
}

const VOLATILE_KEYS = new Set([
  "createdAt",
  "updatedAt",
  "lastLoginAt",
  "passwordChangedAt",
  "readAt",
  "repliedAt",
  "publishedAt",
  "publishDate",
  "at",
  "temporaryPassword",
]);
const GENERATED_ID = /\b([0-9a-f]{24}|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\b/g;

const ISO_DATE = /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z/g;

/** Swaps ids, times and generated values so two runs compare equal. */
export function stable(value: unknown): unknown {
  if (typeof value === "string") {
    return value.replace(ISO_DATE, "<date>").replace(GENERATED_ID, "<id>");
  }
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [
        key,
        VOLATILE_KEYS.has(key) && entry ? "<generated>" : stable(entry),
      ]),
    );
  }
  return value;
}

/** What a response promises its caller: the status and the JSON body. */
export function contract(res: request.Response) {
  return { status: res.status, body: stable(res.body) };
}
