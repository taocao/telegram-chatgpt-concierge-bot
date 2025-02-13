import dotenv from "dotenv";
dotenv.config();

import { Telegraf } from "telegraf";
import { downloadVoiceFile } from "./lib/downloadVoiceFile";
import { postToWhisper } from "./lib/postToWhisper";
import { textToSpeech } from "./lib/htApi";
import { createReadStream, existsSync, mkdirSync } from "fs";
import { Model as ChatModel } from "./models/chat";
import { Model as ChatWithTools } from "./models/chatWithTools";
import { healthcheck } from "./lib/healthcheck";

const workDir = "./tmp";
const telegramToken = process.env.TELEGRAM_TOKEN!;

const bot = new Telegraf(telegramToken);
let model = new ChatWithTools();

if (!existsSync(workDir)) {
  mkdirSync(workDir);
}

healthcheck();

bot.start((ctx) => {
  ctx.reply("Welcome to my Telegram bot!");
});

bot.help((ctx) => {
  ctx.reply("Send me a message and I will echo it back to you.");
});

bot.on("voice", async (ctx) => {
  const voice = ctx.message.voice;
  await ctx.sendChatAction("typing");

  const localFilePath = await downloadVoiceFile(workDir, voice.file_id, bot);
  const transcription = await postToWhisper(model.openai, localFilePath);

  await ctx.reply(`Transcription: ${transcription}`);
  await ctx.sendChatAction("typing");

  const response = await model.call(transcription);

  console.log(response);

  await ctx.reply(response);
  const responseTranscriptionPath = await textToSpeech(response);

  await ctx.sendChatAction("typing");

  await ctx.replyWithVoice({
    source: createReadStream(responseTranscriptionPath),
    filename: localFilePath,
  });
});

bot.on("message", async (ctx) => {
  const text = (ctx.message as any).text;

  if (!text) {
    ctx.reply("Please send a text message.");
    return;
  }

  console.log("Input: ", text);
  await ctx.sendChatAction("typing");
  const response = await model.call(text);

  await ctx.reply(response);
});

bot.launch();

console.log("Bot started");
