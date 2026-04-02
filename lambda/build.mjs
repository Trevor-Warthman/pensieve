import * as esbuild from "esbuild";
import { execSync } from "child_process";
import { mkdirSync } from "fs";

const handlers = ["auth", "lexicons", "sync", "invalidate"];
const outDir = "../infra/lambda-src";

mkdirSync(outDir, { recursive: true });

for (const handler of handlers) {
  await esbuild.build({
    entryPoints: [`src/${handler}.ts`],
    bundle: true,
    platform: "node",
    target: "node20",
    outfile: `${outDir}/${handler}.js`,
    external: [], // bundle everything — Lambda runtime has no SDK v3
    minify: false,
  });

  execSync(`cd ${outDir} && zip -q ${handler}.zip ${handler}.js`, { stdio: "inherit" });
  console.log(`✓ ${handler}`);
}
