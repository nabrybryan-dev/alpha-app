import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MENSAJES_DE_BLOQUE, TURNOS_VOZ, type TurnoId } from '../../../domain/praxis/ingreso/guion'
import type { RespuestaIngreso } from '../../../domain/praxis/ingreso/prueba'
import { UMBRAL_MS } from '../motor/reconocedor'
import { Voz } from '../motor/voz'
import { IngresoPrueba } from './IngresoPrueba'

/**
 * La pantalla de la prueba del ingreso, con un reconocedor de voz FALSO, una conexión FALSA y un reloj manual:
 * lo que se prueba es el flujo (los dos modos completos), el cronómetro, que Praxis diga lo que Bryan escribió, y
 * que «Copiar resultado» no lleve ningún valor del formulario.
 */
vi.setConfig({ testTimeout: 30_000 })

/* ——— El reconocedor falso: dice lo que se le pida al soltar ——— */
const evento = (texto: string) => ({ resultIndex: 0, results: [Object.assign([{ transcript: texto }], { isFinal: true })] })
class Falso {
  static ultimo: Falso | null = null
  static texto = ''
  lang = ''; interimResults = false; continuous = false; maxAlternatives = 0
  onresult: ((e: ReturnType<typeof evento>) => void) | null = null
  onerror: ((e: { error: string }) => void) | null = null
  onend: (() => void) | null = null
  iniciado = false
  final = Falso.texto
  constructor() { Falso.ultimo = this }
  start() { this.iniciado = true }
  stop() { const f = this.final; queueMicrotask(() => { if (f) this.onresult?.(evento(f)); this.onend?.() }) }
  abort() { queueMicrotask(() => this.onend?.()) }
}
const ventana = window as unknown as Record<string, unknown>

/* ——— La conexión falsa: contesta por turno ——— */
const RESPUESTA: Record<TurnoId, Record<string, string | number>> = {
  sobre_ti: { ciudad: 'Zipaquirá', edad: 47, altura_cm: 175, peso_actual_kg: 83.7 },
  historia_entreno: { peso_objetivo_kg: 78, tiempo_entrenando: '1 a 2 años', nivel_fuerza: 'Intermedio' },
  objetivo: { objetivo_principal: 'Pérdida de grasa', parte_a_mejorar: 'la barriga y la espalda' },
  trabajo_horarios: { tipo_trabajo: 'oficina sentado 9 h', dia_tipo_alimentacion: 'salgo a las seis de la tarde' },
  comida: { vasos_agua: 'seis vasos' }, // «cocina_o_compra» no se dijo: queda vacío
}
const buena = (turno: TurnoId): RespuestaIngreso => ({ ok: true, derivada: false, turno, campos: RESPUESTA[turno], temas: [], toques: [], descartados: [] })
function crearExtraer(a: (turno: TurnoId, texto: string) => RespuestaIngreso = (t) => buena(t)) {
  return vi.fn(async (turno: TurnoId, texto: string): Promise<RespuestaIngreso> => a(turno, texto))
}

/* ——— El reloj manual ——— */
let ahora = 0
const reloj = () => ahora

function montar(opciones: { trato?: 'tu' | 'usted'; extraer?: ReturnType<typeof crearExtraer> } = {}) {
  const extraer = opciones.extraer ?? crearExtraer()
  const r = render(
    <MemoryRouter>
      <IngresoPrueba trato={opciones.trato ?? 'tu'} salida="/coach" extraer={extraer} reloj={reloj} />
    </MemoryRouter>,
  )
  return { extraer, ...r }
}

const boton = (nombre: string | RegExp) => screen.getByRole('button', { name: nombre })
const botonHablar = () => boton(/Mantén presionado para hablar/)
async function dictar(texto: string) {
  Falso.texto = texto
  Falso.ultimo = null // cada toma crea su propio reconocedor
  const b = botonHablar()
  fireEvent.pointerDown(b, { pointerId: 1, button: 0, pointerType: 'touch' })
  await act(async () => { await new Promise((r) => setTimeout(r, UMBRAL_MS + 60)) }) // pasa el umbral de 250 ms: se abre el reconocedor
  expect((Falso.ultimo as Falso | null)?.iniciado).toBe(true)
  await act(async () => {
    fireEvent.pointerUp(b, { pointerId: 1, button: 0, pointerType: 'touch' })
    await new Promise((r) => setTimeout(r, 0)) // el reconocedor entrega lo final y la función contesta
  })
}
/** Dicta un turno y espera a que aparezca la pregunta siguiente. */
async function turno(texto: string, siguiente: RegExp | string) {
  await dictar(texto)
  await waitFor(() => expect(screen.getByRole('heading', { level: 2, name: siguiente })).toBeInTheDocument())
}
const toque = async (pregunta: RegExp | string, respuesta: string) => {
  await waitFor(() => expect(screen.getByRole('heading', { level: 2, name: pregunta })).toBeInTheDocument())
  fireEvent.click(boton(respuesta))
}

