import { Router } from "express";
import {
  getRolePermissions,
  updateRolePermissions,
} from "../controllers/role.controller";
import { protect, requirePermission, requireSuperAdmin } from "../middleware/auth";

const router = Router();

router.get("/permissions", protect, requirePermission("users.view"), getRolePermissions);
router.put("/permissions", protect, requireSuperAdmin, updateRolePermissions);

export default router;
