// Chrome (headless) で index.html を30fpsの連番PNGにする。追加パッケージ不要（Node 22+）。
import {spawn} from "node:child_process";
import {mkdirSync, writeFileSync} from "node:fs";
import {fileURLToPath} from "node:url";
import path from "node:path";
const dir = path.dirname(fileURLToPath(import.meta.url));
const out = process.argv[2] || path.join(dir, "frames_tmp");
const FPS = 30, SECONDS = 28, only = process.argv[3] ? process.argv[3].split(",").map(Number) : null;
mkdirSync(out, {recursive:true});
const chrome = spawn("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  ["--headless=new","--remote-debugging-port=9333","--hide-scrollbars","--force-device-scale-factor=1",
   "--user-data-dir="+path.join(out,"..",".chrome-profile"),"--no-first-run","about:blank"],{stdio:"ignore"});
const sleep = ms => new Promise(r=>setTimeout(r,ms));
let targets;
for (let i=0;i<50;i++){ try{ targets = await (await fetch("http://127.0.0.1:9333/json")).json(); if(targets.find(t=>t.type==="page")) break; }catch{} await sleep(200); }
const ws = new WebSocket(targets.find(t=>t.type==="page").webSocketDebuggerUrl);
await new Promise(r=>ws.onopen=r);
let id=0; const pend=new Map();
ws.onmessage = e => { const m=JSON.parse(e.data); if(m.id&&pend.has(m.id)){pend.get(m.id)(m); pend.delete(m.id);} };
const send=(method,params={})=>new Promise(r=>{const i=++id;pend.set(i,r);ws.send(JSON.stringify({id:i,method,params}));});
await send("Emulation.setDeviceMetricsOverride",{width:1280,height:720,deviceScaleFactor:1,mobile:false});
await send("Page.enable");
await send("Page.navigate",{url:"file://"+path.join(dir,"index.html")});
await sleep(1500);
await send("Runtime.evaluate",{expression:"document.fonts.ready.then(()=>document.fonts.size)",awaitPromise:true});
const frames = only ?? Array.from({length:FPS*SECONDS},(_, i)=>i);
for (const i of frames){
  await send("Runtime.evaluate",{expression:`setTime(${i/FPS})`});
  const r = await send("Page.captureScreenshot",{format:"png"});
  writeFileSync(path.join(out,`f_${String(i).padStart(4,"0")}.png`), Buffer.from(r.result.data,"base64"));
}
ws.close(); chrome.kill();
console.log("frames:", frames.length);
