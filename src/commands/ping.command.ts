import { performance } from 'perf_hooks';
import { SlashCommand } from '../ext/slashes';
import { SlashesClient, SlashCommandInteraction } from '../ext/slashes';

export default class PingCommand extends SlashCommand {
  public constructor(client: SlashesClient) {
    super(client, {
      name: 'ping',
      description: 'pong',
    });
  }

  public async run(interaction: SlashCommandInteraction) {
    const start = performance.now();
    await interaction.defer();
    const end = performance.now();
    const duration = end - start;
    await interaction.send(`Pong! ${duration.toFixed(2)}ms`);
  }
}
