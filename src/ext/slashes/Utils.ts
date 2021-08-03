import { ApplicationCommandData, ApplicationCommandOptionData } from 'discord.js';

export type Constructable<T, A extends unknown[] = []> = new (...args: A) => T;
export type Imported<T> = T | { default: T };

export class Utils extends null {
  private constructor() {}

  public static pick<T, K extends keyof T>(source: T, keys: K[]): Pick<T, K> {
    const result: Partial<Pick<T, K>> = {};
    for (const key of keys) result[key] = source[key];
    return result as Pick<T, K>;
  }

  public static omit<T, K extends keyof T>(source: T, keys: K[]): Omit<T, K> {
    const result = Object.assign({}, source);
    for (const key of keys) delete result[key];
    return result as Omit<T, K>;
  }

  public static compareCommands(a: ApplicationCommandData | undefined, b: ApplicationCommandData | undefined): boolean {
    function compareOptions(
      a: ApplicationCommandOptionData[] | undefined,
      b: ApplicationCommandOptionData[] | undefined
    ) {
      debugger;
      if (!a && !b) return true;
      if (!a || !b) return false;
      if (a.length !== b.length) return false;
      for (let i = 0; i < a.length; i++) {
        for (const key of ['name', 'description', 'required', 'type'] as (keyof ApplicationCommandOptionData)[])
          if (a[i][key] !== b[i][key]) return false;
        if (!compareOptions(a[i].options, b[i].options)) return false;
      }
      return true;
    }
    debugger;
    return !!(
      a === b ||
      (a &&
        b &&
        a.name === b.name &&
        a.description === b.description &&
        (a.defaultPermission ?? true) === (b.defaultPermission ?? true) &&
        compareOptions(a.options ?? [], b.options ?? []))
    );
  }

  public static resolveImport<T>(imported: Imported<T>): T {
    if ('default' in imported) return imported.default;
    return imported;
  }
}