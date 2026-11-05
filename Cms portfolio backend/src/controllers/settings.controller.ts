import { badRequest, handle, hiddenFailure } from "../lib/http";
import { toShareImageUrl, uploadImage } from "../lib/cloudinary";
import type { SeoPageKey } from "../models/PageSeo";
import { removeOgImageIfUnused } from "../services/file.service";
import * as settings from "../services/settings.service";
import * as socialLinks from "../services/socialLink.service";

const failure = (message: string, status = 500) => ({ status, message });

export const getSiteSettings = handle(async (_req, res) => {
  res.status(200).json({ success: true, settings: await settings.getSettings() });
}, failure("Server error"));

export const updateBrand = handle(async (req, res) => {
  res.status(200).json({ success: true, settings: await settings.updateBrand(req.body, req.file) });
}, failure("Server error"));

// ── Share images ──────────────────────────────────────────────────────

/** Stores the image and returns its link. The form then saves that link. */
export const uploadOgImage = handle(
  async (req, res) => {
    if (!req.file) throw badRequest("Choose an image to upload");

    const uploaded = await uploadImage(req.file.buffer, "portfolio/og");
    // An upload this one replaces before it was ever published. A link that is
    // saved stays until the form is published.
    await removeOgImageIfUnused(req.body?.replaces);
    res.status(201).json({ success: true, url: toShareImageUrl(uploaded) });
  },
  { ...hiddenFailure("Could not store the image. Please try another file."), status: 502 },
);

/** The image was removed from a form. It only goes if nothing saved uses it. */
export const discardOgImage = handle(async (req, res) => {
  await removeOgImageIfUnused(req.body?.url);
  res.status(200).json({ success: true });
});

// ── Social link library ───────────────────────────────────────────────
export const setupSocialLibrary = handle(async (_req, res) => {
  res.status(200).json({ success: true, settings: await socialLinks.setupLibrary() });
}, failure("Failed to set up the library"));

export const createSocial = handle(async (req, res) => {
  res.status(201).json({ success: true, settings: await socialLinks.add(req.body, req.file) });
}, failure("Failed to add the social link"));

export const updateSocial = handle(async (req, res) => {
  const updated = await socialLinks.edit(req.params.id, req.body, req.file);
  res.status(200).json({ success: true, settings: updated });
}, failure("Failed to update the social link"));

export const deleteSocial = handle(async (req, res) => {
  res.status(200).json({ success: true, settings: await socialLinks.remove(req.params.id) });
}, failure("Failed to delete the social link"));

export const updateSocialPlacements = handle(async (req, res) => {
  const updated = await socialLinks.updatePlacements(req.body?.placements);
  res.status(200).json({ success: true, settings: updated });
}, failure("Failed to update the sections"));

// ── SEO ───────────────────────────────────────────────────────────────
export const updateSeo = handle(async (req, res) => {
  res.status(200).json({ success: true, settings: await settings.updateSiteSeo(req.body) });
}, failure("Failed to update SEO", 400));

export const getPageSeo = handle(async (_req, res) => {
  res.status(200).json({ success: true, pages: await settings.getAllPageSeo() });
}, failure("Server error"));

export const updatePageSeo = handle(async (req, res) => {
  const page = req.params.page as SeoPageKey;
  res.status(200).json({ success: true, page, seo: await settings.updatePageSeo(page, req.body) });
}, failure("Failed to update page SEO", 400));
