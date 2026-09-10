/**
 * De aquí sale `informes/definicion-corporal.json`.
 *
 *     npx vite-node informes/definicion-corporal.mjs
 *
 * Mide lo que el encargo pide medir: dos cuerpos de la MISMA estatura y fémur +15 % /
 * −15 %, y qué le pasa a la traza del movimiento y a los brazos de momento. La prueba
 * `src/domain/patrones/definicionCorporal.test.ts` comprueba las mismas propiedades; esto
 * deja los NÚMEROS escritos, que es otra cosa.
 */
import { writeFileSync } from 'node:fs'
import {
  angulosArticulares,
  definicionDe,
  esqueletoDeFase,
  largosDeHueso,
  trazaDe,
} from '../src/domain/patrones/definicionCorporal.ts'
import { PATRON_POR_ID } from '../src/domain/patrones/catalogo.ts'
import { planDeMedida } from '../src/domain/biomecanica/palancas.ts'
import { brazosDeMomento } from '../src/domain/biomecanica/brazosDeMomento.ts'

const SEXO = 'hombre'
const ESTATURA_CM = 175
const FASES = [0, 0.5, 1]
const PATRON = PATRON_POR_ID.sentadilla

/**
 * Las proporciones que producen un fémur de `factor` veces el del cuerpo de referencia
 * SIN tocar nada más: misma estatura, misma tibia, mismos brazos. El tronco absorbe la
 * diferencia, que es lo que hace un cuerpo real.
 *
 * `juegoConProporciones` reparte `coronilla − planta` entre fémur, tibia y torso según
 * sus razones, así que basta con dar los largos que se quieren y normalizar.
 */
function proporcionesConFemur(base, factor) {
  const disponible = base.coronilla - base.planta
  const femur = base.femur * factor
  const tibia = base.tibia
  const torso = disponible - femur - tibia
  const humero = base.humero
  const antebrazo = base.antebrazo
  const suma = femur + tibia + torso + humero + antebrazo
  return {
    femur: femur / suma,
    tibia: tibia / suma,
    torso: torso / suma,
    humero: humero / suma,
    antebrazo: antebrazo / suma,
    fotogramas: 30,
  }
}

const redondear = (v, n = 4) => Number(v.toFixed(n))
const punto = (p) => p.map((v) => redondear(v))

const referencia = definicionDe(SEXO, ESTATURA_CM)
const plan = planDeMedida(PATRON.categoria, '')

function retrato(nombre, definicion) {
  const brazos = {}
  const angulos = {}
  for (const fase of FASES) {
    const esq = esqueletoDeFase(definicion, PATRON, fase)
    brazos[String(fase)] = brazosDeMomento(esq, plan).map((b) => ({
      articulacion: b.articulacion,
      protagonismo: b.protagonismo,
      metros: redondear(b.metros),
      largoDelHueso: redondear(b.largo),
    }))
    angulos[String(fase)] = Object.fromEntries(
      Object.entries(angulosArticulares(esq, definicion.huesos)).map(([k, v]) => [
        k,
        redondear(v, 6),
      ]),
    )
  }
  const largos = largosDeHueso(definicion)
  return {
    nombre,
    clave: definicion.clave,
    sexo: definicion.sexo,
    estaturaCm: definicion.estaturaCm,
    juego: {
      femur: redondear(definicion.juego.femur, 5),
      tibia: redondear(definicion.juego.tibia, 5),
      humero: redondear(definicion.juego.humero, 5),
      antebrazo: redondear(definicion.juego.antebrazo, 5),
      cadera: redondear(definicion.juego.cadera, 5),
      coronilla: redondear(definicion.juego.coronilla, 5),
      planta: redondear(definicion.juego.planta, 5),
      fuente: definicion.juego.fuente,
    },
    largosDeHueso: Object.fromEntries(
      Object.entries(largos).map(([k, v]) => [k, redondear(v, 5)]),
    ),
    brazosDeMomento: brazos,
    angulosArticulares: angulos,
    traza: (trazaDe(definicion, PATRON) ?? []).map(punto),
  }
}

const cuerpos = [
  retrato('femur+15', definicionDe(SEXO, ESTATURA_CM, proporcionesConFemur(referencia.juego, 1.15))),
  retrato('femur-15', definicionDe(SEXO, ESTATURA_CM, proporcionesConFemur(referencia.juego, 0.85))),
]

const [largo, corto] = cuerpos
const distancia = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])

const informe = {
  generado: new Date().toISOString().slice(0, 10),
  generadoPor: 'npx vite-node informes/definicion-corporal.mjs',
  queMide:
    'Dos cuerpos de la misma estatura (175 cm) y fémur +15 % / -15 % respecto al mismo ' +
    'cuerpo sin proporciones medidas. La MISMA definición corporal alimenta la malla, la ' +
    'traza, la cámara y los cálculos: si el fémur cambia, la traza y los brazos de momento ' +
    'cambian con él, y los ángulos articulares NO, porque el ejercicio es el mismo.',
  patron: { id: PATRON.id, categoria: PATRON.categoria, seguimiento: PATRON.seguimiento },
  planDeMedida: {
    origen: plan.linea.origen,
    ejes: plan.ejes.map((e) => `${e.articulacion}:${e.protagonismo}`),
  },
  referencia: {
    clave: referencia.clave,
    femur: redondear(referencia.juego.femur, 5),
    tibia: redondear(referencia.juego.tibia, 5),
    coronilla: redondear(referencia.juego.coronilla, 5),
  },
  cuerpos,
  comparacion: {
    razonDeFemur: redondear(largo.juego.femur / corto.juego.femur, 6),
    estaturaIgual: largo.juego.coronilla === corto.juego.coronilla,
    tibiaIgual: largo.juego.tibia === corto.juego.tibia,
    brazosDeMomentoPorFase: Object.fromEntries(
      FASES.map((f) => [
        String(f),
        largo.brazosDeMomento[String(f)].map((b, i) => ({
          articulacion: b.articulacion,
          'femur+15': b.metros,
          'femur-15': corto.brazosDeMomento[String(f)][i].metros,
          diferenciaMm: redondear(
            (b.metros - corto.brazosDeMomento[String(f)][i].metros) * 1000,
            1,
          ),
        })),
      ]),
    ),
    trazaMaximaSeparacionMm: redondear(
      Math.max(...largo.traza.map((p, i) => distancia(p, corto.traza[i]))) * 1000,
      1,
    ),
    angulosIdenticosEnCadaFase: FASES.every((f) =>
      Object.keys(largo.angulosArticulares[String(f)]).every(
        (k) =>
          largo.angulosArticulares[String(f)][k] === corto.angulosArticulares[String(f)][k],
      ),
    ),
  },
}

const destino = new URL('./definicion-corporal.json', import.meta.url)
writeFileSync(destino, `${JSON.stringify(informe, null, 2)}\n`)
console.log('escrito', destino.pathname)
console.log(JSON.stringify(informe.comparacion, null, 2))
