import { SlashCommandBuilder, type ChatInputCommandInteraction } from "discord.js";
import { EmbedBuilder } from "../../utils/embed-builder.js";
import { startTime } from "../../index.js";

const PRIMARY = "#5865F2";
const MACHINE_IP = process.env.MACHINE_IP ?? "127.0.0.1";
const API_PORT = 6770;
const STATUS_OK = "\u{1F7E2}";
const STATUS_FAIL = "\u{1F534}";

function formatUptime(): string {
  const delta = Math.floor((Date.now() - startTime) / 1000);
  const days = Math.floor(delta / 86400);
  const hours = Math.floor((delta % 86400) / 3600);
  const minutes = Math.floor((delta % 3600) / 60);
  const seconds = delta % 60;
  const parts: string[] = [];
  if (days) parts.push(`${days}d`);
  if (hours) parts.push(`${hours}h`);
  if (minutes) parts.push(`${minutes}m`);
  parts.push(`${seconds}s`);
  return parts.join(" ");
}

async function checkUrl(url: string, timeout = 5000): Promise<{ ok: boolean; latency: number }> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    const start = performance.now();
    const resp = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);
    const latency = performance.now() - start;
    return { ok: resp.status < 500, latency: Math.round(latency * 10) / 10 };
  } catch {
    return { ok: false, latency: 0 };
  }
}

export default {
  data: new SlashCommandBuilder()
    .setName("status")
    .setDescription("แสดงสถานะระบบของบอท")
    .setDMPermission(true)
    .setContexts(0, 1, 2)
    .setIntegrationTypes(0, 1),

  execute: async (interaction: ChatInputCommandInteraction) => {
    await interaction.deferReply();

    const botLatency = interaction.client.ws.ping;
    const discordOk = interaction.client.isReady();

    const apiUrl = `http://${MACHINE_IP}:${API_PORT}`;

    const apiCheck = await checkUrl(apiUrl);

    const apiIcon = apiCheck.ok ? STATUS_OK : STATUS_FAIL;
    const dcIcon = discordOk ? STATUS_OK : STATUS_FAIL;

    const embed = EmbedBuilder.hex(PRIMARY, "System Status");

    embed.addInlineField(
      "API",
      `${apiIcon} \`UP\`\nLatency: \`${apiCheck.latency}ms\``,
      false
    );

    embed.addInlineField(
      "Discord API",
      `${dcIcon} \`Connected\`\nLatency: \`${botLatency}ms\``,
      false
    );

    embed.addInlineField(
      "Bot",
      `Uptime: \`${formatUptime()}\`\nPing: \`${botLatency}ms\``,
      false
    );

    embed.setFooter({ text: `Requested by ${interaction.user.displayName}` });

    await interaction.followUp({ embeds: [embed.toJSON()] });
  },
};
