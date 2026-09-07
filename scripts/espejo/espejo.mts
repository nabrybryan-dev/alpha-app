/**
 * El espejo: qué ve la persona, sin abrir un navegador.
 *
 * POR QUÉ EXISTE. El 6-sep-2026 se cargaron veintitrés planes y varias veces lo
 * escrito no era lo que la persona veía: un veredicto dijo «cargado» con el SQL
 * sin ejecutar, dos planes salieron con marcas heredadas, las notas de la semana
 * imprimían `||` literales porque nadie las había mirado renderizadas, y dos
 * sesiones de cardio parecían vacías sin estarlo. **Cada una se descubrió a mano,
 * mirando.** Esto es para que no haya que mirar a mano.
 *
 * LO QUE HACE QUE ESTO NO MIENTA: importa el código de la app **tal cual**.
 * `armarSemana` e `inicioSemanaDe` deciden la rejilla, `objetivosDelBloque` parte
 * la nota y `sesionCompleta` dice si una sesión está cerrada. Si esta pieza
 * reimplementara cualquiera de las cuatro, enseñaría lo que yo creo que hace la
 * app y no lo que la app hace — que es exactamente el fallo que viene a cazar.
 *
 * NO LEE LA BASE, a propósito. Recibe un microciclo en JSON, así que puede correr
 * sobre un fixture inventado en el CI y sobre un volcado real fuera del repo, sin
 * credenciales y sin sacar datos de salud a ningún sitio.
 *
 * Uso:
 *   npm run espejo -- --microciclo <ruta.json> [--hoy AAAA-MM-DD] [--nota <ruta.txt>]
 *
 * El JSON puede ser un `Microciclo` pelado, o `{ microciclo, nota }` para incluir
 * la nota de la semana (`perfiles.datos.objetivos`) en la misma corrida.
 */

import { readFileSync } from 'node:fs'
import { armarSemana, inicioSemanaDe, ultimoDiaDe, type DiaRuta } from '../../src/domain/rutaEntrenamiento.ts'
import { objetivosDelBloque } from '../../src/domain/objetivosDelBloque.ts'
import { sesionCompleta } from '../../src/domain/cumplimiento.ts'
import type { Microciclo, Sesion, EjercicioPrescrito, ItemMarcable } from '../../src/domain/types.ts'

/** Un aviso es un fallo concreto con su sitio, no una impresión. */
export interface Aviso {
  /** Clave estable, para que un test afirme sobre ella y no sobre la prosa. */
  clave:
    | 'sesion-vacia'
    | 'barras-literales'
    | 'nota-vieja'
    | 'carga-sin-kilos'
    | 'descanso-en-cadencia'
  /** Dónde: día, sesión o ejercicio. */
  donde: string
  /** Qué pasa, en la lengua del coach. */
  detalle: string
}

export interface DiaDelEspejo {
  dia: DiaRuta
  sesion?: Sesion
  ejercicios: number
  bloques: number
}

export interface Espejo {
  microciclo: Microciclo
  hoyIso: string
  inicio: 'DOMINGO' | 'LUNES'
  dias: DiaDelEspejo[]
  nota?: string
  avisos: Aviso[]
}

/** El día que cierra el microciclo; `undefined` si le falta fecha o cadencia. */
function ultimoDia(micro: Microciclo): string | undefined {
  return ultimoDiaDe(micro)
}

/** Dentro de la cadencia = entre el arranque y el último día, los dos incluidos. */
function dentroDeLaCadencia(micro: Microciclo, fechaIso: string): boolean {
  const ultimo = ultimoDia(micro)
  if (!micro.fechaInicio || !ultimo) return false
  return fechaIso >= micro.fechaInicio && fechaIso <= ultimo
}

/**
 * Una sesión está vacía cuando no tiene NI ejercicios NI bloques de cardio.
 *
 * La distinción importa: una metabólica sin `ejercicios` es correcta —lo que la
 * persona ve son sus `bloquesCardio`— y contarla como vacía sería un falso rojo.
 * El fallo real es la sesión que no tiene ninguna de las dos cosas: título con
 * nada debajo. Pasó el 6-sep y validaba en verde.
 */
