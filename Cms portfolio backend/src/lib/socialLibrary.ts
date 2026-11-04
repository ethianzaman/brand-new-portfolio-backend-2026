import { randomUUID } from "crypto";

import { Contact } from "../models/Contact";
import { HomeHero } from "../models/homeHero";
import {
  SOCIAL_PLACEMENT_KEYS,
  type ISiteSocial,
  type SocialPlacementKey,
  type SocialPlacements,
} from "../models/SiteSettings";

type LegacyLink = { label?: string; href?: string; icon?: string };

export interface SocialLibraryPlan {
  socials: ISiteSocial[];
  placements: SocialPlacements;
  /** Links that came from the Home Hero or Contact documents. */
  added: string[];
}

const KNOWN_NETWORKS = [
  "github",
  "linkedin",
  "twitter",
  "facebook",
  "instagram",
  "tiktok",
];

const CONTACT_LINKS = [
  { key: "github", label: "GitHub", description: "Check my open source work" },
  { key: "linkedin", label: "LinkedIn", description: "Connect professionally" },
  { key: "twitter", label: "Twitter", description: "Follow for dev updates" },
] as const;

export function emptyPlacements(): SocialPlacements {
  return Object.fromEntries(
    SOCIAL_PLACEMENT_KEYS.map((key) => [key, [] as string[]]),
  ) as unknown as SocialPlacements;
}

function sameLink(href: string): string {
  return href.trim().toLowerCase().replace(/\/+$/, "");
}

function inferIcon(link: LegacyLink): string {
  const haystack = `${link.label ?? ""} ${link.href ?? ""}`.toLowerCase();
  const known = KNOWN_NETWORKS.find((network) => haystack.includes(network));
  return known ?? (link.icon?.trim() || "link");
}

/**
 * Merges the three old lists (Site Settings, Home Hero, Contact) into one
 * library, without duplicates, and works out which links each section showed.
 *
 * Pure so `npm run migrate:socials -- --dry-run` can print the exact result.
 * Existing rows keep a `legacy-<index>` id, which is also the id the public API
 * reports for them before migration, so nothing has to change at the switch.
 */
export function planSocialLibrary(input: {
  socials: LegacyLink[];
  heroSocials: LegacyLink[];
  contactSocials: Partial<Record<string, string>>;
}): SocialLibraryPlan {
  const socials: ISiteSocial[] = input.socials
    .filter((link) => link.label?.trim() && link.href?.trim())
    .map((link, index) => ({
      id: `legacy-${index}`,
      label: link.label!.trim(),
      href: link.href!.trim(),
      icon: link.icon?.trim() || "link",
      iconType: "icon",
      imageUrl: "",
      description: "",
    }));

  const added: string[] = [];

  const addOrFind = (link: LegacyLink, description = ""): ISiteSocial => {
    const key = sameLink(link.href ?? "");
    const existing = socials.find((social) => sameLink(social.href) === key);
    if (existing) {
      if (description && !existing.description) {
        existing.description = description;
      }
      return existing;
    }

    const created: ISiteSocial = {
      id: randomUUID(),
      label: link.label!.trim(),
      href: link.href!.trim(),
      icon: inferIcon(link),
      iconType: "icon",
      imageUrl: "",
      description,
    };
    socials.push(created);
    added.push(created.label);
    return created;
  };

  const placements = emptyPlacements();
  const everyExisting = socials.map((social) => social.id);
  placements.navbar = [...everyExisting];
  placements.mobileMenu = [...everyExisting];
  placements.footer = [...everyExisting];

  const place = (key: SocialPlacementKey, id: string) => {
    if (!placements[key].includes(id)) placements[key].push(id);
  };

  for (const link of input.heroSocials) {
    if (!link.label?.trim() || !link.href?.trim()) continue;
    place("homeHero", addOrFind(link).id);
  }

  for (const { key, label, description } of CONTACT_LINKS) {
    const href = input.contactSocials[key]?.trim();
    if (!href) continue;
    place("contact", addOrFind({ label, href, icon: key }, description).id);
  }

  return { socials, placements, added };
}

/** Reads the three stored lists and plans the library from them. */
export async function loadSocialLibraryPlan(
  socials: LegacyLink[],
): Promise<SocialLibraryPlan> {
  const [home, contact] = await Promise.all([
    HomeHero.findOne().lean<{ hero?: { socials?: LegacyLink[] } }>(),
    Contact.findOne().lean<{
      info?: { socials?: Partial<Record<string, string>> };
    }>(),
  ]);

  return planSocialLibrary({
    socials,
    heroSocials: home?.hero?.socials ?? [],
    contactSocials: contact?.info?.socials ?? {},
  });
}

/**
 * Moves a not-yet-migrated settings document onto the library. Only adds data:
 * the old Home Hero and Contact fields stay in place.
 *
 * Called before every library write, so the first dashboard edit can never
 * replace the old lists with an incomplete one, whether or not the migration
 * script has been run. The caller saves the document.
 */
export async function ensureSocialLibrary(doc: {
  socials: unknown;
  socialPlacements?: SocialPlacements;
  socialsConfigured?: boolean;
}): Promise<void> {
  if (doc.socialsConfigured) return;

  const plan = await loadSocialLibraryPlan(doc.socials as LegacyLink[]);
  doc.socials = plan.socials;
  doc.socialPlacements = plan.placements;
  doc.socialsConfigured = true;
}
