// Mutaciones a propósito del dominio del sujeto: "ningún arnés cuenta verde hasta haberlo visto
// fallar". Para cada mutación quita UNA regla del código (reemplazo textual exacto), corre las
// pruebas del dominio y exige que fallen; al terminar restaura el archivo, pase lo que pase.
//
//   npm run mutar-sujeto            todas
//   npm run mutar-sujeto -- fase1   solo las de una fase
//
// Sale con código 1 si alguna mutación SOBREVIVE (las pruebas siguen en verde con la regla
// rota: el arnés no ve ese defecto) o si el texto a mutar ya no existe (la mutación quedó vieja).
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..')
const D = 'src/domain/sujeto/'

/**
 * { fase, archivo, buscar, reemplazar, que, con? } — `buscar` debe aparecer exactamente una vez.
 * `con: 'cotejo'` = la mutación la tiene que ver el cotejo contra el PDF (valores transcritos),
 * no las pruebas: una tabla transcrita se juzga contra su fuente, no contra sí misma.
 */
export const MUTACIONES = [
  {
    fase: 'fase0',
    archivo: D + 'contrato.ts',
    buscar: "if (c.valor !== null) {\n      fallo('E_CERO_POR_NULL'",
    reemplazar: "if (false) {\n      fallo('E_CERO_POR_NULL'",
    que: 'deja de rechazar un no_afirmable con número (el cero en lugar de null)',
  },
  {
    fase: 'fase0',
    archivo: D + 'contrato.ts',
    buscar: "if (!(UNIDADES as readonly string[]).includes(c.unidad as string)) {",
    reemplazar: 'if (false) {',
    que: 'deja de rechazar una unidad sin declarar',
  },
  {
    fase: 'fase0',
    archivo: D + 'contrato.ts',
    buscar: "if (c.fuente.length === 0 || c.fuente.some((f) => f.trim() === '')) {",
    reemplazar: 'if (false) {',
    que: 'deja de rechazar una cifra sin procedencia',
  },
  {
    fase: 'fase0',
    archivo: D + 'contrato.ts',
    buscar: 'const nula = (c.dependeDe ?? []).find((d) => d.valor === null)',
    reemplazar: 'const nula = undefined as { id: string } | undefined',
    que: 'deja de propagar el null (un cero calculado sobre una entrada ausente pasa)',
  },
  {
    fase: 'fase0',
    archivo: D + 'contrato.ts',
    buscar: "if (c.estado === 'estimado' && c.banda === null) {",
    reemplazar: 'if (false) {',
    que: 'deja de exigir banda a una estimación',
  },
  {
    fase: 'fase0',
    archivo: D + 'contrato.ts',
    buscar: '      inf > sup ||\n',
    reemplazar: '      false ||\n',
    que: 'deja de ver una banda invertida',
  },
  {
    fase: 'fase0',
    archivo: D + 'procedencias.ts',
    buscar: 'if (Number(fila.valor) !== valor) {',
    reemplazar: 'if (false) {',
    que: 'el libro y el código pueden diverger sin que el arnés lo vea',
  },
  {
    fase: 'fase0',
    archivo: D + 'procedencias.ts',
    buscar: 'if (propias.length > 1) {',
    reemplazar: 'if (false) {',
    que: 'deja de ver una fila duplicada',
  },
  {
    fase: 'fase0',
    archivo: D + 'procedencias.ts',
    buscar: "export const ESTADOS_QUE_NO_RESPALDAN = ['INVENTADO', 'ENGAÑOSO']",
    reemplazar: 'export const ESTADOS_QUE_NO_RESPALDAN: string[] = []',
    que: 'una cifra puede citar una fila marcada INVENTADO',
  },
  // ── Fase 1 ──
  {
    fase: 'fase1',
    archivo: D + 'deleva.ts',
    buscar: 'muslo: { masa: 0.1416, cm: 0.4095, largo: 0.4222 },',
    reemplazar: 'muslo: { masa: 0.1461, cm: 0.4095, largo: 0.4222 },',
    que: 'varones: dos cifras del muslo intercambiadas (14,16 a 14,61 %)',
  },
  {
    fase: 'fase1',
    archivo: D + 'deleva.ts',
    buscar: 'muslo: { masa: 0.1478, cm: 0.3612, largo: 0.3685 },',
    reemplazar: 'muslo: { masa: 0.1478, cm: 0.3612, largo: 0.3865 },',
    que: 'mujeres: el largo del muslo con dos cifras intercambiadas (solo lo ve el cotejo)',
    con: 'cotejo',
  },
  {
    fase: 'fase1',
    archivo: D + 'deleva.ts',
    buscar: 'cabeza: { masa: 0.0668, cm: 0.5894, largo: 0.2002 },',
    reemplazar: 'cabeza: { masa: 0.0668, cm: 0.5984, largo: 0.2002 },',
    que: 'mujeres: el CM de la cabeza mal copiado (solo lo ve el cotejo)',
    con: 'cotejo',
  },
  {
    fase: 'fase1',
    archivo: D + 'sujeto.ts',
    buscar: 'const escala = e.talla / tabla.estaturaDeReferencia',
    reemplazar: 'const escala = tabla.estaturaDeReferencia / e.talla',
    que: 'la escala a la talla al revés',
  },
  {
    fase: 'fase1',
    archivo: D + 'sujeto.ts',
    buscar: 'masaKg: p.masa * e.masa,',
    reemplazar: 'masaKg: p.masa,',
    que: 'la masa del segmento sin multiplicar por la masa del asesorado',
  },
  {
    fase: 'fase1',
    archivo: D + 'sujeto.ts',
    buscar: 'if (!valido(e.talla) || !valido(e.masa)) return null',
    reemplazar: 'if (false) return null',
    que: 'deja de rechazar una talla o masa NaN',
  },
  {
    fase: 'fase1',
    archivo: D + 'sujeto.ts',
    buscar: 'if (e.talla < LIMITES_DE_CORDURA.tallaMin || e.talla > LIMITES_DE_CORDURA.tallaMax) return null',
    reemplazar: '',
    que: 'deja de rechazar una talla en centímetros',
  },
  {
    fase: 'fase1',
    archivo: D + 'deleva.ts',
    buscar: 'suma + DE_LEVA[sexo].segmentos[s].masa * (SEGMENTOS_PARES.includes(s) ? 2 : 1),',
    reemplazar: 'suma + DE_LEVA[sexo].segmentos[s].masa,',
    que: 'la suma de fracciones no cuenta los pares dos veces',
  },
  // ── Fase 2 ──
  {
    fase: 'fase2',
    archivo: D + 'dinamica.ts',
    buscar: 'tobillo: suma(g.porEncimaDelTobillo, (z) => z - g.tobillo.z),',
    reemplazar: 'tobillo: suma(g.porEncimaDelTobillo, (z) => g.tobillo.z - z),',
    que: 'signo del tobillo invertido',
  },
  {
    fase: 'fase2',
    archivo: D + 'dinamica.ts',
    buscar: 'rodilla: suma(g.porEncimaDeLaRodilla, (z) => g.rodilla.z - z),',
    reemplazar: 'rodilla: suma(g.porEncimaDeLaRodilla, (z) => z - g.rodilla.z),',
    que: 'signo de la rodilla invertido',
  },
  {
    fase: 'fase2',
    archivo: D + 'dinamica.ts',
    buscar: "const barra: MasaPuntual = { nombre: 'barra', kg: cargaKg, ...puntoBarra }",
    reemplazar: "const barra: MasaPuntual = { nombre: 'barra', kg: 0, ...puntoBarra }",
    que: 'se ignora la barra',
  },
  {
    fase: 'fase2',
    archivo: D + 'dinamica.ts',
    buscar: 'kg: 2 * (m.brazo.masaKg + m.antebrazo.masaKg + m.mano.masaKg),',
    reemplazar: 'kg: 0,',
    que: 'se ignoran los brazos',
  },
  {
    fase: 'fase2',
    archivo: D + 'dinamica.ts',
    buscar: 'z: prox.z - cm * largo * u.z,',
    reemplazar: 'z: prox.z + cm * largo * u.z,',
    que: 'el centro de masas medido hacia el lado equivocado del segmento',
  },
  {
    fase: 'fase2',
    archivo: D + 'dinamica.ts',
    buscar: 'const sobreLaCadera = [tronco, cabeza, brazos, barra]',
    reemplazar: 'const sobreLaCadera = [tronco, brazos, barra]',
    que: 'se olvida la cabeza',
  },
  {
    fase: 'fase2',
    archivo: D + 'dinamica.ts',
    buscar: "if (!finito(e.cargaKg) || e.cargaKg < 0) return faltan('carga ausente o negativa')",
    reemplazar: '',
    que: 'una carga ausente pasa como si fuera 0',
  },
  // ── Fase 3 ──
  {
    fase: 'fase3',
    archivo: D + 'bandas.ts',
    buscar: 'const talla = (e.talla as number) + u.talla * normal(azar)',
    reemplazar: 'const talla = (e.talla as number) + 0 * u.talla * normal(azar)',
    que: 'ignora la incertidumbre de la talla',
  },
  {
    fase: 'fase3',
    archivo: D + 'bandas.ts',
    buscar: 'const masa = (e.masa as number) + u.masa * normal(azar)',
    reemplazar: 'const masa = (e.masa as number) + 0 * u.masa * normal(azar)',
    que: 'ignora la incertidumbre de la masa',
  },
  {
    fase: 'fase3',
    archivo: D + 'bandas.ts',
    buscar: 'const a = (x: number) => x + u.angulo * normal(azar)',
    reemplazar: 'const a = (x: number) => x + 0 * u.angulo * normal(azar)',
    que: 'ignora la incertidumbre de los ángulos',
  },
  {
    fase: 'fase3',
    archivo: D + 'bandas.ts',
    buscar: 'const carga = Math.max(0, (e.cargaKg as number) + u.carga * normal(azar))',
    reemplazar: 'const carga = Math.max(0, (e.cargaKg as number) + 0 * u.carga * normal(azar))',
    que: 'ignora la incertidumbre de la carga',
  },
  {
    fase: 'fase3',
    archivo: D + 'bandas.ts',
    buscar: 'const k = antes / despues',
    reemplazar: 'const k = 1',
    que: 'quita la renormalización de masas (la masa total deja de conservarse)',
  },
  {
    fase: 'fase3',
    archivo: D + 'bandas.ts',
    buscar: 'inf: Math.min(percentil(orden, 0.05), c.valor as number),',
    reemplazar: 'inf: Math.min(percentil(orden, 0.95), c.valor as number),',
    que: 'percentil inferior tomado del 95',
  },
  {
    fase: 'fase3',
    archivo: D + 'bandas.ts',
    buscar: '  const azar = crearAzar(semilla)\n  const salida: MuestrasDeMomentos',
    reemplazar: '  const azar = crearAzar(1)\n  const salida: MuestrasDeMomentos',
    que: 'ignora la semilla pedida',
  },
  {
    fase: 'fase3',
    archivo: D + 'bandas.ts',
    buscar: 'nuevaMasa[n] = s.segmentos[n].masa * factor()\n    nuevoCm[n]',
    reemplazar: 'nuevaMasa[n] = s.segmentos[n].masa\n    nuevoCm[n]',
    que: 'ignora la incertidumbre de la masa de los segmentos',
  },
  {
    fase: 'fase3',
    archivo: D + 'bandas.ts',
    buscar: 'if (datos.length < n * 0.9) {',
    reemplazar: 'if (false) {',
    que: 'deja de abstenerse cuando las muestras fallan',
  },
  // ── Fase 4 ──
  {
    fase: 'fase4',
    archivo: D + 'reparto.ts',
    buscar: 'Math.pow(m.brazo * Math.pow(m.area, r), 1 / (r - 1))',
    reemplazar: 'Math.pow(m.brazo * Math.pow(m.area, 2), 1 / (r - 1))',
    que: 'el área se eleva siempre a 2 en vez de a r',
  },
  {
    fase: 'fase4',
    archivo: D + 'reparto.ts',
    buscar: 'const fuerza = m.brazo > 0 ? c * peso(m) : 0',
    reemplazar: 'const fuerza = c * peso(m)',
    que: 'un antagonista (brazo negativo) recibe fuerza',
  },
  {
    fase: 'fase4',
    archivo: D + 'reparto.ts',
    buscar: 'if (!Number.isFinite(momento) || momento <= 0) return null',
    reemplazar: 'if (!Number.isFinite(momento)) return null',
    que: 'reparte un momento no positivo en vez de abstenerse',
    tambien: [['if (!Number.isFinite(c) || c <= 0 || activos.some((m) => !Number.isFinite(peso(m)) || peso(m) <= 0)) return null', '']],
  },
  {
    fase: 'fase4',
    archivo: D + 'reparto.ts',
    buscar: 'if (!Number.isFinite(r) || r <= 1) return null',
    reemplazar: 'if (!Number.isFinite(r)) return null',
    que: 'acepta r = 1, donde no hay solución cerrada',
    tambien: [['if (!Number.isFinite(c) || c <= 0 || activos.some((m) => !Number.isFinite(peso(m)) || peso(m) <= 0)) return null', '']],
  },
  {
    fase: 'fase4',
    archivo: D + 'reparto.ts',
    buscar: 'return (m.brazoCadera * p.cadera - m.brazoRodilla * p.rodilla) / m.largoDeReferencia',
    reemplazar: 'return (m.brazoCadera * p.cadera + m.brazoRodilla * p.rodilla) / m.largoDeReferencia',
    que: 'signo de la rodilla invertido en el índice de longitud',
  },
  {
    fase: 'fase4',
    archivo: D + 'reparto.ts',
    buscar: 'return (m.brazoCadera * p.cadera - m.brazoRodilla * p.rodilla) / m.largoDeReferencia',
    reemplazar: 'return (-m.brazoCadera * p.cadera - m.brazoRodilla * p.rodilla) / m.largoDeReferencia',
    que: 'signo de la cadera invertido en el índice de longitud',
  },
  {
    fase: 'fase4',
    archivo: D + 'reparto.ts',
    buscar: 'area: m.area * Math.max(0.05, 1 + sdRelativaDelArea * normal(azar))',
    reemplazar: 'area: m.area',
    que: 'la banda ignora la incertidumbre del área',
  },
  // -- Tanda A --
  {
    fase: 'tandaA',
    archivo: D + 'repartoDeSentadilla.ts',
    buscar: "estado: 'simulado',",
    reemplazar: "estado: 'estimado',",
    que: 'parametros hipoteticos se presentan como estimados',
  },
  {
    fase: 'tandaA',
    archivo: D + 'repartoDeSentadilla.ts',
    buscar: 'if (!tabla) return sinDatos(MOTIVO_MUSCULOS)',
    reemplazar: 'if (!tabla) tabla = { r: 2, rodilla: [{ nombre: "cuadriceps", area: 1, brazo: 0.04 }], cadera: [{ nombre: "gluteoMayor", area: 1, brazo: 0.05 }] }',
    que: 'sin tabla verificada se rellena con una tabla inventada en vez de abstenerse',
  },
  // -- Tanda B (capa de momentos) y tanda A reabierta (Silder 2007, Ward 2009) --
  {
    fase: 'tandaB',
    archivo: D + 'capaDeMomentos.ts',
    buscar: "if (!contexto.sujetoDeEjemplo || !esSentadillaConBarra(",
    reemplazar: "if (!contexto.sujetoDeEjemplo && !esSentadillaConBarra(",
    que: "la puerta de abstencion pide que fallen las dos condiciones (|| por &&) y deja pasar a un asesorado real",
  },
  {
    fase: 'tandaB',
    archivo: D + 'capaDeMomentos.ts',
    buscar: "if (c.valor === null || !Number.isFinite(c.valor) || (c.estado !== 'estimado' && c.estado !== 'calculado')) continue",
    reemplazar: "if (false) continue",
    que: "un momento null o no afirmable se dibuja como un arco de cero",
  },
  {
    fase: 'tandaB',
    archivo: D + 'capaDeMomentos.ts',
    buscar: "100 * Math.ceil(mayor / 100)",
    reemplazar: "300",
    que: "la escala vuelve a ser fija y la cadera satura (C-1)",
  },
  {
    fase: 'tandaB',
    archivo: D + 'capaDeMomentos.ts',
    buscar: "Math.ceil(mayor / 100)",
    reemplazar: "Math.floor(mayor / 100)",
    que: "la escala se redondea hacia abajo y deja fracciones mayores que 1",
  },
  {
    fase: 'tandaB',
    archivo: D + 'capaDeMomentos.ts',
    buscar: "b.banda.inf >= 0 === b.banda.sup >= 0 &&",
    reemplazar: "",
    que: "una banda que cruza el cero se dibuja invertida (C-6)",
  },
  {
    fase: 'tandaB',
    archivo: D + 'capaDeMomentos.ts',
    buscar: "!n.includes('goblet') &&\n    !n.includes('unilateral')",
    reemplazar: "!n.includes('goblet')",
    que: "una sentadilla unilateral con barra entra en la capa aunque el codigo dice excluirla",
  },
  {
    fase: 'tandaB',
    archivo: D + 'capaDeMomentos.ts',
    buscar: "const ancha = c.banda.sup - c.banda.inf > Math.abs(c.valor)",
    reemplazar: "const ancha = false",
    que: "el texto del pasivo no avisa de que su banda es mas ancha que el valor",
  },
  {
    fase: 'tandaB',
    archivo: 'src/features/entrenar/escena/dibujarMomentos.ts',
    buscar: "export const ALFA_DE_LA_BANDA = 0.35",
    reemplazar: "export const ALFA_DE_LA_BANDA = 1",
    que: "la banda estimada se dibuja opaca",
  },
  {
    fase: 'tandaB',
    archivo: 'src/features/entrenar/escena/dibujarMomentos.ts',
    buscar: "export const ALFA_DEL_VALOR = 0.7",
    reemplazar: "export const ALFA_DEL_VALOR = 1",
    que: "lo estimado se dibuja opaco, igual que lo calculado",
  },
  {
    fase: 'tandaB',
    archivo: 'src/features/entrenar/escena/dibujarMomentos.ts',
    buscar: "m.encima = true",
    reemplazar: "m.encima = false",
    que: "los arcos quedan tapados por la carne en vez de ir encima",
  },
  {
    fase: 'tandaB',
    archivo: 'src/features/entrenar/escena/dibujarMomentos.ts',
    buscar: "if (!capa.poseDelCalculo || !enLaPoseDelCalculo(esq, capa.poseDelCalculo)) return salida",
    reemplazar: "if (!capa.poseDelCalculo) return salida",
    que: "los arcos se pintan en todas las fases de la animacion (C-3)",
  },
  {
    fase: 'tandaB',
    archivo: 'src/features/entrenar/escena/dibujarMomentos.ts',
    buscar: "Math.abs(ahora.tibia - pose.tibia) <= tolerancia && Math.abs(ahora.muslo - pose.muslo) <= tolerancia",
    reemplazar: "Math.abs(ahora.tibia - pose.tibia) <= tolerancia || Math.abs(ahora.muslo - pose.muslo) <= tolerancia",
    que: "basta que coincida un solo angulo con la pose del calculo (&& por ||)",
  },
  {
    fase: 'tandaB',
    archivo: 'src/features/entrenar/escena/dibujarMomentos.ts',
    buscar: "e.estado === 'calculado' ? calculados : estimados",
    reemplazar: "estimados",
    que: "lo calculado se dibuja en la malla de lo estimado",
  },
  {
    fase: 'tandaB',
    archivo: 'src/features/entrenar/escena/dibujarMomentos.ts',
    buscar: "if (!(hasta > desde)) return",
    reemplazar: "if (false) return",
    que: "un arco de barrido cero sube un tubo degenerado",
  },
  {
    fase: 'tandaB',
    archivo: 'src/features/entrenar/escena/dibujarMomentos.ts',
    buscar: "return Math.atan2(prox[2] - dist[2], prox[1] - dist[1])",
    reemplazar: "return Math.atan2(dist[2] - prox[2], dist[1] - prox[1])",
    que: "el angulo del segmento se lee del extremo equivocado (signo invertido)",
  },
  {
    fase: 'tandaB',
    archivo: 'src/features/entrenar/salon/momentos/capaDelSalon.ts',
    buscar: "get('momentos') === 'ejemplo'",
    reemplazar: "get('momentos') !== null",
    que: "cualquier valor de la bandera enciende la capa",
  },
  {
    fase: 'tandaB',
    archivo: 'src/features/entrenar/salon/momentos/capaDelSalon.ts',
    buscar: "if (!activa || !categoria || !nombre) return VACIA",
    reemplazar: "if (false) return VACIA",
    que: "la capa se calcula aunque la bandera este apagada",
  },
  {
    fase: 'tandaB',
    archivo: 'src/features/entrenar/salon/momentos/LecturaDeMomentos.tsx',
    buscar: "if (capa.lineas.length === 0) return null",
    reemplazar: "if (false) return null",
    que: "con la capa apagada el salon crea un nodo de texto vacio",
  },
  {
    fase: 'tandaA2',
    archivo: D + 'pasivo.ts',
    buscar: "const valor = -2 * centro[a]",
    reemplazar: "const valor = -centro[a]",
    que: "el pasivo de las dos piernas se cuenta como el de una",
  },
  {
    fase: 'tandaA2',
    archivo: D + 'pasivo.ts',
    buscar: "const valor = -2 * centro[a]",
    reemplazar: "const valor = 2 * centro[a]",
    que: "el pasivo sale con el signo del articulo (flexor positivo) en vez del de dinamica.ts",
  },
  {
    fase: 'tandaA2',
    archivo: D + 'pasivo.ts',
    buscar: "const rad = (g: number) => (g * Math.PI) / 180",
    reemplazar: "const rad = (g: number) => g",
    que: "los desfases alfa se usan en grados donde el modelo pide radianes",
  },
  {
    fase: 'tandaA2',
    archivo: D + 'pasivo.ts',
    buscar: "cadera: rf + hf - ham - he, // A.5",
    reemplazar: "cadera: rf + hf + ham - he, // A.5",
    que: "ecuacion A.5 con un signo cambiado (isquios suman en vez de restar)",
  },
  {
    fase: 'tandaA2',
    archivo: D + 'pasivo.ts',
    buscar: "rodilla: -kRF * rf - ke + kHAM * ham + kf + gas, // A.6",
    reemplazar: "rodilla: kRF * rf - ke + kHAM * ham + kf + gas, // A.6",
    que: "ecuacion A.6 con el signo del recto femoral cambiado",
  },
  {
    fase: 'tandaA2',
    archivo: D + 'pasivo.ts',
    buscar: "const kGAS = bd('GAS') / bp('GAS')",
    reemplazar: "const kGAS = bp('GAS') / bd('GAS')",
    que: "el cociente de ganancias del gemelo al reves (A.7)",
  },
  {
    fase: 'tandaA2',
    archivo: D + 'pasivo.ts',
    buscar: "h <= d.caderaHastaConRodillaFlexionada && enRodilla",
    reemplazar: "h <= d.caderaMax && enRodilla",
    que: "se afirma el pasivo con cadera profunda y rodilla flexionada, que Silder nunca ensayo",
  },
  {
    fase: 'tandaA2',
    archivo: D + 'pasivo.ts',
    buscar: "enRodilla && t >= d.tobilloMin && t <= d.tobilloMax",
    reemplazar: "enRodilla && t >= d.tobilloMin",
    que: "el techo de tobillo del dominio de Silder desaparece",
  },
  {
    fase: 'tandaA2',
    archivo: D + 'pasivo.ts',
    buscar: "rodilla: caderaRodilla && rodillaTobillo",
    reemplazar: "rodilla: caderaRodilla",
    que: "el pasivo de rodilla ignora que el gemelo exige el tobillo en dominio",
  },
  {
    fase: 'tandaA2',
    archivo: D + 'pasivo.ts',
    buscar: "if (!dom[a]) {",
    reemplazar: "if (false) {",
    que: "se afirma un pasivo fuera del dominio ensayado en vez de no_afirmable",
  },
  {
    fase: 'tandaA2',
    archivo: D + 'pasivo.ts',
    buscar: "HAM: { bp: 5.1, bd: 3.9, a: 30.8 },",
    reemplazar: "HAM: { bp: 5.1, bd: 3.9, a: 30.9 },",
    que: "una cifra de la Tabla 4 de Silder transcrita mal (la ve el cotejo con el articulo)",
    con: 'cotejoSW',
  },
  {
    fase: 'tandaA2',
    archivo: D + 'pasivo.ts',
    buscar: "HAM: { bp: 2.0, bd: 2.5, a: 14.9 },",
    reemplazar: "HAM: { bp: 2.0, bd: 2.5, a: 14.8 },",
    que: "una sd de la Tabla 4 de Silder transcrita mal (la ve el cotejo con el articulo)",
    con: 'cotejoSW',
  },
  {
    fase: 'tandaA2',
    archivo: D + 'pasivo.ts',
    buscar: "caderaHastaConRodillaFlexionada: 85,",
    reemplazar: "caderaHastaConRodillaFlexionada: 90,",
    que: "el dominio de Silder se ensancha 5 grados (lo ve el cotejo con la Tabla 2)",
    con: 'cotejoSW',
  },
  {
    fase: 'tandaA2',
    archivo: D + 'areasDeWard.ts',
    buscar: "isquios: ['biceps_larga', 'semitendinoso', 'semimembranoso'],",
    reemplazar: "isquios: ['biceps_larga', 'biceps_corta', 'semitendinoso', 'semimembranoso'],",
    que: "la cabeza corta del biceps (que no cruza la cadera) entra en los isquios",
  },
  {
    fase: 'tandaA2',
    archivo: D + 'areasDeWard.ts',
    buscar: "gluteo_mayor: { media: 33.4, sd: 8.8 },",
    reemplazar: "gluteo_mayor: { media: 33.5, sd: 8.8 },",
    que: "una cifra de la Tabla 3 de Ward transcrita mal (la ve el cotejo con el articulo)",
    con: 'cotejoSW',
  },
  {
    fase: 'tandaA2',
    archivo: D + 'areasDeWard.ts',
    buscar: "aductor_mayor: { media: 20.5, sd: 7.8 },",
    reemplazar: "aductor_mayor: { media: 20.5, sd: 7.9 },",
    que: "una sd de la Tabla 3 de Ward transcrita mal (la ve el cotejo con el articulo)",
    con: 'cotejoSW',
  },
  {
    fase: 'tandaA2',
    archivo: D + 'areasDeWard.ts',
    buscar: "if (x > 0) return x",
    reemplazar: "return x",
    que: "el muestreo de areas admite areas negativas",
  },
  {
    fase: 'tandaA2',
    archivo: D + 'repartoDeSentadilla.ts',
    buscar: "const pasivo = [pas.cadera, pas.rodilla]",
    reemplazar: "const pasivo = [pas.cadera, pas.tobillo]",
    que: "el reparto lleva el pasivo de tobillo en lugar del de rodilla",
  },
]

