# Exporta LA SALA del gimnasio al formato .pieza v2, con la luz horneada en el color.
#
# Sin Cycles no hay bake nativo: se calcula aqui. Por cada vertice, la luz de cada
# foco (lambert x caida x cono) y un rayo hacia los tres focos mas fuertes para la
# sombra. Lo emisivo (LED, rotulos, tiras) va con su color de emision y sin luz.
#
# REACOMODO PARA LA APP: el sujeto va en el origen y la camara orbita a 4,6 m, asi
# que nada puede vivir dentro de ese radio. Se hace en memoria, sin tocar la escena.
import bpy, bmesh, struct, numpy as np, os, math, time
from mathutils import Vector, Matrix

DESTINO = r"C:\Users\ASUS\dev\alpha-salon\public\piezas"
TEXTURAS = r"C:\Users\ASUS\dev\alpha-salon\public\texturas"
NOMBRE = "sala-gimnasio"
RADIO_MINIMO = 5.8          # fuera de la orbita (4,6) con margen
LIMITE = (7.3, 4.9)         # medio ancho / medio fondo utiles, dentro del muro
SUBDIVIDIR = {"suelo": 5, "techo": 4, "muro_fondo": 4, "muro_frente": 4, "muro_izq": 4, "muro_der": 4}

# Materiales de Poly Haven: coordenadas de objeto en caja + escala del Mapping, y el
# oscurecido/desaturado que llevan en nodos, para aplicarlo a la imagen exportada.
POLYHAVEN = {
    "anti_skid_tiles":   dict(tex="suelo-goma", escala=1.6, ya=True),
    "concrete_wall_008": dict(tex="hormigon", escala=0.45, mult=(0.16, 0.16, 0.175), sat=0.18),
    "metal_plate_02":    dict(tex="metal-placa", escala=1.1, mult=(0.20, 0.20, 0.22), sat=0.25),
    "gym_environment":   dict(tex="gym-atlas", uv=True, mult=(0.30, 0.31, 0.34)),
    # el rack de Sketchfab: sus imagenes ya estan exportadas como rack-acero / rack-barra
    "squat_rack":        dict(tex="rack-acero", uv=True, ya=True),
    "barbell":           dict(tex="rack-barra", uv=True, ya=True),
}
# Conjuntos de Sketchfab que ENTRAN, con cuanto se adelgazan (1 = tal cual).
CONJUNTOS = {"Sketchfab_model.003": 1.0, "Sketchfab_model.004": 0.08}
SALTAR = {"mampara_cristal", "Sketchfab_model", "Sketchfab_model.001", "Sketchfab_model.002"}
PREFIJOS = ("suelo", "techo", "muro_", "espejos", "franja_", "plataforma", "tira_", "pilar_", "conducto_",
            "bandeja_", "bajante_", "cesped", "led_", "zona_", "cartel_", "rotulo_", "chevron_", "mampara_",
            "extintor", "detalle_", "gym_")

esc = bpy.context.scene
dg = bpy.context.evaluated_depsgraph_get()
t0 = time.time()

# ---------------------------------------------------------------- 1) que entra, y donde
PLATAFORMA = Vector((-3.2, 1.5, 0.0))     # el centro de la plataforma pasa al origen
PILARES_APP = {0: (-5.6, -3.4), 1: (-5.6, 3.4), 2: (5.6, -3.4), 3: (5.6, 3.4)}

def raiz_de(o):
    while o.parent is not None:
        o = o.parent
    return o

def empujar_fuera(p):
    """Un punto XY dentro de la orbita se lleva a la banda junto a los MUROS LARGOS.

    Radialmente no vale: en los muros cortos (y = 5,5) solo quedan 90 cm entre la
    orbita (4,6) y la pared, y lo que se empujaba ahi se salia de la sala o seguia
    dentro de la orbita. Junto a los muros largos (x = 8) hay 3,3 m."""
    r = p.length
    if r >= RADIO_MINIMO or r < 1e-6:
        return Vector((0.0, 0.0, 0.0))
    # A 7,0 y no a 6,4: centrado a 6,4, la cara cercana del rack quedaba a 5,6 —un metro
    # de la orbita— y al girar la camara llenaba la pantalla. Pegado al muro, sobra 1,5 m.
    lado = 1.0 if p.x >= 0 else -1.0
    q = Vector((lado * 7.0, max(-4.2, min(4.2, p.y)), 0.0))
    return q - p

