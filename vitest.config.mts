import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      // Les modules testés importent `server-only`, un marqueur Next qui refuse
      // de se charger hors composant serveur. On le neutralise pour les tests :
      // ce qu'on vérifie ici, c'est du calcul pur.
      "server-only": fileURLToPath(new URL("./tests/stubs/server-only.ts", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
  },
});
