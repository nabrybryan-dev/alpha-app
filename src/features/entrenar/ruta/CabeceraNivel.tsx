import type { NivelAlfa } from '../../../domain/rutaEntrenamiento'

/** "NIVEL 03 · RENDIMIENTO" + el distintivo cuadrado con el número. */
export function CabeceraNivel({ nivel }: { nivel: NivelAlfa }) {
  return (
    // `escena-prof` va aquí y el `translateZ` en el distintivo, nunca al revés: este
    // mismo elemento lleva `.entrada`, que anima `transform`. Dos reglas peleándose por
    // `transform` las gana la última y la profundidad desaparecería sin aviso — el
    // mismo choque que `tokens.css` documenta entre `.tecla-3d` y `.press`.
    <header className="escena-prof entrada entrada-1 flex items-center justify-between gap-3">
      <div className="min-w-0">
        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-silver-500">
          Tu ruta de entrenamiento
        </p>
        <h2 className="mt-1.5 font-display text-2xl leading-[1.05] text-silver-100">
          Nivel {nivel.numero} · {nivel.nombre}
        </h2>
      </div>
      <span
        aria-hidden="true"
        className="relieve-3d cifras grid h-[46px] w-[46px] shrink-0 place-items-center rounded-[13px] border border-accion/40 text-[17px] font-bold text-accion"
        // El distintivo del nivel es un EMBLEMA, no un dato: va acuñado sobre la placa
        // a `--prof-relieve`, que `tokens.css:274` define justo para eso («acuñado
        // sobre la placa: tipografía, chips, teclas»). No es tocable, así que no le
        // aplica la regla de que ninguna diana baje del plano.
        // Solo el color: el escalon, la sombra y la cara iluminada los pone
        // `.relieve-3d`. Antes iban aqui a mano, que es como se acaba teniendo
        // cinco relieves distintos sin que nadie lo decida.
        //
        // `backgroundColor` y NO el abreviado `background`: el abreviado reinicia
        // `background-image`, o sea que se llevaria por delante la cara iluminada
        // que pone la clase. Y en linea gana siempre, asi que el relieve se
        // quedaria en dos sombras sueltas sin que nada avise.
        style={{ backgroundColor: 'color-mix(in srgb, var(--accion) 14%, var(--ink-700))' }}
      >
        {nivel.numero}
      </span>
    </header>
  )
}
