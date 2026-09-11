/**
 * EL SOMBREADO DEL VISOR: los dos programas GLSL y cómo se compilan.
 *
 * Salió de `motor.ts` el 2026-09-08, tal cual y sin cambiarle una línea. El motor tenía
 * mil líneas y doscientas eran GLSL —otro lenguaje dentro de una plantilla de texto—, así
 * que buscar cómo se sube un búfer obligaba a pasar por delante de la iluminación entera.
 *
 * Aquí vive SOLO lo que corre en la tarjeta: el vértice (la piel colgada de su hueso), el
 * fragmento (luz, fibras, niebla y horneado) y el compilador que los convierte en shaders.
 * Lo que decide QUÉ se dibuja —búferes, tandas, órbita— sigue en `motor.ts`. Este módulo
 * no importa nada de él: no sabe que existe.
 */

import { GLSL_ACABADO } from '../../../domain/patrones/color'

/** Cuántas matrices de hueso caben en el shader. El esqueleto usa 22. */
export const MAX_HUESOS = 24

export const VS = `
attribute vec3 a_pos;
attribute vec3 a_nrm;
attribute vec3 a_col;
attribute float a_hueso;
attribute float a_fibra;
attribute float a_alfa;
attribute vec2 a_uv;
uniform mat4 u_huesos[${MAX_HUESOS}];
uniform mat4 u_vista;
uniform mat4 u_proyeccion;
varying vec3 v_nrm;
varying vec3 v_col;
varying vec3 v_mundo;
varying float v_fibra;
varying float v_alfa;
varying vec2 v_uv;
void main() {
  // El índice llega como float porque WebGL1 no tiene atributos enteros, y el
  // array de uniforms no admite indexación dinámica: de ahí el bucle.
  int bi = int(a_hueso + 0.5);
  mat4 B = u_huesos[0];
  for (int i = 1; i < ${MAX_HUESOS}; i++) { if (i == bi) B = u_huesos[i]; }
  vec4 p = B * vec4(a_pos, 1.0);
  v_mundo = p.xyz;
  v_nrm = normalize(mat3(B) * a_nrm);
  v_col = a_col;
  v_fibra = a_fibra;
  v_alfa = a_alfa;
  v_uv = a_uv;
  gl_Position = u_proyeccion * u_vista * p;
}`

