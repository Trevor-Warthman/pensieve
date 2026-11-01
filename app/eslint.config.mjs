import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";

export default defineConfig([
  ...nextVitals,
  {
    // Preserve the Next 15 lint baseline during the framework upgrade. These
    // React 19 compiler-oriented rules require separate component refactors.
    rules: {
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/refs": "off",
    },
  },
  globalIgnores([".next/**", ".open-next/**", "public/pagefind/**", "playwright-report/**", "test-results/**"]),
]);
