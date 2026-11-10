// Resolve Playwright from the project or from the global install.
import { createRequire } from "node:module";
const req = createRequire(import.meta.url);
let pw;
try { pw = req("playwright"); } catch { pw = req("/opt/node22/lib/node_modules/playwright"); }
export const chromium = pw.chromium;
export const devices = pw.devices;
