import mdx from "@astrojs/mdx";
import sitemap from "@astrojs/sitemap";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "astro/config";

export default defineConfig({
  site: "https://nabetama.com",
  integrations: [mdx(), sitemap()],
  output: "static",
  vite: {
    plugins: [tailwindcss()],
  },
});