/** Los cinco turnos hablados, hasta llegar a la primera pregunta de toque. */
async function hablarTodo() {
  await dictar('Soy de Zipaquirá, cuarenta y siete, uno setenta y cinco, ochenta y tres con siete')
  await waitFor(() => expect(screen.getByRole('heading', { level: 2, name: TURNOS_VOZ[1].pregunta })).toBeInTheDocument())
  await turno('setenta y ocho kilos, año y medio, intermedio', TURNOS_VOZ[2].pregunta)
  await turno('quiero bajar la barriga y la espalda', TURNOS_VOZ[3].pregunta)
  await turno('trabajo en oficina y salgo a las seis de la tarde', TURNOS_VOZ[4].pregunta)
  await dictar('como en casa casi siempre y tomo seis vasos')
  await waitFor(() => expect(screen.getByRole('heading', { level: 2, name: '¿Eres mujer u hombre?' })).toBeInTheDocument())
}
/** Los toques: rápidos y de salud, todo «No» y una lesión con su detalle. */
async function tocarTodo() {
  await toque('¿Eres mujer u hombre?', 'Femenino')
  await toque('¿En qué país vives?', 'Colombia')
  await toque('¿Cuántos días a la semana puedes entrenar?', '3')
  await toque(/Cada cuánto quieres que revisemos/, '8')
  await toque(/problema del corazón/, 'No')
  await toque(/medicamentos para la presión/, 'No')
  await toque(/huesos o articulaciones/, 'No')
  await toque('¿Tienes o has tenido alguna lesión?', 'Sí')
  const detalle = screen.getByLabelText(/¿Cuál\? Escríbelo/)
  fireEvent.change(detalle, { target: { value: 'meniscos de la rodilla izquierda' } })
  fireEvent.click(boton('Continuar'))
  await toque(/alergia o algo que no puedas comer/, 'No')
  await toque(/dificultades con la comida/, 'No')
  await toque('¿Cómo es tu ciclo?', 'regular')
  await waitFor(() => expect(screen.getByRole('heading', { level: 2, name: 'Revisa tu formulario' })).toBeInTheDocument())
}

const campoDe = (etiqueta: RegExp | string) => screen.getByLabelText(etiqueta) as HTMLInputElement

beforeEach(() => {
  ahora = 0
  Falso.ultimo = null; Falso.texto = ''
  ventana.webkitSpeechRecognition = Falso
  delete ventana.SpeechRecognition
  vi.spyOn(Voz, 'decir').mockReturnValue(true)
})
afterEach(() => {
  vi.restoreAllMocks()
  delete ventana.webkitSpeechRecognition
})

describe('el aviso y la elección del modo', () => {
  it('dice que es una prueba interna, que nada se guarda y quién convierte la voz en texto', () => {
    montar()
    expect(screen.getByText(/Prueba interna\. Nada se guarda\. Lo que digas se convierte en texto con el reconocimiento de voz de tu teléfono \(Google o Apple\) y Praxis solo recibe el texto\./)).toBeInTheDocument()
    expect(boton('Hablando')).toBeInTheDocument()
    expect(boton('Escribiendo')).toBeInTheDocument()
  })

  it('de usted, el aviso dice «su teléfono»', () => {
    montar({ trato: 'usted' })
    expect(screen.getByText(/reconocimiento de voz de su teléfono/)).toBeInTheDocument()
  })

  it('el cronómetro no existe hasta que se toca el modo', () => {
    montar()
    expect(screen.queryByRole('timer')).not.toBeInTheDocument()
  })
})

