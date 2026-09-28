"""Carga .pieza (espacio app, Y arriba) en una escena vacia y renderiza el hombro con color de vertice.
Uso: blender -b --factory-startup --python vista_previa.py -- archivo.pieza salida.png"""
import bpy, sys, os, numpy as np
from mathutils import Vector
AQUI = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, AQUI)
import pieza
a = sys.argv[sys.argv.index('--') + 1:]
for o in list(bpy.data.objects): bpy.data.objects.remove(o)
mat = bpy.data.materials.new('vc'); mat.use_nodes = True
N = mat.node_tree.nodes; b = next(n for n in N if n.type == 'BSDF_PRINCIPLED')
at = N.new('ShaderNodeVertexColor'); at.layer_name = 'Col'
mat.node_tree.links.new(at.outputs['Color'], b.inputs['Base Color']); b.inputs['Roughness'].default_value = 0.5
for p in pieza.leer(a[0]):
    v = p['pos'].astype(float); v = np.stack([v[:, 0], -v[:, 2], v[:, 1]], 1)
    t = p['idx'].reshape(-1, 3)
    me = bpy.data.meshes.new(p['nombre'] or 'x'); me.from_pydata(v.tolist(), [], t.tolist())
    ca = me.color_attributes.new('Col', 'FLOAT_COLOR', 'POINT')
    c = np.hstack([p['col'] ** 2.2, np.ones((len(v), 1))]).ravel(); ca.data.foreach_set('color', c)
    me.shade_smooth(); me.materials.append(mat)
    ob = bpy.data.objects.new(me.name, me); bpy.context.scene.collection.objects.link(ob)
S = bpy.context.scene
C = Vector((0.17, 0.03, 1.35))
cd = bpy.data.cameras.new('c'); cam = bpy.data.objects.new('c', cd); S.collection.objects.link(cam)
cd.lens = 56; cam.location = C + Vector((0.3, -1, 0.05)).normalized() * 0.75
cam.rotation_euler = (C - cam.location).to_track_quat('-Z', 'Y').to_euler(); S.camera = cam
ld = bpy.data.lights.new('k', 'AREA'); ld.energy = 120; ld.size = 1.0
lo = bpy.data.objects.new('k', ld); S.collection.objects.link(lo); lo.location = (-0.6, -1.2, 2.2)
lo.rotation_euler = (C - lo.location).to_track_quat('-Z', 'Y').to_euler()
S.world = bpy.data.worlds.new('w'); S.world.color = (0.02, 0.02, 0.02)
try: S.render.engine = 'BLENDER_EEVEE_NEXT'
except TypeError:
    S.render.engine = 'BLENDER_EEVEE'
S.render.resolution_x = 960; S.render.resolution_y = 540; S.render.filepath = a[1]
bpy.ops.render.render(write_still=True)
