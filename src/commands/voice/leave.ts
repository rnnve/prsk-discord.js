import { SlashCommandBuilder, type ChatInputCommandInteraction, MessageFlags } from "discord.js";
import { getVoiceConnection } from "@discordjs/voice";
import { setGuild } from "../../utils/guild-config.js";
import { cleanupGuildPlayer } from "../../utils/tts.js";

export default {
  data: new SlashCommandBuilder()
    .setName("leave")
    .setDescription("ตัดการเชื่อมต่อจากห้องเสียง")
    .setDMPermission(false)
    .setContexts(0)
    .setIntegrationTypes(0),

  execute: async (interaction: ChatInputCommandInteraction) => {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    if (!interaction.guild) {
      await interaction.followUp({ content: "คำสั่งนี้ใช้ได้เฉพาะในเซิร์ฟเวอร์", flags: MessageFlags.Ephemeral });
      return;
    }

    const connection = getVoiceConnection(interaction.guild.id);
    if (!connection) {
      await interaction.followUp({ content: "บอทไม่ได้เชื่อมต่อกับห้องเสียง", flags: MessageFlags.Ephemeral });
      return;
    }

    try {
      cleanupGuildPlayer(interaction.guild.id);
      connection.destroy();
      setGuild(interaction.guild.id, "auto_read_enabled", false);
      setGuild(interaction.guild.id, "auto_read_channel_id", null);
      setGuild(interaction.guild.id, "autojoin_enabled", false);
      await interaction.followUp({
        content: "ตัดการเชื่อมต่อจากห้องเสียงแล้ว ปิดอ่านข้อความอัตโนมัติ และปิด auto-join",
        flags: MessageFlags.Ephemeral,
      });
    } catch (e) {
      console.error("Failed to disconnect from voice:", e);
      await interaction.followUp({ content: `ไม่สามารถตัดการเชื่อมต่อได้: ${e}`, flags: MessageFlags.Ephemeral });
    }
  },
};