describe('HABLANDO: el flujo completo', () => {
  it('Praxis dice (y muestra) la entrada, cada bloque con su explicación y cada pregunta con su ejemplo', async () => {
    const decir = vi.spyOn(Voz, 'decir').mockReturnValue(true)
    montar()
    fireEvent.click(boton('Hablando'))

    // Turno 1: la entrada, el bloque PRECISO (con su ejemplo) y la pregunta, en ese orden, en voz Y en texto
    const primero = String(decir.mock.calls[0][0])
    expect(primero).toBe([MENSAJES_DE_BLOQUE.entrada.tu, MENSAJES_DE_BLOQUE.preciso.tu, '¿Ciudad, edad, estatura y peso?'].join(' '))
    expect(screen.getByText(MENSAJES_DE_BLOQUE.entrada.tu)).toBeInTheDocument()
    expect(screen.getByText(MENSAJES_DE_BLOQUE.preciso.tu)).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 2, name: '¿Ciudad, edad, estatura y peso?' })).toBeInTheDocument()

    await dictar('Soy de Zipaquirá, cuarenta y siete, uno setenta y cinco, ochenta y tres con siete')
    await waitFor(() => expect(screen.getByRole('heading', { level: 2, name: TURNOS_VOZ[1].pregunta })).toBeInTheDocument())
    // Turno 2: su ejemplo literal, y ya no repite ni la entrada ni la explicación del bloque
    expect(String(decir.mock.calls[1][0])).toBe('¿A qué peso quieres llegar, cuánto llevas entrenando y en qué nivel te sientes? Por ejemplo: 75 kilos, dos años, intermedio')
    expect(screen.getByText('Por ejemplo: «75 kilos, dos años, intermedio»')).toBeInTheDocument()

    await turno('setenta y ocho kilos, año y medio, intermedio', TURNOS_VOZ[2].pregunta)
    // Turno 3: empieza el bloque CONTEXTO, con su explicación antes de la pregunta
    expect(String(decir.mock.calls[2][0])).toBe(`${MENSAJES_DE_BLOQUE.contexto.tu} ¿Qué quieres lograr y qué parte de tu cuerpo quieres mejorar?`)
    expect(screen.getByText(MENSAJES_DE_BLOQUE.contexto.tu)).toBeInTheDocument()
  })

  it('cada turno llama a la función con SU turno y SU texto, y el texto llega limpio de pausas', async () => {
    const { extraer } = montar()
    fireEvent.click(boton('Hablando'))
    await dictar('Eh, soy de Zipaquirá, mmm, cuarenta y siete')
    await waitFor(() => expect(extraer).toHaveBeenCalledTimes(1))
    expect(extraer).toHaveBeenCalledWith('sobre_ti', 'Soy de Zipaquirá, cuarenta y siete')
  })

  it('después de la voz vienen los toques, y el bloque de sí o no empieza con la frase de Bryan', async () => {
    const decir = vi.spyOn(Voz, 'decir').mockReturnValue(true)
    montar()
    fireEvent.click(boton('Hablando'))
    await hablarTodo()
    const alToque = decir.mock.calls.map((c) => String(c[0])).find((x) => x.includes('¿Eres mujer u hombre?'))
    expect(alToque).toBe('Gracias. Ahora unas preguntas rápidas: solo toca la respuesta. ¿Eres mujer u hombre?')
    await toque('¿Eres mujer u hombre?', 'Femenino')
    await toque('¿En qué país vives?', 'Colombia')
    await toque('¿Cuántos días a la semana puedes entrenar?', '3')
    await toque(/Cada cuánto quieres que revisemos/, '8')
    await waitFor(() => expect(screen.getByRole('heading', { level: 2, name: /problema del corazón/ })).toBeInTheDocument())
    const alPrimeroDeSalud = decir.mock.calls.map((c) => String(c[0])).find((x) => x.includes('problema del corazón'))
    expect(alPrimeroDeSalud?.startsWith(MENSAJES_DE_BLOQUE.si_no.tu)).toBe(true)
    expect(screen.getByText(MENSAJES_DE_BLOQUE.si_no.tu)).toBeInTheDocument()
  })

  it('la salud se toca con botones Sí / No y la revisión trae el formulario lleno y editable', async () => {
    montar()
    fireEvent.click(boton('Hablando'))
    await hablarTodo()
    await tocarTodo()

    expect(campoDe(/^Ciudad/).value).toBe('Zipaquirá')
    expect(campoDe(/^Edad/).value).toBe('47')
    expect(campoDe(/^Altura/).value).toBe('175')
    expect(campoDe(/^Peso actual/).value).toBe('83.7')
    expect(campoDe(/^Peso al que quiere llegar/).value).toBe('78')
    expect((screen.getByLabelText(/^Objetivo principal/) as HTMLSelectElement).value).toBe('Pérdida de grasa')
    expect(campoDe(/^Qué quiere mejorar/).value).toBe('la barriga y la espalda')
    // lo que no se dijo queda vacío y se marca
    expect(campoDe(/^Cocina o compra hecho/).value).toBe('')
    expect(screen.getAllByText(/Sin dato: complétalo si quieres\./).length).toBeGreaterThan(0)
    // la salud salió de los toques: el sí a las lesiones y su detalle
    const lesiones = screen.getByRole('group', { name: 'Lesiones' })
    expect(within(lesiones).getByRole('button', { name: 'Sí', pressed: true })).toBeInTheDocument()
    expect((within(lesiones).getByRole('textbox') as HTMLTextAreaElement).value).toBe('meniscos de la rodilla izquierda')
    // editable
    fireEvent.change(campoDe(/^Ciudad/), { target: { value: 'Bogotá' } })
    expect(campoDe(/^Ciudad/).value).toBe('Bogotá')
  })

  it('el cronómetro cuenta preciso / contexto / sí o no / revisión y para en «Confirmar»', async () => {
    montar()
    ahora = 10_000
    fireEvent.click(boton('Hablando'))
    expect(screen.getByRole('timer')).toBeInTheDocument()

    ahora = 30_000
    await dictar('Soy de Zipaquirá, cuarenta y siete, uno setenta y cinco, ochenta y tres con siete')
    await waitFor(() => expect(screen.getByRole('heading', { level: 2, name: TURNOS_VOZ[1].pregunta })).toBeInTheDocument())
    ahora = 52_000 // aquí termina PRECISO: 52 − 10 = 42 s
    await turno('setenta y ocho kilos, año y medio, intermedio', TURNOS_VOZ[2].pregunta)
    ahora = 80_000
    await turno('quiero bajar la barriga y la espalda', TURNOS_VOZ[3].pregunta)
    ahora = 100_000
    await turno('trabajo en oficina y salgo a las seis de la tarde', TURNOS_VOZ[4].pregunta)
    ahora = 117_000 // aquí termina CONTEXTO: 117 − 52 = 65 s
    await dictar('como en casa casi siempre y tomo seis vasos')
    await waitFor(() => expect(screen.getByRole('heading', { level: 2, name: '¿Eres mujer u hombre?' })).toBeInTheDocument())
    ahora = 125_000
    await toque('¿Eres mujer u hombre?', 'Masculino')
    await toque('¿En qué país vives?', 'Colombia')
    await toque('¿Cuántos días a la semana puedes entrenar?', '3')
    await toque(/Cada cuánto quieres que revisemos/, '8')
    await toque(/problema del corazón/, 'No')
    await toque(/medicamentos para la presión/, 'No')
    await toque(/huesos o articulaciones/, 'No')
    await toque('¿Tienes o has tenido alguna lesión?', 'No')
    await toque(/alergia o algo que no puedas comer/, 'No')
    ahora = 140_000 // aquí termina SÍ O NO: 140 − 117 = 23 s
    await toque(/dificultades con la comida/, 'No')
    await waitFor(() => expect(screen.getByRole('heading', { level: 2, name: 'Revisa tu formulario' })).toBeInTheDocument())
    ahora = 161_000 // revisión: 21 s
    fireEvent.click(boton('Confirmar'))
    ahora = 999_000 // lo que pase después de confirmar no cuenta

    const tarjeta = await screen.findByRole('region', { name: 'Resultado hablando' })
    expect(within(tarjeta).getByLabelText('Tiempo total 2:31')).toBeInTheDocument()
    const partes = Object.fromEntries(within(tarjeta).getAllByText(/^(Preciso|Contexto|Sí o no y toques|Revisión)$/).map((dt) => [dt.textContent, dt.nextElementSibling?.textContent]))
    expect(partes).toEqual({ Preciso: '0:42', Contexto: '1:05', 'Sí o no y toques': '0:23', Revisión: '0:21' })
  })

  it('cuenta lo que se corrigió en la revisión, por nombre de campo', async () => {
    montar()
    fireEvent.click(boton('Hablando'))
    await hablarTodo()
    await tocarTodo()
    fireEvent.change(campoDe(/^Ciudad/), { target: { value: 'Zipaquirá, Cundinamarca' } })
    fireEvent.change(screen.getByLabelText(/^Cocina o compra hecho/), { target: { value: 'Cocino la mayoría de mis comidas' } })
    fireEvent.change(campoDe(/^Edad/), { target: { value: '47.0' } }) // 47 y 47.0 son lo mismo: no es una corrección
    fireEvent.click(boton('Confirmar'))
    const tarjeta = await screen.findByRole('region', { name: 'Resultado hablando' })
    expect(tarjeta).toHaveTextContent('Corregiste en la revisión: 2')
    expect(tarjeta).toHaveTextContent('Ciudad, Cocina o compra hecho')
    expect(tarjeta).toHaveTextContent('Turnos: 5 por voz, 0 escritos, 0 repetidos, 0 detenidos por Praxis')
  })
})

