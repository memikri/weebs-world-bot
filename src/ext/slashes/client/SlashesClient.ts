import { Awaited, Client, ClientEvents, ClientOptions, Collection, Interaction, Snowflake } from 'discord.js';
import { SlashCommand, SlashCommandConstructor } from '../commands/SlashCommand';
import { SlashCommandInteraction } from '../commands/SlashCommandInteraction';
import { Imported, Utils } from '../Utils';
import { Constants } from '../Constants';

export interface SlashesClientOptions extends ClientOptions {
  reportErrors?: boolean;
  syncCommands?: boolean;
  guildId?: Snowflake;
}

export interface SlashesClientEvents extends ClientEvents {
  'slashes-applicationCommandsSynced': [count: number];
  'slashes-slashCommandInteraction': [interaction: SlashCommandInteraction];
  'slashes-debug': [message: string];
}

export class SlashesClient<Ready extends boolean = boolean> extends Client<Ready> {
  public options!: SlashesClientOptions;
  public commands: Collection<string, SlashCommand>;

  constructor(options: SlashesClientOptions) {
    super(options);
    this.commands = new Collection();

    super.on('interactionCreate', this.#onInteractionCreate.bind(this));
  }

  async #onInteractionCreate(interaction: Interaction): Promise<void> {
    if (interaction.isCommand()) {
      const slashCommandInteraction = new SlashCommandInteraction(this as SlashesClient<true>, interaction);
      await slashCommandInteraction.hydrate();
      this.emit('slashes-slashCommandInteraction', slashCommandInteraction);
      const command = this.commands.get(interaction.commandName);
      if (command) {
        // Process checks
        if (interaction.member) {
          const actualPermissions = Utils.resolvePermissions(interaction.member.permissions);
          if (!actualPermissions.has(command.permissions)) {
            await slashCommandInteraction.send({
              ephemeral: true,
              content: 'You do not have permission to use this command.',
            });
            return;
          }
        }
        const checkResult = await command.check(slashCommandInteraction);

        if (checkResult !== true) {
          await slashCommandInteraction.send({
            ephemeral: true,
            content: typeof checkResult === 'string' ? checkResult : 'This command could not be run.',
          });
          return;
        }
        try {
          await command.run(slashCommandInteraction);
        } catch (err) {
          if (this.options.reportErrors) {
            console.error(err); // TODO
            await interaction.followUp({
              ephemeral: true,
              content: `An error occurred while running this command:\`\`\`\n${err}\n\`\`\``,
            });
          } else {
            throw err;
          }
        }
        this.emit(
          'slashes-debug',
          `Ran command ${interaction.commandName} with options ${JSON.stringify(interaction.options.data)}`
        );
      } else {
        // TODO: better error handling
        this.emit('error', new Error(`Unhandled slash command: '${interaction.commandName}'`));
      }
    }
  }

  public registerCommand(command: SlashCommand | Imported<SlashCommandConstructor>): this {
    command = Utils.resolveImport(command);
    if (typeof command === 'function') {
      command = new command(this);
    }
    if (this.commands.has(command.data.name)) {
      // TODO: better error handling
      this.emit('error', new Error(`Command ${command.data.name} is already registered.`));
      return this;
    }
    this.commands.set(command.data.name, command);
    this.emit('slashes-debug', `Registered command ${command.data.name}`);
    return this;
  }

  // Syncs application-level commands, not guild commands.
  public async syncApplicationCommands(): Promise<void> {
    if (!this.isReady()) {
      throw new Error('Client is not ready');
    }

    const registered = [...(await this.application.commands.fetch()).values()];
    const loaded = [...this.commands.filter((cmd) => !cmd.guildId).values()];

    const toDelete = registered.filter((command) => loaded.every((reg) => !Utils.compareCommands(reg.data, command)));
    const toCreate = loaded.filter((ld) => !registered.some((rd) => Utils.compareCommands(ld.data, rd)));

    const queue: Promise<unknown>[] = [];
    if (registered.length > 0 && toDelete.length + toCreate.length < Constants.APPLICATION_COMMAND_MERGE_LIMIT) {
      queue.push(
        ...toDelete.map((command) =>
          command.delete().then(() => this.emit('slashes-debug', `Deleted application command ${command.name}`))
        )
      );
      queue.push(
        ...toCreate.map((command) =>
          this.application!.commands.create(command.data).then(() =>
            this.emit('slashes-debug', `Created application command ${command.data.name}`)
          )
        )
      );
    } else {
      queue.push(this.application.commands.set(toCreate.map((command) => command.data)));
    }
    await Promise.all(queue);
  }

