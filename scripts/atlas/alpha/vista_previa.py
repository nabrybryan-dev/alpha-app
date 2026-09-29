"""Carga .pieza (espacio app, Y arriba) en una escena vacia y renderiza una zona con color de vertice.
Uso: blender -b --factory-startup --python vista_previa.py -- archivo.pieza[,otro.pieza...] salida.png [--centro x,y,z] [--dir x,y,z] [--dist m]
  Sin opciones encuadra el hombro izquierdo, igual que siempre.
  --centro  punto al que mira la camara, en coordenadas de Blender de ALPHA_TRABAJO_hombro.blend (Z arriba, metros)
  --dir     direccion del centro hacia la camara (se normaliza). La luz gira con ella alrededor de Z para
            conservar el mismo modelado que la vista del hombro.
  --dist    distancia de la camara al centro, en metros (0.75 por defecto)
Rodilla izquierda desde delante-lateral (la de comparar_web_rodilla.jpg): --centro 0.0942,0.0154,0.4504 --dir 1,-1,0.15"""
import bpy, sys, os, math, numpy as np
from mathutils import Vector, Matrix
AQUI = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, AQUI)
import pieza
a = sys.argv[sys.argv.index('--') + 1:]
opc = {a[i][2:]: a[i + 1] for i in range(2, len(a) - 1, 2) if a[i].startswith('--')}
vec = lambda s: Vector(tuple(float(x) for x in s.split(',')))
for o in list(bpy.data.objects): bpy.data.objects.remove(o)
mat = bpy.data.materials.new('vc'); mat.use_nodes = True
N = mat.node_tree.nodes; b = next(n for n in N if n.type == 'BSDF_PRINCIPLED')
at = N.new('ShaderNodeVertexColor'); at.layer_name = 'Col'
mat.node_tree.links.new(at.outputs['Color'], b.inputs['Base Color']); b.inputs['Roughness'].default_value = 0.5
for p in [q for f in a[0].split(',') for q in pieza.leer(f)]:     # a[0] puede ser una lista de .pieza separados por comas
    v = p['pos'].astype(float); v = np.stack([v[:, 0], -v[:, 2], v[:, 1]], 1)
    t = p['idx'].reshape(-1, 3)
    me = bpy.data.meshes.new(p['nombre'] or 'x'); me.from_pydata(v.tolist(), [], t.tolist())
    ca = me.color_attributes.new('Col', 'FLOAT_COLOR', 'POINT')
    c = np.hstack([p['col'] ** 2.2, np.ones((len(v), 1))]).ravel(); ca.data.foreach_set('color', c)
    me.shade_smooth(); me.materials.append(mat)
    ob = bpy.data.objects.new(me.name, me); bpy.context.scene.collection.objects.link(ob)
S = bpy.context.scene
# Escena = (x, -z, y) de la pieza = Blender de ALPHA_TRABAJO + (1.05e-5, -0.00906, -0.00199): la pieza lleva DESPLAZA.
A_ESCENA = Vector((1.0505e-05, -0.0090613, -0.0019892))
C_DEFECTO, DIR_DEFECTO, LUZ_DEFECTO = Vector((0.17, 0.03, 1.35)), Vector((0.3, -1, 0.05)), Vector((-0.6, -1.2, 2.2))
C = vec(opc['centro']) + A_ESCENA if 'centro' in opc else C_DEFECTO
DIR = vec(opc['dir']) if 'dir' in opc else DIR_DEFECTO
DIST = float(opc.get('dist', 0.75))
cd = bpy.data.cameras.new('c'); cam = bpy.data.objects.new('c', cd); S.collection.objects.link(cam)
cd.lens = 56; cam.location = C + DIR.normalized() * DIST
cam.rotation_euler = (C - cam.location).to_track_quat('-Z', 'Y').to_euler(); S.camera = cam
ld = bpy.data.lights.new('k', 'AREA'); ld.energy = 120; ld.size = 1.0
lo = bpy.data.objects.new('k', ld); S.collection.objects.link(lo)
if opc:
    giro = math.atan2(DIR.y, DIR.x) - math.atan2(DIR_DEFECTO.y, DIR_DEFECTO.x)
    lo.location = C + Matrix.Rotation(giro, 3, 'Z') @ (LUZ_DEFECTO - C_DEFECTO)
else:
    lo.location = LUZ_DEFECTO
lo.rotation_euler = (C - lo.location).to_track_quat('-Z', 'Y').to_euler()
S.world = bpy.data.worlds.new('w'); S.world.color = (0.02, 0.02, 0.02)
try: S.render.engine = 'BLENDER_EEVEE_NEXT'
except TypeError:
    S.render.engine = 'BLENDER_EEVEE'
S.render.resolution_x = 960; S.render.resolution_y = 540; S.render.filepath = a[1]
print('VISTA centro', tuple(round(x, 4) for x in C), 'camara', tuple(round(x, 4) for x in cam.location), 'luz', tuple(round(x, 3) for x in lo.location))
bpy.ops.render.render(write_still=True)
