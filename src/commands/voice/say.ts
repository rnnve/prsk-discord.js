import {
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
  MessageFlags,
} from "discord.js";
import {
  joinVoiceChannel,
  getVoiceConnection,
  VoiceConnectionStatus,
  entersState,
} from "@discordjs/voice";
import { playTts } from "../../utils/tts.js";

async function ensureVoice(interaction: ChatInputCommandInteraction): Promise<boolean> {
  if (!interaction.guild) return false;
  const member = interaction.member;
  if (!member || !("voice" in member) || !member.voice.channel) {
    await interaction.followUp({
      content: "คุณต้องอยู่ในห้องเสียงก่อนใช้คำสั่งนี้",
      flags: MessageFlags.Ephemeral,
    });
    return false;
  }

  const target = member.voice.channel;
  let connection = getVoiceConnection(interaction.guild.id);

  if (connection && connection.state.status !== VoiceConnectionStatus.Destroyed) {
    const currentChannel = connection.joinConfig.channelId;
    if (currentChannel !== target.id) {
      connection.destroy();
      connection = undefined;
    }
  }

  if (!connection || connection.state.status === VoiceConnectionStatus.Destroyed) {
    connection = joinVoiceChannel({
      channelId: target.id,
      guildId: interaction.guild.id,
      adapterCreator: interaction.guild.voiceAdapterCreator as any,
      selfDeaf: false,
    });
  }

  if (connection.state.status !== VoiceConnectionStatus.Ready) {
    try {
      await entersState(connection, VoiceConnectionStatus.Ready, 15_000);
    } catch (e) {
      console.error("[say] Failed to connect to voice channel:", e);
      await interaction.followUp({
        content: "ไม่สามารถเชื่อมต่อห้องเสียงได้ กรุณาลองใหม่อีกครั้ง",
        flags: MessageFlags.Ephemeral,
      });
      return false;
    }
  }

  return true;
}

export default {
  data: new SlashCommandBuilder()
    .setName("say")
    .setDescription("พูดข้อความด้วย TTS")
    .setDMPermission(false)
    .setContexts(0)
    .setIntegrationTypes(0)
    .addStringOption((opt) =>
      opt.setName("text").setDescription("ข้อความที่จะให้บอทพูด").setRequired(true)
    )
    .addStringOption((opt) =>
      opt
        .setName("voice")
        .setDescription("เสียงที่จะใช้ (ไม่ใส่ = เลือกอัตโนมัติตามภาษา)")
        .setRequired(false)
        .addChoices(
          { name: "ไทย (ชายนิวัฒน์ - Niwat)", value: "th-TH-NiwatNeural" },
          { name: "ไทย (หญิงเปรมวดี - Premwadee)", value: "th-TH-PremwadeeNeural" },
          { name: "English (Male - Andrew)", value: "en-US-AndrewNeural" },
          { name: "English (Female - Ava)", value: "en-US-AvaNeural" },
          { name: "日本語 (男性 - Keita)", value: "ja-JP-KeitaNeural" },
          { name: "日本語 (女性 - Nanami)", value: "ja-JP-NanamiNeural" }
        )
    ),

  execute: async (interaction: ChatInputCommandInteraction) => {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    if (!(await ensureVoice(interaction))) return;

    const text = interaction.options.getString("text", true);
    const voice = interaction.options.getString("voice");

    let notified = false;
    const result = await playTts(text, voice, interaction.guild!.id, {
      onStart: async () => {
        if (!notified) {
          notified = true;
          await interaction.followUp({ content: `กำลังพูด: ${text}`, flags: MessageFlags.Ephemeral });
        }
      },
    });

    if (!result.ok) {
      console.error(`TTS failed for guild ${interaction.guild!.id}:`, result.error);
      if (!notified) {
        await interaction.followUp({ content: `ไม่สามารถพูดได้: ${result.error}`, flags: MessageFlags.Ephemeral });
      }
      return;
    }

    if (!notified) {
      await interaction.followUp({ content: `กำลังพูด: ${text}`, flags: MessageFlags.Ephemeral });
    }
  },
};
