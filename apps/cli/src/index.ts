#!/usr/bin/env node
/* eslint-disable no-console */

import chalk from 'chalk';
import tmp from 'tmp';
import yargs, { CommandModule } from 'yargs';
import { globalArgumentsOptions } from './lib/global_arguments';
import { getYargsInput } from './lib/pre-yargs/preprocess_command';
import { registerCommands } from './lib/register_commands';
import { registerCompletion } from './commands/completion';

import * as auth from './commands/auth';
import * as bottom from './commands/bottom';
import * as checkout from './commands/checkout';
import * as continueCmd from './commands/continue';
import * as create from './commands/create';
import * as deleteCmd from './commands/delete';
import * as demo from './commands/demo';
import * as dev from './commands/dev';
import * as down from './commands/down';
import * as edit from './commands/edit';
import * as feedback from './commands/feedback';
import * as fish from './commands/fish';
import * as fold from './commands/fold';
import * as get from './commands/get';
import * as info from './commands/info';
import * as init from './commands/init';
import * as ll from './commands/ll';
import * as log from './commands/log';
import * as ls from './commands/ls';
import * as modify from './commands/modify';
import * as move from './commands/move';
import * as pop from './commands/pop';
import * as rename from './commands/rename';
import * as reorder from './commands/reorder';
import * as repo from './commands/repo';
import * as restack from './commands/restack';
import * as split from './commands/split';
import * as squash from './commands/squash';
import * as submit from './commands/submit';
import * as sync from './commands/sync';
import * as test from './commands/test';
import * as top from './commands/top';
import * as track from './commands/track';
import * as untrack from './commands/untrack';
import * as up from './commands/up';
import * as user from './commands/user';

// this line gets rid of warnings about "experimental fetch API" for our users
// while still showing us warnings when we test with DEBUG=1
if (!process.env.DEBUG) {
  process.removeAllListeners('warning');
}

// https://www.npmjs.com/package/tmp#graceful-cleanup
tmp.setGracefulCleanup();

process.on('uncaughtException', (err) => {
  console.log(chalk.redBright(`UNCAUGHT EXCEPTION: ${err.message}`));
  console.log(chalk.redBright(`UNCAUGHT EXCEPTION: ${err.stack}`));
  // eslint-disable-next-line no-restricted-syntax
  process.exit(1);
});

// Registered explicitly (not via `.commandDir()`) so the command modules are
// bundled into the single-file binary built with `bun build --compile`.
const commandModules = [
  auth,
  bottom,
  checkout,
  continueCmd,
  create,
  deleteCmd,
  demo,
  dev,
  down,
  edit,
  feedback,
  fish,
  fold,
  get,
  info,
  init,
  ll,
  log,
  ls,
  modify,
  move,
  pop,
  rename,
  reorder,
  repo,
  restack,
  split,
  squash,
  submit,
  sync,
  test,
  top,
  track,
  untrack,
  up,
  user,
] as unknown as CommandModule[];

const cli = registerCompletion(
  registerCommands(yargs(getYargsInput()), commandModules)
);

void cli
  .help()
  .usage(
    'Charcoal is a command line tool that makes working with stacked changes fast & intuitive.\n\nhttps://docs.graphite.dev/guides/graphite-cli'
  )
  .options(globalArgumentsOptions)
  .global(Object.keys(globalArgumentsOptions))
  .strict()
  .demandCommand().argv;