  public async syncGuildCommands(guildIds?: Snowflake[]): Promise<void> {
    if (!this.isReady()) {
      throw new Error('Client is not ready');
    }
    if (!guildIds) {
      guildIds = [...new Set(this.commands.map((command) => command.guildId).filter((id) => id))] as string[];
    }
    const guilds = await Promise.all(guildIds.map((guildId) => this.guilds.fetch(guildId as string)));
    const loaded = [
      ...this.commands.filter((cmd) => !!cmd.guildId && guilds.some((guild) => guild.id === cmd.guildId)).values(),
    ];

    const queue: Promise<unknown>[] = [];

    for (const guild of guilds) {
      const guildCommands = loaded.filter((command) => command.guildId === guild.id);

      // Don't bother with merge; just update.

      queue.push(
        guild.commands
          .set(guildCommands.map((cmd) => cmd.data))
          .then(() =>
            this.emit('slashes-debug', `Synced ${Utils.plural(guildCommands.length, 'command')} in guild ${guild.id}`)
          )
      );
    }

    await Promise.all(queue);
  }

  public async syncCommands(): Promise<void> {
    if (this.options.guildId) {
      this.emit('slashes-debug', 'Mutating registered command guildId properties because guildId is set');
      for (const command of this.commands.values()) {
        command.guildId = this.options.guildId;
      }
    }
    await Promise.all([this.syncApplicationCommands(), this.syncGuildCommands()]);
  }

  public override async login(token?: string): Promise<string> {
    const result = await super.login(token);

    if (!this.isReady()) {
      await new Promise<void>((resolve, reject) => {
        let onReady: () => void;
        let onError: (err: Error) => void;

        onReady = () => {
          this.off('error', onError);
          resolve();
        };
        onError = (err) => {
          this.off('ready', onReady);
          reject(err);
        };

        this.once('error', onError);
        this.once('ready', onReady);
      });
    }

    if (this.options.syncCommands) {
      await this.syncCommands();
    }

    return result;
  }

  //#region EventEmitter overrides
  public on<K extends keyof SlashesClientEvents>(
    event: K,
    listener: (...args: SlashesClientEvents[K]) => Awaited<void>
  ): this;
  public on<S extends string | symbol>(
    event: Exclude<S, keyof SlashesClientEvents>,
    listener: (...args: any[]) => Awaited<void>
  ): this {
    return super.on(event as string, listener);
  }

  public once<K extends keyof SlashesClientEvents>(
    event: K,
    listener: (...args: SlashesClientEvents[K]) => Awaited<void>
  ): this;
  public once<S extends string | symbol>(
    event: Exclude<S, keyof SlashesClientEvents>,
    listener: (...args: any[]) => Awaited<void>
  ): this {
    return super.once(event as string, listener);
  }

  public emit<K extends keyof SlashesClientEvents>(event: K, ...args: SlashesClientEvents[K]): boolean;
  public emit<S extends string | symbol>(event: Exclude<S, keyof SlashesClientEvents>, ...args: unknown[]): boolean {
    return super.emit(event as string, ...args);
  }

  public off<K extends keyof SlashesClientEvents>(
    event: K,
    listener: (...args: SlashesClientEvents[K]) => Awaited<void>
  ): this;
  public off<S extends string | symbol>(
    event: Exclude<S, keyof SlashesClientEvents>,
    listener: (...args: any[]) => Awaited<void>
  ): this {
    return super.off(event as string, listener);
  }

  public removeAllListeners<K extends keyof SlashesClientEvents>(event?: K): this;
  public removeAllListeners<S extends string | symbol>(event?: Exclude<S, keyof SlashesClientEvents>): this {
    return super.removeAllListeners(event as string);
  }
  //#endregion
}
