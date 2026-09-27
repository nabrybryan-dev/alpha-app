# Exporta los objetos musculares de Z-Anatomy (coleccion "4: Muscular system") a un binario
# simple, en coordenadas de MUNDO de Blender (Z arriba), mas unos huesos de referencia.
# Formato por objeto: u16 len | utf8 nombre | u8 esTendonObjeto | u32 nV | u32 nT |
#   f32 pos[3nV] | f32 nrm[3nV] | u8 tendon[nV] | u32 idx[3nT]
import bpy, struct, re, json, sys
OUT = r'F:\alpha-estudio\_z-anatomy\export'
import os; os.makedirs(OUT, exist_ok=True)
col = bpy.data.collections['4: Muscular system']
objs = set(col.objects)
for ch in col.children_recursive: objs |= set(ch.objects)
TEND = re.compile(r'tendon|aponeuro', re.I)
NO_MUSC = {'Fascia', 'Bursa', 'Articular capsule', 'Cartilage', 'Text', 'Ligament'}
# Subdivision fuera: solo multiplica triangulos que luego se recortan y come RAM.
for o in objs:
    for m in o.modifiers:
        if m.type == 'SUBSURF': m.show_viewport = False
dg = bpy.context.evaluated_depsgraph_get()
elegidos, descartados = [], []
for o in sorted(objs, key=lambda o: o.name):
    if o.type != 'MESH': continue
    mats = [m.name if m else '' for m in o.data.materials]
    tendObj = bool(TEND.search(o.name))
    if not tendObj and mats and all(re.sub(r'\.\d+$','',m) in NO_MUSC for m in mats):
        descartados.append((o.name, mats)); continue
    elegidos.append(o)
info = {'elegidos': len(elegidos), 'descartados': descartados, 'mods': {}}
f = open(os.path.join(OUT, 'musculos.bin'), 'wb')
n = 0
for o in elegidos:
    oe = o.evaluated_get(dg)
    try: me = oe.to_mesh()
    except Exception as e: print('SIN MALLA', o.name, e); continue
    if me is None or len(me.polygons) == 0:
        oe.to_mesh_clear(); continue
    me.calc_loop_triangles()
    M = o.matrix_world
    N = M.to_3x3().inverted_safe().transposed()
    mats = [m.name if m else '' for m in me.materials]
    tendObj = bool(TEND.search(o.name))
    nv = len(me.vertices); nt = len(me.loop_triangles)
    tend = bytearray(nv)
    idx = []
    for t in me.loop_triangles:
        esT = tendObj or (t.material_index < len(mats) and mats[t.material_index].startswith('Tendon'))
        for v in t.vertices:
            idx.append(v)
            if esT: tend[v] = 1
    if tendObj: tend = bytearray([1]*nv)
    pos = []; nrm = []
    for v in me.vertices:
        p = M @ v.co; pos += [p.x, p.y, p.z]
        q = (N @ v.normal).normalized(); nrm += [q.x, q.y, q.z]
    # espejo en la matriz invierte el enrollado
    if M.determinant() < 0:
        for k in range(0, len(idx), 3): idx[k+1], idx[k+2] = idx[k+2], idx[k+1]
    nb = o.name.encode('utf8')
    f.write(struct.pack('<H', len(nb))); f.write(nb)
    f.write(struct.pack('<BII', 1 if tendObj else 0, nv, nt))
    f.write(struct.pack(f'<{3*nv}f', *pos)); f.write(struct.pack(f'<{3*nv}f', *nrm))
    f.write(bytes(tend)); f.write(struct.pack(f'<{3*nt}I', *idx))
    info['mods'][o.name] = [m.type for m in o.modifiers]
    n += 1
    oe.to_mesh_clear()
f.close()
info['escritos'] = n
# Huesos de referencia (mundo)
HUESOS = ['Femur.l','Femur.r','Tibia.l','Tibia.r','Calcaneus.l','Calcaneus.r','Humerus.l','Humerus.r',
          'Patella.l','Patella.r','Clavicle.l','Clavicle.r','Scapula.l','Scapula.r',
          'Parietal bone.l','Parietal bone.r','Frontal bone','Occipital bone']
hs = {}
for nme in HUESOS:
    o = bpy.data.objects.get(nme)
    if not o: print('FALTA', nme); continue
    oe = o.evaluated_get(dg); me = oe.to_mesh(); M = o.matrix_world
    hs[nme] = [list(M @ v.co) for v in me.vertices]
    oe.to_mesh_clear()
json.dump(hs, open(os.path.join(OUT, 'huesos.json'), 'w'))
json.dump(info, open(os.path.join(OUT, 'info.json'), 'w'), indent=1, ensure_ascii=False)
print('HECHO', n)
