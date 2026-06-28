/* eslint-disable no-console */
import chalk from 'chalk';
import { execSync } from 'child_process';
import { CommandFailedError } from '../git/runner';

export type TSplog = {
  newline: () => void;
  info: (msg: string) => void;
  debug: (msg: string) => void;
  error: (msg: string) => void;
  warn: (msg: string) => void;
  message: (msg: string) => void;
  tip: (msg: string) => void;
  page: (msg: string) => void;
};

export function composeSplog(
  opts: {
    quiet?: boolean;
    outputDebugLogs?: boolean;
    tips?: boolean;
    pager?: string;
  } = {}
): TSplog {
  return {
    newline: opts.quiet ? () => void 0 : () => console.log(),
    info: opts.quiet ? () => void 0 : (s: string) => console.log(s),
    debug: opts.outputDebugLogs
      ? (s: string) =>
          console.log(
            chalk.dim(`${chalk.bold(`${new Date().toISOString()}:`)} ${s}`)
          )
      : () => void 0,
    error: (s: string) => console.log(chalk.redBright(`ERROR: ${s}`)),
    warn: (s: string) => console.log(chalk.yellow(`WARNING: ${s}`)),
    message: (s: string) => console.log(chalk.yellow(`${chalk.yellow(s)}\n\n`)),
    tip: (s: string) =>
      opts.tips && !opts.quiet
        ? console.log(
            chalk.gray(
              [
                '',
                `${chalk.bold('tip')}: ${s}`,
                chalk.italic('Feeling expert? `ch user tips --disable`'),
                '',
              ].join('\n')
            )
          )
        : () => void 0,
    page: (s: string) => {
      if (!opts.pager) {
        console.log(s);
        return;
      }
      try {
        execSync(`${opts.pager}`, {
          input: s,
          stdio: ['pipe', 'inherit', 'inherit'],
          encoding: 'utf-8',
          // match what git does for pager env vars
          // https://github.com/git/git/blob/master/Documentation/config/core.txt#L550
          env: { LESS: 'FRX', LV: '-c', ...process.env },
        });
      } catch (e) {
        if (e.status !== 0 || e.code !== 'EPIPE') {
          console.log(s);
          console.log(
            chalk.yellow(
              `NOTE: Tried to send output to your pager (${chalk.cyan(
                opts.pager
              )}) but encountered an error.\nYou can change your configured pager or disable paging: ${chalk.cyan(
                `ch user pager --help`
              )}`
            )
          );
          throw new CommandFailedError({
            command: opts.pager,
            ...e,
          });
        }
      }
    },
  };
}
