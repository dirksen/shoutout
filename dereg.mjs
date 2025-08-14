import { REST, Routes } from 'discord.js';
import 'dotenv/config';

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;

(async () => {
  try {
    console.log('Fetching commands...');
    const commands = await rest.get(
      Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID)
    );

    for (const command of commands) {
      console.log(`Deleting guild command: ${command.name}`);
      await rest.delete(
        Routes.applicationGuildCommand(CLIENT_ID, GUILD_ID, command.id)
      );
    }

    console.log('✅ All guild commands deleted.');
  } catch (error) {
    console.error('Error deleting commands:', error);
  }
})();