const PDF_DE_LEVA =
  process.env.LEVA_PDF ??
  join(raiz, '..', 'cerebro-alpha', 'herramientas', 'encoder-camara', 'articulos', 'DeLeva_1996_J_Biomech_segment_parameters.pdf')

/** Vuelca las constantes del código y las coteja contra el PDF. Código 0 = coinciden. */
function correrCotejo() {
  if (!existsSync(PDF_DE_LEVA)) {
    console.error(`No encuentro el PDF de de Leva en ${PDF_DE_LEVA}`)
    process.exit(2)
  }
  const volcado = spawnSync(
    process.execPath,
    [join(raiz, 'node_modules', 'vite-node', 'vite-node.mjs'), 'scripts/volcar-valores-sujeto.mts'],
    { cwd: raiz, encoding: 'utf8', timeout: 120_000 },
  )
  if (volcado.status !== 0) return volcado.status ?? 1
  const ruta = join(raiz, 'node_modules', '.tmp', 'valores-sujeto.json')
  writeFileSync(ruta, volcado.stdout)
  const r = spawnSync('python', ['-I', 'scripts/cotejar-deleva-con-pdf.py', ruta, PDF_DE_LEVA], { cwd: raiz, encoding: 'utf8' })
  return r.status
}

// Las pruebas del dominio y las de la capa dibujada (la capa de momentos vive en features).
const PRUEBAS = [
  D.replace(/\/$/, ''),
  'src/features/entrenar/escena/dibujarMomentos.test.ts',
  'src/features/entrenar/salon/momentos',
]

