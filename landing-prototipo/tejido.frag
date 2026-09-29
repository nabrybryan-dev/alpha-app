uniform vec3 uRim, uKeyView, uFillView;
uniform float uRimFuerza,uOpacidad,uTendon,uFibras,uBrillo,uPoros,uTransl,uTendonReal,uEsPiel,uDetalle,uReveal;
uniform vec3 uRevealCenter;
uniform float uRevealRadius;
varying float vTen,vCav,vVar,vAO,vRad;
varying vec3 vN,vC,vV,vP,vE,vVista,vLocal,vWorld;
varying float vT;
varying float vFan;varying vec3 vFocal;
float hash(vec3 p){p=fract(p*.3183099+.1);p*=17.;return fract(p.x*p.y*p.z*(p.x+p.y+p.z));}
float ruido(vec3 x){vec3 i=floor(x),f=fract(x);f=f*f*(3.-2.*f);return mix(mix(mix(hash(i),hash(i+vec3(1,0,0)),f.x),mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z);}
vec3 aces(vec3 x){return clamp((x*(2.51*x+.03))/(x*(2.43*x+.59)+.14),0.,1.);}
vec3 relieve(vec3 p,vec3 n,float h){vec3 px=dFdx(p),py=dFdy(p),r1=cross(py,n),r2=cross(n,px);float det=dot(px,r1);return normalize(abs(det)*n-sign(det)*(dFdx(h)*r1+dFdy(h)*r2));}
// Analytically filtered periodic grooves: fade subpixel detail rather than shimmer.
float ridge(float phase){float aa=1.-smoothstep(.8,3.2,fwidth(phase));return .5+.5*cos(phase)*aa;}
void main(){
  if(uFibras>.5 && uReveal>.5 && distance(vWorld,uRevealCenter)<uRevealRadius)discard;
  vec3 n=normalize(vN),v=normalize(vV);if(!gl_FrontFacing)n=-n;
  float tend=mix(smoothstep(.66,.93,abs(vT)),vTen,uTendonReal)*uTendon;
  float musc=uFibras*(1.-tend),bone=(1.-uFibras)*(1.-uEsPiel);
  vec3 axis=normalize(vE);
  vec3 ref=abs(axis.y)>.85?vec3(1,0,0):vec3(0,1,0);
  vec3 side=normalize(cross(axis,ref)),other=cross(axis,side);
  float along=dot(vLocal,axis);
  float phi=atan(dot(vLocal,other),dot(vLocal,side));
  float radius=max(vRad,.003);
  float waviness=sin(along*95.+vVar*12.)*.18+sin(along*37.+vVar*5.)*.24;
  float count=max(12.,floor(6.283185*radius/.00065));
  // Pectoral subdivisions converge toward their lateral extremity in the atlas.
  // This is an illustrative flow field, not measured fascicle tractography.
  if(vFan>.5){phi=atan(vFocal.y,vFocal.x);count=390.;}
  float phase=phi*count+waviness*2.+ruido(vec3(phi*45.,along*16.,vVar*5.))*2.;
  float micro=ridge(phase);
  float bundles=ridge(phi*max(6.,floor(count*.17))+waviness+ruido(vP*25.)*.9);
  float filaments=ridge(phase*1.9+waviness*2.);
  float grain=ruido(vP*850.),broad=ruido(vP*42.);
  // Fine fibers, fascicle relief and finer parallel collagen in tendon regions.
  float height=uDetalle*(musc*(micro*.000072+bundles*.000060+filaments*.000018)
    +tend*(micro*.000075+filaments*.000023)+bone*grain*.000055);
  n=relieve(vVista,n,height);
  float ao=vAO;
  vec3 base=vC*mix(.9,1.1,vVar);
  base*=mix(.84,1.09,broad);
  base*=1.-musc*uDetalle*((1.-micro)*.15+(1.-bundles)*.035);
  // Thin connective ridges are muted ivory, never uniformly painted white.
  float fascia=pow(micro,12.)*mix(.1,1.,grain)*musc*uDetalle*.19;
  base=mix(base,vec3(.40,.31,.245),fascia);
  base=mix(base,vec3(.49,.405,.30)*( .9+micro*.10),tend);
  base*=1.-bone*uDetalle*grain*.075;
  float cavity=mix(.8,1.,smoothstep(.02,.58,vCav));base*=mix(1.,cavity,musc*.48);
  vec3 key=normalize(uKeyView),fill=normalize(uFillView);
  float ndl=dot(n,key),diff=max(0.,(ndl+.12)/(1.+.12));
  float fd=max(0.,dot(n,fill));
  vec3 ambient=vec3(.13,.145,.15)*ao;
  float grazing=pow(1.-max(dot(n,v),0.),3.);
  vec3 halfv=normalize(key+v);
  float sheen=pow(max(dot(n,halfv),0.),mix(18.,34.,tend))*(.017+.035*tend);
  float transmission=(1.-smoothstep(-.25,.3,ndl))*max(0.,dot(-key,v))*.035*musc;
  vec3 light=ambient+vec3(1.20,1.02,.82)*diff*mix(.45,1.,ao)+vec3(.48,.51,.49)*fd;
  vec3 c=base*light+vec3(1.,.86,.70)*sheen+uRim*grazing*.017+vec3(.22,.035,.02)*transmission;
  float alpha=uOpacidad*mix(1.,.04+.96*pow(grazing,.8),uEsPiel);
  gl_FragColor=vec4(aces(c*1.32),alpha);
}
