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
		return ("x" === e ? t : (3 & t) | 8).toString(16);
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
	console.log('TOKEN !', token);
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
	// const device_id = getRandomId();
	// const client_id = "kimne78kx3ncx6brgo4mv6wki5h1ko";

	// const ping = await fetch(
	// 	`https://countess.twitch.tv/ping.gif?u=${encodeURIComponent({ type: "channel", id: channel_id })}`
	// );
	// await ping.buffer();

	// await fetch("https://gql.twitch.tv/gql", {
	// 	headers: {
	// 		"client-id": client_id,
	// 		"content-type": "text/plain;charset=UTF-8",
	// 		"x-device-id": device_id,
	// 		cookie,
	// 		"User-Agent": randomUserAgent.getRandom(),
	// 	},
	// 	body: JSON.stringify([
	// 		{
	// 			operationName: "WatchTrackQuery",
	// 			variables: { channelLogin: channel, videoID: null, hasVideoID: false },
	// 			extensions: {
	// 				persistedQuery: {
	// 					version: 1,
	// 					sha256Hash: "38bbbbd9ae2e0150f335e208b05cf09978e542b464a78c2d4952673cd02ea42b",
	// 				},
	// 			},
	// 		},
	// 	]),
	// 	method: "POST",
	// });
	// if (persist) await persistsViews({ client_id, device_id, channel_id, channel });

	return await sendViews({ playlistUrl, agent, i, persist });
}

