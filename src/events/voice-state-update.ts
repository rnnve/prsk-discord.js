import {
  Events,
  type Client,
  type VoiceState,
  type GuildMember,
  ChannelType,
} from "discord.js";
import { getGuild } from "../utils/guild-config.js";

async function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export default {
  name: Events.VoiceStateUpdate,
  execute: async (_client: Client, before: VoiceState, after: VoiceState) => {
    const member = before.member;
    if (!member) return;

    const clientUser = _client.user;
    if (!clientUser || member.id !== clientUser.id) return;
    if (!before.channel || after.channel) return;

    const guild = member.guild;

    const cfg = getGuild(guild.id);
    if (!cfg.autojoin_enabled) {
      console.log(`Autojoin disabled for guild ${guild.id} — skipping reconnect`);
      return;
    }

    console.warn("Disconnected — attempting to reconnect immediately");

    const channelId = cfg.auto_read_channel_id || before.channel.id;

    for (let attempt = 0; attempt < 30; attempt++) {
      const vc = guild.members.me?.voice?.channel;
      if (vc) {
        console.log("Reconnected successfully");
        return;
      }

      const channel = guild.channels.cache.get(channelId);
      if (channel && channel.type === ChannelType.GuildVoice) {
        try {
          const { joinVoiceChannel } = await import("@discordjs/voice");
          joinVoiceChannel({
            channelId: channel.id,
            guildId: guild.id,
            adapterCreator: guild.voiceAdapterCreator as any,
            selfDeaf: false,
          });
          console.log(`Reconnected successfully (attempt ${attempt + 1})`);
          return;
        } catch {
          // continue retry
        }
      }
      await sleep(2 ** Math.min(attempt, 4) * 1000);
    }
    console.error("Reconnect failed after 30 attempts");
  },
};
