import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // Needed so GitHub Pages serves the app correctly under /CS696A/
  base: '/CS696A/',
})
