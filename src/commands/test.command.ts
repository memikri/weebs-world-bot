import { SlashCommand } from '../ext/slashes';
import { SlashesClient, SlashCommandInteraction } from '../ext/slashes';

export default class TestCommand extends SlashCommand {
  public constructor(client: SlashesClient) {
    super(client, {
      name: 'test',
      description: 'test',
    });
  }

  public async run(interaction: SlashCommandInteraction) {
    await interaction.noop();
  }
}
