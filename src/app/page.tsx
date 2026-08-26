export default function Home() {
  return (
    <main style={{ maxWidth: 640, margin: "80px auto", padding: "0 24px", fontFamily: "system-ui, sans-serif" }}>
      <h1>Strawberry Trejo — Atención con IA</h1>
      <p>Bandeja de atención y agente de ventas. Todavía en construcción.</p>
      <p>
        Estado de la conexión con Supabase/Claude: <a href="/api/health">/api/health</a>
      </p>
    </main>
  );
}
