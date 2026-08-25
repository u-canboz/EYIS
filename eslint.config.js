import js from "@eslint/js";
import eslintPluginPrettier from "eslint-plugin-prettier/recommended";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist", ".output", ".vinxi"] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "server-only",
              message:
                "TanStack Start does not use the Next.js `server-only` package. Rename the module to `*.server.ts` or mark it with `@tanstack/react-start/server-only`.",
            },
          ],
        },
      ],
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
      "@typescript-eslint/no-unused-vars": "off",
    },
  },
  {
    // Storefront boundary: the reference storefront and the SDK itself may only
    // talk to the public Store API — never to internal commerce modules or the
    // backend client.
    files: ["src/routes/store/**/*.{ts,tsx}", "src/lib/store-sdk/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/lib/commerce/*", "@/lib/commerce/**", "**/*.server", "**/*.server.*"],
              message:
                "Storefront-Code darf ausschließlich @/lib/store-sdk verwenden, keine internen Commerce-Module.",
            },
            {
              group: ["@/integrations/supabase/*", "@supabase/*"],
              message: "Die Reference Storefront darf keinen Supabase-Client importieren.",
            },
          ],
        },
      ],
    },
  },
  eslintPluginPrettier,
);

