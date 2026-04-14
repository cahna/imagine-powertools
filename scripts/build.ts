import * as esbuild from "esbuild";
import {
  cpSync,
  mkdirSync,
  rmSync,
  existsSync,
  watch,
  readFileSync,
  writeFileSync,
} from "fs";
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

  // Copy shared CSS (variables for theming)
  mkdirSync(join(distDir, "shared"), { recursive: true });
  cpSync(
    join(srcDir, "shared/variables.css"),
    join(distDir, "shared/variables.css"),
  );

  // Copy icons if they exist
  const iconsDir = join(srcDir, "icons");
  if (existsSync(iconsDir)) {
    cpSync(iconsDir, join(distDir, "icons"), { recursive: true });
  }

  console.log("Static files copied");
}

// Generate intercept source files and build pageScript.js
async function generateInterceptSources() {
  const interceptDir = join(srcDir, "intercept");
  const interceptDistDir = join(distDir, "intercept");

  // Ensure intercept dist directory exists
  mkdirSync(interceptDistDir, { recursive: true });

  // Build pageScript.ts to dist/intercept/pageScript.js (for web_accessible_resources)
  await esbuild.build({
    entryPoints: [join(interceptDir, "pageScript.ts")],
    bundle: true,
    minify: !isWatch,
    format: "iife",
    target: "chrome120",
    outfile: join(interceptDistDir, "pageScript.js"),
  });

  // Read modal.css and generate modalCssSource.ts
  const modalCssContent = readFileSync(
    join(interceptDir, "modal.css"),
    "utf-8",
  );
  const modalCssSourceContent = `/**
 * Auto-generated file containing the modal CSS source.
 * DO NOT EDIT - regenerate with: npm run build
 */

export const modalCssSource = ${JSON.stringify(modalCssContent)};
`;
  writeFileSync(join(interceptDir, "modalCssSource.ts"), modalCssSourceContent);

  console.log("Intercept sources generated");
}

// Build tiptap page script
async function buildTiptapPageScript() {
  const tiptapDir = join(srcDir, "tiptap");
  const tiptapDistDir = join(distDir, "tiptap");

  // Ensure tiptap dist directory exists
  mkdirSync(tiptapDistDir, { recursive: true });

  // Build pageScript.ts to dist/tiptap/pageScript.js (for web_accessible_resources)
  await esbuild.build({
    entryPoints: [join(tiptapDir, "pageScript.ts")],
    bundle: true,
    minify: !isWatch,
    format: "iife",
    target: "chrome120",
    outfile: join(tiptapDistDir, "pageScript.js"),
  });

  console.log("Tiptap page script built");
}

// Build TypeScript files
async function build() {
  copyStaticFiles();

  // Generate intercept sources and tiptap page script before building content script
  await generateInterceptSources();
  await buildTiptapPageScript();

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

  // Generate intercept sources and tiptap page script initially
  await generateInterceptSources();
  await buildTiptapPageScript();

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
    join(srcDir, "shared/variables.css"),
  ];

  for (const file of staticFiles) {
    watch(file, () => {
      copyStaticFiles();
      console.log(
        `Static file changed, copied at ${new Date().toLocaleTimeString()}`,
      );
    });
  }

  // Watch intercept source files and regenerate when changed
  const interceptSourceFiles = [
    join(srcDir, "intercept/pageScript.ts"),
    join(srcDir, "intercept/modal.css"),
  ];

  for (const file of interceptSourceFiles) {
    watch(file, async () => {
      await generateInterceptSources();
      console.log(
        `Intercept sources regenerated at ${new Date().toLocaleTimeString()}`,
      );
    });
  }

  // Watch tiptap page script and rebuild when changed
  const tiptapPageScript = join(srcDir, "tiptap/pageScript.ts");
  if (existsSync(tiptapPageScript)) {
    watch(tiptapPageScript, async () => {
      await buildTiptapPageScript();
      console.log(
        `Tiptap page script rebuilt at ${new Date().toLocaleTimeString()}`,
      );
    });
  }
} else {
  await build();
}
