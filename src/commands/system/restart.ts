import { SlashCommandBuilder, type ChatInputCommandInteraction } from "discord.js";
import { EmbedBuilder } from "../../utils/embed-builder.js";
import { requestRestart } from "../../index.js";

export default {
  data: new SlashCommandBuilder()
    .setName("restart")
    .setDescription("รีสตาร์ทบอท (owner only)")
    .setDMPermission(true)
    .setContexts(0, 1, 2)
    .setIntegrationTypes(0, 1),

  execute: async (interaction: ChatInputCommandInteraction) => {
    const ownerId = process.env.BOT_CREATOR;
    if (interaction.user.id !== ownerId) {
      const embed = EmbedBuilder.error("Restart", "คุณไม่มีสิทธิ์ใช้คำสั่งนี้");
      embed.setFooter({ text: `Requested by ${interaction.user.displayName}` });
      await interaction.reply({ embeds: [embed.toJSON()] });
      return;
    }

    const embed = EmbedBuilder.success("Restart", "กำลังรีสตาร์ทบอท...");
    embed.setFooter({ text: `Requested by ${interaction.user.displayName}` });
    await interaction.reply({ embeds: [embed.toJSON()] });

    requestRestart();
    interaction.client.destroy();
  },
};
