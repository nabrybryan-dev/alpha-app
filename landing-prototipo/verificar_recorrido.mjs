import assert from 'node:assert/strict';
import {TOMAS_DETALLE as shots} from './director-detalle.js';
assert.equal(shots.length,4);
assert.equal(shots[0].time,0);
assert.equal(shots.at(-1).end,24);
for(let i=0;i<shots.length;i++){
  const a=shots[i];assert(a.end>a.time);assert(a.radius>.3);
  assert(a.center.every(Number.isFinite));
  if(i)assert.equal(shots[i-1].end,a.time);
  if(i<3){
    assert.equal(a.arc,180);
    // At mid-orbit the camera is on the outward side of the selected left limb.
    const angle=(a.start+a.arc*.5)*Math.PI/180;
    assert(a.center[0]+Math.sin(angle)*a.radius>a.center[0]+.3);
  }
}
console.log('PASS: 24 s continuous timeline; three 180-degree outward orbits.');
