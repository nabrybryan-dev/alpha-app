import { veredictoDeLaPuerta, type SemanaDeFirma, type MotivoCerrada } from '../../domain/aprobacion/puerta'

/** Un borrador esperando firma. Lo que la bandeja necesita para pintarlo, y nada más. */
export interface BorradorPendiente {
  id: string
  /** A quién va dirigido. */
  para: string
  /** El texto tal como saldría. */
  texto: string
  /** Si además lleva vídeo, y por tanto la cara y la voz. */
  conVideo?: boolean
}

export interface BandejaAprobacionProps {
  /** Lo que espera firma AHORA. */
  pendientes: readonly BorradorPendiente[]
  /** Las semanas de ESTE firmante, de la más antigua a la más reciente. */
  historial: readonly SemanaDeFirma[]
  onAprobar: (id: string) => void
  onCorregir: (id: string) => void
}

/**
 * LA BANDEJA DE FIRMA, y el estado de la puerta encima.
 *
 * ## Por qué la puerta se enseña, y se enseña con su motivo
 *
 * Lo que hay detrás de esta pantalla no es una cola de textos: son veintitrés vídeos por
 * semana con la cara y la voz clonadas de Bryan. La puerta decide si algún día salen sin
 * que él los oiga, así que **tiene que poder mirarla y saber por qué está como está**. Una
 * puerta que se abre sola y en silencio es la forma de enterarse por un asesorado.
 *
 * Y el motivo se pinta literal, no de adorno: «llevas dos de cuatro» y «esa semana se
 * quedaron seis sin mirar» son cosas distintas que llevan a acciones distintas — la primera
 * es esperar, la segunda es que la bandeja se le quedó a medias.
 *
 * ## Lo que esta pantalla NO hace
 *
 * No decide: lo decide `domain/aprobacion/puerta.ts`, que es puro y tiene sus pruebas. Aquí
 * solo se pinta. Si el día de mañana hay dos sitios que quieren saber si la puerta está
 * abierta, los dos preguntan ahí y no puede haber dos respuestas.
 *
 * Y no toca `features/coach/**` ni `features/chat/**`, que son de otra sección.
 */

const EXPLICACION: Record<MotivoCerrada, (n: number) => string> = {
  'sin-historial': () => 'Todavía no hay ninguna semana con borradores delante.',
  'faltan-semanas': (n) => `Llevas ${n} de 4 semanas seguidas sin corregir nada.`,
  'hubo-correccion': () => 'Corregiste algo la última semana, así que la cuenta empieza de nuevo.',
  'semana-floja': () =>
    'La última semana tuvo tan pocos borradores que no cuenta como prueba de nada.',
  'quedaron-sin-mirar': () =>
    'La última semana quedaron borradores sin abrir, y lo que nadie miró no está aprobado.',
}

export function BandejaAprobacion({
  pendientes,
  historial,
  onAprobar,
  onCorregir,
}: BandejaAprobacionProps) {
  const veredicto = veredictoDeLaPuerta(historial)

  return (
    <section data-bandeja="aprobacion" className="flex flex-col gap-4">
      {/* EL ESTADO DE LA PUERTA. Va arriba porque es lo que cambia el significado de todo
          lo de abajo: firmar con la puerta cerrada es revisar; con la puerta abierta es
          comprobar por encima algo que ya podría haber salido solo. */}
      <div
        data-puerta={veredicto.abierta ? 'abierta' : 'cerrada'}
        className="rounded-tarjeta border border-linea bg-ink-900 px-4 py-3"
      >
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-tenue">Salida automática</p>
        {veredicto.abierta ? (
          <>
            <p className="mt-1 text-sm font-semibold text-texto">
              Abierta desde la semana del {veredicto.desde}
            </p>
            {/* Se dice que se puede cerrar, y cómo. Una puerta que se abrió sola y de la que
                no se sabe salir es peor que no tenerla. */}
            <p className="mt-1 text-[11px] leading-snug text-tenue">
              Los borradores pueden salir sin que los mires. Corrige uno y vuelve a cerrarse.
            </p>
          </>
        ) : (
          <>
            <p className="mt-1 text-sm font-semibold text-texto">Cerrada</p>
            <p className="mt-1 text-[11px] leading-snug text-tenue">
              {EXPLICACION[veredicto.motivo](veredicto.semanasLimpias)}
            </p>
          </>
        )}
      </div>

      {/* LOS BORRADORES. Sin ninguno, se dice — y no se deja el hueco en blanco, que se lee
          como que la pantalla no cargó. */}
      {pendientes.length === 0 ? (
        <p data-vacia="" className="px-1 text-sm text-tenue">
          No hay nada esperando tu firma.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {pendientes.map((b) => (
            <li
              key={b.id}
              data-borrador={b.id}
              className="rounded-tarjeta border border-linea bg-ink-900 px-4 py-3"
            >
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-xs font-bold uppercase tracking-[0.14em] text-tenue">
                  {b.para}
                </span>
                {/* QUE LLEVA VÍDEO SE DICE. No es un detalle de formato: aprobar un texto es
                    aprobar unas palabras, y aprobar esto es dejar salir tu cara y tu voz. */}
                {b.conVideo && (
                  <span data-con-video="" className="text-[11px] font-semibold text-accion">
                    con tu cara y tu voz
                  </span>
                )}
              </div>
              <p className="mt-2 whitespace-pre-line text-sm leading-snug text-texto">{b.texto}</p>
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={() => onAprobar(b.id)}
                  className="press min-h-[44px] flex-1 rounded-boton bg-accion px-3 text-sm font-semibold text-ink-1000"
                >
                  Sale tal cual
                </button>
                <button
                  type="button"
                  onClick={() => onCorregir(b.id)}
                  className="press min-h-[44px] flex-1 rounded-boton border border-linea px-3 text-sm font-semibold text-texto"
                >
                  Corregir
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
