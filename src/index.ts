import { SteamPlayerTracker } from "./steamPlayerTracker";

function setWindowTitle(title: string) {
	if (process.platform === "win32") {
		process.title = title;
	}
}

async function main() {
	try {
		setWindowTitle("Steam Player Tracker - Starting...");

		const tracker = new SteamPlayerTracker();

		setWindowTitle("Steam Player Tracker - Running");

		await tracker.start();
	} catch (error) {
		setWindowTitle("Steam Player Tracker - Error");
		console.error(
			"Fatal error:",
			error instanceof Error ? error.message : String(error),
		);
		process.exit(1);
	}
}

main();
