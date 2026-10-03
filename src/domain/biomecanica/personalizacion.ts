import type { PerfilAntropometrico } from '../types'

export type VarianteBiomecanica =
  | 'dominada'
  | 'jalon'
  | 'peso-muerto-convencional'
  | 'peso-muerto-rumano'
  | 'sentadilla'
  | 'otro'

export interface EvidenciaDeRegla {
  fuente: string
  sintesis: string
}

export interface CasoNumericoDeRegla {
  entrada: string
  calculo: string
  lectura: string
}

export interface AprobacionDeRegla {
  estado: 'aprobada'
  responsable: 'coach'
  fecha: '2026-09-01'
}

/** Contrato auditable: ninguna regla puede existir sin su contrapeso y límite. */
export interface ReglaBiomecanica {
  id: string
  titulo: string
  poblacion: string
  evidenciaAFavor: EvidenciaDeRegla
  evidenciaContraria: EvidenciaDeRegla
  casoNumerico: CasoNumericoDeRegla
  limites: readonly string[]
  aprobacion: AprobacionDeRegla
}

const APROBACION: AprobacionDeRegla = {
  estado: 'aprobada',
  responsable: 'coach',
  fecha: '2026-09-01',
}

const TRATADO =
  'C:/Users/ASUS/Downloads/tratado_anatomia_100_paginas.html, cap. 1 (Planimetría y antropometría longitudinal)'
const PALANCAS =
  'C:/Users/ASUS/dev/cerebro-alpha/wiki/conocimiento/segmentos-ejes-y-palancas.md'

