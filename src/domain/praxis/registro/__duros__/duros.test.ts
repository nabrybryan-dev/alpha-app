/**
 * DUROS (no versionada, 8-nov-2026): entradas nuevas y duras para resolverVida / dictado / numeros.
 * Cada caso fija ANTES de correr: la frase, lo que un modelo extraería (las «citas»), la salida esperada y el motivo.
 * Salida: JSONL en DUROS_SALIDA. DUROS_RAIZ=../../registro_mutN/vida.ts apunta a una COPIA mutada (controles).
 * Correr: npx vitest run src/domain/praxis/registro/__duros__/duros.test.ts
 */
import { describe, it } from 'vitest'
import { writeFileSync } from 'node:fs'
import type { ContextoRegistro, VidaExtraida } from '../tipos.ts'

type Op = ['valor', number | string] | ['pregunta'] | ['vago'] | ['nada'] | ['descartado']
type Esp = Partial<Record<'S' | 'A' | 'L' | 'P' | 'W' | 'Q' | 'K', Op | Op[]>> & { fecha?: string }
interface Ext { s?: string; a?: string; l?: string; q?: string; p?: string; w?: [string, string | null]; act?: string; t?: ['caminata' | 'siesta' | 'pantalla', string][]; sen?: ('aproximado' | 'no_recuerda')[]; k?: string }
interface Caso { id: string; area: string; frase: string; ext: Ext; esp: Esp; motivo: string; sucia?: boolean; conocido?: boolean; ctl?: string; neg?: string; ahora?: string }

const V = (x: number | string): Op => ['valor', x]
const PR: Op = ['pregunta']; const VG: Op = ['vago']; const NA: Op = ['nada']; const DE: Op = ['descartado']
const casos: Caso[] = []
let n = 0
const c = (area: string, frase: string, ext: Ext, esp: Esp, motivo: string, fl: Partial<Caso> = {}) => {
  n += 1
  casos.push({ id: `D${String(n).padStart(3, '0')}`, area, frase, ext, esp, motivo, ...fl })
}

// ---- 0. CONTROLES (positivos: se rompe el lector a propósito y deben caer; negativos: deben quedar apagados) ----
c('control', 'ocho mil y pico', { p: 'ocho mil y pico' }, { P: VG }, 'control P1: «y pico» es vago; si se quita de la lista debe pasar a valor', { ctl: 'P1' })
c('control', 'tomé 1,5 litros', { w: ['1,5', 'litros'] }, { W: V(1500) }, 'control P2: coma decimal; si se pierde la coma debe fallar', { ctl: 'P2' })
c('control', 'dormí siete horas', { s: 'siete horas' }, { S: V(7) }, 'control P3: tabla de palabras; si siete vale 8 debe fallar', { ctl: 'P3' })
c('control', 'caminé 8 mil pasos', { p: '8 mil pasos' }, { P: V(8000) }, 'control P4: si no se anota el valor de pasos debe fallar', { ctl: 'P4' })
c('control', 'me acosté a las 10', { a: 'a las 10' }, { A: V('22:00') }, 'control P5: acostarse 6-11 sin am/pm es de la noche; si se rompe el +12 debe fallar', { ctl: 'P5' })
c('control', 'tomé 3 vasos', { w: ['3', 'vasos'] }, { W: V(600) }, 'control P6: vaso = 200 mL; si cambia debe fallar', { ctl: 'P6' })
c('control', 'hoy no pasó nada que contar', {}, {}, 'control negativo: sin citas no se anota nada', { neg: 'N1' })
c('control', 'no tomé agua', { w: ['nada', null] }, { W: NA }, 'control negativo: cero agua no se anota ni se pregunta', { neg: 'N2' })
c('control', 'jajaja ok', {}, {}, 'control negativo: muletilla sin citas', { neg: 'N3' })
c('control', 'no me acuerdo cuánto dormí', { s: 'no me acuerdo', sen: ['no_recuerda'] }, { S: NA }, 'control negativo: no recordar no es un dato', { neg: 'N4' })
c('control', 'no camino hoy', { p: 'nada' }, { P: NA }, 'control negativo: «nada» de pasos no se anota', { neg: 'N5' })
c('control', 'no me acosté todavía', { a: 'no me acosté' }, { A: NA }, 'control negativo: sin hora no se anota hora', { neg: 'N6' })

// ---- 1. JERGA colombiana y coloquial ----
c('jerga', 'me acosté como a las 12 y pico de la noche', { a: 'como a las 12 y pico de la noche' }, { A: VG }, '«y pico» tras número es vago (regla de Bryan), también en horas; se debe ver con el campo ofrecido')
c('jerga', 'me acosté como a las 11 y pico', { a: 'como a las 11 y pico' }, { A: VG }, '«y pico» tras la hora es vago: 23:00 sería inventar')
c('jerga', 'me quedé frito a las diez', { a: 'a las diez' }, { A: V('22:00') }, 'jerga de dormirse; las diez al acostarse = 22:00')
c('jerga', 'dormí un camello', { s: 'un camello' }, { S: [VG, NA] }, '«un camello» no es una cifra de horas; «un» artículo no es 1 hora')
c('jerga', 'me levanté al amanecer', { l: 'al amanecer' }, { L: [VG, NA] }, 'sin cifra: no se inventa 06:00')
c('jerga', 'dormí harto', { s: 'harto' }, { S: VG }, 'vago en sueño: visible con el campo ofrecido')
c('jerga', 'dormí poquitico', { s: 'poquitico' }, { S: VG }, 'vago en sueño (diminutivo)')
c('jerga', 'camine un resto', { p: 'un resto' }, { P: VG }, '«un resto» = mucho, sin cifra: no es 1 paso')
c('jerga', 'me hice 15 mil pasos', { p: '15 mil' }, { P: V(15000) }, 'jerga «me hice»')
c('jerga', 'me paré a eso de las seis', { l: 'a eso de las seis' }, { L: V('06:00') }, 'jerga levantarse; sin am/pm = mañana')
c('jerga', 'tomé un chorro de agua', { w: ['un chorro', null] }, { W: PR }, 'cantidad sin medida: se pregunta cuánta')
c('jerga', 'me tomé como cuatro vasitos', { w: ['como cuatro vasitos', null] }, { W: V(800) }, 'vasito = vaso')
c('jerga', 'dormí como un tronco', { s: 'como un tronco' }, { S: [VG, NA] }, 'modismo sin cifra: «un» no es 1 hora')
c('jerga', 'me pegué una caminada de dos horas', { t: [['caminata', 'dos horas']] }, { P: [PR, NA] }, 'horas de caminata nunca son pasos; ofrecer el campo es bueno')
c('jerga', 'tomé un tarro de agua', { w: ['un tarro', null] }, { W: PR }, 'medida local sin tamaño: no se inventa')

