"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validate = validate;
const express_validator_1 = require("express-validator");
/**
 * Runs express-validator chains and rejects the request with 400 when any
 * check fails, returning the first error message per field.
 *
 *   router.post('/', protect, validate([...body('email').isEmail()]), handler)
 */
function validate(validations) {
    return async (req, res, next) => {
        for (const validation of validations) {
            await validation.run(req);
        }
        const errors = (0, express_validator_1.validationResult)(req);
        if (errors.isEmpty())
            return next();
        const first = errors.array()[0];
        res.status(400).json({
            success: false,
            message: String(first.msg),
            ...(first.type === "field" ? { field: first.path } : {}),
        });
    };
}
