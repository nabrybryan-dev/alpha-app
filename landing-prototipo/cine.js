// Independent picture/sound timeline. The audio clock drives both when playing.
export function crearDirector({THREE,camara,giro,alto,encuadrar,reducir,detenerVoz}) {
  const play=document.getElementById('cine-play'), panel=document.getElementById('cine-panel');
  const label=document.getElementById('cine-label'), progress=document.getElementById('cine-progress');
  const flash=document.getElementById('cine-flash');
  const pista=new Audio('./cine-preview.wav'); pista.preload='auto'; pista.volume=.72;
  let active=false,token=0,clock=0,silent=false,pausedAt=0,muted=false,manualPause=false;
  const target=new THREE.Vector3();
  // Seconds, target x/y relative to body height, distance, camera angle, label.
  const shots=[
    [0, .08,.80,.48, 18,'01 / MATERIA'],
    [2.4,.17,.51,.46, 8,'02 / TENSIÓN'],
    [4.5,0,.69,.84, 22,'03 / RESPIRACIÓN'],
    [6.7,0,.53,2.75, 12,'04 / REVELACIÓN'],
    [9.2,0,.52,2.75, 0,'05 / ANATOMÍA VIVA'],
    [12,0,.52,2.75,0,'']
  ];
  function stop(){token++;active=false;pista.pause();pista.currentTime=0;document.body.classList.remove('en-cine');panel.hidden=true;flash.style.opacity=0;encuadrar();}
  async function start(){
    if(play.disabled)return;
    stop();detenerVoz();window.scrollTo({top:0,behavior:'instant'});
    active=true;const attempt=++token;silent=false;pausedAt=0;manualPause=false;
    document.getElementById('cine-pause').textContent='Pausar';
    document.body.classList.add('en-cine');panel.hidden=false;
    camara.clearViewOffset();camara.updateProjectionMatrix();giro.rotation.y=0;
    pista.muted=muted;clock=performance.now();
    try {await pista.play();if(attempt!==token)pista.pause();}
    catch {if(attempt===token){silent=true;clock=performance.now();}}
  }
  play.addEventListener('click',start);
  document.getElementById('cine-skip').addEventListener('click',stop);
  document.getElementById('cine-pause').addEventListener('click',()=>{
    manualPause=!manualPause;
    document.getElementById('cine-pause').textContent=manualPause?'Continuar':'Pausar';
    if(manualPause){pista.pause();pausedAt=performance.now();}
    else{clock+=performance.now()-pausedAt;pausedAt=0;if(!silent)pista.play().catch(stop);}
  });
  progress.addEventListener('input',()=>{
    const t=Number(progress.value);pista.currentTime=t;
    clock=performance.now()-t*1000;if(manualPause)pausedAt=performance.now();
  });
  for(const event of ['wheel','touchmove'])addEventListener(event,()=>{if(active)stop();},{passive:true});
  addEventListener('keydown',e=>{if(active&&['Escape','PageDown','ArrowDown','End'].includes(e.key))stop();});
  document.addEventListener('visibilitychange',()=>{
    if(!active)return;
    if(document.hidden){pausedAt=performance.now();pista.pause();}
    else if(pausedAt&&!manualPause){clock+=performance.now()-pausedAt;pausedAt=0;if(!silent)pista.play().catch(stop);}
  });
  return {
    get active(){return active;},
    ready(){play.disabled=false;play.textContent='Ver entrada · 12 s';},
    mute(value){muted=value;pista.muted=value;},
    frame(now){
      if(!active)return false;
      const t=silent?((pausedAt||now)-clock)/1000:pista.currentTime;
      if(t>=12||pista.ended){stop();return false;}
      let i=0;while(i<shots.length-2&&t>=shots[i+1][0])i++;
      const a=shots[i],b=shots[i+1],f=Math.max(0,Math.min(1,(t-a[0])/(b[0]-a[0])));
      const H=alto(),motion=reducir?0:f*f*(3-2*f);
      // Cuts on 2.4,4.5,6.7; subtle push-in within each shot, then settle to hero.
      let d=H*a[3]*(1-motion*.045),angle=a[4]*Math.PI/180;
      if(i===4){angle*=1-motion;d=H*a[3];}
      if(innerWidth<760)d*=1.5;
      target.set(H*a[1],H*a[2],0);
      camara.clearViewOffset();
      if(i===4&&innerWidth>=760)camara.setViewOffset(innerWidth,innerHeight,-innerWidth*.22*motion,0,innerWidth,innerHeight);
      camara.updateProjectionMatrix();
      camara.position.set(target.x+Math.sin(angle)*d,target.y+H*.02,Math.cos(angle)*d);
      camara.lookAt(target);giro.rotation.y=0;
      label.textContent=a[5]+(silent?' · SIN AUDIO':'');progress.value=t;
      flash.style.opacity=reducir?0:Math.max(0,1-Math.abs(t-6.7)/.14)*.12;
      return true;
    }
  };
}
