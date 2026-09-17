import {
  Events,
  type Client,
  type Message,
  ChannelType,
} from "discord.js";
import {
  getVoiceConnection,
} from "@discordjs/voice";
import { getGuild } from "../utils/guild-config.js";
import { playTts } from "../utils/tts.js";

const readLocks = new Map<string, Promise<void>>();

async function readQueue(text: string, guildId: string): Promise<void> {
  const existing = readLocks.get(guildId) ?? Promise.resolve();
  const newLock = existing.then(async () => {
    const result = await playTts(text, null, guildId);
    if (!result.ok) {
      console.error(`Auto-read TTS failed for guild ${guildId}:`, result.error);
    }
  });
  readLocks.set(guildId, newLock);
  try {
    await newLock;
  } finally {
    if (readLocks.get(guildId) === newLock) {
      readLocks.delete(guildId);
    }
  }
}

export default {
  name: Events.MessageCreate,
  execute: async (_client: Client, message: Message) => {
    if (message.author.bot) return;
    if (!message.guild) return;
    if (!message.content || !message.content.trim()) return;

    const cfg = getGuild(message.guild.id);
    if (!cfg.auto_read_enabled) return;

    const connection = getVoiceConnection(message.guild.id);
    if (!connection) return;

    const voiceChannelId = cfg.auto_read_channel_id;
    if (!voiceChannelId) return;

    const voiceChannel = message.guild.channels.cache.get(voiceChannelId);
    if (!voiceChannel || voiceChannel.type !== ChannelType.GuildVoice) return;

    const textChannel = message.guild.channels.cache.find(
      (ch) => ch.type === ChannelType.GuildText && ch.name === voiceChannel.name
    );
    if (!textChannel || message.channel.id !== textChannel.id) return;

    readQueue(message.content, message.guild.id);
  },
};