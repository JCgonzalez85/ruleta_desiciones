import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = [
  {
    ignores: ["node_modules/**", ".next/**", "coverage/**", "out/**", "dist/**", "next-env.d.ts"],
  },
  ...nextVitals,
  ...nextTs,
  {
    files: ["**/*.ts", "**/*.tsx", "**/*.mjs"],
    rules: {
      complexity: ["error", 10],
      "max-lines-per-function": ["error", { max: 50, skipBlankLines: true, skipComments: true }],
      "max-depth": ["error", 3],
      "no-console": "error",
      eqeqeq: ["error", "always"],
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/ban-ts-comment": "error",
    },
  },
];

export default eslintConfig;
