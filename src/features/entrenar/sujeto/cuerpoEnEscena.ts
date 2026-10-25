import type { Malla } from '../../../domain/patrones/malla'
import { colocar } from '../escena/piezas3d'
import { nombreDeParte } from '../visor/cargaDelAtlas'
import { CuerpoPintado, type CapaDelCuerpo, type Paleta } from './pintura'
import type { TinteDelCuerpo } from './tinte'

/**
 * QUE MALLAS DEL SUJETO DE BLENDER SE SUBEN AL MOTOR en cada capa, ya pintadas.
 *
 * - **Piel**: la piel translucida (la maqueta oculta las regiones, pero el dolor tiene que
 *   verse en las tres capas) sobre los musculos en su color de base.
 * - **Musculo**: los musculos con el tinte de las series y el dolor.
 * - **Hueso**: el esqueleto opaco y los musculos al 30 %.
 *
 * Los musculos y la piel se COPIAN una vez (el atlas es compartido); el esqueleto va tal cual.
 * Devuelve tambien una `firma` para que quien dibuja sepa cuando hay que volver a subir.
 */

export interface AlmacenDeCapas {
  get(capa: string): Malla[] | undefined
}

const ALFA_DE_LA_PIEL = 0.5

const copiasDeMusculos = new WeakMap<Malla[], { cuerpo: CuerpoPintado; pintada: string }>()
const copiasDePiel = new WeakMap<Malla[], Malla[]>()
const copiasDeEsqueleto = new WeakMap<Malla[], Malla[]>()

/**
 * El cuerpo de Blender va con el hueso 0 (la identidad): quieto y de pie. El atlas compartido
 * cuelga de la RAIZ del esqueleto del patron (para seguirlo en el explorador), y esa raiz la
 * tumba un press plano: asi salio el cuerpo tumbado en la primera version.
 */
const HUESO_IDENTIDAD = 0

function esqueletoCopiado(esqueleto: Malla[]): Malla[] {
  let copia = copiasDeEsqueleto.get(esqueleto)
  if (!copia) {
    copia = colocar(esqueleto, { x: 0, z: 0, giroY: 0 })
    for (const m of copia) m.colgarDe(HUESO_IDENTIDAD)
    copiasDeEsqueleto.set(esqueleto, copia)
  }
  return copia
}

function pielCopiada(piel: Malla[]): Malla[] {
  let copia = copiasDePiel.get(piel)
  if (!copia) {
    copia = colocar(piel, { x: 0, z: 0, giroY: 0 })
    for (const m of copia) {
      m.colgarDe(HUESO_IDENTIDAD)
      m.alfa = ALFA_DE_LA_PIEL
    }
    copiasDePiel.set(piel, copia)
  }
  return copia
}

export function mallasDelCuerpo(
  atlas: AlmacenDeCapas,
  capa: CapaDelCuerpo,
  tinte: TinteDelCuerpo,
  paleta: Paleta,
): { mallas: Malla[]; firma: string } {
  const mallas: Malla[] = []
  const llegadas: string[] = []

  const musculos = atlas.get('musculos')
  if (musculos) {
    let entrada = copiasDeMusculos.get(musculos)
    if (!entrada) {
      entrada = {
        cuerpo: new CuerpoPintado(musculos.map((malla) => ({ malla, nombre: nombreDeParte(malla) ?? '' }))),
        pintada: '',
      }
      copiasDeMusculos.set(musculos, entrada)
    }
    const firma = `${entrada.cuerpo.firma(tinte, capa)}|${paleta.base.join()}|${paleta.luz.join()}|${paleta.rojo.join()}|${paleta.tendon.join()}`
    if (firma !== entrada.pintada) {
      entrada.cuerpo.pintar(tinte, paleta, capa)
      entrada.pintada = firma
    }
    mallas.push(...entrada.cuerpo.musculos)
    llegadas.push('m')
  }

  const hueso = atlas.get('esqueleto')
  if (capa === 'hueso' && hueso) {
    mallas.push(...esqueletoCopiado(hueso))
    llegadas.push('h')
  }

  const piel = atlas.get('piel')
  if (capa === 'piel' && piel) {
    mallas.push(...pielCopiada(piel))
    llegadas.push('p')
  }

  const base = musculos ? `${copiasDeMusculos.get(musculos)!.cuerpo.firma(tinte, capa)}|${paleta.base.join()}|${paleta.luz.join()}|${paleta.rojo.join()}|${paleta.tendon.join()}` : capa
  return { mallas, firma: `${base}|${llegadas.join('')}` }
}
