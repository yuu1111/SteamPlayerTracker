const result = await Bun.build({
	entrypoints: ["src/main.ts"],
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
