// R5-PL-17: repeat phone loads (4x CPU, Slow 4G, cold cache) and count React #418 hydration errors.
//   U=/ar/admin/orders PH=+201000000001 N=10 node docs/audit/tools/hydration-repeat.mjs
import { chromium } from "playwright";
import fs from "node:fs";
const B="http://localhost:3000"; const U=process.env.U||"/ar/vendor/jobs"; const PH=process.env.PH||"+201000000010";
const b=await chromium.launch();
const pre=await b.newContext(); const j=await (await pre.request.post(B+"/api/auth/request-otp",{data:{phone:PH}})).json(); await pre.request.post(B+"/api/auth/verify-otp",{data:{phone:PH,code:j.devCode,locale:"en",acceptTerms:true}}); const st=await pre.storageState(); await pre.close();
let hits=0;
for (let run=0; run<(+process.env.N||12); run++) {
  const ctx=await b.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true,locale:U.startsWith("/ar")?"ar-EG":"en-US",storageState:st});
  const p=await ctx.newPage(); const cdp=await ctx.newCDPSession(p); await cdp.send("Network.enable"); await cdp.send("Network.setCacheDisabled",{cacheDisabled:true}); await cdp.send("Emulation.setCPUThrottlingRate",{rate:4}); await cdp.send("Network.emulateNetworkConditions",{offline:false,latency:562.5,downloadThroughput:(1.6*0.9*1024*1024)/8,uploadThroughput:(750*0.9*1024)/8});
  const errs=[]; const stacks=[]; p.on("pageerror",e=>errs.push(String(e).slice(0,120))); p.on("console",m=>{ if(/elba-hyd/.test(m.text())) stacks.push(m.text()); });
  let ssr=""; p.on("response", async r=>{ if (r.request().resourceType()==="document") ssr=await r.text().catch(()=>""); });
  await p.goto(B+U,{waitUntil:"load",timeout:90000}); await p.waitForTimeout(5000);
  if (errs.some(e=>/418/.test(e))) { hits++; const client=await p.content(); fs.writeFileSync(`${process.env.SAVE_DIR || "/tmp"}/hyd-ssr-${run}.html`, ssr); fs.writeFileSync(`${process.env.SAVE_DIR || "/tmp"}/hyd-client-${run}.html`, client); console.log("run",run,"#418", stacks.join("\n----\n").slice(0,2500)); } else console.log("run",run,"clean", errs.join("|"));
  await ctx.close();
}
console.log("hits",hits); await b.close();
