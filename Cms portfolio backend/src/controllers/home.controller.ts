import { Request, Response } from "express";
import mongoose from "mongoose";
import { HomeHero, DEFAULT_HOME_HERO } from "../models/homeHero";
import {
  deleteFromCloudinary,
  deleteResumeFromCloudinary,
  uploadResumeToCloudinary,
  uploadToCloudinary,
} from "../middleware/uploadMiddleware";
import { cacheGet, cacheSet, cacheDelete } from "../utils/cache";
import { publishChange } from "../lib/publish";

const CACHE_KEY = "home:data";
const MAX_SOCIALS = 20;
const MAX_STATS = 12;
const MAX_TITLES = 30;

type HomeDoc = mongoose.HydratedDocument<{
  hero: {
    name: string;
    title: string;
    titles: string[];
    bio: string;
    image: string | null;
    resumeUrl: string;
    socials: {
      _id: mongoose.Types.ObjectId;
      label: string;
      href: string;
      icon: string;
    }[];
  };
  stats: { _id: mongoose.Types.ObjectId; value: string; label: string }[];
}>;

// ── Helpers ─────────────────────────────────────────────────────
async function getOrCreateDoc(): Promise<HomeDoc> {
  let doc = await HomeHero.findOne();
  if (!doc) {
    doc = await HomeHero.create({
      hero: {
        name: DEFAULT_HOME_HERO.name,
        title: DEFAULT_HOME_HERO.title,
        titles: DEFAULT_HOME_HERO.titles,
        bio: DEFAULT_HOME_HERO.bio,
        image: DEFAULT_HOME_HERO.image,
        resumeUrl: DEFAULT_HOME_HERO.resumeUrl,
        socials: [],
      },
      stats: [],
    });
  }
  return doc as HomeDoc;
}

function parseSocials(
  raw: unknown,
): { label: string; href: string; icon: string }[] | null {
  let list: unknown = raw;

  // FormData থেকে আসা JSON string কে parse করা
  if (typeof raw === "string") {
    try {
      list = JSON.parse(raw);
    } catch {
      return null;
    }
  }

  if (!Array.isArray(list)) return null;

  const socials: { label: string; href: string; icon: string }[] = [];

  for (const item of list) {
    if (
      item &&
      typeof item === "object" &&
      typeof (item as any).label === "string" &&
      typeof (item as any).href === "string"
    ) {
      const label = (item as any).label.trim();
      const href = (item as any).href.trim();
      const icon =
        typeof (item as any).icon === "string"
          ? (item as any).icon.trim().slice(0, 30)
          : "";
      if (label && href) socials.push({ label, href, icon });
    }
  }

  return socials;
}

function parseTitles(raw: unknown): string[] | null {
  let list: unknown = raw;

  // FormData থেকে আসা JSON string কে parse করা
  if (typeof raw === "string") {
    try {
      list = JSON.parse(raw);
    } catch {
      return null;
    }
  }

  if (!Array.isArray(list)) return null;

  const titles: string[] = [];
  for (const item of list) {
    if (typeof item === "string" && item.trim()) {
      titles.push(item.trim());
    }
  }

  return titles;
}