export const FS = `
precision mediump float;
${GLSL_ACABADO}
varying vec3 v_nrm;
varying vec3 v_col;
varying vec3 v_mundo;
varying float v_fibra;
varying float v_alfa;
varying vec2 v_uv;
uniform vec3 u_ojo;
uniform float u_suelo;
// La imagen estampada sobre la malla, y si esta malla lleva alguna. Cuando no lleva, la
// textura enlazada es un píxel blanco y u_conTextura vale 0: el color queda tal cual.
uniform sampler2D u_textura;
uniform float u_conTextura;
// Si la luz ya viene grabada en el color: la pieza se enseña tal cual, sin volver a
// iluminarla. Solo se le suma la bruma de la distancia, que es de la sala y no de la luz.
uniform float u_horneada;
void main() {
  vec3 N = normalize(v_nrm);
  vec3 V = normalize(u_ojo - v_mundo);

  // El relieve de las fibras. v_fibra es la distancia recorrida A LO LARGO de
  // la fibra, así que un seno sobre ella dibuja los fascículos en su dirección
  // real: a lo largo en un fusiforme y oblicuos en un penado. Se perturba la
  // normal y no el color, porque una fibra se ve por cómo coge la luz y no
  // porque esté pintada; pintada se vería como una tela estampada.
  if (v_fibra != 0.0) {
    float onda = sin(v_fibra * 220.0);
    // Se inclina la normal sobre un eje transversal fijo. Podría sacarse la
    // dirección exacta con derivadas de pantalla, pero eso pide una extensión
    // de WebGL 1 que no está en todas partes, y el relieve se lee igual: la
    // ONDA ya va en la dirección de la fibra, que es lo que se quiere ver.
    vec3 eje = abs(N.y) > 0.9 ? vec3(1.0, 0.0, 0.0) : vec3(0.0, 1.0, 0.0);
    vec3 lateral = normalize(cross(N, eje));
    N = normalize(N + lateral * onda * 0.16);
  }
  // Los tubos abiertos no tienen dentro ni fuera: se gira la normal hacia quien mira.
  if (dot(N, V) < 0.0) N = -N;

  // Luz principal alta y a la derecha, relleno frío por la izquierda y un
  // contraluz que separa la figura del fondo al orbitar.
  vec3 L1 = normalize(vec3(0.55, 0.78, 0.62));
  vec3 L2 = normalize(vec3(-0.70, 0.10, 0.28));
  float d1 = max(dot(N, L1), 0.0);
  float d2 = max(dot(N, L2), 0.0) * 0.42;
  float envuelve = pow(max(dot(N, L1) * 0.5 + 0.5, 0.0), 1.6) * 0.36;
  float borde = pow(1.0 - max(dot(N, V), 0.0), 2.6);
  float brillo = pow(max(dot(N, normalize(L1 + V)), 0.0), 26.0) * 0.30;

  // Ambiente por hemisferios en vez de un gris plano: lo que mira hacia arriba
  // recibe cielo y lo que mira hacia abajo recibe rebote del suelo, más oscuro.
  // Es lo que da volumen a las cavidades sin necesidad de calcular oclusión: un
  // ambiente constante aplana la figura y la deja como un recorte.
  float cielo = N.y * 0.5 + 0.5;
  vec3 ambiente = aLineal(mix(vec3(0.126, 0.140, 0.162), vec3(0.300, 0.330, 0.372), cielo));

  // Oscurecimiento de contacto. Lo que está a ras de suelo recibe menos luz del
  // entorno porque el propio suelo se la tapa, y es lo que posa la figura en vez
  // de dejarla flotando. Se hace sobre el cuerpo y no proyectando una sombra en
  // el plano: la cámara mira casi a la altura del sujeto, así que una mancha en
  // el suelo se ve de canto y no aparece por muy grande y negra que sea.
  float contacto = clamp(v_mundo.y / 0.26, 0.0, 1.0);
  ambiente *= mix(1.0, 0.34 + 0.66 * contacto, u_suelo);

  // La superficie: el color del vértice POR la muestra de la imagen. Las dos se pasan a
  // lineal antes de multiplicar, que es donde la luz suma bien; una imagen JPEG viene en
  // gamma, como los colores de los vértices.
  vec3 muestraPantalla = texture2D(u_textura, v_uv).rgb;
  vec3 muestra = aLineal(muestraPantalla);
  vec3 base = aLineal(v_col) * mix(vec3(1.0), muestra, u_conTextura);
  vec3 c = base * (ambiente + d1 * 0.85 + envuelve)
         + base * d2 * vec3(0.72, 0.82, 1.0);
  c += vec3(1.0, 0.97, 0.92) * brillo;
  // EL CONTRALUZ ES DE LA FIGURA, no del escenario. Separa la silueta del fondo, y en un
  // cuerpo se ve en el borde. En un suelo visto de canto TODO es borde: medido el
  // 2026-09-05, sobre la goma aportaba 0,12 azulado donde la imagen aportaba 0,02 —cinco
  // veces más— y las juntas del suelo desaparecían bajo una lámina gris-azul. Lo que lleva
  // imagen es escenario, y el escenario no se recorta contra nada: sin contraluz.
  c += vec3(0.62, 0.72, 0.86) * borde * 0.30 * (1.0 - u_conTextura);

  // Bruma con la distancia: da profundidad sin ocultar nada.
  float niebla = clamp((length(u_ojo - v_mundo) - 1.6) / 4.2, 0.0, 1.0);
  c = mix(c, aLineal(vec3(0.300, 0.334, 0.376)), niebla * 0.40);

  // LO HORNEADO SALE TAL CUAL, y esto es lo que hace que la app enseñe la sala que se
  // aprobó en Blender y no una versión suya. Su color ya viene con la mirada de Blender
  // aplicada —AgX y su contraste—, así que:
  //
  //   - no se pasa a lineal ni se vuelve a mapear: el motor usa ACES, que es otra curva,
  //     y volver a comprimir unos blancos ya comprimidos apaga las tiras de LED;
  //   - no lleva niebla: la que se ve en el render ya está horneada en el color, y
  //     echarle otra encima lavaba el fondo de gris azulado.
  //
  // La textura se multiplica en el MISMO espacio en el que viene, sin pasar por lineal:
  // es el color de pantalla por la luz de pantalla, que es como se compone un horneado.
  vec3 horneado = v_col * mix(vec3(1.0), muestraPantalla, u_conTextura);

  gl_FragColor = vec4(mix(acabado(c), horneado, u_horneada), v_alfa);
}`

export function compilar(gl: WebGLRenderingContext, tipo: number, fuente: string): WebGLShader {
  const s = gl.createShader(tipo)
  if (!s) throw new Error('no se pudo crear el shader')
  gl.shaderSource(s, fuente)
  gl.compileShader(s)
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
    throw new Error('shader: ' + (gl.getShaderInfoLog(s) ?? ''))
  }
  return s
}
