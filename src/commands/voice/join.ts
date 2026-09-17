import {
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
  ChannelType,
  type VoiceChannel,
  MessageFlags,
} from "discord.js";
import { joinVoiceChannel, entersState, VoiceConnectionStatus } from "@discordjs/voice";
import { getGuild, setGuild } from "../../utils/guild-config.js";

export default {
  data: new SlashCommandBuilder()
    .setName("join")
    .setDescription("เชื่อมต่อห้องเสียง")
    .setDMPermission(false)
    .setContexts(0)
    .setIntegrationTypes(0)
    .addChannelOption((opt) =>
      opt
        .setName("channel")
        .setDescription("ห้องเสียงที่จะเชื่อมต่อ (ไม่ใส่ = ห้องที่คุณอยู่)")
        .addChannelTypes(ChannelType.GuildVoice)
        .setRequired(false)
    )
    .addBooleanOption((opt) =>
      opt
        .setName("auto_read")
        .setDescription("อ่านข้อความในแชทนี้ด้วย TTS อัตโนมัติ")
        .setRequired(false)
    ),

  execute: async (interaction: ChatInputCommandInteraction) => {
    if (!interaction.guild) {
      await interaction.reply({ content: "คำสั่งนี้ใช้ได้เฉพาะในเซิร์ฟเวอร์", flags: MessageFlags.Ephemeral });
      return;
    }

    const channelOpt = interaction.options.getChannel("channel") as VoiceChannel | null;
    const member = interaction.member as import("discord.js").GuildMember;
    const userVoice = member?.voice?.channel;
    const target = channelOpt ?? userVoice;

    if (!target || target.type !== ChannelType.GuildVoice) {
      await interaction.reply({
        content: "คุณต้องอยู่ในห้องเสียง หรือระบุห้องเสียง",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const vc = interaction.guild.members.me?.voice?.channel;
    let msg: string;

    let conn;
    if (vc) {
      if (vc.id !== target.id) {
        conn = joinVoiceChannel({
          channelId: target.id,
          guildId: interaction.guild.id,
          adapterCreator: interaction.guild.voiceAdapterCreator as any,
          selfDeaf: false,
        });
        msg = `ย้ายไป ${target.toString()} แล้ว`;
      } else {
        msg = `อยู่ใน ${target.toString()} อยู่แล้ว`;
      }
    } else {
      conn = joinVoiceChannel({
        channelId: target.id,
        guildId: interaction.guild.id,
        adapterCreator: interaction.guild.voiceAdapterCreator as any,
        selfDeaf: false,
      });
      msg = `เชื่อมต่อ ${target.toString()} แล้ว`;
    }

    if (conn) {
      try {
        await entersState(conn, VoiceConnectionStatus.Ready, 15_000);
      } catch (e) {
        console.error("[join] Failed to connect to voice channel:", e);
        try {
          conn.destroy();
        } catch {
          // ignore
        }
        await interaction.followUp({
          content: "ไม่สามารถเชื่อมต่อห้องเสียงได้ กรุณาลองใหม่อีกครั้ง",
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
    }

    const autoRead = interaction.options.getBoolean("auto_read") ?? true;
    const guildId = interaction.guild.id;

    if (autoRead) {
      setGuild(guildId, "auto_read_channel_id", target.id);
      setGuild(guildId, "auto_read_enabled", true);
      msg += " และเปิดอ่านข้อความอัตโนมัติ";
    } else {
      setGuild(guildId, "auto_read_enabled", false);
      msg += " และปิดอ่านข้อความอัตโนมัติ";
    }

    await interaction.followUp({ content: msg, flags: MessageFlags.Ephemeral });
  },
};