function estaVacia(sesion: Sesion): boolean {
  return (sesion.ejercicios?.length ?? 0) === 0 && (sesion.bloquesCardio?.length ?? 0) === 0
}

/** Los textos que la persona lee dentro de una sesión, con su procedencia. */
function textosDe(sesion: Sesion): { donde: string; texto: string }[] {
  const items: { donde: string; texto: string }[] = []
  for (const b of sesion.bloquesCardio ?? []) {
    items.push({ donde: `${sesion.nombre} · bloque «${b.titulo}»`, texto: b.indicaciones ?? '' })
  }
  for (const p of (sesion.preparacion ?? []) as ItemMarcable[]) {
    items.push({ donde: `${sesion.nombre} · preparación «${p.titulo}»`, texto: p.indicaciones ?? '' })
  }
  return items
}

/**
 * Un ejercicio que pide kilos y no dice cuántos POR NINGÚN SITIO.
 *
 * DOS COSAS QUE NO SON LA MISMA, y el espejo solo mira una. Que `cargaKg` esté
 * vacío mientras la frase dice «85KG» es una divergencia entre el campo y el
 * texto — real, pero ya la vigilan `comprobar-alineacion.sql` y
 * `comprobar-cabecera-no-canonica.sql`, y a la persona no le duele: abre la app
 * y lee sus 85 kg. Aquí se caza lo que sí le duele: **no hay número en el campo
 * ni en la frase**, así que se planta delante de la máquina sin saber qué poner.
 *
 * Es exactamente lo que pasó con una asesorada el 7-sep: las tres sesiones que
 * no hacía eran las tres que iban sin carga escrita, y la única que hacía era la
 * que traía números.
 *
 * `cargaKg` sin definir NO basta como señal: hay prescripciones legítimas sin
 * kilos —peso corporal, tiempo, «registra tu carga»—, y el propio tipo lo dice.
 */
function pideKilosYNoDiceCuantos(ej: EjercicioPrescrito): boolean {
  if (ej.cargaKg !== undefined && ej.cargaKg !== null) return false
  const frase = ej.prescripcion ?? ''
  // La frase salva al ejercicio: si trae los kilos, la persona tiene su número.
  if (/\d+(?:[.,]\d+)?\s*KG\b/i.test(frase)) return false
  // Sin número en ninguna parte, solo es fallo si algo declara que van kilos.
  return ej.unidadCarga === 'kg'
}

/** El número de microciclo más alto que cita la nota («M25» → 25). */
export function microciclosCitados(nota: string): number[] {
  return [...nota.matchAll(/\bM(\d{1,3})\b/g)].map((m) => Number(m[1]))
}

/**
 * Los cinco avisos, cada uno nacido de un fallo real del 6 y 7 de septiembre.
 *
 * Se calculan sobre la rejilla YA armada por la app, no sobre el JSON en crudo:
 * lo que importa no es lo que el microciclo dice, sino lo que llega a la pantalla.
 */
