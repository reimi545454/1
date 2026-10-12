// 使い方: node render_video.js <playwrightのパス> [--preview]
const { chromium } = require(process.argv[2]);
const { spawn } = require("child_process");
const path = require("path");
const FPS = 30, N = 900;
const out = path.join(__dirname, "..", "output", "POST_astra_quote_1920x1080_30s_silent.mp4");
(async () => {
  const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
  const pg = await b.newPage({ viewport: { width: 1920, height: 1080 } });
  await pg.goto("file://" + path.join(__dirname, "video.html"));
  await pg.evaluate(() => document.fonts.ready);
  if (process.argv[3] === "--preview") {
    for (const t of [3.0, 7.5, 10.5, 14.5, 18.0, 21.0, 23.8, 26.5, 29.0]) {
      await pg.evaluate((t) => renderVideo(t), t);
      await pg.screenshot({ path: path.join(__dirname, "..", "output", "previews", `astra_${t.toFixed(1)}.png`) });
    }
    return b.close();
  }
  const ff = spawn("ffmpeg", ["-y", "-loglevel", "error", "-f", "image2pipe", "-framerate", String(FPS), "-i", "-",
    "-c:v", "libx264", "-preset", "slow", "-crf", "18", "-pix_fmt", "yuv420p", "-r", String(FPS),
    "-frames:v", String(N), "-movflags", "+faststart", out], { stdio: ["pipe", "inherit", "inherit"] });
  for (let i = 0; i < N; i++) {
    await pg.evaluate((t) => renderVideo(t), i / FPS);
    ff.stdin.write(await pg.screenshot({ type: "png" }));
  }
  ff.stdin.end();
  await new Promise((r) => ff.on("close", r));
  await b.close();
  console.log(out);
})();
