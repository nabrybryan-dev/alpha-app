import type { CapaDeMomentos } from '../../../../domain/sujeto/capaDeMomentos'

/**
 * EL TEXTO DE LA CAPA DE MOMENTOS: la cifra de cada articulación, o por qué no se dibuja. Sin
 * líneas no existe (no crea nodo), así que con la capa apagada el salón no cambia.
 */
export function LecturaDeMomentos({ capa }: { capa: CapaDeMomentos }) {
  if (capa.lineas.length === 0) return null
  return (
    <div
      data-testigo="momentos"
      className="pointer-events-none absolute bottom-28 left-4 right-4 rounded-lg bg-black/60 p-2 text-xs leading-snug text-white"
    >
      <p className="font-semibold">Sujeto de ejemplo (no es una persona real)</p>
      <ul>
        {capa.lineas.map((l) => (
          <li key={l}>{l}</li>
        ))}
      </ul>
    </div>
  )
}
