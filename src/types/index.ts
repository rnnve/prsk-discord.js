import { SlashCommandBuilder } from "discord.js";
import type { ChatInputCommandInteraction, AutocompleteInteraction } from "discord.js";

export interface Command {
  data: SlashCommandBuilder;
  execute: (interaction: ChatInputCommandInteraction) => Promise<void>;
  autocomplete?: (interaction: AutocompleteInteraction) => Promise<void>;
}

export interface GuildConfig {
  auto_read_channel_id: string | null;
  auto_read_enabled: boolean;
  autojoin_enabled: boolean;
}

export const DEFAULT_GUILD_CONFIG: GuildConfig = {
  auto_read_channel_id: null,
  auto_read_enabled: false,
  autojoin_enabled: false,
};