_desplazamiento_de_raiz = {}

def desplazamiento_de_conjunto(raiz):
    """Los conjuntos de Sketchfab se mueven ENTEROS, por el centro de su caja en el
    mundo: mover cada hijo por su posicion local los desmembraria."""
    if raiz.name in _desplazamiento_de_raiz:
        return _desplazamiento_de_raiz[raiz.name]
    xs, ys = [], []
    for c in raiz.children_recursive:
        if c.type == "MESH":
            for e in c.bound_box:
                w = c.matrix_world @ Vector(e)
                xs.append(w.x); ys.append(w.y)
    centro = Vector(((min(xs) + max(xs)) / 2, (min(ys) + max(ys)) / 2, 0.0))
    d = empujar_fuera(centro)
    _desplazamiento_de_raiz[raiz.name] = d
    print("conjunto %s centro (%.2f, %.2f) -> mueve (%.2f, %.2f)" % (raiz.name, centro.x, centro.y, d.x, d.y))
    return d

def desplazamiento(o):
    """Cuanto se mueve cada objeto para la app (en coordenadas de Blender)."""
    n = o.name
    r = raiz_de(o)
    if r.name in CONJUNTOS:
        return desplazamiento_de_conjunto(r)
    if n.startswith(("plataforma", "led_suelo")):
        return -PLATAFORMA
    if n.startswith("pilar_"):
        # La familia entera del pilar —hormigon, malla, letras— se mueve lo mismo que el
        # pilar: por su propia posicion las letras acababan dentro del hormigon.
        i = int(n.split("_")[-1])
        px, py = PILARES_APP[i]
        pilar = bpy.data.objects["pilar_%d" % i]
        return Vector((px - pilar.location.x, py - pilar.location.y, 0.0))
    if n == "mampara_marco_sup" or n.startswith("mampara_"):
        return Vector((6.0 - o.location.x, 0.0, 0.0))
    if n.startswith(("gym_", "detalle_")):
        d = empujar_fuera(Vector((o.location.x, o.location.y, 0.0)))
        # NADA SE HUNDE: los discos apoyados de canto se colocaron por su centro, asi que
        # la mitad quedaba bajo el suelo. Lo que asome por debajo se sube hasta apoyar.
        zmin = min((o.matrix_world @ Vector(e)).z for e in o.bound_box)
        if zmin < -0.02:
            d = d + Vector((0.0, 0.0, -zmin))
        return d
    return Vector((0.0, 0.0, 0.0))

objetos = []
for o in bpy.data.objects:
    if o.type not in ("MESH", "FONT"):
        continue
    r = raiz_de(o)
    if r.name in CONJUNTOS:
        objetos.append(o)      # los conjuntos entran aunque esten escondidos en la vista
        continue
    if o.hide_render or o.name in SALTAR or r.name in SALTAR:
        continue
    if not o.name.startswith(PREFIJOS):
        continue
    objetos.append(o)
print("objetos:", len(objetos))

# ADELGAZAR los conjuntos densos: un Decimate temporal por malla, que se quita al
# terminar. La maquina de poleas son 260 mil caras, mas que toda la sala.
decimados = []
for o in objetos:
    ratio = CONJUNTOS.get(raiz_de(o).name, 1.0)
    if o.type == "MESH" and ratio < 1.0 and len(o.data.polygons) > 200:
        mod = o.modifiers.new("_adelgazar", "DECIMATE")
        mod.ratio = ratio
        decimados.append((o, mod))
print("mallas adelgazadas:", len(decimados))

# ---------------------------------------------------------------- 2) los focos
luces = []
for o in bpy.data.objects:
    if o.type != "LIGHT" or o.hide_render:
        continue
    d = o.data
    l = dict(tipo=d.type, pos=np.array(o.matrix_world.translation, dtype=np.float64),
             color=np.array(d.color[:3], dtype=np.float64), energia=float(d.energy))
    eje = (o.matrix_world.to_3x3() @ Vector((0, 0, -1))).normalized()
    l["eje"] = np.array(eje, dtype=np.float64)
    if d.type == "SPOT":
        l["cono"] = d.spot_size / 2; l["blend"] = d.spot_blend
    if d.type == "AREA":
        l["area"] = (d.size * (d.size_y if d.shape == "RECTANGLE" else d.size))
    luces.append(l)
