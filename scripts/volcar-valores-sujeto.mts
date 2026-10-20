// Vuelca las constantes registradas del dominio del sujeto. Dos modos:
//   vite-node scripts/volcar-valores-sujeto.mts          JSON {id: valor}
//   vite-node scripts/volcar-valores-sujeto.mts --tsv    filas para PROCEDENCIAS.tsv (sin cabecera)
import { VALORES_REGISTRADOS } from '../src/domain/sujeto/registro'

const NOMBRES: Record<string, string> = {
  cabeza: 'cabeza (VERT-MIDG)',
  tronco: 'tronco entero (SUPR-MIDH)',
  brazo: 'brazo (SJC-EJC)',
  antebrazo: 'antebrazo (EJC-WJC)',
  mano: 'mano (WJC-MET3)',
  muslo: 'muslo (HJC-KJC)',
  tibia: 'tibia (KJC-AJC, extremos alternativos)',
  pie: 'pie (HEEL-TTIP)',
}
const CAMPOS: Record<string, string> = {
  masa: 'fracción de la masa corporal',
  cm: 'centro de masas, fracción del largo desde el extremo proximal (craneal en cabeza y tronco, talón en el pie)',
  largo: 'largo del segmento en metros',
}
const SEXOS: Record<string, string> = { h: 'varones (73,0 kg, 1,741 m)', m: 'mujeres (61,9 kg, 1,735 m)' }
const FUENTE =
  'de Leva 1996 J Biomech 29(9):1223-30 DOI 10.1016/0021-9290(95)00178-6, Tabla 4 p.1228; PDF ebm.ufabc.edu.br/wp-content/uploads/2013/12/Leva-1996.pdf; cotejo: scripts/cotejar-deleva-con-pdf.py'

function fila(id: string, valor: number): string {
  const p = id.split('.')
  if (p[0] === 'deleva96' && p[1] === 'cerv') {
    const sexo = SEXOS[p[2]]
    const ext = p[3] === 'cabeza' ? 'cabeza (VERT-CERV, extremos alternativos)' : 'tronco (CERV-MIDH, extremos alternativos)'
    return [valor, `[${id}] ${CAMPOS[p[4]]} de ${ext}, ${sexo}`, FUENTE, 'transcrito', '2026-10-20', 'segunda parte de la Tabla 4; leído en texto y en la imagen'].join('	')
  }
  if (p[0] === 'deleva96') {
    const sexo = SEXOS[p[1]]
    const que =
      p[2] === 'estatura_ref'
        ? `estatura media de la muestra de ${sexo}, en metros (la leyenda del artículo imprime 173.5 m para mujeres: errata de unidad)`
        : `${CAMPOS[p[3]]} de ${NOMBRES[p[2]]}, ${sexo}`
    return [valor, `[${id}] ${que}`, FUENTE, 'transcrito', '2026-10-20', 'leído en texto (pypdf) y en la imagen de la página'].join('\t')
  }
  if (id === 'convenciones.gravedad') {
    return [valor, `[${id}] aceleración normal de la gravedad, m/s2`, 'valor convencional g_n (CGPM 1901); NO se abrió hoy el folleto SI del BIPM', 'supuesto', '2026-10-20', 'lo fijó Claude como constante estándar; verificar contra la fuente'].join('\t')
  }
  if (id.startsWith('sujeto.limite.')) {
    return [valor, `[${id}] límite de cordura para rechazar unidades confundidas (no clínico)`, '-', 'supuesto', '2026-10-20', 'lo eligió Claude; solo detecta metros por centímetros'].join('\t')
  }
  return [valor, `[${id}] SIN DESCRIPCIÓN`, '-', 'INVENTADO', '2026-10-20', 'falta describir'].join('\t')
}

if (process.argv.includes('--tsv')) {
  for (const [id, valor] of Object.entries(VALORES_REGISTRADOS)) console.log(fila(id, valor))
} else {
  console.log(JSON.stringify(VALORES_REGISTRADOS, null, 1))
}
