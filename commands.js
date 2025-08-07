import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('search')
  .setDescription('Searches the current channel history for a keyword')
  .addStringOption(option =>
    option.setName('keyword')
      .setDescription('Keyword to search for')
      .setRequired(true)
  );

export async function execute(interaction) {
  const keyword = interaction.options.getString('keyword').toLowerCase();
  let count = 0;
  let lastMessageId;
  let batchSize = 100;

  await interaction.deferReply(); // Allow time to scan messages

  try {
    while (true) {
      const options = { limit: batchSize };
      if (lastMessageId) options.before = lastMessageId;

      const messages = await interaction.channel.messages.fetch(options);
      if (messages.size === 0) break;

      for (const msg of messages.values()) {
        if (msg.content.toLowerCase().includes(keyword)) count++;
      }

      lastMessageId = messages.last().id;
    }

    await interaction.editReply(`Found **${count}** messages containing "${keyword}".`);
  } catch (error) {
    console.error(error);
    await interaction.editReply('There was an error while searching.');
  }
}