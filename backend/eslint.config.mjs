import globals from "globals";
import pluginJs from "@eslint/js";
import tseslint from "typescript-eslint";

/** @type {import('eslint').Linter.Config[]} */
export default [
  { ignores: ["dist/", "coverage/", "eval/", "demo/*.cjs"] },
  { files: ["**/*.{js,mjs,cjs,ts}"] },
  { languageOptions: { globals: globals.node } },
  pluginJs.configs.recommended,
  ...tseslint.configs.recommended,
  // All logging goes through pino (src/lib/logger.ts); scripts write to stdout explicitly.
  { rules: { "no-console": "error" } },
  { files: ["src/tests/**"], rules: { "no-console": "off" } },
];
