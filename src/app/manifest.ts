import type { MetadataRoute } from "next"

// Permite "Agregar a la pantalla de inicio" en el celular: se abre como una app.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Strawberry Trejo — Atención",
    short_name: "Strawberry",
    start_url: "/bandeja",
    display: "standalone",
    background_color: "#faf8f6",
    theme_color: "#8c2b4a",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  }
}