describe('«no sé» deja el campo vacío', () => {
  it('«No sé» en un toque lo salta y lo deja sin valor en la revisión', async () => {
    montar()
    fireEvent.click(boton('Hablando'))
    await hablarTodo()
    await toque('¿Eres mujer u hombre?', 'Masculino')
    await toque('¿En qué país vives?', 'Colombia')
    await waitFor(() => expect(screen.getByRole('heading', { level: 2, name: /Cuántos días a la semana/ })).toBeInTheDocument())
    fireEvent.click(boton('No sé'))
    await toque(/Cada cuánto quieres que revisemos/, '8')
    for (const pregunta of [/problema del corazón/, /medicamentos para la presión/, /huesos o articulaciones/, /alguna lesión/, /alergia o algo/, /dificultades con la comida/]) await toque(pregunta, 'No')
    await waitFor(() => expect(screen.getByRole('heading', { level: 2, name: 'Revisa tu formulario' })).toBeInTheDocument())
    const dias = screen.getByLabelText(/^Días por semana/) as HTMLSelectElement
    expect(dias.value).toBe('')
  })
})

describe('ESCRIBIENDO: el mismo formulario, vacío, a mano', () => {
  it('empieza vacío, se llena a mano y el cronómetro para en «Confirmar»', async () => {
    montar()
    ahora = 5_000
    fireEvent.click(boton('Escribiendo'))
    expect(screen.getByRole('heading', { level: 2, name: 'Llénalo a mano' })).toBeInTheDocument()
    expect(screen.getByRole('timer')).toBeInTheDocument()
    expect(campoDe(/^Ciudad/).value).toBe('')
    expect(screen.queryByText(/Sin dato/)).not.toBeInTheDocument()

    fireEvent.change(campoDe(/^Ciudad/), { target: { value: 'Zipaquirá' } })
    fireEvent.change(campoDe(/^Edad/), { target: { value: '47' } })
    ahora = 77_000
    fireEvent.click(boton('Confirmar'))
    ahora = 500_000

    const tarjeta = await screen.findByRole('region', { name: 'Resultado escribiendo' })
    expect(within(tarjeta).getByLabelText('Tiempo total 1:12')).toBeInTheDocument()
    expect(tarjeta).toHaveTextContent(/Campos llenos: 2 de \d+/)
    expect(screen.queryByRole('region', { name: 'Resultado hablando' })).not.toBeInTheDocument()
  })

  it('un campo de salud sí/no abre su detalle escrito', () => {
    montar()
    fireEvent.click(boton('Escribiendo'))
    const lesiones = screen.getByRole('group', { name: 'Lesiones' })
    expect(within(lesiones).queryByRole('textbox')).not.toBeInTheDocument()
    fireEvent.click(within(lesiones).getByRole('button', { name: 'Sí' }))
    expect(within(lesiones).getByRole('textbox')).toBeInTheDocument()
  })
})

