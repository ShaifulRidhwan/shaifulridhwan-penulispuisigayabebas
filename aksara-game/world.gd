extends Node3D
# AKSARA Hybrid v0.3. Free CC0 3D assets imported at build time.
# Placeholder geometry remains only as a graceful fallback when model downloads fail.
var hero: Node3D
var camera: Camera3D
var direction := Vector2.ZERO
var drag_start := Vector2.ZERO
var touch_left := -1
var touch_right := -1
var heading := 0.0
var speed := 5.0
var t := 0.0
var sun_light: DirectionalLight3D
var moon_light: OmniLight3D
var hud: Label
var rng := RandomNumberGenerator.new()
var gown: MeshInstance3D
var water: MeshInstance3D
var imported_hero := false
var hero_animation: AnimationPlayer
var scenery_loaded := 0
var display_timer := 0.0

func mat(c: Color, metallic := 0.0, roughness := 0.8, emission := 0.0) -> StandardMaterial3D:
 var m := StandardMaterial3D.new()
 m.albedo_color = c
 m.metallic = metallic
 m.roughness = roughness
 if emission > 0.0:
  m.emission_enabled = true
  m.emission = c
  m.emission_energy_multiplier = emission
 return m

func mesh_node(parent: Node3D, mesh: Mesh, position: Vector3, material: Material) -> MeshInstance3D:
 var n := MeshInstance3D.new()
 n.mesh = mesh
 n.material_override = material
 n.position = position
 parent.add_child(n)
 return n

func box(parent: Node3D, pos: Vector3, size: Vector3, material: Material) -> MeshInstance3D:
 var m := BoxMesh.new()
 m.size = size
 return mesh_node(parent, m, pos, material)

func cylinder(parent: Node3D, pos: Vector3, top: float, bottom: float, height: float, material: Material) -> MeshInstance3D:
 var m := CylinderMesh.new()
 m.top_radius = top
 m.bottom_radius = bottom
 m.height = height
 return mesh_node(parent,m,pos,material)

func sphere(parent: Node3D, pos: Vector3, radius: float, material: Material) -> MeshInstance3D:
 var m := SphereMesh.new()
 m.radius = radius
 m.height = radius * 2.0
 m.radial_segments = 12
 m.rings = 6
 return mesh_node(parent,m,pos,material)

func terrain_height(x: float, z: float) -> float:
 var hills := sin(x*0.075)*1.65 + cos(z*0.095)*1.3 + sin((x+z)*0.13)*0.5
 var path := clampf((abs(x)-3.0)/12.0,0.0,1.0)
 return hills*path

func build_terrain() -> void:
 var st := SurfaceTool.new()
 st.begin(Mesh.PRIMITIVE_TRIANGLES)
 var n := 64
 var size := 150.0
 for iz in range(n):
  for ix in range(n):
   var x := (float(ix)/n-0.5)*size
   var z := (float(iz)/n-0.5)*size
   var step := size/n
   var a := Vector3(x,terrain_height(x,z),z)
   var b := Vector3(x+step,terrain_height(x+step,z),z)
   var c := Vector3(x,terrain_height(x,z+step),z+step)
   var d := Vector3(x+step,terrain_height(x+step,z+step),z+step)
   for v in [a,c,b,b,c,d]:
    st.set_uv(Vector2(v.x*0.035,v.z*0.035))
    st.add_vertex(v)
 st.generate_normals()
 mesh_node(self,st.commit(),Vector3.ZERO,mat(Color("#303b35")))
 var path_mesh := SurfaceTool.new()
 path_mesh.begin(Mesh.PRIMITIVE_TRIANGLES)
 for i in range(120):
  var z0 := -60.0 + float(i)
  var z1 := z0 + 1.0
  for side in [-1.0,1.0]:
   var x := side*3.1
   var p0 := Vector3(x,terrain_height(x,z0)+0.11,z0)
   var p1 := Vector3(x,terrain_height(x,z1)+0.11,z1)
   var x_other := -x
   var q0 := Vector3(x_other,terrain_height(x_other,z0)+0.11,z0)
   var q1 := Vector3(x_other,terrain_height(x_other,z1)+0.11,z1)
   if side > 0.0:
    for vertex in [p0,q0,p1,q0,q1,p1]:
     path_mesh.set_uv(Vector2(vertex.x*0.1,vertex.z*0.1))
     path_mesh.add_vertex(vertex)
 path_mesh.generate_normals()
 var stones := ShaderMaterial.new()
 stones.shader = load("res://stone_causeway.gdshader") as Shader
 mesh_node(self,path_mesh.commit(),Vector3.ZERO,stones)
 var wm := PlaneMesh.new()
 wm.size = Vector2(95,45)
 water = mesh_node(self,wm,Vector3(0,-1.6,-50),mat(Color("#254e64"),0.55,0.16))
 water.rotation.x = 0.0

