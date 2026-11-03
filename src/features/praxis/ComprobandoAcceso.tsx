/**
 * Lo que se ve en Praxis mientras se consultan los permisos (la cuenta personal de Bryan es `asesorado` y solo se
 * sabe que ocupa el puesto de coach cuando responde la base). Nunca una pantalla en blanco.
 */
export function ComprobandoAcceso() {
  return (
    <div role="status" aria-busy="true" className="grid min-h-dvh place-items-center bg-bg text-sm text-tenue">
      Comprobando tu acceso…
    </div>
  )
}