describe('el resultado y «Copiar resultado»', () => {
  async function hacerLosDos() {
    ahora = 0
    fireEvent.click(boton('Hablando'))
    await hablarTodo()
    await tocarTodo()
    fireEvent.change(campoDe(/^Ciudad/), { target: { value: 'Zipaquirá, Cundinamarca' } })
    ahora = 151_000
    fireEvent.click(boton('Confirmar'))
    await screen.findByRole('region', { name: 'Resultado hablando' })
    ahora = 200_000
    fireEvent.click(boton('Probar ahora escribiendo'))
    fireEvent.change(campoDe(/^Ciudad/), { target: { value: 'Zipaquirá' } })
    fireEvent.change(campoDe(/^Edad/), { target: { value: '47' } })
    fireEvent.change(campoDe(/^Qué quiere mejorar/), { target: { value: 'la barriga y la espalda' } })
    ahora = 272_000
    fireEvent.click(boton('Confirmar'))
    await screen.findByRole('region', { name: 'Resultado escribiendo' })
  }

  it('si hizo los dos modos, los muestra lado a lado con la comparación', async () => {
    montar()
    await hacerLosDos()
    expect(screen.getByRole('region', { name: 'Resultado hablando' })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Resultado escribiendo' })).toBeInTheDocument()
    const comparacion = screen.getByRole('region', { name: 'Comparación' })
    expect(comparacion).toHaveTextContent('2:31')
    expect(comparacion).toHaveTextContent('1:12')
    expect(comparacion).toHaveTextContent('Escribiendo fue más rápido por 1:19 (2,1 veces)')
    // ya hizo los dos: no se ofrece repetir ninguno
    expect(screen.queryByRole('button', { name: /Probar ahora/ })).not.toBeInTheDocument()
  })

  it('«Copiar resultado» copia tiempos y conteos, y NINGÚN valor del formulario', async () => {
    const escribir = vi.fn<(texto: string) => Promise<void>>(async () => {})
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: escribir }, configurable: true })
    montar()
    await hacerLosDos()
    fireEvent.click(boton('Copiar resultado'))
    await waitFor(() => expect(escribir).toHaveBeenCalledTimes(1))
    const copiado = escribir.mock.calls[0][0]

    expect(copiado).toContain('HABLANDO · total 2:31')
    expect(copiado).toContain('ESCRIBIENDO · total 1:12')
    expect(copiado).toContain('COMPARACIÓN')
    // nada de lo que la persona dijo, tocó o escribió (ni el detalle de salud)
    for (const valor of [
      'Zipaquirá', 'Cundinamarca', '83.7', '175', 'Pérdida de grasa', 'la barriga', 'espalda', 'oficina', 'seis vasos', 'meniscos', 'rodilla',
      'Intermedio', '1 a 2 años', 'Femenino', 'Colombia', 'regular',
    ]) expect(copiado, valor).not.toContain(valor)
  })

  it('si el portapapeles no deja copiar, enseña el texto para copiarlo a mano', async () => {
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: vi.fn(async () => { throw new Error('no') }) }, configurable: true })
    montar()
    fireEvent.click(boton('Escribiendo'))
    ahora = 30_000
    fireEvent.click(boton('Confirmar'))
    await screen.findByRole('region', { name: 'Resultado escribiendo' })
    fireEvent.click(boton('Copiar resultado'))
    expect(await screen.findByText(/No pude copiar solo/)).toBeInTheDocument()
    expect((screen.getByLabelText('Texto para copiar') as HTMLTextAreaElement).value).toContain('ESCRIBIENDO · total 0:30')
  })

  it('«Empezar de nuevo» borra todo y vuelve al inicio', async () => {
    montar()
    fireEvent.click(boton('Escribiendo'))
    fireEvent.change(campoDe(/^Ciudad/), { target: { value: 'Zipaquirá' } })
    fireEvent.click(boton('Confirmar'))
    await screen.findByRole('region', { name: 'Resultado escribiendo' })
    fireEvent.click(boton('Empezar de nuevo'))
    expect(boton('Hablando')).toBeInTheDocument()
    fireEvent.click(boton('Escribiendo'))
    expect(campoDe(/^Ciudad/).value).toBe('')
  })

  it('no guarda nada en el navegador', async () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem')
    montar()
    fireEvent.click(boton('Escribiendo'))
    fireEvent.change(campoDe(/^Ciudad/), { target: { value: 'Zipaquirá' } })
    fireEvent.click(boton('Confirmar'))
    await screen.findByRole('region', { name: 'Resultado escribiendo' })
    expect(setItem).not.toHaveBeenCalled()
    expect(localStorage.length).toBe(0)
    expect(sessionStorage.length).toBe(0)
  })
})

