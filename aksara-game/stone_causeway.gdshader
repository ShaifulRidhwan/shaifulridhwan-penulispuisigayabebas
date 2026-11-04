shader_type spatial;
render_mode cull_back, diffuse_burley, specular_schlick_ggx;
varying vec3 world_pos;
float hash21(vec2 v){return fract(sin(dot(v,vec2(127.1,311.7)))*43758.5453123);}
void vertex(){world_pos=(MODEL_MATRIX*vec4(VERTEX,1.0)).xyz;}
void fragment(){
 vec2 p=world_pos.xz*vec2(1.12,1.28);
 p.x+=mod(floor(p.y),2.0)*0.5;
 vec2 cell=floor(p);
 vec2 f=fract(p);
 float edge= smoothstep(0.025,0.09,min(min(f.x,1.0-f.x),min(f.y,1.0-f.y)));
 float n=hash21(cell);
 float grain=hash21(floor(world_pos.xz*14.0));
 vec3 stone=mix(vec3(0.20,0.21,0.24),vec3(0.36,0.34,0.33),n);
 stone*=0.86+grain*0.21;
 ALBEDO=mix(vec3(0.055,0.06,0.072),stone,edge);
 ROUGHNESS=mix(0.87,0.57,edge);
 METALLIC=0.02;
}
