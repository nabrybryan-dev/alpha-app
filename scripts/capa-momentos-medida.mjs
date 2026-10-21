/**
 * La capa de momentos tal como la enciende el salón con `?momentos=ejemplo`, para
 * `medir-fotograma-salon.mjs` (`?capa=1`): la decisión del dominio se toma UNA vez (como el
 * `useMemo` del salón) y las mallas se construyen en cada fotograma (como `construir()`).
 */
let capa = null
let dibujar = null

/** Carga los módulos y decide la capa UNA vez, antes de medir. */
export async function preparar() {
  const [d, f] = await Promise.all([
    import('/src/domain/sujeto/capaDeMomentos.ts'),
    import('/src/features/entrenar/escena/dibujarMomentos.ts'),
  ])
  capa = d.capaDeMomentos(
    d.SUJETO_DE_EJEMPLO,
    d.INCERTIDUMBRE_DE_EJEMPLO,
    { categoria: 'SENTADILLA', nombre: 'Sentadilla con barra', sujetoDeEjemplo: true },
    { muestras: 500 },
  )
  dibujar = f.mallasDeMomentos
}

/** Lo que se construye en cada fotograma: las dos mallas de los momentos. */
export function extras(esq) {
  return dibujar(capa, esq)
}
