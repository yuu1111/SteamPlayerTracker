import { execSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const packageJsonPath = join(import.meta.dirname, "..", "package.json");

function runCommand(command: string, description: string) {
	console.log(`\n${description}...`);
	try {
		execSync(command, { stdio: "inherit", timeout: 60000 });
		console.log(`${description} completed`);
	} catch (error) {
		console.error(
			`${description} failed:`,
			error instanceof Error ? error.message : String(error),
		);
		process.exit(1);
	}
}

function updateVersion(type = "patch"): string {
	console.log(`\nUpdating version (${type})...`);

	const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8"));
	const currentVersion: string = packageJson.version;
	const versionParts = currentVersion.split(".").map(Number);

	switch (type) {
		case "major":
			versionParts[0]++;
			versionParts[1] = 0;
			versionParts[2] = 0;
			break;
		case "minor":
			versionParts[1]++;
			versionParts[2] = 0;
			break;
		default:
			versionParts[2]++;
			break;
	}

	const newVersion = versionParts.join(".");
	packageJson.version = newVersion;

	writeFileSync(
		packageJsonPath,
		`${JSON.stringify(packageJson, null, "\t")}\n`,
	);

	console.log(`Version updated: ${currentVersion} -> ${newVersion}`);
	return newVersion;
}

function main() {
	const args = process.argv.slice(2);
	const versionType = args[0] || "patch";
	const skipTests = args.includes("--skip-tests");

	console.log("Starting release process...");

	try {
		const gitStatus = execSync("git status --porcelain", {
			encoding: "utf8",
		});
		if (gitStatus.trim()) {
			console.warn("Uncommitted changes detected:");
			console.log(gitStatus);
			console.log("Please commit your changes before running the release.");
			process.exit(1);
		}
	} catch (error) {
		console.error(
			"Git status check failed:",
			error instanceof Error ? error.message : String(error),
		);
		process.exit(1);
	}

	runCommand("bun install", "Installing dependencies");
	runCommand("bun run typecheck", "TypeScript type check");

	if (!skipTests) {
		try {
			runCommand("bun run lint", "Biome check");
		} catch (_error) {
			console.log("Biome reported issues, continuing...");
		}
	}

	runCommand("bun run clean", "Cleaning dist directory");
	runCommand("bun run build", "Building");

	const newVersion = updateVersion(versionType);

	runCommand("git add .", "Git staging");
	runCommand(
		`git commit -m "chore(release): v${newVersion}"`,
		"Creating release commit",
	);
	runCommand(
		`git tag -a v${newVersion} -m "Release v${newVersion}"`,
		"Creating git tag",
	);

	console.log("\nRelease preparation complete!");
	console.log(`New version: v${newVersion}`);
	console.log("\nNext steps:");
	console.log("  1. git push origin main");
	console.log(`  2. git push origin v${newVersion}`);
	console.log("  3. Create release notes on GitHub Releases");
}

main();
