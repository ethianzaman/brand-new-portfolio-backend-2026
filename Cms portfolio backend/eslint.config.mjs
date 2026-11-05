import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist/", "coverage/", "tests/api/__snapshots__/"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      // Mongoose documents and request bodies are loosely typed at the edges.
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
    },
  },
);