describe('cuando Praxis detiene un turno o falla', () => {
  it('un riesgo de vida detiene el turno, enseña las líneas de ayuda y no avanza hasta que la persona decida', async () => {
    const extraer = crearExtraer((t) => ({ ok: true, derivada: true, turno: t, derivacion: { filtro: 'crisis', riesgo: { tipo: 'quieta', linea: 'vida' }, urgencia: 'alta' } }))
    montar({ extraer })
    fireEvent.click(boton('Hablando'))
    await dictar('ya no quiero vivir')
    const alerta = await screen.findByRole('alert')
    expect(within(alerta).getByRole('link', { name: 'Llamar al 123' })).toHaveAttribute('href', 'tel:123')
    expect(within(alerta).getByRole('link', { name: 'Llamar al 106' })).toHaveAttribute('href', 'tel:106')
    expect(alerta).toHaveTextContent('no se avisa a nadie ni se guarda nada')
    expect(screen.getByRole('heading', { level: 2, name: TURNOS_VOZ[0].pregunta })).toBeInTheDocument()

    fireEvent.click(within(alerta).getByRole('button', { name: 'Seguir sin esta parte' }))
    expect(await screen.findByRole('heading', { level: 2, name: TURNOS_VOZ[1].pregunta })).toBeInTheDocument()
  })

  it('una mención de salud no se anota: se dice que se pregunta aparte y se puede repetir', async () => {
    const extraer = crearExtraer((t) => ({ ok: true, derivada: true, turno: t, derivacion: { filtro: 'dolor', riesgo: null, urgencia: null } }))
    montar({ extraer })
    fireEvent.click(boton('Hablando'))
    await dictar('me duele la rodilla')
    const alerta = await screen.findByRole('alert')
    expect(alerta).toHaveTextContent('Eso de salud te lo pregunto aparte, con sí o no')
    expect(within(alerta).queryByRole('link')).not.toBeInTheDocument()
    fireEvent.click(within(alerta).getByRole('button', { name: 'Repetir esta parte' }))
    expect(await screen.findByRole('button', { name: /Mantén presionado para hablar/ })).toBeEnabled()
  })

  it('si la función falla, lo dice y deja intentar de nuevo con el mismo texto', async () => {
    let llamadas = 0
    const extraer = crearExtraer((t) => (++llamadas === 1 ? { ok: false, motivo: 'red' } : buena(t)))
    montar({ extraer })
    fireEvent.click(boton('Hablando'))
    await dictar('soy de Zipaquirá')
    const alerta = await screen.findByRole('alert')
    expect(alerta).toHaveTextContent('No pude conectar con Praxis')
    fireEvent.click(within(alerta).getByRole('button', { name: 'Intentar de nuevo' }))
    expect(await screen.findByRole('heading', { level: 2, name: TURNOS_VOZ[1].pregunta })).toBeInTheDocument()
    expect(extraer).toHaveBeenNthCalledWith(2, 'sobre_ti', 'soy de Zipaquirá')
  })
})

