import { readFileSync } from "node:fs"

const env = Object.fromEntries(
  readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .split("\n")
    .filter((l) => l.includes("=") && !l.startsWith("#"))
    .map((l) => {
      const i = l.indexOf("=")
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()]
    })
)

const url = `https://api.tiendanube.com/2025-03/${env.TIENDANUBE_STORE_ID}/products?per_page=3`
const res = await fetch(url, {
  headers: {
    Authorization: `Bearer ${env.TIENDANUBE_ACCESS_TOKEN}`,
    "User-Agent": `Strawberry Trejo CRM (${env.TIENDANUBE_APP_CONTACT})`,
  },
})

console.log("Status:", res.status)
const data = await res.json()
if (!res.ok) {
  console.error(data)
  process.exit(1)
}
console.log(`Productos recibidos: ${data.length}`)
for (const p of data) {
  console.log("-", p.name?.es, "| imágenes:", p.images?.length, "| categorías:", p.categories?.length)
}