print("focos:", len(luces))

fondo = np.array(esc.world.node_tree.nodes["Background"].inputs[0].default_value[:3], dtype=np.float64)

def irradiancia(P, N):
    """Luz sin sombra de cada foco sobre un vertice: array (nLuces, 3)."""
    out = np.zeros((len(luces), 3))
    for i, l in enumerate(luces):
        L = l["pos"] - P
        d = np.linalg.norm(L)
        if d < 1e-4:
            continue
        ld = L / d
        lam = max(float(np.dot(N, ld)), 0.0)
        if lam <= 0:
            continue
        # Watts -> algo proporcional a la radiancia: 1/(4 pi d^2), con un factor de
        # forma para los focos y las areas. La escala absoluta se normaliza al final.
        base = l["energia"] / (4 * math.pi * d * d)
        if l["tipo"] == "SPOT":
            cos_a = float(np.dot(-ld, l["eje"]))
            a = math.acos(max(-1.0, min(1.0, cos_a)))
            if a > l["cono"]:
                continue
            borde = l["cono"] * (1 - l["blend"])
            f = 1.0 if a < borde else max(0.0, (l["cono"] - a) / max(l["cono"] - borde, 1e-6))
            base *= f * 3.0
        elif l["tipo"] == "AREA":
            cos_e = max(float(np.dot(-ld, l["eje"])), 0.0)
            base *= cos_e * 2.0
        out[i] = l["color"] * base * lam
    return out

def sombra(P, N, i):
    l = luces[i]
    L = Vector(l["pos"]) - Vector(P)
    d = L.length
    origen = Vector(P) + Vector(N) * 0.01
    hit, loc, nrm, idx, ob, mat = esc.ray_cast(dg, origen, L.normalized(), distance=d - 0.02)
    if not hit:
        return 1.0
    # lo emisivo no tapa (las tiras de luz cuelgan justo bajo los focos)
    return 1.0 if ob is not None and es_emisor(ob) else 0.0

def es_emisor(o):
    for m in getattr(o.data, "materials", []) or []:
        e = emision_de(m)
        if e is not None:
            return True
    return False

def emision_de(m):
    if not m or not m.use_nodes:
        return None
    b = next((n for n in m.node_tree.nodes if n.type == "BSDF_PRINCIPLED"), None)
    if not b:
        return None
    # Un mapa de emision enlazado (los packs de Sketchfab lo traen, casi todo negro) no se
    # muestrea: se trata como no emisor, o el rack entero sale plano y sin luz.
    if b.inputs["Emission Color"].is_linked or b.inputs["Emission Strength"].is_linked:
        return None
    f = b.inputs["Emission Strength"].default_value
    c = np.array(b.inputs["Emission Color"].default_value[:3], dtype=np.float64)
    # Los materiales importados de glTF traen fuerza 1 con color NEGRO: eso no emite
    # nada, y tratarlo como emisor dejaba el rack negro y sin luz.
    if f <= 0.0 or float(c.max()) < 0.02:
        return None
    return np.clip(c * min(f / 4.0, 1.2), 0, 1.2)

def albedo_y_textura(m):
    """(albedo rgb, nombre de textura o None, receta de uv o None)."""
    if not m or not m.use_nodes:
        return np.array([0.5, 0.5, 0.5]), None, None
    ph = POLYHAVEN.get(m.name)
    if ph:
        return np.array([1.0, 1.0, 1.0]), ph["tex"], ph
    b = next((n for n in m.node_tree.nodes if n.type == "BSDF_PRINCIPLED"), None)
    if not b:
        return np.array([0.5, 0.5, 0.5]), None, None
    return np.array(b.inputs["Base Color"].default_value[:3], dtype=np.float64), None, None

# ---------------------------------------------------------------- 3) recorrer
partes = {}    # (tex, emisivo) -> arrays
stats = dict(vertices=0, rayos=0, fundidos=0)

def parte(clave):
    return partes.setdefault(clave, dict(pos=[], nrm=[], col=[], uv=[], idx=[], indice={}))

# LAS LETRAS: una fuente extruida a la resolucion por defecto son decenas de miles de
# vertices por rotulo. Se baja la resolucion de la curva solo para exportar y se
# restaura al terminar; el .blend de Bryan no cambia.
resoluciones = {}
for o in bpy.data.objects:
    if o.type == "FONT" and not o.hide_render:
        resoluciones[o.name] = (o.data.resolution_u, o.data.bevel_resolution)
        o.data.resolution_u = 3
        o.data.bevel_resolution = 0
