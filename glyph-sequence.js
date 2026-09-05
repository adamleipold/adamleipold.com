/* =========================================================================
   glyph-sequence.js — the Glyph3D sequence runtime (prototype, glyph-sequence-page).

   ONE FIELD, MANY HOMES. A single instanced field of marks lives behind a
   whole page. Every mark has a home in every scene of a glyph-sequence/0.1
   document — a place, a color, a glyph, or "no home here" — and the page's
   scroll position is a key into that sequence. As the reader scrolls, each
   mark leaves its home in one scene and flies, on its own line, to its home
   in the next; marks with no home in a scene are stars in the ambient field.
   The dissolve of the living page (glyph-page.js) is the special case with
   one scene; this is the Astra / Dala move: the stars become the scene and
   the scene becomes stars again (0.2, the Jesus in Prayer page: the marks
   fly in from the stars on load, the face whole, the painting thinned by
   what is lit and what differs — never by an outline — the stars colored
   from the painting's sky and orbiting behind him, the city's lights alive,
   the camera still; 0.2.2: on a phone the painting fits the band above its
   words and holds while they scroll past, and the reader's light rests on
   an authored point — the moon — whenever no pointer is on the page;
   0.2.3: the painting lifts slowly as the rest of its words scroll past;
   0.2.4: on a phone the words' scroll dissolves the painting, slowly, all
   the way to the cloud — the flight spans the words' leaving, then waits;
   0.2.5: the step the reader rests on is marked on its element, class
   glyph-here, so the page can time its own motion to their arrival).

   The scenes are sampled HERE, from the artwork, when the page loads: each
   scene names a crop of the painting, a grid width, and a density rule (a
   base, feathered regions, an edge term, a vignette) — the reader's device
   does the sampling, so a 340 KB JPEG is the whole payload and the artwork
   never leaves the page. (The studio's baked glyph-page documents —
   treatments, authored fonts — are a later input; the format leaves room.)
   Marks are paired across scenes by Hilbert order, nested largest scene
   first, so a smaller scene is made entirely of marks of the larger one and
   neighbors leave together and land together. Homes live in a float texture
   the vertex shader reads for both ends of every flight; nothing about the
   flight is computed per mark on the CPU.

   Shaders: the foundry v0.3 mark, the page's fragment shader with the
   reader's light (living-page-r8: the pointer is a lantern, not a hole),
   and a new vertex path: two homes, a departure wave, an arc and a tumble,
   the star field with its intro flight.

   Honesty: every value the document carries that this runtime cannot honor
   is REPORTED (console.warn + GlyphSequence.notes) and replaced by a stated
   substitute — never silently approximated.

   Ships as a self-hosted classic script (site CSP forbids inline JS).
   Sequence source, in priority order:
     1. window.GLYPH_SEQUENCE               (single-file preview builds)
     2. <script data-sequence="...">        (fetched JSON — the site shape)
   No frameworks, no other globals: window.GlyphSequence is the one export.
   WebGL2 unavailable → the page keeps its background and shows its
   fallback image; the words never depend on the canvas — the parting title
   lays itself out from the scroll position alone.
   ========================================================================= */
