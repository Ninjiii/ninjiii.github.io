import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Für GitHub Pages:
// Wenn dein Repo z.B. https://github.com/USER/fib-akten-system heißt,
// setze base auf "/fib-akten-system/".
// Für USER.github.io Repo kann base "/" bleiben.
export default defineConfig({
  plugins: [react()],
  base: process.env.GITHUB_REPOSITORY?.endsWith(".github.io") ? "/" : "/fib-akten-system/"
});
