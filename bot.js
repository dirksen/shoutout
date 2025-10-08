// bot.js (ESM)
import {
  Client,
  GatewayIntentBits,
  PermissionFlagsBits,
  REST,
  Routes,
  SlashCommandBuilder,
} from "discord.js";
import dotenv from "dotenv";
import { AwardManager } from "./awards.js";

dotenv.config();

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers], // need members for nickname edits
});

let awards;

// Register slash commands
const commands = [
  new SlashCommandBuilder()
    .setName("shoutout")
    .setDescription("Give an award to a user")
    .addUserOption((opt) =>
      opt
        .setName("to_whom")
        .setDescription("Who gets the award")
        .setRequired(true),
    )
    .addStringOption((opt) =>
      opt.setName("for").setDescription("For being/doing...").setRequired(true),
    )
    .addIntegerOption((opt) =>
      opt
        .setName("award_count")
        .setDescription("Number of awards")
        .setRequired(true),
    ),
  new SlashCommandBuilder()
    .setName("redeem")
    .setDescription("Redeem awards from a user (Channel Manager only)")
    .addUserOption((opt) =>
      opt
        .setName("for_whom")
        .setDescription("The person to redeem from")
        .setRequired(true),
    )
    .addIntegerOption((opt) =>
      opt
        .setName("amount")
        .setDescription("Amount to deduct")
        .setRequired(true),
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),
  new SlashCommandBuilder()
    .setName("ping")
    .setDescription("Check if the bot is responsive"),
].map((cmd) => cmd.toJSON());

const rest = new REST({ version: "10" }).setToken(process.env.DISCORD_TOKEN);

(async () => {
  try {
    console.log("Registering slash commands...");
    await rest.put(Routes.applicationCommands(process.env.CLIENT_ID), {
      body: commands,
    });
    console.log("✅ Slash commands registered");
  } catch (error) {
    console.error(error);
  }
})();

client.on("ready", async () => {
  console.log(`🤖 Logged in as ${client.user.tag}`);
  console.log("GUILD ID:", process.env.GUILD_ID);
  const guild = await client.guilds.fetch(process.env.GUILD_ID);
  awards = new AwardManager(guild);
});

// Handle shoutout command
async function handleShoutout(interaction) {
  const recipient = interaction.options.getUser("to_whom");
  const count = interaction.options.getInteger("award_count");
  const reason = interaction.options.getString("for");

  try {
    await awards.updateAwards(recipient.id, count, interaction.user.id);
    await interaction.reply(
      `${interaction.user} gave ${"🏆".repeat(count)} to ${recipient} for: ${reason}`,
    );
  } catch (err) {
    await interaction.reply({ content: `⚠️ ${err.message}`, ephemeral: true });
  }
}

// Handle redeem command
async function handleRedeem(interaction) {
  const recipient = interaction.options.getUser("for_whom");
  const amount = interaction.options.getInteger("amount");

  if (recipient.id === interaction.user.id) {
    await interaction.reply({
      content: "You cannot award yourself.",
      ephemeral: true,
    });
  } else {
    try {
      await awards.updateAwards(recipient.id, -amount, interaction.user.id);
      await interaction.reply(
        `${interaction.user} redeemed 🏆x${amount} from ${recipient}`,
      );
    } catch (err) {
      await interaction.reply({
        content: `⚠️ ${err.message}`,
        ephemeral: true,
      });
    }
  }
}

async function handlePing(interaction) {
  await interaction.reply({ content: "Pong!", ephemeral: true });
}

client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === "shoutout") {
    await handleShoutout(interaction);
  } else if (interaction.commandName === "redeem") {
    await handleRedeem(interaction);
  } else if (interaction.commandName === "ping") {
    await handlePing(interaction);
  }
});

client.rest.on("rateLimited", (info) => {
  console.log("Rate limited:", info);
});

// Graceful shutdown
async function shutdown() {
  console.log("Shutting down, processing remaining queue...");
  if (awards) await awards.whenIdle();
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

client.login(process.env.DISCORD_TOKEN);
