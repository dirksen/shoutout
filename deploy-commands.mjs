import { REST, Routes } from 'discord.js';
import 'dotenv/config';
import { data as searchCommand } from './commands.js';

const commands = [searchCommand.toJSON()];

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

try {
  console.log('Registering slash commands...');
  await rest.put(
    Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
    { body: commands }
  );
  console.log('✓ Slash commands registered!');
} catch (error) {
  console.error(error);
}
