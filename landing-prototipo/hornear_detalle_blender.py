"""Mismo horneado que hornear_detalle.py (24 rayos coseno, 45 mm, 0,6 mm de despegue,
visibilidad = 1 - 0,72*ao/24; músculo contra músculo+hueso, hueso contra hueso), pero con el
BVHTree de Blender porque aquí no hay trimesh/embree.
Uso: blender -b --factory-startup --python hornear_detalle_blender.py -- MUSCULOS ESQUELETO SUFIJO
  (nombres sin 'atlas-' ni '.b64.txt'; escribe piezas/detalle-musculo<SUFIJO>.bin y detalle-hueso<SUFIJO>.bin)
"""
import sys, json, math
from pathlib import Path
import numpy as np
from mathutils import Vector
from mathutils.bvhtree import BVHTree
ROOT = Path(__file__).parent
sys.path.insert(0, str(ROOT))
from atlas import load

a = sys.argv[sys.argv.index('--') + 1:]
musculos, esqueleto, sufijo = a[0], a[1], a[2] if len(a) > 2 else ''


def unir(parts):
    V, F, N, off = [], [], [], 0
    for p in parts:
        V.append(p['pos']); N.append(p['normal']); F.append(p['faces'].astype(np.int64) + off); off += len(p['pos'])
    return np.concatenate(V).astype(float), np.concatenate(F), np.concatenate(N).astype(float)


def arbol(V, F):
    return BVHTree.FromPolygons([tuple(v) for v in V], [tuple(f) for f in F], all_triangles=True)


def hornear(V, N, obst, nombre):
    N = N / np.maximum(np.linalg.norm(N, axis=1, keepdims=True), 1e-10)
    ref = np.tile([0., 1., 0.], (len(V), 1)); ref[np.abs(N[:, 1]) > .9] = [1., 0., 0.]
    t = np.cross(ref, N); t /= np.maximum(np.linalg.norm(t, axis=1, keepdims=True), 1e-10)
    b = np.cross(N, t); ao = np.zeros(len(V)); orig = V + N * .0006
    for i in range(24):
        r = math.sqrt((i + .5) / 24); phi = i * 2.399963229728653
        d = t * (r * math.cos(phi)) + b * (r * math.sin(phi)) + N * math.sqrt(1 - r * r)
        for k in range(len(V)):
            hit = obst.ray_cast(Vector(orig[k]), Vector(d[k]), .045)
            if hit[0] is not None:
                ao[k] += 1 - min(max(hit[3] / .045, 0), 1) ** .6
        if i % 6 == 5: print(nombre, 'rayos', i + 1, flush=True)
    vis = (1 - .72 * ao / 24).astype('<f4')
    (ROOT / 'piezas' / f'detalle-{nombre}{sufijo}.bin').write_bytes(vis.tobytes())
    return dict(vertices=len(V), min=float(vis.min()), mean=float(vis.mean()), max=float(vis.max()))


M = load(musculos); E = load(esqueleto)
Vm, Fm, Nm = unir(M); Ve, Fe, Ne = unir(E)
todo = arbol(np.concatenate([Vm, Ve]), np.concatenate([Fm, Fe + len(Vm)]))
inf = {'musculo': hornear(Vm, Nm, todo, 'musculo'), 'hueso': hornear(Ve, Ne, arbol(Ve, Fe), 'hueso'),
       'musculos': musculos, 'esqueleto': esqueleto}
(ROOT / 'piezas' / f'detalle{sufijo}.json').write_text(json.dumps(inf, indent=1))
print('HORNEADO', json.dumps(inf))