const ARTICULOS = join(raiz, '..', 'cerebro-alpha', 'herramientas', 'encoder-camara', 'articulos')

/** Vuelca las constantes y las coteja contra las tablas de Silder 2007 y Ward 2009 (HTML de PMC). */
function correrCotejoSW() {
  const silder = join(ARTICULOS, 'Silder2007_PMC2020832.html')
  const ward = join(ARTICULOS, 'Ward2009_PMC2650051.html')
  for (const f of [silder, ward]) {
    if (!existsSync(f)) {
      console.error(`No encuentro ${f}`)
      process.exit(2)
    }
  }
  const volcado = spawnSync(
    process.execPath,
    [join(raiz, 'node_modules', 'vite-node', 'vite-node.mjs'), 'scripts/volcar-valores-sujeto.mts'],
    { cwd: raiz, encoding: 'utf8', timeout: 120_000 },
  )
  if (volcado.status !== 0) return volcado.status ?? 1
  const ruta = join(raiz, 'node_modules', '.tmp', 'valores-sujeto-sw.json')
  writeFileSync(ruta, volcado.stdout)
  const r = spawnSync('python', ['-I', 'scripts/cotejar-silder-ward-con-html.py', ruta, silder, ward], { cwd: raiz, encoding: 'utf8' })
  return r.status
}

