/* global THREE */
(function(){
"use strict";
const out=t=>1-Math.pow(1-t,3), inout=t=>t<.5?4*t*t*t:1-Math.pow(-2*t+2,3)/2;
class HighStakesTable{
 constructor(canvas){
  if(!canvas||!window.THREE)throw new Error("Three.js or canvas unavailable");
  this.canvas=canvas;this.scene=new THREE.Scene();this.camera=new THREE.PerspectiveCamera(39,1,.1,100);
  this.renderer=new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:"high-performance"});
  this.clock=new THREE.Clock();this.tweens=[];this.fx={win:0,lose:0,allIn:0};this.potChips=[];this.playerChips=[];
  this.renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.7));this.renderer.outputColorSpace=THREE.SRGBColorSpace;
  this.renderer.shadowMap.enabled=true;this.renderer.shadowMap.type=THREE.PCFSoftShadowMap;this.renderer.toneMapping=THREE.ACESFilmicToneMapping;
  this.scene.background=new THREE.Color(0x020806);this.scene.fog=new THREE.FogExp2(0x020806,.073);
  this.camera.position.set(0,6.5,8.9);this.camera.lookAt(0,.05,-.35);
  this.build();this.resize();new ResizeObserver(()=>this.resize()).observe(canvas);this.animate();
 }
 build(){
  this.ambient=new THREE.HemisphereLight(0xa8cbbb,0x120804,1.45);this.scene.add(this.ambient);
  this.key=new THREE.SpotLight(0xffd77e,55,35,Math.PI/5.5,.52,1.25);this.key.position.set(0,9,3);this.key.target.position.set(0,0,-.4);this.key.castShadow=true;this.key.shadow.mapSize.set(1024,1024);this.scene.add(this.key,this.key.target);
  this.rim=new THREE.PointLight(0x4e9f7a,11,16);this.rim.position.set(-4.5,2.4,-3.5);this.scene.add(this.rim);
  this.red=new THREE.PointLight(0x9f1515,5,12);this.red.position.set(4.5,1.3,-2.8);this.scene.add(this.red);
  this.root=new THREE.Group();this.scene.add(this.root);this.buildTable();this.buildZones();this.buildCard();this.buildChips();this.buildHands();this.buildProps();
 }
 mat(color,rough=.6,metal=.05){return new THREE.MeshStandardMaterial({color,roughness:rough,metalness:metal})}
 buildTable(){
  const wood=this.mat(0x3a190a,.5,.08),felt=this.mat(0x075333,.92,.02),brass=this.mat(0xc7932f,.28,.78);
  const base=new THREE.Mesh(new THREE.CylinderGeometry(5.35,5.48,.48,72),wood);base.rotation.x=Math.PI/2;base.scale.z=.71;base.position.y=-.53;base.receiveShadow=base.castShadow=true;this.root.add(base);
  const top=new THREE.Mesh(new THREE.CylinderGeometry(4.85,4.85,.18,72),felt);top.rotation.x=Math.PI/2;top.scale.z=.69;top.position.y=-.18;top.receiveShadow=true;this.root.add(top);
  const rail=new THREE.Mesh(new THREE.TorusGeometry(4.04,.31,20,100),wood);rail.rotation.x=Math.PI/2;rail.scale.y=.69;rail.position.y=.02;rail.castShadow=true;this.root.add(rail);
  const trim=new THREE.Mesh(new THREE.TorusGeometry(3.72,.055,12,100),brass);trim.rotation.x=Math.PI/2;trim.scale.y=.69;trim.position.y=.055;this.root.add(trim);
  const line=new THREE.Mesh(new THREE.TorusGeometry(2.92,.018,8,90),new THREE.MeshBasicMaterial({color:0x6ba782,transparent:true,opacity:.42}));line.rotation.x=Math.PI/2;line.scale.y=.7;line.position.y=.06;this.root.add(line);
 }
 textTexture(label,sub){
  const c=document.createElement("canvas");c.width=1024;c.height=500;const x=c.getContext("2d");x.clearRect(0,0,c.width,c.height);x.textAlign="center";x.fillStyle="#f6f0df";x.font="400 150px Bebas Neue";x.fillText(label,512,235);x.fillStyle="#a7b4ad";x.font="800 36px Inter";x.fillText(sub,512,355);const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;return t;
 }
 buildZones(){
  this.zones={};const make=(key,label,sub,x,color)=>{
   const material=new THREE.MeshStandardMaterial({map:this.textTexture(label,sub),color,transparent:true,opacity:.56,roughness:.85,emissive:new THREE.Color(color),emissiveIntensity:.05,depthWrite:false});
   const zone=new THREE.Mesh(new THREE.PlaneGeometry(2.4,1.45),material);zone.rotation.x=-Math.PI/2;zone.position.set(x,.085,1.05);this.root.add(zone);
   const frame=new THREE.Mesh(new THREE.TorusGeometry(.82,.025,8,64),new THREE.MeshBasicMaterial({color:0xf2cc69,transparent:true,opacity:.1}));frame.rotation.x=Math.PI/2;frame.scale.y=.58;frame.position.set(x,.09,1.05);this.root.add(frame);this.zones[key]={zone,frame,material};
  };make("false","FALSE","CALL THE BLUFF",-2,0x681919);make("true","TRUE","BANK IT",2,0x145530);
 }
 buildCard(){
  this.cardOuter=new THREE.Group();this.cardOuter.position.set(0,.22,-.55);this.cardOuter.rotation.x=-Math.PI/2;this.root.add(this.cardOuter);
  this.cardInner=new THREE.Group();this.cardOuter.add(this.cardInner);
  const side=this.mat(0xb8aa8e,.7,0),front=this.mat(0xffffff,.69,.01),back=front.clone();this.front=front;this.back=back;this.sideMats=[side,side.clone(),side.clone(),side.clone()];
  this.card=new THREE.Mesh(new THREE.BoxGeometry(3.45,2.45,.09),[...this.sideMats,front,back]);this.card.castShadow=this.card.receiveShadow=true;this.cardInner.add(this.card);
 }
 chip(color){
  const g=new THREE.Group(),body=new THREE.Mesh(new THREE.CylinderGeometry(.25,.25,.075,32),this.mat(color,.36,.2));body.castShadow=true;g.add(body);
  const ring=new THREE.Mesh(new THREE.TorusGeometry(.19,.022,8,28),this.mat(0xf7df92,.28,.6));ring.rotation.x=Math.PI/2;ring.position.y=.04;g.add(ring);return g;
 }
 buildChips(){
  const colors=[0xf0c75a,0xe8e2cf,0xc43b3b,0x202120,0x2e75a2];this.playerGroup=new THREE.Group();this.playerGroup.position.set(0,.05,2.7);this.root.add(this.playerGroup);
  for(let s=0;s<5;s++)for(let i=0;i<5;i++){const c=this.chip(colors[s%colors.length]);c.position.set((s-2)*.48,i*.083,0);c.rotation.y=(i+s)*.22;this.playerGroup.add(c);this.playerChips.push(c)}
  this.potGroup=new THREE.Group();this.potGroup.position.set(0,.08,1.95);this.root.add(this.potGroup);
  for(let i=0;i<18;i++){const c=this.chip(colors[i%colors.length]);c.visible=false;this.potGroup.add(c);this.potChips.push(c)}
 }
 buildHands(){
  const glove=this.mat(0x171918,.82),cuff=this.mat(0xf0eee6,.75),sleeve=this.mat(0x191b1a,.86);
  const make=side=>{const g=new THREE.Group(),sl=new THREE.Mesh(new THREE.BoxGeometry(.72,.2,1.55),sleeve),cu=new THREE.Mesh(new THREE.BoxGeometry(.76,.22,.32),cuff),p=new THREE.Mesh(new THREE.BoxGeometry(.68,.22,.74),glove);sl.position.z=-.7;cu.position.z=.05;p.position.z=.5;[sl,cu,p].forEach(m=>{m.castShadow=true;g.add(m)});for(let i=0;i<4;i++){const f=new THREE.Mesh(new THREE.CapsuleGeometry(.065,.38,5,8),glove);f.rotation.x=Math.PI/2;f.position.set((i-1.5)*.13,-.01,.93);f.castShadow=true;g.add(f)}g.position.set(side*1.25,.5,-4.1);g.rotation.y=side*-.08;this.root.add(g);return g};this.leftHand=make(-1);this.rightHand=make(1);
 }
 buildProps(){
  const button=new THREE.Mesh(new THREE.CylinderGeometry(.32,.32,.08,32),this.mat(0xd0a33d,.24,.82));button.position.set(-3,.11,-1.55);button.castShadow=true;this.root.add(button);
  const glass=new THREE.Mesh(new THREE.CylinderGeometry(.34,.28,.72,28),new THREE.MeshPhysicalMaterial({color:0xb87333,roughness:.08,transmission:.4,transparent:true,opacity:.68}));glass.position.set(3.15,.4,-1.65);glass.castShadow=true;this.root.add(glass);
 }
 wrap(ctx,text,max,maxLines){const words=text.split(/\s+/),lines=[];let line="";for(const word of words){const test=line?line+" "+word:word;if(ctx.measureText(test).width>max&&line){lines.push(line);line=word;if(lines.length===maxLines-1)break}else line=test}if(line&&lines.length<maxLines)lines.push(line);return lines}
 cardTexture(fact,back){
  const c=document.createElement("canvas");c.width=1400;c.height=980;const x=c.getContext("2d"),g=x.createLinearGradient(0,0,1400,980);g.addColorStop(0,"#fffdf6");g.addColorStop(1,"#e9dec4");x.fillStyle=g;x.fillRect(0,0,1400,980);x.strokeStyle="#b49348";x.lineWidth=18;x.strokeRect(32,32,1336,916);x.strokeStyle="rgba(28,35,31,.18)";x.lineWidth=3;x.strokeRect(58,58,1284,864);x.textAlign="center";
  if(!back){x.fillStyle="#6d765f";x.font="800 48px Inter";x.textAlign="left";x.fillText(fact.category.toUpperCase(),95,118);x.textAlign="right";x.fillText(["","COMMON","TRICKY","DEEP CUT"][fact.difficulty],1305,118);x.textAlign="center";x.fillStyle="#1c211e";x.font="900 94px Inter";const lines=this.wrap(x,fact.text,1120,6),lh=115,start=470-(lines.length-1)*lh/2;lines.forEach((l,i)=>x.fillText(l,700,start+i*lh));x.fillStyle="#788078";x.font="900 36px Inter";x.fillText("TRUE OR FALSE?",700,875)}
  else{x.fillStyle=fact.answer?"#126b3a":"#a72929";x.font="400 250px Bebas Neue";x.fillText(fact.answer?"TRUE":"FALSE",700,300);x.strokeStyle=x.fillStyle;x.lineWidth=12;x.strokeRect(380,88,640,260);x.fillStyle="#262d29";x.font="800 58px Inter";const lines=this.wrap(x,fact.explanation,1120,7);lines.forEach((l,i)=>x.fillText(l,700,520+i*76));x.fillStyle="#7d836f";x.font="900 32px Inter";x.fillText("THE HOUSE HAS SPOKEN",700,905)}
  const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=Math.min(8,this.renderer.capabilities.getMaxAnisotropy());return t;
 }
 async dealFact(fact){
  this.resetZones();this.cardInner.rotation.x=0;this.cardOuter.position.set(0,2.6,-4.8);this.cardOuter.rotation.set(-Math.PI/2,0,-.09);this.cardOuter.scale.setScalar(.8);
  if(this.front.map)this.front.map.dispose();if(this.back.map)this.back.map.dispose();this.front.map=this.cardTexture(fact,false);this.back.map=this.cardTexture(fact,true);this.front.needsUpdate=this.back.needsUpdate=true;
  await Promise.all([this.tween(720,p=>{const e=out(p);this.cardOuter.position.set(0,2.6*(1-e)+.22*e,-4.8*(1-e)-.55*e);this.cardOuter.scale.setScalar(.8+.2*e);this.cardOuter.rotation.z=-.09+.09*e}),this.tween(520,p=>{this.rightHand.position.z=-4.1+1.55*Math.sin(inout(p)*Math.PI)})]);this.rightHand.position.z=-4.1;
 }
 async setWager(percent){
  const count=Math.max(4,Math.round(this.potChips.length*percent));this.potChips.forEach((c,i)=>{c.visible=i<count;if(!c.visible)return;const stack=Math.floor(i/6),slot=i%6;c.position.set((slot-2.5)*.16,Math.floor(slot/3)*.082+stack*.075,(stack-1)*.18);c.rotation.y=i*.24;c.scale.setScalar(.001)});this.playerChips.forEach((c,i)=>c.visible=i>=count);
  await this.tween(330,p=>{const e=out(p);this.potChips.forEach(c=>{if(c.visible)c.scale.setScalar(Math.max(.001,e))})});if(percent===1){this.fx.allIn=1;await this.tween(260,p=>this.potGroup.rotation.y=Math.sin(p*Math.PI)*.09);this.potGroup.rotation.y=0}
 }
 async chooseAnswer(choice){
  this.resetZones();const z=this.zones[choice?"true":"false"];z.material.emissiveIntensity=.7;z.material.opacity=.92;z.frame.material.opacity=.8;const tx=choice?2:-2,sx=this.potGroup.position.x,sz=this.potGroup.position.z;
  await this.tween(520,p=>{const e=inout(p);this.potGroup.position.x=sx+(tx-sx)*e;this.potGroup.position.z=sz+(.95-sz)*e;this.potGroup.position.y=.08+Math.sin(p*Math.PI)*.55;this.potGroup.rotation.z=Math.sin(p*Math.PI)*(choice?-.13:.13)});this.potGroup.position.y=.08;this.potGroup.rotation.z=0;
 }
 resetZones(){Object.values(this.zones).forEach(z=>{z.material.emissiveIntensity=.05;z.material.opacity=.56;z.frame.material.opacity=.1})}
 countdownSprite(text){
  const c=document.createElement("canvas");c.width=c.height=512;const x=c.getContext("2d"),g=x.createRadialGradient(180,145,20,256,256,230);g.addColorStop(0,"#fff2b6");g.addColorStop(.42,"#d6a536");g.addColorStop(1,"#4a2d08");x.fillStyle=g;x.beginPath();x.arc(256,256,220,0,Math.PI*2);x.fill();x.strokeStyle="rgba(255,255,255,.7)";x.lineWidth=8;x.stroke();x.fillStyle="#1d1405";x.textAlign="center";x.textBaseline="middle";x.font=text==="REVEAL"?"400 112px Bebas Neue":"400 250px Bebas Neue";x.fillText(text,256,272);const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;const s=new THREE.Sprite(new THREE.SpriteMaterial({map:t,transparent:true,depthTest:false}));const size=text==="REVEAL"?3.3:2.2;s.scale.set(size,size,1);s.position.set(0,3.1,-.4);return s;
 }
 async dramaticCountdown(onBeat){
  const values=["3","2","1","REVEAL"];this.key.intensity=35;this.rim.intensity=3;for(const value of values){if(this.counter){this.scene.remove(this.counter);this.counter.material.map.dispose();this.counter.material.dispose()}this.counter=this.countdownSprite(value);this.scene.add(this.counter);onBeat?.(value);await this.tween(value==="REVEAL"?720:690,p=>{const e=out(p),base=value==="REVEAL"?3.3:2.2,size=base*(.5+.5*e);this.counter.scale.set(size,size,1);this.counter.material.opacity=p<.76?1:1-(p-.76)/.24;this.camera.position.z=8.9-1.15*e;this.camera.position.y=6.5-.45*e;this.cardOuter.position.y=.22+Math.sin(p*Math.PI)*.07})}if(this.counter){this.scene.remove(this.counter);this.counter.material.map.dispose();this.counter.material.dispose();this.counter=null}
 }
 async revealCard(correct){
  await Promise.all([this.tween(850,p=>{const e=inout(p);this.cardInner.rotation.x=Math.PI*e;this.cardOuter.position.y=.22+Math.sin(p*Math.PI)*.78}),this.tween(850,p=>{const e=inout(p);this.leftHand.position.z=-4.1+2.15*Math.sin(e*Math.PI);this.leftHand.position.x=-1.25+.42*Math.sin(e*Math.PI)})]);this.cardOuter.position.y=.22;this.leftHand.position.set(-1.25,.5,-4.1);this.fx[correct?"win":"lose"]=1;this.key.color.setHex(correct?0xffd66e:0xff4949);this.rim.color.setHex(correct?0x65d995:0x6d1313)
 }
 async resolveChips(correct){
  const s=this.potGroup.position.clone();if(correct)await this.tween(760,p=>{const e=out(p);this.potGroup.position.x=s.x*(1-e);this.potGroup.position.z=s.z+(2.7-s.z)*e;this.potGroup.position.y=.08+Math.sin(p*Math.PI)*.75;this.potGroup.rotation.y+=.05});else await this.tween(700,p=>{const e=inout(p);this.potGroup.position.x=s.x*(1-e);this.potGroup.position.z=s.z+(-4.8-s.z)*e;this.potGroup.position.y=.08+Math.sin(p*Math.PI)*.32;this.rightHand.position.z=-4.1+1.8*Math.sin(p*Math.PI)});this.potChips.forEach(c=>{c.visible=false;c.scale.setScalar(1)});this.playerChips.forEach(c=>c.visible=true);this.potGroup.position.set(0,.08,1.95);this.potGroup.rotation.set(0,0,0);this.rightHand.position.z=-4.1;
 }
 async resetRound(){this.resetZones();this.key.color.setHex(0xffd77e);this.rim.color.setHex(0x4e9f7a);this.key.intensity=55;this.rim.intensity=11;this.camera.position.set(0,6.5,8.9);this.cardInner.rotation.x=0;this.potGroup.position.set(0,.08,1.95)}
 setSkin(skin){const s={"":{front:0xffffff,side:0xb8aa8e},blueprint:{front:0x4c79b5,side:0x173d6b},gold:{front:0x8a6422,side:0x3c2609},cyber:{front:0x1d3750,side:0x08151f}}[skin]||{front:0xffffff,side:0xb8aa8e};this.front.color.setHex(s.front);this.back.color.setHex(s.front);this.sideMats.forEach(m=>m.color.setHex(s.side))}
 tween(duration,update){return new Promise(resolve=>this.tweens.push({start:performance.now(),duration,update,resolve}))}
 updateTweens(now){this.tweens=this.tweens.filter(t=>{const p=Math.min(1,(now-t.start)/t.duration);t.update(p);if(p>=1){t.resolve();return false}return true})}
 resize(){const r=this.canvas.getBoundingClientRect();if(r.width<2||r.height<2)return;this.renderer.setSize(r.width,r.height,false);this.camera.aspect=r.width/r.height;this.camera.updateProjectionMatrix()}
 animate=()=>{requestAnimationFrame(this.animate);const now=performance.now(),t=this.clock.getElapsedTime();this.updateTweens(now);this.root.rotation.z=Math.sin(t*.32)*.005;this.fx.win*=.95;this.fx.lose*=.92;this.fx.allIn*=.96;if(!this.tweens.length){this.camera.position.x=Math.sin(t*.26)*.045;this.camera.position.y=6.5+Math.sin(t*.4)*.025;this.camera.position.z=8.9-this.fx.allIn*.35}if(this.fx.lose>.02){this.camera.position.x+=Math.sin(t*72)*this.fx.lose*.08;this.camera.position.y+=Math.cos(t*64)*this.fx.lose*.04}this.key.intensity=55+this.fx.win*32-this.fx.lose*12;this.renderer.render(this.scene,this.camera)}
}
window.HighStakesTable=HighStakesTable;
})();
