"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.config = void 0;
const conf_1 = __importDefault(require("conf"));
const conf = new conf_1.default({ projectName: "pensieve" });
exports.config = {
    get(key) {
        return conf.get(key);
    },
    set(key, value) {
        conf.set(key, value);
    },
    getAll() {
        return conf.store;
    },
    isAuthenticated() {
        return !!conf.get("accessToken");
    },
    delete(key) {
        conf.delete(key);
    },
    clear() {
        conf.clear();
    },
};
