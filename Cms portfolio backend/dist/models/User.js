"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.User = exports.USER_ROLES = void 0;
exports.isValidRole = isValidRole;
const mongoose_1 = __importStar(require("mongoose"));
const bcryptjs_1 = __importDefault(require("bcryptjs"));
exports.USER_ROLES = ['admin', 'manager', 'editor'];
function isValidRole(value) {
    return (typeof value === 'string' && exports.USER_ROLES.includes(value));
}
const UserSchema = new mongoose_1.Schema({
    email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true,
    },
    password: {
        type: String,
        required: true,
        select: false,
    },
    role: {
        type: String,
        enum: exports.USER_ROLES,
        required: true,
    },
    isActive: {
        type: Boolean,
        required: true,
        default: true,
    },
}, {
    timestamps: true,
    toJSON: {
        transform(_doc, ret) {
            delete ret.password;
            delete ret.__v;
            ret.id = ret._id.toString();
            delete ret._id;
            return ret;
        },
    },
});
// Hash password before save
UserSchema.pre('save', async function (next) {
    if (!this.isModified('password'))
        return next();
    this.password = await bcryptjs_1.default.hash(this.password, 12);
    next();
});
// Defensive: hash password on update queries too (pre('save') does not run
// for findByIdAndUpdate / updateOne, so an unhashed password could otherwise
// be written straight to the database).
async function hashPasswordInUpdate(update) {
    if (!update)
        return;
    const ops = Array.isArray(update) ? update : [update];
    for (const op of ops) {
        if (op && typeof op.password === 'string' && op.password.length > 0) {
            op.password = await bcryptjs_1.default.hash(op.password, 12);
        }
    }
}
UserSchema.pre('findOneAndUpdate', async function (next) {
    await hashPasswordInUpdate(this.getUpdate());
    next();
});
UserSchema.pre('updateOne', async function (next) {
    await hashPasswordInUpdate(this.getUpdate());
    next();
});
UserSchema.methods.comparePassword = function (plain) {
    return bcryptjs_1.default.compare(plain, this.password);
};
exports.User = mongoose_1.default.model('User', UserSchema);
