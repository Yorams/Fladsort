import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"

export default defineConfig({
  plugins: [react()],
  // Relatieve paden zodat de build onder elke (sub)map gehost kan worden.
  base: "./",
  server: {
    port: 5180,
    open: false,
  },
})
