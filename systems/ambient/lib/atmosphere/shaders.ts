export const vertexShader = `
attribute vec2 a_position;
varying vec2 v_uv;
void main() {
  v_uv = a_position * 0.5 + 0.5;
  gl_Position = vec4(a_position, 0.0, 1.0);
}`;

/**
 * The cloud volume and everything behind it. Precipitation and the bolt are
 * drawn by the 2D layer above (details.ts) at display resolution.
 *
 * Cost is the raymarch: MARCH_STEPS samples of `density`, and at each sample
 * that hits cloud two cheaper samples toward the sun. The noise is one texture
 * fetch per octave (the red and green channels hold two z-slices, see
 * renderer.ts), the shadow taps and the distant deck skip the fine octaves
 * they cannot resolve, and the march stops once the cloud in front is opaque.
 */
export const MARCH_STEPS = 20;

export const fragmentShader = `
precision highp float;
varying vec2 v_uv;
uniform vec2 u_resolution;
uniform sampler2D u_noise;
uniform sampler2D u_wipe;
uniform float u_time;
uniform vec3 u_zenith, u_horizon, u_cloudLight, u_cloudShade;
uniform vec2 u_sun, u_moon;
uniform vec3 u_drift;
uniform vec3 u_lightDir;
uniform float u_camera;
uniform float u_daylight, u_twilight, u_cloud, u_fog, u_storm, u_moonPhase;
uniform float u_moonVisible, u_moonSize, u_stars, u_density, u_darkness;
uniform float u_coverage, u_extinction, u_exposure;
uniform float u_lightning;
uniform vec2 u_lightningPosition;
uniform vec4 u_meteor;
uniform float u_meteorGlow;
uniform float u_wipeOn;

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
// One fetch: red is the slice at z, green the slice at z + 1 (offset by 37, 17).
float noise(vec3 p) {
  vec3 i = floor(p), f = fract(p);
  f = f*f*(3.0-2.0*f);
  vec2 uv = i.xy + vec2(37.0,17.0)*i.z + f.xy;
  vec2 rg = texture2D(u_noise,(uv+0.5)/256.0).rg;
  return mix(rg.r,rg.g,f.z);
}
float fbm(vec3 p) {
  return noise(p)*0.57 + noise(p*2.03+7.0)*0.27 + noise(p*4.07+13.0)*0.11 + noise(p*8.13)*0.05;
}
float envelope(float y) {
  return smoothstep(1.35,1.75,y)*(1.0-smoothstep(2.45,3.15,y));
}
// far is how distant the sample is, 0..1: toward the horizon a ray crosses
// the deck in long steps, and the fine octaves and the erosion alias into a
// crunchy band there. Past a point they are swapped for their mean — which is
// both what the eye resolves at that range and the cheaper sample.
float density(vec3 p, float far) {
  float band = envelope(p.y);
  if (band <= 0.0) return 0.0;
  vec3 q = p*1.85;
  float shape = noise(q)*0.57 + noise(q*2.03+7.0)*0.27;
  // The fine octaves and the erosion add at most 0.16: where the broad shape
  // cannot reach the coverage even with all of it, this is sky, and exactly
  // zero — most of a clear or broken sky is, so most samples stop here.
  if (shape + 0.16 < u_coverage) return 0.0;
  if (far < 0.99) {
    // Fine erosion follows the billow edge, leaving a dense interior.
    float fine = noise(q*4.07+13.0)*0.11 + noise(q*8.13)*0.05 - (1.0-noise(q*7.0))*0.09;
    shape += mix(fine, 0.035, far);
  } else {
    shape += 0.035;
  }
  return smoothstep(u_coverage,u_coverage+0.18,shape)*band;
}
// The shadow taps: the two broad octaves carry the billows' mass, which is all
// a light ray integrated over a third of the deck can see of them. The constant
// is what the dropped octaves and the erosion add on average (0.08 − 0.045), so
// the shadow sits on the same deck the eye sees.
float densityLite(vec3 p) {
  vec3 q = p*1.85;
  float shape = noise(q)*0.57 + noise(q*2.03+7.0)*0.27 + 0.035;
  return smoothstep(u_coverage,u_coverage+0.18,shape)*envelope(p.y);
}
float stars(vec2 uv) {
  vec2 p = uv * vec2(u_resolution.x/u_resolution.y,1.0) * 210.0;
  vec2 cell = floor(p);
  float seed = hash(cell);
  if (seed < 0.985) return 0.0;
  vec2 center = vec2(hash(cell+13.2),hash(cell+71.9));
  float star = exp(-length(fract(p)-center)*55.0);
  return star * (0.65+0.35*sin(u_time*0.35+seed*230.0));
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
  if (sunVisible > 0.0) {
    color = mix(color,warm,exp(-sunDistance*3.5)*0.32*sunVisible);
    color = mix(color,warm,exp(-sunDistance*10.0)*0.7*sunVisible);
    color = mix(color,mix(warm,vec3(1.0),0.85),exp(-sunDistance*14.0)*0.95*sunVisible);
    float disc = 1.0-smoothstep(0.015,0.018,sunDistance);
    color = mix(color,vec3(1.0,0.995,0.96),disc*sunVisible);
  }

  // What the hand has wiped out of the mist, with a torn edge.
  float clear = 0.0;
  if (u_wipeOn > 0.5) {
    float mask = texture2D(u_wipe,uv).a;
    if (mask > 0.001) clear = smoothstep(0.08,0.8,mask*(0.7+0.6*noise(vec3(uv*vec2(aspect,1.0)*22.0,u_time*0.05))));
  }

  // The moon, where the shared scene stages it, lit from the side the sun is
  // on. By day it is the pale disc the scene allows; the sky shows through.
  if (u_moonVisible > 0.001) {
    vec2 moonDelta = (uv-u_moon)*vec2(aspect,1.0);
    float moonRadius = 0.018*u_moonSize;
    vec2 mp = moonDelta/moonRadius;
    float r2 = dot(mp,mp);
    float night = 1.0-smoothstep(0.0,0.35,u_daylight);
    color += vec3(0.6,0.7,0.9)*exp(-length(moonDelta)*34.0)*0.035*night*u_moonVisible;
    if (r2 < 1.2) {
      float moonDisc = 1.0-smoothstep(0.94,1.0,sqrt(r2));
      float z = sqrt(max(0.0,1.0-r2));
      vec2 toSun = u_sun-u_moon;
      toSun = length(toSun) > 1e-4 ? normalize(toSun*vec2(aspect,1.0)) : vec2(1.0,0.0);
      float angle = u_moonPhase*6.2831853;
      vec3 light = vec3(toSun*abs(sin(angle)),-cos(angle));
      float moonLit = smoothstep(-0.05,0.08,dot(vec3(mp,z),light));
      float moonTexture = 0.85+0.15*fbm(vec3(mp*7.0,3.0));
      float pale = mix(0.35,1.0,night);
      color = mix(color,vec3(0.78,0.85,0.92)*moonTexture,moonDisc*moonLit*u_moonVisible*pale);
    }
  }
  if (u_stars > 0.001) color += vec3(0.7,0.8,1.0)*stars(uv)*u_stars*(1.0-uv.y*0.7);

  // The meteor: a head and its train, under the clouds — a meteor behind a
  // cloud is simply hidden, which is the truth.
  if (u_meteorGlow > 0.001) {
    vec2 a = u_meteor.zw, b = u_meteor.xy;
    vec2 pa = (uv-a)*vec2(aspect,1.0), ba = (b-a)*vec2(aspect,1.0);
    float h = clamp(dot(pa,ba)/max(dot(ba,ba),1e-6),0.0,1.0);
    float d = length(pa-ba*h);
    float px = 1.0/u_resolution.y;
    float streak = exp(-d*d/(px*px*2.2+1e-7))*h*h;
    float head = exp(-length((uv-b)*vec2(aspect,1.0))/(px*2.5+0.0015));
    color += vec3(0.86,0.92,1.0)*(streak*0.85+head)*u_meteorGlow;
  }

  // A shallow world-space cloud volume: integration preserves cloud occlusion,
  // self-shadow, sunlit rims and parallax rather than scrolling a flat texture.
  // The camera slides with the tilt; the sun, moon and stars are at infinity
  // and stay where they are, so the nearest billows move most.
  vec3 ray = normalize(vec3((uv.x-0.5)*aspect,0.25+(1.0-uv.y)*0.95,1.0));
  // The deck moves WITH the wind: a point of cloud that has drifted by
  // u_drift is found by looking that far back along it.
  vec3 origin = vec3(u_camera,0.0,0.0)-u_drift;
  float start = 1.35/ray.y;
  float stepSize = (3.15-1.35)/ray.y/${MARCH_STEPS}.0;
  float transmittance = 1.0;
  vec3 cloudColor = vec3(0.0);
  float keep = 1.0-clear*0.9;
  // Aerial perspective: distant cloud takes on the horizon's colour.
  float far = smoothstep(2.2,4.2,start);
  if (u_cloud > 0.005 && keep > 0.02) {
    // Long steps near the horizon band; a wider per-pixel offset there
    // breaks the bands up (a whole step trades them for visible speckle).
    float jitter = hash(gl_FragCoord.xy)*stepSize*mix(0.25,0.5,far);
    float rimLight = pow(max(dot(ray,u_lightDir),0.0),12.0)*0.32;
    vec3 shade = mix(u_cloudShade,u_cloudShade*0.55,u_darkness);
    for (int i=0;i<${MARCH_STEPS};i++) {
      vec3 p = origin+ray*(start+(float(i)+0.5)*stepSize+jitter);
      float d = density(p,far)*keep;
      if (d>0.005) {
        float shadow = densityLite(p+u_lightDir*0.32)*0.8+densityLite(p+u_lightDir*0.75)*0.45;
        float light = exp(-shadow*2.7);
        vec3 lit = mix(shade,u_cloudLight,clamp(light*0.87+rimLight*light,0.0,1.0));
        float extinction = 1.0-exp(-d*stepSize*u_extinction);
        cloudColor += transmittance*lit*extinction;
        transmittance *= 1.0-extinction;
        if (transmittance < 0.015) break;
      }
    }
  }
  cloudColor = mix(cloudColor,u_horizon*(1.0-transmittance),far*0.35);
  color = color*transmittance+cloudColor;
  // Wispy high cloud above the cumulus deck, and low moving mist in fog/rain.
  float cirrus = smoothstep(0.57,0.78,fbm(vec3(uv.x*4.0+u_time*0.002-u_drift.x*0.2,uv.y*13.0,8.0)));
  color = mix(color,u_cloudLight,cirrus*0.1*u_cloud*(1.0-u_density*0.5)*keep);
  if (u_fog > 0.001) {
    float mist = u_fog*(0.5+uv.y*0.38+noise(vec3(uv*3.0+vec2(-u_drift.x*0.3,0.0),u_time*0.008))*0.12);
    color = mix(color,mix(u_horizon,u_cloudLight,0.25),clamp(mist*(1.0-clear),0.0,0.94));
  }

  // The same event illuminates the cloud volume and the display-resolution bolt.
  if (u_lightning > 0.0) {
    float flashFalloff = exp(-length((uv-u_lightningPosition)*vec2(aspect,1.0))*3.2);
    color += vec3(0.62,0.74,1.0)*u_lightning*flashFalloff*(0.35+0.65*(1.0-transmittance));
  }
  if (sunVisible > 0.0) color = mix(color,warm,exp(-sunDistance*8.0)*0.13*sunVisible*(0.12+0.88*transmittance)*(1.0-u_storm));
  // The theme's exposure, under the veil (a CSS layer above), as the Sky's.
  color *= u_exposure;
  color += (hash(gl_FragCoord.xy+17.0)-0.5)/255.0;
  gl_FragColor = vec4(color,1.0);
}`;
