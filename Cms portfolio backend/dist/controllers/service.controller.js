"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getServices = getServices;
exports.createService = createService;
exports.updateService = updateService;
exports.deleteService = deleteService;
const Service_1 = require("../models/Service");
async function getServices(req, res) {
    try {
        const services = await Service_1.Service.find().sort({ createdAt: 1 });
        res.status(200).json({
            success: true,
            count: services.length,
            services,
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            message: "Server error",
            error: process.env.NODE_ENV === "development" ? error : undefined,
        });
    }
}
async function createService(req, res) {
    try {
        const service = await Service_1.Service.create(req.body);
        res.status(201).json({
            success: true,
            message: "Service created successfully",
            service,
        });
    }
    catch (error) {
        console.error("[CREATE SERVICE ERROR]", error);
        res.status(500).json({
            success: false,
            message: "Failed to create service",
        });
    }
}
async function updateService(req, res) {
    try {
        const service = await Service_1.Service.findByIdAndUpdate(req.params.id, req.body, {
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
    }
    catch (err) {
        res.status(500).json({
            success: false,
            message: err.message,
        });
    }
}
async function deleteService(req, res) {
    try {
        const service = await Service_1.Service.findByIdAndDelete(req.params.id);
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
    }
    catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
}