func tree(pos: Vector3, dark: bool) -> void:
 if load_scene_asset("res://assets/oak.glb",pos,7.5,9.0):
  return
 # Fail-safe canopy instead of the old cone-shaped trees.
 var trunk := mat(Color("#241e2d") if dark else Color("#473a2d"))
 var leaves := mat(Color("#273c53") if dark else Color("#657247"))
 cylinder(self,pos+Vector3(0,2.2,0),0.14,0.29,4.4,trunk)
 sphere(self,pos+Vector3(0,4.8,0),1.8,leaves)
 sphere(self,pos+Vector3(-1.1,3.8,0.5),1.1,leaves)
 sphere(self,pos+Vector3(1.2,4.15,-0.5),1.2,leaves)

func ruins(pos: Vector3, dark: bool) -> void:
 var stone := mat(Color("#66748d") if dark else Color("#b9a67c"))
 var gold := mat(Color("#8c9db9") if dark else Color("#e2c17e"),0.4,0.4)
 for side in [-1,1]:
  var p := pos+Vector3(side*2.7,0,0)
  cylinder(self,p+Vector3(0,2.7,0),0.42,0.53,5.4,stone)
  cylinder(self,p+Vector3(0,5.4,0),0.75,0.75,0.35,gold)
 box(self,pos+Vector3(0,5.8,0),Vector3(7.0,0.7,1.3),stone)
 for j in range(3):
  box(self,pos+Vector3(float(j-1)*2.0,6.35,0),Vector3(1.1,0.55,1.4),gold)

# Normalize actual visible mesh bounds. GLB authoring units and offsets differ.
func fit_asset(scene: Node3D, floor_position: Vector3, target_height: float, max_width: float) -> bool:
 var pieces := scene.find_children("*","MeshInstance3D",true,false)
 if scene is MeshInstance3D:
  pieces.push_front(scene)
 var bounds := AABB()
 var found := false
 for candidate in pieces:
  var part := candidate as MeshInstance3D
  if part == null or part.mesh == null:
   continue
  var part_bounds := part.get_aabb()
  if part_bounds.size.length() < 0.0001:
   continue
  for corner in range(8):
   var v := scene.to_local(part.to_global(part_bounds.get_endpoint(corner)))
   if not found:
    bounds = AABB(v,Vector3.ZERO)
    found = true
   else:
    bounds = bounds.expand(v)
 if not found or bounds.size.y <= 0.001:
  return false
 var scaling := target_height / bounds.size.y
 var width := maxf(bounds.size.x,bounds.size.z)
 if width > 0.001 and width*scaling > max_width:
  scaling = max_width/width
 scene.scale = Vector3.ONE*scaling
 scene.position = floor_position - Vector3(bounds.get_center().x,bounds.position.y,bounds.get_center().z)*scaling
 return true

func load_scene_asset(path: String, position: Vector3, target_height: float, max_width: float) -> bool:
 if not ResourceLoader.exists(path):
  return false
 var packed := load(path) as PackedScene
 if packed == null:
  return false
 var instance := packed.instantiate() as Node3D
 if instance == null:
  return false
 add_child(instance)
 if not fit_asset(instance,position,target_height,max_width):
  instance.queue_free()
  return false
 scenery_loaded += 1
 return true

