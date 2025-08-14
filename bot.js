import { Client, GatewayIntentBits, PermissionsBitField, REST, Routes, SlashCommandBuilder } from 'discord.js';
import dotenv from 'dotenv';
import { enqueue, processQueue, parseAwards, serializeAwards, updateAwards } from './awards.js';

dotenv.config();

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages] });

// Register slash commands
const commands = [
  new SlashCommandBuilder()
    .setName('shoutout')
    .setDescription('Give an award to a user')
    .addUserOption(opt => opt.setName('to_whom').setDescription('who').setRequired(true))
    .addStringOption(opt => opt.setName('for').setDescription('for being/doing...').setRequired(true))
    .addIntegerOption(opt => opt.setName('award_count').setDescription('number of awards').setRequired(true)),
  new SlashCommandBuilder()
    .setName('redeem')
    .setDescription('Redeem awards from a user (Channel Manager only)')
    .addUserOption(opt => opt.setName('for_whom').setDescription('The person to redeem the awards').setRequired(true))
    .addIntegerOption(opt => opt.setName('amount').setDescription('Amount to deduct').setRequired(true))
].map(cmd => cmd.toJSON());

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

(async () => {
  try {
    console.log('Registering slash commands...');
    await rest.put(Routes.applicationCommands(process.env.CLIENT_ID), { body: commands });
    console.log('✅ Slash commands registered');
  } catch (error) {
    console.error(error);
  }
})();

client.on('ready', () => {
  console.log(`Logged in as ${client.user.tag}`);
});

// Handle shoutout command
async function handleShoutoutCommand(interaction) {
  const recipient = interaction.options.getUser('to_whom');
  const count = interaction.options.getInteger('award_count');
  const reason = interaction.options.getString('for');
  const channel = interaction.channel;

  if (recipient.id === interaction.user.id) {
    await interaction.reply({ content: 'You cannot give awards to yourself.', ephemeral: true });
    return;
  }

  enqueue(async () => {
    await updateAwards(channel, recipient.id, count);
    await interaction.reply(`${interaction.user} gave ${Array(count).fill("🏆").join('')} to ${recipient} for: ${reason}`);
  });
}

// Handle redeem command
async function handleRedeemCommand(interaction) {
  if (!interaction.member.permissions.has(PermissionsBitField.Flags.ManageChannels)) {
    await interaction.reply({ content: 'You do not have permission to use this command.', ephemeral: true });
    return;
  }

  const recipient = interaction.options.getUser('for_whom');
  const amount = interaction.options.getInteger('amount');
  const channel = interaction.channel;

  enqueue(async () => {
    try {
      await updateAwards(channel, recipient.id, -amount);
      await interaction.reply(`${interaction.user} redeemed ${amount}🏆 from ${recipient}`);
    } catch (err) {
      if (err.message === 'NegativeAwardError') {
        await interaction.reply({ content: `❌ Cannot redeem more than ${recipient} currently has.`, ephemeral: true });
      } else {
        console.error(err);
        await interaction.reply({ content: 'An error occurred.', ephemeral: true });
      }
    }
  });
}

client.on('interactionCreate', async interaction => {
  if (!interaction.isCommand()) return;

  const { commandName } = interaction;

  if (commandName === 'shoutout') {
    await handleShoutoutCommand(interaction);
  } else if (commandName === 'redeem') {
    await handleRedeemCommand(interaction);
  }
});

// Graceful shutdown
async function shutdown() {
  console.log('Shutting down, processing remaining queue...');
  await processQueue(); // Ensures all queued jobs are done
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

client.login(process.env.DISCORD_TOKEN);
