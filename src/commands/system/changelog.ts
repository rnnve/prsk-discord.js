import {
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
  type AutocompleteInteraction,
  MessageFlags,
} from "discord.js";
import * as fs from "node:fs";
import * as path from "node:path";
import { EmbedBuilder } from "../../utils/embed-builder.js";

const PRIMARY = "#5865F2";
const CHANGELOG_DIR = path.resolve("changelogs");
const FILENAME_RE = /^changelog-(\d{4}-\d{2}-\d{2})-(\d{2}-\d{2})\.md$/i;

interface ChangelogEntry {
  dateStr: string;
  timeStr: string;
  filePath: string;
}

function parseChangelogs(): ChangelogEntry[] {
  const results: ChangelogEntry[] = [];
  if (!fs.existsSync(CHANGELOG_DIR)) return results;

  const files = fs.readdirSync(CHANGELOG_DIR)
    .filter((f) => f.startsWith("changelog-") && f.endsWith(".md"))
    .sort()
    .reverse();

  for (const file of files) {
    const m = FILENAME_RE.exec(file);
    if (m) {
      results.push({ dateStr: m[1], timeStr: m[2], filePath: path.join(CHANGELOG_DIR, file) });
    }
  }
  return results;
}

function readChangelog(filePath: string): string {
  try {
    return fs.readFileSync(filePath, "utf-8").trim();
  } catch {
    return "(ไม่สามารถอ่านไฟล์ได้)";
  }
}

function truncate(text: string, limit = 4000): string {
  if (text.length <= limit) return text;
  return text.slice(0, limit - 3) + "...";
}

export default {
  data: new SlashCommandBuilder()
    .setName("changelog")
    .setDescription("ดู changelog ล่าสุดหรือเลือกดูตามวันที่")
    .setDMPermission(true)
    .setContexts(0, 1, 2)
    .setIntegrationTypes(0, 1)
    .addStringOption((opt) =>
      opt
        .setName("select")
        .setDescription("เลือกวันที่ changelog (ถ้าไม่เลือกจะแสดงตัวล่าสุด)")
        .setRequired(false)
        .setAutocomplete(true)
    )
    .addBooleanOption((opt) =>
      opt
        .setName("ephemeral")
        .setDescription("ตอบกลับแบบส่วนตัว (default: false)")
        .setRequired(false)
    ),

  execute: async (interaction: ChatInputCommandInteraction) => {
    await interaction.deferReply({ flags: interaction.options.getBoolean("ephemeral") ? MessageFlags.Ephemeral : undefined });

    const changelogs = parseChangelogs();
    if (!changelogs.length) {
      const embed = EmbedBuilder.warning("Changelog", "ยังไม่มี changelog ในระบบ");
      embed.setFooter({ text: `Requested by ${interaction.user.displayName}` });
      await interaction.followUp({ embeds: [embed.toJSON()], flags: MessageFlags.Ephemeral });
      return;
    }

    const select = interaction.options.getString("select");
    let target: ChangelogEntry | null = null;

    if (select) {
      for (const entry of changelogs) {
        if (`${entry.dateStr}-${entry.timeStr}`.includes(select) || entry.dateStr.includes(select)) {
          target = entry;
          break;
        }
      }
      if (!target) {
        const embed = EmbedBuilder.error("Changelog", `ไม่พบ changelog สำหรับ \`${select}\``);
        embed.setFooter({ text: `Requested by ${interaction.user.displayName}` });
        await interaction.followUp({ embeds: [embed.toJSON()], flags: MessageFlags.Ephemeral });
        return;
      }
    } else {
      target = changelogs[0];
    }

    const content = readChangelog(target.filePath);
    const displayDate = `${target.dateStr} ${target.timeStr}`;

    const embed = EmbedBuilder.hex(PRIMARY, `📋 Changelog — ${displayDate}`, truncate(content));
    embed.setFooter({ text: `ไฟล์: ${path.basename(target.filePath)} • Requested by ${interaction.user.displayName}` });

    await interaction.followUp({ embeds: [embed.toJSON()], flags: interaction.options.getBoolean("ephemeral") ? MessageFlags.Ephemeral : undefined });
  },

  autocomplete: async (interaction: AutocompleteInteraction) => {
    const current = interaction.options.getString("select") ?? "";
    const changelogs = parseChangelogs();
    const choices = changelogs
      .map((e) => ({ name: `${e.dateStr} ${e.timeStr}`, value: `${e.dateStr} ${e.timeStr}` }))
      .filter((c) => !current || c.name.toLowerCase().includes(current.toLowerCase()))
      .slice(0, 25);

    await interaction.respond(choices);
  },
};
