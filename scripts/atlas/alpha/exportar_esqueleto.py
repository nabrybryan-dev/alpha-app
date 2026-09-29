"""Exporta el esqueleto suavizado de ALPHA_TRABAJO_hombro.blend al formato .pieza v3 de la landing.

Uso: blender -b ALPHA_TRABAJO_hombro.blend --python web_pieza/exportar_esqueleto.py [-- --tope-esc N --tope-movil N]
Salida en web_pieza/salida/: atlas-esqueleto-alpha.pieza (escritorio, ~170 000 tri) y
atlas-esqueleto-alpha-movil.pieza (celular, ~90 000 tri) + informe_esqueleto.json.

- 296 partes EN EL MISMO ORDEN que origen/atlas-esqueleto-alta.pieza: parte i = objeto esqueleto_pieza_{i:03d}.
- Nombre, banderas (sin UV, no horneada) y color son los de la parte original (color uniforme por hueso).
- Espacio: pieza = (x, z, -y)_blender + DESPLAZA, igual que exportar_musculos.py.
- Reparto en proporcion a los triangulos originales (un solo factor para todos los huesos), con Decimate
  (collapse, triangulado) desde la malla suavizada. Si un hueso pierde > 2 mm de caja respecto a la malla
  suavizada sin aligerar, se rehace con mas triangulos (x1,8 hasta 4 veces) y el resto se reescala para
  seguir cerca del tope.
- Normales suaves (normal de vertice de la malla aligerada).
"""
import bpy, sys, os, json
import numpy as np
AQUI = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, AQUI)
import pieza

