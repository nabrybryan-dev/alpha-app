export const TOMAS_DETALLE=[
  {time:0,end:6.5,center:[.107,.794,-.015],radius:.41,start:0,arc:180,label:'01 / HOMBRO',title:'Un volumen. Varias direcciones.',
    description:'Clavícula, escápula y húmero forman el complejo del hombro. El deltoides participa en la elevación del brazo; el manguito rotador contribuye a estabilizar la cabeza humeral.',
    source:'https://openstax.org/books/anatomy-and-physiology-2e/pages/11-5-muscles-of-the-pectoral-girdle-and-upper-limbs'},
  {time:6.5,end:13,center:[.128,.641,-.012],radius:.36,start:0,arc:180,label:'02 / CODO E INSERCIONES',title:'Del tejido al movimiento.',
    description:'El bíceps participa en la flexión del codo y la supinación del antebrazo. El tríceps extiende el codo. Los tendones transmiten la fuerza muscular a los huesos.',
    source:'https://openstax.org/books/anatomy-and-physiology-2e/pages/11-5-muscles-of-the-pectoral-girdle-and-upper-limbs'},
  {time:13,end:19.5,center:[.055,.263,-.009],radius:.40,start:0,arc:180,label:'03 / RODILLA',title:'Relieves que cambian la palanca.',
    description:'Fémur, tibia y patela organizan esta articulación. La patela modifica la línea de acción del aparato extensor y mejora su ventaja mecánica.',
    source:'https://openstax.org/books/anatomy-and-physiology-2e/pages/9-6-anatomy-of-selected-synovial-joints'},
  {time:19.5,end:24,center:[0,.52,0],radius:2.75,start:28,arc:-28,label:'04 / ANATOMÍA VIVA',title:'La estructura explica el movimiento.',
    description:'Observa cómo cambian los volúmenes al cambiar el punto de vista. Puedes detenerte, elegir una región y descubrir su estructura ósea.',
    source:'https://openstax.org/books/anatomy-and-physiology-2e/pages/11-1-interactions-of-skeletal-muscles-their-fascicle-arrangement-and-their-lever-systems'}
];
const ease=t=>t*t*(3-2*t);
export function crearDirector({THREE,camara,giro,alto,capas,encuadrar,reducir,detenerVoz}){
  const el=id=>document.getElementById(id);
  const play=el('cine-play'),panel=el('cine-panel'),label=el('cine-label'),progress=el('cine-progress');
  const note=el('anatomia-nota'),nav=el('tomas-nav'),pause=el('cine-pause');
  const pista=new Audio('./cine-preview.wav');pista.preload='auto';pista.volume=.72;
  let active=false,token=0,clock=0,silent=false,pausedAt=0,manualPause=false,hiddenPause=false,muted=false;
  let reveal=false,detail=true,lastShot=-1;
  const target=new THREE.Vector3();
  const setPause=(state)=>{
    manualPause=state;pause.textContent=state?'Continuar':'Pausar';
    if(state){pista.pause();pausedAt=performance.now();}
    else{if(pausedAt)clock+=performance.now()-pausedAt;pausedAt=0;if(!silent)pista.play().catch(stop);}
  };
  function resetReveal(){for(const c of Object.values(capas))c.material.uniforms.uReveal.value=0;}
  function stop(){
    token++;active=false;pista.pause();pista.currentTime=0;lastShot=-1;
    document.body.classList.remove('en-cine');panel.hidden=true;note.hidden=true;nav.hidden=true;
    el('cine-flash').style.opacity=0;resetReveal();encuadrar();
  }
  async function start(){
    if(play.disabled)return;stop();detenerVoz();window.scrollTo({top:0,behavior:'instant'});
    active=true;const attempt=++token;silent=false;manualPause=false;pausedAt=0;hiddenPause=false;
    pause.textContent='Pausar';document.body.classList.add('en-cine');panel.hidden=false;note.hidden=false;nav.hidden=false;
    camara.clearViewOffset();camara.updateProjectionMatrix();giro.rotation.y=0;
    pista.muted=muted;clock=performance.now();
    try{await pista.play();if(attempt!==token)pista.pause();}
    catch{if(attempt===token){silent=true;clock=performance.now();}}
  }
  function seek(t){pista.currentTime=t;clock=performance.now()-t*1000;if(manualPause||hiddenPause)pausedAt=performance.now();}
  play.addEventListener('click',start);el('cine-skip').addEventListener('click',stop);
  pause.addEventListener('click',()=>setPause(!manualPause));
  progress.addEventListener('input',()=>seek(Number(progress.value)));
  for(const b of nav.querySelectorAll('button'))b.addEventListener('click',()=>{seek(Number(b.dataset.toma));setPause(true);});
  el('cine-bone').addEventListener('click',()=>{
    reveal=!reveal;el('cine-bone').setAttribute('aria-pressed',String(reveal));
    el('cine-bone').textContent=reveal?'Restaurar músculos':'Ver profundidad ósea';
  });
  el('cine-detail').addEventListener('click',()=>{
    detail=!detail;el('cine-detail').setAttribute('aria-pressed',String(detail));el('cine-detail').textContent=detail?'Microfibras: sí':'Microfibras: no';
    for(const c of Object.values(capas))c.material.uniforms.uDetalle.value=detail?1:0;
  });
  for(const event of ['wheel','touchmove'])addEventListener(event,e=>{
    if(active&&!e.target.closest?.('.cine-panel,.tomas-nav,.anatomia-nota'))stop();
  },{passive:true});
  addEventListener('keydown',e=>{
    if(e.target===progress)return;
    if(active&&['Escape','PageDown','ArrowDown','End'].includes(e.key))stop();
  });
  document.addEventListener('visibilitychange',()=>{
    if(!active)return;
    if(document.hidden){hiddenPause=true;if(!manualPause){pausedAt=performance.now();pista.pause();}}
    else if(hiddenPause){hiddenPause=false;if(!manualPause){clock+=performance.now()-pausedAt;pausedAt=0;if(!silent)pista.play().catch(stop);}}
  });
  return{
    get active(){return active;},
    ready(){play.disabled=false;play.textContent='Recorrido 180° · 24 s';},
    mute(value){muted=value;pista.muted=value;},
    frame(now){
      if(!active)return false;
      const t=silent?((pausedAt||now)-clock)/1000:pista.currentTime;
      if(t>=24||pista.ended){stop();return false;}
      let i=TOMAS_DETALLE.findIndex(a=>t<a.end);if(i<0)i=3;
      const a=TOMAS_DETALLE[i],fraction=Math.max(0,Math.min(1,(t-a.time)/(a.end-a.time)));
      const f=reducir?.5:ease(fraction),H=alto();
      const angle=(a.start+a.arc*f)*Math.PI/180;
      let d=H*a.radius*(1-(reducir?0:.04*Math.sin(fraction*Math.PI)));
      if(innerWidth<760)d*=1.35;
      target.set(...a.center).multiplyScalar(H);
      camara.clearViewOffset();
      // Main image stays centered; explanatory panel sits at the right edge.
      if(innerWidth>=760&&i<3)camara.setViewOffset(innerWidth,innerHeight,innerWidth*.10,0,innerWidth,innerHeight);
      if(i===3&&innerWidth>=760)camara.setViewOffset(innerWidth,innerHeight,-innerWidth*.20*f,0,innerWidth,innerHeight);
      camara.updateProjectionMatrix();
      camara.position.set(target.x+Math.sin(angle)*d,target.y+H*.024*Math.sin(f*Math.PI),target.z+Math.cos(angle)*d);
      camara.lookAt(target);giro.rotation.y=0;
      for(const [name,c]of Object.entries(capas)){
        c.material.uniforms.uReveal.value=reveal&&i<3&&name==='musculo'?1:0;
        c.material.uniforms.uRevealCenter.value.copy(target);
        c.material.uniforms.uRevealRadius.value=i===0?.20:.16;
      }
      if(capas.piel)capas.piel.visible=false;
      if(lastShot!==i){
        lastShot=i;el('anatomia-region').textContent=a.label;
        el('anatomia-titulo').textContent=a.title;el('anatomia-funcion').textContent=a.description;el('anatomia-fuente').href=a.source;
        for(const b of nav.querySelectorAll('button'))b.setAttribute('aria-pressed',String(Number(b.dataset.toma)===a.time));
      }
      label.textContent=a.label+' · '+Math.round(a.arc===180?180*f:0)+'°'+(silent?' · SIN AUDIO':'');
      progress.value=t;el('cine-flash').style.opacity=0;
      return true;
    }
  };
}
