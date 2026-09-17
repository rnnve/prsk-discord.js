import {
  Events,
  type Client,
  type Interaction,
  type AutocompleteInteraction,
  type InteractionReplyOptions,
  MessageFlags,
} from "discord.js";

export default {
  name: Events.InteractionCreate,
  execute: async (_client: Client, interaction: Interaction) => {
    if (interaction.isAutocomplete()) {
      const cmd = _client.commands.get(interaction.commandName);
      if (cmd?.autocomplete) {
        try {
          await cmd.autocomplete(interaction as AutocompleteInteraction);
        } catch (error) {
          console.error(`Autocomplete error for /${interaction.commandName}:`, error);
        }
      }
      return;
    }

    if (!interaction.isChatInputCommand()) return;

    const cmd = _client.commands.get(interaction.commandName);
    if (!cmd) {
      console.error(`No command matching /${interaction.commandName} was found.`);
      return;
    }

    try {
      await cmd.execute(interaction);
    } catch (error) {
      console.error(`Error executing /${interaction.commandName}:`, error);
      const reply: InteractionReplyOptions = {
        content: "เกิดข้อผิดพลาดในการทำงานของคำสั่งนี้",
        flags: MessageFlags.Ephemeral,
      };
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp(reply).catch(() => {});
      } else {
        await interaction.reply(reply).catch(() => {});
      }
    }
  },
};
