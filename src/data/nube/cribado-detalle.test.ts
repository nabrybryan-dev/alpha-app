/**
 * El detalle del cribado viaja con los nombres de la BASE, no con los del dominio.
 *
 * EL ROJO QUE LA MOTIVA (2026-09-10, revisión del PR #220). El formulario guarda el
 * detalle de cada respuesta clínica bajo el nombre del campo del dominio
 * —`medicacionCronica`— y la migración 0058 documenta esa columna con el nombre de la
 * base —`{"medicacion_cronica": "prednisolona 10 mg"}"`—, porque el volcado del cerebro
 * (`entrada_desde_historial.py`) la lee SIN TRADUCIR. Iban sin traducir: cualquier
 * consulta que buscara la medicación de alguien que contestó por la app no encontraba
 * nada, y no fallaba nada. Es el fallo de la casa —el mismo dato con dos nombres— sobre
 * un dato de salud.
 *
 * Esta prueba fija la traducción contra los DOCE nombres que declara la migración. Si
 * mañana se añade una pregunta al cribado y su nombre no encaja con la regla, esto se
 * pone rojo antes de que el dato se pierda en silencio.
 */
import { describe, expect, it } from 'vitest'
import { enColumnas } from './sync'

/** Los doce de `supabase/migrations/0058_cribado.sql`, copiados de su `create table`. */
const COLUMNAS = [
  'diagnostico',
  'quien_lo_lleva',
  'tratamiento_activo',
  'medicacion_cronica',
  'autorizacion_sanitaria',
  'restricciones_explicitas',
  'sintomas_con_esfuerzo',
  'nivel_funcional',
  'que_le_han_dicho_que_no_haga',
  'parq_enfermedad_cardiaca',
  'parq_medicamento_presion',
  'parq_huesos_articulaciones',
]

/** Los mismos, como los nombra el dominio y como los escribe `CribadoForm`. */
const DEL_DOMINIO = [
  'diagnostico',
  'quienLoLleva',
  'tratamientoActivo',
  'medicacionCronica',
  'autorizacionSanitaria',
  'restriccionesExplicitas',
  'sintomasConEsfuerzo',
  'nivelFuncional',
  'queLeHanDichoQueNoHaga',
  'parqEnfermedadCardiaca',
  'parqMedicamentoPresion',
  'parqHuesosArticulaciones',
]

describe('el detalle del cribado', () => {
  it('traduce los doce nombres a los de la migración 0058', () => {
    const entrada = Object.fromEntries(DEL_DOMINIO.map((k) => [k, 'lo que escribió']))
    expect(Object.keys(enColumnas(entrada) ?? {})).toEqual(COLUMNAS)
  })

  it('el caso que se perdía: la medicación se encuentra por su columna', () => {
    const traducido = enColumnas({ medicacionCronica: 'prednisolona 10 mg' })
    expect(traducido?.medicacion_cronica).toBe('prednisolona 10 mg')
    expect(traducido?.medicacionCronica).toBeUndefined()
  })

  it('no toca el valor, solo la clave: el detalle es literal', () => {
    const dicho = 'Me dijeron que no cargue peso por encima de la cabeza'
    expect(enColumnas({ queLeHanDichoQueNoHaga: dicho })?.que_le_han_dicho_que_no_haga)
      .toBe(dicho)
  })

  it('sin detalle no inventa un objeto vacío', () => {
    expect(enColumnas(undefined)).toBeUndefined()
  })
})
