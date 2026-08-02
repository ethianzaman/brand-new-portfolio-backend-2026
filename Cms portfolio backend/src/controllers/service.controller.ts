import { Request, Response } from "express";
import { Service } from "../models/Service";


export async function getServices(req: Request, res: Response): Promise<void> {

  try {
    const services = await Service.find().sort({ createdAt: 1 });
    res.status(200).json({
      success: true,
      count: services.length,
      services,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Server error",
      error: process.env.NODE_ENV === "development" ? error : undefined,
    });
  }
}

export async function createService(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    const service = await Service.create(req.body);

    res.status(201).json({
      success: true,
      message: "Service created successfully",
      service,
    });
  } catch (error) {
    console.error("[CREATE SERVICE ERROR]", error);

    res.status(500).json({
      success: false,
      message: "Failed to create service",
    });
  }
}

export async function updateService(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    const service = await Service.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });

    if (!service) {
      res.status(404).json({
        success: false,
        message: "Service not found",
      });
      return;
    }
    res.status(200).json({
      success: true,
      service,
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
}

export async function deleteService(
  req: Request,
  res: Response,
): Promise<void> {

  try {
    const service = await Service.findByIdAndDelete(req.params.id);
    if (!service) {

      res.status(404).json({
        success: false,
        message: "Service not found",
      });

      return;
    }
    res.status(200).json({
      success: true,
      message: "Service deleted successfully",
    });
  } catch (error: any) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
}