// ---- 2. ORTOGRAFIA y errores de voz ----
c('ortografia', 'dormí siete oras', { s: 'siete oras' }, { S: V(7) }, 'h omitida')
c('ortografia', 'caminé ocho mil pasoss', { p: 'ocho mil pasoss' }, { P: V(8000) }, 'letra doble')
c('ortografia', 'dormí dies horas', { s: 'dies horas' }, { S: [V(10), VG] }, '«dies» = diez; si no lo entiende debe mostrarlo vago, no callar')
c('ortografia', 'caminé sinco mil', { p: 'sinco mil' }, { P: [V(5000), VG] }, '«sinco» = cinco')
c('ortografia', 'me acosté a las onze', { a: 'a las onze' }, { A: [V('23:00'), VG] }, '«onze» = once')
c('ortografia', 'tomé tres basos de agua', { w: ['tres basos', null] }, { W: [V(600), PR] }, '«basos» = vasos; si no lo entiende debe preguntar')
c('ortografia', 'dormí sieteoras', { s: 'sieteoras' }, { S: V(7) }, 'dictado pegado')
c('ortografia', 'dormí nuebe oras', { s: 'nuebe oras' }, { S: [V(9), VG] }, 'v por b')
c('ortografia', 'caminé dose mil pasos', { p: 'dose mil pasos' }, { P: [V(12000), VG] }, 'z por s')
c('ortografia', 'DORMÍ SIETE HORAS!!!', { s: 'SIETE HORAS!!!' }, { S: V(7) }, 'mayúsculas y signos')
c('ortografia', 'tomé dos litros de agúa', { w: ['dos litros', 'de agúa'] }, { W: V(2000) }, 'tilde mal puesta')
c('ortografia', 'caminé  ocho  mil  pasos', { p: 'ocho  mil  pasos' }, { P: V(8000) }, 'espacios dobles en miles')

// ---- 3. NUMEROS en palabras compuestas y mezclas ----
c('numeros_palabras', 'caminé veintidós mil pasos', { p: 'veintidós mil' }, { P: V(22000) }, 'compuesto')
c('numeros_palabras', 'caminé once mil trescientos pasos', { p: 'once mil trescientos pasos' }, { P: V(11300) }, 'mil + centena')
c('numeros_palabras', 'caminé quince mil quinientos cuarenta pasos', { p: 'quince mil quinientos cuarenta pasos' }, { P: V(15540) }, 'mil + centena + decena')
c('numeros_palabras', 'caminé ciento veinte mil pasos', { p: 'ciento veinte mil pasos' }, { P: PR }, 'imposible (>100000): pregunta, no se trunca')
c('numeros_palabras', 'caminé mil doscientos pasos', { p: 'mil doscientos pasos' }, { P: V(1200) }, 'mil sin multiplicador')
c('numeros_palabras', 'caminé siete mil y pico', { p: 'siete mil y pico' }, { P: VG }, '«y pico» tras mil')
c('numeros_palabras', 'caminé ocho mil doscientos cincuenta', { p: 'ocho mil doscientos cincuenta' }, { P: V(8250) }, 'compuesto')
c('numeros_palabras', 'dormí siete horas y cuarenta minutos', { s: 'siete horas y cuarenta minutos' }, { S: V(7.7) }, 'minutos a un decimal (7,67 -> 7,7)')
c('numeros_palabras', 'dormí seis horas y veinte', { s: 'seis horas y veinte' }, { S: V(6.3) }, 'minutos en palabras (6,33 -> 6,3)')
c('numeros_palabras', 'dormí ocho horas y tres cuartos', { s: 'ocho horas y tres cuartos' }, { S: V(8.8) }, 'tres cuartos = 45 min (8,75 -> 8,8)')
c('numeros_palabras', 'dormí cinco y cuarenta', { s: 'cinco y cuarenta' }, { S: [V(5.7), PR] }, 'sin la palabra horas: 5 h 40 o reloj 5:40; valor 5,7 o pregunta, nunca 45')
c('numeros_palabras', 'dormí hora y media', { s: 'hora y media' }, { S: V(1.5) }, 'fracción sin número')
c('numeros_palabras', 'dormí seis horas y cincuenta y cinco minutos', { s: 'seis horas y cincuenta y cinco minutos' }, { S: V(6.9) }, 'minutos compuestos (6,92 -> 6,9)')
c('numeros_palabras', 'dormí ochocientos minutos', { s: 'ochocientos minutos' }, { S: [V(13.3), PR] }, '800 min = 13,3 h (raro, tope 14)')
c('numeros_palabras', 'dormí tres cuartos de hora', { s: 'tres cuartos de hora' }, { S: V(0.8) }, '0,75 h -> 0,8')

