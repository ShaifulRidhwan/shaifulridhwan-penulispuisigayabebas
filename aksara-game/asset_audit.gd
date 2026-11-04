extends SceneTree
# CI integrity check: a valid GLB header alone does not prove renderable geometry.
func _initialize() -> void:
 var failures := 0
 for asset_name in ["hero", "oak", "sanctuary", "courtyard"]:
  var path := "res://assets/" + asset_name + ".glb"
  var scene := load(path) as PackedScene
  if scene == null:
   push_error("AKSARA AUDIT: missing or unimportable " + path)
   failures += 1
   continue
  var model := scene.instantiate() as Node3D
  if model == null:
   push_error("AKSARA AUDIT: GLB root is not Node3D: " + path)
   failures += 1
   continue
  root.add_child(model)
  var count := 0
  var pieces := model.find_children("*", "MeshInstance3D", true, false)
  if model is MeshInstance3D:
   pieces.push_front(model)
  for n in pieces:
   var part := n as MeshInstance3D
   if part != null and part.mesh != null and part.mesh.get_surface_count() > 0:
    count += 1
  print("AKSARA ASSET AUDIT: ", asset_name, " mesh_count=", count)
  if count == 0:
   push_error("AKSARA AUDIT: no renderable meshes in " + asset_name)
   failures += 1
  model.queue_free()
 if failures > 0:
  push_error("AKSARA ASSET AUDIT FAILED: " + str(failures) + " failure(s)")
 quit(1 if failures > 0 else 0)
