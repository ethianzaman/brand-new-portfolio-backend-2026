import { handle } from "../lib/http";
import * as services from "../services/service.service";

const WRITE_FAILURE = { status: 500, message: "Request failed" };

export const getServices = handle(async (req, res) => {
  res.status(200).json({ success: true, ...(await services.list(req.query)) });
});

export const getServiceStats = handle(async (_req, res) => {
  res.status(200).json({ success: true, stats: await services.stats() });
});

export const getServiceBySlug = handle(async (req, res) => {
  res.status(200).json({ success: true, service: await services.getBySlug(req.params.slug) });
});

export const createService = handle(
  async (req, res) => {
    const service = await services.create(req.body);
    res.status(201).json({ success: true, message: "Service created successfully", service });
  },
  { status: 500, message: "Failed to create service", hideDetails: true },
);

export const updateService = handle(async (req, res) => {
  const service = await services.update(req.params.id, req.body);
  res.status(200).json({ success: true, service });
}, WRITE_FAILURE);

export const deleteService = handle(async (req, res) => {
  await services.remove(req.params.id);
  res.status(200).json({ success: true, message: "Service deleted successfully" });
}, WRITE_FAILURE);
