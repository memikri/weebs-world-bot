import { ApplicationCommandData, Guild, PermissionResolvable, Permissions, Awaited } from 'discord.js';
import { SlashesClient } from '../client/SlashesClient';
import { Constructable, Utils } from '../Utils';
import { SlashCommandInteraction } from './SlashCommandInteraction';

export interface SlashCommandOptions extends ApplicationCommandData {
  guildId?: string | null;
  permissions?: PermissionResolvable;
}

export abstract class SlashCommand {
  public readonly data: ApplicationCommandData;
  public readonly guildId: string | null;
  public readonly permissions: bigint;

  #guild: Guild | null = null;

  constructor(public readonly client: SlashesClient, options: SlashCommandOptions) {
    this.data = Utils.omit(options, ['guildId']);
    this.guildId = options.guildId ?? null;
    this.permissions = Permissions.resolve(options.permissions ?? 0n);
  }

  // This can be overridden to check if the command should be run.
  public check(interaction: SlashCommandInteraction): Awaited<boolean | string> {
    void interaction;
    return true;
  }

  public abstract run(interaction: SlashCommandInteraction): Promise<void>;

  public get guild(): Guild | null {
    return this.#guild;
  }

  public async fetchGuild(): Promise<Guild | null> {
    if (this.guildId) {
      this.#guild = await this.client.guilds.fetch(this.guildId);
      return this.#guild;
    }
    return null;
  }
}

export type SlashCommandConstructor = Constructable<SlashCommand, [client: SlashesClient]>;
