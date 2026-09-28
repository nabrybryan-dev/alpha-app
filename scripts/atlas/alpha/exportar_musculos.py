"""Exporta los musculos mejorados de ALPHA_TRABAJO_hombro.blend al formato .pieza v3 de la landing.

Uso: blender -b ALPHA_TRABAJO_hombro.blend --python web_pieza/exportar_musculos.py
Salida en web_pieza/salida/: atlas-musculos-alpha.pieza (escritorio) y atlas-musculos-alpha-movil.pieza.

- Espacio: pieza = (x, z, -y)_blender + DESPLAZA (ajustado contra la pieza Z-Anatomy, error < 1e-7 m).
- Piezas sin tocar: se copian tal cual de origen/atlas-musculos-zanatomy.pieza (escritorio).
- Piezas mejoradas (lado .l, propiedad 'suavizado'): se aligeran con Decimate hasta caber en el
  presupuesto y el lado .r se genera como espejo exacto, para que el sujeto quede simetrico.
- Color: el de la pieza original; tendon (TendonMask > 0.5) en blanco puro 255.
"""
import bpy, sys, os, json, re
import numpy as np
AQUI = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, AQUI)
import pieza

DESPLAZA = np.array([1.0505e-05, -0.0019892, 0.0090613])
TOPE_ESCRITORIO = 400_000 - 89_362 - 6_710      # triangulos totales - esqueleto - piel
TOPE_MOVIL = 130_000
ORIG = pieza.leer(os.path.join(AQUI, 'origen', 'atlas-musculos-zanatomy.pieza'))
PORNOMBRE = {p['nombre']: p for p in ORIG}
MUS = bpy.data.collections['01_Musculos_y_marcas_tendinosas'].objects


def color_base(p):
    c = np.round(p['col'] * 255).astype(int)
    no_blanco = c[(c != 255).any(1)]
    if len(no_blanco) == 0: return np.array([158, 61, 56]) / 255
    u, n = np.unique(no_blanco, axis=0, return_counts=True)
    return u[n.argmax()] / 255


def malla_de(o, ratio=None):
    """Triangulos, posiciones (espacio pieza), normales, tendon de un objeto, aligerado si ratio<1."""
    mods = []
    if ratio is not None and ratio < 0.999:
        d = o.modifiers.new('DecWeb', 'DECIMATE'); d.decimate_type = 'COLLAPSE'; d.ratio = ratio; d.use_collapse_triangulate = True
        mods.append(d)
    t = o.modifiers.new('TriWeb', 'TRIANGULATE'); mods.append(t)
    dg = bpy.context.evaluated_depsgraph_get(); ev = o.evaluated_get(dg); me = ev.to_mesh()
    n = len(me.vertices)
    co = np.empty(n * 3); me.vertices.foreach_get('co', co); co = co.reshape(-1, 3)
    nr = np.empty(n * 3); me.vertices.foreach_get('normal', nr); nr = nr.reshape(-1, 3)
    mw = np.array(o.matrix_world); w = co @ mw[:3, :3].T + mw[:3, 3]
    nw = nr @ np.linalg.inv(mw[:3, :3])
    nw /= np.maximum(np.linalg.norm(nw, axis=1, keepdims=True), 1e-9)
    tm = np.zeros(n)
    if 'TendonMask' in me.attributes: me.attributes['TendonMask'].data.foreach_get('value', tm)
    tri = np.empty(len(me.polygons) * 3, dtype=np.int64); me.polygons.foreach_get('vertices', tri)
    ev.to_mesh_clear()
    for m in mods: o.modifiers.remove(m)
    pos = np.stack([w[:, 0], w[:, 2], -w[:, 1]], 1) + DESPLAZA
    nrm = np.stack([nw[:, 0], nw[:, 2], -nw[:, 1]], 1)
    return pos, nrm, tm, tri


def parte(nombre, pos, nrm, tm, tri, base):
    col = np.tile(base, (len(pos), 1)); col[tm > 0.5] = 1.0
    return dict(nombre=nombre, horneada=False, pos=pos.astype(np.float32), nrm=nrm.astype(np.float32),
                col=col.astype(np.float32), uv=None, idx=tri.astype(np.uint32))


def espejo(q, nombre, base):
    pos = q['pos'].astype(np.float64).copy(); pos[:, 0] = 2 * DESPLAZA[0] - pos[:, 0]
    nrm = q['nrm'].copy(); nrm[:, 0] *= -1
    idx = q['idx'].reshape(-1, 3)[:, ::-1].reshape(-1)          # conserva el enrollado
    col = np.tile(base, (len(pos), 1)); col[(q['col'] >= 0.999).all(1)] = 1.0
    return dict(nombre=nombre, horneada=False, pos=pos.astype(np.float32), nrm=nrm, col=col.astype(np.float32), uv=None, idx=idx)


