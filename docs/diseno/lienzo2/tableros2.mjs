import { writeFileSync } from 'fs'
import { cam, rad } from './escena.mjs'
import { bahia, barraEnEspalda, cadena, hierro, huesos, lienzo, musculos, piel, pintar, sala, tendones } from './salon.mjs'

const SALIDA = 'C:/Users/ASUS/dev/alpha-salon/docs/diseno/lienzo2/'

// ── LA ESCENA: la sala se pinta entera y el sujeto va después, sobre un velo ──
function escena(o) {
  const k = cam(rad(o.th))
  const R = lienzo()
  sala(R, k); hierro(R, k); bahia(R, k, { estacion: o.estacion !== false })
  // El contraluz: la misma silueta un pelo más gorda y en tono claro, DEBAJO del
  // cuerpo. Sin él la figura es tan oscura como la sala y se funde con ella.
  // Tres capas y no una sola pila ordenada por profundidad: el contraluz, la
  // silueta y la anatomía. Si la anatomía compitiera en z con su propia silueta,
  // el cuerpo se taparía a sí mismo — y atravesar el eje W es ver DENTRO.
  const C = lienzo(), G = lienzo(), S = lienzo()
  piel(C, k, { infl: 0.009, col: o.capa === 'piel' ? '#41505f' : '#252d38' })
  const FONDO = { superficial: '#20262f', profundo: '#1c222b', tendon: '#1a202a', hueso: '#171d26' }
  if (o.capa === 'piel') piel(G, k)
  else piel(G, k, { col: FONDO[o.capa] })
  if (o.capa === 'superficial' || o.capa === 'profundo') musculos(S, k, o.capa)
  else if (o.capa === 'tendon') tendones(S, k)
  else if (o.capa === 'hueso') huesos(S, k)
  if (o.barra) barraEnEspalda(S, k)
  if (o.cadena) cadena(S, k)
  const velo = o.capa === 'piel' ? '' :
    `<rect x="0" y="0" width="360" height="640" fill="#05070a" opacity="${o.capa === 'hueso' ? 0.6 : 0.48}"/>` +
    `<rect x="0" y="0" width="360" height="640" fill="url(#malla)"/>`
  return `<svg viewBox="0 0 360 640" preserveAspectRatio="xMidYMid slice" class="lona" role="presentation">${DEFS}` +
    pintar(R) + velo + pintar(C) + pintar(G) + pintar(S) + '</svg>'
}

const DEFS = `<defs>
<pattern id="malla" width="24" height="24" patternUnits="userSpaceOnUse">
<path d="M 24 0 L 0 0 0 24" fill="none" stroke="#6f7782" stroke-opacity=".1" stroke-width=".5"/></pattern>
</defs>`

// ── EL EJE W: los cinco escalones, con el icono de cada uno ──────────────────
const IC = {
  piel: '<path d="M12 3.4a2 2 0 1 1 0 4 2 2 0 0 1 0-4M8.4 9.2h7.2l1.3 5.4h-2.1V21h-5.6v-6.4H7.1z"/>',
  superficial: '<path d="M12 3.4a2 2 0 1 1 0 4 2 2 0 0 1 0-4M9 9.4h6l1.1 5h-1.7V21H9.6v-6.6H7.9z"/><path d="M10.4 11.2h3.2M10.6 13.1h2.8M10.8 16.6h2.4M10.9 18.4h2.2" stroke-width="1"/>',
  profundo: '<path d="M12 3.4a2 2 0 1 1 0 4 2 2 0 0 1 0-4M9 9.4h6l1.1 5h-1.7V21H9.6v-6.6H7.9z"/><path d="M12 9.9v10.6" stroke-width="1"/><path d="M10.6 12.2c.9.9.9 2.4 0 3.3M13.4 12.2c-.9.9-.9 2.4 0 3.3" stroke-width="1"/>',
  tendon: '<path d="M7.6 3.6v4.2c0 2 1.1 2.8 2.2 4s2.2 2 2.2 4v4.6"/><path d="M16.4 3.6v4.2c0 2-1.1 2.8-2.2 4"/><circle cx="12" cy="11.8" r="1.5"/><circle cx="12" cy="20.4" r="1.5"/>',
  hueso: '<path d="M12 3.6v16.8"/><path d="M9.4 5.4h5.2M9.1 8.4h5.8M8.8 11.4h6.4M9.1 14.4h5.8M9.6 17.4h4.8"/>',
}
const CAPAS = [
  { id: 'piel', n: 'Piel' }, { id: 'superficial', n: 'M\u00fasculo superficial' },
  { id: 'profundo', n: 'M\u00fasculo profundo' }, { id: 'tendon', n: 'Tend\u00f3n' }, { id: 'hueso', n: 'Hueso' },
]
const ejeW = (activa) => `<div class="ejew" role="group" aria-label="Eje W: capa del cuerpo">` +
  CAPAS.map((c, i) => `<button type="button" class="wb${c.id === activa ? ' wb--on' : ''}" aria-pressed="${c.id === activa}" title="${c.n}">` +
    `<svg viewBox="0 0 24 24" aria-hidden="true">${IC[c.id]}</svg>` +
    `<span class="wb-n">${i}</span></button>`).join('') + `</div>`

