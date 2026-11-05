import { CONFIGURABLE_ROLES, type UserRole } from "../models/User";
import { RolePermission } from "../models/RolePermission";
import { cacheDelete, cacheGet, cacheSet } from "./cache";

export type PermissionAction = "view" | "create" | "edit" | "delete";

const FULL: PermissionAction[] = ["view", "create", "edit", "delete"];

/** Every dashboard section and the actions that mean something for it. */
export const PERMISSION_SECTIONS = [
  { key: "hero", label: "Hero", actions: FULL },
  { key: "about", label: "About", actions: FULL },
  { key: "projects", label: "Projects", actions: FULL },
  { key: "skills", label: "Skills", actions: FULL },
  { key: "services", label: "Services", actions: FULL },
  { key: "blog", label: "Blogs", actions: FULL },
  { key: "contact", label: "Contact", actions: FULL },
  { key: "messages", label: "Messages", actions: ["view", "edit", "delete"] },
  { key: "socialLinks", label: "Social Links", actions: FULL },
  { key: "seo", label: "SEO", actions: ["view", "edit"] },
  { key: "settings", label: "Site Settings", actions: ["view", "edit"] },
  { key: "users", label: "Users", actions: FULL },
] as const satisfies readonly {
  key: string;
  label: string;
  actions: readonly PermissionAction[];
}[];

type Section = (typeof PERMISSION_SECTIONS)[number];
export type PermissionKey = {
  [S in Section as S["key"]]: `${S["key"]}.${S["actions"][number]}`;
}[Section["key"]];

export const ALL_PERMISSIONS = PERMISSION_SECTIONS.flatMap((section) =>
  section.actions.map((action) => `${section.key}.${action}`),
) as PermissionKey[];

const withoutUsers = ALL_PERMISSIONS.filter((key) => !key.startsWith("users."));

/** The access each role had before permissions became editable. */
export const DEFAULT_ROLE_PERMISSIONS: Record<
  (typeof CONFIGURABLE_ROLES)[number],
  readonly string[]
> = {
  admin: ALL_PERMISSIONS,
  manager: withoutUsers,
  editor: withoutUsers.filter((key) => !key.endsWith(".delete")),
};

const CACHE_KEY = "role-permissions";
const CACHE_TTL_MS = 30_000;

type RoleMap = Record<string, readonly string[]>;

/** Stored permissions per role, falling back to the defaults. Read on every guarded request. */
export async function loadRolePermissions(): Promise<RoleMap> {
  const cached = cacheGet<RoleMap>(CACHE_KEY);
  if (cached) return cached;

  const docs = await RolePermission.find({
    role: { $in: CONFIGURABLE_ROLES },
  }).lean<{ role: string; permissions: string[] }[]>();

  const roles: RoleMap = { ...DEFAULT_ROLE_PERMISSIONS };
  for (const doc of docs) roles[doc.role] = doc.permissions;

  cacheSet(CACHE_KEY, roles, CACHE_TTL_MS);
  return roles;
}

export async function permissionsForRole(role: UserRole): Promise<readonly string[]> {
  if (role === "super_admin") return ALL_PERMISSIONS;
  return (await loadRolePermissions())[role] ?? [];
}

/** Drops unknown keys, and adds `view` wherever a section grants anything else. */
export function normalisePermissions(raw: unknown): string[] | null {
  if (!Array.isArray(raw) || raw.some((key) => typeof key !== "string")) {
    return null;
  }

  const granted = new Set<string>();
  for (const key of raw as string[]) {
    if ((ALL_PERMISSIONS as string[]).includes(key)) {
      granted.add(key);
      granted.add(`${key.split(".")[0]}.view`);
    }
  }

  return ALL_PERMISSIONS.filter((key) => granted.has(key));
}

export async function saveRolePermissions(
  roles: Record<string, string[]>,
): Promise<void> {
  await Promise.all(
    Object.entries(roles).map(([role, permissions]) =>
      RolePermission.updateOne(
        { role },
        { $set: { permissions } },
        { upsert: true },
      ),
    ),
  );
  cacheDelete(CACHE_KEY);
}
