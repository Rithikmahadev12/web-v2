import paths from "../installer.json";
import { unzip } from "../sys/types";

async function fetchWithRetry(url: string, retries = 3, delay = 800): Promise<Response> {
	for (let i = 0; i < retries; i++) {
		try {
			const res = await fetch(url);
			if (res.ok) return res;
			console.warn(`Fetch attempt ${i + 1} failed for ${url}: ${res.status} ${res.statusText}`);
		} catch (err) {
			console.warn(`Fetch attempt ${i + 1} threw for ${url}:`, err);
		}
		if (i < retries - 1) await new Promise(r => setTimeout(r, delay));
	}
	throw new Error(`Failed to fetch ${url} after ${retries} attempts`);
}

export async function copyfs() {
	for (const item of paths) {
		const p = item.toString();
		if (p.includes("browser.tapp")) continue;
		window.dispatchEvent(new CustomEvent("oobe-setupstage", { detail: `Copying ${p} to File System...` }));
		try {
			if (p.toLowerCase().includes(".tapp.zip")) {
				const res = await fetchWithRetry(`/apps/${p}`);
				const data = await res.arrayBuffer();
				await window.tb.fs.promises.writeFile(`/apps/system/${p}`, window.tb.buffer.from(data));
				await unzip(`/apps/system/${p}`, `/apps/system/${p.slice(0, -4)}`);
				await window.tb.fs.promises.unlink(`/apps/system/${p}`);
				continue;
			}
			if (p.endsWith("/")) {
				await window.tb.fs.promises.mkdir(`/apps/system/${p}`);
			} else {
				const res = await fetchWithRetry(`/apps/${p}`);
				const data = await res.text();
				await window.tb.fs.promises.writeFile(`/apps/system/${p}`, data);
			}
		} catch (err) {
			console.error(`Skipping ${p} after all retries failed:`, err);
		}
	}
	return "Success";
}