describe('la regla dura de la salud, también en la pantalla', () => {
  it('aunque la función devolviera un campo de salud, no entra al formulario: la salud solo sale de los toques', async () => {
    const extraer = crearExtraer((t) => ({
      ok: true, derivada: false, turno: t, temas: [], toques: [], descartados: [],
      campos: { ...RESPUESTA[t], lesiones: 'Sí', parq_enfermedad_cardiaca: 'Sí', genero: 'Femenino' },
    }))
    montar({ extraer })
    fireEvent.click(boton('Hablando'))
    await hablarTodo()
    // los toques se preguntan igual: el sexo no se dio por dicho
    await toque('¿Eres mujer u hombre?', 'Masculino')
    await toque('¿En qué país vives?', 'Colombia')
    await toque('¿Cuántos días a la semana puedes entrenar?', '3')
    await toque(/Cada cuánto quieres que revisemos/, '8')
    // y el PAR-Q se pregunta con su toque
    expect(await screen.findByRole('heading', { level: 2, name: /problema del corazón/ })).toBeInTheDocument()
  })

  it('lo que la voz deja entrever de salud se pregunta primero, con un aviso', async () => {
    const extraer = crearExtraer((t) => (t === 'objetivo'
      ? { ok: true, derivada: false, turno: t, campos: RESPUESTA[t], temas: ['lesion'], toques: ['lesiones', 'parq_huesos_articulaciones'], descartados: [] }
      : buena(t)))
    montar({ extraer })
    fireEvent.click(boton('Hablando'))
    await hablarTodo()
    await toque('¿Eres mujer u hombre?', 'Masculino')
    await toque('¿En qué país vives?', 'Colombia')
    await toque('¿Cuántos días a la semana puedes entrenar?', '3')
    await toque(/Cada cuánto quieres que revisemos/, '8')
    expect(await screen.findByRole('heading', { level: 2, name: /huesos o articulaciones/ })).toBeInTheDocument()
    expect(screen.getByText(/Te oí mencionar algo de esto/)).toBeInTheDocument()
  })
})