// ── LA PANTALLA ─────────────────────────────────────────────────────────────
function pantalla(o) {
  const capa = CAPAS.find((c) => c.id === o.capa)
  return `
<div class="tel">
  <div class="lienzo">${escena(o)}</div>
  <div class="luzsala"></div><div class="contraluz"></div><div class="dof"></div><div class="grano"></div>
  <header class="hud">
    <div>
      <p class="kick kick--rojo">EN CURSO</p>
      <p class="tit">Sentadilla trasera</p>
    </div>
    <div class="der">
      <p class="kick">SERIE</p>
      <p class="serie">3<span>/4</span></p>
    </div>
  </header>
  <p class="capa">${o.capa === 'piel' ? '' : '<i></i>'}${capa.n.toUpperCase()}<b>W ${CAPAS.findIndex((c) => c.id === o.capa)}</b></p>
  ${ejeW(o.capa)}
  <p class="azim"><svg viewBox="0 0 26 26" aria-hidden="true"><circle cx="13" cy="13" r="10"/><path d="M13 13 L ${(13 + 9 * Math.sin(rad(o.th))).toFixed(1)} ${(13 - 9 * Math.cos(rad(o.th))).toFixed(1)}" class="aguja"/></svg>${o.th}\u00b0</p>
  <div class="pie">
    <p class="lectura">${o.lectura}</p>
    <div class="registro">
      <div class="prox">
        <span class="kick kick--rojo">SIGUIENTE SERIE</span>
        <span class="cifra">82,5 kg <b>\u00b7</b> 6 reps <b>\u00b7</b> RIR 2</span>
      </div>
      <button class="guardar" type="button">REGISTRAR<span>3</span></button>
    </div>
  </div>
  <nav class="nav">
    <span class="ni"><svg viewBox="0 0 24 24"><path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/></svg>Hoy</span>
    <span class="ni ni--on"><svg viewBox="0 0 24 24"><path d="M4 9v6M20 9v6M7 6v12M17 6v12M7 12h10"/></svg>Entrenar</span>
    <span class="ni"><svg viewBox="0 0 24 24"><path d="M4 19V5M4 19h16M8 16V9M13 16v-4M18 16V6"/></svg>Progreso</span>
    <span class="ni"><svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M4.5 20a7.5 7.5 0 0 1 15 0"/></svg>Perfil</span>
  </nav>
</div>`
}

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Archivo:wght@600;700&family=Hanken+Grotesk:wght@400;500;600;700&family=JetBrains+Mono:wght@500;600&display=swap');
body { margin: 0; font-family: 'Hanken Grotesk', system-ui, sans-serif; background: #000; }
a { color: #ff1e1e; } a:hover { color: #c8121a; }
.tel { position: relative; width: 390px; height: 844px; overflow: hidden; background: #05070a; color: #f4f5f6; }
.lienzo, .lona { position: absolute; inset: 0; width: 100%; height: 100%; }
.luzsala, .contraluz, .dof, .grano { position: absolute; inset: 0; pointer-events: none; }
.luzsala { mix-blend-mode: soft-light;
  background: radial-gradient(34% 20% at 50% 9%, rgba(255,255,255,.42) 0%, transparent 74%),
              radial-gradient(44% 36% at 86% 88%, rgba(150,170,200,.18) 0%, transparent 76%); }
.contraluz { mix-blend-mode: screen;
  background: radial-gradient(52% 22% at 50% 47%, rgba(255,30,30,.16) 0%, rgba(255,30,30,.06) 48%, transparent 76%); }
.dof { background: linear-gradient(to bottom, rgba(0,0,0,.4) 0%, rgba(0,0,0,.02) 12%, transparent 30%, transparent 64%, rgba(0,0,0,.74) 100%); }
.grano { opacity: .07; mix-blend-mode: overlay; background-size: 140px 140px;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='g'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3'/%3E%3C/filter%3E%3Crect width='140' height='140' filter='url(%23g)' opacity='0.55'/%3E%3C/svg%3E"); }
.hud { position: absolute; top: 14px; left: 14px; right: 14px; display: flex; justify-content: space-between; align-items: flex-start; }
.hud .der { text-align: right; }
.kick { margin: 0; font-size: 7.5px; font-weight: 700; text-transform: uppercase; letter-spacing: .22em; line-height: 1; color: #6f7782; }
.kick--rojo { color: #ff1e1e; }
.tit { margin: 5px 0 0; font-family: Archivo, system-ui, sans-serif; font-size: 15px; font-weight: 600; text-transform: uppercase; letter-spacing: .01em; line-height: 1; color: #f4f5f6; }
.serie { margin: 4px 0 0; font-family: 'JetBrains Mono', ui-monospace, monospace; font-size: 18px; font-weight: 600; line-height: 1; color: #f4f5f6; }
.serie span { font-size: 10px; color: #6f7782; }
.capa { position: absolute; top: 62px; left: 14px; margin: 0; display: flex; align-items: center; gap: 7px;
  font-size: 8px; font-weight: 700; letter-spacing: .2em; color: #9aa1ab; }
.capa i { width: 5px; height: 5px; border-radius: 999px; background: #ff1e1e; box-shadow: 0 0 8px #ff1e1e; }
.capa b { font-family: 'JetBrains Mono', ui-monospace, monospace; font-weight: 600; letter-spacing: .04em; color: #6f7782; }
.azim { position: absolute; top: 58px; right: 14px; margin: 0; display: flex; align-items: center; gap: 5px;
  font-family: 'JetBrains Mono', ui-monospace, monospace; font-size: 9px; font-weight: 600; color: #6f7782; }
.azim svg { width: 15px; height: 15px; fill: none; stroke: currentColor; stroke-width: 1.4; }
.azim .aguja { stroke: #ff1e1e; stroke-width: 2; stroke-linecap: round; }
.ejew { position: absolute; right: 10px; top: 50%; transform: translateY(-50%); display: flex; flex-direction: column; gap: 10px; }
.wb { position: relative; display: grid; place-items: center; width: 40px; height: 40px; padding: 0;
  border: 1px solid rgba(255,255,255,.13); border-radius: 999px; background: rgba(8,10,13,.5); color: #7f8894; }
.wb svg { width: 21px; height: 21px; fill: none; stroke: currentColor; stroke-width: 1.4; stroke-linecap: round; stroke-linejoin: round; }
.wb-n { position: absolute; right: -1px; bottom: -1px; font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-size: 7px; font-weight: 600; color: #4c545f; }
.wb--on { border-color: #ff1e1e; color: #ff5a4f; background: rgba(255,30,30,.1); box-shadow: 0 0 14px rgba(255,30,30,.3); }
.wb--on .wb-n { color: #ff1e1e; }
.pie { position: absolute; left: 12px; right: 12px; bottom: 92px; }
.lectura { margin: 0 2px 8px; font-size: 9.5px; font-weight: 500; line-height: 1.35; letter-spacing: .02em; color: #9aa1ab; }
.registro { display: flex; gap: 6px; align-items: stretch; }
.prox { flex: 1; min-width: 0; display: flex; flex-direction: column; justify-content: center; gap: 5px;
  border: 1px solid rgba(255,30,30,.32); border-radius: 12px; background: rgba(8,10,13,.82); padding: 9px 12px; }
.cifra { font-family: 'JetBrains Mono', ui-monospace, monospace; font-size: 12px; font-weight: 600; line-height: 1; color: #f4f5f6; }
.cifra b { color: #6f7782; font-weight: 500; margin: 0 4px; }
.guardar { border: 0; background: #ff1e1e; color: #fff; border-radius: 12px; padding: 0 14px; min-height: 48px;
  font-family: Archivo, system-ui, sans-serif; font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: .03em; }
.guardar span { font-family: 'JetBrains Mono', ui-monospace, monospace; margin-left: 6px; }
.nav { position: absolute; left: 0; right: 0; bottom: 0; height: 78px; padding-bottom: 14px; display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr)); align-items: center;
  border-top: 1px solid rgba(255,255,255,.07); background: rgba(5,7,10,.9); }
.ni { display: flex; flex-direction: column; align-items: center; gap: 4px; font-size: 9.5px; font-weight: 600; color: #6f7782; }
.ni--on { color: #f4f5f6; }
.ni svg { width: 20px; height: 20px; fill: none; stroke: currentColor; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; }
`

const tablero = (o) => '<!doctype html>\n<html>\n<head>\n<meta charset="utf-8">\n<script src="./support.js"><' +
  '/script>\n</head>\n<body>\n<x-dc>\n<helmet>\n<style>' + CSS + '</style>\n</helmet>\n' + pantalla(o) + '\n</x-dc>\n</body>\n</html>\n'

const ESCENAS = {
  'Main.dc.html': { th: 0, capa: 'piel', lectura: 'De pie en la marca, mirando a la estaci\u00f3n. La sala es el mismo espacio en las cinco capas: al bajar por el eje W no cambia la habitaci\u00f3n, cambia lo que se ve DE \u00c9L.' },
  'Orbita.dc.html': { th: 48, capa: 'piel', lectura: 'Arrastrar en horizontal gira la sala entera: jaula, discos, banco, luminarias y estaci\u00f3n. Nada queda fijo detr\u00e1s del cuerpo.' },
  'W1.dc.html': { th: 0, capa: 'superficial', lectura: 'AGONISTA cu\u00e1driceps y gl\u00fateo mayor \u00b7 SINERGISTA isquiosurales, erector espinal, gastrocnemio. Lo apagado no participa en este patr\u00f3n.' },
  'W2.dc.html': { th: 12, capa: 'profundo', lectura: 'AGONISTA psoas il\u00edaco y gl\u00fateo medio \u00b7 SINERGISTA aductor mayor, s\u00f3leo, multi\u0301fidos. Es la capa que sostiene la pelvis cuando el peso sube.' },
  'W3.dc.html': { th: 0, capa: 'tendon', lectura: 'Rotuliano, cuadricipital y aqu\u00edleo bajo carga; c\u00e1psula de cadera, rodilla y tobillo. Aqu\u00ed se paga el rango completo que exige el m\u00e9todo.' },
  'W4.dc.html': { th: 0, capa: 'hueso', lectura: 'Cadera 95\u00b0 \u00b7 rodilla 88\u00b0 \u00b7 tobillo 24\u00b0. El \u00e1ngulo articular es lo \u00fanico que no admite interpretaci\u00f3n.' },
  'Cadena.dc.html': { th: 22, capa: 'hueso', cadena: true, barra: true, lectura: 'La carga baja de la barra al suelo por la cadena. Brazo de momento en rodilla 11 cm, en cadera 7 cm: eso es lo que mide el encoder desde la estaci\u00f3n.' },
  'Estacion.dc.html': { th: -84, capa: 'piel', lectura: 'El sitio marcado en el suelo es donde va el m\u00f3vil de verdad: mismo \u00e1ngulo, misma distancia, misma altura. Girar hasta aqu\u00ed es ensayar el encuadre antes de plantar el tr\u00edpode.' },
}
for (const n of Object.keys(ESCENAS)) writeFileSync(SALIDA + n, tablero(ESCENAS[n]), 'utf8')

// Una hoja plana para mirarla en el navegador antes de publicar nada.
writeFileSync(SALIDA + 'previa.html',
  '<!doctype html><meta charset="utf-8"><style>' + CSS +
  'body{background:#000;display:flex;gap:18px;padding:18px;overflow-x:auto}figure{margin:0}' +
  'figcaption{color:#9aa1ab;font-size:11px;padding:6px 2px;font-family:sans-serif}</style>' +
  Object.keys(ESCENAS).map((n) => '<figure>' + pantalla(ESCENAS[n]) + '<figcaption>' + n + '</figcaption></figure>').join(''),
  'utf8')

const AN = 390, AL = 844, GX = 470, GY = 990
const pos = { 'Main.dc.html': [0, 0], 'Orbita.dc.html': [1, 0], 'Estacion.dc.html': [2, 0], 'Cadena.dc.html': [3, 0],
  'W1.dc.html': [0, 1], 'W2.dc.html': [1, 1], 'W3.dc.html': [2, 1], 'W4.dc.html': [3, 1] }
const titulo = { 'Main.dc.html': 'El sal\u00f3n \u00b7 piel', 'Orbita.dc.html': 'Orbitado 48\u00b0',
  'Estacion.dc.html': 'La estaci\u00f3n', 'Cadena.dc.html': 'La cadena cin\u00e9tica',
  'W1.dc.html': 'W1 \u00b7 m\u00fasculo superficial', 'W2.dc.html': 'W2 \u00b7 m\u00fasculo profundo',
  'W3.dc.html': 'W3 \u00b7 tend\u00f3n', 'W4.dc.html': 'W4 \u00b7 hueso' }

writeFileSync(SALIDA + 'canvas.json', JSON.stringify({
  artboards: Object.keys(ESCENAS).map((f) => ({ file: f, title: titulo[f], x: pos[f][0] * GX, y: pos[f][1] * GY, w: AN, h: AL })),
  annotations: [
    { id: 'fila-sala', x: -430, y: 0, w: 380,
      text: 'FILA 1 — LA SALA ES REAL\n\nUna bahía de medida amueblada: jaula con la barra en los ganchos, árbol de discos, banco, mancuernas, panelado de muro, luminarias corriendo hacia el fondo y dos tiras rojas.\n\nTodo eso vive en el motor, en metros, y pasa por la misma proyección que el sujeto. Por eso al orbitar gira la habitación entera y no queda telón pintado detrás del cuerpo.\n\nY las marcas rojas del suelo no son decoración: son el cajón de los pies, los carriles y la circunferencia de la estación de grabación.' },
    { id: 'fila-w', x: -430, y: GY, w: 380,
      text: 'FILA 2 — LA CUARTA DIMENSIÓN\n\nArrastrar en vertical no cambia de pantalla: atraviesa el cuerpo. La sala se queda donde está y se apaga; lo que cambia es a qué profundidad se está mirando al mismo sujeto, en la misma postura, en el mismo sitio de la sala.\n\nCada escalón dice lo que prescribe, no lo que se llama: agonista en carmín, sinergista en coral, pasivo apagado. Eso es lo que quiere decir que el sujeto ES la prescripción.' },
    { id: 'cadena', x: 3 * GX, y: -300, w: 390,
      text: 'LA CADENA CINÉTICA\n\nEs el único tablero donde la barra va sobre los trapecios: el implemento pertenece al sujeto, no a la sala.\n\nLa línea blanca es la vertical de la carga; los dos tramos rojos cortos son los brazos de momento en rodilla y cadera. Eso es exactamente lo que el encoder mide desde la estación, y es la razón de que el sitio del móvil esté marcado en el suelo.' },
    { id: 'estacion', x: 2 * GX, y: -300, w: 390,
      text: 'LA ESTACIÓN NO ES UN ADORNO\n\nOrbitar hasta el trípode pone la cámara donde va a estar el teléfono: mismo ángulo, misma distancia, misma altura. El juicio del encuadre lo hace calificarEncuadre() del núcleo del encoder, no una copia.\n\nDos puertas que nacen iguales se separan al primer ajuste, y entonces el ensayo enseñaría a plantar el móvil donde la medición ya no lo admite.' },
  ],
  launch: { view: 'canvas' },
}, null, 1), 'utf8')
console.log('escritos ' + Object.keys(ESCENAS).length + ' tableros + previa + canvas.json')
