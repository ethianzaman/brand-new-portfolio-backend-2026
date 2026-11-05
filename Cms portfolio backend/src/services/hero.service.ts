import mongoose from "mongoose";
import { Hero, DEFAULT_HERO } from "../models/Hero";
import { cacheDelete, cacheGet, cacheSet } from "../lib/cache";
import { uploadImage, uploadResume } from "../lib/cloudinary";
import { badRequest, HttpError, notFound } from "../lib/http";
import { publishChange } from "../lib/publish";
import { removeFileIfUnused } from "./file.service";
import { isAllowedHref } from "../utils/request";
import { isSafeImage } from "../utils/seo";

const CACHE_KEY = "hero:data";
const MAX_SOCIALS = 20;
const MAX_STATS = 12;
const MAX_TITLES = 30;

type Body = Record<string, any>;

type HeroDoc = mongoose.HydratedDocument<{
  hero: {
    name: string;
    title: string;
    titles: string[];
    bio: string;
    image: string | null;
    resumeUrl: string;
    socials: { _id: mongoose.Types.ObjectId; label: string; href: string; icon: string }[];
  };
  stats: { _id: mongoose.Types.ObjectId; value: string; label: string }[];
}>;

export interface HeroFiles {
  image?: Express.Multer.File[];
  resume?: Express.Multer.File[];
}

async function getOrCreateDoc(): Promise<HeroDoc> {
  const doc =
    (await Hero.findOne()) ??
    (await Hero.create({
      hero: {
        name: DEFAULT_HERO.name,
        title: DEFAULT_HERO.title,
        titles: DEFAULT_HERO.titles,
        bio: DEFAULT_HERO.bio,
        image: DEFAULT_HERO.image,
        resumeUrl: DEFAULT_HERO.resumeUrl,
        socials: [],
      },
      stats: [],
    }));
  return doc as HeroDoc;
}

/** FormData sends lists as JSON strings. Null when it isn't a list. */
function parseList(raw: unknown): unknown[] | null {
  let list = raw;
  if (typeof raw === "string") {
    try {
      list = JSON.parse(raw);
    } catch {
      return null;
    }
  }
  return Array.isArray(list) ? list : null;
}

function parseSocials(raw: unknown) {
  const list = parseList(raw);
  if (!list) throw badRequest("socials must be a valid JSON array of { label, href, icon }");

  const socials: { label: string; href: string; icon: string }[] = [];
  for (const item of list as any[]) {
    if (typeof item?.label !== "string" || typeof item?.href !== "string") continue;
    const label = item.label.trim();
    const href = item.href.trim();
    const icon = typeof item.icon === "string" ? item.icon.trim().slice(0, 30) : "";
    if (label && href) socials.push({ label, href, icon });
  }

  if (socials.length > MAX_SOCIALS) throw badRequest(`Maximum ${MAX_SOCIALS} socials allowed`);
  for (const social of socials) {
    if (!isAllowedHref(social.href)) throw badRequest(`Invalid social href: ${social.href}`);
  }
  return socials;
}

function parseTitles(raw: unknown) {
  const list = parseList(raw);
  if (!list) throw badRequest("titles must be a valid JSON array of strings");

  const titles = list
    .filter((item): item is string => typeof item === "string" && Boolean(item.trim()))
    .map((item) => item.trim());

  if (titles.length > MAX_TITLES) throw badRequest(`Maximum ${MAX_TITLES} titles allowed`);
  return titles.map((item) => item.slice(0, 100));
}

const statView = (stat: { _id: unknown; value: string; label: string }) => ({
  _id: stat._id,
  value: stat.value,
  label: stat.label,
});

async function announceChange() {
  cacheDelete(CACHE_KEY);
  await publishChange("hero");
}

export async function getHero() {
  const cached = cacheGet<unknown>(CACHE_KEY);
  if (cached) return cached;

  const doc = await getOrCreateDoc();
  const data = {
    hero: {
      name: doc.hero.name,
      title: doc.hero.title,
      titles: doc.hero.titles,
      bio: doc.hero.bio,
      image: doc.hero.image,
      resumeUrl: doc.hero.resumeUrl,
      socials: doc.hero.socials.map((s) => ({ _id: s._id, label: s.label, href: s.href })),
    },
    stats: doc.stats.map(statView),
  };

  cacheSet(CACHE_KEY, data);
  return data;
}

