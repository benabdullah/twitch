import fetch from "node-fetch";
import { spawn } from "child_process";
import "missing-native-js-functions";
import SPA from "socks-proxy-agent";
import HttpsProxyAgent from "https-proxy-agent";
import fs from "fs/promises";
import path from "path";
import FormData from "form-data";
import kill from "tree-kill";
import readline from "readline";
import randomUserAgent from "random-useragent";

const proxyType = 'list'; //tor
const __dirname = path.resolve(path.dirname(""));
var torpath = "tor";
if (process.platform == "win32") {
	torpath = path.join(__dirname, "tor", "tor.exe");
} else if (process.platform == "darwin") {
	torpath = path.join(__dirname, "tor", "tor-mac");
} else if (process.platform == "linux") {
	console.log("------------\n[Notice] Please install tor:\napt install tor\n------------\n");
	torpath = "tor";
} else {
	console.error("warning unsupported platform");
}

const timeout = 3000;
const rl = readline.createInterface({
	input: process.stdin,
	output: process.stdout,
});
const __dirname = path.resolve();
const { SocksProxyAgent } = SPA;
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

process.on("unhandledRejection", console.error);
process.on("uncaughtException", console.error);

function getRandomId() {
	return "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx".replace(/[xy]/g, function (e) {
		var t = (16 * Math.random()) | 0;
		return (("x" === e ? t : (3 & t) | 8).toString(16));
	});
}

export async function getCookies({ username, agent }) {
	const req = await fetch(`https://www.twitch.tv/${username}`, { agent });
	const cookieHeaders = req.headers.raw()["set-cookie"];

	const cookies = {
		api_token: "twilight." + getRandomId(),
	};

	cookieHeaders
		.map((x) => x.split("; ")[0].split("="))
		.forEach(([key, value]) => {
			cookies[key] = value;
		});

	return Object.entries(cookies)
		.map(([key, value]) => `${key}=${value}`)
		.join("; ");
}

export async function getTokenSignature({ channel, cookie, agent }) {
	const req = await fetch("https://gql.twitch.tv/gql", {
		agent,
		timeout,
		headers: {
			"client-id": "kimne78kx3ncx6brgo4mv6wki5h1ko",
			"content-type": "text/plain; charset=UTF-8",
			"device-id": getRandomId(),
			cookie,
			"User-Agent": randomUserAgent.getRandom(),
		},
		referrer: "https://www.twitch.tv/",
		referrerPolicy: "strict-origin-when-cross-origin",
		body: JSON.stringify({
			operationName: "PlaybackAccessToken_Template",
			query:
				'query PlaybackAccessToken_Template($login: String!, $isLive: Boolean!, $vodID: ID!, $isVod: Boolean!, $playerType: String!) {  streamPlaybackAccessToken(channelName: $login, params: {platform: "web", playerBackend: "mediaplayer", playerType: $playerType}) @include(if: $isLive) {    value    signature    __typename  }  videoPlaybackAccessToken(id: $vodID, params: {platform: "web", playerBackend: "mediaplayer", playerType: $playerType}) @include(if: $isVod) {    value    signature    __typename  }}',
			variables: { isLive: true, login: channel, isVod: false, vodID: "", playerType: "site" },
		}),
		method: "POST",
		mode: "cors",
		credentials: "include",
	});
	const { data } = await req.json();
	// console.log(data);
	const { value, signature } = data.streamPlaybackAccessToken;
	return { signature, token: encodeURIComponent(value) };
}

async function fetchPlaylistUrl({ channel, token, signature, agent }) {
	const rand = Math.floor(9999999 * Math.random());
	const req = await fetch(
		`https://usher.ttvnw.net/api/channel/hls/${channel}.m3u8?allow_source=true&fast_bread=true&p=${rand}&play_session_id=${getRandomId()}&player_backend=mediaplayer&playlist_include_framerate=true&reassignments_supported=true&sig=${signature}&supported_codecs=avc1&token=${token}&cdm=wv&player_version=1.3.0`,
		{
			agent,
			timeout,

			headers: {
				"User-Agent": randomUserAgent.getRandom(),
			},
		}
	);
	const playlist = await req.text();
	const part = playlist;
	return part.slice(part.indexOf("https://"));
}

function getFragmentUrl(playlist) {
	var index = playlist.indexOf("#EXT-X-TWITCH-PREFETCH");
	if (index == -1) index = playlist.indexOf("#EXTINF");

	const base = playlist.slice(index);
	const link = base.slice(base.indexOf("https://"));
	return link.slice(0, link.indexOf("\n"));
}

async function fetchPlaylist({ playlist, agent }) {
	const req = await fetch(playlist, {
		method: "GET",
		timeout,
		headers: {
			"User-Agent": randomUserAgent.getRandom(),
		},
		agent,
	});
	return await req.text();
}

async function sleep(ms) {
	return new Promise((res) => setTimeout(res, ms));
}

async function view({ channel, agent, persist, i }) {
	const cookie = await getCookies(channel);
	const { signature, token } = await getTokenSignature({ channel, cookie, agent });
	const { channel_id } = JSON.parse(decodeURIComponent(token));
	const playlistUrl = await fetchPlaylistUrl({ channel, token, signature, agent });

	return await sendViews({ playlistUrl, agent, i, persist });
}

