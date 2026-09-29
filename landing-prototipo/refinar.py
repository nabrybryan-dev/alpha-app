from pathlib import Path
ROOT=Path(__file__).parent

def aplicar(s):
    s=s.replace("from './cine.js'","from './director-detalle.js'")
    s=s.replace('Prueba cinematográfica 01.','Prueba cinematográfica 02.')
    s=s.replace('12 segundos · sonido cinematográfico','Hombro · codo · rodilla · recorridos de 180°')
    s=s.replace('max="11.95"','max="23.95"')
    s=s.replace('<button id="cine-pause">','<button id="cine-bone" aria-pressed="false">Ver profundidad ósea</button><button id="cine-detail" aria-pressed="true">Microfibras: sí</button><button id="cine-pause">')
    s=s.replace('<main>','''<aside id="anatomia-nota" class="anatomia-nota" hidden><span id="anatomia-region"></span><h2 id="anatomia-titulo"></h2><p id="anatomia-funcion"></p><a id="anatomia-fuente" target="_blank" rel="noopener">Referencia anatómica ↗</a><small>Relieve de fibras ilustrativo · no representa fuerzas calculadas</small></aside>
<nav class="tomas-nav" id="tomas-nav" hidden aria-label="Tomas anatómicas"><button data-toma="0">Hombro</button><button data-toma="6.5">Codo</button><button data-toma="13">Rodilla</button><button data-toma="19.5">Conjunto</button></nav><main>''',1)
    # Correct source-count statements: pieces are not the total number of human muscles/bones.
    s=s.replace('402 músculos. <em>Entrenas los que ves.</em>','Músculo y tendón.<em>La fuerza se transmite.</em>')
    s=s.replace('<b>402</b> vientres musculares · en blanco, <b>dónde se insertan</b>','Fascículos, tejido tendinoso y <b>continuidad de las estructuras</b>')
    s=s.replace('296 palancas. <em>La técnica decide.</em>','Huesos y articulaciones.<em>La estructura del movimiento.</em>')
    s=s.replace('<b>296</b> huesos · el músculo se aparta para dejarlos ver','Explora <b>relieves y superficies óseas</b>')
    s=s.replace('Tengo cuatrocientos dos músculos. Y cada uno se agarra al hueso por un tendón. Si siempre entrenas igual, cargas siempre los mismos.','La fuerza nace en el músculo y se transmite por el tejido tendinoso. Observa cómo se relacionan sus estructuras.')
    s=s.replace('Debajo, doscientos noventa y seis huesos. Son palancas. Cómo te mueves decide qué músculo trabaja de verdad.','Debajo están los huesos y las articulaciones. Su geometría forma parte de la mecánica del movimiento.')
    s=s.replace('if (await hayMp3.get(ruta)) {','if (![2,3].includes(i) && await hayMp3.get(ruta)) {')
    # New attributes carry baked occlusion and local fiber coordinates.
    s=s.replace('pos += 2 + largo + relleno(2 + largo);','const nombre=new TextDecoder().decode(new Uint8Array(buf,pos+2,largo));\n    pos += 2 + largo + relleno(2 + largo);')
    s=s.replace('partes.push({ posicion, normal, color, indice });','partes.push({ nombre, posicion, normal, color, indice });')
    s=s.replace('const ten = new Float32Array(nV);','const ten = new Float32Array(nV),fan=new Float32Array(nV),foco=new Float32Array(nV*3);')
    s=s.replace('const s = Math.random();','''const s = ((ov*16807+97)%65521)/65521;
    const esAbanico=tipo==='musculo' && /pectoralis major/i.test(p.nombre||'');
    const focus=new THREE.Vector3(cx,cy,cz);
    if(esAbanico){
      let extremo=0;for(let j=0;j<n;j++)extremo=Math.max(extremo,Math.abs(p.posicion[j*3]));
      let count=0;focus.set(0,0,0);
      for(let j=0;j<n;j++)if(Math.abs(p.posicion[j*3])>extremo-.012){focus.x+=p.posicion[j*3];focus.y+=p.posicion[j*3+1];focus.z+=p.posicion[j*3+2];count++;}
      if(count)focus.divideScalar(count);else focus.set(cx,cy,cz);
    }''')
    s=s.replace('sem[ov + i] = s;','sem[ov + i] = s;fan[ov+i]=esAbanico?1:0;foco.set(focus.toArray(),k);')
    s=s.replace("g.setAttribute('aTen',", "g.setAttribute('aFan',new THREE.BufferAttribute(fan,1));g.setAttribute('aFoco',new THREE.BufferAttribute(foco,3));\n  g.setAttribute('aTen',",1)
    s=s.replace('attribute vec3 aDir;', 'attribute float aAO; varying float vAO; varying float vRad; varying vec3 vLocal; varying vec3 vWorld; attribute vec3 aDir;',1)
    s=s.replace('attribute float aAO;','attribute float aFan;attribute vec3 aFoco;varying float vFan;varying vec3 vFocal;attribute float aAO;',1)
    s=s.replace('vC = color;', 'vAO=aAO; vRad=aRad; vLocal=position-aCen; vWorld=(modelMatrix*vec4(p,1.)).xyz; vC = color;',1)
    s=s.replace('vAO=aAO;','vFan=aFan;vFocal=position-aFoco;vAO=aAO;',1)
    start=s.index('    fragmentShader: `',s.index('function capaDesde'))
    end=s.index('`,\n    vertexColors: true',start)
    s=s[:start]+'    fragmentShader: `\n'+(ROOT/'tejido.frag').read_text(encoding='utf-8')+s[end:]
    s=s.replace('uLlegada: { value: 0 }','''uDetalle: {value:1}, uKeyView:{value:new THREE.Vector3(-.65,.65,.6)},uFillView:{value:new THREE.Vector3(.8,.2,-.4)},
      uReveal:{value:0},uRevealCenter:{value:new THREE.Vector3()},uRevealRadius:{value:.19},uLlegada: { value: 0 }''',1)
    s=s.replace("g.setAttribute('position',", "g.setAttribute('aAO',new THREE.BufferAttribute(new Float32Array(nV).fill(1),1));\n  g.setAttribute('position',",1)
    # Stable part variation allows comparisons and screenshots to be reproducible.
    s=s.replace('const s = Math.random();','const s = ((ov*16807+97)%65521)/65521;')
    s=s.replace("document.getElementById('cargando').hidden = true;",'''if(conZ){
    for(const name of ['musculo','hueso']){
      const response=await fetch(`piezas/detalle-${name}.bin`);
      if(!response.ok)throw new Error('Falta detalle '+name);
      const values=new Float32Array(await response.arrayBuffer());
      if(values.length!==capas[name].geometry.attributes.position.count)throw new Error('Detalle incompatible '+name);
      capas[name].geometry.setAttribute('aAO',new THREE.BufferAttribute(values,1));
    }
  }
  document.getElementById('cargando').hidden = true;''',1)
    s=s.replace('const _M = new THREE.Matrix4();','const _M = new THREE.Matrix4();\nconst luzKey=new THREE.Vector3(),luzFill=new THREE.Vector3();')
    s=s.replace('renderer.render(escena, camara);','''camara.updateMatrixWorld();
  luzKey.set(-.65,.65,.60).transformDirection(camara.matrixWorldInverse);
  luzFill.set(.8,.2,-.4).transformDirection(camara.matrixWorldInverse);
  for(const c of Object.values(capas)){c.material.uniforms.uKeyView.value.copy(luzKey);c.material.uniforms.uFillView.value.copy(luzFill);}
  renderer.render(escena, camara);''')
    s=s.replace('alto:()=>alto,encuadrar','alto:()=>alto,capas,encuadrar')
    s=s.replace('Las inserciones se dibujan en los extremos de cada músculo: en la fuente anatómica el tendón viene unido a su vientre en una sola pieza.','El atlas conserva regiones tendinosas. Las microfibras son una representación visual procedural; el corte óseo es una ventana de inspección, no una disección física.')
    return s
