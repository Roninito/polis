import { sveltekit } from "@sveltejs/kit/vite";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [sveltekit()],
  server: {
    port: 5173,
  },
  ssr: {
    // Native modules that must not be bundled by Vite
    external: ["better-sqlite3"],
  },
});
