// NIGHTSTRIKE — a deliberately small, dependency-free WebGL stadium renderer.
const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const mix = (a, b, t) => a + (b - a) * t;
const norm = a => { const d = Math.hypot(...a) || 1; return a.map(v => v / d); };
const cross = (a,b) => [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const dot = (a,b) => a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
const identity = () => new Float32Array([1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]);
function multiply(a,b) { const o = new Float32Array(16); for(let c=0;c<4;c++)for(let r=0;r<4;r++)for(let k=0;k<4;k++)o[c*4+r]+=a[k*4+r]*b[c*4+k];return o; }
function transform(x,y,z,sx=1,sy=1,sz=1,rx=0,ry=0,rz=0) {
  const a=identity(), cx=Math.cos(rx),snx=Math.sin(rx),cy=Math.cos(ry),sny=Math.sin(ry),cz=Math.cos(rz),snz=Math.sin(rz);
  const X=new Float32Array([1,0,0,0,0,cx,snx,0,0,-snx,cx,0,0,0,0,1]);
  const Y=new Float32Array([cy,0,-sny,0,0,1,0,0,sny,0,cy,0,0,0,0,1]);
  const Z=new Float32Array([cz,snz,0,0,-snz,cz,0,0,0,0,1,0,0,0,0,1]);
  a[0]=sx;a[5]=sy;a[10]=sz;
  const o=multiply(multiply(multiply(Z,Y),X),a);o[12]=x;o[13]=y;o[14]=z;return o;
}
function perspective(fov,aspect,near,far){const f=1/Math.tan(fov/2),o=new Float32Array(16);o[0]=f/aspect;o[5]=f;o[10]=(far+near)/(near-far);o[11]=-1;o[14]=2*far*near/(near-far);return o;}
function lookAt(eye,at){const z=norm(eye.map((v,i)=>v-at[i])),x=norm(cross([0,1,0],z)),y=cross(z,x);return new Float32Array([x[0],y[0],z[0],0,x[1],y[1],z[1],0,x[2],y[2],z[2],0,-dot(x,eye),-dot(y,eye),-dot(z,eye),1]);}
function color(hex){if(Array.isArray(hex))return hex;return [(hex>>16&255)/255,(hex>>8&255)/255,(hex&255)/255];}
function point(m,p){return[m[0]*p[0]+m[4]*p[1]+m[8]*p[2]+m[12],m[1]*p[0]+m[5]*p[1]+m[9]*p[2]+m[13],m[2]*p[0]+m[6]*p[1]+m[10]*p[2]+m[14]];}
function normalTransform(m,n){const a=[m[0],m[1],m[2]],b=[m[4],m[5],m[6]],c=[m[8],m[9],m[10]],u=cross(b,c),v=cross(c,a),w=cross(a,b);return norm(u.map((q,i)=>q*n[0]+v[i]*n[1]+w[i]*n[2]));}
function segment(a,b){const delta=b.map((q,i)=>q-a[i]),length=Math.max(.001,Math.hypot(...delta)),y=norm(delta),x=norm(cross(Math.abs(y[2])>.9?[1,0,0]:[0,0,1],y)),z=cross(x,y);return new Float32Array([x[0],x[1],x[2],0,y[0]*length,y[1]*length,y[2]*length,0,z[0],z[1],z[2],0,(a[0]+b[0])/2,(a[1]+b[1])/2,(a[2]+b[2])/2,1]);}

class Geometry {
  constructor(){this.v=[];}
  tri(a,b,c,n,co,uvs=[[0,0],[1,0],[1,1]]){co=color(co);[a,b,c].forEach((p,i)=>this.v.push(...p,...n,...co,...uvs[i],0));return this;}
  quad(a,b,c,d,n,co){this.tri(a,b,c,n,co);this.tri(a,c,d,n,co,[[0,0],[1,1],[0,1]]);return this;}
  box(x,y,z,w,h,d,co){const X=w/2,Y=h/2,Z=d/2;
    this.quad([x-X,y-Y,z+Z],[x+X,y-Y,z+Z],[x+X,y+Y,z+Z],[x-X,y+Y,z+Z],[0,0,1],co);
    this.quad([x+X,y-Y,z-Z],[x-X,y-Y,z-Z],[x-X,y+Y,z-Z],[x+X,y+Y,z-Z],[0,0,-1],co);
    this.quad([x-X,y-Y,z-Z],[x-X,y-Y,z+Z],[x-X,y+Y,z+Z],[x-X,y+Y,z-Z],[-1,0,0],co);
    this.quad([x+X,y-Y,z+Z],[x+X,y-Y,z-Z],[x+X,y+Y,z-Z],[x+X,y+Y,z+Z],[1,0,0],co);
    this.quad([x-X,y+Y,z+Z],[x+X,y+Y,z+Z],[x+X,y+Y,z-Z],[x-X,y+Y,z-Z],[0,1,0],co);
    this.quad([x-X,y-Y,z-Z],[x+X,y-Y,z-Z],[x+X,y-Y,z+Z],[x-X,y-Y,z+Z],[0,-1,0],co);return this;
  }
  sphere(segments=16,rings=10){for(let j=0;j<rings;j++)for(let i=0;i<segments;i++){
    const p=(u,v)=>[Math.sin(v)*Math.cos(u),Math.cos(v),Math.sin(v)*Math.sin(u)];
    const a=p(i/segments*TAU,j/rings*Math.PI),b=p((i+1)/segments*TAU,j/rings*Math.PI),c=p((i+1)/segments*TAU,(j+1)/rings*Math.PI),d=p(i/segments*TAU,(j+1)/rings*Math.PI);
    [a,b,c,a,c,d].forEach(q=>this.v.push(...q,...q,1,1,1,0,0,0));
  }return this;}
  cylinder(sides=12,top=1){for(let i=0;i<sides;i++){const a=i/sides*TAU,b=(i+1)/sides*TAU,n=[Math.cos((a+b)/2),0,Math.sin((a+b)/2)];const A=[Math.cos(a),-.5,Math.sin(a)],B=[Math.cos(b),-.5,Math.sin(b)],C=[Math.cos(b)*top,.5,Math.sin(b)*top],D=[Math.cos(a)*top,.5,Math.sin(a)*top];this.quad(A,B,C,D,n,0xffffff);this.tri([0,-.5,0],B,A,[0,-1,0],0xffffff);this.tri([0,.5,0],D,C,[0,1,0],0xffffff);}return this;}
  // Elliptical ring profiles form tailored jerseys and softly rounded limbs.
  lathe(profile,sides=12,co=0xffffff){
    const vertex=(row,angle,tint)=>{const p=profile[row],before=profile[Math.max(0,row-1)],after=profile[Math.min(profile.length-1,row+1)],dy=Math.max(.001,after[0]-before[0]),dx=(after[1]-before[1])/dy,dz=(after[2]-before[2])/dy,cs=Math.cos(angle),sn=Math.sin(angle),n=norm([p[2]*cs,-(dz*p[1]*sn*sn+dx*p[2]*cs*cs),p[1]*sn]);return[p[1]*cs,p[0],p[2]*sn,...n,...color(tint),0,0,0];};
    for(let j=0;j<profile.length-1;j++)for(let i=0;i<sides;i++){const a=i/sides*TAU,b=(i+1)/sides*TAU,tint=typeof co==='function'?co((profile[j][0]+profile[j+1][0])/2):co,A=vertex(j,a,tint),B=vertex(j,b,tint),C=vertex(j+1,b,tint),D=vertex(j+1,a,tint);this.v.push(...A,...B,...C,...A,...C,...D);}return this;
  }
  append(geometry,m=identity(),tint=null,bone=0){for(let i=0;i<geometry.v.length;i+=12){const v=geometry.v,p=point(m,v.slice(i,i+3)),n=normalTransform(m,v.slice(i+3,i+6)),c=tint===null?v.slice(i+6,i+9):color(tint);this.v.push(...p,...n,...c,v[i+9],v[i+10],bone);}return this;}
}

const vertex=`
attribute vec3 aPosition; attribute vec3 aNormal; attribute vec3 aColor; attribute vec2 aUv; attribute float aBone;
uniform mat4 uModel; uniform mat4 uVP; uniform float uRipple; uniform float uTime; uniform mat4 uBones[13]; uniform float uSkinned; varying vec3 vWorld; varying vec3 vNormal; varying vec3 vColor; varying vec2 vUv; varying float vAthlete;
void main(){mat4 model=uModel;if(uSkinned>.5)model=uModel*uBones[int(aBone+.5)];vec4 world=model*vec4(aPosition,1.);world.z+=sin(world.x*2.4+world.y*1.6-uTime*15.)*uRipple;vWorld=world.xyz;
// Cofactors are the inverse-transpose up to a positive scale, keeping capsule
// lighting correct when animated limb lengths and oval cross-sections differ.
mat3 normalMatrix=mat3(cross(model[1].xyz,model[2].xyz),cross(model[2].xyz,model[0].xyz),cross(model[0].xyz,model[1].xyz));
vNormal=normalize(normalMatrix*aNormal);vColor=aColor;vUv=aUv;vAthlete=uSkinned;gl_Position=uVP*world;}`;
const fragment=`
precision mediump float;
varying vec3 vWorld; varying vec3 vNormal; varying vec3 vColor; varying vec2 vUv; varying float vAthlete;
uniform vec4 uTint; uniform vec3 uEye; uniform vec3 uFog; uniform float uGlow; uniform float uGrass; uniform float uTextured; uniform sampler2D uTexture;
void main(){vec3 n=normalize(vNormal);float diffuse=max(dot(n,normalize(vec3(-.4,.9,.35))),0.)*.6+max(dot(n,normalize(vec3(.7,.6,-.6))),0.)*.3+.3;
vec3 base=vColor*uTint.rgb;float opacity=uTint.a;if(uTextured>.5){vec4 tex=texture2D(uTexture,vUv);base*=tex.rgb;opacity*=tex.a;}
if(uGrass>.5){float blades=fract(sin(dot(floor(vWorld.xz*18.),vec2(12.9898,78.233)))*43758.5453);base*=.91+blades*.16;float spot=exp(-length(vWorld.xz-vec2(0.,-10.))*.015);diffuse+=spot*.13;}
vec3 lit=base*mix(diffuse,1.55,uGlow);if(vAthlete>.5){vec3 view=normalize(uEye-vWorld);float sheen=pow(max(dot(n,normalize(view+normalize(vec3(-.4,.9,.35)))),0.),24.);float rim=pow(1.-max(dot(n,view),0.),3.);lit+=vec3(.16,.21,.22)*sheen+vec3(.035,.08,.085)*rim;}
float dist=length(vWorld-uEye);float fog=smoothstep(42.,145.,dist);lit=mix(lit,uFog,fog*.78);gl_FragColor=vec4(lit,opacity);}`;

export class StadiumRenderer {
  constructor(canvas){
    this.canvas=canvas;this.gl=canvas.getContext('webgl',{alpha:true,antialias:true,powerPreference:'high-performance'});
    if(!this.gl)throw new Error('This device needs WebGL enabled to play Nightstrike.');
    const g=this.gl,compile=(type,src)=>{const s=g.createShader(type);g.shaderSource(s,src);g.compileShader(s);if(!g.getShaderParameter(s,g.COMPILE_STATUS))throw new Error(g.getShaderInfoLog(s));return s;};
    const p=g.createProgram();g.attachShader(p,compile(g.VERTEX_SHADER,vertex));g.attachShader(p,compile(g.FRAGMENT_SHADER,fragment));g.linkProgram(p);if(!g.getProgramParameter(p,g.LINK_STATUS))throw new Error(g.getProgramInfoLog(p));g.useProgram(p);this.program=p;
    this.a={};['Position','Normal','Color','Uv','Bone'].forEach(k=>this.a[k]=g.getAttribLocation(p,'a'+k));this.u={};['Model','VP','Tint','Eye','Glow','Grass','Textured','Texture','Skinned','Fog','Ripple','Time'].forEach(k=>this.u[k]=g.getUniformLocation(p,'u'+k));this.u.Bones=g.getUniformLocation(p,'uBones[0]');
    g.enable(g.DEPTH_TEST);g.clearColor(0,0,0,0);g.blendFuncSeparate(g.SRC_ALPHA,g.ONE_MINUS_SRC_ALPHA,g.ONE,g.ONE_MINUS_SRC_ALPHA);
    this.meshes={cube:this.upload(new Geometry().box(0,0,0,1,1,1,0xffffff)),sphere:this.upload(new Geometry().sphere()),orb:this.upload(new Geometry().sphere(10,6)),cylinder:this.upload(new Geometry().cylinder()),cone:this.upload(new Geometry().cylinder(12,0))};
    this.quality='auto';this.cameraMode='wide';this.reducedMotion=false;this.particles=[];this.netRipple=0;this.buildStadium();this.buildBall();this.buildPlayers();this.textures.glow=this.glowTexture();this.trail=[];this.lastBall={x:0,z:20};this.roll=0;this.eye=[0,13,42];this.look=[0,0,0];this.ready=true;this.resize();
    const ring=new Geometry();for(let i=0;i<40;i++){const a=i/40*TAU,b=(i+1)/40*TAU;ring.quad([Math.cos(a),0,Math.sin(a)],[Math.cos(b),0,Math.sin(b)],[Math.cos(b)*1.055,0,Math.sin(b)*1.055],[Math.cos(a)*1.055,0,Math.sin(a)*1.055],[0,1,0],0xffffff);}this.meshes.ring=this.upload(ring);
  }
  upload(geometry){const g=this.gl,b=g.createBuffer();g.bindBuffer(g.ARRAY_BUFFER,b);g.bufferData(g.ARRAY_BUFFER,new Float32Array(geometry.v),g.STATIC_DRAW);return{buffer:b,count:geometry.v.length/12};}
  buildBall(){
    const geo=new Geometry(),phi=(1+Math.sqrt(5))/2,vertices=[];
    [-1,1].forEach(a=>[-phi,phi].forEach(b=>{vertices.push([0,a,b],[a,b,0],[b,0,a]);}));
    vertices.forEach(v=>{const n=norm(v),ref=Math.abs(n[1])>.9?[1,0,0]:[0,1,0],u=norm(cross(n,ref)),w=cross(n,u),p=[];
      for(let i=0;i<5;i++){const ang=i/5*TAU+.3;const d=n.map((q,k)=>q*.93+(u[k]*Math.cos(ang)+w[k]*Math.sin(ang))*.35);p.push(norm(d).map(q=>q*1.008));}
      const center=n.map(q=>q*1.01);for(let i=0;i<5;i++)geo.tri(center,p[i],p[(i+1)%5],n,0xffffff);
    });this.meshes.patches=this.upload(geo);
  }
  buildPlayers(){
    // Nine reusable meshes share the same 13-bone rig. Every jersey, face,
    // boot and trim is baked once; each animated footballer costs one draw.
    this.playerMeshes=new Map();this.playerBones=new Float32Array(13*16);
    const ball=new Geometry().sphere(12,8),smallBall=new Geometry().sphere(8,5);
    const profiles={
      torso:[[-.52,.27,.20],[-.47,.35,.24],[-.24,.38,.25],[.12,.46,.28],[.32,.51,.27],[.41,.46,.23],[.49,.20,.17],[.51,.16,.15]],
      pelvis:[[-.23,.27,.19],[-.18,.36,.24],[.12,.39,.25],[.22,.32,.22]],
      thigh:[[-.54,.035,.035],[-.48,.16,.17],[-.27,.21,.22],[.22,.20,.20],[.44,.17,.18],[.52,.04,.04]],
      shin:[[-.54,.025,.025],[-.47,.13,.14],[-.3,.145,.15],[.25,.115,.13],[.46,.10,.11],[.53,.02,.02]],
      arm:[[-.54,.025,.025],[-.47,.17,.18],[-.25,.18,.19],[.22,.145,.15],[.45,.12,.13],[.53,.025,.025]],
      forearm:[[-.54,.02,.02],[-.45,.12,.125],[-.17,.13,.13],[.27,.10,.11],[.49,.09,.095],[.54,.015,.015]]
    };
    const kits=[0xce3545,0x6dcce8,0xff9c3b],skins=[0x95694e,0xc39a77,0xe1b58d],hair=[0x16202a,0x332c27,0x36251e];
    kits.forEach(kit=>skins.forEach((skin,variant)=>{
      const keeper=kit===0xff9c3b,shorts=kit===0x6dcce8?0xe3f0e9:0x162d3c,trim=kit===0x6dcce8?0x17415c:0xf5eade,boot=variant===0?0xf2dba5:variant===1?0x95eac7:0xe7eef1,g=new Geometry();
      const add=(shape,m,c,bone)=>g.append(shape,m,c,bone);
      const ellipsoid=(x,y,z,sx,sy,sz,c,bone,small=false)=>add(small?smallBall:ball,transform(x,y,z,sx,sy,sz),c,bone);
      add(new Geometry().lathe(profiles.torso,16,kit),identity(),null,0);
      // A shaped collar, sleeve cuffs and a small original shield distinguish kits.
      add(new Geometry().lathe([[.445,.22,.19],[.475,.195,.17],[.5,.165,.15]],16,trim),identity(),null,0);
      add(new Geometry().lathe([[-.49,.345,.245],[-.445,.357,.247]],16,trim),identity(),null,0);
      const badge=new Geometry();badge.tri([-.27,.20,.269],[-.12,.20,.285],[-.145,.08,.283],[0,0,1],0xf7e3aa);badge.tri([-.27,.20,.269],[-.145,.08,.283],[-.245,.08,.272],[0,0,1],0xf7e3aa);badge.tri([-.245,.08,.272],[-.145,.08,.283],[-.195,.025,.284],[0,0,1],0xf7e3aa);add(badge,identity(),null,0);
      // Clean geometric numerals remain readable without external textures.
      const numeral=keeper?1:variant===0?7:variant===1?9:11,segments={0:[0,1,2,3,4,5],1:[1,2],2:[0,1,6,4,3],3:[0,1,6,2,3],4:[5,6,1,2],5:[0,5,6,2,3],6:[0,5,6,4,2,3],7:[0,1,2],8:[0,1,2,3,4,5,6],9:[0,1,2,3,5,6]};
      const digit=(n,cx,z,back=false)=>{const layout=[[0,.17,.13,.027],[.064,.09,.026,.13],[.064,-.07,.026,.13],[0,-.15,.13,.027],[-.064,-.07,.026,.13],[-.064,.09,.026,.13],[0,.01,.13,.027]];for(const k of segments[n]){const [xx,yy,w,h]=layout[k];const mark=new Geometry().box(cx+xx,yy-.1,z,w,h,.008,trim);add(mark,identity(),null,0);}};
      const digits=String(numeral).split('').map(Number);digits.forEach((n,i)=>{const cx=(i-(digits.length-1)/2)*.18;digit(n,cx,.267);digit(n,cx,-.267,true);});
      add(new Geometry().lathe(profiles.pelvis,12,shorts),identity(),null,12);
      [6,8].forEach(bone=>add(new Geometry().lathe(profiles.thigh,10,y=>y>.34?skin:shorts),identity(),null,bone));
      [7,9].forEach(bone=>add(new Geometry().lathe(profiles.shin,10,y=>y<-.27?skin:y<-.17?trim:kit),identity(),null,bone));
      [2,4].forEach(bone=>add(new Geometry().lathe(profiles.arm,10,y=>y<.12?kit:y<.20?trim:skin),identity(),null,bone));
      [3,5].forEach(bone=>{add(new Geometry().lathe(profiles.forearm,10,skin),identity(),null,bone);ellipsoid(0,.55,.015,.115,.12,.085,keeper?0xc7ffe7:skin,bone,true);});
      // An oval last, low sole and raised heel replace the former cuboid boots.
      [10,11].forEach(bone=>{
        ellipsoid(0,.01,.10,.205,.14,.37,boot,bone);
        ellipsoid(0,-.08,.10,.21,.047,.36,0x173340,bone);
        ellipsoid(0,.075,-.07,.15,.15,.17,boot,bone,true);
        const stripe=new Geometry();stripe.quad([-.17,.02,.02],[-.18,.055,.19],[-.18,.09,.21],[-.17,.08,.04],[-1,0,0],0xf8fbef);stripe.quad([.17,.02,.02],[.18,.055,.19],[.18,.09,.21],[.17,.08,.04],[1,0,0],0xf8fbef);add(stripe,identity(),null,bone);
      });
      // Neck, jaw, ears, nose and swept hair all belong to the moving head bone.
      ellipsoid(0,-.29,0,.125,.17,.125,skin,1,true);
      ellipsoid(0,0,0,.285,.36,.275,skin,1);
      ellipsoid(0,-.15,.035,.23,.21,.235,skin,1);
      ellipsoid(-.285,-.015,0,.063,.10,.052,skin,1,true);ellipsoid(.285,-.015,0,.063,.10,.052,skin,1,true);
      ellipsoid(0,-.005,.267,.057,.08,.075,skin,1,true);
      add(new Geometry().lathe([[.10,.275,.25],[.20,.277,.25],[.30,.22,.205],[.37,.095,.10],[.385,.008,.008]],12,hair[variant]),transform(0,0,-.025),null,1);
      ellipsoid(variant===1?.1:-.09,.205,.165,.19,.085,.14,hair[variant],1,true);
      const face=new Geometry();for(const side of [-1,1]){const xx=side*.105;face.quad([xx-.033,.045,.258],[xx+.033,.045,.258],[xx+.03,.085,.253],[xx-.03,.085,.253],[0,0,1],0x101e27);face.quad([xx-.045,.11,.25],[xx+.04,.105,.25],[xx+.04,.125,.244],[xx-.045,.13,.244],[0,0,1],hair[variant]);}face.quad([-.055,-.16,.252],[.055,-.16,.252],[.04,-.175,.246],[-.04,-.175,.246],[0,0,1],0x794d40);add(face,identity(),null,1);
      this.playerMeshes.set(`${kit}:${variant}`,this.upload(g));
    }));
  }
  buildStadium(){
    const turf=new Geometry(),s=new Geometry(),emit=new Geometry(),net=new Geometry();
    turf.box(0,-.19,0,38,.3,118,0x134536);
    for(let z=-50;z<50;z+=5)turf.box(0,-.018,z+2.5,28,.03,5,((z/5)%2===0)?0x237348:0x2a8051);
    const line=(x,z,w,d)=>s.box(x,.018,z,w,.035,d,0xa8d2b2);
    line(-14,0,.1,100);line(14,0,.1,100);line(0,-50,28,.1);line(0,50,28,.1);line(0,0,28,.11);
    for(let k=0;k<80;k++){const a=k/80*TAU,b=(k+1)/80*TAU;s.quad([Math.cos(a)*5.9,.022,Math.sin(a)*5.9],[Math.cos(b)*5.9,.022,Math.sin(b)*5.9],[Math.cos(b)*6.02,.022,Math.sin(b)*6.02],[Math.cos(a)*6.02,.022,Math.sin(a)*6.02],[0,1,0],0x94bda0);}
    [-1,1].forEach(side=>{line(-9,side*42,.1,16);line(9,side*42,.1,16);line(0,side*34,18,.1);line(-5.4,side*46.8,.1,6.4);line(5.4,side*46.8,.1,6.4);line(0,side*43.6,10.8,.1);line(0,side*39,.17,.17);});
    // Stands are built in tiers, with individually coloured spectator silhouettes.
    let seed=257;const rand=()=>{seed=(seed*16807)%2147483647;return(seed-1)/2147483646;};
    const crowd=[0x16373c,0x47636b,0x1e5761,0x608485,0x934c41,0x456778,0xa19075,0x205954];
    [-1,1].forEach(side=>{
      s.box(side*36,7,0,.6,14,136,0x091f2a);
      for(let row=0;row<8;row++){
        const x=side*(18.7+row*1.7),h=1.5+row*1.08;s.box(x,h/2,-2,1.8,h,132,row%2?0x122d36:0x19383e);
        for(let z=-65;z<64;z+=1.05){const jitter=rand();s.box(x,h+.25,z,.37,.5,.35,crowd[Math.floor(rand()*crowd.length)]);if(jitter>.5)s.box(x,h+.61,z,.24,.22,.24,0x82786d);}
      }
      s.box(side*26,14,-2,19,.42,136,0x102731);s.box(side*17,13.7,-2,.19,.4,136,0x48606a);
      for(let z=-62;z<65;z+=13){s.box(side*34,7,z,.35,14,.35,0x32505a);s.box(side*25,14.28,z,18,.2,.18,0x34505c);}
      // Continuous turquoise advertising ribbon and pitch barrier.
      s.box(side*16.6,.5,0,.25,1,108,0x091e24);emit.box(side*16.42,.72,0,.035,.11,108,0x23bba4);
      for(let z=-48;z<51;z+=12){s.box(side*16.4,.45,z,.06,.6,10,0x0c3537);emit.box(side*16.35,.43,z,.065,.055,6,0x459d91);}
    });
    [-1,1].forEach(side=>{
      for(let row=0;row<8;row++){const z=side*(57+row*1.65),h=1.5+row*1.08;s.box(0,h/2,z,69,h,1.75,row%2?0x152e39:0x1b3e43);for(let x=-33;x<34;x+=1.04){s.box(x,h+.25,z,.35,.5,.35,crowd[Math.floor(rand()*crowd.length)]);if(rand()>.5)s.box(x,h+.62,z,.22,.22,.22,0x837d6b);}}
      s.box(0,14.1,side*65,72,.45,18,0x0b202b);s.box(0,13.8,side*56,71,.2,.2,0x41606c);
      s.box(0,.55,side*54.5,35,1.1,.25,0x0a2428);emit.box(0,.82,side*54.3,34,.12,.04,0x35b9a8);
    });
    // Four lattice towers, each with an array of luminous stadium lamps.
    this.towers=[];
    for(const x of [-29,29])for(const z of [-52,34]){
      this.towers.push([x,23,z]);s.box(x,11.3,z,.6,22.6,.6,0x41616b);s.box(x-.7,11.3,z,.13,22.6,.13,0x2c424b);s.box(x+.7,11.3,z,.13,22.6,.13,0x2c424b);
      for(let y=2;y<22;y+=3)s.box(x,y,z,1.6,.13,.13,0x5c747b);
      s.box(x,23,z,7,2.65,.55,0x23424f);for(let i=0;i<7;i++)for(let j=0;j<2;j++)emit.box(x-2.9+i*.96,22.45+j*1.04,z+.32,.73,.73,.08,0xd6ffed);
    }
    // Far goal, with a three-dimensional net and softly luminous white frame.
    s.box(-6,2,-49,.19,4,.19,0xe0e9df);s.box(6,2,-49,.19,4,.19,0xe0e9df);s.box(0,4,-49,12.2,.19,.19,0xe0e9df);
    s.box(-6,1.85,-52,.12,3.7,.12,0x7eaaa2);s.box(6,1.85,-52,.12,3.7,.12,0x7eaaa2);s.box(0,3.7,-52,12,.12,.12,0x7eaaa2);
    for(let x=-6;x<=6;x+=.5){net.box(x,1.9,-52,.025,3.8,.025,0x75a49c);net.box(x,3.86,-50.5,.025,.025,3,0x75a49c);}
    for(let y=.2;y<=4;y+=.4){net.box(0,y,-52,12,.022,.022,0x75a49c);net.box(-6,y,-50.5,.022,.022,3,0x75a49c);net.box(6,y,-50.5,.022,.022,3,0x75a49c);}
    for(let z=-52;z<=-49;z+=.5){net.box(-6,1.95,z,.022,3.9,.022,0x75a49c);net.box(6,1.95,z,.022,3.9,.022,0x75a49c);net.box(0,3.9,z,12,.022,.022,0x75a49c);}
    this.meshes.turf=this.upload(turf);this.meshes.stadium=this.upload(s);this.meshes.emissive=this.upload(emit);this.meshes.net=this.upload(net);
    this.meshes.plane=this.upload(new Geometry().quad([-.5,-.5,0],[.5,-.5,0],[.5,.5,0],[-.5,.5,0],[0,0,1],0xffffff));
    this.textures={brand:this.textTexture('NIGHTSTRIKE','OWN THE NIGHT.',1024,256),score:this.textTexture('NIGHT LEAGUE','●  LIVE FROM COMET ARENA',1024,400)};
  }
  setOptions(options={}){
    const resize=options.quality&&options.quality!==this.quality;
    this.quality=options.quality||this.quality;this.cameraMode=options.camera||this.cameraMode;this.reducedMotion=Boolean(options.reducedMotion);
    if(this.reducedMotion){this.trail=[];this.particles=[];}if(resize)this.resize();
  }
  glowTexture(){
    const c=document.createElement('canvas');c.width=c.height=64;const ctx=c.getContext('2d'),grad=ctx.createRadialGradient(32,32,0,32,32,32);
    grad.addColorStop(0,'rgba(255,255,255,0.9)');grad.addColorStop(.16,'rgba(240,255,255,0.45)');grad.addColorStop(.45,'rgba(220,245,255,0.12)');grad.addColorStop(1,'rgba(220,245,255,0)');ctx.fillStyle=grad;ctx.fillRect(0,0,64,64);
    const g=this.gl,t=g.createTexture();g.bindTexture(g.TEXTURE_2D,t);g.texImage2D(g.TEXTURE_2D,0,g.RGBA,g.RGBA,g.UNSIGNED_BYTE,c);g.texParameteri(g.TEXTURE_2D,g.TEXTURE_MIN_FILTER,g.LINEAR);g.texParameteri(g.TEXTURE_2D,g.TEXTURE_MAG_FILTER,g.LINEAR);g.texParameteri(g.TEXTURE_2D,g.TEXTURE_WRAP_S,g.CLAMP_TO_EDGE);g.texParameteri(g.TEXTURE_2D,g.TEXTURE_WRAP_T,g.CLAMP_TO_EDGE);return t;
  }
  burst(x,y,z,kind='trick'){
    if(this.reducedMotion)return;
    const goal=kind==='goal',coin=kind==='coin',count=this.quality==='low'?(goal?22:5):(goal?62:coin?7:15),palette=goal?[0xd8ff88,0xffd08a,0x8ee8ff,0xffffff]:coin?[0xffda71]:[0x8dfce4,0xe0ffa4];
    for(let i=0;i<count;i++)this.particles.push({x:x+(goal?(Math.random()-.5)*10:0),y:y+(goal?2:0),z,vx:(Math.random()-.5)*(goal?6:3),vy:2+Math.random()*(goal?6:3),vz:(Math.random()-.5)*5,life:goal?1.7:0.65,max:goal?1.7:0.65,c:palette[i%palette.length],r:coin?.07:goal?.11:.045,spin:Math.random()*TAU});
    if(this.particles.length>90)this.particles.splice(0,this.particles.length-90);
  }
  textTexture(main,sub,w,h){const c=document.createElement('canvas');c.width=w;c.height=h;const x=c.getContext('2d');x.fillStyle='#091d27';x.fillRect(0,0,w,h);x.strokeStyle='#236c67';x.lineWidth=5;x.strokeRect(5,5,w-10,h-10);x.textAlign='center';x.fillStyle='#cce8dd';x.font=`900 italic ${h*.29}px Arial`;x.fillText(main,w/2,h*.5);x.font=`600 ${h*.11}px Arial`;x.fillStyle='#66c9b4';x.fillText(sub,w/2,h*.76);const g=this.gl,t=g.createTexture();g.bindTexture(g.TEXTURE_2D,t);g.pixelStorei(g.UNPACK_FLIP_Y_WEBGL,true);g.texImage2D(g.TEXTURE_2D,0,g.RGBA,g.RGBA,g.UNSIGNED_BYTE,c);g.texParameteri(g.TEXTURE_2D,g.TEXTURE_MIN_FILTER,g.LINEAR);g.texParameteri(g.TEXTURE_2D,g.TEXTURE_MAG_FILTER,g.LINEAR);g.texParameteri(g.TEXTURE_2D,g.TEXTURE_WRAP_S,g.CLAMP_TO_EDGE);g.texParameteri(g.TEXTURE_2D,g.TEXTURE_WRAP_T,g.CLAMP_TO_EDGE);return t;}
  resize(){const r=this.canvas.getBoundingClientRect(),dpr=Math.min(window.devicePixelRatio||1,this.quality==='low'?1:this.quality==='high'?2:(r.width<760?1.4:1.75));this.width=r.width||window.innerWidth;this.height=r.height||window.innerHeight;this.canvas.width=Math.round(this.width*dpr);this.canvas.height=Math.round(this.height*dpr);this.gl.viewport(0,0,this.canvas.width,this.canvas.height);}
  draw(mesh,model=identity(),tint=0xffffff,alpha=1,glow=0,grass=0,texture=null,bones=null){const g=this.gl;g.bindBuffer(g.ARRAY_BUFFER,mesh.buffer);[['Position',3,0],['Normal',3,12],['Color',3,24],['Uv',2,36],['Bone',1,44]].forEach(([k,n,o])=>{g.enableVertexAttribArray(this.a[k]);g.vertexAttribPointer(this.a[k],n,g.FLOAT,false,48,o);});g.uniformMatrix4fv(this.u.Model,false,model);g.uniform1f(this.u.Skinned,bones?1:0);g.uniform1f(this.u.Ripple,mesh===this.meshes.net?this.netRipple:0);if(bones)g.uniformMatrix4fv(this.u.Bones,false,bones);g.uniform4fv(this.u.Tint,[...color(tint),alpha]);g.uniform1f(this.u.Glow,glow);g.uniform1f(this.u.Grass,grass);g.uniform1f(this.u.Textured,texture?1:0);if(texture){g.bindTexture(g.TEXTURE_2D,texture);g.uniform1i(this.u.Texture,0);}g.drawArrays(g.TRIANGLES,0,mesh.count);}
  box(x,y,z,w,h,d,c,rx=0,ry=0,rz=0,alpha=1,glow=0){this.draw(this.meshes.cube,transform(x,y,z,w,h,d,rx,ry,rz),c,alpha,glow);}
  orb(x,y,z,r,c,alpha=1,glow=0,sx=1,sy=1,sz=1){this.draw(this.meshes.orb,transform(x,y,z,r*sx,r*sy,r*sz),c,alpha,glow);}
  ring(x,z,r,c,alpha=1){this.draw(this.meshes.ring,transform(x,.05,z,r,1,r),c,alpha,1);}
  drawPlayer(x,z,kit,id,bones){for(let i=0;i<13;i++)this.playerBones.set(bones[i],i*16);this.draw(this.playerMeshes.get(`${kit}:${Math.abs(id)%3}`),transform(x,0,z),0xffffff,1,0,0,null,this.playerBones);}
  person(x,z,kit,t,phase='chase',id=0){
    const slide=phase==='slide',stun=phase==='stunned',warn=phase==='warn',bones=new Array(13);
    if(slide){
      bones[0]=transform(0,.72,-.10,1,1,1,-1.08);bones[1]=transform(0,1,-.77,1,1,1,-.55);bones[12]=transform(0,.46,.46,1,1,1,-1.05);
      for(const side of [-1,1]){const left=side<0,arm=left?2:4,leg=left?6:8,hip=[side*.29,.45,.48],knee=[side*.45,.28,1.08],ankle=[side*.48,.19,1.78],shoulder=[side*.45,.88,-.42],elbow=[side*.72,.46,-.1],wrist=[side*.94,.21,.23];bones[leg]=segment(hip,knee);bones[leg+1]=segment(knee,ankle);bones[left?10:11]=transform(ankle[0],.19,1.9,1,1,1,-.17,side*.1);bones[arm]=segment(shoulder,elbow);bones[arm+1]=segment(elbow,wrist);}
      this.drawPlayer(x,z,kit,id,bones);return;
    }
    const running=!warn&&!stun,cycle=t*8.4+id*1.71,wave=running?Math.sin(cycle):0,bob=stun?-.22:warn?-.16:Math.abs(Math.cos(cycle))*.045,lean=stun?.20:warn?-.07:.055,yaw=running?wave*.07:warn?.11:0;
    bones[0]=transform(0,1.78+bob,lean,1,1,1,running?-.055:stun?.18:-.09,yaw,running?wave*.025:0);
    bones[1]=transform(0,2.54+bob,lean+(stun?.13:.025),1,1,1,stun?.19:0,yaw*.5);
    bones[12]=transform(0,1.24+bob,0,1,1,1,0,-yaw*.5);
    // Knees and feet retain a clear centre channel for the nutmeg mechanic.
    for(const side of [-1,1]){
      const left=side<0,leg=left?6:8,arm=left?2:4,stride=running?Math.sin(cycle+(left?0:Math.PI)):0,lift=running?Math.max(0,stride)*.15:0;
      const hip=[side*.31,1.25+bob,0],knee=[side*.655,.68+bob*.35+lift*.45,stride*.18],ankle=[side*.745,.18+lift,stride*.35];
      bones[leg]=segment(hip,knee);bones[leg+1]=segment(knee,ankle);bones[left?10:11]=transform(ankle[0],ankle[1],ankle[2]+.09,1,1,1,running?-Math.max(0,stride)*.19:0,side*.10);
      const goalkeeping=kit===0xff9c3b,shoulder=[side*.46,2.09+bob,lean],elbow=[side*(goalkeeping?.82:warn?.72:.69),1.76+bob,lean-stride*.24+(warn?side*.18:0)],wrist=[side*(goalkeeping?1.02:warn?.84:.67),1.45+bob+(warn?.06:0),lean-stride*.43+.15+(warn?side*.3:0)];
      bones[arm]=segment(shoulder,elbow);bones[arm+1]=segment(elbow,wrist);
    }
    this.drawPlayer(x,z,kit,id,bones);
    if(stun){for(let j=0;j<3;j++)this.orb(x+Math.cos(t*4+j*TAU/3)*.53,2.97,z+Math.sin(t*4+j*TAU/3)*.53,.08,0xffc258,1,1);}
  }
  keeper(state,t){
    const dive=(state.mode==='shot'||state.mode==='result'||state.mode==='celebrating')&&state.shotProgress>.12;
    if(!dive){this.person(state.keeperX||0,-48,0xff9c3b,t,'warn',7);return;}
    const start=state.shotKeeperX??state.keeperX??0,target=state.shotTargetX??state.targetX??0,dir=Math.sign(target-start)||1;
    const reach=Math.min(Math.abs(target-start),state.keeperReach??1.65),p=clamp((state.shotProgress-.12)*1.7,0,1),x=dir*Math.max(0,reach-.85)*p,y=1.3+Math.sin(p*Math.PI)*.32,angle=-dir*p*1.08,body=transform(x,y,0,1,1,1,0,0,angle),bones=new Array(13);
    bones[0]=body;const head=point(body,[0,.77,0]);bones[1]=transform(...head,1,1,1,0,0,angle*.75);const pelvis=point(body,[0,-.6,0]);bones[12]=transform(...pelvis,1,1,1,0,0,angle);
    for(const side of [-1,1]){const left=side<0,leg=left?6:8,arm=left?2:4,hip=point(body,[side*.27,-.55,0]),knee=point(body,[side*.34,-.94,.20]),ankle=point(body,[side*.39,-1.34,.26]);knee[1]=Math.max(.24,knee[1]);ankle[1]=Math.max(.17,ankle[1]);bones[leg]=segment(hip,knee);bones[leg+1]=segment(knee,ankle);bones[left?10:11]=transform(...ankle,1,1,1,0,0,angle*.6);
      const shoulder=point(body,[side*.43,.31,.01]),wrist=[dir*Math.max(0,reach-.10)*p,y+(side===dir?.19:-.12),.32],elbow=[mix(shoulder[0],wrist[0],.55),mix(shoulder[1],wrist[1],.5)-.12,.18];bones[arm]=segment(shoulder,elbow);bones[arm+1]=segment(elbow,wrist);
    }
    this.drawPlayer(start,-48,0xff9c3b,7,bones);
  }
  render(state,dt){
    if(!this.ready)return;
    if(this.canvas.clientWidth!==Math.round(this.width)||this.canvas.clientHeight!==Math.round(this.height))this.resize();
    const g=this.gl,t=state.time||0,b=state.ball||{x:0,y:.5,z:18},mode=state.mode==='paused'?(this.lastMode||'playing'):state.mode,home=mode==='home',aim=['aiming','shot','celebrating'].includes(mode)||(mode==='result'&&state.shotProgress>0),aspect=this.width/this.height,portrait=aspect<.85,fiery=Boolean(state.comet),simDt=state.mode==='paused'?0:dt*(state.focusing?.42:1);
    if(state.mode!=='paused')this.lastMode=state.mode;
    if(home&&this.lastBall.z!==b.z)this.trail=[];
    const wide=this.cameraMode==='wide';
    const targetEye=home?[portrait?-2:-9,portrait?15:10,portrait?44:42]:aim?[0,10.5,-23]:[b.x*(wide?.18:.32),(portrait?16.5:12.5)+(wide?3:0),b.z+(portrait?24:19)+(wide?4:0)];
    const targetLook=home?[portrait?-2.575:-6.327,.48,portrait?18.057:17.315]:aim?[0,-3,-49]:[b.x*.22,.3,b.z-(portrait?15:14)];
    if(!this.cameraInitialized){this.eye=[...targetEye];this.look=[...targetLook];this.cameraInitialized=true;}
    const smooth=1-Math.exp(-Math.max(dt,.016)*4.5);for(let i=0;i<3;i++){this.eye[i]=mix(this.eye[i],targetEye[i],smooth);this.look[i]=mix(this.look[i],targetLook[i],smooth);}
    const shake=this.reducedMotion?0:(state.cameraShake||0),eye=[this.eye[0]+Math.sin(t*74)*shake*.16,this.eye[1]+Math.cos(t*61)*shake*.12,this.eye[2]];
    this.vp=multiply(perspective((portrait?64:53)*Math.PI/180,aspect,.1,220),lookAt(eye,this.look));
    g.useProgram(this.program);g.uniformMatrix4fv(this.u.VP,false,this.vp);g.uniform3fv(this.u.Eye,eye);g.uniform1f(this.u.Time,t);const themes=[[.018,.057,.061],[.032,.033,.075],[.06,.044,.025]],chapter=Math.min(2,Math.floor((state.levelIndex||0)/5));g.uniform3fv(this.u.Fog,themes[chapter]);this.netRipple=state.goalScored&&mode==='celebrating'&&!this.reducedMotion?Math.max(0,.18*(1-state.celebrationTime/1.2)):0;g.clear(g.COLOR_BUFFER_BIT|g.DEPTH_BUFFER_BIT);g.disable(g.BLEND);g.depthMask(true);
    this.draw(this.meshes.turf,identity(),0xffffff,1,0,1);this.draw(this.meshes.stadium);this.draw(this.meshes.emissive,identity(),[0xffffff,0xa4aaff,0xffd391][chapter],1,1);this.draw(this.meshes.net,identity(),0xc5e5dd);
    this.draw(this.meshes.plane,transform(0,10,-57,16,5.8,1),0xffffff,1,.5,0,this.textures.score);
    this.draw(this.meshes.plane,transform(0,.62,-54.3,13,.95,1),0xffffff,1,.6,0,this.textures.brand);
    // All warning geometry sits just above the grass and is drawn transparently.
    g.enable(g.BLEND);g.depthMask(false);
    for(const d of state.defenders||[]){if(d.phase==='warn'||d.phase==='slide'){
      const x=d.laneX??d.x,length=Math.max(.1,(d.laneEnd??(d.z+9))-d.z),z=d.z+length/2,pulse=this.reducedMotion?.27:.24+Math.sin(t*17)*.12;
      this.box(x,.04,z,2.1,.025,length,0xff294e,0,0,0,d.phase==='slide'?.3:pulse,1);
      this.box(x-1.05,.045,z,.045,.025,length,0xff4760,0,0,0,.85,1);this.box(x+1.05,.045,z,.045,.025,length,0xff4760,0,0,0,.85,1);
      for(let k=0;k<3;k++){const zz=d.z+length*(k+1)/4;this.box(x-.21,.06,zz,.5,.025,.075,0xff8a8d,0,.55,0,.7,1);this.box(x+.21,.06,zz,.5,.025,.075,0xff8a8d,0,-.55,0,.7,1);}
    }}
    // Grounding shadows and a faint control ring under the ball.
    const shadow=(x,z,r)=>this.draw(this.meshes.cylinder,transform(x,.034,z,r,.012,r*.68),0x061817,.28);
    for(const d of state.defenders||[])shadow(d.x,d.z,.86);if(state.teammate?.active)shadow(state.teammate.x,state.teammate.z,.8);
    let keeperShadowX=state.keeperX||0;if((mode==='shot'||mode==='result'||mode==='celebrating')&&state.shotProgress>.12){const start=state.shotKeeperX??keeperShadowX,target=state.shotTargetX??0,reach=Math.min(Math.abs(target-start),state.keeperReach??1.65);keeperShadowX=start+(Math.sign(target-start)||1)*Math.max(0,reach-.75)*clamp((state.shotProgress-.12)*1.7,0,1);}shadow(keeperShadowX,-48,.9);shadow(b.x,b.z,.85);
    this.ring(b.x,b.z,.9,fiery?0xff9b4b:0xb1ead6,.4);
    g.depthMask(true);g.disable(g.BLEND);
    for(const d of state.defenders||[])if(home||d.z<b.z+6)this.person(d.x,d.z,0xce3545,t,d.phase,d.id||0);
    if(state.teammate?.active){const mate=state.teammate;this.person(mate.x,mate.z,0x6dcce8,t,'chase',4);g.enable(g.BLEND);g.depthMask(false);this.ring(mate.x,mate.z,1.08,0x62e5ff,.8);g.depthMask(true);g.disable(g.BLEND);this.draw(this.meshes.cone,transform(mate.x,3.45+Math.sin(t*3)*.15,mate.z,.24,.5,.24,Math.PI),0x8be8ff,1,1);}
    this.keeper(state.mode==='paused'?{...state,mode}:state,t);
    // A row of collectible coins gives the route a clear sense of depth.
    for(const c of state.coins||[]){if(c.collected)continue;this.draw(this.meshes.cylinder,transform(c.x,.95+Math.sin(t*3+c.z)*.12,c.z,.32,.085,.32,Math.PI/2,t*2),0xffcb54,1,.65);}
    const skins={classic:[0xf1f0de,0x152933],mint:[0x7fffd6,0x155764],ember:[0xffa64f,0x743832],gold:[0xffdb75,0x75522a],cosmic:[0xb29aff,0x42315f]},skin=skins[state.skin]||skins.classic;
    this.roll+=(Math.hypot(b.x-this.lastBall.x,b.z-this.lastBall.z))*.8;this.lastBall={x:b.x,z:b.z};
    const ballY=b.y??.5,ballModel=transform(b.x,ballY,b.z,.48,.48,.48,this.roll,t*.07,b.x*.22);
    if(!(state.invulnerable>0&&!state.pass?.active&&!fiery&&!this.reducedMotion&&Math.sin(t*30)<-.5)){this.draw(this.meshes.sphere,ballModel,skin[0],1,fiery?.3:0);this.draw(this.meshes.patches,ballModel,skin[1]);}
    // Heat is visible before ignition; at full charge it blooms into a comet tail.
    if(state.heat>8&&simDt>0&&!this.reducedMotion){this.trail.unshift({x:b.x,y:ballY+.08,z:b.z,life:1});}this.trail.forEach(p=>p.life-=simDt*(fiery?1.65:3));this.trail=this.trail.filter(p=>p.life>0).slice(0,38);
    g.enable(g.BLEND);g.depthMask(false);
    this.trail.forEach((p,i)=>{if(i%2)return;const life=p.life,spread=(1-life)*(fiery?.5:.14),xx=p.x+Math.sin(i*8+t*3)*spread,yy=p.y+(fiery?(1-life)*1.5:0),zz=p.z+(fiery?(1-life)*1.3:0);this.orb(xx,yy,zz,(fiery?.42:.2)*life,fiery?(i<8?0xffb943:0xff4b2a):0x69e7c4,life*(fiery?.7:.2),1,1,fiery?1.8:1,1);});
    if(fiery&&!this.reducedMotion){for(let i=0;i<8;i++){const a=t*4+i*2.39,life=(t*2+i*.13)%1;this.orb(b.x+Math.sin(a)*life*.8,ballY+life*1.7,b.z+life*2.8,.08*(1-life)+.02,i%2?0xffe49c:0xff773b,1-life,1);}}
    // Compact, floating shooting reticle on the goal.
    if(state.mode==='aiming'){
      const x=state.targetX||0,safe=Boolean(state.targetSafe),col=safe?0x8fffd0:0xff604f;
      this.box(x,1.6,-48.8,.06,1.2,.06,col,0,0,0,.9,1);this.box(x,1.6,-48.8,1.2,.06,.06,col,0,0,0,.9,1);
      for(const sign of [-1,1]){this.box(x+sign*.63,1.6,-48.8,.04,1.32,.04,col,0,0,0,.8,1);this.box(x,1.6+sign*.65,-48.8,1.3,.04,.04,col,0,0,0,.8,1);}
      this.box(state.keeperX||0,1.8,-48.9,(state.keeperReach??1.65)*2,3.5,.03,0xff7043,0,0,0,.055,1);
    }
    // Soft billboard glows, airborne reward particles and goal confetti.
    if(fiery||state.focusing){this.draw(this.meshes.plane,transform(b.x,b.y+.15,b.z,fiery?3.3:2.7,fiery?3.3:2.7,1),fiery?0xffb45e:0x85d9ff,.42,1,0,this.textures.glow);}
    if(mode==='shot'){this.draw(this.meshes.plane,transform(b.x,b.y,b.z,1.8,1.8,1),0xddffb5,.48,1,0,this.textures.glow);}
    if(simDt>0){for(const p of this.particles){p.life-=simDt;p.x+=p.vx*simDt;p.y+=p.vy*simDt;p.z+=p.vz*simDt;p.vy-=6*simDt;}this.particles=this.particles.filter(p=>p.life>0&&p.y>0);}
    for(const p of this.particles)this.box(p.x,p.y,p.z,p.r,p.r*.5,p.r*.6,p.c,t*2+p.spin,t*3+p.spin,0,p.life/p.max,1);
    // Low-alpha floodlight blooms retain the night atmosphere without washing out turf.
    for(const [x,y,z] of this.towers){if(this.quality!=='low')this.draw(this.meshes.plane,transform(x,y,z+.6,15,9,1),[0xc7fff2,0xb9c3ff,0xffd9a1][chapter],.42,1,0,this.textures.glow);this.draw(this.meshes.cone,transform(x*.63,12,z,7,31.8,7,0,0,x>0?-.76:.76),0xa3ecd8,.014,1);this.orb(x,y,z+.45,2.4,0xb8fff0,.035,1,2,.7,.4);this.orb(x,y,z+.5,1.5,0xe7fff2,.07,1,2,.75,.4);}
    g.depthMask(true);g.disable(g.BLEND);
  }
  project(x,y,z){if(!this.vp)return{x:0,y:0,visible:false};const m=this.vp,xx=m[0]*x+m[4]*y+m[8]*z+m[12],yy=m[1]*x+m[5]*y+m[9]*z+m[13],ww=m[3]*x+m[7]*y+m[11]*z+m[15];return{x:(xx/ww*.5+.5)*this.width,y:(-.5*yy/ww+.5)*this.height,visible:ww>0&&Math.abs(xx/ww)<1.2&&Math.abs(yy/ww)<1.2};}
}
