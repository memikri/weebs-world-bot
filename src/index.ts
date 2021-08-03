import { Intents } from 'discord.js';
import dotenv from 'dotenv';
import glob from 'glob';
import path from 'path';

import { Imported, SlashesClient, SlashCommandConstructor } from './ext/slashes';

dotenv.config();

const client = new SlashesClient<true>({
  intents: [Intents.FLAGS.GUILDS, Intents.FLAGS.GUILD_MEMBERS],
  reportErrors: true,
  syncCommands: true,
});

client.on('slashes-debug', (message) => console.log('[slashes-debug]', message));

const commands = glob
  .sync(path.join(__dirname, 'commands', '*.command.js'))
  .map((file) => require(file) as Imported<SlashCommandConstructor>);

for (const Command of commands) client.registerCommand(Command);

void (async () => {
  await client.login(process.env.DISCORD_TOKEN);
  console.log(`Logged in as ${client.user.tag} with ${client.commands.size} commands.`);
})();