export function avisosDe(micro: Microciclo, dias: DiaDelEspejo[], nota?: string): Aviso[] {
  const avisos: Aviso[] = []

  for (const sesion of micro.sesiones) {
    if (estaVacia(sesion)) {
      avisos.push({
        clave: 'sesion-vacia',
        donde: sesion.nombre,
        detalle: 'sin un solo ejercicio y sin bloques de cardio: la persona abre el día y no hay nada debajo del título.',
      })
    }

    for (const { donde, texto } of textosDe(sesion)) {
      if (texto.includes('||')) {
        avisos.push({
          clave: 'barras-literales',
          donde,
          detalle: 'lleva `||` dentro: el separador del generador se imprime tal cual y funde los párrafos.',
        })
      }
    }

    for (const ej of sesion.ejercicios ?? []) {
      if (pideKilosYNoDiceCuantos(ej)) {
        avisos.push({
          clave: 'carga-sin-kilos',
          donde: `${sesion.nombre} · ${ej.nombre}`,
          detalle: 'pide kilos y no dice cuántos, ni en el campo ni en la frase: se planta delante de la máquina sin saber qué poner.',
        })
      }
    }
  }

  if (nota) {
    const viejos = microciclosCitados(nota).filter((n) => n < micro.numero)
    if (viejos.length > 0) {
      const lista = [...new Set(viejos)].sort((a, b) => a - b).map((n) => `M${n}`).join(', ')
      avisos.push({
        clave: 'nota-vieja',
        donde: 'nota de la semana',
        detalle: `habla de ${lista} y el microciclo activo es el M${micro.numero}: la persona lee instrucciones de una semana que ya pasó.`,
      })
    }
  }

  // «Descanso» dentro de la cadencia solo es un fallo cuando hay sesiones que no
  // llegaron a la rejilla. Una semana de cuatro sesiones tiene días de descanso
  // legítimos; lo que no es legítimo es que una sesión programada no se vea en
  // ninguna parte, que es lo que dejó catorce cuentas en blanco el 6-sep.
  const colocadas = new Set(dias.map((d) => d.dia.sesionId).filter(Boolean) as string[])
  const perdidas = micro.sesiones.filter((s) => !colocadas.has(s.id))
  if (perdidas.length > 0) {
    const enBlanco = dias
      .filter((d) => !d.dia.sesionId && dentroDeLaCadencia(micro, d.dia.fechaIso))
      .map((d) => d.dia.dia)
    avisos.push({
      clave: 'descanso-en-cadencia',
      donde: enBlanco.length > 0 ? enBlanco.join(', ') : 'la rejilla',
      detalle: `${perdidas.length} sesión/es del microciclo no aparecen en ningún día (${perdidas
        .map((s) => s.nombre)
        .join(' · ')}): la persona ve «Descanso» donde tenía plan.`,
    })
  }

  return avisos
}

/** Arma el espejo: la rejilla de la app, más lo que hay dentro de cada día. */
export function espejar(micro: Microciclo, hoyIso: string, nota?: string): Espejo {
  const porId = new Map(micro.sesiones.map((s) => [s.id, s]))
  const dias: DiaDelEspejo[] = armarSemana(micro, hoyIso).map((dia) => {
    const sesion = dia.sesionId ? porId.get(dia.sesionId) : undefined
    return {
      dia,
      sesion,
      ejercicios: sesion?.ejercicios?.length ?? 0,
      bloques: sesion?.bloquesCardio?.length ?? 0,
    }
  })
  return {
    microciclo: micro,
    hoyIso,
    inicio: inicioSemanaDe(micro),
    dias,
    nota,
    avisos: avisosDe(micro, dias, nota),
  }
}

/** El objetivo de intensidad, tal como lo lee la persona. */
function rirLegible(ej: EjercicioPrescrito): string {
  return typeof ej.rirObjetivo === 'number' ? `RIR ${ej.rirObjetivo}` : String(ej.rirObjetivo)
}

/** La carga, o el hueco dicho en voz alta. */
function cargaLegible(ej: EjercicioPrescrito): string {
  if (ej.cargaKg === undefined || ej.cargaKg === null) return 'sin kilos'
  return `${ej.cargaKg}${ej.unidadCarga && ej.unidadCarga !== 'kg' ? ` (${ej.unidadCarga})` : ' kg'}`
}

