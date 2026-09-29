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
 * What is behind the volume is the Sky's (wallpaper/shader.ts), ported: the
 * gradient and the sun's glow widening and warming as it falls, the sun's disc
 * and halo, the moon as a lit sphere with seas, and the two star fields. The
 * volume is Atmosphere's own; toward the horizon it gives way to what it
 * averages to, as the Sky's decks do through the window.
 *
 * Cost is the raymarch: MARCH_STEPS samples of `density`, and at each sample
 * that hits cloud two cheaper samples toward the sun. The noise is one texture
 * fetch per octave (the red and green channels hold two z-slices, see
 * renderer.ts), the shadow taps and the distant deck skip the fine octaves
 * they cannot resolve, the horizon skips the march altogether, and the march
 * stops once the cloud in front is opaque.
 */
export const MARCH_STEPS = 20;

export const fragmentShader = `
precision highp float;
varying vec2 v_uv;
uniform vec2 u_resolution;
uniform sampler2D u_noise;
uniform sampler2D u_wipe;
uniform float u_time;
uniform vec3 u_zenith, u_horizon, u_glow, u_cloudLight, u_cloudShade;
uniform float u_glowStrength, u_sunElevation;
uniform vec2 u_sun, u_moon;
uniform vec3 u_drift;
uniform vec3 u_lightDir;
uniform float u_camera, u_seed;
uniform float u_daylight, u_cloud, u_fog, u_storm, u_moonPhase;
uniform float u_moonVisible, u_moonSize, u_stars, u_density, u_darkness;
uniform float u_coverage, u_shadowCoverage, u_extinction, u_exposure;
uniform float u_lightning;
uniform vec2 u_lightningPosition;
uniform vec4 u_meteor;
uniform float u_meteorGlow;
uniform float u_wipeOn;

// The sun and the moon are the same size in the sky, as the Sky has them.
const float DISC_R = 0.03;

float sq(float x) { return x*x; }
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
vec2 hash2(vec2 p) { return fract(sin(vec2(dot(p,vec2(127.1,311.7)),dot(p,vec2(269.5,183.3))))*43758.5453); }
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
// the deck in long steps, and the fine octaves and the erosion alias there.
// Past a point they are swapped for their mean — which is both what the eye
// resolves at that range and the cheaper sample.
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
// is what the dropped octaves and the erosion add on average (0.08 − 0.045).
//
// They measure against their own threshold, never below the middle of the
// noise: under an overcast the deck is everywhere, and a shadow read against
// the deck's own coverage would be total everywhere — one flat grey slab. Read
// against the thick cores only, the base keeps the thin and the heavy parts
// the Sky's two decks show.
float densityLite(vec3 p) {
  vec3 q = p*1.85;
  float shape = noise(q)*0.57 + noise(q*2.03+7.0)*0.27 + 0.035;
  // Its edge widens by as much as its threshold was raised: a raised, narrow
  // edge draws the shading as hard contours, which the view up through the
  // deck stretches into streaks. On a broken sky the two are equal and this
  // is the deck's own edge.
  return smoothstep(u_shadowCoverage,u_shadowCoverage+0.18+(u_shadowCoverage-u_coverage),shape)*envelope(p.y);
}

// ---- Behind the volume: the Sky's, ported (wallpaper/shader.ts) ------------

vec3 skyBase(float upY, vec2 p, vec2 sunP) {
  vec3 sky = mix(u_horizon, u_zenith, pow(clamp(upY,0.0,1.0),0.8));
  // Sun glow: wide and warm near the horizon, tight and white overhead.
  float lowSun = 1.0-smoothstep(-8.0,14.0,u_sunElevation);
  float d = length(p-sunP);
  float radius = mix(0.42,1.15,lowSun);
  sky += u_glow*exp(-(d*d)/(radius*radius))*u_glowStrength*mix(0.55,0.85,lowSun);
  // Horizon warmth band at dawn and dusk.
  sky += u_glow*exp(-sq((upY-0.16)/0.28))*lowSun*u_glowStrength*0.26;
  // The disc, when the sun is up. The volume, not the cover, decides whether
  // it is seen: a cloud in front hides it, a gap shows it.
  float disc = smoothstep(DISC_R+0.007,DISC_R-0.007,d);
  float halo = exp(-(d*d)/0.005);
  float sunVis = smoothstep(-1.5,2.0,u_sunElevation);
  sky += (vec3(1.0,0.97,0.9)*disc*0.8 + u_glow*halo*0.28)*sunVis;
  return sky;
}

float stars(vec2 p, float upY, float amount) {
  if (amount < 0.002) return 0.0;
  float s = 0.0;
  // Two densities: a sparse bright field and a fine dust.
  for (int i = 0; i < 2; i++) {
    float scale = i == 0 ? 42.0 : 110.0;
    vec2 sp = p*scale + u_seed*3.1 + float(i)*91.0;
    vec2 cell = floor(sp);
    vec2 rnd = hash2(cell);
    float present = step(i == 0 ? 0.86 : 0.93, hash(cell+5.3));
    float dist = length(fract(sp)-(0.15+rnd*0.7));
    float star = smoothstep(i == 0 ? 0.075 : 0.05, 0.0, dist)*present*(0.6+0.4*rnd.x);
    float twinkle = 0.55+0.45*sin(u_time*(1.2+rnd.x*2.0)+rnd.y*6.2831);
    s += star*twinkle*(i == 0 ? 0.85 : 0.4);
  }
  // Fade stars toward the horizon haze.
  return s*amount*smoothstep(0.05,0.45,upY);
}

// The moon as a lit sphere: its terminator a gradient of grazing light, the
// seas dark and smooth, regolith that stays bright to the limb — and added to
// the sky, never mixed into it, so under a lifted light-theme night it is
// still the brightest thing there. Lit from the side the sun is on.
vec3 moon(vec2 p, vec2 moonP, vec2 sunP, float visible) {
  if (visible < 0.002) return vec3(0.0);
  float r = DISC_R*u_moonSize;
  vec2 d = (p-moonP)/r;
  float md = length(d);
  if (md > 5.0) return vec3(0.0);
  float px = 1.0/(u_resolution.y*r);
  float disc = smoothstep(1.0,1.0-max(px*1.6,0.012),md);
  float turn = u_moonPhase*6.2831853;
  float k = cos(turn);
  vec2 toSun = sunP-moonP;
  toSun = length(toSun) > 1e-4 ? normalize(toSun) : vec2(1.0,0.0);
  vec3 col = vec3(0.0);
  float lit = 0.0;
  if (md < 1.0) {
    vec3 lightDir = vec3(toSun*abs(sin(turn)),-k);
    float z = sqrt(max(0.0,1.0-md*md));
    vec3 n = vec3(d,z);
    vec2 q = (md > 1e-4 ? d/md : vec2(0.0))*acos(clamp(z,-1.0,1.0));
    float sea = smoothstep(0.42,0.66,fbm(vec3(q*1.15+4.5,1.7)));
    float lam = clamp(dot(n,lightDir),0.0,1.0);
    float mu = max(z,0.05);
    // Lommel-Seeliger for the backscatter, a third of Lambert for roundness.
    float shade = 1.32*(lam/(lam+mu)) + 0.34*lam;
    shade *= 1.0-0.15*smoothstep(0.5,1.0,md);
    lit = smoothstep(-0.02,0.13,dot(n,lightDir))*disc;
    float albedo = mix(1.02,0.71,sea)*(1.0+0.09*(fbm(vec3(q*4.5+2.0,5.3))-0.5));
    col = vec3(0.97,0.96,0.92)*albedo*shade*lit + vec3(0.18,0.2,0.26)*disc*(1.0-lit)*0.03;
  }
  // Scattered light in front of the moon, so the dark side is never a hole.
  float illum = 0.5-0.5*k;
  col += vec3(0.75,0.82,1.0)*exp(-md*md*0.22)*0.1*(0.35+0.65*illum)*(1.0-lit*0.6);
  return col*visible;
}

void main() {
  vec2 uv = vec2(v_uv.x, 1.0-v_uv.y);
  float upY = 1.0-uv.y;
  float aspect = u_resolution.x/u_resolution.y;
  // The Sky's frame: height units, y up.
  vec2 p = vec2(uv.x*aspect, upY);
  vec2 sunP = vec2(u_sun.x*aspect, 1.0-u_sun.y);
  vec2 moonP = vec2(u_moon.x*aspect, 1.0-u_moon.y);
  float sunDistance = length(p-sunP);

  // What the hand has wiped out of the mist, with a torn edge.
  float clear = 0.0;
  if (u_wipeOn > 0.5) {
    float mask = texture2D(u_wipe,uv).a;
    if (mask > 0.001) clear = smoothstep(0.08,0.8,mask*(0.7+0.6*noise(vec3(uv*vec2(aspect,1.0)*22.0,u_time*0.05))));
  }

  vec3 color = skyBase(upY, p, sunP);
  color += vec3(0.9,0.93,1.0)*stars(p, upY, u_stars);
  color += moon(p, moonP, sunP, u_moonVisible);

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
  vec3 origin = vec3(u_camera,0.0,0.0)-u_drift+vec3(u_seed*3.7,0.0,u_seed*1.3);
  float start = 1.35/ray.y;
  float stepSize = (3.15-1.35)/ray.y/${MARCH_STEPS}.0;
  float transmittance = 1.0;
  vec3 cloudColor = vec3(0.0);
  float keep = 1.0-clear*0.9;
  float far = smoothstep(2.2,4.2,start);
  // Toward the horizon the deck gives way to what it averages to — the cover
  // it has, in the colour it is on the whole — as the Sky's decks do through
  // the window, and as a real deck does: it closes into one tone. Past the
  // point where only the average shows, the march is skipped.
  float toAverage = smoothstep(2.6,4.6,start);
  float avgCov = smoothstep(0.1,0.9,u_cloud)*clamp(u_density+0.1,0.0,1.0)*keep;
  vec3 avgCol = mix(u_cloudLight,u_cloudShade,0.5*(0.35+0.65*u_darkness)) + u_glow*u_glowStrength*0.06;
  if (u_cloud > 0.005 && keep > 0.02 && toAverage < 0.999) {
    // Long steps near the horizon band; a wider per-pixel offset there
    // breaks the bands up (a whole step trades them for visible speckle).
    float jitter = hash(gl_FragCoord.xy)*stepSize*mix(0.25,0.5,far);
    float rimLight = pow(max(dot(ray,u_lightDir),0.0),12.0);
    vec3 shade = mix(u_cloudShade,u_cloudShade*0.7,u_darkness);
    // A storm's cloud is dark through and through, not a white deck with dark
    // holes: darkness takes the lit side toward the shade as well, as the
    // Sky's thick × darkness mix does.
    vec3 lightCol = mix(u_cloudLight,shade,u_darkness*0.45);
    // A low sun lights the deck from underneath in its own colour — sunset
    // cloud glows rather than standing in silhouette against the glow.
    float lowSun = (1.0-smoothstep(-8.0,14.0,u_sunElevation))*smoothstep(-6.0,-1.0,u_sunElevation);
    vec3 underlight = u_glow*u_glowStrength*lowSun*0.55;
    for (int i=0;i<${MARCH_STEPS};i++) {
      vec3 pos = origin+ray*(start+(float(i)+0.5)*stepSize+jitter);
      float d = density(pos,far)*keep;
      if (d>0.005) {
        float shadow = densityLite(pos+u_lightDir*0.32)*0.8+densityLite(pos+u_lightDir*0.75)*0.45;
        float light = exp(-shadow*2.7);
        vec3 lit = mix(shade,lightCol,clamp(light*0.87+rimLight*light*0.32,0.0,1.0));
        // The silver lining toward the sun, in the sun's own colour, and the
        // low sun's light on the underside (strongest where the base is thin).
        lit += u_glow*u_glowStrength*(rimLight*0.45+0.08)*light + underlight*(0.35+0.65*light);
        float extinction = 1.0-exp(-d*stepSize*u_extinction);
        cloudColor += transmittance*lit*extinction;
        transmittance *= 1.0-extinction;
        if (transmittance < 0.015) break;
      }
    }
  }
  transmittance = mix(transmittance,1.0-avgCov,toAverage);
  cloudColor = mix(cloudColor,avgCol*avgCov,toAverage);
  color = color*transmittance+cloudColor;
  // Wispy high cloud above the cumulus deck.
  float cirrus = smoothstep(0.57,0.78,fbm(vec3(uv.x*4.0+u_time*0.002-u_drift.x*0.2,uv.y*13.0,8.0)));
  color = mix(color,u_cloudLight,cirrus*0.1*u_cloud*(1.0-u_density*0.5)*keep*(1.0-toAverage));
  // Fog: the Sky's drifting low-frequency veil, denser toward the bottom.
  if (u_fog > 0.001) {
    vec3 fogCol = mix(u_horizon,u_cloudLight,0.35);
    float fn = 0.7+0.3*fbm(vec3(p*1.8+vec2(u_time*0.02-u_drift.x*0.3,0.0)+u_seed,2.5));
    float fa = u_fog*(0.45+0.55*(1.0-upY))*fn*(1.0-clear);
    color = mix(color,fogCol,clamp(fa,0.0,0.95));
    // Clear air scatters less than mist: the swath sits a shade darker.
    color *= 1.0-0.05*clear*u_fog;
  }

  // The same event illuminates the cloud volume and the display-resolution bolt.
  if (u_lightning > 0.0) {
    float flashFalloff = exp(-length((uv-u_lightningPosition)*vec2(aspect,1.0))*3.2);
    color += vec3(0.62,0.74,1.0)*u_lightning*flashFalloff*(0.35+0.65*(1.0-transmittance));
  }
  // Forward scatter: the sun's glow through thin cloud.
  float sunVisible = smoothstep(-1.5,2.0,u_sunElevation);
  if (sunVisible > 0.0) color += u_glow*u_glowStrength*exp(-sunDistance*8.0)*0.1*sunVisible*(1.0-transmittance)*(1.0-u_storm);
  // The theme's exposure, under the veil (a CSS layer above), as the Sky's.
  color *= u_exposure;
  color += (hash(gl_FragCoord.xy+17.0)-0.5)/255.0;
  gl_FragColor = vec4(color,1.0);
}`;
