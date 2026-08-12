import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { defineConfig } from "vite";

const PROJECT_ROOT = import.meta.dirname;
const CLIENT_ROOT = path.resolve(PROJECT_ROOT, "client");

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(CLIENT_ROOT, "src"),
      "@shared": path.resolve(PROJECT_ROOT, "shared"),
    },
  },
  envDir: PROJECT_ROOT,
  root: CLIENT_ROOT,
  publicDir: path.resolve(CLIENT_ROOT, "public"),
  build: {
    // O Worker serve estes arquivos por meio do binding ASSETS.
    outDir: path.resolve(PROJECT_ROOT, "dist", "public"),
    emptyOutDir: true,
  },
  server: {
    port: 3000,
    strictPort: false,
    host: true,
    allowedHosts: ["localhost", "127.0.0.1"],
    proxy: {
      "/api": { target: "http://localhost:3001", changeOrigin: true },
    },
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
  },
});
