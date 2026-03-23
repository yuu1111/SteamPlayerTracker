import { Glob } from "bun";

const entrypoints = ["src/main.ts", ...new Glob("src/jobs/*.ts").scanSync(".")];

const result = await Bun.build({
	entrypoints,
	outdir: "dist",
	root: "src",
	target: "node",
	format: "esm",
	splitting: true,
});

if (!result.success) {
	for (const log of result.logs) {
		console.error(log);
	}
	process.exit(1);
}