/** El texto que se imprime: la semana, la nota en tarjetas y los avisos. */
export function renderizar(espejo: Espejo): string {
  const { microciclo: micro } = espejo
  const l: string[] = []
  const ultimo = ultimoDia(micro) ?? '—'
  l.push(`ESPEJO · M${micro.numero} · ${micro.estado}`)
  l.push(`arranca ${micro.fechaInicio} · cadencia ${micro.cadenciaDias} · último día ${ultimo}`)
  l.push(`hoy ${espejo.hoyIso} · la semana abre en ${espejo.inicio}`)
  l.push('')

  for (const d of espejo.dias) {
    const hoy = d.dia.esHoy ? ' ← hoy' : ''
    l.push(`${d.dia.dia} ${d.dia.numero} · ${d.dia.titulo}${hoy}`)
    if (!d.sesion) {
      l.push(`    ${d.dia.detalle}`)
      l.push('')
      continue
    }
    const cerrada = sesionCompleta(d.sesion) ? ' · CERRADA' : ''
    l.push(`    ${d.ejercicios} ejercicio/s · ${d.bloques} bloque/s${cerrada}`)
    for (const ej of d.sesion.ejercicios ?? []) {
      l.push(`    · ${ej.nombre} — ${ej.sets}×${ej.rango} · ${cargaLegible(ej)} · ${rirLegible(ej)}`)
    }
    for (const b of d.sesion.bloquesCardio ?? []) {
      l.push(`    ▸ ${b.titulo}${b.duracionMin ? ` (${b.duracionMin} min)` : ''}`)
    }
    l.push('')
  }

  l.push('NOTA:')
  if (!espejo.nota) {
    l.push('    (sin nota de la semana: la app no pinta nada)')
  } else {
    const { titular, entrada, secciones } = objetivosDelBloque(espejo.nota)
    if (titular) l.push(`    [${titular}]`)
    if (entrada) l.push(`    ${entrada}`)
    for (const s of secciones) l.push(`    · ${s.etiqueta ? `${s.etiqueta}: ` : ''}${s.texto}`)
  }
  l.push('')

  l.push('AVISOS:')
  if (espejo.avisos.length === 0) {
    l.push('    ninguno.')
  } else {
    for (const a of espejo.avisos) l.push(`    [${a.clave}] ${a.donde} — ${a.detalle}`)
  }
  return l.join('\n')
}

/** Hoy en local, con el mismo criterio que `hoyIso()` de la app: nunca UTC. */
function hoyLocal(): string {
  const d = new Date()
  const mes = String(d.getMonth() + 1).padStart(2, '0')
  return `${d.getFullYear()}-${mes}-${String(d.getDate()).padStart(2, '0')}`
}

interface Argumentos {
  microciclo?: string
  hoy?: string
  nota?: string
}

export function leerArgumentos(argv: readonly string[]): Argumentos {
  const args: Argumentos = {}
  for (let i = 0; i < argv.length; i++) {
    const bandera = argv[i]
    if (bandera === '--microciclo') args.microciclo = argv[++i]
    else if (bandera === '--hoy') args.hoy = argv[++i]
    else if (bandera === '--nota') args.nota = argv[++i]
  }
  return args
}

/** Acepta un `Microciclo` pelado o `{ microciclo, nota }`. */
export function leerFixture(crudo: string): { microciclo: Microciclo; nota?: string } {
  const dato = JSON.parse(crudo) as Microciclo | { microciclo: Microciclo; nota?: string }
  if ('microciclo' in dato && dato.microciclo) {
    return { microciclo: dato.microciclo, nota: dato.nota }
  }
  return { microciclo: dato as Microciclo }
}

function principal(): number {
  const args = leerArgumentos(process.argv.slice(2))
  if (!args.microciclo) {
    console.error('Falta --microciclo <ruta.json>. Uso:')
    console.error('  npm run espejo -- --microciclo <ruta.json> [--hoy AAAA-MM-DD] [--nota <ruta.txt>]')
    return 1
  }
  const { microciclo, nota } = leerFixture(readFileSync(args.microciclo, 'utf8'))
  const notaFinal = args.nota ? readFileSync(args.nota, 'utf8') : nota
  console.log(renderizar(espejar(microciclo, args.hoy ?? hoyLocal(), notaFinal)))
  return 0
}

/**
 * ¿Esto se está EJECUTANDO como script, o lo ha importado un test?
 *
 * NO se compara `argv[1]` con este archivo, y es una lección medida: bajo
 * `vite-node` —que es como lo lanza `npm run espejo`— `argv[1]` es
 * `vite-node.mjs` y la ruta del script se la queda el propio lanzador, así que
 * esa comparación no coincide JAMÁS y el espejo no imprimía nada. Salía con
 * exit 0 y sin una línea: el peor fallo posible en una herramienta que existe
 * para que mires.
 *
 * La señal que sí es fiable en los dos caminos es la del arnés: vitest exporta
 * `VITEST` en el entorno de sus procesos. Fuera de la batería, esto es el script.
 */
function loCorreUnTest(): boolean {
  return Boolean(process.env?.VITEST)
}

if (!loCorreUnTest()) process.exitCode = principal()