async function sendViews({ playlistUrl, agent, i, persist }) {
	const playlist = await fetchPlaylist({ playlist: playlistUrl, agent });
	const fragmentUrl = getFragmentUrl(playlist);
	if (!fragmentUrl) console.log({ playlist, playlistUrl });

	await fetch(fragmentUrl, {
		method: "HEAD",
		agent,
		timeout,
		headers: {
			"User-Agent": randomUserAgent.getRandom(),
		},
	});

	console.log(`[Bot] view: ${i}`);
	if (persist) {
		setTimeout(sendViews.bind(null, { playlistUrl, agent, i, persist }), 1000 * 2);
	}
}

async function getTorProxies(count, offset = 0) {
	const promises = [];
	let portOffset = 9060 + offset;

	for (var i = 0; i < count; i++) {
		const counter = i + offset;
		console.log("[Tor] connect: " + counter);

		const port = portOffset + i;
		const dataDir = path.join(__dirname, "tmp", `tor${counter}`);
		const geoip = path.join(__dirname, "tor", "geoip");
		const geoip6 = path.join(__dirname, "tor", "geoip6");

		let commandTemplate = `--SocksPort ${port} --DataDirectory ${dataDir}`;

		let exitNode = process.argv[2] || false;


		if (!exitNode) {

		} else {
			commandTemplate+=` --ExitNodes {${exitNode}} --StrictNodes 1`;
		}

		console.log('SPAWNED : ', commandTemplate);
		const tor = spawn(
			torpath,
			commandTemplate.split(" ")
		);

		// --GeoIPFile ${geoip} --GeoIPv6File ${geoip6}

		tor.on("exit", () => console.log("[Tor] killed: " + counter));
		tor.on("error", (error) => console.error("[Tor] err", error.toString()));
		tor.stderr.on("data", (data) => console.error(data.toString()));

		promises.push(
			new Promise((res, rej) => {
				tor.stdout.on("data", (data) => {
					// console.log(data.toString().replace("\n", ""));
					if (data.toString().includes("100%")) {
						console.log("[Tor] connected: " + counter);
						const agent = new SocksProxyAgent({ host: "localhost", port });
						agent.tor = tor;
						res(agent);
					}
				});
				setTimeout(() => rej(new Error("[Tor] timeout connect")), 1000 * 30);
			})
		);
		// await sleep(500);
	}
	const catched = await Promise.all(promises.map((p) => p.catch((e) => e)));
	const filtered = catched.filter((result) => !(result instanceof Error));
	return filtered;
}

async function getListProxies(count) {
	const lines = await fs.readFile("proxy_file.txt", { encoding: "utf8" });

	console.log('LINES !', lines);
	const result = await Promise.all(
		lines
			.split("\n")
			.slice(0, count)
			.map(async (x) => {
				const [host, port] = x.split(":");
				const ip = await (await fetch(`https://api.my-ip.io/ip`, { timeout:10000 })).text();
				console.log(ip);
				return new HttpsProxyAgent({ host, port, timeout });
			})
	);
	return result.filter();
}

var threads = {};
var threadIds = 0;
var torI = 0;
var proxylessIp;

async function addThread(agent) {
	const id = threadIds++;
	// if (!agent) agent = (await getTorProxies(1, torI++))[0];

	setTimeout(async () => {
		while (true) {
			try {
				const ip = await (await fetch("https://api.my-ip.io/ip", { agent })).text();
				if (ip === proxylessIp) {
					await sleep(1000 * 1);
					throw "[Proxy] transparent: skipping";
				}

				await view({ channel: ChannelName, agent, persist: false, i: id });
			} catch (error) {
				console.error(error);
			}

			try {
				// agent.tor.kill("SIGHUP");
				kill(agent.tor.pid, "SIGHUP");
			} catch (e) {
				// console.error(e);
			}
		}
	});
}

async function setThreads(threadCount) {
	var agents = {};

	if (proxyType === 'tor') {
		agents = await getTorProxies(threadCount, threadIds);
	} else {
		agents = await getListProxies(threadCount);
	}


	for (var t = 0; t < threadCount; t++) {
		threads[t + threadIds] = true;
		addThread(agents[t]);
		// await sleep(250);
	}
}

let ChannelName = "";
let input = "";

if (!global.module) {
	rl.question("Twitch Channel name:\n", async (channel) => {
		await fs.mkdir(__dirname + "/tmp").catch((e) => {});
		ChannelName = channel;

		rl.question("How many viewers?\n", async (answer) => {
			var viewers = parseInt(answer);
			if (isNaN(viewers) || viewers <= 0) viewers = 1;
			proxylessIp = await (await fetch("https://api.my-ip.io/ip")).text();

			setThreads(Math.ceil(viewers));

			//interactive();
		});
	});
}

function interactive() {
	process.stdin.on("data", async (data) => {
		data = data.toString();
		if (data.charCodeAt(0) !== 13) return (input += data);
		if (isNaN(Number(input))) {
			console.log("Change channel to:" + input);
			ChannelName = input;
			input = "";
			return;
		}
		const count = Number(input) - threadIds;
		console.log(`[Thread] count set to: ${input} | Adding: ${count}`);
		input = "";

		await setThreads(count);
	});
}