func build_world() -> void:
 rng.seed = 4126
 build_terrain()
 for i in range(27):
  var x := rng.randf_range(-67,67)
  var z := rng.randf_range(-67,67)
  if abs(x) < 10.0:
   continue
  tree(Vector3(x,terrain_height(x,z),z),x<0)
 if not load_scene_asset("res://assets/courtyard.glb", Vector3(-24.0,0,-42),18.0,28.0):
  ruins(Vector3(-24,0,-42),true)
 if not load_scene_asset("res://assets/sanctuary.glb", Vector3(24.0,0,-42),18.0,28.0):
  ruins(Vector3(24,0,-42),false)
 for i in range(65):
  var x := rng.randf_range(-55,55)
  var z := rng.randf_range(-55,55)
  if abs(x) < 4.0:
   continue
  sphere(self,Vector3(x,terrain_height(x,z)+0.45,z),rng.randf_range(0.13,0.4),mat(Color("#b2c8df") if x<0 else Color("#f6cb79"),0.0,0.3,1.4))
 var moon := mat(Color("#7297ca"),0.55,0.28)
 var gold := mat(Color("#ddb982"),0.65,0.25)
 var aura := mat(Color("#a3b2ff"),0.15,0.22,1.0)
 for i in range(3):
  var ring := TorusMesh.new()
  ring.inner_radius = 3.05 + float(i)*0.25
  ring.outer_radius = 3.21 + float(i)*0.25
  ring.rings = 56
  ring.ring_segments = 10
  var n := mesh_node(self,ring,Vector3(0,4.4,-35),aura if i==1 else (gold if i==0 else moon))
  n.rotation.x = PI*0.5
 for side in [-1,1]:
  cylinder(self,Vector3(float(side)*4.2,2.4,-35),0.32,0.55,4.8,moon if side<0 else gold)
  sphere(self,Vector3(float(side)*4.2,5.0,-35),0.44,aura)
 var gl := OmniLight3D.new()
 gl.position = Vector3(0,4.2,-35)
 gl.light_color = Color("#879ff9")
 gl.light_energy = 0.8
 gl.omni_range = 13.0
 add_child(gl)

func build_hero() -> void:
 hero = Node3D.new()
 add_child(hero)
 if ResourceLoader.exists("res://assets/hero.glb"):
  var packed := load("res://assets/hero.glb") as PackedScene
  if packed != null:
   var model := packed.instantiate() as Node3D
   if model != null:
    hero.add_child(model)
    if fit_asset(model,Vector3.ZERO,2.25,2.6):
     imported_hero = true
     hero_animation = model.find_child("AnimationPlayer",true,false) as AnimationPlayer
     if hero_animation != null and hero_animation.get_animation_list().size() > 0:
      hero_animation.play(hero_animation.get_animation_list()[0])
     return
    model.queue_free()
 var skin := mat(Color("#d6a98f"))
 var ivory := mat(Color("#e8dfcf"),0.1,0.65)
 var midnight := mat(Color("#222b49"),0.25,0.45)
 var gold := mat(Color("#d7b97a"),0.7,0.25)
 var hair := mat(Color("#171723"))
 # Silhouette placeholder: until a licensed rigged GLB is integrated.
 gown = cylinder(hero,Vector3(0,0.83,0),0.28,0.91,1.55,ivory)
 cylinder(hero,Vector3(0,1.75,0),0.25,0.31,0.75,midnight)
 sphere(hero,Vector3(0,2.36,0),0.28,skin)
 sphere(hero,Vector3(0,2.52,0.1),0.3,hair)
 for s in [-1,1]:
  cylinder(hero,Vector3(s*0.43,1.62,0),0.11,0.1,0.85,skin).rotation.z = float(s)*0.18
  box(hero,Vector3(s*0.4,0.95,0),Vector3(0.09,1.35,0.06),gold)
  cylinder(hero,Vector3(s*0.25,0.4,-0.05),0.04,0.18,0.8,midnight)
 for i in range(6):
  var strand := cylinder(hero,Vector3(-0.2+float(i)*0.08,1.85,0.26),0.035,0.06,1.25,hair)
  strand.rotation.z = sin(float(i))*0.12

func build_ui() -> void:
 var ui := CanvasLayer.new()
 add_child(ui)
 hud = Label.new()
 hud.text = "AKSARA  /  ANTARA\nSOLARA  •  NOCTARA\nMOVE LEFT  •  LOOK RIGHT"
 hud.position = Vector2(18,18)
 hud.add_theme_color_override("font_color",Color("#f6e8ce"))
 hud.add_theme_font_size_override("font_size",13)
 ui.add_child(hud)