// ---- 4. NEGACIONES y contradicciones ----
c('negaciones', 'no dormí nada', { s: 'nada' }, { S: [V(0), NA, VG] }, '«nada» = cero horas o silencio; nunca una cifra distinta')
c('negaciones', 'dormí 8 horas, bueno, 6', { s: '8 horas, bueno, 6' }, { S: [V(6), PR] }, 'autocorrección: vale lo último (DISENO:191); 8 sería dato falso')
c('negaciones', 'no llegué ni a 3000 pasos', { p: 'ni a 3000 pasos' }, { P: [PR, VG] }, 'cota superior: 3000 no es lo caminado')
c('negaciones', 'no tomé ni un vaso de agua', { w: ['ni un vaso', null] }, { W: NA }, 'cero explícito; 1 vaso sería dato falso')
c('negaciones', 'no tomé ningún vaso', { w: ['ningún vaso', null] }, { W: NA }, 'cero explícito')
c('negaciones', 'no dormí ni 4 horas', { s: 'ni 4 horas' }, { S: [PR, VG] }, 'cota superior: no son 4')
c('negaciones', 'dormí menos de 5 horas', { s: 'menos de 5 horas' }, { S: [VG, PR] }, 'cota: 5 sería falso')
c('negaciones', 'caminé más de 10 mil pasos', { p: 'más de 10 mil pasos' }, { P: [VG, PR] }, 'cota inferior = como «y algo»: no se anota 10000 sin aviso')
c('negaciones', 'no dormí bien', { q: 'no dormí bien' }, { Q: V('MALA') }, 'negación de lo bueno')
c('negaciones', 'no dormí mal', { q: 'no dormí mal' }, { Q: V('REGULAR') }, 'negación de lo malo')
c('negaciones', 'no dormí ni mal ni bien', { q: 'no dormí ni mal ni bien' }, { Q: V('REGULAR') }, 'doble negación')
c('negaciones', 'no me acosté a las 10 sino a las 11', { a: 'no me acosté a las 10 sino a las 11' }, { A: [V('23:00'), PR] }, 'cita sucia: vale la corrección; 22:00 sería dato falso')
c('negaciones', 'no, 8 mil no, fueron 6 mil', { p: '8 mil, no, 6 mil' }, { P: [V(6000), PR] }, 'autocorrección')
c('negaciones', 'dos vasos, no, tres', { w: ['dos vasos, no, tres', null] }, { W: [V(600), PR] }, 'autocorrección en agua')
c('negaciones', 'no puedo dormir ni 3 horas seguidas', { s: 'ni 3 horas seguidas' }, { S: [PR, VG, NA] }, 'negación con cifra')
c('negaciones', 'no dormí cero horas, dormí 2', { s: 'cero horas, dormí 2' }, { S: [V(2), PR] }, 'cero y luego corrección: 0 sería falso')

// ---- 5. VARIAS CIFRAS en una frase ----
c('varias_cifras', 'dormí 6 horas y caminé 9 mil pasos', { s: '6 horas', p: '9 mil pasos' }, { S: V(6), P: V(9000) }, 'dos datos independientes')
c('varias_cifras', 'me acosté 11 y me levanté 6', { a: '11', l: '6' }, { A: V('23:00'), L: V('06:00'), S: V(7) }, 'horas de reloj; horas dormidas deducidas 7')
c('varias_cifras', 'me acosté a las 10 y me levanté a las 5 y media', { a: 'a las 10', l: 'a las 5 y media' }, { A: V('22:00'), L: V('05:30'), S: V(7.5) }, 'deducción 7,5')
c('varias_cifras', 'dormí siete horas, tomé tres vasos y caminé ocho mil pasos', { s: 'siete horas', w: ['tres', 'vasos'], p: 'ocho mil pasos' }, { S: V(7), W: V(600), P: V(8000) }, 'tres datos')
c('varias_cifras', 'dormí 8 horas, me acosté a las 12 y me levanté a las 6', { s: '8 horas', a: 'a las 12', l: 'a las 6' }, { S: [V(8), PR], A: V('00:00'), L: V('06:00') }, 'contradicción 8 vs 6 por reloj: se anota lo dicho o se pregunta')
c('varias_cifras', 'tres vasos de agua y 2 litros más tarde', { w: ['3 vasos y 2 litros', null] }, { W: V(2600) }, 'suma de partes')
c('varias_cifras', 'caminé 5 mil pasos en la mañana y 4 mil en la tarde', { p: '5 mil pasos en la mañana y 4 mil en la tarde' }, { P: [V(9000), PR] }, 'suma o pregunta; 5000 es dato incompleto')
c('varias_cifras', 'dormí 5 horas y luego una siesta de 2', { s: '5 horas', t: [['siesta', '2 horas']] }, { S: V(5) }, 'la siesta no suma al sueño')
c('varias_cifras', '7 horas anoche y 6 antenoche', { s: '7 horas anoche y 6 antenoche' }, { S: [V(7), PR] }, 'dos noches: 6 o 13 serían falsos')
c('varias_cifras', 'me acosté a las 11 y dormí 8 horas', { a: 'a las 11', s: '8 horas' }, { A: V('23:00'), S: V(8) }, 'orden inverso')
c('varias_cifras', '500 ml y luego 1,5 litros', { w: ['500 ml y luego 1,5 litros', null] }, { W: V(2000) }, 'dos unidades con coma')
c('varias_cifras', 'caminé 6000 pasos y 20 minutos de trote', { p: '6000 pasos y 20 minutos de trote' }, { P: V(6000) }, 'minutos de trote no son pasos')
c('varias_cifras', 'tomé 2 botellas de 600', { w: ['2 botellas de 600', null] }, { W: V(1200) }, 'botella con tamaño')
c('varias_cifras', 'tomé 3 litros y 4 vasos', { w: ['3 litros y 4 vasos', null] }, { W: [DE, PR] }, '3800 mL de una vez: imposible, visible')
c('varias_cifras', 'tres vasos y una botella', { w: ['tres vasos y una botella', null] }, { W: PR }, 'botella sin tamaño: se pregunta, no se inventa')
c('varias_cifras', 'dormí 6 horas y 30 minutos y caminé 40 minutos', { s: '6 horas y 30 minutos', t: [['caminata', '40 minutos']] }, { S: V(6.5), P: [PR, NA] }, 'minutos de caminata no son pasos')