export const REGLAS_BIOMECANICAS: readonly ReglaBiomecanica[] = [
  {
    id: 'BIO-SENTADILLA-FEMUR-TORSO-01',
    titulo: 'Relación fémur/torso en sentadilla',
    poblacion: 'Adultos que ejecutan sentadillas de cadena cerrada sin una limitación clínica declarada.',
    evidenciaAFavor: {
      fuente: TRATADO,
      sintesis:
        'Un fémur relativamente largo aumenta el brazo externo de cadera y suele exigir más inclinación del torso para conservar el centro de masas sobre el pie.',
    },
    evidenciaContraria: {
      fuente: PALANCAS,
      sintesis:
        'La postura observada también depende de dorsiflexión, apertura de pies, posición de la carga y técnica; una proporción no predice por sí sola el reparto articular.',
    },
    casoNumerico: {
      entrada: 'Fémur 50 cm; torso 45 cm.',
      calculo: '50 / 45 = 1,11.',
      lectura: 'La inclinación anterior puede ser una compensación esperable; no se etiqueta automáticamente como error.',
    },
    limites: [
      'No diagnostica movilidad de tobillo ni dolor.',
      'No selecciona una variante ni cambia series, carga, repeticiones o RIR.',
      'Debe contrastarse con vídeo lateral y la carga sobre el mediopié.',
    ],
    aprobacion: APROBACION,
  },
  {
    id: 'BIO-PM-CONVENCIONAL-SEGMENTOS-02',
    titulo: 'Salida del peso muerto convencional desde el suelo',
    poblacion: 'Adultos que ejecutan peso muerto convencional con la carga iniciando en el suelo.',
    evidenciaAFavor: {
      fuente: PALANCAS,
      sintesis:
        'La salida convencional coordina extensión de rodilla y cadera; tibia y fémur condicionan la posición inicial sin convertir el gesto en un rumano.',
    },
    evidenciaContraria: {
      fuente: TRATADO,
      sintesis:
        'Las proporciones describen una desventaja externa, pero no miden brazos internos, capacidad muscular, tolerancia tisular ni aprendizaje técnico.',
    },
    casoNumerico: {
      entrada: 'Fémur 50 cm; tibia-peroné 40 cm.',
      calculo: '50 / 40 = 1,25.',
      lectura: 'La cadera puede iniciar relativamente más atrás/alta; la rodilla sigue teniendo recorrido en la salida.',
    },
    limites: [
      'Solo aplica si el nombre declara peso muerto convencional o peso muerto sin la palabra rumano/RDL.',
      'No infiere separación de la barra, altura de discos ni calzado.',
      'No recomienda carga ni modifica la prescripción.',
    ],
    aprobacion: APROBACION,
  },
  {
    id: 'BIO-PM-RUMANO-FEMUR-TORSO-03',
    titulo: 'Bisagra del peso muerto rumano',
    poblacion: 'Adultos que ejecutan peso muerto rumano/RDL desde la posición erguida.',
    evidenciaAFavor: {
      fuente: PALANCAS,
      sintesis:
        'En el rumano la cadera protagoniza, la rodilla se mantiene casi fija y cada centímetro de separación de la carga aumenta el brazo en cadera y lumbar.',
    },
    evidenciaContraria: {
      fuente: PALANCAS,
      sintesis:
        'Con cargas menores a aproximadamente 40 % del peso corporal, el centro de masas del torso puede aportar un momento comparable al de la barra.',
    },
    casoNumerico: {
      entrada: 'Fémur 48 cm; torso 52 cm.',
      calculo: '48 / 52 = 0,92.',
      lectura: 'La relación contextualiza la inclinación, pero la señal decisiva sigue siendo rodilla casi fija y barra junto a la pierna.',
    },
    limites: [
      'No aplica al convencional, que inicia desde el suelo y usa más rodilla.',
      'No calcula fuerza lumbar interna ni seguridad clínica.',
      'No cambia rango, carga, series, repeticiones ni RIR.',
    ],
    aprobacion: APROBACION,
  },
  {
    id: 'BIO-DOMINADA-BRAZOS-TORSO-04',
    titulo: 'Recorrido individual de la dominada',
    poblacion: 'Adultos que ejecutan dominadas estrictas con las manos fijas en una barra.',
    evidenciaAFavor: {
      fuente: PALANCAS,
      sintesis:
        'La dominada es cadena cerrada: se mueve el cuerpo y la línea de fuerza pasa por su centro de masas; longitudes de brazo y antebrazo cambian el recorrido articular.',
    },
    evidenciaContraria: {
      fuente: PALANCAS,
      sintesis:
        'Agarre, ancho de manos, control escapular, lastre y posición del centro de masas pueden dominar la ejecución; la longitud del miembro superior no basta.',
    },
    casoNumerico: {
      entrada: 'Brazo 34 cm; antebrazo 28 cm; torso 50 cm.',
      calculo: '(34 + 28) / 50 = 1,24.',
      lectura: 'Se espera un recorrido distal relativamente largo; no se compara su altura de subida en centímetros con otra persona.',
    },
    limites: [
      'No se mide contra un cable ni siguiendo solo el disco de lastre.',
      'No convierte una dominada con impulso en estricta por clasificación.',
      'No prescribe agarre, asistencia, lastre ni repeticiones.',
    ],
    aprobacion: APROBACION,
  },
  {
    id: 'BIO-HOMBRO-ANCHO-BRAZO-05',
    titulo: 'Ancho clavicular y miembro superior',
    poblacion: 'Adultos sin restricción clínica de hombro que realizan empujes o tracciones.',
    evidenciaAFavor: {
      fuente: TRATADO,
      sintesis:
        'La geometría de los segmentos altera el brazo externo y la trayectoria distal en sistemas de palanca de tercer género.',
    },
    evidenciaContraria: {
      fuente: PALANCAS,
      sintesis:
        'El brazo interno tendinoso no es visible, cambia con el ángulo y varía entre personas; las longitudes externas no permiten anunciar fuerza muscular.',
    },
    casoNumerico: {
      entrada: 'Ancho clavicular 42 cm; brazo 34 cm.',
      calculo: '42 / 34 = 1,24.',
      lectura: 'Sirve para contextualizar encuadre y trayectoria, no para inferir ventaja interna del hombro.',
    },
    limites: [
      'No diagnostica pinzamiento, inestabilidad ni rango articular.',
      'No convierte ancho biacromial en ancho de agarre.',
      'No modifica el texto de prescripción.',
    ],
    aprobacion: APROBACION,
  },
  {
    id: 'BIO-PERIMETROS-NO-SON-PALANCAS-06',
    titulo: 'Cintura y caderas no son longitudes de palanca',
    poblacion: 'Cualquier adulto con perímetros de cintura y caderas registrados.',
    evidenciaAFavor: {
      fuente: TRATADO,
      sintesis:
        'La distribución de masa participa en el centro de masas del sistema y puede cambiar la demanda externa.',
    },
    evidenciaContraria: {
      fuente: PALANCAS,
      sintesis:
        'Un brazo de momento exige eje y línea de acción; dos perímetros no localizan el centro de masas ni sustituyen una longitud de segmento.',
    },
    casoNumerico: {
      entrada: 'Cintura 78 cm; caderas 102 cm.',
      calculo: '78 / 102 = 0,76.',
      lectura: 'El cociente se conserva como contexto, pero no escala fémur, torso, momentos ni cargas.',
    },
    limites: [
      'No estima composición corporal, riesgo cardiometabólico ni centro de masas.',
      'Nunca completa una longitud faltante.',
      'No produce una corrección técnica.',
    ],
    aprobacion: APROBACION,
  },
] as const

const REGLA_POR_ID = new Map(REGLAS_BIOMECANICAS.map((regla) => [regla.id, regla]))

export interface AplicacionDeRegla {
  reglaId: string
  aplica: boolean
  valor: number
  expresion: string
  lectura: string
  regla: ReglaBiomecanica
}

function normalizar(texto: string): string {
  return texto.normalize('NFD').replace(/\p{Diacritic}/gu, '').toUpperCase()
}

