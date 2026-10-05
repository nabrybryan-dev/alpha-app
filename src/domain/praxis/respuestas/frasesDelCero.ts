/**
 * La condición del cero: cuando la persona dijo que le quedaban 0 repeticiones,
 * la respuesta no puede ser la frase de siempre («te quedaban 0 más»). Decisión
 * de Bryan, 1-oct-2026.
 *
 * El esquema de plantillas de Praxis no tiene condición por valor de ranura, así
 * que el caso del cero vive aparte y es el enrutador de respuestas quien lo aplica
 * ANTES de elegir una variante: `variantesParaElTurno(plantilla, ranuras)`.
 *
 * Fuente de las frases: `FRASES-DEL-CERO.json` del repo de lenguaje
 * (estilo-de-vida/lenguaje/respuestas-ampliacion/). Estado: borrador a calificar
 * por Bryan; si cambian allí, se copian aquí. Aún no tienen clip grabado.
 *
 * **`RIR 0` no es `FALLO`.** RIR 0 es llegar justo al límite COMPLETANDO la última
 * repetición; FALLO es no completarla (`objetivoDeIntensidad.ts`, `registro/rir.ts`).
 * Esta condición solo se dispara con el número 0. `'FALLO'`, un RIR ausente o un
 * texto que no sea el cero NO activan el caso del cero, y este archivo no convierte
 * uno en el otro: si el registro no trae un RIR numérico, la frase es la normal.
 */

export interface TextoDeVariante {
  tu: string
  usted: string
}

export interface CasoDelCero {
  /** Id de la plantilla cuya variante normal diría «te quedaban {rir} más». */
  plantilla: string
  /** Registro de la plantilla (R0, R1, R2) o `*` si vale para todos. */
  registro: string
  variantes: readonly TextoDeVariante[]
}

export const CASOS_DEL_CERO: readonly CasoDelCero[] = [
  {
    plantilla: 'PLT-AMPI_REPORTAR-0003',
    registro: 'R0',
    variantes: [
      { tu: 'No te quedó ninguna. Listo.', usted: 'No le quedó ninguna. Listo.' },
      { tu: 'Ya anoté que no te quedó ninguna.', usted: 'Ya anoté que no le quedó ninguna.' },
      { tu: 'Llegaste hasta la última. Sigue a tu ritmo.', usted: 'Llegó hasta la última. Siga a su ritmo.' },
    ],
  },
  {
    plantilla: 'PLT-AMPB_REPORTAR-0076',
    registro: '*',
    variantes: [
      {
        tu: 'No te quedó ninguna, ya lo anoté. ¿Cómo sentiste la técnica al final?',
        usted: 'No le quedó ninguna, ya lo anoté. ¿Cómo sintió la técnica al final?',
      },
      {
        tu: 'Terminaste {ejercicio} sin guardarte ninguna. ¿Qué tal la última repetición?',
        usted: 'Terminó {ejercicio} sin guardarse ninguna. ¿Qué tal la última repetición?',
      },
      {
        tu: 'Al final de la serie no te quedó ninguna. ¿Fue cómoda o exigente?',
        usted: 'Al final de la serie no le quedó ninguna. ¿Fue cómoda o exigente?',
      },
    ],
  },
  {
    plantilla: 'PLT-AMPB_REPORTAR-0078',
    registro: '*',
    variantes: [
      {
        tu: 'En {ejercicio} llegaste al tope con control. ¿Cómo sentiste la técnica?',
        usted: 'En {ejercicio} llegó al tope con control. ¿Cómo sintió la técnica?',
      },
      {
        tu: 'La serie salió firme, y no te quedó ninguna. ¿Cómo lograste que saliera así?',
        usted: 'La serie salió firme, y no le quedó ninguna. ¿Cómo logró que saliera así?',
      },
      {
        tu: 'Esa serie la sacaste sin dejar ninguna. ¿Qué tal el resto de la sesión?',
        usted: 'Esa serie la sacó sin dejar ninguna. ¿Qué tal el resto de la sesión?',
      },
    ],
  },
]

/**
 * ¿La persona dijo que le quedaban 0? Solo el número 0 (o su texto «0» ya
 * resuelto en la ranura). `'FALLO'`, `undefined`, `null`, `NaN`, negativos y
 * cualquier otra cosa dan `false`: FALLO no es RIR 0.
 */
export function esRirCero(rir: unknown): boolean {
  if (typeof rir === 'number') return rir === 0
  if (typeof rir === 'string') return /^\s*0\s*$/.test(rir)
  return false
}

export function casoDelCero(plantillaId: string, registro?: string): CasoDelCero | undefined {
  return CASOS_DEL_CERO.find((c) => c.plantilla === plantillaId && (c.registro === '*' || c.registro === registro))
}

export interface PlantillaConVariantes<V extends TextoDeVariante = TextoDeVariante> {
  id: string
  registro?: string
  variantes: readonly V[]
}

export interface VariantesDelTurno<V extends TextoDeVariante = TextoDeVariante> {
  /** `cero`: se usaron las frases del cero; `plantilla`: las de siempre. */
  origen: 'cero' | 'plantilla'
  variantes: readonly (V | TextoDeVariante)[]
}

/**
 * Qué variantes puede elegir el enrutador para este turno. Con `{rir}` = 0 y una
 * plantilla que tenga caso del cero, las del cero REEMPLAZAN a las de la
 * plantilla; con `{rir}` >= 1, o sin RIR, o con `'FALLO'`, las de siempre.
 */
export function variantesParaElTurno<V extends TextoDeVariante>(
  plantilla: PlantillaConVariantes<V>,
  ranuras: { rir?: unknown },
): VariantesDelTurno<V> {
  if (esRirCero(ranuras.rir)) {
    const caso = casoDelCero(plantilla.id, plantilla.registro)
    if (caso) return { origen: 'cero', variantes: caso.variantes }
  }
  return { origen: 'plantilla', variantes: plantilla.variantes }
}
