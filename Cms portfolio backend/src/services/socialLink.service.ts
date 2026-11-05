import { randomUUID } from "crypto";
import { SOCIAL_PLACEMENT_KEYS } from "../models/SiteSettings";
import type { ISiteSocial, SocialIconType, SocialPlacementKey } from "../models/SiteSettings";
import { uploadImage } from "../lib/cloudinary";
import { badRequest, HttpError, notFound } from "../lib/http";
import { publishChange } from "../lib/publish";
import { removeFileIfUnused } from "./file.service";
import { getOrCreateDoc, readPlacements, serializeSettings } from "./settings.service";
import { ensureSocialLibrary } from "./socialLibrary.service";
import { isAllowedHref } from "../utils/request";

const ICON_MAX = 40;
const URL_MAX = 500;
const LABEL_MAX = 50;
const DESCRIPTION_MAX = 120;
const MAX_SOCIALS = 30;
const LOGO_FOLDER = "portfolio_socials";

const SOCIAL_NOT_FOUND = "Social link not found";

interface SocialInput {
  label: string;
  href: string;
  icon: string;
  iconType: SocialIconType;
  description: string;
}

function parseInput(body: Record<string, unknown>): SocialInput {
  const label = String(body.label ?? "").trim();
  const href = String(body.href ?? "").trim();

  if (!label) throw badRequest("Label is required");
  if (!href) throw badRequest("URL is required");
  if (!isAllowedHref(href)) {
    throw badRequest("URL must start with https://, http://, mailto:, tel:, # or /");
  }

  return {
    label: label.slice(0, LABEL_MAX),
    href: href.slice(0, URL_MAX),
    icon: String(body.icon ?? "link").trim().slice(0, ICON_MAX) || "link",
    iconType: body.iconType === "image" ? "image" : "icon",
    description: String(body.description ?? "").trim().slice(0, DESCRIPTION_MAX),
  };
}

async function loadLibrary() {
  const doc = await getOrCreateDoc();
  await ensureSocialLibrary(doc);
  return doc;
}

/**
 * Removes a logo the save didn't keep. Cloudinary answers 400 for a file that
 * isn't really an image, and that's for the admin to fix.
 */
async function failUpload(err: unknown, uploadedUrl: string): Promise<never> {
  if (uploadedUrl) await removeFileIfUnused(uploadedUrl);
  const { statusCode, message } = err as { statusCode?: number; message?: string };
  if (statusCode === 400 && message) throw badRequest(message);
  throw err;
}

/** Merges the old per-section lists into the library. Safe to call twice. */
export async function setupLibrary() {
  const doc = await loadLibrary();
  await (doc as any).save();
  await publishChange("settings");
  return serializeSettings(doc);
}

export async function add(body: Record<string, unknown>, file?: Express.Multer.File) {
  let uploadedUrl = "";

  try {
    const input = parseInput(body ?? {});
    if (input.iconType === "image" && !file) throw badRequest("Choose a logo image to upload");

    const doc = await loadLibrary();
    if (doc.socials.length >= MAX_SOCIALS) {
      throw badRequest(`Maximum ${MAX_SOCIALS} social links allowed`);
    }

    if (input.iconType === "image" && file) {
      uploadedUrl = await uploadImage(file.buffer, LOGO_FOLDER);
    }

    (doc.socials as ISiteSocial[]).push({ ...input, id: randomUUID(), imageUrl: uploadedUrl });
    await (doc as any).save();

    await publishChange("settings");
    return serializeSettings(doc);
  } catch (err) {
    return failUpload(err, uploadedUrl);
  }
}

export async function edit(id: string, body: Record<string, unknown>, file?: Express.Multer.File) {
  let uploadedUrl = "";

  try {
    const input = parseInput(body ?? {});
    const doc = await loadLibrary();

    const social = (doc.socials as ISiteSocial[]).find((item) => item.id === id);
    if (!social) throw notFound(SOCIAL_NOT_FOUND);

    const previousUrl = social.imageUrl;
    if (input.iconType === "image" && !file && !previousUrl) {
      throw badRequest("Choose a logo image to upload");
    }

    if (input.iconType === "image" && file) {
      uploadedUrl = await uploadImage(file.buffer, LOGO_FOLDER);
    }

    const nextUrl = input.iconType === "image" ? uploadedUrl || previousUrl : "";
    Object.assign(social, input, { imageUrl: nextUrl });
    await (doc as any).save();

    // The database no longer points at the old file, so it is safe to remove.
    if (previousUrl && previousUrl !== nextUrl) await removeFileIfUnused(previousUrl);

    await publishChange("settings");
    return serializeSettings(doc);
  } catch (err) {
    if (err instanceof HttpError) throw err;
    return failUpload(err, uploadedUrl);
  }
}

/** Also takes it out of every section that showed it. */
export async function remove(id: string) {
  const doc = await loadLibrary();

  const socials = doc.socials as ISiteSocial[];
  const social = socials.find((item) => item.id === id);
  if (!social) throw notFound(SOCIAL_NOT_FOUND);

  const { imageUrl } = social;
  doc.socials = socials.filter((item) => item.id !== social.id) as any;

  const placements = readPlacements(doc);
  for (const key of SOCIAL_PLACEMENT_KEYS) {
    placements[key] = placements[key].filter((linkId) => linkId !== social.id);
  }
  doc.socialPlacements = placements;
  await (doc as any).save();

  if (imageUrl) await removeFileIfUnused(imageUrl);

  await publishChange("settings");
  return serializeSettings(doc);
}

export async function updatePlacements(raw: unknown) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw badRequest("placements must be an object");
  }
  const input = raw as Record<string, unknown>;

  const unknownKey = Object.keys(input).find(
    (key) => !SOCIAL_PLACEMENT_KEYS.includes(key as SocialPlacementKey),
  );
  if (unknownKey) throw badRequest(`Unknown section: ${unknownKey}`);

  const doc = await loadLibrary();
  const validIds = new Set((doc.socials as ISiteSocial[]).map((item) => item.id));
  const next = readPlacements(doc);

  for (const key of Object.keys(input) as SocialPlacementKey[]) {
    const ids = input[key];
    if (!Array.isArray(ids) || ids.some((id) => typeof id !== "string")) {
      throw badRequest(`${key} must be a list of link ids`);
    }
    if (ids.find((id) => !validIds.has(id))) {
      throw badRequest(`${key} refers to a link that no longer exists`);
    }
    next[key] = [...new Set(ids as string[])];
  }

  doc.socialPlacements = next;
  await (doc as any).save();

  await publishChange("settings");
  return serializeSettings(doc);
}
