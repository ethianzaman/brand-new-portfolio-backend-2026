import crypto from "crypto";
import mongoose from "mongoose";
import { User, USER_ROLES, type IUser } from "../models/User";
import { badRequest, conflict, HttpError, notFound } from "../lib/http";

type Body = Record<string, any>;
type Actor = { id: string; role: string };

const INVALID_ROLE = "Role must be super admin, admin, manager or editor.";
const EMAIL_IN_USE = "An account with this email already exists.";

/** 12 URL-safe characters, returned once so an admin can share it. */
function generateTempPassword(): string {
  return crypto.randomBytes(9).toString("base64url");
}

/** Only a Super Admin may touch a Super Admin account, or create one. */
function assertMayTouchRole(actor: Actor, role: string, action: string) {
  if (role === "super_admin" && actor.role !== "super_admin") {
    throw new HttpError(403, `Only a Super Admin can ${action} a Super Admin.`);
  }
}

/** True when this is the only active Super Admin left. */
async function isLastSuperAdmin(user: IUser): Promise<boolean> {
  if (user.role !== "super_admin" || !user.isActive) return false;
  const others = await User.countDocuments({
    role: "super_admin",
    isActive: true,
    _id: { $ne: user._id.toString() },
  });
  return others === 0;
}

function assertUserId(id: string) {
  if (!mongoose.isValidObjectId(id)) throw badRequest("Invalid user ID.");
}

async function findUser(id: string) {
  const user = await User.findById(id);
  if (!user) throw notFound("User not found.");
  return user;
}

/** Public shape: never includes the password hash. */
function serializeUser(user: IUser) {
  return {
    id: user._id.toString(),
    email: user.email,
    role: user.role,
    isActive: user.isActive,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

export async function list(q: unknown) {
  const search = typeof q === "string" ? q.trim() : "";
  const filter = search
    ? { email: { $regex: search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" } }
    : {};

  const users = await User.find(filter).sort({ createdAt: -1 });
  return { users: users.map(serializeUser), total: users.length };
}

export async function create(actor: Actor, body: Body) {
  const email = String(body.email ?? "").trim().toLowerCase();
  const role = body.role;
  const provided = typeof body.password === "string" && body.password.length > 0 ? body.password : null;

  if (!email) throw badRequest("Email is required.");
  if (!USER_ROLES.includes(role)) throw badRequest(INVALID_ROLE);
  assertMayTouchRole(actor, role, "create");
  if (provided !== null && provided.length < 8) {
    throw badRequest("Password must be at least 8 characters.");
  }

  if (await User.findOne({ email })) throw conflict(EMAIL_IN_USE);

  const password = provided ?? generateTempPassword();
  try {
    const user = await User.create({ email, password, role, isActive: true });
    return {
      user: serializeUser(user),
      ...(provided ? {} : { temporaryPassword: password }),
    };
  } catch (err: any) {
    if (err?.code === 11000) throw conflict(EMAIL_IN_USE);
    throw err;
  }
}

/**
 * Gives another user a new temporary password and signs them out everywhere.
 * A Super Admin's password is theirs alone: they change it themselves, or use
 * `npm run reset-password` on the server if they are locked out.
 */
export async function resetPassword(actor: Actor, id: string) {
  if (id === actor.id) throw badRequest("Use Change password for your own account.");

  const user = await findUser(id);
  if (user.role === "super_admin") {
    throw new HttpError(403, "A Super Admin changes their own password.");
  }

  const temporaryPassword = generateTempPassword();
  user.password = temporaryPassword;
  user.tokenVersion = (user.tokenVersion ?? 0) + 1;
  await user.save();

  return { user: serializeUser(user), temporaryPassword };
}

export async function changeRole(actor: Actor, id: string, role: any) {
  assertUserId(id);
  if (!USER_ROLES.includes(role)) throw badRequest(INVALID_ROLE);
  if (id === actor.id) throw badRequest("You cannot change your own role.");
  assertMayTouchRole(actor, role, "assign");

  const user = await findUser(id);
  assertMayTouchRole(actor, user.role, "change");

  if (role !== "super_admin" && (await isLastSuperAdmin(user))) {
    throw badRequest("Cannot change the role of the last active Super Admin.");
  }

  user.role = role;
  await user.save();
  return serializeUser(user);
}

export async function setActive(actor: Actor, id: string, isActive: unknown) {
  assertUserId(id);
  if (typeof isActive !== "boolean") throw badRequest("isActive must be a boolean.");
  if (!isActive && id === actor.id) throw badRequest("You cannot disable your own account.");

  const user = await findUser(id);
  assertMayTouchRole(actor, user.role, "change");

  if (!isActive && (await isLastSuperAdmin(user))) {
    throw badRequest("Cannot disable the last active Super Admin.");
  }

  user.isActive = isActive;
  await user.save();
  return serializeUser(user);
}

export async function remove(actor: Actor, id: string) {
  assertUserId(id);
  if (id === actor.id) throw badRequest("You cannot delete your own account.");

  const user = await findUser(id);
  assertMayTouchRole(actor, user.role, "delete");

  if (await isLastSuperAdmin(user)) {
    throw badRequest("Cannot delete the last active Super Admin.");
  }

  await user.deleteOne();
  return user._id.toString();
}
