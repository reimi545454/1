// 使い方: node render_demo.js <playwrightのパス> [--preview]
const { chromium } = require(process.argv[2]);
const { spawn } = require("child_process");
const path = require("path");
const FPS = 30, DUR = 17, N = FPS * DUR;
const out = path.join(__dirname, "..", "output", "ART-015_demo_report_to_cards_1920x1080_17s_silent.mp4");
(async () => {
  const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
  const pg = await b.newPage({ viewport: { width: 1920, height: 1080 } });
  await pg.goto("file://" + path.join(__dirname, "demo.html"));
  await pg.evaluate(() => document.fonts.ready);
  if (process.argv[3] === "--preview") {
    for (const t of [1.5, 4.5, 6.6, 8.5, 11.4, 15.8]) {
      await pg.evaluate((t) => render(t), t);
      await pg.screenshot({ path: path.join(__dirname, "..", "output", "previews", `demo_${t}.png`) });
    }
    return b.close();
  }
  const ff = spawn("ffmpeg", ["-y", "-loglevel", "error", "-f", "image2pipe", "-framerate", String(FPS), "-i", "-",
    "-c:v", "libx264", "-preset", "slow", "-crf", "18", "-pix_fmt", "yuv420p", "-r", String(FPS),
    "-frames:v", String(N), "-movflags", "+faststart", out], { stdio: ["pipe", "inherit", "inherit"] });
  for (let i = 0; i < N; i++) {
    await pg.evaluate((t) => render(t), i / FPS);
    ff.stdin.write(await pg.screenshot({ type: "png" }));
  }
  ff.stdin.end();
  await new Promise((r) => ff.on("close", r));
  await b.close();
  console.log(out);
})();
