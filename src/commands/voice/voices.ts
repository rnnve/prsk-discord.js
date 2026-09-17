import { SlashCommandBuilder, type ChatInputCommandInteraction, MessageFlags } from "discord.js";

const VOICE_LIST_URL = "https://speech.platform.bing.com/consumer/speech/synthesize/readaloud/voices/list?trustedclienttoken=6A5AA1D4EAFF4E9FB37E23D68491D6F4";

export default {
  data: new SlashCommandBuilder()
    .setName("voices")
    .setDescription("แสดงรายชื่อเสียง TTS ที่ใช้งานได้")
    .setDMPermission(true)
    .setContexts(0, 1, 2)
    .setIntegrationTypes(0, 1),

  execute: async (interaction: ChatInputCommandInteraction) => {
    try {
      const resp = await fetch(VOICE_LIST_URL);
      const voices: any[] = await resp.json();
      const lines = voices.map(
        (v: any) => `\`${v.ShortName}\` — ${v.Locale} (${v.Gender})`
      );
      const header = `**รายชื่อเสียงที่มีให้ใช้ (${voices.length} เสียง):**\n`;
      let text = lines.join("\n");
      const maxBody = 2000 - header.length - 3;
      if (text.length > maxBody) text = text.slice(0, maxBody) + "...";

      await interaction.reply({
        content: `${header}${text}`,
        flags: MessageFlags.Ephemeral,
      });
    } catch (e) {
      console.error("Voice list error:", e);
      await interaction.reply({
        content: `เกิดข้อผิดพลาด: ${e}`,
        flags: MessageFlags.Ephemeral,
      });
    }
  },
};