export function varianteBiomecanicaDe(categoria: string, nombre: string): VarianteBiomecanica {
  const c = normalizar(categoria)
  const n = normalizar(nombre)
  if (c === 'DOMINADA' || /DOMINADA|PULL[- ]?UP|CHIN[- ]?UP/.test(n)) return 'dominada'
  if (/JALON/.test(n) || c.includes('TRACCION VERTICAL')) return 'jalon'
  if (/PESO MUERTO/.test(n) && /RUMANO|RDL|PIERNAS RIGIDAS/.test(n)) {
    return 'peso-muerto-rumano'
  }
  if (c === 'PESO MUERTO CONVENCIONAL' || /PESO MUERTO/.test(n)) {
    return 'peso-muerto-convencional'
  }
  if (c.includes('BISAGRA DE CADERA')) return 'peso-muerto-rumano'
  if (c.includes('SENTADILLA')) return 'sentadilla'
  return 'otro'
}

function aplicacion(
  reglaId: string,
  aplica: boolean,
  valor: number,
  expresion: string,
  lectura: string,
): AplicacionDeRegla {
  const regla = REGLA_POR_ID.get(reglaId)
  if (!regla) throw new Error(`Regla biomecánica inexistente: ${reglaId}`)
  return { reglaId, aplica, valor: Number(valor.toFixed(3)), expresion, lectura, regla }
}

export interface PersonalizacionBiomecanica {
  variante: VarianteBiomecanica
  perfilActualizadoEn: string
  aplicaciones: AplicacionDeRegla[]
  limites: string[]
}

export function personalizarBiomecanica(
  categoria: string,
  nombre: string,
  perfil: PerfilAntropometrico,
): PersonalizacionBiomecanica {
  const variante = varianteBiomecanicaDe(categoria, nombre)
  const aplicaciones: AplicacionDeRegla[] = []

  if (variante === 'sentadilla') {
    const ratio = perfil.femurCm / perfil.torsoCm
    aplicaciones.push(
      aplicacion(
        'BIO-SENTADILLA-FEMUR-TORSO-01',
        true,
        ratio,
        `${perfil.femurCm} / ${perfil.torsoCm}`,
        ratio >= 1
          ? 'Fémur relativamente largo: una mayor inclinación puede ser una compensación geométrica esperable.'
          : 'El torso no es corto respecto al fémur; la proporción por sí sola no explica una inclinación grande.',
      ),
    )
  }

  if (variante === 'peso-muerto-convencional') {
    const ratio = perfil.femurCm / perfil.tibiaPeroneCm
    aplicaciones.push(
      aplicacion(
        'BIO-PM-CONVENCIONAL-SEGMENTOS-02',
        true,
        ratio,
        `${perfil.femurCm} / ${perfil.tibiaPeroneCm}`,
        'La salida se interpreta como extensión coordinada de rodilla y cadera; no como un rumano.',
      ),
    )
  }

  if (variante === 'peso-muerto-rumano') {
    const ratio = perfil.femurCm / perfil.torsoCm
    aplicaciones.push(
      aplicacion(
        'BIO-PM-RUMANO-FEMUR-TORSO-03',
        true,
        ratio,
        `${perfil.femurCm} / ${perfil.torsoCm}`,
        'La proporción contextualiza la inclinación; la rodilla casi fija y la carga junto a la pierna distinguen el gesto.',
      ),
    )
  }

  if (variante === 'dominada') {
    const ratio = (perfil.brazoCm + perfil.antebrazoCm) / perfil.torsoCm
    aplicaciones.push(
      aplicacion(
        'BIO-DOMINADA-BRAZOS-TORSO-04',
        true,
        ratio,
        `(${perfil.brazoCm} + ${perfil.antebrazoCm}) / ${perfil.torsoCm}`,
        'Cadena cerrada: manos fijas, cuerpo móvil y línea por el centro de masas.',
      ),
    )
  }

  const hombro = perfil.anchoClavicularCm / perfil.brazoCm
  aplicaciones.push(
    aplicacion(
      'BIO-HOMBRO-ANCHO-BRAZO-05',
      variante === 'dominada' || variante === 'jalon',
      hombro,
      `${perfil.anchoClavicularCm} / ${perfil.brazoCm}`,
      'Contexto de trayectoria y encuadre; no es una estimación del brazo tendinoso interno.',
    ),
  )

  const cinturaCaderas = perfil.cinturaCm / perfil.caderasCm
  aplicaciones.push(
    aplicacion(
      'BIO-PERIMETROS-NO-SON-PALANCAS-06',
      false,
      cinturaCaderas,
      `${perfil.cinturaCm} / ${perfil.caderasCm}`,
      'Se registra como contexto y se excluye del cálculo de longitudes y momentos.',
    ),
  )

  return {
    variante,
    perfilActualizadoEn: perfil.actualizadoEn,
    aplicaciones,
    limites: [...new Set(aplicaciones.flatMap((a) => a.regla.limites))],
  }
}
