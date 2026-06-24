import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules/pdf-lib")) {
            return "pdf-lib";
          }
        },
      },
    },
  },
  optimizeDeps: {
    include: ["pdf-lib"],
  },
});