function correrPruebas() {
  const vitest = join(raiz, 'node_modules', 'vitest', 'vitest.mjs')
  const r = spawnSync(process.execPath, [vitest, 'run', ...PRUEBAS], {
    cwd: raiz,
    encoding: 'utf8',
    timeout: 170_000,
  })
  return r.status
}

function principal() {
  const filtro = process.argv[2]
  const lista = MUTACIONES.filter((m) => !filtro || m.fase === filtro)
  if (lista.length === 0) {
    console.error(`ninguna mutación para «${filtro}»`)
    process.exit(1)
  }
  // Control: sin mutar, las pruebas tienen que estar en verde, o "fallarían" por otra cosa.
  const base = correrPruebas()
  if (base !== 0 || (lista.some((m) => m.con === 'cotejo') && correrCotejo() !== 0) || (lista.some((m) => m.con === 'cotejoSW') && correrCotejoSW() !== 0)) {
    console.error('Las pruebas o el cotejo ya están en rojo SIN mutar: no se puede juzgar a las mutaciones.')
    process.exit(1)
  }
  let sobrevivientes = 0
  let viejas = 0
  for (const m of lista) {
    const ruta = join(raiz, m.archivo)
    const original = readFileSync(ruta, 'utf8')
    const veces = original.split(m.buscar).length - 1
    if (veces !== 1) {
      console.log(`VIEJA      ${m.fase} ${m.archivo}: «${m.que}» (el texto aparece ${veces} veces)`)
      viejas++
      continue
    }
    try {
      let mutado = original.replace(m.buscar, () => m.reemplazar)
      // `tambien`: segundo cambio para quitar una defensa redundante que taparía a la primera.
      for (const [a, b] of m.tambien ?? []) mutado = mutado.replace(a, () => b)
      writeFileSync(ruta, mutado)
      const estado = m.con === 'cotejo' ? correrCotejo() : m.con === 'cotejoSW' ? correrCotejoSW() : correrPruebas()
      if (estado === 0) {
        console.log(`SOBREVIVE  ${m.fase} ${m.archivo}: ${m.que}`)
        sobrevivientes++
      } else {
        console.log(`muerta     ${m.fase} ${m.archivo}: ${m.que}`)
      }
    } finally {
      writeFileSync(ruta, original)
    }
  }
  const restaurado = correrPruebas()
  console.log(
    `\n${lista.length} mutaciones · ${sobrevivientes} sobreviven · ${viejas} viejas · pruebas tras restaurar: ${restaurado === 0 ? 'verde' : 'ROJO'}`,
  )
  process.exit(sobrevivientes + viejas > 0 || restaurado !== 0 ? 1 : 0)
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) principal()
