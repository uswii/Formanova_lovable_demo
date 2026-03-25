import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { ViteImageOptimizer } from "vite-plugin-image-optimizer";
import fs from "fs";

/**
 * Converts render-blocking <link rel="stylesheet"> tags to non-render-blocking
 * async pattern. Emits both a high-priority preload hint (so the browser's
 * preload scanner fetches the CSS immediately during HTML parse) and a
 * media="print" link (so CSS never blocks rendering). onload swaps media to
 * "all" once the file is ready.
 */
function asyncCssPlugin(): Plugin {
  return {
    name: "async-css",
    enforce: "post",
    transformIndexHtml(html) {
      return html.replace(
        /<link rel="stylesheet" crossorigin href="(\/assets\/[^"]+\.css)">/g,
        `<link rel="preload" as="style" crossorigin href="$1">
    <link rel="stylesheet" crossorigin href="$1" media="print" onload="this.media='all'">
    <noscript><link rel="stylesheet" crossorigin href="$1"></noscript>`
      );
    },
  };
}

/**
 * Generates public/version.json on each production build with a timestamp.
 * The app polls this file to detect new deployments.
 */
function versionJsonPlugin(): Plugin {
  return {
    name: "version-json",
    apply: "build",
    closeBundle() {
      const version = Date.now().toString(36);
      const outPath = path.resolve(__dirname, "dist/version.json");
      fs.mkdirSync(path.dirname(outPath), { recursive: true });
      fs.writeFileSync(outPath, JSON.stringify({ version }));
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [
    react(),
    mode === "development" && componentTagger(),
    ViteImageOptimizer({
      png: { quality: 70 },
      jpeg: { quality: 70 },
      jpg: { quality: 70 },
      webp: { quality: 65 },
    }),
    // Only apply async CSS in production builds
    mode === "production" && asyncCssPlugin(),
    versionJsonPlugin(),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    sourcemap: mode === "development",
    target: "es2022",
    rollupOptions: {
      output: {
        manualChunks: {
          "vendor-framer": ["framer-motion"],
          "vendor-posthog": ["posthog-js", "posthog-js/react"],
        },
      },
    },
  },
}));
