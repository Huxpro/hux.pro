export const vertexShader = `
attribute vec2 a_position;
varying vec2 v_uv;
void main() {
  v_uv = a_position * 0.5 + 0.5;
  gl_Position = vec4(a_position, 0.0, 1.0);
}`;

export const fragmentShader = `
precision highp float;
varying vec2 v_uv;
uniform vec2 u_resolution;
uniform sampler2D u_noise;
uniform float u_time;
uniform vec3 u_zenith, u_horizon, u_cloudLight, u_cloudShade;
uniform vec2 u_sun, u_wind, u_drift;
uniform float u_daylight, u_twilight, u_cloud, u_rain, u_snow, u_fog, u_storm, u_moonPhase;
uniform float u_lightning;
uniform vec2 u_lightningPosition;

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec3 p) {
  vec3 i = floor(p), f = fract(p);
  f = f*f*(3.0-2.0*f);
  vec2 uv = i.xy + vec2(37.0,17.0)*i.z + f.xy;
  float a = texture2D(u_noise,(uv+0.5)/256.0).r;
  float b = texture2D(u_noise,(uv+vec2(37.0,17.0)+0.5)/256.0).r;
  return mix(a,b,f.z);
}
float fbm(vec3 p) {
  return noise(p)*0.57 + noise(p*2.03+7.0)*0.27 + noise(p*4.07+13.0)*0.11 + noise(p*8.13)*0.05;
}
float density(vec3 p) {
  vec3 q = p*1.85;
  float shape = fbm(q);
  // Fine erosion follows the billow edge, leaving a dense interior.
  shape -= (1.0-noise(q*7.0))*0.09;
  float coverage = mix(0.74, 0.23, u_cloud);
  float envelope = smoothstep(1.35,1.75,p.y)*(1.0-smoothstep(2.45,3.15,p.y));
  return smoothstep(coverage,coverage+0.18,shape)*envelope;
}
float stars(vec2 uv) {
  vec2 p = uv * vec2(u_resolution.x/u_resolution.y,1.0) * 210.0;
  vec2 cell = floor(p);
  float seed = hash(cell);
  vec2 center = vec2(hash(cell+13.2),hash(cell+71.9));
  float star = exp(-length(fract(p)-center)*55.0);
  return star * step(0.985,seed) * (0.65+0.35*sin(u_time*0.35+seed*230.0));
}
void main() {
  vec2 uv = vec2(v_uv.x, 1.0-v_uv.y);
  float aspect = u_resolution.x/u_resolution.y;
  vec2 sunDelta = (uv-u_sun)*vec2(aspect,1.0);
  float sunDistance = length(sunDelta);
  vec3 color = mix(u_zenith,u_horizon,pow(uv.y,1.45));
  vec3 warm = mix(vec3(1.0,0.92,0.73),vec3(1.0,0.5,0.23),u_twilight);
  float sunVisible = smoothstep(0.0,0.3,u_daylight);
  // Broad aureole, warm middle halo and a luminous white inner bloom.
  // Exponential falloffs overlap smoothly without a visible ring boundary.
  color = mix(color,warm,exp(-sunDistance*3.5)*0.32*sunVisible);
  color = mix(color,warm,exp(-sunDistance*10.0)*0.7*sunVisible);
  color = mix(color,mix(warm,vec3(1.0),0.85),exp(-sunDistance*14.0)*0.95*sunVisible);
  float disc = 1.0-smoothstep(0.015,0.018,sunDistance);
  color = mix(color,vec3(1.0,0.995,0.96),disc*sunVisible);

  // Small, phase-lit moon with restrained bloom. Its placement is decorative.
  vec2 moonDelta = (uv-vec2(0.76,0.2))*vec2(aspect,1.0);
  float moonRadius = 0.018;
  vec2 mp = moonDelta/moonRadius;
  float moonDisc = 1.0-smoothstep(0.94,1.0,length(mp));
  float z = sqrt(max(0.0,1.0-dot(mp,mp)));
  float angle = u_moonPhase*6.2831853;
  float moonLit = smoothstep(-0.05,0.08,dot(vec3(mp,z),vec3(sin(angle),0.0,-cos(angle))));
  float night = 1.0-smoothstep(0.0,0.35,u_daylight);
  float moonTexture = 0.85+0.15*fbm(vec3(mp*7.0,3.0));
  color += vec3(0.6,0.7,0.9)*exp(-length(moonDelta)*34.0)*0.035*night;
  color = mix(color,vec3(0.78,0.85,0.92)*moonTexture,moonDisc*moonLit*night);
  color += vec3(0.7,0.8,1.0)*stars(uv)*night*(1.0-uv.y*0.7);

  // A shallow world-space cloud volume: integration preserves cloud occlusion,
  // self-shadow, sunlit rims and parallax rather than scrolling a flat texture.
  vec3 ray = normalize(vec3((uv.x-0.5)*aspect,0.25+(1.0-uv.y)*0.95,1.0));
  vec3 lightDir = normalize(vec3((u_sun.x-0.5)*2.0,0.5+(1.0-u_sun.y),0.8));
  vec3 drift = vec3(u_drift.x,0.0,u_drift.y);
  float start = 1.35/ray.y;
  float stepSize = (3.15-1.35)/ray.y/20.0;
  float transmittance = 1.0;
  vec3 cloudColor = vec3(0.0);
  float jitter = hash(gl_FragCoord.xy)*stepSize*0.25;
  if (u_cloud > 0.005) {
    for (int i=0;i<20;i++) {
      vec3 p = ray*(start+(float(i)+0.5)*stepSize+jitter)+drift;
      float d = density(p);
      if (d>0.005) {
        float shadow = density(p+lightDir*0.32)*0.8+density(p+lightDir*0.75)*0.45;
        float light = exp(-shadow*2.7);
        float rim = pow(max(dot(ray,lightDir),0.0),12.0)*light*0.32;
        vec3 lit = mix(u_cloudShade,u_cloudLight,clamp(light*0.87+rim,0.0,1.0));
        float extinction = 1.0-exp(-d*stepSize*mix(3.6,6.0,u_storm));
        cloudColor += transmittance*lit*extinction;
        transmittance *= 1.0-extinction;
      }
    }
  }
  color = color*transmittance+cloudColor;
  // Wispy high cloud above the cumulus deck, and low moving mist in fog/rain.
  float cirrus = smoothstep(0.57,0.78,fbm(vec3(uv.x*4.0+u_time*0.002,uv.y*13.0,8.0)));
  color = mix(color,u_cloudLight,cirrus*0.1*u_cloud);
  float mist = u_fog*(0.5+uv.y*0.38+noise(vec3(uv*3.0,u_time*0.008))*0.12);
  color = mix(color,mix(u_horizon,u_cloudLight,0.25),clamp(mist,0.0,0.94));

  // The same event illuminates the cloud volume and the display-resolution bolt.
  float flashFalloff = exp(-length((uv-u_lightningPosition)*vec2(aspect,1.0))*3.2);
  color += vec3(0.62,0.74,1.0)*u_lightning*u_storm*flashFalloff*(0.35+0.65*(1.0-transmittance));
  color = mix(color,warm,exp(-sunDistance*8.0)*0.13*sunVisible*(0.12+0.88*transmittance)*(1.0-u_storm));
  color += (hash(gl_FragCoord.xy+17.0)-0.5)/255.0;
  gl_FragColor = vec4(color,1.0);
}`;