func _ready() -> void:
 var envnode := WorldEnvironment.new()
 var env := Environment.new()
 var sky := Sky.new()
 var sky_mat := ProceduralSkyMaterial.new()
 sky_mat.sky_top_color = Color("#0b1837")
 sky_mat.sky_horizon_color = Color("#9a7188")
 sky_mat.ground_bottom_color = Color("#152c33")
 sky_mat.ground_horizon_color = Color("#876c6f")
 sky.sky_material = sky_mat
 env.background_mode = Environment.BG_SKY
 env.sky = sky
 env.fog_enabled = true
 env.fog_light_color = Color("#71809c")
 env.fog_density = 0.008
 env.fog_enabled = true
 env.fog_light_color = Color("#68718b")
 env.fog_density = 0.006
 env.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
 env.ambient_light_color = Color("#8193b6")
 env.ambient_light_energy = 0.6
 env.tonemap_mode = Environment.TONE_MAPPER_FILMIC
 envnode.environment = env
 add_child(envnode)
 sun_light = DirectionalLight3D.new()
 sun_light.rotation_degrees = Vector3(-43,-38,0)
 sun_light.light_color = Color("#ffc985")
 sun_light.light_energy = 1.7
 add_child(sun_light)
 moon_light = OmniLight3D.new()
 moon_light.position = Vector3(-15,10,-22)
 moon_light.light_color = Color("#698dff")
 moon_light.light_energy = 3.0
 moon_light.omni_range = 55
 add_child(moon_light)
 build_world()
 build_hero()
 camera = Camera3D.new()
 camera.current = true
 camera.fov = 65
 add_child(camera)
 camera.position = hero.position + Vector3(0,4.2,5.8)
 build_ui()
 update_camera()

func _process(delta: float) -> void:
 t += delta
 var keys := Input.get_vector("ui_left","ui_right","ui_up","ui_down")
 var motion := keys if keys.length()>0.1 else direction
 var forward := Vector3(sin(heading),0,cos(heading))
 var right := Vector3(cos(heading),0,-sin(heading))
 var move := right*motion.x+forward*motion.y
 if move.length()>0.08:
  hero.position += move.normalized()*speed*delta
  hero.rotation.y = lerp_angle(hero.rotation.y,atan2(move.x,move.z),minf(1.0,delta*8.0))
 hero.position.x = clampf(hero.position.x,-68,68)
 hero.position.z = clampf(hero.position.z,-68,68)
 hero.position.y = terrain_height(hero.position.x,hero.position.z)
 if gown != null:
  gown.rotation.z = sin(t*5.0)*0.025 if move.length()>0.08 else sin(t*1.5)*0.012
 if hero_animation != null:
  var wanted := "walk" if move.length()>0.08 else "idle"
  for clip in hero_animation.get_animation_list():
   if clip.to_lower().ends_with(wanted) and hero_animation.current_animation != clip:
    hero_animation.play(clip,0.2)
    break
 display_timer += delta
 if display_timer > 1.2:
  display_timer = 0.0
  hud.text = "AKSARA  /  ANTARA\n" + ("HERO: GLB" if imported_hero else "HERO: FALLBACK") + "  •  " + str(scenery_loaded) + " SCENERY\n" + str(Engine.get_frames_per_second()) + " FPS"
 water.position.y = -1.6+sin(t*0.7)*0.03
 update_camera()

func update_camera() -> void:
 if camera == null or hero == null:
  return
 var target := hero.position + Vector3(0,1.5,0)
 var desired := target + Vector3(sin(heading)*5.8,2.8,cos(heading)*5.8)
 if camera.position.distance_to(target)>18.0:
  camera.position = desired
 else:
  camera.position = camera.position.lerp(desired,0.16)
 camera.look_at(target)

func _unhandled_input(event: InputEvent) -> void:
 if event is InputEventScreenTouch:
  if event.pressed:
   if event.position.x < get_viewport().get_visible_rect().size.x*0.5 and touch_left==-1:
    touch_left = event.index
    drag_start = event.position
   elif touch_right==-1:
    touch_right = event.index
  else:
   if event.index==touch_left:
    touch_left = -1
    direction = Vector2.ZERO
   if event.index==touch_right:
    touch_right = -1
 elif event is InputEventScreenDrag:
  if event.index==touch_left:
   direction = ((event.position-drag_start)/95.0).limit_length(1.0)
  elif event.index==touch_right:
   heading -= event.relative.x*0.008
 elif event is InputEventMouseMotion and Input.is_mouse_button_pressed(MOUSE_BUTTON_RIGHT):
  heading -= event.relative.x*0.008
