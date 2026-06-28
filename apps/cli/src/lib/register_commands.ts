import { Argv, CommandModule } from 'yargs';

// Register command modules explicitly instead of yargs' `.commandDir()`, which
// scans the filesystem at runtime and therefore breaks inside a single-file
// (bun --compile) binary. Static `.command()` calls are bundler-visible.
//
// The modules are heterogeneous (each handler has its own args type), so they
// can't share one `CommandModule<T, U>` instantiation — hence the loose input.
export function registerCommands(
  yargs: Argv,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  modules: readonly any[]
): Argv {
  return modules.reduce((acc, mod) => acc.command(mod as CommandModule), yargs);
}