DESPLAZA = np.array([1.0505e-05, -0.0019892, 0.0090613])
a = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
opc = {a[i][2:]: a[i + 1] for i in range(0, len(a) - 1, 2) if a[i].startswith('--')}
TOPE_ESC = int(opc.get('tope-esc', 170_000))
TOPE_MOV = int(opc.get('tope-movil', 90_000))
UMBRAL_CAJA = 0.002     # m
# v2: huesos de articulacion (rodillas, tobillos, caderas) NO se aligeran como el resto: el aligerado con Decimate
# les quitaba ~1 mm de volumen y aparecian penetraciones de 2-3 mm que la malla suavizada no tiene.
# fr-art-esc / fr-art-movil = fraccion de los triangulos suavizados que se conserva en esos huesos.
ARTIC = {164, 185, 165, 178, 183, 191, 267, 287, 268, 281, 285, 58}
FR_ART_ESC = 2   # nivel de subdivision de los huesos de articulacion en escritorio
FR_ART_MOV = 1   # ... y en celular
ORIG = pieza.leer(os.path.join(AQUI, 'origen', 'atlas-esqueleto-alta.pieza'))
assert len(ORIG) == 296
TRI0 = [len(p['idx']) // 3 for p in ORIG]
OBJ = [bpy.data.objects['esqueleto_pieza_%03d' % i] for i in range(len(ORIG))]


def malla(o, ratio=None):
    mods = []
    if ratio is not None and ratio < 0.999:
        d = o.modifiers.new('DecWeb', 'DECIMATE'); d.decimate_type = 'COLLAPSE'; d.ratio = ratio; d.use_collapse_triangulate = True
        mods.append(d)
    mods.append(o.modifiers.new('TriWeb', 'TRIANGULATE'))
    ev = o.evaluated_get(bpy.context.evaluated_depsgraph_get()); me = ev.to_mesh()
    n = len(me.vertices)
    co = np.empty(n * 3); me.vertices.foreach_get('co', co); co = co.reshape(-1, 3)
    nr = np.empty(n * 3); me.vertices.foreach_get('normal', nr); nr = nr.reshape(-1, 3)
    mw = np.array(o.matrix_world); w = co @ mw[:3, :3].T + mw[:3, 3]
    nw = nr @ np.linalg.inv(mw[:3, :3])
    nw /= np.maximum(np.linalg.norm(nw, axis=1, keepdims=True), 1e-9)
    tri = np.empty(len(me.polygons) * 3, dtype=np.int64); me.polygons.foreach_get('vertices', tri)
    ev.to_mesh_clear()
    for m in mods: o.modifiers.remove(m)
    pos = np.stack([w[:, 0], w[:, 2], -w[:, 1]], 1) + DESPLAZA
    nrm = np.stack([nw[:, 0], nw[:, 2], -nw[:, 1]], 1)
    mal = np.linalg.norm(nrm, axis=1) < 0.5        # normal nula (vertice degenerado): se rehace con las caras vecinas
    if mal.any():
        t = tri.reshape(-1, 3); fn = np.cross(pos[t[:, 1]] - pos[t[:, 0]], pos[t[:, 2]] - pos[t[:, 0]])
        acc = np.zeros_like(pos)
        for k in range(3): np.add.at(acc, t[:, k], fn)
        ln = np.linalg.norm(acc, axis=1, keepdims=True)
        nrm[mal] = np.where(ln[mal] > 1e-12, acc[mal] / np.maximum(ln[mal], 1e-12), np.array([0.0, 1.0, 0.0]))
    return pos, nrm, tri


caja = lambda p: np.r_[p.min(0), p.max(0)]
REF, DENSO = [], []
for o in OBJ:
    pos, _, tri = malla(o)
    REF.append(caja(pos)); DENSO.append(len(tri) // 3)
print('DENSO total tri', sum(DENSO))


NIV_ART = 2
ART_NPZ = {n: np.load(os.path.join(AQUI, 'medicion_esqueleto_scripts', 'artic_nivel%d_ok.npz' % n)) for n in (1, 2)}


def hacer(i, objetivo):
    """(parte, tri, subio) para el hueso i con ~objetivo triangulos; sube si pierde caja."""
    objetivo = max(12, objetivo); ratio = min(1.0, objetivo / DENSO[i]); subio = False
    if i in ARTIC:
        # v2: malla SP+med calculada en Python (medicion_esqueleto_scripts/build_artic.py + holgura_artic.py), ya en espacio pieza;
        # escritorio = nivel 2, celular = nivel 1. Fija: no la toca el reparto.
        zz = ART_NPZ[NIV_ART]
        pos = zz['v%d' % i].astype(np.float64); tri = zz['t%d' % i].astype(np.int64).reshape(-1)
        t3 = tri.reshape(-1, 3); fn = np.cross(pos[t3[:, 1]] - pos[t3[:, 0]], pos[t3[:, 2]] - pos[t3[:, 0]]); nrm = np.zeros_like(pos)
        for k in range(3): np.add.at(nrm, t3[:, k], fn)
        nrm /= np.maximum(np.linalg.norm(nrm, axis=1, keepdims=True), 1e-15)
        col = np.tile(ORIG[i]['col'][0], (len(pos), 1))
        q = dict(nombre=ORIG[i]['nombre'], horneada=ORIG[i]['horneada'], pos=pos.astype(np.float32), nrm=nrm.astype(np.float32),
                 col=col.astype(np.float32), uv=None, idx=tri.astype(np.uint32))
        return q, len(tri) // 3, True
    for _ in range(5):
        pos, nrm, tri = malla(OBJ[i], ratio)
        if ratio >= 1.0 or np.abs(caja(pos) - REF[i]).max() <= UMBRAL_CAJA: break
        ratio = min(1.0, ratio * 1.8); subio = True
    col = np.tile(ORIG[i]['col'][0], (len(pos), 1))
    q = dict(nombre=ORIG[i]['nombre'], horneada=ORIG[i]['horneada'], pos=pos.astype(np.float32), nrm=nrm.astype(np.float32),
             col=col.astype(np.float32), uv=None, idx=tri.astype(np.uint32))
    return q, len(tri) // 3, subio


def construir(tope, salida, fr_art):
    global NIV_ART
    NIV_ART = fr_art
    fac = tope / sum(TRI0)
    res = [hacer(i, TRI0[i] * fac) for i in range(len(ORIG))]
    for ronda in range(2):
        total = sum(r[1] for r in res)
        if abs(total - tope) / tope <= 0.015: break
        fijo = sum(r[1] for r in res if r[2]); libre = sum(r[1] for r in res if not r[2])
        k = (tope - fijo) / max(libre, 1)
        print('RONDA', ronda, 'total', total, 'k', round(k, 4))
        res = [r if r[2] else hacer(i, r[1] * k) for i, r in enumerate(res)]
    partes = [r[0] for r in res]
    total = sum(r[1] for r in res)
    dev = [float(np.abs(caja(p['pos'].astype(float)) - caja(ORIG[i]['pos'].astype(float))).max()) * 1000 for i, p in enumerate(partes)]
    nbytes = pieza.escribir(partes, os.path.join(AQUI, 'salida', salida))
    return dict(archivo=salida, tri=total, tope=tope, partes=len(partes), bytes=nbytes, subieron=sum(r[2] for r in res),
                caja_vs_original_mm_max=round(max(dev), 3), caja_vs_original_mm_mediana=round(float(np.median(dev)), 3),
                min_tri_parte=min(r[1] for r in res), max_tri_parte=max(r[1] for r in res))


os.makedirs(os.path.join(AQUI, 'salida'), exist_ok=True)
inf = {'denso_tri': sum(DENSO), 'original_tri': sum(TRI0)}
inf['escritorio'] = construir(TOPE_ESC, 'atlas-esqueleto-alpha.pieza', FR_ART_ESC)
inf['movil'] = construir(TOPE_MOV, 'atlas-esqueleto-alpha-movil.pieza', FR_ART_MOV)
json.dump(inf, open(os.path.join(AQUI, 'salida', 'informe_esqueleto.json'), 'w'), indent=1)
print('INFORME', json.dumps(inf))
