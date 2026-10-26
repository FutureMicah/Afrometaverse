import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
export default defineConfig({
  root: path.resolve(import.meta.dirname),
  plugins: [react()],
  resolve: { alias: { "@": path.resolve(import.meta.dirname, "../src") } },
  server: { port: 5192, host: "127.0.0.1", strictPort: true },
});
