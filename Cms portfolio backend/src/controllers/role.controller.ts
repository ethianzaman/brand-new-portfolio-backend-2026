import type { Response } from "express";
import { handle, badRequest } from "../lib/http";
import {
  ALL_PERMISSIONS,
  PERMISSION_SECTIONS,
  loadRolePermissions,
  normalisePermissions,
  saveRolePermissions,
} from "../lib/permissions";
import { CONFIGURABLE_ROLES } from "../models/User";

async function sendConfig(res: Response): Promise<void> {
  res.status(200).json({
    success: true,
    sections: PERMISSION_SECTIONS,
    roles: {
      super_admin: ALL_PERMISSIONS,
      ...(await loadRolePermissions()),
    },
  });
}

export const getRolePermissions = handle(
  (_req, res) => sendConfig(res),
  { status: 500, message: "Failed to load permissions." },
);

/** Super Admin only. Its own access is deliberately not editable. */
export const updateRolePermissions = handle(
  async (req, res) => {
    const raw = req.body?.roles;
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
      throw badRequest("roles must be an object.");
    }

    const roles: Record<string, string[]> = {};
    for (const [role, value] of Object.entries(raw)) {
      if (!(CONFIGURABLE_ROLES as readonly string[]).includes(role)) {
        throw badRequest(`Permissions for "${role}" cannot be changed.`);
      }
      const permissions = normalisePermissions(value);
      if (!permissions) throw badRequest(`${role} must be a list of permissions.`);
      roles[role] = permissions;
    }

    await saveRolePermissions(roles);
    await sendConfig(res);
  },
  { status: 500, message: "Failed to save permissions." },
);
