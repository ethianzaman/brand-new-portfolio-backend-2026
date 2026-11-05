import { handle } from "../lib/http";
import * as heroes from "../services/hero.service";
import type { HeroFiles } from "../services/hero.service";

export const getHero = handle(async (_req, res) => {
  res.status(200).json({ success: true, hero: await heroes.getHero() });
});

export const updateHero = handle(
  async (req, res) => {
    const hero = await heroes.updateHero(req.body, req.files as HeroFiles | undefined);
    res.status(200).json({ success: true, message: "Hero updated successfully", hero });
  },
  { status: 500, message: "Server error" },
);

export const replaceStats = handle(async (req, res) => {
  res.status(200).json({ success: true, stats: await heroes.replaceStats(req.body?.stats) });
});

export const createStat = handle(async (req, res) => {
  res.status(201).json({ success: true, stat: await heroes.addStat(req.body) });
});

export const updateStat = handle(async (req, res) => {
  res.status(200).json({ success: true, stat: await heroes.editStat(req.params.id, req.body) });
});

export const deleteStat = handle(async (req, res) => {
  await heroes.removeStat(req.params.id);
  res.status(200).json({ success: true, message: "Stat deleted successfully" });
});
