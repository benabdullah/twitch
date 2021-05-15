import { Chat } from "twitch-js";
import fs from "fs";
import "missing-native-js-functions";
import path from "path";
import readline from "readline";
const __dirname = path.resolve();

const rl = readline.createInterface({
	input: process.stdin,
	output: process.stdout,
});

var channel = "";
var lastChat;
var chats = [];
var listen = [];

async function chat({ token, username }) {
	try {
		const chat = new Chat({
			token,
			username,
			log: { level: "silent" },
		});
		await chat.connect();
		await chat.join(channel);
		console.log(`[Chat] connected: ${username}`);
		return chat;
	} catch (error) {
		console.error(`[Chat] connect error: ${username}`);
	}
}

async function loadText() {
	await fs.promises.mkdir(path.join(__dirname, "text")).catch((e) => {});

	listen = fs.readdirSync(path.join(__dirname, "/text/"), { encoding: "utf8" }).filter((x) => x.endsWith(".txt"));
	const list = {};

	listen.forEach((liste) => {
		const [name] = liste.split(".");
		list[name] = fs.readFileSync(path.join(__dirname, "/text/", liste), { encoding: "utf8" }).split("\n");
	});

	listen = list;
}

async function main() {
	loadText();
	let promises = [];
	var connected = false;

	const users = fs.readFileSync(path.join(__dirname, "users.txt"), { encoding: "utf8" }).split("\n");
	for (const user of users) {
		const [username, token] = user.split(" ");
		console.log('USERNAME', username, 'TOKEN', token);
		promises.push(chat({ username, token }).caught());
		await sleep(100);
	}

	setTimeout(() => {
		if (!connected) {
			console.error("Could not connect all accounts to twitch");
			cli();
		}
	}, 1000 * 10);
	chats = (await Promise.all(promises)).filter((x) => !!x);
	connected = true;

	cli();
}

function cli() {
	const shorthands = {};

	Object.keys(listen).forEach((key) => {
		shorthands[key[0]] = listen[key];
	});

	const question = Object.keys(listen).map((key) => `${key[0]}(${key.slice(1)})`);

	rl.question(
		`Aktion: ${question}, l(reload all texts), or enter any message (! as prefix to send it as the same last person)\n`,
		(answer) => {
			const liste = shorthands[answer];

			if (liste) {
				randomSchreiben(liste, true);
			} else if (answer === "l") {
				loadText();
			} else if (answer.length <= 1) {
				console.error("invalid action");
			} else {
				if (!answer.startsWith("!") || !lastChat) {
					lastChat = newRandomChat();
				} else {
					answer = answer.slice(1);
				}
				lastChat.broadcast(answer);
			}
			return cli();
		}
	);
}

function newRandomChat() {
	var c;
	do {
		c = chats.random();
	} while (c === lastChat);
	return c;
}

async function randomSchreiben(arr, shouldDelete) {
	const msg = arr.random();
	if (!msg) return console.log("empty list: all messages were already sent");
	if (shouldDelete) arr.remove(msg);

	lastChat = newRandomChat();
	lastChat.broadcast(msg);
}

rl.question("Twitch Channel name:\n", (name) => {
	channel = name;
	main();
});

function sleep(ms) {
	return new Promise((res) => setTimeout(res, ms));
}
