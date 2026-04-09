import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { BareMuxConnection } from "@mercuryworkshop/bare-mux";
import Boot from "./Boot.tsx";
import CustomOS from "./CustomOS.tsx";
import { hash } from "./hash.json";
import Loader from "./Loading.tsx";
import Login from "./Login.tsx";
import Recovery from "./Recovery.tsx";
import Setup from "./Setup.tsx";
import { fileExists, dirExists } from "./sys/types.ts";
import { copyfs } from "./init/fs.init.ts";
import Updater from "./Updater.tsx";

const Root = () => {
	const [currPag, setPag] = useState(<Loader />);
	const params = new URLSearchParams(window.location.search);
	useEffect(() => {
		const tempTransport = async () => {
			const connection = new BareMuxConnection("/baremux/worker.js");
			await connection.setTransport("/epoxy/index.mjs", [{ wisp: `${location.protocol.replace("http", "ws")}//${location.hostname}:${location.port}/wisp/` }]);
			const tbOn = async () => {
				while (!window.tb.system?.version) {
					await new Promise(res => setTimeout(res, 50));
				}
				window.dispatchEvent(new Event("tfsready"));
			};
			tbOn();
			const { ScramjetController } = $scramjetLoadController();
			window.scramjetTb = {
				prefix: "/service/",
				files: {
					wasm: "/scram/scramjet.wasm.wasm",
					all: "/scram/scramjet.all.js",
					sync: "/scram/scramjet.sync.js",
				},
				defaultFlags: {
					rewriterLogs: false,
				},
				codec: {
					encode: function encode(input: string): string {
						let result = "";
						let len = input.length;
						for (let i = 0; i < len; i++) {
							const char = input[i];
							result += i % 2 ? String.fromCharCode(char.charCodeAt(0) ^ 2) : char;
						}
						return encodeURIComponent(result);
					},
					decode: function decode(input: string): string {
						if (!input) return input;
						input = decodeURIComponent(input);
						let result = "";
						let len = input.length;
						for (let i = 0; i < len; i++) {
							const char = input[i];
							result += i % 2 ? String.fromCharCode(char.charCodeAt(0) ^ 2) : char;
						}
						return result;
					},
				},
			};
			window.scramjet = new ScramjetController(scramjetTb);
			scramjet.init();
			navigator.serviceWorker.register("/anura-sw.js");
		};
		tempTransport();
		if (sessionStorage.getItem("recovery")) {
			setPag(<Recovery />);
		} else if (sessionStorage.getItem("boot") || params.get("boot")) {
			const upd = async () => {
				let sha;
				if (await fileExists("/system/etc/terbium/hash.cache")) {
					sha = await window.tb.fs.promises.readFile("/system/etc/terbium/hash.cache", "utf8");
				} else {
					sha = hash;
				}
				if (localStorage.getItem("setup")) {
					// Guard: if hash is null/empty (e.g. git failed on CI), never trigger
					// the updater — doing so causes an infinite reload loop because null
					// can never be written to hash.cache and read back as equal to null.
					const hashValid = hash !== null && hash !== undefined && hash !== "null" && hash !== "";
					if (hashValid && (sha !== hash || sessionStorage.getItem("migrateFs"))) {
						setPag(<Updater />);
					} else {
						// Health check: if setup is marked done but /apps/system/ is empty,
						// the initial file copy failed (e.g. school network blocked fetches).
						// Re-run copyfs silently before going to Login so apps actually work.
						const appsHealthy = await fileExists("/apps/system/settings.tapp/index.html")
							|| await fileExists("/apps/system/files.tapp/index.html")
							|| await dirExists("/apps/system/terminal.tapp");
						if (!appsHealthy) {
							console.warn("App files missing from OPFS, re-running copyfs...");
							if (!(await dirExists("/apps/system"))) {
								await window.tb.fs.promises.mkdir("/apps");
								await window.tb.fs.promises.mkdir("/apps/system");
							}
							await copyfs();
						}
						if (sessionStorage.getItem("logged-in") && sessionStorage.getItem("logged-in") === "true") {
							setPag(<App />);
						} else {
							setPag(<Login />);
						}
					}
				} else {
					// localStorage was wiped (e.g. school accounts with session-only
					// cookie policy). Check if OPFS already has system files — if so,
					// the user already completed setup, just restore the flag silently.
					const alreadyInstalled = await fileExists("/system/etc/terbium/settings.json");
					if (alreadyInstalled) {
						localStorage.setItem("setup", "true");
						if (sessionStorage.getItem("logged-in") === "true") {
							setPag(<App />);
						} else {
							setPag(<Login />);
						}
					} else {
						setPag(<Setup />);
					}
				}
			};
			upd();
		} else if (sessionStorage.getItem("cusboot")) {
			setPag(<CustomOS />);
		} else {
			setPag(<Boot />);
		}
	}, []);
	return currPag;
};

createRoot(document.getElementById("root")!).render(
	<StrictMode>
		<Root />
	</StrictMode>,
);
