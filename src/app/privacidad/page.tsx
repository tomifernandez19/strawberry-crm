export const metadata = { title: "Política de privacidad — Strawberry Trejo" }

export default function PrivacidadPage() {
  return (
    <main style={{ maxWidth: 680, margin: "60px auto", padding: "0 24px", fontFamily: "system-ui, sans-serif", lineHeight: 1.6 }}>
      <h1>Política de privacidad</h1>
      <p>
        Esta aplicación es una herramienta interna de <strong>Strawberry Trejo</strong> para centralizar y
        responder las consultas de clientes que llegan por Instagram, WhatsApp y Facebook Messenger.
      </p>

      <h2>Qué datos procesamos</h2>
      <p>
        Cuando un cliente nos escribe por alguno de estos canales, guardamos su identificador de la
        plataforma (por ejemplo, el ID de Instagram), su nombre y/o teléfono si lo comparte, y el contenido
        de los mensajes intercambiados — con el único fin de responder sus consultas sobre productos, stock,
        precios y pedidos.
      </p>

      <h2>Cómo se usan estos datos</h2>
      <p>
        Los datos se usan exclusivamente para brindar atención al cliente. No se venden ni se comparten con
        terceros con fines publicitarios. El acceso está restringido al personal autorizado de Strawberry
        Trejo.
      </p>

      <h2>Almacenamiento</h2>
      <p>
        Los datos se almacenan de forma segura en una base de datos con acceso controlado, y se conservan
        mientras sean necesarios para la atención al cliente.
      </p>

      <h2>Contacto</h2>
      <p>
        Para consultas sobre tus datos, escribinos directamente a través de nuestros canales de atención
        habituales (Instagram <a href="https://www.instagram.com/strawberrytrejo/">@strawberrytrejo</a>).
      </p>
    </main>
  )
}