function isValidUrl(url: string): boolean {
  return /^(https?:\/\/|mailto:|tel:|#|\/)/.test(url);
}

function sendDoc(res: Response, doc: HomeDoc) {
  const home = {
    hero: {
      name: doc.hero.name,
      title: doc.hero.title,
      titles: doc.hero.titles,
      bio: doc.hero.bio,
      image: doc.hero.image,
      resumeUrl: doc.hero.resumeUrl,
      socials: doc.hero.socials.map((s) => ({
        _id: s._id,
        label: s.label,
        href: s.href,
        icon: s.icon,
      })),
    },
    stats: doc.stats.map((s) => ({
      _id: s._id,
      value: s.value,
      label: s.label,
    })),
  };
  res.status(200).json({ success: true, home });
}

function invalidate() {
  cacheDelete(CACHE_KEY);
}

// ── GET /api/home — public (cached, fast) ───────────────────────
export async function getHome(req: Request, res: Response): Promise<void> {
  try {
    // 1️⃣ Cache hit হলে DB hit ছাড়াই রেসপন্স
    const cached = cacheGet<any>(CACHE_KEY);
    if (cached) {
      res.status(200).json({ success: true, home: cached });
      return;
    }

    // 2️⃣ Cache miss → DB থেকে পড়া (প্রথমবার হলে default doc তৈরি)
    const doc = await getOrCreateDoc();

    const home = {
      hero: {
        name: doc.hero.name,
        title: doc.hero.title,
        titles: doc.hero.titles,
        bio: doc.hero.bio,
        image: doc.hero.image,
        resumeUrl: doc.hero.resumeUrl,
        socials: doc.hero.socials.map((s) => ({
          _id: s._id,
          label: s.label,
          href: s.href,
        })),
      },
      stats: doc.stats.map((s) => ({
        _id: s._id,
        value: s.value,
        label: s.label,
      })),
    };

    cacheSet(CACHE_KEY, home);
    res.status(200).json({ success: true, home });
  } catch {
    res.status(500).json({ success: false, message: "Server error" });
  }
}


// ── PUT /api/home/hero — update hero (FormData) ─────────────────

export async function updateHero(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    const {
      name,
      title,
      bio,
      socials,
      titles,
      resumeUrl,
    } = req.body ?? {};


    const files = req.files as
      | {
        image?: Express.Multer.File[];
        resume?: Express.Multer.File[];
      }
      | undefined;

    // ======================================================
    // 1. BASIC VALIDATION
    // ======================================================

    if (name !== undefined && !String(name).trim()) {
      res.status(400).json({
        success: false,
        message: "Name is required",
      });
      return;
    }

    if (title !== undefined && !String(title).trim()) {
      res.status(400).json({
        success: false,
        message: "Title is required",
      });
      return;
    }

    // ======================================================
    // 2. BUILD UPDATE FIELDS
    // ======================================================

    const updateFields: Record<string, unknown> = {};

    if (name !== undefined) {
      updateFields["hero.name"] = String(name)
        .trim()
        .slice(0, 100);
    }

    if (title !== undefined) {
      updateFields["hero.title"] = String(title)
        .trim()
        .slice(0, 200);
    }

    if (bio !== undefined) {
      updateFields["hero.bio"] = String(bio).trim();
    }

    // ======================================================
    // 3. SOCIALS
    // ======================================================

    if (socials !== undefined) {
      const parsedSocials = parseSocials(socials);

      if (!parsedSocials) {
        res.status(400).json({
          success: false,
          message:
            "socials must be a valid JSON array of { label, href, icon }",
        });
        return;
      }

      if (parsedSocials.length > MAX_SOCIALS) {
        res.status(400).json({
          success: false,
          message: `Maximum ${MAX_SOCIALS} socials allowed`,
        });
        return;
      }

      for (const social of parsedSocials) {
        if (!isValidUrl(social.href)) {
          res.status(400).json({
            success: false,
            message: `Invalid social href: ${social.href}`,
          });
          return;
        }
      }

      updateFields["hero.socials"] = parsedSocials;
    }

    // ======================================================
    // 4. TITLES
    // ======================================================

    if (titles !== undefined) {
      const parsedTitles = parseTitles(titles);

      if (!parsedTitles) {
        res.status(400).json({
          success: false,
          message:
            "titles must be a valid JSON array of strings",
        });
        return;
      }

      if (parsedTitles.length > MAX_TITLES) {
        res.status(400).json({
          success: false,
          message: `Maximum ${MAX_TITLES} titles allowed`,
        });
        return;
      }

      updateFields["hero.titles"] = parsedTitles.map((item) =>
        item.slice(0, 100),
      );
    }

    // ======================================================
    // 5. GET RESUME FILE
    // ======================================================

    const imageFile = files?.image?.[0];
    const resumeFile = files?.resume?.[0];

    // ======================================================
    // 6. GET OLD DOCUMENT
    // ======================================================

    const oldDoc = await getOrCreateDoc();

    const oldResumeUrl = oldDoc.hero.resumeUrl;


    if (imageFile) {
      if (!imageFile.mimetype.startsWith("image/")) {
        res.status(400).json({
          success: false,
          message: "Hero image must be an image file",
        });
        return;
      }

      const newImageUrl = await uploadToCloudinary(
        imageFile.buffer,
        "portfolio_hero",
      );

      updateFields["hero.image"] = newImageUrl;
    }

    // ======================================================
    // 7. RESUME / PDF
    // ======================================================

    if (resumeFile) {
      // -----------------------------------------------
      // PDF FILE UPLOAD
      // -----------------------------------------------

      if (resumeFile.mimetype !== "application/pdf") {
        res.status(400).json({
          success: false,
          message: "Resume must be a PDF file",
        });
        return;
      }

      const newResumeUrl = await uploadResumeToCloudinary(
        resumeFile.buffer,
        "portfolio_resume",
      );

      updateFields["hero.resumeUrl"] = newResumeUrl;
    } else if (resumeUrl !== undefined) {
      // -----------------------------------------------
      // DIRECT URL
      // -----------------------------------------------

      const directUrl = String(resumeUrl).trim();

      if (!directUrl) {
        res.status(400).json({
          success: false,
          message: "Resume URL cannot be empty",
        });
        return;
      }

      updateFields["hero.resumeUrl"] = directUrl;
    }

    // ======================================================
    // 8. NOTHING TO UPDATE
    // ======================================================

    if (Object.keys(updateFields).length === 0) {
      res.status(400).json({
        success: false,
        message: "No valid fields to update",
      });
      return;
    }

    // ======================================================
    // 9. UPDATE DATABASE
    // ======================================================

    const doc = await HomeHero.findByIdAndUpdate(
      oldDoc._id,
      {
        $set: updateFields,
      },
      {
        new: true,
        runValidators: true,
      },
    );

    if (!doc || !doc.hero) {
      res.status(500).json({
        success: false,
        message: "Hero update failed",
      });
      return;
    }

    // ======================================================
    // 10. DELETE OLD RESUME
    // ======================================================

    const newResumeUrl = updateFields["hero.resumeUrl"];

    if (
      typeof newResumeUrl === "string" &&
      oldResumeUrl &&
      oldResumeUrl !== newResumeUrl
    ) {
      // শুধু পুরোনো URL Cloudinary হলে
      // Cloudinary থেকে actual PDF delete হবে

      if (oldResumeUrl.includes("res.cloudinary.com")) {
        await deleteResumeFromCloudinary(oldResumeUrl);
      }

      console.log("✅ Old resume replaced");
    }

    // ======================================================
    // 11. CACHE INVALIDATION
    // ======================================================

    invalidate();


    // Drop the frontend's "home" cache tag, then tell every open

    // public tab to refresh. Best-effort: never fails this request.

    await publishChange("home");
    // ======================================================
    // 12. RESPONSE
    // ======================================================

    res.status(200).json({
      success: true,
      message: "Hero updated successfully",

      hero: {
        name: doc.hero.name,
        title: doc.hero.title,
        titles: doc.hero.titles,
        bio: doc.hero.bio,
        image: doc.hero.image,
        resumeUrl: doc.hero.resumeUrl,

        socials: doc.hero.socials.map((social) => ({
          _id: social._id,
          label: social.label,
          href: social.href,
          icon: social.icon,
        })),
      },
    });
  } catch (error) {
    console.error("❌ Hero Update Error:", error);

    const message =
      error instanceof Error
        ? error.message
        : "Server error";

    res.status(500).json({
      success: false,
      message,
    });
  }
}

