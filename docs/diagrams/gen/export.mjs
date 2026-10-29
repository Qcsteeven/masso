// usage: node export.mjs out_dir file1.drawio [file2 ...]  -> out_dir/<name>.png (2x, white background)
// needs viewer-static.min.js of draw.io next to this file (not in git): see docs/diagrams/gen/README.md
import { chromium } from "../../../frontend/node_modules/@playwright/test/index.mjs";
import fs from "node:fs"; import path from "node:path";
const [outDir, ...files] = process.argv.slice(2);
const viewer = fs.readFileSync(new URL("./viewer-static.min.js", import.meta.url), "utf8");
const browser = await chromium.launch();
const page = await browser.newPage({ deviceScaleFactor: 2, viewport: { width: 2400, height: 2000 } });
for (const f of files) {
  const xml = fs.readFileSync(f, "utf8");
  await page.setContent(`<html><body style="margin:0;background:#fff"><div id="d"></div></body></html>`);
  await page.addScriptTag({ content: viewer });
  await page.evaluate((xml) => {
    const d = document.getElementById("d");
    d.className = "mxgraph";
    d.setAttribute("data-mxgraph", JSON.stringify({ xml, toolbar: "", lightbox: false, nav: false, resize: true, border: 16 }));
    // eslint-disable-next-line no-undef
    GraphViewer.processElements();
  }, xml);
  await page.waitForSelector("#d svg", { timeout: 20000 });
  await page.waitForTimeout(400);
  const el = await page.$("#d svg");
  const name = path.basename(f).replace(/\.drawio$/, ".png");
  await el.screenshot({ path: path.join(outDir, name), omitBackground: false });
  console.log("ok", name);
}
await browser.close();
