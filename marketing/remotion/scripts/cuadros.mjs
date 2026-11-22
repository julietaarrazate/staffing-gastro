// node scripts/cuadros.mjs <id> <c1,c2,...> → out/cuadros/<id>-hoja.png: una hoja con esos cuadros, a media escala.
import { bundle } from "@remotion/bundler";
import { renderStill, selectComposition } from "@remotion/renderer";
import { execFileSync } from "node:child_process";
import path from "node:path";
const [comp, lista] = process.argv.slice(2);
import { existsSync, mkdirSync } from "node:fs";
const exe = [process.env.REMOTION_CHROME, "/opt/pw-browsers/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell"].find((c) => c && existsSync(c));
const OUT = path.resolve("out/cuadros"); mkdirSync(OUT, { recursive: true });
const serveUrl = await bundle({ entryPoint: path.resolve("src/index.ts") });
const c = await selectComposition({ serveUrl, id: comp, browserExecutable: exe });
const frames = lista.split(",").map(Number);
const outs = [];
for (const f of frames) {
  const o = `${OUT}/${comp}-${f}.png`;
  await renderStill({ composition: c, serveUrl, output: o, frame: f, browserExecutable: exe, scale: 0.5 });
  outs.push(o);
}
execFileSync("python3", ["-c", `
import sys
from PIL import Image, ImageDraw
fs=sys.argv[2:]; ims=[Image.open(f).convert('RGB') for f in fs]
w,h=ims[0].size; n=len(ims); cols=min(n,6); rows=(n+cols-1)//cols
W=Image.new('RGB',(cols*w,rows*h),'white')
for i,im in enumerate(ims):
  d=ImageDraw.Draw(im); d.text((8,8),fs[i].split('-')[-1].split('.')[0],fill=(255,0,0))
  W.paste(im,((i%cols)*w,(i//cols)*h))
W.save(sys.argv[1])`, `${OUT}/${comp}-hoja.png`, ...outs]);
console.log("ok", outs.length);
