"""Bake local geometric occlusion. No anatomy is added or moved.
24 cosine-weighted hemisphere rays per vertex, 45 mm maximum reach.
Bones use bone-only occlusion so revealing them does not retain muscle shadows.
"""
from atlas import load,ROOT
import numpy as np
import trimesh, json
from trimesh.ray.ray_pyembree import RayMeshIntersector

def mesh(parts):
    vertices=[];faces=[];offset=0
    for p in parts:
        vertices.append(p['pos']);faces.append(p['faces'].astype(np.int64)+offset);offset+=len(p['pos'])
    return trimesh.Trimesh(np.concatenate(vertices),np.concatenate(faces),process=False)

def bake(source,obstacles,name):
    intersector=RayMeshIntersector(obstacles)
    p=np.asarray(source.vertices);n=np.asarray(source.vertex_normals)
    reference=np.tile([0.,1.,0.],(len(p),1));reference[np.abs(n[:,1])>.9]=[1.,0.,0.]
    tangent=np.cross(reference,n);tangent/=np.maximum(np.linalg.norm(tangent,axis=1,keepdims=True),1e-10)
    bitangent=np.cross(n,tangent);ao=np.zeros(len(p))
    for i in range(24):
        r=np.sqrt((i+.5)/24);phi=i*2.399963229728653
        d=tangent*(r*np.cos(phi))+bitangent*(r*np.sin(phi))+n*np.sqrt(1-r*r)
        origin=p+n*.0006
        location,ray,_=intersector.intersects_location(origin,d,multiple_hits=False)
        distance=np.linalg.norm(location-origin[ray],axis=1)
        near=distance<.045
        ao[ray[near]]+=1-np.clip(distance[near]/.045,0,1)**.6
        if i%6==5:print(name,'rays',i+1,flush=True)
    visibility=(1-.72*ao/24).astype('<f4')
    (ROOT/'piezas'/f'detalle-{name}.bin').write_bytes(visibility.tobytes())
    return dict(vertices=len(p),min=float(visibility.min()),mean=float(visibility.mean()),max=float(visibility.max()))

muscles=load('musculos-zanatomy');bones=load('esqueleto')
m=mesh(muscles);b=mesh(bones);combined=mesh(muscles+bones)
report={'method':'24 cosine hemisphere rays, 45 mm reach, 0.6 mm surface offset','musculo':bake(m,combined,'musculo'),'hueso':bake(b,b,'hueso')}
bb=b.bounds;center=(bb[0]+bb[1])/2
report['height']=float(bb[1,1]-bb[0,1]);report['offset']=[-float(center[0]),-float(bb[0,1]),-float(center[2])]
report['parts']=[{'name':p['name'],'vertices':len(p['pos']),'tendonVertices':int(np.all(p['color']==255,axis=1).sum())} for p in muscles]
(ROOT/'piezas'/'detalle.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
print(json.dumps({k:v for k,v in report.items() if k!='parts'},indent=2),flush=True)
