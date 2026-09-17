import { SlashCommandBuilder, type ChatInputCommandInteraction, MessageFlags } from "discord.js";
import { EmbedBuilder } from "../../utils/embed-builder.js";
import { getGuild, setGuild } from "../../utils/guild-config.js";

export default {
  data: new SlashCommandBuilder()
    .setName("auto-join")
    .setDescription("เปิด/ปิดการเชื่อมต่อห้องเสียงอัตโนมัติหลังถูกตัด")
    .setDMPermission(false)
    .setContexts(0)
    .setIntegrationTypes(0)
    .addBooleanOption((opt) =>
      opt
        .setName("enabled")
        .setDescription("เปิดหรือปิด (ไม่ใส่ = สลับสถานะ)")
        .setRequired(false)
    ),

  execute: async (interaction: ChatInputCommandInteraction) => {
    if (!interaction.guild) {
      await interaction.reply({ content: "คำสั่งนี้ใช้ได้เฉพาะในเซิร์ฟเวอร์", flags: MessageFlags.Ephemeral });
      return;
    }

    const guildId = interaction.guild.id;
    const cfg = getGuild(guildId);
    const current = cfg.autojoin_enabled;

    const input = interaction.options.getBoolean("enabled");
    const newState = input !== null ? input : !current;

    setGuild(guildId, "autojoin_enabled", newState);

    const embed = EmbedBuilder.primary(
      "Auto-Join",
      newState
        ? "เปิดการเชื่อมต่อห้องเสียงอัตโนมัติหลังถูกตัดแล้ว"
        : "ปิดการเชื่อมต่อห้องเสียงอัตโนมัติหลังถูกตัดแล้ว"
    );

    embed.addInlineField("สถานะปัจจุบัน", newState ? "`เปิด`" : "`ปิด`");

    await interaction.reply({ embeds: [embed.toJSON()], flags: MessageFlags.Ephemeral });
  },
};
