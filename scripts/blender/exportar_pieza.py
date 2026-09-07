# Exporta un conjunto de Blender al formato .pieza de alpha-app.
#
# Formato (little-endian, todo alineado a 4 bytes):
#   'PIEZ' | u16 version=1 | u16 nPartes
#   por parte:
#     u16 lenTex | utf8 tex | relleno hasta multiplo de 4 (contando el u16)
#     u32 nV | u32 nI
#     f32 pos[3nV] | f32 nrm[3nV] | f32 col[3nV] | f32 uv[2nV] | u32 idx[nI]
#
# Ejes: Blender es Z arriba y la app es Y arriba: (x, y, z) -> (x, z, -y). Es una
# rotacion propia (determinante +1), asi que el enrollado se conserva y el descarte
# de caras traseras sigue valiendo. La V de la textura se invierte: WebGL sube la
# imagen con la fila 0 arriba y Blender la tiene abajo.
import bpy, struct, numpy as np, os
from mathutils import Vector

RAIZ = "Sketchfab_model.003"
NOMBRE = "rack-sentadillas"
DESTINO = r"C:\Users\ASUS\dev\alpha-salon\public\piezas"
TEXTURAS = r"C:\Users\ASUS\dev\alpha-salon\public\texturas"
# nombre de imagen en Blender -> nombre de textura en la app
NOMBRES_TEX = {"squat_rack_baseColor.png": "rack-acero", "barbell_baseColor.png": "rack-barra"}

os.makedirs(DESTINO, exist_ok=True)
raiz = bpy.data.objects[RAIZ]
dg = bpy.context.evaluated_depsgraph_get()

# 1) Recoger todo en coordenadas de mundo, agrupado por textura.
partes = {}   # tex -> dict(pos, nrm, col, uv, idx, base)
for o in raiz.children_recursive:
    if o.type != "MESH":
        continue
    ev = o.evaluated_get(dg)
    me = ev.to_mesh()
    me.calc_loop_triangles()
    try:
        me.calc_normals_split()
    except Exception:
        pass
    M = ev.matrix_world
    R = M.to_3x3()
    uvcapa = me.uv_layers.active.data if me.uv_layers.active else None
    for slot_i, mat in enumerate(me.materials):
        tex, col = None, (0.8, 0.8, 0.8)
        if mat and mat.use_nodes:
            b = next((n for n in mat.node_tree.nodes if n.type == "BSDF_PRINCIPLED"), None)
            if b:
                col = tuple(b.inputs["Base Color"].default_value[:3])
                if b.inputs["Base Color"].is_linked:
                    src = b.inputs["Base Color"].links[0].from_node
                    if src.type == "TEX_IMAGE" and src.image:
                        tex = NOMBRES_TEX.get(src.image.name, src.image.name)
        p = partes.setdefault(tex, dict(pos=[], nrm=[], col=[], uv=[], idx=[]))
        # Cada esquina de triangulo es un vertice propio (loop): asi la UV y la normal
        # partida salen exactas sin tener que fundir vertices.
        for tri in me.loop_triangles:
            if tri.material_index != slot_i:
                continue
            base = len(p["pos"]) // 3
            for k in range(3):
                li = tri.loops[k]
                vi = me.loops[li].vertex_index
                w = M @ me.vertices[vi].co
                n = (R @ Vector(me.loops[li].normal if hasattr(me.loops[li], "normal") else tri.normal)).normalized()
                p["pos"] += [w.x, w.z, -w.y]
                p["nrm"] += [n.x, n.z, -n.y]
                p["col"] += list(col)
                if uvcapa is not None:
                    u, v = uvcapa[li].uv
                    p["uv"] += [u, 1.0 - v]
                else:
                    p["uv"] += [0.0, 0.0]
            p["idx"] += [base, base + 1, base + 2]
    ev.to_mesh_clear()

# 2) Centrar en XZ y apoyar en y=0, sobre el conjunto entero.
todo = np.concatenate([np.array(p["pos"], dtype=np.float32).reshape(-1, 3) for p in partes.values()])
cx = (todo[:, 0].min() + todo[:, 0].max()) / 2
cz = (todo[:, 2].min() + todo[:, 2].max()) / 2
y0 = todo[:, 1].min()
print("caja antes: x %.2f..%.2f  y %.2f..%.2f  z %.2f..%.2f" % (
    todo[:, 0].min(), todo[:, 0].max(), todo[:, 1].min(), todo[:, 1].max(), todo[:, 2].min(), todo[:, 2].max()))

# 3) Escribir.
def alinear(n):
    return (4 - n % 4) % 4

out = bytearray(b"PIEZ")
out += struct.pack("<HH", 1, len(partes))
for tex, p in partes.items():
    nombre = (tex or "").encode("utf-8")
    out += struct.pack("<H", len(nombre)) + nombre + b"\0" * alinear(2 + len(nombre))
    pos = np.array(p["pos"], dtype=np.float32).reshape(-1, 3)
    pos[:, 0] -= cx; pos[:, 1] -= y0; pos[:, 2] -= cz
    nrm = np.array(p["nrm"], dtype=np.float32)
    col = np.array(p["col"], dtype=np.float32)
    uv = np.array(p["uv"], dtype=np.float32)
    idx = np.array(p["idx"], dtype=np.uint32)
    nV = len(pos)
    out += struct.pack("<II", nV, len(idx))
    out += pos.astype("<f4").tobytes() + nrm.astype("<f4").tobytes() + col.astype("<f4").tobytes()
    out += uv.astype("<f4").tobytes() + idx.astype("<u4").tobytes()
    print("parte %-12s vertices=%6d indices=%6d" % (tex, nV, len(idx)))

ruta = os.path.join(DESTINO, NOMBRE + ".pieza")
with open(ruta, "wb") as f:
    f.write(out)
print("escrito", ruta, len(out), "bytes")

# 4) Las imagenes, a 1024 y JPEG.
for img_nombre, tex in NOMBRES_TEX.items():
    img = bpy.data.images.get(img_nombre)
    if not img:
        print("sin imagen", img_nombre); continue
    copia = img.copy()
    copia.scale(1024, 1024)
    copia.filepath_raw = os.path.join(TEXTURAS, tex + ".jpg")
    copia.file_format = "JPEG"
    bpy.context.scene.render.image_settings.quality = 85
    copia.save()
    bpy.data.images.remove(copia)
    print("textura", tex + ".jpg")
