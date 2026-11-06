const fs = require("fs-extra");
const https = require("https");
const path = require("path");
const { utils } = global;

const GIF_URL = "https://i.imgur.com/OrRKAkP.gif";

async function sendGif(message, text, callback) {
	const cacheDir = path.join(__dirname, "cache");
	const gifPath = path.join(cacheDir, "prefix-villain.gif");

	await fs.ensureDir(cacheDir);

	try {
		await downloadGif(GIF_URL, gifPath);

		return message.reply({
			body: text,
			attachment: fs.createReadStream(gifPath)
		}, callback);
	}
	catch (err) {
		console.error("Prefix GIF error:", err);
		return message.reply(text, callback);
	}
}

function downloadGif(url, dest) {
	return new Promise((resolve, reject) => {
		const file = fs.createWriteStream(dest);

		https.get(url, res => {
			if (res.statusCode !== 200) {
				file.close();
				fs.unlink(dest, () => {});
				return reject(new Error("GIF download failed"));
			}

			res.pipe(file);
			file.on("finish", () => file.close(resolve));
			file.on("error", err => {
				fs.unlink(dest, () => {});
				reject(err);
			});
		}).on("error", err => {
			fs.unlink(dest, () => {});
			reject(err);
		});
	});
}

module.exports = {
	config: {
		name: "prefix",
		version: "1.5",
		author: "Su Baru",
		countDown: 5,
		role: 0,
		description: "Change bot prefix",
		category: "config",
		guide: {
			en: "{pn} <new prefix>\n{pn} <new prefix> -g\n{pn} reset"
		}
	},

	langs: {
		en: {
			reset: "🔄 Prefix reset to default: %1",
			onlyAdmin: "⛔ Only bot admins can change global prefix!",
			confirmGlobal: "👑 React to this message to confirm GLOBAL prefix change!",
			confirmThisThread: "⚔️ React to this message to confirm prefix change in this chat!",
			successGlobal: "🔥 Global prefix changed to: %1",
			successThisThread: "🩸 Chat prefix changed to: %1",
			myPrefix: "🌐 System prefix: %1\n⚔️ Chat prefix: %2"
		}
	},

	onStart: async function ({
		message, role, args, commandName,
		event, threadsData, getLang
	}) {
		if (!args[0])
			return message.SyntaxError();

		if (args[0] === "reset") {
			await threadsData.set(event.threadID, null, "data.prefix");

			return sendGif(
				message,
				getLang("reset", global.GoatBot.config.prefix)
			);
		}

		const newPrefix = args[0];

		if (!newPrefix || newPrefix.length > 10)
			return message.reply("⚠️ Prefix must be 1-10 characters!");

		const formSet = {
			commandName,
			author: event.senderID,
			newPrefix
		};

		if (args[1] === "-g") {
			if (role < 2)
				return message.reply(getLang("onlyAdmin"));

			formSet.setGlobal = true;
		}
		else {
			formSet.setGlobal = false;
		}

		return sendGif(
			message,
			args[1] === "-g"
				? getLang("confirmGlobal")
				: getLang("confirmThisThread"),
			(err, info) => {
				if (err || !info) return;

				formSet.messageID = info.messageID;
				global.GoatBot.onReaction.set(info.messageID, formSet);
			}
		);
	},

	onReaction: async function ({
		message, threadsData, event, Reaction, getLang
	}) {
		const { author, newPrefix, setGlobal } = Reaction;

		if (event.userID !== author)
			return;

		if (setGlobal) {
			global.GoatBot.config.prefix = newPrefix;

			fs.writeFileSync(
				global.client.dirConfig,
				JSON.stringify(global.GoatBot.config, null, 2)
			);

			return sendGif(
				message,
				getLang("successGlobal", newPrefix)
			);
		}
		else {
			await threadsData.set(
				event.threadID,
				newPrefix,
				"data.prefix"
			);

			return sendGif(
				message,
				getLang("successThisThread", newPrefix)
			);
		}
	},

	onChat: async function ({ event, message, getLang }) {
		if (event.body && event.body.toLowerCase() === "prefix") {
			return () => {
				return sendGif(
					message,
					getLang(
						"myPrefix",
						global.GoatBot.config.prefix,
						utils.getPrefix(event.threadID)
					)
				);
			};
		}
	}
};