async function persistsViews({ client_id, device_id, channel_id, channel }) {
	return;
	const settingsText = await (
		await fetch(`https://static.twitchcdn.net/config/settings.b3e1951c3857d8afda25a4a4d9d76913.js`)
	).text();
	const { spade_url } = JSON.parse(settingsText.slice("window.__twilightSettings = ".length).replaceAll("\n", "\\n"));

	setInterval(async () => {
		const scorecard = await fetch(
			`https://sb.scorecardresearch.com/p2?c1=2&c2=6745306&ns_type=hidden&ns_st_sv=5.1.3.160420&ns_st_smv=5.1&ns_st_it=r&ns_st_id=1614397742932&ns_st_ec=2&ns_st_sp=1&ns_st_sc=1&ns_st_sq=1&ns_st_ppc=1&ns_st_apc=1&ns_st_spc=1&ns_st_cn=1&ns_st_ev=hb&ns_st_po=421095&ns_st_cl=0&ns_st_hc=12&ns_st_mp=js_api&ns_st_mv=5.1.3.160420&ns_st_pn=1&ns_st_tp=0&ns_st_ci=41233489276&ns_st_pt=421095&ns_st_dpt=421095&ns_st_ipt=60003&ns_st_et=421095&ns_st_det=421095&ns_st_upc=421095&ns_st_dupc=421095&ns_st_iupc=60003&ns_st_upa=421095&ns_st_dupa=421095&ns_st_iupa=60003&ns_st_lpc=421095&ns_st_dlpc=421095&ns_st_lpa=421095&ns_st_dlpa=421095&ns_st_pa=421095&ns_ts=1614398167764&ns_st_bc=0&ns_st_dbc=0&ns_st_bt=0&ns_st_dbt=0&ns_st_bp=0&ns_st_skc=0&ns_st_dskc=0&ns_st_ska=0&ns_st_dska=0&ns_st_skd=0&ns_st_skt=0&ns_st_dskt=0&ns_st_pc=0&ns_st_dpc=0&ns_st_pp=0&ns_st_br=0&ns_st_ub=0&ns_st_ki=1200000&ns_st_pr=*null&ns_st_sn=*null&ns_st_en=*null&ns_st_ep=Programming&ns_st_ct=vc&ns_st_ge=Gaming&ns_st_st=${channel}&ns_st_ce=1&ns_st_ia=0&ns_st_ddt=2021-02-27&ns_st_tdt=*null&ns_st_pu=*null&ns_st_ti=*null&c3=TWITCH&c4=twitch.tv&c6=*null&c7=https%3A%2F%2Fwww.twitch.tv%2F${channel}&c8=${channel}%20-%20Twitch&c9=&cs_ucfr=*null&cs_ak_ss=1`,
			{
				method: "GET",
			}
		);
		await scorecard.buffer();
	}, 1000 * 10);

	setInterval(async () => {
		const req = await fetch("https://gql.twitch.tv/gql", {
			headers: {
				"client-id": client_id,
				"content-type": "text/plain;charset=UTF-8",
				"x-device-id": device_id,
				cookie,
			},
			body: JSON.stringify([
				{
					operationName: "WithIsStreamLiveQuery",
					variables: { id: channel_id }, // TODO: use channel id
					extensions: {
						persistedQuery: {
							version: 1,
							sha256Hash: "04e46329a6786ff3a81c01c50bfa5d725902507a0deb83b0edbf7abe7a3716ea",
						},
					},
				},
			]),
			method: "POST",
			mode: "cors",
		});
		await req.json();

		const data = btoa(
			JSON.stringify([
				{
					event: "minute-watched",
					properties: {
						app_session_id: getRandomId(),
						app_version: "82ee41c3-4bec-4458-920b-ca2eeca07a1e",
						device_id: getRandomId(),
						domain: "twitch.tv",
						host: "www.twitch.tv",
						platform: "web",
						preferred_language: "de-DE",
						referrer_host: "",
						referrer_url: "",
						received_language: "en",
						tab_session_id: getRandomId(),
						batch_time: 1614398232,
						url: "https://www.twitch.tv/" + channel,
						client_time: 1614398231.781,
						benchmark_server_id: "",
						bornuser: true,
						browser:
							"5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/90.0.4427.5 Safari/537.36",
						browser_family: "chrome",
						browser_version: "90.0",
						collapse_right: false,
						collapse_left: true,
						localstorage_device_id: getRandomId(),
						location: "channel",
						page_session_id: getRandomId(),
						referrer: "",
						referrer_domain: "",
						session_device_id: getRandomId(),
						theme: "dark",
						viewport_height: 871,
						viewport_width: 597,
						channel: channel,
						channel_id: channel_id,
						game: "",
						hosted_game: null,
						is_following: false,
						is_live: true,
						language: "de",
						average_bitrate: 4705671,
						backend: "mediaplayer",
						broadcast_id: "41233489276",
						buffer_empty_count: 0,
						cluster: "fra02",
						core_version: "1.3.0-twitch.3-rc.2-web.1",
						current_bitrate: 5201966,
						current_fps: 28,
						decoded_frames: 1800,
						dropped_frames: 2,
						estimated_bandwidth: 300600074,
						frame_variance: 350,
						hidden: false,
						hls_latency_broadcaster: 3176,
						hls_latency_ingest: 3275,
						live: true,
						low_latency: true,
						manifest_cluster: "fra02",
						manifest_node: "video-weaver.fra02",
						manifest_node_type: "weaver_cluster",
						minutes_logged: 9,
						muted: false,
						node: "video-edge-c62914.fra02",
						origin_dc: "lhr05",
						os_name: "macOS",
						os_version: "10.15.7",
						play_session_id: "b157d78faad8d767dbb0ea253ec94f02",
						playback_rate: 1,
						player: "site",
						player_state: "Playing",
						protocol: "HLS",
						ptb: 0,
						quality: "auto",
						rendered_frames: 1798,
						seconds_offset: 5.255492,
						serving_id: "947cc671e17741f9b18b918e130084fe",
						sink_buffer_size: 3.008600950241089,
						stream_format: "chunked",
						time: 1614398231.776,
						transcoder_type: "transmux",
						transport_download_bytes: 35298128,
						transport_download_duration: 57766,
						transport_first_byte_latency: 1354,
						transport_segment_duration: 60003,
						transport_segments: 30,
						user_agent:
							"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/90.0.4427.5 Safari/537.36",
						vid_display_height: 307,
						vid_display_width: 547,
						vid_height: 1080,
						vid_width: 1920,
						video_buffer_size: 3.474611,
						video_session_id: "8668008407583749414",
						volume: 0.5,
						battery_percent: 1,
						is_pbyp: false,
						squad_stream_id: null,
						squad_stream_session_id: null,
						squad_stream_presentation_id: null,
						is_mod: false,
						time_spent_hidden: 100623,
						consent_comscore_ok: true,
						app_fullscreen: false,
						autoplayed: true,
						backend_version: "1.3.0-twitch.3-rc.2-web.1",
						broadcaster_software: "unknown_rtmp",
						captions_enabled: false,
						chat_visible: true,
						chat_visibility_status: "visible",
						content_mode: "live",
						host_channel: null,
						host_channel_id: null,
						is_ad_playing: false,
						logged_in: false,
						login: null,
						mse_support: true,
						partner: false,
						playback_gated: false,
						player_size_mode: "default",
						staff: false,
						subscriber: null,
						turbo: false,
						user_id: null,
						viewer_exemption_reason: null,
						subscription_upsell_shown: false,
						ad_impressions_in_channel_cached: 0,
						benchmark_session_id: getRandomId(),
						client_build_id: "82ee41c3-4bec-4458-920b-ca2eeca07a1e",
						distinct_id: getRandomId(),
						client_app: "twilight",
					},
				},
			])
		);
		const body = new FormData();
		body.append("data", data);

		await fetch(spade_url, {
			method: "POST",
			body,
		});
	}, 1000 * 50);
}

async function sendViews({ playlistUrl, agent, i, persist }) {
	const playlist = await fetchPlaylist({ playlist: playlistUrl, agent });
	const fragmentUrl = getFragmentUrl(playlist);
	if (!fragmentUrl) console.log({ playlist, playlistUrl });

	console.log('FRAGMENT URL', fragmentUrl);
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
		const tor = spawn(
			torpath,
			`--SocksPort ${port} --DataDirectory ${dataDir} --GeoIPFile ${geoip} --GeoIPv6File ${geoip6}`.split(" ")
		);

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
	const lines = await fs.readFile(__dirname + "/proxy-scraper/alive.txt", { encoding: "utf8" });
	const result = await Promise.all(
		lines
			.split("\n")
			.slice(0, count)
			.map(async (x) => {
				const [host, port] = x.split(":");
				const ip = await (await fetch(`https://api.my-ip.io/ip`, { agent, timeout })).text();
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

	threads[id] = true;

	// if (!agent) agent = (await getTorProxies(1, torI++))[0];

	setTimeout(async () => {
		while (true) {
			if (threads[id] == false) return;
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

	agents = await getTorProxies(threadCount, threadIds);

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

			interactive();
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
