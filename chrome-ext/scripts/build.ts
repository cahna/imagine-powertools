import * as esbuild from "esbuild";
import { cpSync, mkdirSync, rmSync, existsSync, watch } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, "..");
const srcDir = join(rootDir, "src");
const distDir = join(rootDir, "dist");

const isWatch = process.argv.includes("watch");

// Clean dist directory only on production builds (not watch mode)
// In watch mode, we keep the directory to avoid breaking Chrome's file handles
if (!isWatch && existsSync(distDir)) {
  rmSync(distDir, { recursive: true });
}
mkdirSync(distDir, { recursive: true });

// Copy static files
function copyStaticFiles() {
  // Copy manifest.json
  cpSync(join(srcDir, "manifest.json"), join(distDir, "manifest.json"));

  // Copy popup HTML and CSS
  mkdirSync(join(distDir, "popup"), { recursive: true });
  cpSync(join(srcDir, "popup/popup.html"), join(distDir, "popup/popup.html"));
  cpSync(join(srcDir, "popup/popup.css"), join(distDir, "popup/popup.css"));

  // Copy data page HTML and CSS
  mkdirSync(join(distDir, "data"), { recursive: true });
  cpSync(join(srcDir, "data/data.html"), join(distDir, "data/data.html"));
  cpSync(join(srcDir, "data/data.css"), join(distDir, "data/data.css"));

  // Copy icons if they exist
  const iconsDir = join(srcDir, "icons");
  if (existsSync(iconsDir)) {
    cpSync(iconsDir, join(distDir, "icons"), { recursive: true });
  }

  console.log("Static files copied");
}

// Build TypeScript files
async function build() {
  copyStaticFiles();

  const commonOptions: esbuild.BuildOptions = {
    bundle: true,
    minify: !isWatch,
    sourcemap: isWatch ? "inline" : false,
    target: "chrome120",
    format: "iife",
  };

  // Build background service worker
  await esbuild.build({
    ...commonOptions,
    entryPoints: [join(srcDir, "background.ts")],
    outfile: join(distDir, "background.js"),
  });

  // Build content script
  await esbuild.build({
    ...commonOptions,
    entryPoints: [join(srcDir, "content.ts")],
    outfile: join(distDir, "content.js"),
    format: "iife", // Content scripts need IIFE format
  });

  // Build popup script
  await esbuild.build({
    ...commonOptions,
    entryPoints: [join(srcDir, "popup/popup.ts")],
    outfile: join(distDir, "popup/popup.js"),
    format: "iife", // Popup scripts need IIFE format
  });

  // Build data page script
  await esbuild.build({
    ...commonOptions,
    entryPoints: [join(srcDir, "data/data.ts")],
    outfile: join(distDir, "data/data.js"),
    format: "iife",
  });

  console.log("Build complete");
}

// Watch mode
if (isWatch) {
  console.log("Watching for changes...");

  const rebuildPlugin: esbuild.Plugin = {
    name: "rebuild-notify",
    setup(build) {
      build.onEnd(() => {
        copyStaticFiles();
        console.log(`Rebuilt at ${new Date().toLocaleTimeString()}`);
      });
    },
  };

  // Background service worker (watch)
  const bgCtx = await esbuild.context({
    bundle: true,
    sourcemap: "inline",
    target: "chrome120",
    format: "iife",
    entryPoints: [join(srcDir, "background.ts")],
    outfile: join(distDir, "background.js"),
    plugins: [rebuildPlugin],
  });

  // Content script (watch)
  const contentCtx = await esbuild.context({
    bundle: true,
    sourcemap: "inline",
    target: "chrome120",
    format: "iife",
    entryPoints: [join(srcDir, "content.ts")],
    outfile: join(distDir, "content.js"),
  });

  // Popup script (watch)
  const popupCtx = await esbuild.context({
    bundle: true,
    sourcemap: "inline",
    target: "chrome120",
    format: "iife",
    entryPoints: [join(srcDir, "popup/popup.ts")],
    outfile: join(distDir, "popup/popup.js"),
  });

  // Data page script (watch)
  const dataCtx = await esbuild.context({
    bundle: true,
    sourcemap: "inline",
    target: "chrome120",
    format: "iife",
    entryPoints: [join(srcDir, "data/data.ts")],
    outfile: join(distDir, "data/data.js"),
  });

  await Promise.all([
    bgCtx.watch(),
    contentCtx.watch(),
    popupCtx.watch(),
    dataCtx.watch(),
  ]);

  // Watch static files (CSS, HTML, manifest)
  const staticFiles = [
    join(srcDir, "manifest.json"),
    join(srcDir, "popup/popup.html"),
    join(srcDir, "popup/popup.css"),
    join(srcDir, "data/data.html"),
    join(srcDir, "data/data.css"),
  ];

  for (const file of staticFiles) {
    watch(file, () => {
      copyStaticFiles();
      console.log(
        `Static file changed, copied at ${new Date().toLocaleTimeString()}`,
      );
    });
  }
} else {
  await build();
}