describe('sin reconocimiento de voz', () => {
  it('cae a un campo de texto por turno, lo dice, y el turno sigue por la misma función', async () => {
    delete ventana.webkitSpeechRecognition
    const decir = vi.spyOn(Voz, 'decir').mockReturnValue(true)
    const { extraer } = montar()
    fireEvent.click(boton('Hablando'))
    expect(screen.queryByRole('button', { name: /Mantén presionado para hablar/ })).not.toBeInTheDocument()
    expect(screen.getByText(/Este navegador no tiene reconocimiento de voz\. Escribe tu respuesta aquí\./)).toBeInTheDocument()
    expect(String(decir.mock.calls[0][0])).toContain('Este navegador no tiene reconocimiento de voz')

    fireEvent.change(screen.getByLabelText('Tu respuesta'), { target: { value: 'Soy de Zipaquirá y tengo cuarenta y siete años' } })
    fireEvent.click(boton('Enviar'))
    expect(await screen.findByRole('heading', { level: 2, name: TURNOS_VOZ[1].pregunta })).toBeInTheDocument()
    expect(extraer).toHaveBeenCalledWith('sobre_ti', 'Soy de Zipaquirá y tengo cuarenta y siete años')
  })

  it('con voz también se puede escribir un turno (y se cuenta aparte)', async () => {
    const { extraer } = montar()
    fireEvent.click(boton('Hablando'))
    fireEvent.click(boton('Prefiero escribir esta respuesta'))
    fireEvent.change(screen.getByLabelText('Tu respuesta'), { target: { value: 'Zipaquirá' } })
    fireEvent.click(boton('Enviar'))
    await waitFor(() => expect(extraer).toHaveBeenCalledWith('sobre_ti', 'Zipaquirá'))
  })
})

describe('Praxis calla cuando la persona va a hablar', () => {
  it('al mantener presionado, Praxis deja de hablar', async () => {
    const callar = vi.spyOn(Voz, 'callar')
    montar()
    fireEvent.click(boton('Hablando'))
    callar.mockClear()
    await dictar('Zipaquirá')
    expect(callar).toHaveBeenCalled()
  })

  it('un toque corto no graba nada y enseña el gesto', async () => {
    montar()
    fireEvent.click(boton('Hablando'))
    const b = botonHablar()
    fireEvent.pointerDown(b, { pointerId: 1, button: 0, pointerType: 'touch' })
    fireEvent.pointerUp(b, { pointerId: 1, button: 0, pointerType: 'touch' })
    expect(await screen.findByText('Mantén presionado el botón mientras hablas.')).toBeInTheDocument()
    expect(Falso.ultimo).toBeNull()
  })

  it('apagar «Voz de Praxis» corta la voz y los textos siguen a la vista', () => {
    const decir = vi.spyOn(Voz, 'decir').mockReturnValue(true)
    montar()
    fireEvent.click(boton('Hablando'))
    fireEvent.click(boton(/Voz de Praxis: sí/))
    expect(boton(/Voz de Praxis: no/)).toBeInTheDocument()
    expect(decir).toHaveBeenCalledTimes(1)
    expect(screen.getByText(MENSAJES_DE_BLOQUE.preciso.tu)).toBeInTheDocument()
  })
})
