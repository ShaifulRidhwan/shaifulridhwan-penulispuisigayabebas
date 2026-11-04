extends Node3D

var hero: Node3D
var camera: Camera3D
var direction := Vector2.ZERO
var drag_start := Vector2.ZERO
var dragging := false
var heading := 0.0
var speed := 4.0
var label: Label

func material(color: Color) -> StandardMaterial3D:
 var m := StandardMaterial3D.new()
 m.albedo_color = color
 m.roughness = 0.8
 return m

func block(parent: Node3D, pos: Vector3, scale_size: Vector3, color: Color) -> MeshInstance3D:
 var node := MeshInstance3D.new()
 var mesh := BoxMesh.new()
 mesh.size = scale_size
 node.mesh = mesh
 node.material_override = material(color)
 node.position = pos
 parent.add_child(node)
 return node

func _ready() -> void:
 var world := WorldEnvironment.new()
 var env := Environment.new()
 env.background_mode = Environment.BG_COLOR
 env.background_color = Color("#111a30")
 env.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
 env.ambient_light_color = Color("#6d789e")
 env.ambient_light_energy = 0.7
 world.environment = env
 add_child(world)
 var sun := DirectionalLight3D.new()
 sun.rotation_degrees = Vector3(-48, -30, 0)
 sun.light_color = Color("#ffd39a")
 sun.light_energy = 1.6
 add_child(sun)
 block(self, Vector3(0,-0.25,0), Vector3(90,0.5,90), Color("#263b3c"))
 for i in range(35):
  var x := sin(float(i) * 2.1) * (8.0 + float(i % 5) * 5.0)
  var z := cos(float(i) * 1.8) * (9.0 + float(i % 6) * 4.0)
  var h := 2.0 + float(i % 7) * 1.7
  block(self, Vector3(x,h/2.0,z), Vector3(1.5,h,1.5), Color("#6d637a") if x < 0.0 else Color("#c6a66f"))
 hero = Node3D.new()
 add_child(hero)
 var body := MeshInstance3D.new()
 var capsule := CapsuleMesh.new()
 capsule.radius = 0.38
 capsule.height = 1.75
 body.mesh = capsule
 body.material_override = material(Color("#d5d0dc"))
 body.position.y = 1.0
 hero.add_child(body)
 var skirt := MeshInstance3D.new()
 var dress := CylinderMesh.new()
 dress.top_radius = 0.28
 dress.bottom_radius = 0.95
 dress.height = 1.25
 skirt.mesh = dress
 skirt.material_override = material(Color("#ebe2d2"))
 skirt.position.y = 0.7
 hero.add_child(skirt)
 camera = Camera3D.new()
 camera.current = true
 add_child(camera)
 var canvas := CanvasLayer.new()
 add_child(canvas)
 label = Label.new()
 label.text = "AKSARA • ANTARA\nWASD / arrows to move • drag to rotate camera\nTouch left half to move, right half to look"
 label.position = Vector2(18,18)
 canvas.add_child(label)
 _update_camera(0.0)

func _process(delta: float) -> void:
 var keys := Input.get_vector("ui_left","ui_right","ui_up","ui_down")
 var motion := keys if keys.length() > 0.1 else direction
 var forward := Vector3(sin(heading),0,cos(heading))
 var right := Vector3(cos(heading),0,-sin(heading))
 var move := right * motion.x - forward * motion.y
 if move.length() > 0.05:
  hero.position += move.normalized() * speed * delta
  hero.rotation.y = atan2(move.x, move.z)
 hero.position.x = clampf(hero.position.x,-42,42)
 hero.position.z = clampf(hero.position.z,-42,42)
 _update_camera(delta)

func _update_camera(_delta: float) -> void:
 if camera == null or hero == null:
  return
 camera.position = hero.position + Vector3(sin(heading)*6.0,3.7,cos(heading)*6.0)
 camera.look_at(hero.position + Vector3.UP * 1.2)

func _unhandled_input(event: InputEvent) -> void:
 if event is InputEventScreenTouch:
  if event.pressed:
   drag_start = event.position
   dragging = true
  else:
   dragging = false
   direction = Vector2.ZERO
 elif event is InputEventScreenDrag and dragging:
  if drag_start.x < get_viewport().get_visible_rect().size.x * 0.5:
   direction = ((event.position - drag_start) / 90.0).limit_length(1.0)
  else:
   heading -= event.relative.x * 0.008
 elif event is InputEventMouseMotion and Input.is_mouse_button_pressed(MOUSE_BUTTON_RIGHT):
  heading -= event.relative.x * 0.008
