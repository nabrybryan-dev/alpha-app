/**
 * Etapa A del criterio firmado CRITERIO-PASO-A-FUNCION-20261104.md: casos 5 (guardas), 9 (paridad del tipo de pregunta)
 * y 10 (limpiador), más la huella del prompt congelado. Todas las frases las escribió Claude: no hay frases reales.
 */
import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { revisarGuardas } from './guardas'
import { MARCA_NOMBRE, MARCA_TELEFONO, limpiarPregunta } from './limpiador'
import { PROMPT_REDACTOR, SHA256_PROMPT_REDACTOR } from './promptRedactor'
import { tipoDePregunta } from './tipoPregunta'

import paridadJson from './paridad-tipo.json'

const paridad = paridadJson as { casos: { texto: string; tipo_python: string }[] }

describe('caso 9: el tipo de pregunta dice lo mismo que el script de Python', () => {
  it('0 desacuerdos en las 40 preguntas de la ronda 3', () => {
    expect(paridad.casos).toHaveLength(40)
    const desacuerdos = paridad.casos.filter((c) => tipoDePregunta(c.texto) !== c.tipo_python)
    expect(desacuerdos).toEqual([])
  })
  it('reconoce el «cómo» (no está entre las 40) y el borde de palabra con tildes', () => {
    expect(tipoDePregunta('¿Cómo hago una serie descendente en polea?')).toBe('como')
    expect(tipoDePregunta('¿Es cómodo el press en máquina?')).toBe('mi_caso') // «cómodo» no es «cómo»
    expect(tipoDePregunta('¿Por qué se recomienda la pausa corta?')).toBe('razon')
    // «porque» junto y sin tilde, como se escribe rápido en el celular: ninguna de las 40 lo trae (la rotura se escapó).
    expect(tipoDePregunta('porque no se llega al fallo en peso muerto')).toBe('razon')
    expect(tipoDePregunta('¿En qué consiste una serie descendente?')).toBe('definicion')
    // «cómo es que» pide una razón: el orden razón→cómo del script de Python importa (la rotura del orden se escapó).
    expect(tipoDePregunta('¿Cómo es que el fallo cansa más al otro día?')).toBe('razon')
  })
})

describe('el prompt del redactor sigue congelado', () => {
  it('su huella es la del texto medido en la ronda 3', () => {
    expect(createHash('sha256').update(PROMPT_REDACTOR, 'utf8').digest('hex')).toBe(SHA256_PROMPT_REDACTOR)
    expect(SHA256_PROMPT_REDACTOR).toBe('665ed4db650f30f3d9bdb92239e82616c595fde015b74fd09df289eae75b57ad')
  })
})

// Caso 10. Las 20 frases se escribieron ANTES de escribir el limpiador. `quitar` es lo sembrado que debe desaparecer.
const NOMBRES_CONOCIDOS = ['Carolina', 'Andrés', 'Laura', 'Daniela']
const CON_DATOS: { frase: string; quitar: string[] }[] = [
  { frase: 'Carolina puede hacer series descendentes si apenas lleva dos meses entrenando?', quitar: ['Carolina'] },
  { frase: 'mi asesorado Julián pregunta cuánto descansar entre series', quitar: ['Julián'] },
  { frase: 'cuánto cardio le dejo a andrés si quiere bajar grasa', quitar: ['andrés'] },
  { frase: 'Escríbele al 3104567890 para confirmar la hora', quitar: ['3104567890'] },
  { frase: 'por qué la Sra. Gómez no debería ir al fallo en sentadilla', quitar: ['Gómez'] },
  { frase: 'Laura me escribió desde el +57 312 456 7890 preguntando por las myo-reps', quitar: ['Laura', '312', '456', '7890'] },
  { frase: 'qué es el RIR que le puse a Tatiana', quitar: ['Tatiana'] },
  { frase: 'cuándo conviene que Mateo haga drop sets en máquina?', quitar: ['Mateo'] },
  { frase: 'llama a Daniela al 312-456-78-90 y pregúntale cómo le fue', quitar: ['Daniela', '312-456-78-90'] },
  { frase: 'Por qué Felipe se cansa tanto con las pausas cortas?', quitar: ['Felipe'] },
  // Nombre poco común en mitad de la frase: solo lo quita la regla de la mayúscula (no está en ninguna lista).
  { frase: 'cuánto descanso le dejo a Wenceslao en sentadilla', quitar: ['Wenceslao'] },
]
// Enmienda 4: nombres que ABREN la frase y NO están en la app (se escapó uno así en la medición del 4-nov, n=16).
const ABREN_FRASE: { frase: string; quitar: string[] }[] = [
  { frase: 'Sebastián pregunta si puede hacer drop sets en sentadilla', quitar: ['Sebastián'] },
  { frase: 'Yuliana dice que le duele la espalda baja. ¿Qué es una descarga?', quitar: ['Yuliana'] },
  { frase: '¿Cuánto descanso? Martha entrena a las cinco', quitar: ['Martha'] },
]
const LIMPIAS = [
  'cuánto descanso entre series en máquina?',
  'Por qué no se recomienda el fallo en peso muerto?',
  'Qué son las myo-reps?',
  'Se pueden usar series descendentes en poleas?',
  'En qué ejercicios conviene la pausa corta?',
  'Cada cuánto se puede repetir una semana de descarga?',
  'Sirve el RIR 0 para principiantes?',
  'Cuándo conviene subir de 10 a 12 repeticiones?',
  'Es mejor hacer cardio antes o después de pesas?',
  'Hay evidencia sobre técnicas de intensidad en mujeres?',
]