// ---- 6. UNIDADES raras ----
c('unidades_raras', 'caminé 5 km', { p: '5 km' }, { P: [PR, VG, NA] }, 'km no son pasos; 5 pasos sería falso')
c('unidades_raras', 'caminé 8 kilómetros', { p: '8 kilómetros' }, { P: [PR, VG, NA] }, 'km no son pasos')
c('unidades_raras', 'caminé 45 minutos', { t: [['caminata', '45 minutos']] }, { P: [PR, NA] }, 'minutos nunca son pasos')
c('unidades_raras', 'caminé una hora', { p: 'una hora' }, { P: [PR, VG, NA] }, 'una hora no es 1 paso')
c('unidades_raras', 'caminé 30 minutos', { p: '30 minutos' }, { P: [PR, VG, NA] }, 'minutos como cita de pasos: 30 pasos sería falso')
c('unidades_raras', 'tomé 2 L', { w: ['2', 'L'] }, { W: V(2000) }, 'L mayúscula')
c('unidades_raras', 'una botella de litro y medio', { w: ['una botella de litro y medio', null] }, { W: V(1500) }, 'botella con tamaño dicho')
c('unidades_raras', 'media botella', { w: ['media botella', null] }, { W: PR }, 'tamaño desconocido')
c('unidades_raras', 'dos botellas', { w: ['dos botellas', null] }, { W: PR }, 'tamaño desconocido')
c('unidades_raras', 'tomé 8 onzas', { w: ['8 onzas', null] }, { W: [PR, V(237), V(240), VG] }, 'onza no definida: pregunta o convierte; nunca 8 mL')
c('unidades_raras', 'tomé 16 onzas', { w: ['16 onzas', null] }, { W: [PR, V(473), V(480), VG] }, 'onza: nunca 16 mL')
c('unidades_raras', 'tomé un galón', { w: ['un galón', null] }, { W: [DE, PR, VG] }, 'galón no definido; 3785 mL supera el tope: visible')
c('unidades_raras', 'tomé medio galón', { w: ['medio galón', null] }, { W: [PR, V(1893), V(1900), VG] }, 'galón: nunca 0,5 mL ni 200')
c('unidades_raras', 'tomé 3 vasos de 250 ml', { w: ['3 vasos de 250 ml', null] }, { W: V(750) }, 'tamaño dicho manda')
c('unidades_raras', 'tomé un litro y 200 ml', { w: ['un litro y 200 ml', null] }, { W: V(1200) }, 'litro + ml con y')
c('unidades_raras', 'tomé dos tazas', { w: ['dos tazas', null] }, { W: V(400) }, 'taza = 200 mL')
c('unidades_raras', 'tomé un termo', { w: ['un termo', null] }, { W: PR }, 'termo sin tamaño')
c('unidades_raras', 'tomé tres tragos de agua', { w: ['tres tragos', null] }, { W: [PR, VG] }, 'trago sin tamaño: nunca 3 vasos ni 3 mL')
c('unidades_raras', 'dormí tres cuartos de día', { s: 'tres cuartos de día' }, { S: [PR, VG, V(18)] }, 'unidad rara: nunca 0,8 ni 3')
c('unidades_raras', 'dormí una noche entera', { s: 'una noche entera' }, { S: [VG, NA] }, 'una noche no es 1 hora')

