import * as fs from "node:fs";
import * as path from "node:path";
import { type ChatInputCommandInteraction, MessageFlags } from "discord.js";

const ALLOWLIST_PATH = path.resolve("allowlist.txt");

interface AllowlistEntry {
  guildId: string;
  userId: string;
}

function parseAllowlist(): AllowlistEntry[] {
  const entries: AllowlistEntry[] = [];
  let content: string;
  try {
    content = fs.readFileSync(ALLOWLIST_PATH, "utf-8");
  } catch {
    return entries;
  }
  for (const raw of content.split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith("//")) continue;
    const colonIdx = line.indexOf(":");
    if (colonIdx === -1) continue;
    const guildId = line.slice(0, colonIdx).trim();
    const rest = line.slice(colonIdx + 1).trim();
    const commaIdx = rest.indexOf(",");
    if (commaIdx === -1) continue;
    const userId = rest.slice(0, commaIdx).trim();
    entries.push({ guildId, userId });
  }
  return entries;
}

export function isUserAdmin(userId: string, guildId: string): boolean {
  if (process.env.BOT_CREATOR === userId) return true;
  return parseAllowlist().some((e) => e.guildId === guildId && e.userId === userId);
}

export function addToAllowlist(guildId: string, userId: string, username: string): boolean {
  const entries = parseAllowlist();
  if (entries.some((e) => e.guildId === guildId && e.userId === userId)) return false;
  fs.appendFileSync(ALLOWLIST_PATH, `${guildId}: ${userId}, ${username}\n`, "utf-8");
  return true;
}

export async function adminCheck(interaction: ChatInputCommandInteraction): Promise<boolean> {
  if (!interaction.guildId) {
    await interaction.reply({ content: "This command can only be used in a server.", flags: MessageFlags.Ephemeral });
    return false;
  }
  if (!isUserAdmin(interaction.user.id, interaction.guildId)) {
    await interaction.reply({ content: "You do not have permission to use this command.", flags: MessageFlags.Ephemeral });
    return false;
  }
  return true;
}
