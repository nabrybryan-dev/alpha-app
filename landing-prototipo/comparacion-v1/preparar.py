from pathlib import Path
import re, wave, math, random, array

root=Path(__file__).parent
s=(root/'original-v10.html').read_text(encoding='utf-8')
s=s.replace('<title>Sujeto Alpha</title>','<title>Alpha · Anatomía viva — prueba cinematográfica</title>')
s=s.replace('<canvas id="escena"','<link rel="stylesheet" href="./cine.css">\n<canvas id="escena"',1)
s=s.replace('import * as THREE from \'three\';',"import * as THREE from 'three';\nimport { crearDirector } from './cine.js';")
s=s.replace('Tu cuerpo no está estancado. <em>Tu estrategia sí.</em>','Entiende tu cuerpo.<em>Transforma tu entrenamiento.</em>',1)
s=s.replace('<span class="dato">Baja para abrirme · arrastra para girarme</span>', '''<p class="intro-copy">La anatomía detrás de cada movimiento. La precisión detrás de tu entrenamiento.</p>
      <div class="acciones"><button class="cine-play" id="cine-play" disabled>Preparando entrada…</button><a class="cine-link" href="#anatomia">Explorar anatomía ↗</a></div>
      <span class="cine-help">12 segundos · sonido cinematográfico</span>''',1)
