import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __dirname = dirname(fileURLToPath(import.meta.url));
const compat = new FlatCompat({ baseDirectory: __dirname });

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    // R4-08 (round 5): the UI-kit barrel re-exports 45 modules whose CSS imports are side effects,
    // so importing it pulls every kit stylesheet into the route (inlined twice with inlineCss).
    // Import each component from its file; `node scripts/codemods/debarrel-ui.mjs` rewrites a file.
    files: ["src/**/*.{ts,tsx}"],
    ignores: ["src/components/ui/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            { name: "@/components/ui", message: "Import from the component's file, e.g. @/components/ui/Button (R4-08: the barrel pulls every kit stylesheet into the route). Run node scripts/codemods/debarrel-ui.mjs <file>." },
            { name: "@/components/ui/index", message: "Import from the component's file, e.g. @/components/ui/Button (R4-08)." },
          ],
        },
      ],
    },
  },
  { ignores: ["node_modules/**", ".next/**", "playwright-report/**", "test-results/**", "next-env.d.ts", "scripts/**/*.cjs", "docs/audit/tools/**"] },
];

export default eslintConfig;
