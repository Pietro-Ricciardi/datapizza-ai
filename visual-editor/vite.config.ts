import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true,
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules/reactflow")) {
            return "reactflow";
          }
          if (id.includes("node_modules/react-window")) {
            return "virtualized-lists";
          }
          if (
            id.includes("/src/components/NodeInspector") ||
            id.includes("/src/components/ExecutionHistoryTimeline") ||
            id.includes("/src/components/LogViewer")
          ) {
            return "workflow-panels";
          }
          return undefined;
        },
      },
    },
  },
  test: {
    environment: "jsdom",
    coverage: {
      reporter: ["text", "json-summary"],
    },
  },
});
