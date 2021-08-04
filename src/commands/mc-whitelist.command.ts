import fs from 'fs';
import path from 'path';

import fetch from 'node-fetch';
import { Snowflake } from 'discord.js';
import { SlashCommand, SlashesClient, SlashCommandInteraction } from '../ext/slashes';

const WHITELIST_FILE = path.join(__dirname, '../../data/mc-whitelist.json');

interface WhitelistEntry {
  userId: Snowflake;
  username: string;
  uuid: string;
}

export default class MCWhitelistCommand extends SlashCommand {
  constructor(client: SlashesClient) {
    super(client, {
      name: 'mc-whitelist',
      description: 'Get whitelisted on the Minecraft server',
      options: [
        { name: 'username', type: 'STRING', description: 'Your Minecraft *Java Edition* username', required: true },
      ],
    });
  }

  async run(interaction: SlashCommandInteraction) {
    const username = interaction.interaction.options.getString('username', true);

    if (!fs.existsSync(WHITELIST_FILE)) {
      fs.writeFileSync(WHITELIST_FILE, JSON.stringify([]));
    }

    if (!/^[a-zA-Z0-9_]{1,16}$/.test(username)) {
      return await interaction.send({
        ephemeral: true,
        content:
          'Username must be between 1 and 16 characters long and only contain letters, numbers, and underscores.',
      });
    }

    const mcUser = await fetch(`https://api.mojang.com/users/profiles/minecraft/${username}`);
    if (mcUser.status !== 200) {
      return await interaction.send({
        ephemeral: true,
        content: 'Username not found.',
      });
    }

    const mcUserJson = (await mcUser.json()) as { name: string; id: string };

    const whitelist = JSON.parse(fs.readFileSync(WHITELIST_FILE, 'utf8')) as WhitelistEntry[];

    const found = whitelist.find(
      (entry) =>
        entry.username === mcUserJson.name ||
        entry.uuid === mcUserJson.id ||
        entry.userId === interaction.interaction.user.id
    );

    if (found) {
      return await interaction.send({
        ephemeral: true,
        content: `Already whitelisted.`,
      });
    }

    whitelist.push({
      userId: interaction.interaction.user.id,
      username: mcUserJson.name,
      uuid: mcUserJson.id,
    });
    fs.writeFileSync(WHITELIST_FILE, JSON.stringify(whitelist));

    return interaction.send({ content: `Whitelisted \`${mcUserJson.name}\` on the server!` });
  }
}
