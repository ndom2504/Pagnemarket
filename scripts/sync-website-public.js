/**
 * Copy Next.js static export (website/out) into repo-root /public
 * so Vercel serves the marketing site alongside the Python /api function.
 */
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const src = path.join(root, "website", "out");
const dest = path.join(root, "public");

function rimraf(dir) {
  if (!fs.existsSync(dir)) return;
  fs.rmSync(dir, { recursive: true, force: true });
}

function copyDir(from, to) {
  fs.mkdirSync(to, { recursive: true });
  for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
    const sp = path.join(from, entry.name);
    const dp = path.join(to, entry.name);
    if (entry.isDirectory()) copyDir(sp, dp);
    else fs.copyFileSync(sp, dp);
  }
}

if (!fs.existsSync(src)) {
  console.error("Missing website/out — run npm run build --prefix website first");
  process.exit(1);
}

rimraf(dest);
copyDir(src, dest);
console.log(`Synced ${src} -> ${dest}`);
