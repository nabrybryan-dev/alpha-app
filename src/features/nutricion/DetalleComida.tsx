import { catalogoRepo } from '../../data/catalogo/catalogoRepo'
import { MARGENES } from '../../domain/nutricion/dia'
import { escalar } from '../../domain/nutricion/porcion'
import { ACEITE, NADA, SAL, gramosDeAceite, gramosDeSal } from '../../domain/nutricion/unidades'
import type { RegistroComida } from '../../domain/types'

/**
 * El detalle de una comida: qué metió, cuánto aceite y sal lleva, y con cuánta
 * certeza se sabe todo eso.
 *
 * AQUÍ VIVE LA REGLA R3. El aceite y la sal se preguntan en UNIDADES -media
 * cucharada, una pizca- y nunca en adjetivos. "Poco aceite" no es un dato:
 * significa cosas distintas en dos cocinas, y la grasa de cocción es la fuente
 * de error más grande de todo el registro porque no se ve en el plato. Media
 * cucharada de más son 60 kcal que nadie anotó, tres veces al día.
 *
 * Y si NO cocinó él, no se le pregunta. Nadie sabe cuánto aceite le echaron en
 * un restaurante, y obligarle a adivinar produce un número inventado con
 * apariencia de medición. El registro entra con ±30 % y marcado, que es la
 * verdad.
 */

/**
 * De donde salen las kcal del aceite de coccion.
 *
 * Se lee del catalogo y no se escribe a mano: el dia que se corrija ese valor,
 * esta cuenta se corrige sola. Es el mismo ancla que usa el motor en Python.
 */
const ANCLA_ACEITE = 'aceite-de-girasol'

const NOMBRES: Record<RegistroComida['comida'], string> = {
  desayuno: 'Desayuno',
  almuerzo: 'Almuerzo',
  cena: 'Cena',
  snack: 'Snack',
}

interface DetalleComidaProps {
  comida: RegistroComida
  /** Lo que el plan pauta para esta comida, si lo hay. */
  pauta?: string
  onVolver: () => void
  onAgregar: () => void
  onQuitarItem: (itemId: string) => void
  onCambiar: (cambios: Partial<Omit<RegistroComida, 'id' | 'usuarioId' | 'items'>>) => void
}

const cifra = (valor: number | null | undefined) =>
  valor === null || valor === undefined ? '—' : Math.round(valor)

/** Los gramos guardados, de vuelta a la etiqueta que el asesorado tocó. */
const etiquetaDe = (tabla: Record<string, number>, gramos: number | null) => {
  if (gramos === null) return null
  if (gramos === 0) return NADA
  return Object.entries(tabla).find(([, g]) => g === gramos)?.[0] ?? null
}