// ── PUT /api/home/stats — replace all stats (frontend contract) ─


export async function replaceStats(req: Request, res: Response): Promise<void> {
  try {
    const { stats } = req.body ?? {};

    if (!Array.isArray(stats)) {
      res
        .status(400)
        .json({ success: false, message: "stats must be an array" });
      return;
    }
    if (stats.length > MAX_STATS) {
      res.status(400).json({
        success: false,
        message: `Maximum ${MAX_STATS} stats allowed`,
      });
      return;
    }

    const clean: { value: string; label: string }[] = [];
    for (const s of stats) {
      if (!s || typeof s !== "object") {
        res.status(400).json({ success: false, message: "Invalid stat item" });
        return;
      }
      const value = String((s as any).value ?? "").trim();
      const label = String((s as any).label ?? "").trim();
      if (!value || !label) {
        res.status(400).json({
          success: false,
          message: "Each stat needs value and label",
        });
        return;
      }
      clean.push({ value: value.slice(0, 50), label: label.slice(0, 100) });
    }

    const doc = await getOrCreateDoc();
    doc.stats = clean as any;
    await doc.save();

    invalidate();


    // Drop the frontend's "home" cache tag, then tell every open

    // public tab to refresh. Best-effort: never fails this request.

    await publishChange("home");
    res.status(200).json({
      success: true,
      stats: doc.stats.map((s) => ({
        _id: s._id,
        value: s.value,
        label: s.label,
      })),
    });
  } catch {
    res.status(500).json({ success: false, message: "Server error" });
  }
}

