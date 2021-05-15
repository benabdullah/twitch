"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (_) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
var twitch_js_1 = require("twitch-js");
var fs_1 = __importDefault(require("fs"));
require("missing-native-js-functions");
var path_1 = __importDefault(require("path"));
var readline_1 = __importDefault(require("readline"));
var __dirname = path_1.default.resolve();
var rl = readline_1.default.createInterface({
    input: process.stdin,
    output: process.stdout,
});
var channel = "";
var lastChat;
var chats = [];
var listen = [];
function chat(_a) {
    var token = _a.token, username = _a.username;
    return __awaiter(this, void 0, void 0, function () {
        var chat_1, error_1;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    _b.trys.push([0, 3, , 4]);
                    chat_1 = new twitch_js_1.Chat({
                        token: token,
                        username: username,
                        log: { level: "silent" },
                    });
                    return [4 /*yield*/, chat_1.connect()];
                case 1:
                    _b.sent();
                    return [4 /*yield*/, chat_1.join(channel)];
                case 2:
                    _b.sent();
                    console.log("[Chat] connected: " + username);
                    return [2 /*return*/, chat_1];
                case 3:
                    error_1 = _b.sent();
                    console.error("[Chat] connect error: " + username);
                    return [3 /*break*/, 4];
                case 4: return [2 /*return*/];
            }
        });
    });
}
function loadText() {
    return __awaiter(this, void 0, void 0, function () {
        var list;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, fs_1.default.promises.mkdir(path_1.default.join(__dirname, "text")).catch(function (e) { })];
                case 1:
                    _a.sent();
                    listen = fs_1.default.readdirSync(path_1.default.join(__dirname, "/text/"), { encoding: "utf8" }).filter(function (x) { return x.endsWith(".txt"); });
                    list = {};
                    listen.forEach(function (liste) {
                        var name = liste.split(".")[0];
                        list[name] = fs_1.default.readFileSync(path_1.default.join(__dirname, "/text/", liste), { encoding: "utf8" }).split("\n");
                    });
                    listen = list;
                    return [2 /*return*/];
            }
        });
    });
}
function main() {
    return __awaiter(this, void 0, void 0, function () {
        var promises, connected, users, _i, users_1, user, _a, username, token;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    loadText();
                    promises = [];
                    connected = false;
                    users = fs_1.default.readFileSync(path_1.default.join(__dirname, "users.txt"), { encoding: "utf8" }).split("\n");
                    _i = 0, users_1 = users;
                    _b.label = 1;
                case 1:
                    if (!(_i < users_1.length)) return [3 /*break*/, 4];
                    user = users_1[_i];
                    _a = user.split(" "), username = _a[0], token = _a[1];
                    console.log('USERNAME', username, 'TOKEN', token);
                    promises.push(chat({ username: username, token: token }).caught());
                    return [4 /*yield*/, sleep(100)];
                case 2:
                    _b.sent();
                    _b.label = 3;
                case 3:
                    _i++;
                    return [3 /*break*/, 1];
                case 4:
                    setTimeout(function () {
                        if (!connected) {
                            console.error("Could not connect all accounts to twitch");
                            cli();
                        }
                    }, 1000 * 10);
                    return [4 /*yield*/, Promise.all(promises)];
                case 5:
                    chats = (_b.sent()).filter(function (x) { return !!x; });
                    connected = true;
                    cli();
                    return [2 /*return*/];
            }
        });
    });
}
function cli() {
    var shorthands = {};
    Object.keys(listen).forEach(function (key) {
        shorthands[key[0]] = listen[key];
    });
    var question = Object.keys(listen).map(function (key) { return key[0] + "(" + key.slice(1) + ")"; });
    rl.question("Aktion: " + question + ", l(reload all texts), or enter any message (! as prefix to send it as the same last person)\n", function (answer) {
        var liste = shorthands[answer];
        if (liste) {
            randomSchreiben(liste, true);
        }
        else if (answer === "l") {
            loadText();
        }
        else if (answer.length <= 1) {
            console.error("invalid action");
        }
        else {
            if (!answer.startsWith("!") || !lastChat) {
                lastChat = newRandomChat();
            }
            else {
                answer = answer.slice(1);
            }
            lastChat.broadcast(answer);
        }
        return cli();
    });
}
function newRandomChat() {
    var c;
    do {
        c = chats.random();
    } while (c === lastChat);
    return c;
}
function randomSchreiben(arr, shouldDelete) {
    return __awaiter(this, void 0, void 0, function () {
        var msg;
        return __generator(this, function (_a) {
            msg = arr.random();
            if (!msg)
                return [2 /*return*/, console.log("empty list: all messages were already sent")];
            if (shouldDelete)
                arr.remove(msg);
            lastChat = newRandomChat();
            lastChat.broadcast(msg);
            return [2 /*return*/];
        });
    });
}
rl.question("Twitch Channel name:\n", function (name) {
    channel = name;
    main();
});
function sleep(ms) {
    return new Promise(function (res) { return setTimeout(res, ms); });
}