// ---- 7. AMBIGÜEDAD de reloj ----
c('reloj', 'me acosté a las 24', { a: 'a las 24' }, { A: V('00:00') }, 'reloj de 24 h')
c('reloj', 'me acosté a las 0:30', { a: 'a las 0:30' }, { A: V('00:30') }, 'hora 0')
c('reloj', 'me acosté a medianoche', { a: 'a medianoche' }, { A: V('00:00') }, 'medianoche')
c('reloj', 'me acosté a las 2 de la madrugada', { a: 'a las 2 de la madrugada' }, { A: V('02:00') }, 'madrugada')
c('reloj', 'me levanté a las 4 de la madrugada', { l: 'a las 4 de la madrugada' }, { L: V('04:00') }, 'madrugada al levantarse')
c('reloj', 'me acosté a las 11 de la mañana', { a: 'a las 11 de la mañana' }, { A: V('11:00') }, 'turno de noche: dice mañana')
c('reloj', 'me levanté a las 7 de la noche', { l: 'a las 7 de la noche' }, { L: V('19:00') }, 'dice noche')
c('reloj', 'me levanté a las 3 de la tarde', { l: 'a las 3 de la tarde' }, { L: V('15:00') }, 'dice tarde')
c('reloj', 'me acosté a las 10 y media', { a: 'a las 10 y media' }, { A: V('22:30') }, 'y media')
c('reloj', 'me acosté a las 12 y media', { a: 'a las 12 y media' }, { A: V('00:30') }, '12 y media al acostarse = 00:30')
c('reloj', 'me acosté a las 12', { a: 'a las 12' }, { A: [V('00:00'), PR] }, '12 pelada: medianoche o pregunta')
c('reloj', 'me levanté a las 12', { l: 'a las 12' }, { L: [PR, V('12:00')] }, '12 al levantarse: mediodía o pregunta; 00:00 sería falso')
c('reloj', 'me acosté a las 5', { a: 'a las 5' }, { A: [V('05:00'), PR] }, '5 sin sufijo: madrugada o tarde; 17:00 sería raro')
c('reloj', 'me acosté a las 25', { a: 'a las 25' }, { A: [PR, VG] }, 'hora imposible: no se calla')
c('reloj', 'me acosté a las 13:00', { a: 'a las 13:00' }, { A: V('13:00') }, 'reloj 24 h')
c('reloj', 'me acosté a las 10:30pm', { a: 'a las 10:30pm' }, { A: V('22:30') }, 'pm pegado con minutos')
c('reloj', 'me acosté a la una', { a: 'a la una' }, { A: [V('01:00'), PR] }, 'la una sin sufijo: madrugada o pregunta')
c('reloj', 'me levanté a la una de la tarde', { l: 'a la una de la tarde' }, { L: V('13:00') }, 'la una de la tarde')
c('reloj', 'dormí 7:30', { s: '7:30' }, { S: PR }, 'regla de Bryan: «7:30» sin unidad en sueño pregunta')
c('reloj', 'dormí 7:30 horas', { s: '7:30 horas' }, { S: V(7.5) }, 'con unidad: 7,5')
c('reloj', 'dormí 7.30', { s: '7.30' }, { S: [PR, V(7.3)] }, 'sin unidad: 7 h 30 o 7,3; pregunta')
c('reloj', 'me acosté sobre las 11', { a: 'sobre las 11' }, { A: V('23:00') }, 'sobre las = aproximado')
c('reloj', 'me acosté entre las 11 y las 12', { a: 'entre las 11 y las 12' }, { A: PR }, 'rango de reloj: se pregunta')
c('reloj', 'me acosté a las 8 y me levanté a las 3', { a: 'a las 8', l: 'a las 3' }, { A: [V('20:00'), PR], L: V('03:00') }, 'acostarse 8 = noche; levantarse 3 madrugada')

// ---- 8. COMA y PUNTO decimal / miles ----
c('decimales_miles', 'tomé 1,5 litros', { w: ['1,5 litros', null] }, { W: V(1500) }, 'coma en una sola cita')
c('decimales_miles', 'caminé 10.000 pasos', { p: '10.000' }, { P: V(10000) }, 'punto de miles es-CO')
c('decimales_miles', 'caminé 10,000 pasos', { p: '10,000' }, { P: V(10000) }, 'coma de miles estilo inglés')
c('decimales_miles', 'caminé 1,5 mil pasos', { p: '1,5 mil' }, { P: [V(1500), PR] }, 'coma decimal con mil')
c('decimales_miles', 'caminé 8,5 mil pasos', { p: '8,5 mil pasos' }, { P: V(8500) }, 'coma decimal con mil')
c('decimales_miles', 'dormí 7,5', { s: '7,5' }, { S: [V(7.5), PR] }, 'coma decimal sin unidad')
c('decimales_miles', 'dormí 7,25 horas', { s: '7,25 horas' }, { S: [V(7.25), V(7.3)] }, 'dos decimales: tal cual o a un decimal')
c('decimales_miles', 'caminé 12,500 pasos', { p: '12,500 pasos' }, { P: V(12500) }, 'miles con coma')
c('decimales_miles', 'tomé 1,500 ml', { w: ['1,500 ml', null] }, { W: [V(1500), PR] }, 'miles con coma en ml; 1,5 mL sería falso')
c('decimales_miles', 'tomé .5 litros', { w: ['.5 litros', null] }, { W: [V(500), PR] }, 'punto sin cero')
c('decimales_miles', 'caminé 1.000.000 pasos', { p: '1.000.000 pasos' }, { P: PR }, 'imposible: pregunta')
c('decimales_miles', 'caminé 8 000 y pico', { p: '8 000 y pico' }, { P: VG }, 'miles con espacio y pico')
c('decimales_miles', 'caminé 9,5', { p: '9,5' }, { P: [PR, V(9500)] }, '9,5 pasos no existe; 9 mil 500 o pregunta')
c('decimales_miles', 'tomé 3,5 litros', { w: ['3,5 litros', null] }, { W: [DE, PR] }, '3500 mL supera el tope: visible')
c('decimales_miles', 'tomé 1,25 litros', { w: ['1,25 litros', null] }, { W: V(1250) }, 'dos decimales')
c('decimales_miles', 'caminé 10k', { p: '10k' }, { P: V(10000) }, 'k pegada')

