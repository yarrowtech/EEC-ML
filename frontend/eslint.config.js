import js from "@eslint/js";
import globals from "globals";
import pluginReact from "eslint-plugin-react";
import { defineConfig } from "eslint/config";

export default defineConfig([
  { ignores: ["dist/**", "coverage/**", "node_modules/**"] },
  {
    files: ["**/*.{js,mjs,cjs,jsx}"],
    plugins: { js },
    extends: ["js/recommended"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      parserOptions: { ecmaFeatures: { jsx: true } },
      globals: { ...globals.browser, ...globals.node },
    },
    settings: { react: { version: "detect" } },
    rules: {
      // React 17+ uses the automatic JSX runtime. Components in this legacy
      // JavaScript codebase are intentionally not required to declare props.
      "react/react-in-jsx-scope": "off",
      "react/prop-types": "off",
    },
  },
  {
    ...pluginReact.configs.flat.recommended,
    files: ["**/*.{jsx,tsx}"],
    settings: { react: { version: "detect" } },
    rules: { "react/react-in-jsx-scope": "off", "react/prop-types": "off" },
  },
  {
    files: ["**/__tests__/**/*.{js,jsx,ts,tsx}", "**/*.{test,spec}.{js,jsx,ts,tsx}"],
    languageOptions: { globals: { ...globals.browser, ...globals.node, ...globals.jest } },
  },
]);