export function DetalleComida({
  comida,
  pauta,
  onVolver,
  onAgregar,
  onQuitarItem,
  onCambiar,
}: DetalleComidaProps) {
  const conAceite = [NADA, ...Object.keys(ACEITE)]
  const conSal = [NADA, ...Object.keys(SAL)]
  const aceiteElegido = etiquetaDe(ACEITE, comida.aceiteG)
  const salElegida = etiquetaDe(SAL, comida.salG)

  const escalados = comida.items.map((item) => {
    const alimento = catalogoRepo.porId(item.alimentoId)
    return { item, alimento, por: alimento ? escalar(alimento.por100g, item.gramos) : null }
  })
  const kcal = Math.round(escalados.reduce((suma, e) => suma + (e.por?.kcal ?? 0), 0))

  // El margen de la comida entera. Si no cocinó él, no puede saber la grasa de
  // cocción, y eso degrada TODO el registro por bueno que sea lo demás.
  const margen = Math.round(
    (comida.cocinadoPorEl ? MARGENES[comida.confianza] : MARGENES.ajeno) * 100,
  )

  const grasaOculta = comida.aceiteG !== null && comida.aceiteG > 0
  const kcalDelAceite = Math.round(
    escalar(catalogoRepo.porId(ANCLA_ACEITE)?.por100g ?? { kcal: null }, comida.aceiteG ?? 0)
      .kcal ?? 0,
  )

  return (
    <div className="flex flex-col gap-4 pb-6">
      <header className="flex items-start gap-3">
        <button
          type="button"
          onClick={onVolver}
          aria-label="Volver al diario"
          className="press h-9 w-9 shrink-0 rounded-full border border-linea bg-surface-2 text-tenue"
        >
          ←
        </button>
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-tenue">
            {comida.momentoIso.slice(11, 16)}
          </p>
          <h1 className="font-display text-xl text-texto">{NOMBRES[comida.comida]}</h1>
          <p className="cifras mt-1 text-sm text-tenue">
            <b className="text-texto">{kcal.toLocaleString('es-CO')}</b> kcal registradas
          </p>
        </div>
      </header>

      {pauta && (
        <section className="rounded-2xl border border-linea bg-surface-2 p-3">
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-tenue">
            Lo que pauta tu plan
          </p>
          <p className="mt-1 text-sm leading-snug text-texto">{pauta}</p>
        </section>
      )}

      <section>
        <h2 className="mb-2 font-display text-sm text-texto">Lo que registraste</h2>
        {escalados.length === 0 ? (
          <p className="rounded-2xl border border-linea bg-surface-2 p-4 text-center text-sm leading-snug text-tenue">
            Aún no registras nada de esta comida.
            <br />
            Pesa lo que vas a comer y agrégalo.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {escalados.map(({ item, alimento, por }) => (
              <li
                key={item.id}
                className="flex items-center gap-3 rounded-2xl border border-linea bg-surface-1 p-3"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-texto">
                    {alimento?.nombre ?? 'Alimento que ya no está en el catálogo'}
                  </span>
                  <span className="cifras block text-[10px] text-tenue">
                    {item.estadoAsumido} · P {cifra(por?.proteina_g)} · C {cifra(por?.carbos_g)} · G{' '}
                    {cifra(por?.grasa_g)}
                    {!item.fuePesado && ' · estimado'}
                  </span>
                </span>
                <span className="shrink-0 text-right">
                  <span className="cifras block text-sm font-bold text-texto">{item.gramos} g</span>
                  <span className="cifras block text-[10px] text-tenue">{cifra(por?.kcal)} kcal</span>
                </span>
                <button
                  type="button"
                  onClick={() => onQuitarItem(item.id)}
                  aria-label={`Quitar ${alimento?.nombre ?? 'alimento'}`}
                  className="press h-8 w-8 shrink-0 rounded-full border border-linea text-tenue hover:border-accion hover:text-accion"
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        )}

        <button
          type="button"
          onClick={onAgregar}
          className="press mt-2 w-full rounded-2xl border border-dashed border-accion/50 bg-accion/5 py-3 text-sm font-semibold text-accion"
        >
          Agregar alimento
        </button>
      </section>

      <section className="rounded-2xl border border-linea bg-surface-1 p-4">
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm font-semibold text-texto">¿Cocinaste tú esta comida?</span>
          <button
            type="button"
            role="switch"
            aria-checked={comida.cocinadoPorEl}
            aria-label="Cocinaste tú esta comida"
            onClick={() =>
              onCambiar(
                comida.cocinadoPorEl
                  ? // Al decir que no cocinó, el aceite y la sal que hubiera
                    // puesto dejan de tener sentido: vuelven a "no se preguntó".
                    { cocinadoPorEl: false, aceiteG: null, salG: null, confianza: 'ajeno' }
                  : { cocinadoPorEl: true, confianza: 'estimado' },
              )
            }
            className={`press h-7 w-12 shrink-0 rounded-full border transition-colors ${
              comida.cocinadoPorEl ? 'border-accion bg-accion' : 'border-linea bg-surface-3'
            }`}
          >
            <span
              aria-hidden="true"
              className={`block h-5 w-5 rounded-full bg-white transition-transform ${
                comida.cocinadoPorEl ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>

        {comida.cocinadoPorEl ? (
          <>
            <p className="mt-4 text-[10px] font-bold uppercase tracking-[0.14em] text-tenue">
              ¿Cuánto aceite usaste?
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {conAceite.map((opcion) => (
                <button
                  key={opcion}
                  type="button"
                  aria-pressed={aceiteElegido === opcion}
                  onClick={() => onCambiar({ aceiteG: gramosDeAceite(opcion) })}
                  className={`press rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
                    aceiteElegido === opcion
                      ? 'border-accion bg-accion/15 text-texto'
                      : 'border-linea bg-surface-2 text-tenue'
                  }`}
                >
                  {opcion}
                </button>
              ))}
            </div>

            <p className="mt-4 text-[10px] font-bold uppercase tracking-[0.14em] text-tenue">
              ¿Cuánta sal o caldo?
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {conSal.map((opcion) => (
                <button
                  key={opcion}
                  type="button"
                  aria-pressed={salElegida === opcion}
                  onClick={() => onCambiar({ salG: gramosDeSal(opcion) })}
                  className={`press rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
                    salElegida === opcion
                      ? 'border-accion bg-accion/15 text-texto'
                      : 'border-linea bg-surface-2 text-tenue'
                  }`}
                >
                  {opcion}
                </button>
              ))}
            </div>

            {grasaOculta && (
              <p className="mt-3 text-[11px] leading-snug text-tenue">
                Ese aceite son{' '}
                <b className="text-texto">{kcalDelAceite} kcal</b> que no se ven en el plato. Es la
                parte del registro que más se olvida.
              </p>
            )}
          </>
        ) : (
          <p className="mt-3 text-[11px] leading-snug text-tenue">
            No te preguntamos por el aceite y la sal: no puedes saberlo. Este registro entra con
            margen <b className="text-texto">±30 %</b> y tu coach lo verá marcado.
          </p>
        )}
      </section>

      <div className="flex items-center justify-between rounded-2xl border border-linea bg-surface-2 px-4 py-3">
        <span className="text-xs text-tenue">Margen del registro</span>
        <span className="cifras text-sm font-bold text-texto">±{margen} %</span>
      </div>
    </div>
  )
}
