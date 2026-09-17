import { SlashCommandBuilder, type ChatInputCommandInteraction, MessageFlags } from "discord.js";

export default {
  data: new SlashCommandBuilder()
    .setName("invite")
    .setDescription("รับลิงก์เชิญบอทเข้าเซิร์ฟเวอร์")
    .setDMPermission(true)
    .setContexts(0, 1, 2)
    .setIntegrationTypes(0, 1),

  execute: async (interaction: ChatInputCommandInteraction) => {
    const link = process.env.DISCORD_BOT_OA2_LINK ?? "";
    if (!link) {
      await interaction.reply({
        content: "ไม่พบลิงก์เชิญบอทในระบบ โปรดแจ้งผู้ดูแล",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    await interaction.reply({
      content: `ลิงก์เชิญบอท: ${link}`,
      flags: MessageFlags.Ephemeral,
    });
  },
};
