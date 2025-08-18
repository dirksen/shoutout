// bot.js (ESM)
import { Client, GatewayIntentBits, PermissionFlagsBits, REST, Routes, SlashCommandBuilder } from 'discord.js';
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
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
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
export async function handleShoutout(interaction) {
  const recipient = interaction.options.getUser('to_whom');
  const count = interaction.options.getInteger('award_count');
  const reason = interaction.options.getString('for');
  const channel = interaction.channel;

  if (recipient.id === interaction.user.id) {
    await interaction.reply({ content: 'You cannot give awards to yourself.', ephemeral: true });
    return;
  }

  await enqueue(async () => {
    await interaction.reply(`${interaction.user} gave ${Array(count).fill("🏆").join('')} to ${recipient} for: ${reason}`);
    await updateAwards(channel, recipient.id, count);
  });
}

// Handle redeem command
export async function handleRedeem(interaction) {
  const recipient = interaction.options.getUser('for_whom');
  const amount = interaction.options.getInteger('amount');
  const channel = interaction.channel;

  if (amount === 0) {
    await interaction.reply({ content: 'Amount must be non-zero.', ephemeral: true });
    return;
  }

  await enqueue(async () => {
    try {
      await interaction.deferReply();
      await updateAwards(channel, recipient.id, -amount);
      await interaction.editReply(`${interaction.user} redeemed 🏆x${amount} from ${recipient}`);
    } catch (err) {
      if (err.message === 'NegativeAwardError') {
        await interaction.editReply({ content: `❌ Cannot redeem more than ${recipient} currently has.`, ephemeral: true });
      } else {
        console.error(err);
        await interaction.editReply({ content: 'An error occurred.', ephemeral: true });
      }
    }
  });
}

client.on('interactionCreate', async interaction => {
  if (!interaction.isCommand()) return;

  const { commandName } = interaction;

  if (commandName === 'shoutout') {
    await handleShoutout(interaction);
  } else if (commandName === 'redeem') {
    await handleRedeem(interaction);
  }
});

client.rest.on('rateLimited', (info) => {
  console.log('Rate limited:', info);
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