// ---- 9. CIFRAS de otro tema que se cuelan (sucias salvo marca) ----
c('cifras_otro_tema', 'pesé 70 kilos', { k: '70 kilos' }, { K: V(70) }, 'extracción limpia: el peso va a su campo y a ningún otro')
c('cifras_otro_tema', 'tengo 25 años', { p: '25 años' }, { P: NA }, 'cita sucia: años no son pasos', { sucia: true })
c('cifras_otro_tema', 'mi rutina es de 3 series de 8', { p: '3 series de 8' }, { P: NA }, 'cita sucia: series no son pasos', { sucia: true })
c('cifras_otro_tema', 'mi rutina es de 3 series de 8', { s: '3 series de 8' }, { S: NA }, 'cita sucia: series no son horas', { sucia: true })
c('cifras_otro_tema', 'pesé 70 kilos', { w: ['70 kilos', null] }, { W: NA }, 'cita sucia: kilos no son agua', { sucia: true })
c('cifras_otro_tema', 'tengo 40 años', { s: '40 años' }, { S: NA }, 'cita sucia: años no son horas', { sucia: true })
c('cifras_otro_tema', 'hice 8 repeticiones', { a: '8 repeticiones' }, { A: NA }, 'cita sucia: repeticiones no son hora', { sucia: true })
c('cifras_otro_tema', 'la serie 3 con 40 kilos y 8 repeticiones', {}, {}, 'extracción limpia: ni sueño ni pasos ni agua')
c('cifras_otro_tema', 'trabajé 8 horas', { s: '8 horas de trabajo' }, { S: NA }, 'cita sucia: horas de trabajo no son sueño', { sucia: true })
c('cifras_otro_tema', 'hice un turno de 12 horas', { s: '12 horas de turno' }, { S: NA }, 'cita sucia: turno', { sucia: true })
c('cifras_otro_tema', 'subí 20 pisos', { p: '20 pisos' }, { P: NA }, 'cita sucia: pisos no son pasos', { sucia: true })
c('cifras_otro_tema', 'gasté 5 mil pesos', { p: '5 mil pesos' }, { P: NA }, 'cita sucia: pesos no son pasos', { sucia: true })
c('cifras_otro_tema', 'comí 3 veces', { s: '3 veces' }, { S: NA }, 'cita sucia: comidas', { sucia: true })
c('cifras_otro_tema', 'el pedido 1234 llegó', { p: '1234' }, { P: NA }, 'cita sucia: número de pedido', { sucia: true })

// ---- 10. HIPOTETICOS, futuro y otros días ----
c('hipoteticos', 'quiero dormir 8 horas', { s: '8 horas' }, { S: NA }, 'deseo, no hecho', { sucia: true })
c('hipoteticos', 'mañana camino 10 mil', { p: '10 mil' }, { P: NA }, 'futuro', { sucia: true })
c('hipoteticos', 'hoy voy a tomar 3 litros', { w: ['3', 'litros'] }, { W: NA }, 'futuro', { sucia: true })
c('hipoteticos', 'ayer caminé 9 mil pasos', { p: '9 mil pasos' }, { P: V(9000), fecha: 'ayer' }, 'Bryan (decisión 4): va a la fecha dicha, ayer', { conocido: true })
c('hipoteticos', 'ayer tomé 2 litros', { w: ['2', 'litros'] }, { W: V(2000), fecha: 'ayer' }, 'Bryan (decisión 4): va a ayer', { conocido: true })
c('hipoteticos', 'anoche dormí 9 horas', { s: '9 horas' }, { S: V(9) }, 'anoche es la noche de hoy: valor directo')
c('hipoteticos', 'ojalá pueda dormir 7 horas', { s: '7 horas' }, { S: NA }, 'deseo', { sucia: true })
c('hipoteticos', 'mi meta es tomar 3 litros', { w: ['3', 'litros'] }, { W: NA }, 'meta', { sucia: true })
c('hipoteticos', 'si me acuesto a las 10 duermo 8', { a: 'a las 10', s: '8' }, { A: NA, S: NA }, 'condicional', { sucia: true })
c('hipoteticos', 'mañana me levanto a las 5', { l: 'a las 5' }, { L: NA }, 'futuro', { sucia: true })
c('hipoteticos', 'me faltan 3 mil pasos para la meta', { p: '3 mil pasos' }, { P: NA }, 'lo que falta no es lo hecho', { sucia: true })
c('hipoteticos', 'el lunes dormí 6 horas', { s: '6 horas' }, { S: [NA, PR] }, 'otro día', { sucia: true })
c('hipoteticos', 'la semana pasada caminé 10 mil pasos diarios', { p: '10 mil pasos diarios' }, { P: [NA, PR] }, 'otra semana', { sucia: true })
c('hipoteticos', 'normalmente duermo 7 horas', { s: '7 horas' }, { S: [NA, PR] }, 'lo habitual va al perfil, no a anoche', { sucia: true })
c('hipoteticos', 'siempre camino 8 mil pasos', { p: '8 mil pasos' }, { P: [NA, PR] }, 'hábito', { sucia: true })
c('hipoteticos', 'no sé si dormí 7 horas', { s: '7 horas', sen: ['no_recuerda'] }, { S: [VG, NA, PR] }, 'duda declarada: no se anota como dato firme')

// ---- 11. PREGUNTAS y muletillas sin dato ----
c('muletillas', '¿cuántas horas debo dormir?', { s: 'horas' }, { S: NA }, 'pregunta, sin dato', { sucia: true })
c('muletillas', 'hmm, pues, eh, no sé', {}, {}, 'muletilla sin citas')
c('muletillas', '¿cuántos pasos es lo ideal?', { p: 'pasos' }, { P: NA }, 'pregunta sin dato', { sucia: true })
c('muletillas', '¿cuánta agua debo tomar?', { w: ['agua', null] }, { W: NA }, 'pregunta sin dato', { sucia: true })
c('muletillas', 'dormí', { s: 'dormí' }, { S: [NA, PR, VG] }, 'dice que durmió, no cuánto: no se inventa')
c('muletillas', 'tomé agua', { w: ['agua', null] }, { W: PR }, 'nombró agua sin cuánta: pregunta (regla escrita)')
c('muletillas', 'ni idea cuántos pasos', { p: 'ni idea' }, { P: NA }, 'no sabe')
c('muletillas', 'dormí como siempre', { s: 'como siempre' }, { S: [NA, VG] }, 'sin cifra')
c('muletillas', 'tomé un poco de agua', { w: ['un poco', null] }, { W: PR }, 'cantidad vaga')
c('muletillas', 'caminé bastante', { act: 'bastante' }, { P: [PR, NA] }, 'actividad sin número: visible y ofrece el campo')

