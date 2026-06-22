import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { crx, type ManifestV3Export } from "@crxjs/vite-plugin";
import manifestJson from "./manifest.json";

const manifest = manifestJson as unknown as ManifestV3Export;

export default defineConfig({
  plugins: [react(), crx({ manifest })],
  build: { outDir: "dist", emptyOutDir: true },
});