dg = bpy.context.evaluated_depsgraph_get()

def vertice_fundido(p, pos3, nrm3, col3, uv2):
    """Un vertice por combinacion distinta: los tres vertices de esquina de dos
    triangulos vecinos con la misma normal, color y uv se vuelven uno. Es lo que
    baja 200 mil vertices a una fraccion sin tocar lo que se ve."""
    k = (round(pos3[0], 4), round(pos3[1], 4), round(pos3[2], 4),
         round(nrm3[0], 2), round(nrm3[1], 2), round(nrm3[2], 2),
         round(col3[0], 3), round(col3[1], 3), round(col3[2], 3),
         round(uv2[0], 4), round(uv2[1], 4))
    i = p["indice"].get(k)
    if i is not None:
        stats["fundidos"] += 1
        return i
    i = len(p["pos"]) // 3
    p["indice"][k] = i
    p["pos"] += list(pos3); p["nrm"] += list(nrm3); p["col"] += list(col3); p["uv"] += list(uv2)
    return i

def uv_de_caja(local, n, escala):
    ax = int(np.argmax(np.abs(n)))
    if ax == 0:
        u, v = local[1], local[2]
    elif ax == 1:
        u, v = local[0], local[2]
    else:
        u, v = local[0], local[1]
    return (u * escala, v * escala)

for o in objetos:
    ev = o.evaluated_get(dg)
    try:
        me = ev.to_mesh()
    except Exception:
        continue
    if me is None or len(me.polygons) == 0:
        continue
    niveles = SUBDIVIDIR.get(o.name, 0)
    bm = bmesh.new()
    bm.from_mesh(me)
    if niveles:
        for _ in range(niveles):
            bmesh.ops.subdivide_edges(bm, edges=bm.edges[:], cuts=1, use_grid_fill=True)
    bmesh.ops.triangulate(bm, faces=bm.faces[:])
    bm.faces.ensure_lookup_table()
    uv_layer = bm.loops.layers.uv.active
    M = ev.matrix_world.copy()
    M.translation = M.translation + desplazamiento(o)
    R = M.to_3x3()
    Minv = ev.matrix_world.inverted()
    mats = list(me.materials) if me.materials else [None]
    for f in bm.faces:
        m = mats[f.material_index] if f.material_index < len(mats) else None
        emis = emision_de(m)
        alb, tex, receta = albedo_y_textura(m)
        clave = (tex, emis is not None)
        p = parte(clave)
        tri = []
        for loop in f.loops:
            co_local = loop.vert.co
            w = M @ co_local
            n_local = loop.vert.normal if f.smooth else f.normal
            n = (R @ n_local).normalized()
            P = np.array(w, dtype=np.float64); Nn = np.array(n, dtype=np.float64)
            if emis is not None:
                col = emis
            else:
                irr = irradiancia(P, Nn)
                fuerza = irr.sum(axis=1)
                top = np.argsort(fuerza)[::-1][:3]
                for i in top:
                    if fuerza[i] > 1e-4:
                        stats["rayos"] += 1
                        irr[i] *= sombra(P, Nn, int(i))
                cielo = 0.5 + 0.5 * float(Nn[2])
                ambiente = fondo * (0.6 + 0.8 * cielo) * 2.0
                col = alb * (ambiente + irr.sum(axis=0))
            if receta and receta.get("uv") and uv_layer:
                u, v = loop[uv_layer].uv
                uv2 = (u, 1.0 - v)
            elif receta:
                uv2 = uv_de_caja(np.array(co_local), np.array(n_local), receta["escala"])
            else:
                uv2 = (0.0, 0.0)
            tri.append(vertice_fundido(p, (w.x, w.z, -w.y), (n.x, n.z, -n.y),
                                       (float(col[0]), float(col[1]), float(col[2])), uv2))
            stats["vertices"] += 1
        p["idx"] += tri
    bm.free()
    ev.to_mesh_clear()

for nombre, (ru, rb) in resoluciones.items():
    o = bpy.data.objects[nombre]
    o.data.resolution_u = ru
    o.data.bevel_resolution = rb
for o, mod in decimados:
    o.modifiers.remove(mod)
print("fundidos: %d de %d" % (stats["fundidos"], stats["vertices"]))