export async function updateHero(body: Body, files?: HeroFiles) {
  const { name, title, bio, socials, titles, resumeUrl, image } = body ?? {};

  if (name !== undefined && !String(name).trim()) throw badRequest("Name is required");
  if (title !== undefined && !String(title).trim()) throw badRequest("Title is required");

  const changes: Record<string, unknown> = {};
  if (name !== undefined) changes["hero.name"] = String(name).trim().slice(0, 100);
  if (title !== undefined) changes["hero.title"] = String(title).trim().slice(0, 200);
  if (bio !== undefined) changes["hero.bio"] = String(bio).trim();
  if (socials !== undefined) changes["hero.socials"] = parseSocials(socials);
  if (titles !== undefined) changes["hero.titles"] = parseTitles(titles);

  const previous = await getOrCreateDoc();
  const previousImage = previous.hero.image;
  const previousResume = previous.hero.resumeUrl;

  const imageFile = files?.image?.[0];
  if (imageFile) {
    if (!imageFile.mimetype.startsWith("image/")) {
      throw badRequest("Hero image must be an image file");
    }
    changes["hero.image"] = await uploadImage(imageFile.buffer, "portfolio_hero");
  } else if (image !== undefined) {
    const link = String(image).trim();
    if (link && !isSafeImage(link)) {
      throw badRequest("Hero image must be an https link or a same-site path");
    }
    changes["hero.image"] = link || null;
  }

  const resumeFile = files?.resume?.[0];
  if (resumeFile) {
    if (resumeFile.mimetype !== "application/pdf") throw badRequest("Resume must be a PDF file");
    changes["hero.resumeUrl"] = await uploadResume(resumeFile.buffer, "portfolio_resume");
  } else if (resumeUrl !== undefined) {
    const link = String(resumeUrl).trim();
    if (!link) throw badRequest("Resume URL cannot be empty");
    changes["hero.resumeUrl"] = link;
  }

  if (Object.keys(changes).length === 0) throw badRequest("No valid fields to update");

  const doc = await Hero.findByIdAndUpdate(
    previous._id,
    { $set: changes },
    { new: true, runValidators: true },
  );
  if (!doc?.hero) throw new HttpError(500, "Hero update failed");

  await removeFileIfUnused(previousImage);
  await removeFileIfUnused(previousResume);
  await announceChange();

  return {
    name: doc.hero.name,
    title: doc.hero.title,
    titles: doc.hero.titles,
    bio: doc.hero.bio,
    image: doc.hero.image,
    resumeUrl: doc.hero.resumeUrl,
    socials: doc.hero.socials.map((s) => ({ _id: s._id, label: s.label, href: s.href, icon: s.icon })),
  };
}

export async function replaceStats(stats: unknown) {
  if (!Array.isArray(stats)) throw badRequest("stats must be an array");
  if (stats.length > MAX_STATS) throw badRequest(`Maximum ${MAX_STATS} stats allowed`);

  const clean = stats.map((stat) => {
    if (!stat || typeof stat !== "object") throw badRequest("Invalid stat item");
    const value = String(stat.value ?? "").trim();
    const label = String(stat.label ?? "").trim();
    if (!value || !label) throw badRequest("Each stat needs value and label");
    return { value: value.slice(0, 50), label: label.slice(0, 100) };
  });

  const doc = await getOrCreateDoc();
  doc.stats = clean as any;
  await doc.save();
  await announceChange();
  return doc.stats.map(statView);
}

export async function addStat(body: Body) {
  const { value, label } = body ?? {};
  if (!value || !label) throw badRequest("value and label are required");

  const doc = await getOrCreateDoc();
  if (doc.stats.length >= MAX_STATS) throw badRequest(`Maximum ${MAX_STATS} stats allowed`);

  doc.stats.push({ value: String(value).slice(0, 50), label: String(label).slice(0, 100) } as any);
  await doc.save();
  await announceChange();
  return statView(doc.stats[doc.stats.length - 1]);
}

function assertStatId(id: string) {
  if (!mongoose.Types.ObjectId.isValid(id)) throw badRequest("Invalid stat ObjectId");
}

export async function editStat(id: string, body: Body) {
  assertStatId(id);

  const { value, label } = body ?? {};
  if (value === undefined && label === undefined) throw badRequest("Nothing to update");

  const doc = await getOrCreateDoc();
  const stat = doc.stats.find((s) => s._id.toString() === id);
  if (!stat) throw notFound("Stat not found");

  if (value !== undefined) stat.value = String(value).slice(0, 50);
  if (label !== undefined) stat.label = String(label).slice(0, 100);
  await doc.save();
  await announceChange();
  return statView(stat);
}

export async function removeStat(id: string) {
  assertStatId(id);

  const doc = await getOrCreateDoc();
  if (!doc.stats.some((s) => s._id.toString() === id)) throw notFound("Stat not found");

  doc.stats = doc.stats.filter((s) => s._id.toString() !== id) as any;
  await doc.save();
  await announceChange();
}