mejor = [o for o in MUS if o.get('suavizado') and o.name.endswith('.l')]
pares = {o.name: o.name[:-2] + '.r' for o in mejor}
orig_tri = lambda nm: len(PORNOMBRE[nm]['idx']) // 3
S = sum(orig_tri(n) + orig_tri(r) for n, r in pares.items() if r in PORNOMBRE)
resto = sum(len(p['idx']) // 3 for p in ORIG if p['nombre'] not in pares and p['nombre'] not in pares.values())
cupo_par = (TOPE_ESCRITORIO * 0.985 - resto) / S           # factor de crecimiento permitido para los pares

informe = {'piezas_mejoradas': len(mejor), 'factor_crecimiento': round(cupo_par, 3)}
nuevas = {}
for o in mejor:
    ev_tris = len(o.data.polygons) * 2  # cota (quads->2 tri)
    objetivo = orig_tri(o.name) * cupo_par
    base = color_base(PORNOMBRE[o.name])
    pos, nrm, tm, tri = malla_de(o, min(1.0, objetivo / max(ev_tris, 1)))
    nuevas[o.name] = parte(o.name, pos, nrm, tm, tri, base)
    r = pares[o.name]
    if r in PORNOMBRE:
        nuevas[r] = espejo(nuevas[o.name], r, color_base(PORNOMBRE[r]))

escritorio = [nuevas.get(p['nombre'], p) for p in ORIG]
os.makedirs(os.path.join(AQUI, 'salida'), exist_ok=True)
t_esc = sum(len(p['idx']) // 3 for p in escritorio)
b_esc = pieza.escribir(escritorio, os.path.join(AQUI, 'salida', 'atlas-musculos-alpha.pieza'))

# --- movil: prioridad a lo visible. Profundos casi fuera; mejorados conservan su forma de escritorio ---
PROFUNDO = re.compile(r'intercostal|pharyn|arytenoid|crico|thyro|glossus|palat|stylo|multifidus|rotatores|levatores|interspinal|intertransvers|diaphragm|pterygoid|longus (colli|capitis)|transversus thoracis|subcostal|rectus (anterior|lateralis|posterior)|obliquus (superior|inferior) capitis|semispinalis|spinalis|longissimus|iliocostalis|quadratus lumborum|psoas|iliacus|piriformis|gemellus|obturator|pelvic|levator ani|coccyg|sphincter|uvula|tensor veli|levator veli|salpingo|tarsus|tendon sheath|lumbrical|interosse|opponens|adductor minimus|subclavius|pectoralis minor|subscapularis|serratus posterior|scalenus|splenius|mentalis|nasalis|procerus|depressor|levator labii|zygomatic|risorius|buccinator|orbicularis|corrugator|auricular|temporoparietal|occipitofrontalis|digastric|mylohyoid|geniohyoid|sternohyoid|sternothyroid|omohyoid|masseter|temporalis', re.I)
def cuota(p):
    n = p['nombre']
    if n in nuevas: return 'mejor'
    if PROFUNDO.search(n): return 'profundo'
    return 'resto'
tri = {p['nombre']: len(p['idx']) // 3 for p in escritorio}
grupos = {k: sum(t for n, t in tri.items() if cuota(PORNOMBRE[n] | {'nombre': n}) == k) for k in ('mejor', 'profundo', 'resto')}
# Todos los musculos son necesarios (capas y ventana osea): mismo factor para todos, sin quitar profundos.
F_MEJOR = F_PROF = f_resto = TOPE_MOVIL * 0.98 / sum(grupos.values())
informe['movil_grupos'] = grupos; informe['movil_factores'] = dict(mejor=F_MEJOR, profundo=F_PROF, resto=round(f_resto, 3))
movil = []
for p in escritorio:
    o = bpy.data.objects.get(p['nombre'])
    base = color_base(PORNOMBRE[p['nombre']])
    if p['nombre'] in nuevas and p['nombre'].endswith('.r'):
        continue
    if o is None: movil.append(p); continue
    f = {'mejor': F_MEJOR, 'profundo': F_PROF, 'resto': f_resto}[cuota(p)]
    objetivo = max(8, tri[p['nombre']] * f)
    dens = len(o.data.polygons) * 2 if p['nombre'] in nuevas else tri[p['nombre']]
    ratio = min(1.0, objetivo / max(dens, 1))
    ref = p['pos'].astype(float); caja = lambda a: np.r_[a.min(0), a.max(0)]
    for _ in range(4):   # si al aligerar pierde forma (> 3 mm en su caja), se rehace con mas triangulos
        pos, nrm, tm, t_ = malla_de(o, ratio)
        if ratio >= 1.0 or np.abs(caja(pos) - caja(ref)).max() <= 0.003: break
        ratio = min(1.0, ratio * 1.8)
    q = parte(p['nombre'], pos, nrm, tm, t_, base); movil.append(q)
    r = pares.get(p['nombre'])
    if r in PORNOMBRE: movil.append(espejo(q, r, color_base(PORNOMBRE[r])))
orden = {p['nombre']: i for i, p in enumerate(ORIG)}; movil.sort(key=lambda q: orden[q['nombre']])
t_mov = sum(len(p['idx']) // 3 for p in movil)
b_mov = pieza.escribir(movil, os.path.join(AQUI, 'salida', 'atlas-musculos-alpha-movil.pieza'))
informe.update(tri_escritorio=t_esc, bytes_escritorio=b_esc, tri_movil=t_mov, bytes_movil=b_mov,
               partes_escritorio=len(escritorio), partes_movil=len(movil))
json.dump(informe, open(os.path.join(AQUI, 'salida', 'informe.json'), 'w'), indent=1)
print('INFORME', json.dumps(informe))
