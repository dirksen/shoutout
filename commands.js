import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('search')
  .setDescription('Searches the current channel history for a keyword')
  .addUserOption(option =>
    option.setName('recipient')
      .setDescription('Someone you will shout out at')
      .setRequired(true)
  );

export async function execute(interaction) {
  const keyword = interaction.options.getUser('recipient'); //.toLowerCase();
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

      console.log('--------')
      for (const msg of messages.values()) {
        console.log(msg.author.username, msg.id, msg.content)
        // if (msg.content.toLowerCase().includes(keyword)) count++;
      }

      console.log(Array.from(messages.values()).at(1))

      lastMessageId = messages.last().id;
    }

    const behaviour = 'being hyper'
    await interaction.editReply(`Shout out **${keyword}** for "${behaviour}".`);
  } catch (error) {
    console.error(error);
    await interaction.editReply('There was an error while searching.');
  }
}
