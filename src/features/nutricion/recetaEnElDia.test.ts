import { beforeEach, describe, expect, it } from 'vitest'
import { crearMockDb } from '../../data/mockDb'
import { catalogoRepo } from '../../data/catalogo/catalogoRepo'
import type { Receta } from '../../data/recetas'
import { recetaAlRegistro } from '../../domain/nutricion/recetaAlRegistro'
import { resumenDelDia } from '../../domain/nutricion/resumen'

/**
 * La prueba que de verdad importa: que agregar una receta MUEVA las kcal del día.
 *
 * Los tests de la hoja comprueban que el botón llama al handler, y los del
 * dominio que la conversión es correcta. Ninguno de los dos detecta el fallo
 * que se quiso evitar aquí: que la comida se escriba bien y aun así el total
 * del día no cambie, porque `resumenDelDia` se salta los ítems cuyo
 * `alimentoId` no está en el catálogo.
 *
 * Ese fallo sería silencioso y creíble —el aviso diría «agregada», la comida
 * aparecería en la lista— y la persona comería de más creyendo que va bien. Por
 * eso esto se prueba de punta a punta contra el catálogo real.
 */

const USUARIO = 'u-valentina'
const FECHA = '2026-08-16'
const CUANDO = `${FECHA}T17:30:00`

const BROWNIE: Receta = {
  id: 'r-brownie',
  handle: '@ejemplo.postres',
  nombre: 'Brownie de avena',
  categoria: 'Postre',
  media: { thumbnail: 'x', duracion: '0:47' },
  social: { views: '—', likes: '—', guardados: '—' },
  ajuste: {
    porcion: '1 porción de 60 g',
    porcionNota: 'de las 9 del molde',
    kcal: 180, prot: 7, carb: 24, grasa: 6,
    notas: [],
  },
  ingredientes: [
    { nombre: 'Avena', enElReel: '200 g', paraTi: '22 g', alimentoId: 'avena-en-hojuelas-peso-en-seco', gramosParaTi: 22, estado: 'seco' },
    { nombre: 'Cacao', enElReel: '40 g', paraTi: '4 g', alimentoId: 'cacao-tostado-y-molido', gramosParaTi: 4, estado: 'seco' },
    { nombre: 'Mantequilla de maní', enElReel: '60 g', paraTi: '7 g', alimentoId: 'mantequilla-de-mani', gramosParaTi: 7, estado: 'listo' },
  ],
}

function kcalDelDia(db: ReturnType<typeof crearMockDb>): number {
  const comidas = db.registroComidas.delDia(USUARIO, FECHA)
  return resumenDelDia(comidas, (id) => catalogoRepo.porId(id)).porDia.kcal ?? 0
}

function agregar(db: ReturnType<typeof crearMockDb>, receta: Receta): string {
  const plan = recetaAlRegistro(receta, CUANDO)
  if (!plan.puede) throw new Error(plan.motivo)
  const comidaId = db.registroComidas.abrirComida({ ...plan.comida, usuarioId: USUARIO })
  for (const item of plan.items) db.registroComidas.agregarItem(USUARIO, comidaId, item)
  return comidaId
}

describe('una receta agregada al día', () => {
  beforeEach(() => localStorage.clear())

  it('sube las kcal del día: los ingredientes SÍ cuadran con el catálogo', () => {
    const db = crearMockDb()
    const antes = kcalDelDia(db)
    agregar(db, BROWNIE)
    expect(kcalDelDia(db)).toBeGreaterThan(antes)
  })

  /**
   * Ninguno de los tres ingredientes puede caerse por el camino. Si uno se
   * saltara, el total quedaría corto y nadie se enteraría, que es justo el
   * fallo que este archivo existe para impedir.
   */
  it('ningún ingrediente se pierde: los tres están en el catálogo', () => {
    const db = crearMockDb()
    agregar(db, BROWNIE)
    const comida = db.registroComidas.delDia(USUARIO, FECHA)[0]
    expect(comida.items).toHaveLength(3)
    for (const item of comida.items) {
      expect(catalogoRepo.porId(item.alimentoId), `falta ${item.alimentoId}`).toBeDefined()
    }
  })

  it('el total sale de los ingredientes, no de las kcal de la ficha', () => {
    const db = crearMockDb()
    agregar(db, BROWNIE)
    const kcal = kcalDelDia(db)
    // No tiene por qué ser 180 clavado -la ficha la calculó el coach sobre la
    // receta entera-, pero sí del mismo orden. Si saliera 0 o 1.800, algo se
    // rompió entre los gramos y el catálogo.
    expect(kcal).toBeGreaterThan(80)
    expect(kcal).toBeLessThan(400)
  })

  it('deshacer devuelve el día exactamente a donde estaba', () => {
    const db = crearMockDb()
    const antes = kcalDelDia(db)
    const comidaId = agregar(db, BROWNIE)
    expect(kcalDelDia(db)).not.toBe(antes)
    db.registroComidas.borrarComida(USUARIO, comidaId)
    expect(kcalDelDia(db)).toBe(antes)
    expect(db.registroComidas.delDia(USUARIO, FECHA)).toHaveLength(0)
  })

  /**
   * La receta entra como comida propia. Si se mezclara con el snack que la
   * persona ya tenía, deshacer tendría que quitar ítem a ítem y un ingrediente
   * repetido se llevaría por delante el que ya estaba.
   */
  it('deshacer no toca lo que la persona ya había registrado', () => {
    const db = crearMockDb()
    const suyo = db.registroComidas.abrirComida({
      usuarioId: USUARIO,
      momentoIso: `${FECHA}T10:00:00`,
      comida: 'snack',
      cocinadoPorEl: true,
      aceiteG: null,
      salG: null,
      confianza: 'estimado',
    })
    db.registroComidas.agregarItem(USUARIO, suyo, {
      alimentoId: 'banano',
      gramos: 120,
      fuePesado: true,
      estadoAsumido: 'crudo',
    })
    const conSuSnack = kcalDelDia(db)

    const comidaId = agregar(db, BROWNIE)
    db.registroComidas.borrarComida(USUARIO, comidaId)

    expect(kcalDelDia(db)).toBe(conSuSnack)
    expect(db.registroComidas.delDia(USUARIO, FECHA)).toHaveLength(1)
  })
})