describe('caso 10: el limpiador quita nombres y teléfonos', () => {
  it.each(CON_DATOS)('quita lo sembrado en «$frase»', ({ frase, quitar }) => {
    const { texto, quitados } = limpiarPregunta(frase, NOMBRES_CONOCIDOS)
    for (const dato of quitar) expect(texto).not.toContain(dato)
    expect(quitados).toBeGreaterThan(0)
    expect(texto.includes(MARCA_NOMBRE) || texto.includes(MARCA_TELEFONO)).toBe(true)
  })
  it.each(ABREN_FRASE)('quita el nombre que abre la frase y no está en la app: «$frase»', ({ frase, quitar }) => {
    const { texto } = limpiarPregunta(frase, [])
    for (const dato of quitar) expect(texto).not.toContain(dato)
  })
  it('LÍMITE DECLARADO: un nombre poco común que abre la frase y no está en la app se escapa (n=16 del 4-nov)', () => {
    // Si algún día se arregla, esta prueba se pone en rojo: cambiar a not.toContain y actualizar este comentario.
    expect(limpiarPregunta('¿Por qué las superseries no cuestan resultados? Clotilde quiere saber', []).texto).toContain('Clotilde')
  })
  it('«Dolores» no está en la lista: en una consulta es dolor', () => {
    expect(limpiarPregunta('Dolores de rodilla después de sentadilla, ¿qué es una descarga?', []).texto).toContain('Dolores')
  })
  it.each(LIMPIAS)('no toca la frase limpia «%s»', (frase) => {
    expect(limpiarPregunta(frase, NOMBRES_CONOCIDOS)).toEqual({ texto: frase, quitados: 0 })
  })
})

describe('caso 5: las guardas de script rechazan', () => {
  const campos = 'Entre 2 y 3 minutos en multiarticulares; depende del objetivo. Schoenfeld lo midió en hombres entrenados.'
  const buena = 'De 2 a 3 minutos en los multiarticulares, según el objetivo de quien entrena.'
  it('deja pasar una redacción limpia', () => expect(revisarGuardas(buena, campos)).toBeNull())
  it('vacía', () => expect(revisarGuardas('   ', campos)).toBe('vacia'))
  it('más de 80 palabras', () => expect(revisarGuardas(Array.from({ length: 81 }, () => 'serie').join(' '), campos)).toBe('larga'))
  it('voseo', () => expect(revisarGuardas('Vos podés elegir entre 2 y 3 minutos.', campos)).toBe('voseo'))
  it('frase prohibida', () => expect(revisarGuardas('Claro, entre 2 y 3 minutos.', campos)).toBe('muletilla'))
  it('«la pieza dice» dos veces', () => expect(revisarGuardas('La pieza dice 2. Y la pieza dice 3.', campos)).toBe('muletilla'))
  it('cifra que no está en los campos', () => expect(revisarGuardas('Alrededor de 5 minutos en multiarticulares.', campos)).toBe('cifra_fuera'))
  it('autor que no está en los campos', () => expect(revisarGuardas('Lo que midió Helms es que bastan 2 minutos.', campos)).toBe('nombre_fuera'))
  it('autor que sí está en los campos pasa', () => expect(revisarGuardas('Lo que midió Schoenfeld es que bastan 2 minutos.', campos)).toBeNull())
})
