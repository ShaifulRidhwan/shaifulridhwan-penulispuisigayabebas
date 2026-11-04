extends SceneTree

# Headless CI scene integrity check. This is not a substitute for an Android visual test.
func _initialize() -> void:
 call_deferred("_inspect")

func _inspect() -> void:
 var packed := load("res://world.tscn") as PackedScene
 if packed == null:
  push_error("STAGING: failed to load world.tscn")
  quit(1)
  return
 var world := packed.instantiate()
 root.add_child(world)
 await process_frame
 var failures := 0
 var hero := world.get("hero") as Node3D
 var camera := world.get("camera") as Camera3D
 var imported := bool(world.get("imported_hero"))
 var scenery := int(world.get("scenery_loaded"))
 if hero == null or camera == null:
  push_error("STAGING: hero or camera was not created")
  failures += 1
 if not imported:
  push_error("STAGING: hero GLB missing or returned to primitive fallback")
  failures += 1
 if scenery < 5:
  push_error("STAGING: no usable 3D scene/tree props, loaded=" + str(scenery))
  failures += 1
 if hero != null and camera != null:
  var camera_distance := camera.global_position.distance_to(hero.global_position)
  print("STAGING: camera distance=",camera_distance," loaded scenery=",scenery)
  if camera_distance < 2.0 or camera_distance > 14.0:
   push_error("STAGING: camera position outside expected third-person range")
   failures += 1
  var min_y := INF
  var max_y := -INF
  var parts := hero.find_children("*","MeshInstance3D",true,false)
  for part_node in parts:
   var part := part_node as MeshInstance3D
   if part == null or part.mesh == null:
    continue
   var local_bounds := part.get_aabb()
   for corner in range(8):
    var v := hero.to_local(part.to_global(local_bounds.get_endpoint(corner)))
    min_y = minf(min_y,v.y)
    max_y = maxf(max_y,v.y)
  var height := max_y - min_y
  print("STAGING: character visible height=",height)
  if height < 1.25 or height > 4.2:
   push_error("STAGING: character bounds out of safe range")
   failures += 1
 if failures != 0:
  push_error("STAGING FAILED: " + str(failures) + " error(s)")
  quit(1)
  return
 print("STAGING PASS: third-person framing and real 3D hero detected")
 quit(0)
