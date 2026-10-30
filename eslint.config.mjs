import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Compilación de las pruebas de acceso y carpetas de trabajo de las herramientas.
    ".next-acceso/**",
    "test-results/**",
    ".playwright-mcp/**",
    ".taste-skill/**",
    ".impeccable/**",
  ]),
]);

export default eslintConfig;