print("vertices: %d  rayos: %d  (%.0f s)" % (stats["vertices"], stats["rayos"], time.time() - t0))

# ---------------------------------------------------------------- 4) exposicion
todo = np.concatenate([np.array(p["col"]).reshape(-1, 3) for (tex, em), p in partes.items() if not em])
lum = todo @ np.array([0.2126, 0.7152, 0.0722])
p90 = float(np.percentile(lum, 90))
ganancia = 0.62 / max(p90, 1e-6)
print("luminancia p50=%.3f p90=%.3f -> ganancia %.2f" % (float(np.percentile(lum, 50)), p90, ganancia))

# ---------------------------------------------------------------- 5) escribir
def alinear(n):
    return (4 - n % 4) % 4

out = bytearray(b"PIEZ") + struct.pack("<HH", 2, len(partes))
for (tex, em), p in partes.items():
    nombre = (tex or "").encode("utf-8")
    out += struct.pack("<H", len(nombre)) + nombre + b"\0" * alinear(2 + len(nombre))
    out += struct.pack("<I", 1)   # horneada: siempre, la luz ya va en el color
    pos = np.array(p["pos"], dtype=np.float32)
    nrm = np.array(p["nrm"], dtype=np.float32)
    col = np.array(p["col"], dtype=np.float32).reshape(-1, 3)
    if not em:
        col = np.clip(col * ganancia, 0, 1.5)
    uv = np.array(p["uv"], dtype=np.float32)
    idx = np.array(p["idx"], dtype=np.uint32)
    nV = len(pos) // 3
    out += struct.pack("<II", nV, len(idx))
    out += pos.astype("<f4").tobytes() + nrm.astype("<f4").tobytes() + col.astype("<f4").reshape(-1).tobytes()
    out += uv.astype("<f4").tobytes() + idx.astype("<u4").tobytes()
    print("parte tex=%-12s emisiva=%-5s vertices=%7d" % (tex, em, nV))

os.makedirs(DESTINO, exist_ok=True)
ruta = os.path.join(DESTINO, NOMBRE + ".pieza")
with open(ruta, "wb") as f:
    f.write(out)
print("escrito", ruta, "%.1f MB" % (len(out) / 1e6))

# ---------------------------------------------------------------- 6) las imagenes
def exportar_polyhaven(mat_nombre, receta):
    if receta.get("ya"):
        return
    m = bpy.data.materials.get(mat_nombre)
    img = None
    for n in m.node_tree.nodes:
        if n.type == "TEX_IMAGE" and n.image and ("diff" in n.image.name.lower() or "atlas" in n.image.name.lower() or mat_nombre == "gym_environment"):
            img = n.image; break
    if img is None:
        for n in m.node_tree.nodes:
            if n.type == "TEX_IMAGE" and n.image: img = n.image; break
    if img is None:
        print("sin imagen para", mat_nombre); return
    w, h = img.size
    px = np.empty(w * h * 4, dtype=np.float32); img.pixels.foreach_get(px); px = px.reshape(h, w, 4)
    rgb = px[:, :, :3]
    if "sat" in receta:
        g = rgb @ np.array([0.2126, 0.7152, 0.0722], dtype=np.float32)
        rgb = g[:, :, None] * (1 - receta["sat"]) + rgb * receta["sat"]
    if "mult" in receta:
        # el multiplicar de los nodos es en lineal; aqui se aplica sobre sRGB con la
        # raiz, que es lo que deja el mismo tono visible
        rgb = rgb * np.array(receta["mult"], dtype=np.float32) ** (1 / 2.2)
    px[:, :, :3] = np.clip(rgb, 0, 1)
    sal = bpy.data.images.new("_export_" + receta["tex"], w, h)
    sal.pixels.foreach_set(px.reshape(-1))
    sal.scale(1024, 1024)
    sal.filepath_raw = os.path.join(TEXTURAS, receta["tex"] + ".jpg")
    sal.file_format = "JPEG"; esc.render.image_settings.quality = 82; sal.save()
    bpy.data.images.remove(sal)
    print("textura", receta["tex"] + ".jpg")

for nombre_mat, receta in POLYHAVEN.items():
    if (receta["tex"], False) in partes or (receta["tex"], True) in partes:
        exportar_polyhaven(nombre_mat, receta)
print("hecho en %.0f s" % (time.time() - t0))