(function(){
'use strict';

const SCRIPT=document.currentScript;
const SEQ_URL=(SCRIPT&&SCRIPT.dataset.sequence)||'./jesus-in-prayer.sequence.json';
/* 0.2 is additive over 0.1: stars.orbit / stars.palette, scene.keepOut, region fill / glint,
   motion.turn — a 0.1 document reads exactly as before */
const SPECS=['glyph-sequence/0.1','glyph-sequence/0.2'], SPEC=SPECS[SPECS.length-1], ENGINE='glyph3d-sequence-0.2.5';
/* the document's spec, once read: 0.1 keeps its linear feather and its whole-intro star gather */
let DOC01=false;
// the phone budget measured on the living page (174,720 instances at 56–60 fps on Adam's
// iPhone); this runtime fetches two homes per vertex, so treat it as an upper bound
const BUDGET=174000;

/* ---------- utils (carried from the page runtime) ---------- */
function hash32(x){ x|=0; x=Math.imul(x^x>>>16,0x45d9f3b); x=Math.imul(x^x>>>16,0x45d9f3b); return (x^x>>>16)>>>0; }
function seedFloat(cell,salt){ return hash32(cell*2654435761 ^ salt)/4294967296; }
function perspective(fovy,ar,n,f){ const t=1/Math.tan(fovy/2);
  return new Float32Array([t/ar,0,0,0, 0,t,0,0, 0,0,(f+n)/(n-f),-1, 0,0,2*f*n/(n-f),0]); }
function lookAt(e,c,u){
  let z=[e[0]-c[0],e[1]-c[1],e[2]-c[2]]; let L=Math.hypot(...z); z=z.map(v=>v/L);
  let x=[u[1]*z[2]-u[2]*z[1],u[2]*z[0]-u[0]*z[2],u[0]*z[1]-u[1]*z[0]];
  L=Math.hypot(...x)||1; x=x.map(v=>v/L);
  const y=[z[1]*x[2]-z[2]*x[1],z[2]*x[0]-z[0]*x[2],z[0]*x[1]-z[1]*x[0]];
  return new Float32Array([x[0],y[0],z[0],0,x[1],y[1],z[1],0,x[2],y[2],z[2],0,
    -(x[0]*e[0]+x[1]*e[1]+x[2]*e[2]),-(y[0]*e[0]+y[1]*e[1]+y[2]*e[2]),-(z[0]*e[0]+z[1]*e[1]+z[2]*e[2]),1]); }
function mul(a,b){ const o=new Float32Array(16);
  for(let i=0;i<4;i++)for(let j=0;j<4;j++){ let s=0; for(let k=0;k<4;k++)s+=a[k*4+j]*b[i*4+k]; o[i*4+j]=s; }
  return o; }
const clamp=(v,a,b)=>v<a?a:v>b?b:v, smooth=t=>t*t*(3-2*t), mix=(a,b,t)=>a+(b-a)*t;
/* Hilbert index of (x,y) on an n×n grid (n a power of two): the pairing order —
   consecutive ranks are spatial neighbors, so marks paired by rank fly together */
function hilbert(n,x,y){ let d=0;
  for(let s=n>>1;s>0;s>>=1){ const rx=(x&s)?1:0, ry=(y&s)?1:0; d+=s*s*((3*rx)^ry);
    if(ry===0){ if(rx===1){ x=s-1-x; y=s-1-y; } const t=x; x=y; y=t; } }
  return d; }
/* dither threshold: interleaved gradient noise (Jimenez 2014) — an even, blue-ish
   scatter at any density, where a plain hash clumps and a Bayer matrix shows its grid */
function ign(x,y){ const v=52.9829189*((0.06711056*x+0.00583715*y)%1); return v-Math.floor(v); }

/* ---------- the honesty channel ---------- */
const NOTES=[];
function note(msg){ NOTES.push(msg); console.warn('glyph-sequence: '+msg); }
/* one reader for every number the document carries: absent → the default, silently;
   present but not a finite JSON number → reported, the default used; out of range →
   reported, the bound used. So no value is ever silently coerced or clamped. */
function num(v,def,lo,hi,name){
  if(v===undefined||v===null) return def;
  if(typeof v!=='number'||!Number.isFinite(v)){ note(name+' '+JSON.stringify(v)+' is not a number — '+def+' used'); return def; }
  const c=clamp(v,lo,hi); if(c!==v) note(name+' '+v+' is outside ['+lo+', '+hi+'] — '+c+' used'); return c; }

/* ---------- reduced motion: decided at script start, read LIVE ----------
   ?motion=full|reduce overrides the device (an RDP session reports reduce for every
   browser); without it MediaQueryList.matches is read every frame, as the page runtime
   does, so a setting changed while the page is open takes effect. Mirrored on <html
   data-motion> so the page's own CSS can follow the same decision as the field. */
const Q=new URLSearchParams(location.search), QM=Q.get('motion');
const MQ=matchMedia('(prefers-reduced-motion: reduce)');
const prm={get matches(){ return QM==='reduce'?true:QM==='full'?false:MQ.matches; }};
const RM_BY=(QM==='reduce'||QM==='full')?'?motion='+QM:'device';
let motionShown=null;
function syncMotion(){
  const rm=prm.matches; if(rm===motionShown) return; motionShown=rm;
  API.motion=rm?'reduced':'full';
  // stamped as data-glyph-motion: the chip's own hook is [data-motion], and a selector
  // for it must never match <html> (it did once, and the chip's text replaced the page)
  document.documentElement.dataset.glyphMotion=API.motion;
  const chip=document.querySelector('.chip[data-motion], [data-motion]:not(html)');
  if(chip){ chip.hidden=!rm; chip.textContent='motion: reduced by '+RM_BY;
    chip.title=rm?'Reduced motion ('+RM_BY+'): the flights follow your scroll in straight lines, the ambient motion is still, the intro is a fade. '+(QM?'Remove ?motion= from the address to follow the device.':'Add ?motion=full to the address to override.'):''; }
}

/* ---------- the parting title: lays itself out from the scroll alone ----------
   Independent of the canvas by design: on every fail path (no WebGL2, a lost context,
   an artwork that did not load) the words still part and fade as the reader scrolls. */
let splits=null;
function splitTitle(){
  return [...document.querySelectorAll('[data-split]')].map(el=>{
    if(!el.dataset.splitDone){ el.dataset.splitDone='1';
      const txt=el.textContent; el.textContent=''; el.setAttribute('aria-label',txt);
      [...txt].forEach(ch=>{ const s=document.createElement('span'); s.textContent=ch; s.setAttribute('aria-hidden','true'); el.appendChild(s); }); }
    return {el,dir:el.dataset.split==='right'?1:-1,letters:[...el.children]}; });
}
function layoutTitle(){
  if(!splits) splits=splitTitle();
  const V=innerHeight||1, p=clamp(scrollY/(V*0.7),0,1), op=1-smooth(p), rm=prm.matches;
  for(const s of splits){
    s.el.style.opacity=op.toFixed(3);
    s.letters.forEach((l,i)=>{ const idx=s.dir>0?i:(s.letters.length-1-i);
      l.style.transform=rm?'':'translateX('+(s.dir*p*(40+idx*26)).toFixed(1)+'px)'; });
    s.el.style.visibility=op<0.01?'hidden':''; }
}

/* ---------- shaders ---------- */
const VS=`#version 300 es
in vec3 aPos; in vec3 aNormal; in vec3 aRand; in vec3 aStar;
uniform highp sampler2D uHomes;   /* the homes texture: per scene, a block of position rows, color rows, then extra rows (glint, fill) */
uniform int uHomesW, uRowsPer, uSceneA, uSceneB;
uniform float uF, uSpread, uSpin, uArc, uPitchA, uPitchB, uStarSize, uIntro, uStarRate, uDist;
uniform vec4 uHole;               /* the keep-out (a face): world xy of its center at the scene plane and its radii; zero radii = none */
uniform vec4 uExchange;           /* the exchange at rest: marks duty, stars duty, period (s), reach — zero duties = none */
uniform vec3 uShiftA, uShiftB;    /* where the assembled scene sits (the page's column layout) */
uniform mat4 uMVP; uniform mat3 uRot; uniform float uGlyphCount;
uniform float uTime,uSparkle,uBreath,uShimmer,uWakeS,uWakeR,uAspect,uMotionScale;
uniform vec2 uPointer,uPointerLag;
out vec3 vColor; out float vShade; out vec2 vUV; out float vGlint; out float vShim; out float vLight;
mat3 rotAxis(vec3 a,float t){ float c=cos(t),s=sin(t),o=1.0-c;
  return mat3(c+a.x*a.x*o,a.x*a.y*o-a.z*s,a.x*a.z*o+a.y*s,
              a.y*a.x*o+a.z*s,c+a.y*a.y*o,a.y*a.z*o-a.x*s,
              a.z*a.x*o-a.y*s,a.z*a.y*o+a.x*s,c+a.z*a.z*o); }
/* the star field: a three-armed spiral in the picture plane, behind the scene plane,
   with a void at its heart where the scenes assemble; it turns at uStarRate (radians a
   second — the document's stars.orbit; zero under reduced motion) */
vec3 starPos(int id,vec3 h){
  float r=0.34+1.55*sqrt(h.x);
  float arm=float(id-(id/3)*3)*2.0943951+(h.y-0.5)*0.9;
  float ang=arm+r*1.7+uTime*uStarRate;
  return vec3(r*cos(ang),r*sin(ang)*0.72,-0.35-h.z*0.9);
}
/* the keep-out (a face), seen from the camera (on the z axis, uDist away): the ellipse uHole
   at the scene plane covers, at depth z, the same ellipse scaled by (uDist−z)/uDist. A star
   inside it is not drawn, and from its edge out to 1.7× its radii it grows back to full
   size — a soft halo the stars fade into and out of as they orbit. Nothing is displaced,
   nothing piles up, no line: the field thins toward the face and never crosses it. */
float keepOut(vec2 p,float z){
  if(uHole.z<1e-5) return 1.0;
  float s=max((uDist-z)/uDist,0.05);
  vec2 d=(p-uHole.xy*s)/(uHole.zw*s);
  return smoothstep(1.0,1.7,length(d));
}
void fetchHome(int scene,int id,out vec4 p,out vec4 c,out vec4 x){
  int cx=id-(id/uHomesW)*uHomesW, cy=id/uHomesW, base=scene*3*uRowsPer;
  p=texelFetch(uHomes,ivec2(cx,base+cy),0);
  c=texelFetch(uHomes,ivec2(cx,base+uRowsPer+cy),0);
  x=texelFetch(uHomes,ivec2(cx,base+2*uRowsPer+cy),0);
}
void main(){
  int id=gl_InstanceID;
  vec4 pA,cA,xA,pB,cB,xB; fetchHome(uSceneA,id,pA,cA,xA); fetchHome(uSceneB,id,pB,cB,xB);
  bool sA=cA.a<0.0, sB=cB.a<0.0;            /* glyph −1 = no home in that scene: a star */
  /* a mark whose home does not change hands — a star at both ends, or a step that names
     the scene it is already in — waits: no arc, no tumble, no shrink, and its ambient
     motion and the reader's light stay on it (index.html: "becomes a star again and waits") */
  bool still=(sA&&sB)||(uSceneA==uSceneB);
  vec3 sp=starPos(id,aRand);
  /* the intro: stars arrive from a far scatter, spiraling in (replayable) */
  vec3 far=sp+vec3((aRand.x-0.5)*7.0,(aRand.y-0.5)*7.0,-4.0-aRand.z*3.0);
  float ie=uIntro*uIntro*(3.0-2.0*uIntro);
  vec3 spI=mix(far,sp,ie);
  float ko=keepOut(spI.xy,spI.z);            /* a star in the keep-out is not drawn; near it, smaller */
  vec3 PA=sA?spI:(uRot*pA.xyz+uShiftA), PB=sB?spI:(uRot*pB.xyz+uShiftB);
  vec3 colA=sA?aStar:cA.rgb, colB=sB?aStar:cB.rgb;
  float szA=sA?uStarSize*ko:uPitchA*xA.y, szB=sB?uStarSize*ko:uPitchB*xB.y;   /* a mark's fill is its own (extra.y) */
  float edA=sA?0.0:pA.w, edB=sB?0.0:pB.w;
  float gA=max(cA.a,0.0), gB=max(cB.a,0.0);
  /* the wave: a mark's lead grows with its radius in its assembled home — the scene it is
     leaving, or, leaving a star, the scene it is joining — so the heart moves first and
     the rim last: leaving a scene it peels from the center out, arriving from the stars
     the rim lands last (the face closes like a hand). Because uF runs both ways with the
     scroll, the same shaping opens a scene from its rim on the way back up. Each mark is
     a little early or late by its seed, so the field peels rather than pops. */
  vec2 ref=sA?pB.xy:pA.xy;
  float order=(sA&&sB)?1.0:clamp(length(ref)/1.1,0.0,1.0);
  float lead=(0.55*order+0.45*aRand.x)*uSpread;
  float t=clamp((uF-lead)/max(1.0-uSpread,0.001),0.0,1.0);
  float e=t*t*(3.0-2.0*t);
  float fly=still?0.0:sin(3.14159265*e);
  float h1=fract(aRand.x*91.17), h2=fract(aRand.y*57.31);
  /* the exchange (0.2, motion.exchange): at rest the cloud and the painting are ONE
     population. A restless mark (extra.z = 1 − its importance: the dust and the rim, never
     the face) now and then lifts off its home, flies out toward its place in the cloud
     (reach of the way) and returns; a star with a visiting place (glyph −2: an unkept cell
     of the painting, written in the scene's rows) now and then flies in, holds that cell in
     the painting's own color, and leaves. Each on its own clock (period ±30 %), a sine
     out-and-back with the flight's own arc, tumble and shrink. Still under reduced motion,
     never mid-flight, never during the fly-in. */
  if(still&&uExchange.x+uExchange.y>0.0){
    float duty=(sA?uExchange.y:uExchange.x)*xA.z;
    if(duty>0.0&&(!sA||cA.a<-1.5)){
      float ph=fract(uTime/(uExchange.z*(0.7+0.6*h1))+h2*7.31);
      if(ph<duty){
        float ex=sin(3.14159265*ph/duty);
        if(sA){ PB=uRot*pA.xyz+uShiftA; colB=cA.rgb; szB=uPitchA*xA.y; edB=pA.w; gB=0.0; e=ex; }
        else  { PB=spI; colB=aStar; szB=uStarSize*ko; edB=0.0; gB=gA; e=ex*uExchange.w; }
        fly=sin(3.14159265*ex);
      }
    }
  }
  vec3 base=mix(PA,PB,e);
  vec3 arcDir=normalize(vec3((aRand.xy-0.5)*2.0,0.9+aRand.z));
  base+=arcDir*fly*(0.18+0.3*aRand.z)*uArc;
  float size=mix(szA,szB,e)*(1.0-0.35*fly);
  if(fly>0.0001) size*=mix(1.0,keepOut(base.xy,base.z),fly);   /* a flight passing the face passes behind it; its ends are exact */
  vec3 col=mix(colA,colB,e);
  float glyph=e<0.5?gA:gB;
  float edge=mix(edA,edB,e);
  float lum=dot(col,vec3(0.2126,0.7152,0.0722));
  float ph=fract(uTime/9.0+h1);
  float gateS=step(h2,uSparkle);
  float env=pow(max(0.0,1.0-abs(ph-0.5)/0.02),3.0);
  float glint=gateS*env*(0.4+0.6*lum);
  /* the lit windows and roofs (extra.x, per mark, from the document's glint regions): each
     on its own slow clock, a brief brightening every 6–12 s — a few at a time, a city at
     night. At rest only: a mark mid-flight carries no window. */
  float gW=e<0.5?xA.x:xB.x;
  float phC=fract(uTime/(6.0+6.0*h2)+h1*1.7);
  float envC=pow(max(0.0,1.0-abs(phC-0.5)/0.04),2.0);
  glint=max(glint,gW*envC*(1.0-fly))*uMotionScale;
  vec3 local=vec3(aPos.xy*size,0.0); vec3 nrm=aNormal;
  if(fly>0.0001&&uSpin>0.0){
    vec3 axis=normalize(aRand*2.0-1.0+vec3(0.0,0.0,0.37));
    mat3 R=rotAxis(axis,uSpin*fly*(2.5+3.0*aRand.y)); local=R*local; nrm=R*nrm; }
  local*=1.0+glint*0.18;
  float gate=(1.0-fly)*uMotionScale;      /* ambient motion at rest, never mid-flight */
  base.z+=sin(uTime*0.5+aRand.x*6.2832)*0.012*uBreath*gate;
  /* the reader's light (living-page-r8, carried from glyph-page.js with the home as the
     anchor and without the studio's emphasis term): within reach a mark brightens — a
     lantern core with slow spokes, a wider spill that fades out — and the nearest rise a
     hair; per-mark lag (h2) draws the trail behind a moving pointer */
  vLight=0.0;
  if(uWakeS>0.0001){
    vec4 c0=uMVP*vec4(base,1.0);
    vec2 ndc=c0.xy/max(abs(c0.w),0.0001);
    vec2 ptr=mix(uPointer,uPointerLag,h2);
    vec2 dv=(ndc-ptr)*vec2(uAspect,1.0);
    float d=length(dv);
    float reach=1.0-smoothstep(0.0,uWakeR,d);       /* edges in the defined order (GLSL ES 3.00 §8.3) */
    float core=1.0-smoothstep(0.0,uWakeR*0.4,d);
    float spill=1.0-smoothstep(0.0,uWakeR*2.2,d); spill*=spill;
    float ang=d>1e-5?atan(dv.y,dv.x):0.0;   /* atan(0,0) is undefined in GLSL — a mark exactly under the pointer must not go NaN */
    float spokes=0.85+0.15*cos(ang*9.0+uTime*0.7*uMotionScale);
    float li=(0.9*reach*spokes+0.5*core+0.35*spill)/1.75*(uWakeS/0.35);   /* the rings sum to 1.75 at the pointer: the light peaks AT the authored strength */
    vLight=li*(1.0-fly);
    base.z+=reach*uWakeS*0.25*(1.0-fly)*uMotionScale;
  }
  vShim=edge*uShimmer*sin(uTime*0.8-length(base.xy)*5.0)*0.3*gate;
  vec3 w3=base+local;
  vec3 L=normalize(vec3(0.35,0.55,1.0));
  vShade=0.42+0.58*max(dot(normalize(nrm),L),0.0);
  vColor=col; vGlint=glint;
  vUV=vec2((aPos.x+0.5+glyph)/uGlyphCount,0.5-aPos.y);
  gl_Position=uMVP*vec4(w3,1.0);
}`;
const FS=`#version 300 es
precision highp float;
in vec3 vColor; in float vShade; in vec2 vUV; in float vGlint; in float vShim; in float vLight;
uniform sampler2D uAtlas; uniform float uMode; uniform vec3 uGold; uniform float uDiscard;
out vec4 outColor;
void main(){
  if(uMode>0.5){ float a=texture(uAtlas,vUV).a; if(a<uDiscard) discard; }
  vec3 c=vColor*vShade*(1.0+vShim);
  c=mix(c,uGold,clamp(vGlint*0.55,0.0,1.0));
  if(vLight>0.0001){
    c=c*(1.0+1.6*vLight)+uGold*(0.3*vLight);
    float m=max(c.r,max(c.g,c.b)); if(m>1.0) c/=m;
  }
  outColor=vec4(c,1.0);
}`;
const MOONGOLD=[0.914,0.788,0.510];

/* ---------- boot ---------- */
const API={ready:false,error:null,spec:SPEC,specs:SPECS.slice(),engine:ENGINE,count:0,assembled:0,stars:0,budget:BUDGET,scenes:[],timeline:[],notes:NOTES,
           key:()=>0,target:()=>0,anchors:()=>[],setKey:null,replay:null,motion:'full',rotate:null,rot:null,style:null,turn:true,intro:()=>1};
window.GlyphSequence=API;
let liveCanvas=null;
function fail(msg){ API.error=msg; document.documentElement.classList.add('glyph-failed');
  if(liveCanvas){ liveCanvas.remove(); liveCanvas=null; }   // the fallback image stands alone
  console.warn('glyph-sequence: '+msg+' — the page keeps its background.'); }

syncMotion(); layoutTitle();
addEventListener('scroll',layoutTitle,{passive:true});
addEventListener('resize',layoutTitle,{passive:true});

function getSequence(){
  if(window.GLYPH_SEQUENCE) return Promise.resolve(window.GLYPH_SEQUENCE);
  return fetch(SEQ_URL).then(r=>{ if(!r.ok) throw new Error('HTTP '+r.status+' for '+SEQ_URL); return r.json(); });
}
// two-argument then: a failure to LOAD the document is reported as that; a failure
// inside start() is reported as its own
getSequence().then(D=>{ try{ start(D); }catch(e){ fail('start: '+(e&&e.message||e)); console.error(e); } },
                   e=>fail('sequence load failed: '+(e&&e.message||e)));

function sceneId(sc){ return (sc&&typeof sc==='object')?(sc.kind==='stars'?(sc.id||'stars'):sc.id):undefined; }
function start(D){
  DOC01=!!(D&&D.spec==='glyph-sequence/0.1');
  if(!D||typeof D!=='object'||!SPECS.includes(D.spec)){ fail('unsupported sequence spec '+JSON.stringify(D&&D.spec)+' (this runtime reads '+SPECS.join(', ')+')'); return; }
  if(!Array.isArray(D.scenes)||!D.scenes.length){ fail('the sequence has no scenes'); return; }
  // ids are the timeline's keys: every scene has one, no two share one
  const ids=new Set();
  for(let k=0;k<D.scenes.length;k++){ const id=sceneId(D.scenes[k]);
    if(typeof id!=='string'||!id){ fail('scene '+k+' has no id'); return; }
    if(ids.has(id)){ fail('duplicate scene id "'+id+'"'); return; } ids.add(id); }
  if(!D.artwork||typeof D.artwork.src!=='string'||!D.artwork.src){ fail('the sequence names no artwork.src (a URL or a data: URI)'); return; }
  const src=D.artwork.src;
  const img=new Image();
  // CORS mode so a cross-origin artwork that allows it can be sampled (getImageData on a
  // tainted canvas throws); same-origin and data: sources are unaffected
  img.crossOrigin='anonymous';
  img.decoding='async';
  const go=()=>boot(D,img).catch(e=>{ fail('boot: '+(e&&e.message||e)); console.error(e); });
  // decode off the main thread before the first drawImage — but only as an optimization:
  // decode() never settles while the document is hidden (a background tab, the embedded
  // pane), so boot proceeds after a short wait regardless and drawImage decodes inline
  img.onload=()=>{ const dec=img.decode?img.decode().catch(()=>{}):Promise.resolve();
    Promise.race([dec,new Promise(r=>setTimeout(r,300))]).then(go); };
  img.onerror=()=>{ let where=src.slice(0,80);
    try{ const u=new URL(src,location.href); if(/^https?:$/.test(u.protocol)&&u.origin!==location.origin) where=u.href.slice(0,80)+' (cross-origin: its host must send Access-Control-Allow-Origin)'; }catch(e){}
    fail('the artwork did not load: '+where); };
  img.src=src;
}

/* ---------- sampling: one scene of the sequence → its kept marks in Hilbert order ---------- */
function starsScene(sc,k){
  const id=(sc&&sc.id)||'stars';
  return {id,label:(sc&&sc.label)||id,kind:'stars',count:0,cells:[],visits:[],pitch:0,width:0,gw:0,gh:0,depth:0,hole:null,rest:null,
          height:num(sc&&sc.height,2.6,0.2,20,'scene "'+id+'" height')};
}
/* 0.2: stars.palette {crop} — the ambient field colored from a crop of the artwork (a sky),
   brighter pixels more often; a malformed crop is reported and the 0.1 coloring stands */
function skyPalette(img,pal){
  const IW=img.naturalWidth, IH=img.naturalHeight;
  if(!pal||typeof pal!=='object'){ note('stars.palette is not an object — stars take the marks\' colors'); return null; }
  const c=pal.crop, ok=Array.isArray(c)&&c.length===4&&c.every(v=>typeof v==='number'&&Number.isFinite(v));
  let crop=[0,0,IW,IH];
  if(c===undefined||c===null) note('stars.palette names no crop — the whole artwork is the palette');
  else if(!ok){ note('stars.palette.crop '+JSON.stringify(c)+' is not [x0,y0,x1,y1] in image pixels — the whole artwork is the palette'); }
  else { const cc=[clamp(c[0],0,IW),clamp(c[1],0,IH),clamp(c[2],0,IW),clamp(c[3],0,IH)];
    if(cc[2]-cc[0]<1||cc[3]-cc[1]<1) note('stars.palette.crop '+JSON.stringify(c)+' is empty or reversed — the whole artwork is the palette');
    else { if(cc.some((v,i)=>v!==c[i])) note('stars.palette.crop '+JSON.stringify(c)+' reaches outside the '+IW+'×'+IH+' artwork — clipped to '+JSON.stringify(cc)); crop=cc; } }
  const S=96, cv=document.createElement('canvas'); cv.width=S; cv.height=S;
  const cx=cv.getContext('2d',{willReadFrequently:true}); cx.imageSmoothingEnabled=true; cx.imageSmoothingQuality='high';
  cx.drawImage(img,crop[0],crop[1],crop[2]-crop[0],crop[3]-crop[1],0,0,S,S);
  const d=cx.getImageData(0,0,S,S).data, n=S*S, cum=new Float32Array(n); let acc=0;
  for(let i=0;i<n;i++){ const l=(0.2126*d[i*4]+0.7152*d[i*4+1]+0.0722*d[i*4+2])/255; acc+=0.03+l*l; cum[i]=acc; }
  return {d,cum,n,total:acc};
}
function palettePick(P,u){ let lo=0,hi=P.n-1; const v=u*P.total;
  while(lo<hi){ const m=(lo+hi)>>1; if(P.cum[m]<v) lo=m+1; else hi=m; }
  return [P.d[lo*4]/255,P.d[lo*4+1]/255,P.d[lo*4+2]/255]; }
function sampleScene(img,sc,rampN,chars,fillDef){
  const who='scene "'+sc.id+'" ';
  const IW=img.naturalWidth, IH=img.naturalHeight;
  /* crop: [x0,y0,x1,y1] in image pixels; absent = the whole artwork. A malformed, empty or
     reversed crop is reported and the whole artwork sampled; one that reaches outside the
     artwork is reported and clipped. */
  let crop=[0,0,IW,IH];
  if(sc.crop!==undefined&&sc.crop!==null){
    const c=sc.crop, ok=Array.isArray(c)&&c.length===4&&c.every(v=>typeof v==='number'&&Number.isFinite(v));
    if(!ok) note(who+'crop '+JSON.stringify(c)+' is not [x0,y0,x1,y1] in image pixels — the whole artwork is sampled');
    else { const cc=[clamp(c[0],0,IW),clamp(c[1],0,IH),clamp(c[2],0,IW),clamp(c[3],0,IH)];
      if(cc[2]-cc[0]<1||cc[3]-cc[1]<1) note(who+'crop '+JSON.stringify(c)+' is empty or reversed inside the '+IW+'×'+IH+' artwork — the whole artwork is sampled');
      else { if(cc.some((v,i)=>v!==c[i])) note(who+'crop '+JSON.stringify(c)+' reaches outside the '+IW+'×'+IH+' artwork — clipped to '+JSON.stringify(cc)); crop=cc; } } }
  const [x0,y0,x1,y1]=crop, cw=x1-x0, ch=y1-y0;
  /* the grid: square cells, rows from the crop's aspect; the larger side is capped at MAXG
     (the mid canvas stays ≤ 2048², sampling stays quick on a phone) — a tall crop loses
     width, never its aspect, and says so */
  const MAXG=1024;
  let gw=Math.round(num(sc.across,160,8,MAXG,who+'across')), gh=Math.max(1,Math.round(gw*ch/cw));
  if(gh>MAXG){ const gw2=Math.max(8,Math.round(MAXG*cw/ch));
    note(who+'across '+gw+' needs '+gh+' rows for this crop — '+gw2+' across used ('+MAXG+' rows, cells kept square)');
    gw=gw2; gh=Math.min(MAXG,Math.max(1,Math.round(gw*ch/cw))); }
  // two-step downscale — one drawImage from a 1200-px crop to a 180-cell grid aliases
  const mid=document.createElement('canvas'); mid.width=gw*2; mid.height=gh*2;
  const mc=mid.getContext('2d'); mc.imageSmoothingEnabled=true; mc.imageSmoothingQuality='high';
  mc.drawImage(img,x0,y0,cw,ch,0,0,gw*2,gh*2);
  const c=document.createElement('canvas'); c.width=gw; c.height=gh;
  const cc=c.getContext('2d',{willReadFrequently:true}); cc.imageSmoothingEnabled=true; cc.imageSmoothingQuality='high';
  cc.drawImage(mid,0,0,gw,gh);
  const d=cc.getImageData(0,0,gw,gh).data, n=gw*gh;
  const lum=new Float32Array(n);
  for(let i=0;i<n;i++) lum[i]=(0.2126*d[i*4]+0.7152*d[i*4+1]+0.0722*d[i*4+2])/255;
  /* Sobel on the grid, normalized by a robust ceiling (the 97th percentile, so one hard edge
     does not flatten the rest) floored at a real-edge scale (0.2 ≈ a 5 % luma step across
     the kernel), so a quiet crop's JPEG residue never earns the edge weight */
  const edge=new Float32Array(n); const at=(x,y)=>lum[clamp(y,0,gh-1)*gw+clamp(x,0,gw-1)];
  for(let y=0;y<gh;y++)for(let x=0;x<gw;x++){
    const gx=(at(x+1,y-1)+2*at(x+1,y)+at(x+1,y+1))-(at(x-1,y-1)+2*at(x-1,y)+at(x-1,y+1));
    const gy=(at(x-1,y+1)+2*at(x,y+1)+at(x+1,y+1))-(at(x-1,y-1)+2*at(x,y-1)+at(x+1,y-1));
    edge[y*gw+x]=Math.hypot(gx,gy); }
  // the 97th percentile from a histogram (4096 bins over the range): no copy, no sort
  let emax=0; for(let i=0;i<n;i++) if(edge[i]>emax) emax=edge[i];
  const NB=4096, hist=new Uint32Array(NB), bw=emax>0?emax/NB:1;
  for(let i=0;i<n;i++) hist[Math.min(NB-1,Math.floor(edge[i]/bw))]++;
  let acc=0, pb=NB-1; for(let b=0;b<NB;b++){ acc+=hist[b]; if(acc>=n*0.97){ pb=b; break; } }
  const ceil=Math.max(0.2,(pb+1)*bw);
  for(let i=0;i<n;i++) edge[i]=clamp(edge[i]/ceil,0,1);
  /* importance: max(base, feathered regions) + edges·|∇luma|, clamped to 1, times the
     vignette (importance fades to nothing over the outer fraction of the crop, so a crop
     reads as a subject, never as a rectangle of sky) */
  const den=(sc.density&&typeof sc.density==='object')?sc.density:{};
  if(sc.density!==undefined&&sc.density!==null&&(typeof sc.density!=='object')) note(who+'density is not an object — every cell kept');
  const base=num(den.base,1,0,1,who+'density.base'), eg=num(den.edges,0,0,1,who+'density.edges'), vig=num(den.vignette,0,0,0.5,who+'density.vignette');
  const regions=[];
  if(den.regions!==undefined&&den.regions!==null&&!Array.isArray(den.regions)) note(who+'density.regions is not an array — no regions');
  (Array.isArray(den.regions)?den.regions:[]).forEach((r,i)=>{
    const rw='density.regions['+i+'] ';
    if(!r||typeof r!=='object'){ note(who+rw+'is not an object — dropped'); return; }
    // 0.1 has one region shape; another is reported and drawn as the ellipse it names the bounds of
    if(r.shape!==undefined&&r.shape!=='ellipse') note(who+rw+'shape '+JSON.stringify(r.shape)+' is not in '+SPEC+' (ellipse only) — sampled as an ellipse');
    const g=[r.cx,r.cy,r.rx,r.ry];
    if(!g.every(v=>typeof v==='number'&&Number.isFinite(v))||r.rx<=0||r.ry<=0){ note(who+rw+'needs finite cx, cy and positive rx, ry (image pixels) — dropped'); return; }
    regions.push({cx:(r.cx-x0)/cw*gw, cy:(r.cy-y0)/ch*gh, rx:Math.max(1e-3,r.rx/cw*gw), ry:Math.max(1e-3,r.ry/ch*gh),
                  w:num(r.weight,1,0,1,who+rw+'weight'), f:Math.max(1e-3,num(r.feather,0.5,0,10,who+rw+'feather')),
                  // 0.2: a region may set the fill of its marks (a face with no gaps) and name its lit cells glints
                  fill:(r.fill===undefined||r.fill===null)?null:num(r.fill,fillDef,0.3,1.2,who+rw+'fill'),
                  glint:num(r.glint,0,0,1,who+rw+'glint'),
                  contrast:num(r.contrast,0,0,1,who+rw+'contrast'),sur:null}); });
  // each region's reach in cells (the ellipse plus its feather; the ring beyond it for the
  // surround): outside these bounds a region contributes nothing, so the loops skip it
  for(const r of regions){ const kx=r.rx*(1+r.f+0.35), ky=r.ry*(1+r.f+0.35);
    r.x0=Math.max(0,Math.floor(r.cx-kx)); r.x1=Math.min(gw-1,Math.ceil(r.cx+kx)); r.y0=Math.max(0,Math.floor(r.cy-ky)); r.y1=Math.min(gh-1,Math.ceil(r.cy+ky)); }
  /* 0.2: luma — brightness itself earns density (a lit face, a roof, the moon), so the painting
     thins by what is lit and never by an outline */
  const lw=num(den.luma,0,0,1,who+'density.luma');
  /* 0.2: contrast — a cell of the region counts as content only where its COLOR differs from
     every DOMINANT color of the region's SURROUND (the ring just past the feather, reduced
     to its four main colors — a ring of sky and ground is those two, never their mean, so
     the sky an ellipse also encloses is dropped and the head, the moon, the dome stay; the
     mean of a mixed ring is a color nothing shows, and everything passes it: a halo) by at
     least this much (RGB distance, 0–1). Nothing is ever outlined. 0 = the whole ellipse counts. */
  for(const r of regions){ if(r.contrast<=0) continue;
    const ring=[];
    for(let y=r.y0;y<=r.y1;y++)for(let x=r.x0;x<=r.x1;x++){ const nd=Math.hypot((x+0.5-r.cx)/r.rx,(y+0.5-r.cy)/r.ry);
      if(nd>1+r.f&&nd<=1+r.f+0.35){ const j=(y*gw+x)*4; ring.push([d[j]/255,d[j+1]/255,d[j+2]/255]); } }
    if(!ring.length){ r.sur=[[0,0,0]]; note(who+'a region\'s surround ring lies outside the crop — its contrast is measured against black'); continue; }
    // k-means, four centers seeded at luminance quantiles, eight rounds: deterministic, a few thousand cells
    const L=c=>0.2126*c[0]+0.7152*c[1]+0.0722*c[2];
    const byL=ring.slice().sort((a,b)=>L(a)-L(b)); const K=Math.min(4,ring.length);
    let cen=[]; for(let k=0;k<K;k++) cen.push(byL[Math.floor((k+0.5)*byL.length/K)].slice());
    for(let it=0;it<8;it++){ const acc=cen.map(()=>[0,0,0,0]);
      for(const c of ring){ let bk=0,bd=Infinity; for(let k=0;k<K;k++){ const dr=c[0]-cen[k][0],dg=c[1]-cen[k][1],db=c[2]-cen[k][2],dd=dr*dr+dg*dg+db*db; if(dd<bd){ bd=dd; bk=k; } }
        const a=acc[bk]; a[0]+=c[0]; a[1]+=c[1]; a[2]+=c[2]; a[3]++; }
      cen=acc.map((a,k)=>a[3]?[a[0]/a[3],a[1]/a[3],a[2]/a[3]]:cen[k]); }
    r.sur=cen; }
  const depth=num(sc.depth,0,-2,2,who+'depth'), height=num(sc.height,1,0.05,20,who+'height');
  const kept=[], visits=[]; const salt=hash32(sc.id.length*7919+gw);
  /* the visiting places (0.2, the exchange): unkept cells that nearly mattered — a star's
     momentary seat in the painting; a deterministic reservoir of VISIT_CAP spread over the
     whole crop (never the first rows only), so a huge grid cannot hold a huge list */
  const VISIT_MIN=0.06, VISIT_CAP=60000; let nVisit=0;
  for(let y=0;y<gh;y++)for(let x=0;x<gw;x++){
    const i=y*gw+x; let imp=base, fs=fillDef, gl=0;
    for(const r of regions){
      if(x<r.x0||x>r.x1||y<r.y0||y>r.y1) continue;                 // beyond its reach: nothing to add
      const nd=Math.hypot((x+0.5-r.cx)/r.rx,(y+0.5-r.cy)/r.ry);
      if(nd>1+r.f) continue;
      // the feather is a smooth curve, never a line: a region flows into what is around it
      // (0.1 documents keep their linear ramp)
      const ft=clamp((nd-1)/r.f,0,1); let inR=nd<=1?1:1-(DOC01?ft:smooth(ft)), keyF=1;
      if(r.contrast>0){ const cr0=d[i*4]/255, cg0=d[i*4+1]/255, cb0=d[i*4+2]/255; let bd=Infinity;
        for(const c of r.sur){ const dr=cr0-c[0], dg=cg0-c[1], db=cb0-c[2], dd=dr*dr+dg*dg+db*db; if(dd<bd) bd=dd; }
        keyF=smooth(clamp(Math.sqrt(bd)/r.contrast,0,1)); inR*=keyF; }
      const w=r.w*inR;
      if(w>imp) imp=w;
      if(r.fill!==null&&inR>0) fs=mix(fs,r.fill,inR);
      // glints belong to the region's core (a short feather, a quarter of the region's): the
      // city's roofs, never a sleeve or a rock the wide feather also reaches
      if(r.glint>0){ const inC=(nd<=1?1:1-smooth(clamp((nd-1)/(0.25*r.f),0,1)))*keyF; if(inC>0) gl=Math.max(gl,r.glint*inC); } }
    imp=Math.min(1,imp+eg*edge[i]+lw*lum[i]);
    if(vig>0){ const m=Math.min((x+0.5)/gw,(gw-x-0.5)/gw,(y+0.5)/gh,(gh-y-0.5)/gh)/vig; imp*=smooth(clamp(m,0,1)); }
    // the threshold is uniform on [0,1) — gradient noise plus a small jitter, wrapped — so a
    // cell of importance p is kept with probability p: weight 0.3 keeps 30 %, evenly
    const thr=(ign(x,y)+0.25*seedFloat(i,salt))%1;
    const cr=d[i*4]/255, cg=d[i*4+1]/255, cb=d[i*4+2]/255;
    if(imp<=thr){
      if(imp>VISIT_MIN){ nVisit++;
        if(visits.length<VISIT_CAP) visits.push({x,y,r:cr,g:cg,b:cb});
        else { const r=Math.floor(seedFloat(i,31)*nVisit); if(r<VISIT_CAP) visits[r]={x,y,r:cr,g:cg,b:cb}; } }
      continue; }
    // a glint is a LIT cell of a glint region — a bright roof, a warm window — never the dark between
    if(gl>0&&!(lum[i]>0.5||(cr-cb>0.12&&lum[i]>0.22))) gl=0;
    // restless: how lightly a mark is held — the dust wanders, the face (importance 1) never
    kept.push({x,y,r:cr,g:cg,b:cb,l:lum[i],e:edge[i],fs,gl,rs:1-imp});
  }
  if(!kept.length) note(who+'keeps no cells — its density rules leave it empty; it shows as stars');
  let order=1; while(order<Math.max(gw,gh)) order<<=1;
  for(const k of kept) k.h=hilbert(order,k.x,k.y);
  kept.sort((a,b)=>a.h-b.h);
  const pitch=height/gh;
  for(const k of kept){
    k.px=(k.x-gw/2+0.5)*pitch; k.py=(gh/2-k.y-0.5)*pitch; k.pz=(k.l-0.5)*depth;
    // bright → dense glyphs (the family's polarity); tiles ignore the index
    k.gi=chars?Math.round(k.l*(rampN-1)):0; }
  for(const v of visits){ v.px=(v.x-gw/2+0.5)*pitch; v.py=(gh/2-v.y-0.5)*pitch; }
  /* 0.2: keepOut {cx, cy, rx, ry} (image pixels) — the part of this scene the stars never
     cross as seen from the camera (a face); in world units of the scene. Malformed → reported, none. */
  let hole=null;
  if(sc.keepOut!==undefined&&sc.keepOut!==null){
    const k=sc.keepOut, g=(k&&typeof k==='object')?[k.cx,k.cy,k.rx,k.ry]:null;
    if(!g||!g.every(v=>typeof v==='number'&&Number.isFinite(v))||k.rx<=0||k.ry<=0) note(who+'keepOut needs finite cx, cy and positive rx, ry (image pixels) — no keep-out');
    else hole={x:((k.cx-x0)/cw-0.5)*gw*pitch, y:(0.5-(k.cy-y0)/ch)*gh*pitch, rx:k.rx/cw*gw*pitch, ry:k.ry/ch*gh*pitch}; }
  /* 0.2: light [x, y] (image pixels) — where the reader's light rests while no pointer is on
     the page (a phone; a mouse that left): the moon. World units of the scene. Malformed →
     reported, none. */
  let rest=null;
  if(sc.light!==undefined&&sc.light!==null){
    const L=sc.light;
    if(!Array.isArray(L)||L.length!==2||!L.every(v=>typeof v==='number'&&Number.isFinite(v))) note(who+'light needs [x, y] (image pixels) — the light rests nowhere');
    else rest={x:((L[0]-x0)/cw-0.5)*gw*pitch, y:(0.5-(L[1]-y0)/ch)*gh*pitch}; }
  return {id:sc.id,label:sc.label||sc.id,kind:'marks',gw,gh,pitch,height,width:gw*pitch,count:kept.length,cells:kept,visits,depth,hole,rest};
}

const nextTask=()=>new Promise(r=>setTimeout(r,0));

async function boot(D,img){
  /* style: tiles (the default) or chars; anything else is reported and shown as tiles */
  const qStyle=Q.get('style'), style=qStyle||D.style||'tiles';
  if(style!=='tiles'&&style!=='chars') note((qStyle?'?style=':'style ')+JSON.stringify(style)+' is not "tiles" or "chars" — tiles shown');
  const chars=style==='chars'; API.style=chars?'chars':'tiles';

  /* the document's numbers, read ONCE (a warning fires once, never per frame) */
  const MO=(D.motion&&typeof D.motion==='object')?D.motion:{};
  if(D.motion!==undefined&&D.motion!==null&&typeof D.motion!=='object') note('motion is not an object — defaults used');
  const SPREAD=num(MO.spread,0.45,0,0.9,'motion.spread'), SPIN=num(MO.spin,1,0,3,'motion.spin'), ARC=num(MO.arc,1,0,3,'motion.arc'),
        HOLD=num(MO.hold,0.3,0,0.45,'motion.hold'), INTRO_MS=num(MO.introMs,2600,0,20000,'motion.introMs'),
        BREATH=num(MO.breath,0.5,0,2,'motion.breath'), SPARKLE=num(MO.sparkle,0.03,0,1,'motion.sparkle'),
        SHIMMER=num(MO.shimmer,0.3,0,1,'motion.shimmer'), FILL=num(MO.fill,0.9,0.3,1.2,'motion.fill'),
        WAKE=MO.wakeOn===false?0:num(MO.wake,0.5,0,1,'motion.wake');
  // 0.2: turn — false keeps the camera straight-on and still: no drag, no arrow keys, no drift
  const TURN=(MO.turn===undefined||MO.turn===null)?true:(typeof MO.turn==='boolean'?MO.turn:(note('motion.turn '+JSON.stringify(MO.turn)+' is not true or false — true used'),true));
  API.turn=TURN;
  /* 0.2.3: lift — on the narrow layout the painting rises slowly as the last block of its
     words scrolls up past it: rate = its rise per pixel of scroll at first (0 = none), max =
     the most it rises, a fraction of the viewport height, eased toward (never a kink) */
  const LI=(MO.lift&&typeof MO.lift==='object')?MO.lift:{};
  if(MO.lift!==undefined&&MO.lift!==null&&typeof MO.lift!=='object') note('motion.lift is not an object — no lift');
  const LIFT_RATE=num(LI.rate,0,0,1,'motion.lift.rate'), LIFT_MAX=num(LI.max,0.18,0,0.6,'motion.lift.max');
  const ST=(D.stars&&typeof D.stars==='object')?D.stars:{};
  if(D.stars!==undefined&&D.stars!==null&&typeof D.stars!=='object') note('stars is not an object — defaults used');
  // 0 is a legal count: no star-only instances, the marks alone become the ambient field
  const NSTAR=Math.round(num(ST.count,8000,0,60000,'stars.count')), STAR_SIZE=num(ST.size,0.0075,0.0005,0.2,'stars.size');
  // 0.2: orbit — seconds per turn of the star field (0 = still); the 0.1 field turned once in ~210 s
  const ORBIT=num(ST.orbit,2*Math.PI/0.03,0,3600,'stars.orbit'), STAR_RATE=ORBIT>0?2*Math.PI/ORBIT:0;
  // 0.2: the exchange at rest — marks: the fraction of a restless mark's clock spent away;
  // stars: the fraction of a star's clock spent visiting; period: its clock in seconds;
  // reach: how far out a leaving mark goes (1 = all the way to its place in the cloud)
  const EX=(MO.exchange&&typeof MO.exchange==='object')?MO.exchange:{};
  if(MO.exchange!==undefined&&MO.exchange!==null&&typeof MO.exchange!=='object') note('motion.exchange is not an object — no exchange');
  const EX_M=num(EX.marks,0,0,1,'motion.exchange.marks'), EX_S=num(EX.stars,0,0,1,'motion.exchange.stars'),
        EX_P=num(EX.period,16,2,120,'motion.exchange.period'), EX_R=num(EX.reach,1,0,1,'motion.exchange.reach');

  const host=document.getElementById('glyph-hero')||document.body;
  const canvas=document.createElement('canvas'); liveCanvas=canvas;
  canvas.className='glyph-hero-canvas';
  if(TURN){
    /* the canvas is an operable surface, reached by Tab (never by a click — see mousedown):
       role=application tells a screen reader the element handles its own keys; the label is
       the artwork's description, the description says what the keys do */
    canvas.setAttribute('role','application');
    canvas.setAttribute('aria-label',(D.artwork&&D.artwork.alt)||'Living glyph sequence');
    canvas.setAttribute('aria-roledescription','drag surface');
    const help=document.createElement('span'); help.id='glyph-sequence-help';
    help.textContent='Drag, or press the left and right arrow keys, to turn the assembled scene.';
    help.style.cssText='position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap';
    canvas.setAttribute('aria-describedby',help.id);
    canvas.tabIndex=0;
    host.appendChild(canvas); host.appendChild(help);
  } else {
    /* turning off: the field is a picture that answers the pointer with light — an image
       with the artwork's description, not a control; nothing to focus, nothing to press */
    canvas.setAttribute('role','img');
    canvas.setAttribute('aria-label',(D.artwork&&D.artwork.alt)||'Living glyph sequence');
    host.appendChild(canvas);
  }
  // a stable viewport height for the timeline: 100vh resolves to the LARGE viewport on
  // iOS and Android, so the toolbar collapsing mid-scroll never moves the anchors
  const probe=document.createElement('div');
  probe.style.cssText='position:fixed;top:0;left:0;width:0;height:100vh;visibility:hidden;pointer-events:none';
  host.appendChild(probe);
  const gl=canvas.getContext('webgl2',{antialias:true,alpha:false});
  if(!gl){ canvas.remove(); fail('WebGL2 unavailable'); return; }

  /* program */
  function compile(type,src){ const s=gl.createShader(type); gl.shaderSource(s,src); gl.compileShader(s);
    if(!gl.getShaderParameter(s,gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; }
  let prog;
  try{ prog=gl.createProgram();
    gl.attachShader(prog,compile(gl.VERTEX_SHADER,VS)); gl.attachShader(prog,compile(gl.FRAGMENT_SHADER,FS));
    gl.linkProgram(prog);
    if(!gl.getProgramParameter(prog,gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
  }catch(e){ canvas.remove(); fail('shader: '+e.message); return; }
  gl.useProgram(prog);
  const U={}; ['uHomes','uHomesW','uRowsPer','uSceneA','uSceneB','uF','uSpread','uSpin','uArc','uPitchA','uPitchB',
    'uStarSize','uIntro','uStarRate','uDist','uHole','uExchange','uShiftA','uShiftB','uMVP','uRot','uGlyphCount','uTime','uSparkle','uBreath',
    'uShimmer','uWakeS','uWakeR','uAspect','uMotionScale','uPointer','uPointerLag','uAtlas','uMode','uGold','uDiscard']
    .forEach(n=>U[n]=gl.getUniformLocation(prog,n));
  gl.uniform3f(U.uGold,MOONGOLD[0],MOONGOLD[1],MOONGOLD[2]);

  /* atlas — the local rasterization of the ramp (the page runtime's 0.1 path); tiles never sample it */
  const CELLPX=48, RAMP_MAX=64;
  const FONT='600 '+Math.round(CELLPX*0.82)+'px ui-monospace, "SF Mono", Menlo, monospace';
  let RAMP=[];
  { let a;
    if(chars){
      const full=[...(typeof D.ramp==='string'&&D.ramp.length?D.ramp:'.,:;-~i+=lvtcxou*aeksSCOZ8%B#@')];
      if(full.length>RAMP_MAX) note('ramp has '+full.length+' glyphs — only the first '+RAMP_MAX+' are drawn');
      const src=full.slice(0,RAMP_MAX);
      const m=document.createElement('canvas'); m.width=CELLPX; m.height=CELLPX;
      const mc=m.getContext('2d',{willReadFrequently:true}); mc.font=FONT; mc.textAlign='center'; mc.textBaseline='middle';
      RAMP=src.map(ch=>{ mc.clearRect(0,0,CELLPX,CELLPX); mc.fillStyle='#fff'; mc.fillText(ch,CELLPX/2,CELLPX/2);
        const d=mc.getImageData(0,0,CELLPX,CELLPX).data; let s=0; for(let i=3;i<d.length;i+=4)s+=d[i]; return {ch,cov:s/255/(CELLPX*CELLPX)}; })
        .sort((p,q)=>p.cov-q.cov).map(x=>x.ch);
      a=document.createElement('canvas'); a.width=CELLPX*RAMP.length; a.height=CELLPX;
      const ac=a.getContext('2d'); ac.font=FONT; ac.textAlign='center'; ac.textBaseline='middle'; ac.fillStyle='#fff';
      RAMP.forEach((ch,i)=>ac.fillText(ch,i*CELLPX+CELLPX/2,CELLPX/2));
    } else { a=document.createElement('canvas'); a.width=1; a.height=1; RAMP=['█']; }
    const tex=gl.createTexture(); gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D,tex);
    gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,a);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
    gl.uniform1i(U.uAtlas,0); gl.uniform1f(U.uGlyphCount,RAMP.length); gl.uniform1f(U.uMode,chars?1:0);
  }

  /* scenes → homes. Each scene is sampled in its own task so the page never freezes for
     the whole pass; a 'stars' scene has no marks: every instance is a star there. */
  let dead=false;
  canvas.addEventListener('webglcontextlost',()=>{ dead=true; canvas.remove(); fail('WebGL context lost'); });
  const t0s=performance.now();
  const scenes=[];
  for(let k=0;k<D.scenes.length;k++){
    const sc=D.scenes[k], ok=sc&&typeof sc==='object', kind=ok?sc.kind:undefined;
    if(!ok||(kind!==undefined&&kind!=='stars'&&kind!=='marks')){
      note('scene '+(ok?JSON.stringify(sc.id):'#'+k)+(ok?' kind '+JSON.stringify(kind):' is not an object')+' is not readable by '+SPEC+' — shown as stars');
      scenes.push(starsScene(ok?sc:null,k)); }
    else if(kind==='stars'){
      if(sc.crop!==undefined||sc.density!==undefined||sc.across!==undefined) note('scene "'+sc.id+'" is stars — its crop / across / density are ignored');
      if(sc.keepOut!==undefined) note('scene "'+sc.id+'" is stars — a keepOut has nothing to keep the stars out of; ignored');
      scenes.push(starsScene(sc,k)); }
    else scenes.push(sampleScene(img,sc,RAMP.length,chars,FILL));
    if(dead) return;
    await nextTask();
  }
  /* pairing: the fullest scene owns every slot [0, M); each smaller scene takes its slots
     from the next larger scene's slot list by normalized Hilbert rank, so a smaller scene
     is made entirely of marks of the larger one (hands ⊂ face ⊂ scene), slots stay
     strictly increasing (rank r of c → parent[floor((r + ½)·P / c)], P ≥ c), and a mark
     keeps its place along the curve in every scene it belongs to */
  const byCount=scenes.map((s,k)=>k).filter(k=>scenes[k].count>0).sort((a,b)=>scenes[b].count-scenes[a].count);
  const M=byCount.length?scenes[byCount[0]].count:0;
  if(M===0){ canvas.remove(); fail('no scene kept any marks — check the density rules'); return; }
  const slotsOf=new Map(); let parent=null;
  for(const k of byCount){ const cnt=scenes[k].count, sl=new Int32Array(cnt);
    if(!parent) for(let r=0;r<cnt;r++) sl[r]=r;
    else for(let r=0;r<cnt;r++) sl[r]=parent[Math.floor((r+0.5)*parent.length/cnt)];
    slotsOf.set(k,sl); parent=sl; }
  const N=M+NSTAR;
  if(N>BUDGET){ const big=scenes[byCount[0]];
    note(N.toLocaleString()+' instances is above the measured phone budget of '+BUDGET.toLocaleString()+' — the fullest scene "'+big.id+'" keeps '+big.count.toLocaleString()+' of '+(big.gw*big.gh).toLocaleString()+' cells (across '+big.gw+'); reduce its across or density, or stars.count'); }
  const W=Math.min(1024,N), rowsPer=Math.ceil(N/W), K=scenes.length, H=rowsPer*3*K;
  const maxTex=gl.getParameter(gl.MAX_TEXTURE_SIZE);
  if(H>maxTex){ canvas.remove(); fail('homes texture needs '+H+' rows; this device allows '+maxTex); return; }
  const homes=new Float32Array(W*H*4);
  for(let i=3;i<homes.length;i+=4) homes[i]=-1;            // color.a = glyph; −1 = no home (a star) until written
  // the extra rows: glint 0 and the document's fill until a scene writes a mark's own
  for(let k=0;k<K;k++) for(let y=0;y<rowsPer;y++){ const o=(k*3*rowsPer+2*rowsPer+y)*W*4;
    for(let x=0;x<W;x++){ homes[o+x*4]=0; homes[o+x*4+1]=FILL; homes[o+x*4+2]=0; homes[o+x*4+3]=0; } }
  const starCol=new Float32Array(N*3), rnd=new Float32Array(N*3), firstHome=new Int32Array(N).fill(-1);
  for(let k=0;k<K;k++){                                    // document order: a star's color is its FIRST home's
    const s=scenes[k], sl=slotsOf.get(k); if(!sl) continue;
    for(let r=0;r<s.count;r++){
      const j=sl[r], c=s.cells[r], x=j%W, y=(j/W)|0, base=k*3*rowsPer;
      let o=((base+y)*W+x)*4; homes[o]=c.px; homes[o+1]=c.py; homes[o+2]=c.pz; homes[o+3]=c.e;
      o=((base+rowsPer+y)*W+x)*4; homes[o]=c.r; homes[o+1]=c.g; homes[o+2]=c.b; homes[o+3]=c.gi;
      o=((base+2*rowsPer+y)*W+x)*4; homes[o]=c.gl; homes[o+1]=c.fs; homes[o+2]=c.rs;
      if(firstHome[j]<0){ firstHome[j]=k; starCol[j*3]=c.r; starCol[j*3+1]=c.g; starCol[j*3+2]=c.b; }
    }
    /* the visiting places: every star-only instance gets, in this scene's rows, one unkept
       cell — position, the painting's color there, glyph −2 (a visit, not a home: the shader
       still reads it as a star), extra.z = 1 (it may visit) */
    if(s.visits&&s.visits.length&&NSTAR>0){
      const vs=s.visits, base=k*3*rowsPer;
      for(let j=M;j<N;j++){
        const v=vs[Math.floor(seedFloat(j,21+k)*vs.length)], x=j%W, y=(j/W)|0;
        let o=((base+y)*W+x)*4; homes[o]=v.px; homes[o+1]=v.py; homes[o+2]=0; homes[o+3]=0;
        o=((base+rowsPer+y)*W+x)*4; homes[o]=v.r; homes[o+1]=v.g; homes[o+2]=v.b; homes[o+3]=-2;
        o=((base+2*rowsPer+y)*W+x)*4; homes[o+2]=1;
      }
    }
  }
  /* star colors. With stars.palette (0.2) the ambient field is the artwork's own sky: a
     star-only instance takes a pixel of the palette crop (brighter ones more often), a mark's
     star is its first home mixed half-way to one; either is lifted to a luma of 0.3 so it
     reads against the night. Without one (0.1): a mark's first home dimmed, a star-only
     instance borrowing a mark's color from the fullest scene. */
  const SKY=(ST.palette!==undefined&&ST.palette!==null)?skyPalette(img,ST.palette):null;
  const pal=scenes[byCount[0]].cells;
  for(let i=0;i<N;i++){
    rnd[i*3]=seedFloat(i,11); rnd[i*3+1]=seedFloat(i,12); rnd[i*3+2]=seedFloat(i,13);
    let r,g,b;
    if(SKY){ const s=palettePick(SKY,seedFloat(i,14));
      if(firstHome[i]<0){ r=s[0]; g=s[1]; b=s[2]; }
      else { r=(starCol[i*3]+s[0])/2; g=(starCol[i*3+1]+s[1])/2; b=(starCol[i*3+2]+s[2])/2; }
      const l=0.2126*r+0.7152*g+0.0722*b, v=(0.75+0.25*seedFloat(i,15))*(l<0.3?0.3/Math.max(l,1e-3):1);
      r=Math.min(1,r*v); g=Math.min(1,g*v); b=Math.min(1,b*v); }
    else {
      if(firstHome[i]<0){ const c=pal[Math.floor(seedFloat(i,14)*pal.length)]; r=c.r; g=c.g; b=c.b; }
      else { r=starCol[i*3]; g=starCol[i*3+1]; b=starCol[i*3+2]; }
      const dim=0.55+0.45*seedFloat(i,15);
      r=Math.min(1,r*dim+0.18); g=Math.min(1,g*dim+0.18); b=Math.min(1,b*dim+0.22); }
    starCol[i*3]=r; starCol[i*3+1]=g; starCol[i*3+2]=b;
  }
  for(const s of scenes){ s.visitCount=s.visits?s.visits.length:0; s.cells=null; s.visits=null; }   // the homes texture is the only reader; the sampled cell objects must not outlive it
  slotsOf.clear();
  const homesTex=gl.createTexture(); gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D,homesTex);
  gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA32F,W,H,0,gl.RGBA,gl.FLOAT,homes);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
  { const err=gl.getError(); if(err){ canvas.remove(); fail('the homes texture (RGBA32F '+W+'×'+H+') was refused: GL error '+err); return; } }
  gl.uniform1i(U.uHomes,1); gl.uniform1i(U.uHomesW,W); gl.uniform1i(U.uRowsPer,rowsPer);
  gl.activeTexture(gl.TEXTURE0);
  API.count=N; API.assembled=M; API.stars=NSTAR;
  API.scenes=scenes.map(s=>({id:s.id,label:s.label,kind:s.kind,count:s.count,gw:s.gw,gh:s.gh,height:s.height,keepOut:!!s.hole,visits:s.visitCount}));
  console.info('glyph-sequence: '+scenes.map(s=>s.id+' '+s.count.toLocaleString()).join(' · ')+' → '+N.toLocaleString()+' instances ('+M.toLocaleString()+' marks + '+NSTAR.toLocaleString()+' stars) sampled in '+Math.round(performance.now()-t0s)+' ms');
  /* the page's live numbers, in the runtime's own vocabulary: marks (M) and stars (NSTAR),
     and per scene the cells kept of the cells sampled */
  const put=(sel,v)=>document.querySelectorAll(sel).forEach(el=>{ el.textContent=v; });
  put('[data-count]',M.toLocaleString()); put('[data-stars]',NSTAR.toLocaleString());
  for(const s of scenes){ put('[data-kept="'+s.id+'"]',s.count.toLocaleString()); put('[data-grid="'+s.id+'"]',(s.gw*s.gh).toLocaleString()); }

  /* geometry — one quad, front face */
  const vao=gl.createVertexArray(); gl.bindVertexArray(vao);
  function staticAttr(name,data,size){ const b=gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER,b);
    gl.bufferData(gl.ARRAY_BUFFER,data,gl.STATIC_DRAW); const loc=gl.getAttribLocation(prog,name);
    gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc,size,gl.FLOAT,false,0,0); }
  function instAttr(name,data,size){ const b=gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER,b);
    gl.bufferData(gl.ARRAY_BUFFER,data,gl.STATIC_DRAW); const loc=gl.getAttribLocation(prog,name);
    gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc,size,gl.FLOAT,false,0,0); gl.vertexAttribDivisor(loc,1); }
  staticAttr('aPos',new Float32Array([-.5,-.5,0, .5,-.5,0, .5,.5,0, -.5,.5,0]),3);
  staticAttr('aNormal',new Float32Array([0,0,1, 0,0,1, 0,0,1, 0,0,1]),3);
  instAttr('aRand',rnd,3); instAttr('aStar',starCol,3);
  const ib=gl.createBuffer(); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,ib);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,new Uint16Array([0,1,2,0,2,3]),gl.STATIC_DRAW);
  gl.bindVertexArray(null);
  gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL);
  gl.clearColor(0.0275,0.043,0.094,1);

  /* the timeline: the page's [data-scene] elements, in document order, name the steps;
     a step's anchor is the scroll position that centers its element — on the narrow
     layout, the position that seats its words in the lower part of the screen under the
     up-shifted scene. Between anchors the key runs from one step to the next, holding at
     each end (HOLD of the gap) so a scene stands whole while its words are centered and
     every mark has landed before the next flight begins. An element with no layout box
     (display:none, detached) is left out of the timeline and said so, once. */
  const hasRest=scenes.some(s=>!!s.rest);          // 0.2: some scene authors where the light rests
  const byId=new Map(scenes.map((s,k)=>[s.id,k]));
  const starsK=scenes.findIndex(s=>s.kind==='stars'), fallbackK=starsK>=0?starsK:0;
  const stepEls=[...document.querySelectorAll('[data-scene]')];
  const stepScene=stepEls.map(el=>{ const id=el.dataset.scene; if(byId.has(id)) return byId.get(id);
    note('[data-scene="'+id+'"] names no scene in the sequence — shown as "'+scenes[fallbackK].id+'"'); return fallbackK; });
  if(!stepEls.length) note('no [data-scene] elements — the field holds "'+scenes[fallbackK].id+'"');
  const narrowMQ=matchMedia('(max-width:760px)');     // the SAME breakpoint as the page's CSS column layout
  let steps=stepScene.length?stepScene.slice():[0], anchors=[0], spans=[], skippedSaid=new Set();
  /* 0.2 (narrow): the top of the first scene's block of words, in document pixels, is the
     line the painting stands on (stepView fits the painting above it) and the line every
     later block of scene words seats its top on at its anchor — the words never climb the
     painting where the reader stops. −1 = wide layout or a 0.1 document: the fixed fit. */
  let liveEls=[], hereK=-1;      // the live steps' elements; the step the key rests on (class glyph-here)
  let wordsLine=-1, liftK=-1;   // liftK: the step of the last block of scene words — the lift starts at its anchor
  function measure(){
    const V=probe.offsetHeight||innerHeight, narrow=narrowMQ.matches;
    const live=[], anc=[], leave=[], els=[];
    wordsLine=-1; liftK=-1;
    stepEls.forEach((el,i)=>{
      if(!el.isConnected||el.getClientRects().length===0){
        if(!skippedSaid.has(i)){ skippedSaid.add(i); note('[data-scene="'+el.dataset.scene+'"] has no layout box (display:none?) — left out of the timeline'); }
        return; }
      const r=el.getBoundingClientRect(), b=narrow?el.querySelector('.block'):null, marks=scenes[stepScene[i]].kind!=='stars';
      let a, lv=0;
      if(b){ const rb=b.getBoundingClientRect(), top=rb.top+scrollY;
        if(marks&&!DOC01){ if(wordsLine<0) wordsLine=top; a=top-wordsLine; liftK=live.length;
          lv=wordsLine+rb.height+0.5*V; }        // the scroll past its anchor until the block has left, plus half a screen
        else a=top+rb.height/2-V*0.72; }
      else a=r.top+r.height/2+scrollY-V/2;
      live.push(stepScene[i]); anc.push(a); leave.push(lv); els.push(el); });
    if(!live.length){ live.push(fallbackK); anc.push(0); }
    // every anchor inside the reachable scroll range, strictly increasing, the last one reachable
    const max=Math.max(0,document.documentElement.scrollHeight-innerHeight), n=anc.length;
    for(let i=0;i<n;i++) anc[i]=clamp(anc[i],0,max);
    for(let i=1;i<n;i++) if(anc[i]<=anc[i-1]+1) anc[i]=anc[i-1]+1;
    if(anc[n-1]>max){ anc[n-1]=max; for(let i=n-2;i>=0;i--) anc[i]=Math.min(anc[i],anc[i+1]-1); }
    if(live.length!==steps.length||live.some((k,i)=>k!==steps[i])){ steps=live; key=clamp(key,0,steps.length-1); if(forcedKey!==null) forcedKey=clamp(forcedKey,0,steps.length-1); }
    anchors=anc; liveEls=els;
    /* 0.2.4 (narrow): where a scene's block of words leaves the screen for the stars, the
       flight spans the words' leaving plus half a screen of dissipation — never past the
       stars' anchor — so their scroll dissolves the painting completely and slowly, and the
       key then waits at the stars until the universe's words arrive. 0 = an ordinary gap */
    spans=anc.map((a,k)=>{ if(k>=n-1) return 0;
      return (leave[k]>0&&scenes[live[k]].kind!=='stars'&&scenes[live[k+1]].kind==='stars')?Math.min(anc[k+1]-a,leave[k]):0; });
  }
  function targetKey(){
    if(forcedKey!==null) return forcedKey;
    const s=scrollY, A=anchors, n=A.length;
    if(n<2||s<=A[0]) return 0;
    for(let k=0;k<n-1;k++) if(s<A[k+1]){
      if(spans[k]>0){ const u=Math.min(1,(s-A[k])/spans[k]);           // the words' leaving: a short hold, then the whole span
        return k+smooth(clamp((u-0.12)/0.88,0,1)); }
      const u=(s-A[k])/(A[k+1]-A[k]);
      return k+smooth(clamp((u-HOLD)/(1-2*HOLD),0,1)); }
    return n-1;
  }
  let forcedKey=null, key=0;
  // QA: force the key (null = follow the scroll again); snap lands it this frame instead of chasing
  API.setKey=(v,snap)=>{
    if(v===null||v===undefined){ forcedKey=null; return; }
    if(typeof v!=='number'||!Number.isFinite(v)){ note('setKey('+JSON.stringify(v)+') ignored — the key is a number in [0, '+(steps.length-1)+']'); return; }
    forcedKey=clamp(v,0,steps.length-1); if(snap) key=forcedKey; };
  API.key=()=>key; API.target=targetKey;
  API.lift=()=>liftF;                                      // QA: the painting's lift this frame (fraction of the canvas height)
  API.anchors=()=>anchors.slice();
  API.timeline=steps.map(k=>scenes[k].id);

  /* rotation — a drag turns the assembled scene about its own center; released, the last
     velocity carries it a little further and it eases back to straight-on over a few
     seconds. Horizontal only on touch (touch-action keeps the vertical for the page and
     the pinch for the browser), both axes with a mouse; ← → on the keyboard (↑ ↓ stay
     the page's). Under reduced motion there is no coast and no ease-back: the scene stays
     where the input left it. */
  const rot={yaw:0,pitch:0,vy:0,vp:0};
  API.rotate=(y,p)=>{ rot.yaw=y||0; rot.pitch=p||0; rot.vy=0; rot.vp=0; };
  API.rot=()=>({yaw:rot.yaw,pitch:rot.pitch,vy:rot.vy,vp:rot.vp,dragging:!!drag});
  let drag=null;
  canvas.style.touchAction='pan-y pinch-zoom';
  // a click on the field is not a request to operate it (and must not sweep a text
  // selection across the page): focus reaches the canvas by Tab only
  if(TURN) canvas.addEventListener('mousedown',e=>{ if(e.button===0) e.preventDefault(); });   // an image lets a click be a click (focus moves, middle-click scrolls)
  const endDrag=e=>{ if(drag&&e.pointerId===drag.id) drag=null; };
  if(TURN){
    canvas.addEventListener('pointerdown',e=>{
      if(e.button!==0&&e.pointerType==='mouse') return;
      drag={id:e.pointerId,x:e.clientX,y:e.clientY,touch:e.pointerType!=='mouse'};
      try{ canvas.setPointerCapture(e.pointerId); }catch(err){}
    });
    canvas.addEventListener('pointermove',e=>{
      if(!drag||e.pointerId!==drag.id) return;
      const dx=e.clientX-drag.x, dy=e.clientY-drag.y; drag.x=e.clientX; drag.y=e.clientY;
      // the release velocity is the last move, capped: a coarse event stream (a slow touch
      // digitizer, a synthetic pointer) must not fling the scene a full turn
      const rm=prm.matches;
      rot.yaw+=dx*0.006; rot.vy=rm?0:clamp(dx*0.006,-0.08,0.08);
      if(!drag.touch){ rot.pitch=clamp(rot.pitch+dy*0.005,-0.7,0.7); rot.vp=rm?0:clamp(dy*0.005,-0.05,0.05); }
    });
    canvas.addEventListener('keydown',e=>{
      if(e.altKey||e.metaKey||e.ctrlKey) return;              // modified arrows are the browser's (Alt/Cmd+Left = Back)
      const k=e.key; if(k!=='ArrowLeft'&&k!=='ArrowRight') return;   // ↑ ↓ scroll the page
      const dir=k==='ArrowLeft'?-1:1;
      if(prm.matches) rot.yaw+=dir*0.12;                       // a step of ~7°, no coast
      else rot.vy+=dir*0.012;                                  // a nudge of velocity; held, the key repeats — about 7° per press after the decay
      e.preventDefault();
    });
  }

  /* the pointer feeds the light (page runtime verbatim: a lantern appears on contact — a
     held thumb lights without moving; passive, touchmove-fed on iOS) */
  const ptr={x:-9,y:-9,lag:[-9,-9],hist:[],active:0,s:0};
  function feedPtr(e){
    const r=canvas.getBoundingClientRect(); if(r.width<1||r.height<1) return;
    const x=(e.clientX-r.left)/r.width*2-1, y=1-(e.clientY-r.top)/r.height*2;
    const t=performance.now();
    ptr.hist.push({x,y,t}); while(ptr.hist.length&&t-ptr.hist[0].t>160) ptr.hist.shift();
    const old=ptr.hist[0]; ptr.lag=[old.x,old.y]; ptr.x=x; ptr.y=y; ptr.active=1;
  }
  addEventListener('pointerdown',feedPtr,{passive:true});
  addEventListener('pointermove',feedPtr,{passive:true});
  addEventListener('pointerup',e=>{ endDrag(e); if(e.pointerType!=='mouse') ptr.active=0; },{passive:true});
  addEventListener('pointercancel',e=>{ endDrag(e); ptr.active=0; },{passive:true});
  addEventListener('touchmove',e=>{ const t=e.touches[0]; if(t) feedPtr(t); },{passive:true});
  addEventListener('touchend',e=>{ if(e.touches.length===0) ptr.active=0; },{passive:true});
  addEventListener('touchcancel',()=>{ ptr.active=0; },{passive:true});
  document.documentElement.addEventListener('mouseleave',()=>{ ptr.active=0; if(!hasRest){ ptr.x=-9; ptr.y=-9; } });

  /* the intro. At boot the stars gather from a far scatter (uIntro) and, when the page opens
     on a scene of marks, the marks fly in from the stars (introF runs the stars → scene
     flight; the key holds on that scene meanwhile). Replay flies the marks back out to the
     stars and in again — only from a scene at rest; in the universe there is nothing to
     replay. Under reduced motion the intro flight never runs — introStart stays −1 for the
     page's life and replay restarts the fade instead. */
  let introStart=-1, introV=prm.matches?1:0, introF=1, introK=-1, introMode='boot', fadeStart=-1, bootT=0;
  API.intro=()=>introF;
  const canReplay=()=>{ const k=Math.round(key); return starsK>=0&&introStart<0&&Math.abs(key-k)<0.001&&scenes[steps[k]].kind!=='stars'; };
  API.replay=()=>{
    if(!canReplay()) return;
    if(prm.matches){ setOp('0'); fadeStart=-2; return; }
    if(DOC01){ introK=-1; introMode='boot'; introStart=-2; return; }   // 0.1: the stars gather again
    introK=Math.round(key); introMode='replay'; introStart=-2; };
  const replayBtn=document.querySelector('[data-replay]'); let replayOn=null;
  const syncReplay=()=>{ if(!replayBtn) return; const on=canReplay(); if(on!==replayOn){ replayOn=on; replayBtn.disabled=!on; } };
  if(replayBtn) replayBtn.addEventListener('click',()=>{
    API.replay();
    // pointer activation drops focus so a following Space scrolls rather than replays;
    // keyboard activation keeps its ring
    let kb=false; try{ kb=replayBtn.matches(':focus-visible'); }catch(e){}
    if(!kb) replayBtn.blur(); });

  /* camera fit per step: a crop fits the part of the viewport it is shifted into (the
     column beside the words on the wide layout, the top on the narrow one), with a
     margin on its far edge; the star field fits by height only */
  const tf=Math.tan(22.5*Math.PI/180);
  let bandB=0;   // 0.2 (narrow): the painting's floor as a fraction of the canvas height, from the top (0 = the fixed fit)
  let liftF=0;   // 0.2.3 (narrow): how far the painting has risen, a fraction of the canvas height
  function stepView(k,ar,narrow){
    const s=scenes[k], stars=s.kind==='stars';
    const wH=s.height, wW=stars?0:s.width;
    if(!stars&&narrow&&bandB>0){
      /* the painting fits the band from just under the top edge down to the line its words
         stand on, so the rocks end above the words instead of under them; nearly the full
         width, a small side margin. The stars keep their fit: the flight's far end is the same */
      const top=0.035, availH=bandB-top, cy=(top+bandB)/2;
      const dist=clamp(Math.max(wH/(2*tf*availH),1.08*wW/(2*tf*ar)),0.7,12);
      const worldH=2*tf*dist;
      return {dist,shift:[0,(1-2*cy)*worldH/2+liftF*worldH,0],pitch:s.pitch}; }
    const ax=stars?0:(narrow?0:0.3), ay=stars?0:(narrow?0.17:0);
    const dist=clamp(1.12*Math.max(wH/(2*tf*(1-ay)),wW/(2*tf*ar*(1-ax))),0.7,12);
    const worldH=2*tf*dist, worldW=worldH*ar;
    return {dist,shift:[ax*worldW/2,ay*worldH/2,0],pitch:s.pitch};
  }
  let dprCap=2, slow=0, lastOp='';
  function setOp(v){ if(v!==lastOp){ lastOp=v; canvas.style.opacity=v; } }
  function resize(){
    const dpr=Math.min(devicePixelRatio||1,dprCap);
    const w=Math.round((canvas.clientWidth||innerWidth)*dpr), h=Math.round((canvas.clientHeight||innerHeight)*dpr);
    const changed=canvas.width!==w||canvas.height!==h;
    if(changed){ canvas.width=w; canvas.height=h; }
    gl.viewport(0,0,canvas.width,canvas.height);
    return changed;
  }
  addEventListener('resize',measure,{passive:true});
  measure(); setTimeout(measure,600); setTimeout(measure,2500);   // fonts and late layout move the anchors
  if(prm.matches) setOp('0');

  const R=new Float32Array(9);
  let t0=0,lastT=0, measuredAt=0, rmWas=prm.matches, drewOnce=false;
  const pd={s:-1,x:0,y:0,lx:0,ly:0,lift:-1};                       // the light as last drawn (the rest gate)
  function draw(t){
    if(dead) return;
    requestAnimationFrame(draw);
    const RM=prm.matches;
    if(!bootT){
      bootT=t; t0=t; lastT=t;
      // the FIRST DRAWN FRAME: the latest safe moment — browser scroll restoration and a
      // fragment jump have landed, and a page opened in a background tab is fronted. The
      // key starts where the words are (no rush through every scene in between).
      measure(); key=targetKey();
      if(!RM){ introStart=t; introMode='boot';
        // the fly-in: only when the page opens ON a scene of marks (restored to the universe, there is nothing to fly in)
        const k=Math.round(key); introK=(!DOC01&&starsK>=0&&Math.abs(key-k)<0.001&&scenes[steps[k]].kind!=='stars')?k:-1; }
      else fadeStart=t;
    }
    const dt=Math.min(100,t-lastT); lastT=t;
    if(introStart===-2) introStart=t; if(fadeStart===-2) fadeStart=t;
    const rmChanged=RM!==rmWas; rmWas=RM;
    if(rmChanged){ syncMotion(); if(RM){ introStart=-1; introV=1; setOp('1'); } }   // a live switch: the flight ends where it is
    const resized=resize();
    if(canvas.width<8||canvas.height<8) return;
    if(t-measuredAt>1000){ measure(); measuredAt=t; }   // layout can move without a resize (images, fonts)

    introF=1;
    if(introStart>=0){
      const p=INTRO_MS>0?Math.min(1,(t-introStart)/INTRO_MS):1;
      if(introMode==='boot'){ introV=Math.min(1,DOC01?p:p/0.4); if(introK>=0) introF=smooth(clamp((p-0.25)/0.75,0,1)); }
      else { introV=1; if(introK>=0) introF=p<0.25?1-smooth(p/0.25):smooth((p-0.25)/0.75); }
      if(p>=1){ introStart=-1; introV=1; introF=1; }
    }
    const flyingIn=introStart>=0&&introK>=0;
    if(RM){ if(fadeStart>=0){ const p=Math.min(1,(t-fadeStart)/1200); setOp(p.toFixed(3)); if(p>=1) fadeStart=-1; } }
    else setOp('1');

    const target=targetKey();
    if(flyingIn) key=introK;                          // the key waits on the scene until every mark has landed
    else { key+=(target-key)*Math.min(1,dt/140); if(Math.abs(key-target)<0.0005) key=target; }
    /* 0.2.5: the step the key rests on is marked on its element (class glyph-here) — the page
       times its own motion to the reader's arrival (the lines that wipe while they linger);
       not during the fly-in, and gone the moment the key leaves the step */
    { const h=Math.round(key), at=(!flyingIn&&Math.abs(key-h)<0.02)?h:-1;
      if(at!==hereK){ if(hereK>=0&&liveEls[hereK]) liveEls[hereK].classList.remove('glyph-here');
        if(at>=0&&liveEls[at]) liveEls[at].classList.add('glyph-here'); hereK=at; } }
    const kA=clamp(Math.floor(key),0,steps.length-1), kB=Math.min(kA+1,steps.length-1);
    let sA=steps[kA], sB=steps[kB], f=key-kA;
    // the camera stays where the key is; only the homes the shader reads change for the fly-in
    { const H=canvas.clientHeight||innerHeight; bandB=(wordsLine>0&&narrowMQ.matches)?clamp((wordsLine-0.02*H)/H,0.35,0.95):0;
      // the lift: from the anchor of the last block of scene words on, the painting rises with
      // the scroll — LIFT_RATE of it at first, easing toward LIFT_MAX of the viewport — and
      // comes back down the same way. Scroll-driven like the flights: it stands under reduced motion
      const d=(bandB>0&&LIFT_RATE>0&&LIFT_MAX>0&&liftK>=0&&liftK<anchors.length&&forcedKey===null)?Math.max(0,scrollY-anchors[liftK]):0;
      liftF=d>0?LIFT_MAX*(1-Math.exp(-LIFT_RATE*d/(LIFT_MAX*H))):0; }
    const vA=stepView(sA,canvas.width/canvas.height,narrowMQ.matches), vB=flyingIn?vA:stepView(sB,canvas.width/canvas.height,narrowMQ.matches);
    if(flyingIn){ sB=sA; sA=starsK; f=introF; }             // the same view at both ends: only the homes the shader reads change
    syncReplay();

    // rotation: while a drag holds the scene it follows the pointer exactly; released, the
    // last velocity carries it a little further, then it eases back to straight-on (never
    // under reduced motion: the scene stays where the input left it)
    if(TURN&&!drag&&!RM){
      rot.yaw+=rot.vy; rot.pitch=clamp(rot.pitch+rot.vp,-0.7,0.7);
      rot.vy*=0.90; rot.vp*=0.90;
      rot.yaw*=Math.pow(0.35,dt/1000); rot.pitch*=Math.pow(0.35,dt/1000); }
    if(Math.abs(rot.vy)<1e-4) rot.vy=0; if(Math.abs(rot.vp)<1e-4) rot.vp=0;              // the decays settle (sub-pixel at any resolution)
    if(!RM){ if(Math.abs(rot.yaw)<1e-4&&!rot.vy) rot.yaw=0; if(Math.abs(rot.pitch)<1e-4&&!rot.vp) rot.pitch=0; }
    const cy=Math.cos(rot.yaw),sy=Math.sin(rot.yaw),cp=Math.cos(rot.pitch),spp=Math.sin(rot.pitch);
    // R = Ry(yaw)·Rx(pitch), column-major
    R[0]=cy; R[1]=0; R[2]=-sy; R[3]=sy*spp; R[4]=cp; R[5]=cy*spp; R[6]=sy*cp; R[7]=-spp; R[8]=cy*cp;

    const ms=RM?0:1, ar=canvas.width/canvas.height, ef=smooth(f);
    const dist=mix(vA.dist,vB.dist,ef);
    let yaw=0,pitch=0;
    // the camera's slow drift belongs to turning: with turn off it looks straight on and holds
    if(ms&&TURN){ const s=(t-t0)/1000; yaw=Math.sin(s*0.21)*0.07+Math.sin(s*0.083)*0.04; pitch=Math.sin(s*0.17+1.1)*0.045; }
    const eye=[dist*Math.cos(pitch)*Math.sin(yaw),dist*Math.sin(pitch),dist*Math.cos(pitch)*Math.cos(yaw)];
    const P=perspective(45*Math.PI/180,ar,0.05,60);
    const MVP=mul(P,lookAt(eye,[0,0,0],[0,1,0]));

    /* 0.2: the rest of the light — with no pointer on the page (a phone; a mouse that left)
       the reader's light stands on the scene's authored point (the moon), placed by this
       frame's camera exactly as the shader places the marks (uRot, then the step's shift,
       then uMVP); it glides there from where the pointer left and fades with the scene as
       the marks fly out or arrive. A pointer on the page always wins. */
    let restOn=0;
    if(hasRest&&!ptr.active){
      const at=(k,v)=>{ const r=scenes[k].rest; if(!r) return null;
        const wx=R[0]*r.x+R[3]*r.y+v.shift[0], wy=R[1]*r.x+R[4]*r.y+v.shift[1], wz=R[2]*r.x+R[5]*r.y+v.shift[2];
        const cw=MVP[3]*wx+MVP[7]*wy+MVP[11]*wz+MVP[15]; if(cw<1e-6) return null;
        return [(MVP[0]*wx+MVP[4]*wy+MVP[8]*wz+MVP[12])/cw,(MVP[1]*wx+MVP[5]*wy+MVP[9]*wz+MVP[13])/cw]; };
      const a=at(sA,vA), b=at(sB,vB), p=ef<0.5?(a||b):(b||a);
      if(p){ restOn=(a&&b)?1:(a?1-ef:ef);
        if(ptr.x<-5){ ptr.x=p[0]; ptr.y=p[1]; }
        else { const g=Math.min(1,dt/220); ptr.x+=(p[0]-ptr.x)*g; ptr.y+=(p[1]-ptr.y)*g; }
        ptr.lag=[ptr.x,ptr.y]; ptr.hist.length=0; } }
    const want=ptr.active?1:restOn;
    ptr.s+=(want-ptr.s)*0.1;
    if(Math.abs(ptr.s-want)<5e-4) ptr.s=want;

    /* the rest gate (reduced motion only): when nothing that reaches the GPU changed since
       the last drawn frame, the previous frame stands — no clear, no 35k-instance draw at
       display rate for a bit-identical image. The light counts when it MOVED or changed
       strength, not merely because it is lit: a resting light is a still image */
    const ptrMoved=ptr.s!==pd.s||ptr.x!==pd.x||ptr.y!==pd.y||ptr.lag[0]!==pd.lx||ptr.lag[1]!==pd.ly;
    const moving=!drewOnce||resized||rmChanged||introStart>=0||fadeStart>=0||key!==target||drag||
                 rot.vy!==0||rot.vp!==0||ptrMoved||liftF!==pd.lift||forcedKey!==null;
    if(RM&&!moving) return;
    drewOnce=true; pd.s=ptr.s; pd.x=ptr.x; pd.y=ptr.y; pd.lx=ptr.lag[0]; pd.ly=ptr.lag[1]; pd.lift=liftF;
    /* the keep-out this frame: the scene's, placed by its view; while a scene is arriving
       it opens once most marks are down (the face lands around 0.7–0.85 of the flight), and
       while one is leaving it holds until most have gone — so a star never slips over a face
       that is still there, and never waits on one that is not */
    const holeOf=(k,v)=>{ const h=scenes[k].hole; return h?[h.x+v.shift[0],h.y+v.shift[1],h.rx,h.ry]:null; };
    const hA=holeOf(sA,vA), hB=holeOf(sB,vB); let hole=[0,0,0,0];
    if(hA&&hB) hole=[mix(hA[0],hB[0],ef),mix(hA[1],hB[1],ef),mix(hA[2],hB[2],ef),mix(hA[3],hB[3],ef)];
    else if(hA){ const k=1-smooth(clamp((ef-0.6)/0.4,0,1)); hole=[hA[0],hA[1],hA[2]*k,hA[3]*k]; }
    else if(hB){ const k=smooth(clamp((ef-0.3)/0.45,0,1)); hole=[hB[0],hB[1],hB[2]*k,hB[3]*k]; }

    gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
    gl.uniformMatrix4fv(U.uMVP,false,MVP);
    gl.uniformMatrix3fv(U.uRot,false,R);
    gl.uniform1i(U.uSceneA,sA); gl.uniform1i(U.uSceneB,sB); gl.uniform1f(U.uF,f);
    gl.uniform3f(U.uShiftA,vA.shift[0],vA.shift[1],vA.shift[2]); gl.uniform3f(U.uShiftB,vB.shift[0],vB.shift[1],vB.shift[2]);
    gl.uniform1f(U.uPitchA,vA.pitch); gl.uniform1f(U.uPitchB,vB.pitch);   // a mark's fill rides in its extra row
    gl.uniform1f(U.uStarSize,STAR_SIZE);
    gl.uniform1f(U.uIntro,RM?1:introV); gl.uniform1f(U.uStarRate,STAR_RATE*ms);
    gl.uniform1f(U.uDist,dist); gl.uniform4f(U.uHole,hole[0],hole[1],hole[2],hole[3]);
    gl.uniform4f(U.uExchange,EX_M*ms,EX_S*ms,EX_P,EX_R);
    gl.uniform1f(U.uSpread,SPREAD);
    gl.uniform1f(U.uSpin,RM?0:SPIN);
    gl.uniform1f(U.uArc,RM?0:ARC);
    gl.uniform1f(U.uTime,(t-t0)/1000);
    gl.uniform1f(U.uMotionScale,ms);
    gl.uniform1f(U.uSparkle,SPARKLE);
    gl.uniform1f(U.uBreath,BREATH);
    gl.uniform1f(U.uShimmer,SHIMMER);
    gl.uniform1f(U.uWakeS,WAKE*0.35*ptr.s); gl.uniform1f(U.uWakeR,0.35);
    gl.uniform1f(U.uAspect,ar);
    gl.uniform2f(U.uPointer,ptr.x,ptr.y); gl.uniform2f(U.uPointerLag,ptr.lag[0],ptr.lag[1]);
    // characters: dithered texels fall away as marks shrink (the frozen core's rule)
    const worldW=2*tf*dist*ar, quadPx=Math.max(vA.pitch,vB.pitch)*FILL/Math.max(1e-6,worldW)*canvas.width;
    gl.uniform1f(U.uDiscard,quadPx>=6?0.42:Math.max(0.14,0.42*quadPx/6));
    gl.bindVertexArray(vao);
    gl.drawElementsInstanced(gl.TRIANGLES,6,gl.UNSIGNED_SHORT,0,N);
    gl.bindVertexArray(null);

    /* the page runtime's one safety valve: sustained slow frames at DPR 2 after the intro settle to DPR 1 */
    if(dprCap>1&&introStart<0){ if(dt>40) slow++; else slow=Math.max(0,slow-2);
      if(slow>60){ dprCap=1; console.info('glyph-sequence: sustained slow frames — settling to DPR 1'); } }
  }
  requestAnimationFrame(draw);
  API.ready=true;
  document.dispatchEvent(new CustomEvent('glyphsequence:ready',{detail:{count:N,assembled:M,stars:NSTAR,scenes:API.scenes,timeline:API.timeline,notes:NOTES.slice()}}));
}
})();
