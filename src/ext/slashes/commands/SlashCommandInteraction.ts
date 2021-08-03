// import { APIMessage } from 'discord-api-types';
import { CommandInteraction, InteractionReplyOptions, Message, MessagePayload, Snowflake } from 'discord.js';
import { SlashesClient } from '../client/SlashesClient';

export class SlashCommandInteraction {
  public readonly client: SlashesClient<true>;
  public readonly interaction: CommandInteraction;

  public constructor(client: SlashesClient<true>, interaction: CommandInteraction) {
    this.client = client;
    this.interaction = interaction;
  }

  public async hydrate(): Promise<void> {}

  public async send(options: string | MessagePayload | InteractionReplyOptions): Promise<void> {
    if (this.interaction.replied) {
      await this.interaction.followUp(options);
    } else if (this.interaction.deferred) {
      await this.interaction.editReply(options);
    } else {
      await this.interaction.reply(options);
    }
  }

  public async defer(): Promise<void> {
    if (this.interaction.replied || this.interaction.deferred) {
      return; // TODO: this should maybe be an error
    }
    await this.interaction.defer();
  }

  public async noop(): Promise<void> {
    if (this.interaction.replied || this.interaction.deferred) {
      throw new Error('Cannot noop a command interaction that has already been replied to or deferred.');
    }
    await this.interaction.defer();
    await this.interaction.deleteReply();
  }

  // TODO: add more methods
}