// ---- 12. FRASES LARGAS con ruido ----
c('frases_largas', 'dormí como seis horas aunque me desperté tres veces', { s: 'como seis horas aunque me desperté tres veces' }, { S: V(6) }, 'cifra primero, ruido después')
c('frases_largas', 'ocho mil pasos y subí 20 pisos', { p: 'ocho mil pasos, y subí 20 pisos' }, { P: V(8000) }, 'ruido después')
c('frases_largas', 'a las 2 me desperté y dormí otras 4 horas', { s: 'a las 2 me desperté y dormí otras 4 horas' }, { S: [PR, VG] }, 'dos tramos: 2 sería falso')
c('frases_largas', 'a las 3 de la mañana me desperté y al final dormí unas 5 horas', { s: 'como a las 3 de la mañana me desperté y no pude volver a dormir, en total unas 5 horas' }, { S: [V(5), PR] }, 'la cifra de sueño es la última; 3 sería falso')
c('frases_largas', 'caminé desde las 5 hasta las 6 como 4 mil pasos', { p: 'desde las 5 hasta las 6 como 4 mil pasos' }, { P: [V(4000), PR] }, '5 sería falso')
c('frases_largas', 'tomé 3 vasos desde las 8 hasta el mediodía', { w: ['3 vasos desde las 8 hasta el mediodía', null] }, { W: V(600) }, 'la hora no es la cantidad')
c('frases_largas', 'a las 8 me tomé 2 vasos', { w: ['a las 8 tomé 2 vasos', null] }, { W: [V(400), PR] }, '8 vasos sería falso')
c('frases_largas', 'a las 10 empecé una peli y como a las 11 y media me acosté', { a: 'a las 10 empecé una peli y como a las 11 y media me acosté' }, { A: [V('23:30'), PR] }, '22:00 sería falso')
c('frases_largas', 'sonó la alarma a las 5 pero me levanté a las 6', { l: 'sonó la alarma a las 5 pero me levanté a las 6' }, { L: [V('06:00'), PR] }, '05:00 sería falso')
c('frases_largas', '8 horas en la cama pero dormido como 6', { s: '8 horas en la cama pero dormido como 6' }, { S: [V(6), PR] }, '8 sería falso')
c('frases_largas', 'a las 11 me metí a la cama pero me dormí como a las 12', { a: 'a las 11 me metí a la cama pero me dormí como a las 12' }, { A: [V('00:00'), PR] }, '23:00 sería falso')
c('frases_largas', 'siete horas y media aunque con 2 despertadas', { s: 'siete horas y media aunque con 2 despertadas' }, { S: V(7.5) }, 'fracción y ruido')
c('frases_largas', 'dos litros, mi meta era 3', { w: ['dos litros, mi meta era 3', null] }, { W: V(2000) }, 'la meta no se suma')
c('frases_largas', 'tipo 5 y 6 horas, no sé', { s: 'tipo 5 y 6 horas' }, { S: PR }, 'rango sin «o»: se pregunta')
c('frases_largas', 'cinco, seis horas', { s: 'cinco, seis horas' }, { S: PR }, 'rango por coma: se pregunta')
c('frases_largas', '8, 9 mil pasos', { p: '8, 9 mil pasos' }, { P: PR }, 'rango por coma')
c('frases_largas', 'seis horas, creo', { s: 'seis horas, creo' }, { S: V(6) }, 'duda leve con cifra')

export { casos }

// ---------------------------------------------------------------------------
type Campo = 'S' | 'A' | 'L' | 'P' | 'W' | 'Q' | 'K'
const PRIORIDAD = ['DATO_FALSO', 'SILENCIO_MUDO', 'PERDIDA', 'PREGUNTA_INNECESARIA', 'DISTINTO', 'COHERENTE']
const CAMPOS: Record<Campo, { parche?: string; campo?: string[]; ext: (e: Ext) => string | null | undefined }> = {
  S: { parche: 'horasSueno', campo: ['horasSueno', 'fecha_del_sueno'], ext: (e) => e.s },
  A: { parche: 'horaAcostarse', campo: ['horaAcostarse'], ext: (e) => e.a },
  L: { parche: 'horaLevantarse', campo: ['horaLevantarse'], ext: (e) => e.l },
  P: { parche: 'pasos', campo: ['pasos'], ext: (e) => e.p ?? (e.act ? e.act : null) },
  W: { campo: ['agua_cantidad', 'botella_ml'], ext: (e) => e.w?.[0] },
  Q: { parche: 'calidadSueno', ext: (e) => e.q },
  K: { parche: 'pesoKg', ext: (e) => e.k },
}