s=s.replace('data-capitulo="1"','id="anatomia" data-capitulo="1"',1)
s=s.replace('<main>','''<div class="cine-flash" id="cine-flash" aria-hidden="true"></div>
<div class="cine-panel" id="cine-panel" hidden><span id="cine-label">01 / MATERIA</span><input type="range" id="cine-progress" min="0" max="11.95" step="0.01" value="0" aria-label="Posición de la entrada"><button id="cine-pause">Pausar</button><button id="cine-skip">Saltar entrada</button></div>
<main>''',1)
s=s.replace('esMusculo ? 0.55 : esPiel ? 0.25 : 0.18','esMusculo ? 0.20 : esPiel ? 0.12 : 0.12')
s=s.replace("esPiel ? '#9FB2C8' : esMusculo ? '#C8A8A0' : '#FF2A1E'","esPiel ? '#D8C9B1' : esMusculo ? '#AF9980' : '#BBA98F'")
s=s.replace('esPiel ? 0.5 : esMusculo ? 0.4 : 0.22','esPiel ? 0.12 : esMusculo ? 0.14 : 0.10')
s=s.replace('const mezcla = marca ? 0 : 0.25;','const mezcla = marca ? 0 : 0.04;')
s=s.replace("new THREE.Color('#7A2A22')","new THREE.Color('#80615D')")
s=s.replace('aRad * uMasa * 0.55','aRad * uMasa * 0.08')
s=s.replace('g.setIndex(new THREE.BufferAttribute(idx, 1));','g.setIndex(new THREE.BufferAttribute(idx, 1));\n  g.computeVertexNormals();')
s=s.replace("new THREE.Color('#8E939B')","new THREE.Color('#AF9380')")
s=s.replace('musc * 0.0011 + haz * musc * 0.0016','musc * 0.00022 + haz * musc * 0.00036')
s=s.replace('tend * (0.5 + 0.5 * fibra) * 0.0005','tend * (0.5 + 0.5 * fibra) * 0.00014')
s=s.replace('vec3(0.84, 0.80, 0.72)','vec3(0.57, 0.49, 0.38)')
s=s.replace('mix(0.38, 1.0','mix(0.65, 1.0')
s=s.replace('vec3(0.5, 0.8, 0.55)','vec3(-0.65, 0.65, 0.60)')
s=s.replace('vec3(0.16, 0.08, 0.07), vec3(0.20, 0.22, 0.27)','vec3(0.12, 0.105, 0.09), vec3(0.16, 0.20, 0.22)')
s=s.replace('vec3(0.55, 0.10, 0.06)','vec3(0.25, 0.09, 0.055)')
s=s.replace('vec3(1.05, 0.98, 0.92)','vec3(1.25, 1.08, 0.87)')
s=s.replace('mix(0.05, 0.16, tend)','mix(0.024, 0.065, tend)')
s=s.replace('fres * 0.04','fres * 0.012')
s=s.replace('renderer.setClearColor(0x08090B, 1);','renderer.setClearColor(0x101417, 1);')
s=s.replace('vec4(0.55,0.08,0.06, 0.35*smoothstep(0.5,0.0,d))','vec4(0.005,0.008,0.009, 0.8*(1.0-smoothstep(0.08,0.5,d)))')
s=s.replace('suelo.rotation.x = -Math.PI / 2; escena.add(suelo);','''suelo.rotation.x = -Math.PI / 2; suelo.position.y=.002; escena.add(suelo);
// Mineral studio: restrained tonal variation, architecture and a grounded floor.
function mineral(color){return new THREE.ShaderMaterial({uniforms:{base:{value:new THREE.Color(color)}},vertexShader:`varying vec3 p; void main(){p=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,fragmentShader:`uniform vec3 base;varying vec3 p;void main(){float grain=fract(sin(dot(floor(p.xy*450.),vec2(12.9898,78.233)))*43758.5453);float broad=.5+.5*sin(p.x*2.3+p.y*.5);gl_FragColor=vec4(base*(.82+grain*.16+broad*.2),1.);}`});}
const fondo=new THREE.Mesh(new THREE.PlaneGeometry(20,10),mineral('#343C3D'));fondo.position.set(0,3,-2.0);escena.add(fondo);
const piso=new THREE.Mesh(new THREE.PlaneGeometry(30,30),mineral('#454643'));piso.rotation.x=-Math.PI/2;piso.position.y=-.008;escena.add(piso);
for(const x of [1.3,2.1]){const columna=new THREE.Mesh(new THREE.BoxGeometry(.12,4,.18),new THREE.MeshBasicMaterial({color:'#292E30'}));columna.position.set(x,1.9,-1.85);escena.add(columna);}
const abertura=new THREE.Mesh(new THREE.PlaneGeometry(.10,3.5),new THREE.MeshBasicMaterial({color:'#A58761'}));abertura.position.set(1.68,1.8,-1.88);escena.add(abertura);''')
s=s.replace('[0.50, 1.95, 0.00, 0.0]','[0.52, 1.45, 0.00, 0.0]')
s=s.replace('movil ? 0 : -w * 0.16, movil ? h * 0.1 : 0','movil ? 0 : -w * 0.22, movil ? h * 0.15 : 0')
s=s.replace('Math.max(sujeto.scale.y, 0.9) * 1.9','Math.max(sujeto.scale.y, 0.9) * 1.9 * (innerWidth < 760 ? 1.6 : 1)')
s=s.replace('0.9 * piel','0.025 * piel')
s=s.replace('reducir ? 1 : Math.min(Math.max((t - a) / (b - a), 0), 1)','1')
s=s.replace('let entradaCortada = false;','let entradaCortada = true;')
s=s.replace("if (!arrastrando && !reducir) giroUsuario += 0.0012;","// Hero holds its angle; user drag still rotates the body.")
s=s.replace('camara.position.lerp(posCam, 0.06);','camara.position.lerp(posCam, 0.14);')
s=s.replace("for (const ev of ['pointerdown', 'keydown']) addEventListener(ev, primerToque, { once: false, passive: true });",'// Audio requires the explicit sound control; ordinary interactions stay quiet.')
s=s.replace("document.getElementById('voz-txt').textContent = on ? 'Sonido' : 'Silencio';","document.getElementById('voz-txt').textContent = on ? 'Silenciar' : 'Activar sonido';\n  director?.mute(!on);")
s=s.replace("<span id=\"voz-txt\">Sonido</span>","<span id=\"voz-txt\">Activar sonido</span>")
s=s.replace('mostrar(linea);','if (!vozActiva || director?.active) { mostrar(\'\'); return; }\n  mostrar(linea);',1)
s=s.replace('if (inicio) vozPorCapitulo();','if (inicio && !director?.active) vozPorCapitulo();')
s=s.replace("activar(!vozActiva); });","activar(!vozActiva); ultimoDicho = -1; });")
s=s.replace('renderer.render(escena, camara);','director?.frame(ahora);\n  renderer.render(escena, camara);')
s=s.replace('const reducir =', 'let director = null;\nconst reducir =',1)
s=s.replace("document.getElementById('cargando').hidden = true;","document.getElementById('cargando').hidden = true;\n  director?.ready();")
s=s.replace('encuadrar();\nleerMedidas();','''director=crearDirector({THREE,camara,giro,alto:()=>alto,encuadrar,reducir,detenerVoz:()=>{desbloqueada=true;activar(true);if(audio)audio.pause();if('speechSynthesis' in window)speechSynthesis.cancel();mostrar('');}});
encuadrar();
leerMedidas();''')
s=s.replace('<b>Prototipo para aprobar.</b>','<b>Prueba cinematográfica 01.</b> Diseño sonoro sintético provisional. ')
s=s.replace('La voz es provisional: la del navegador, hasta generar la de Bryan con su molde en el otro equipo.','Se conservan las pistas de voz del prototipo original, con voz del navegador como respaldo.')
(root/'index.html').write_text(s,encoding='utf-8')
# Original procedural sound design: restrained low impacts and filtered air swells.
random.seed(71); rate=48000; duration=12; result=array.array('h'); low=0.;highprev=0.
for k in range(rate*duration):
    t=k/rate; noise=random.uniform(-1,1);low=low*.94+noise*.06
    env=min(1,t/.5)*min(1,(duration-t)/1.6)
    bed=.009*low+.007*math.sin(2*math.pi*48*t)
    sound=bed
    for hit,strength in [(0.45,.08),(2.4,.12),(4.5,.095),(6.7,.22),(9.2,.065)]:
        dt=t-hit
        if -.35<dt<0:
            sound+=low*.20*((dt+.35)/.35)**2
        if 0<=dt<1.6:
            phase=2*math.pi*(46*dt+34*.055*(1-math.exp(-dt/.055)))
            sound+=strength*math.sin(phase)*math.exp(-dt*5)*min(1,dt/.007)
            sound+=low*strength*.8*math.exp(-dt*18)*min(1,dt/.003)
    for center in [1.4,3.6,5.65,8.1]:
        sound+=low*.055*math.exp(-((t-center)/.48)**2)
    sound*=env
    left=max(-.9,min(.9,sound*(1+.07*math.sin(t*.8))))
    right=max(-.9,min(.9,sound*(1-.07*math.sin(t*.8))))
    result.extend([int(left*32767),int(right*32767)])
with wave.open(str(root/'cine-preview.wav'),'wb') as w:
    w.setnchannels(2);w.setsampwidth(2);w.setframerate(rate);w.writeframes(result.tobytes())
print('Created index.html and 12-second stereo cine-preview.wav')