// ── POST /api/home/stats — add one stat ─────────────────────────
export async function createStat(req: Request, res: Response): Promise<void> {
  try {
    const { value, label } = req.body ?? {};

    if (!value || !label) {
      res
        .status(400)
        .json({ success: false, message: "value and label are required" });
      return;
    }

    const doc = await getOrCreateDoc();
    if (doc.stats.length >= MAX_STATS) {
      res.status(400).json({
        success: false,
        message: `Maximum ${MAX_STATS} stats allowed`,
      });
      return;
    }

    doc.stats.push({
      value: String(value).slice(0, 50),
      label: String(label).slice(0, 100),
    } as any);
    await doc.save();

    invalidate();


    // Drop the frontend's "home" cache tag, then tell every open

    // public tab to refresh. Best-effort: never fails this request.

    await publishChange("home");
    const created = doc.stats[doc.stats.length - 1];
    res.status(201).json({
      success: true,
      stat: { _id: created._id, value: created.value, label: created.label },
    });
  } catch {
    res.status(500).json({ success: false, message: "Server error" });
  }
}

// ── PUT /api/home/stats/:id — update one stat ───────────────────
export async function updateStat(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      res
        .status(400)
        .json({ success: false, message: "Invalid stat ObjectId" });
      return;
    }

    const { value, label } = req.body ?? {};
    if (value === undefined && label === undefined) {
      res.status(400).json({ success: false, message: "Nothing to update" });
      return;
    }

    const doc = await getOrCreateDoc();
    const stat = doc.stats.find((s) => s._id.toString() === id);

    if (!stat) {
      res.status(404).json({ success: false, message: "Stat not found" });
      return;
    }

    if (value !== undefined) stat.value = String(value).slice(0, 50);
    if (label !== undefined) stat.label = String(label).slice(0, 100);
    await doc.save();

    invalidate();


    // Drop the frontend's "home" cache tag, then tell every open

    // public tab to refresh. Best-effort: never fails this request.

    await publishChange("home");
    res.status(200).json({
      success: true,
      stat: { _id: stat._id, value: stat.value, label: stat.label },
    });
  } catch {
    res.status(500).json({ success: false, message: "Server error" });
  }
}

// ── DELETE /api/home/stats/:id — delete one stat ────────────────
export async function deleteStat(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      res
        .status(400)
        .json({ success: false, message: "Invalid stat ObjectId" });
      return;
    }

    const doc = await getOrCreateDoc();
    const exists = doc.stats.some((s) => s._id.toString() === id);

    if (!exists) {
      res.status(404).json({ success: false, message: "Stat not found" });
      return;
    }

    doc.stats = doc.stats.filter((s) => s._id.toString() !== id) as any;
    await doc.save();

    invalidate();


    // Drop the frontend's "home" cache tag, then tell every open

    // public tab to refresh. Best-effort: never fails this request.

    await publishChange("home");
    res
      .status(200)
      .json({ success: true, message: "Stat deleted successfully" });
  } catch {
    res.status(500).json({ success: false, message: "Server error" });
  }
}