describe('duros', () => {
  it('mide', async () => {
    const spec = process.env.DUROS_RAIZ ?? '../vida.ts'
    const mod = (await import(/* @vite-ignore */ spec)) as typeof import('../vida.ts')
    const resolverVida = mod.resolverVida
    const mk = (ahora: string) => ({ ahora, microciclo: null, sesionHoyId: null, sesiones: [], pantalla: { ejercicioId: null }, ultimoTocado: null, semanaAnterior: {}, perfil: { pesoBarraKg: null } }) as unknown as ContextoRegistro
    const lineas: string[] = []
    for (const k of casos) {
      const e = k.ext
      const v: VidaExtraida = {
        sueno_horas: e.s ?? null, hora_acostarse: e.a ?? null, hora_levantarse: e.l ?? null, calidad_sueno: e.q ?? null,
        pasos: e.p ?? null, actividad_sin_numero: e.act ?? null, agua: e.w ? { cantidad: e.w[0], medida: e.w[1] } : null,
        escalas: [], senales: e.sen ?? [], peso_corporal: e.k ?? null, tiempos: e.t?.map(([actividad, duracion]) => ({ actividad, duracion })),
      }
      let r: ReturnType<typeof resolverVida>
      let error: string | undefined
      try { r = resolverVida(v, mk(k.ahora ?? '2026-11-07T12:00:00-05:00'), k.frase) } catch (x) { error = String(x); r = { registros: [], descartado: [], avisos: [] } }
      const chk = r.registros.find((x) => x.campo === 'checkin') as { parche: Record<string, string | number>; fecha: string } | undefined
      const hid = r.registros.filter((x) => x.campo === 'hidratacion') as unknown as { delta_ml: number; fecha: string }[]
      const aguaTotal = hid.length ? hid.reduce((s, h) => s + h.delta_ml, 0) : undefined
      const preguntas = [r.pregunta?.campo_bloqueante, r.seguimiento?.campo_bloqueante].filter(Boolean) as string[]
      const clases: string[] = []; const detalle: Record<string, unknown> = {}
      for (const f of Object.keys(CAMPOS) as Campo[]) {
        const def = CAMPOS[f]
        const cita = def.ext(e) ?? null
        const espRaw = k.esp[f]
        const obsVal = f === 'W' ? aguaTotal : chk?.parche[def.parche!]
        if (!espRaw && !cita) {
          // sin cita y sin esperado: no debe salir nada de este campo (la deducción S por A+L es legítima)
          const deducido = f === 'S' && e.a && e.l
          if (obsVal !== undefined && !deducido) { clases.push('DATO_FALSO'); detalle[f] = { fuga: obsVal } }
          continue
        }
        const opciones: Op[] = (Array.isArray(espRaw?.[0]) ? espRaw : [espRaw ?? ['nada']]) as Op[]
        let obs: Op
        const citaEnDescartado = r.descartado.find((d) => cita !== null && (d.cita === cita || d.cita === e.w?.[0]))
        const colaPregunta = r.descartado.some((d) => /dime cuál fue|dos opciones/.test(d.motivo) && cita !== null && d.cita.includes(cita.slice(0, 6)))
        const tieneCampo = def.campo ? def.campo.some((cm) => preguntas.includes(cm)) : false
        if (obsVal !== undefined) obs = ['valor', obsVal]
        else if (tieneCampo && !citaEnDescartado) obs = PR
        else if (colaPregunta) obs = PR
        else if (citaEnDescartado && tieneCampo) obs = VG
        else if (citaEnDescartado) obs = DE
        else obs = NA
        const igual = (a: number | string, b: number | string) => (typeof a === 'number' && typeof b === 'number' ? Math.abs(a - b) <= (Math.abs(b) >= 1000 ? 0.5 : 0.051) : a === b)
        const coincide = (o: Op) => o[0] === obs[0] && (o[0] !== 'valor' || igual((obs as ['valor', number | string])[1], o[1]))
        let clase: string
        const primero = opciones[0]
        if (opciones.some(coincide)) clase = 'COHERENTE'
        else if (obs[0] === 'descartado' && opciones.some((o) => o[0] === 'nada')) clase = 'COHERENTE'
        else if (obs[0] === 'valor') clase = 'DATO_FALSO'
        else if (obs[0] === 'nada') clase = 'SILENCIO_MUDO'
        else if (obs[0] === 'pregunta') clase = primero[0] === 'valor' || primero[0] === 'nada' ? 'PREGUNTA_INNECESARIA' : 'DISTINTO'
        else if (obs[0] === 'vago') clase = primero[0] === 'valor' ? 'PERDIDA' : primero[0] === 'nada' ? 'PREGUNTA_INNECESARIA' : 'DISTINTO'
        else clase = primero[0] === 'valor' ? 'PERDIDA' : 'DISTINTO'
        // fecha (ayer): el dato correcto en la fecha equivocada es dato falso
        if (clase === 'COHERENTE' && k.esp.fecha === 'ayer' && (f === 'P' || f === 'W')) {
          const fe = f === 'P' ? chk?.fecha : hid[0]?.fecha
          if (fe !== '2026-11-06') { clase = 'DATO_FALSO'; detalle[`${f}_fecha`] = `anotado en ${fe}, se dijo ayer (2026-11-06)` }
        }
        clases.push(clase)
        detalle[f] = { cita, esperado: opciones, observado: obs, clase }
      }
      const clase = clases.length ? PRIORIDAD.find((p) => clases.includes(p))! : 'COHERENTE'
      lineas.push(JSON.stringify({
        id: k.id, area: k.area, frase: k.frase, ext: k.ext, esperado: k.esp, motivo: k.motivo, sucia: !!k.sucia, conocido: !!k.conocido,
        ctl: k.ctl, neg: k.neg, clase, detalle,
        salida: { parche: chk?.parche, fecha: chk?.fecha, agua_ml: hid.map((h) => h.delta_ml), descartado: r.descartado, pregunta: r.pregunta, seguimiento: r.seguimiento, avisos: r.avisos, error },
      }))
    }
    writeFileSync(process.env.DUROS_SALIDA ?? 'duros-salida.jsonl', lineas.join('\n') + '\n', 'utf8')
    console.log(`DUROS_TOTAL ${casos.length}`)
  })
})
