import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
export default defineConfig([...nextVitals, ...nextTs, { files: ["src/components/**/*.{ts,tsx}", "scripts/smoke.ts"], rules: { "@typescript-eslint/no-explicit-any": "off" } }, globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts", ".npm-cache/**", ".tmp/**", ".localappdata/**"])]);