// ── POST /api/home/socials — add one social ─────────────────────
export async function createSocial(req: Request, res: Response): Promise<void> {
  try {
    const { label, href, icon } = req.body ?? {};

    if (!label || !href) {
      res
        .status(400)
        .json({ success: false, message: "label and href are required" });
      return;
    }
    if (!isValidUrl(String(href))) {
      res.status(400).json({ success: false, message: "Invalid href" });
      return;
    }

    const doc = await getOrCreateDoc();
    if (doc.hero.socials.length >= MAX_SOCIALS) {
      res.status(400).json({
        success: false,
        message: `Maximum ${MAX_SOCIALS} socials allowed`,
      });
      return;
    }

    doc.hero.socials.push({
      label: String(label).slice(0, 50),
      href: String(href).slice(0, 500),
      icon: icon ? String(icon).trim().slice(0, 30) : "",
    } as any);
    await doc.save();

    invalidate();


    // Drop the frontend's "home" cache tag, then tell every open

    // public tab to refresh. Best-effort: never fails this request.

    await publishChange("home");
    const created = doc.hero.socials[doc.hero.socials.length - 1];
    res.status(201).json({
      success: true,
      social: {
        _id: created._id,
        label: created.label,
        href: created.href,
        icon: created.icon,
      },
    });
  } catch {
    res.status(500).json({ success: false, message: "Server error" });
  }
}

// ── PUT /api/home/socials/:id — update one social ───────────────
export async function updateSocial(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      res
        .status(400)
        .json({ success: false, message: "Invalid social ObjectId" });
      return;
    }

    const { label, href, icon } = req.body ?? {};
    if (label === undefined && href === undefined && icon === undefined) {
      res.status(400).json({ success: false, message: "Nothing to update" });
      return;
    }
    if (href !== undefined && !isValidUrl(String(href))) {
      res.status(400).json({ success: false, message: "Invalid href" });
      return;
    }

    const doc = await getOrCreateDoc();
    const social = doc.hero.socials.find((s) => s._id.toString() === id);

    if (!social) {
      res.status(404).json({ success: false, message: "Social not found" });
      return;
    }

    if (label !== undefined) social.label = String(label).slice(0, 50);
    if (href !== undefined) social.href = String(href).slice(0, 500);
    if (icon !== undefined) social.icon = String(icon).trim().slice(0, 30);
    await doc.save();

    invalidate();


    // Drop the frontend's "home" cache tag, then tell every open

    // public tab to refresh. Best-effort: never fails this request.

    await publishChange("home");
    res.status(200).json({
      success: true,
      social: {
        _id: social._id,
        label: social.label,
        href: social.href,
        icon: social.icon,
      },
    });
  } catch {
    res.status(500).json({ success: false, message: "Server error" });
  }
}

// ── DELETE /api/home/socials/:id — delete one social ────────────
export async function deleteSocial(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      res
        .status(400)
        .json({ success: false, message: "Invalid social ObjectId" });
      return;
    }

    const doc = await getOrCreateDoc();
    const exists = doc.hero.socials.some((s) => s._id.toString() === id);

    if (!exists) {
      res.status(404).json({ success: false, message: "Social not found" });
      return;
    }

    doc.hero.socials = doc.hero.socials.filter(
      (s) => s._id.toString() !== id,
    ) as any;
    await doc.save();

    invalidate();


    // Drop the frontend's "home" cache tag, then tell every open

    // public tab to refresh. Best-effort: never fails this request.

    await publishChange("home");
    res
      .status(200)
      .json({ success: true, message: "Social deleted successfully" });
  } catch {
    res.status(500).json({ success: false, message: "Server error" });
  }
}

// ── Helper export (test / admin tooling) ────────────────────────
export { sendDoc };
