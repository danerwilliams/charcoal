const args = {
  foreground: {
    type: 'boolean',
    alias: 'f',
    describe: 'Run the server process in the foreground.',
    default: false,
  },
  'no-open': {
    type: 'boolean',
    describe: 'Do not try to open a browser after starting the server.',
    default: false,
  },
  json: {
    type: 'boolean',
    describe: 'Output machine-readable JSON',
    default: false,
  },
  stdout: {
    type: 'boolean',
    describe: 'Write server logs to stdout instead of a tmp file.',
    default: false,
  },
  kill: {
    type: 'boolean',
    describe:
      'Do not start Graphite Web, just kill any previously running Graphite Web server on the specified port. Note that this will disrupt other windows still using the previous Graphite Web server.',
    default: false,
  },
  force: {
    type: 'boolean',
    describe:
      'Kill any existing Graphite Web server on the specified port, then start a new server. Note that this will disrupt other windows still using the previous Graphite Web server.',
    default: false,
  },
  command: {
    type: 'string',
    describe: 'Set which command to run for gt commands (default: gt)',
    default: 'gt',
  },
  cwd: {
    type: 'string',
    describe: 'Sets the current working directory, allowing changing the repo.',
  },
  gtVersion: {
    alias: 'gt-version',
    type: 'string',
    describe:
      'Set version number of gt was used to spawn the server (default: "(dev)")',
    default: '(dev)',
  },
  platform: {
    type: 'string',
    describe:
      'Set which platform implementation to use by changing the resulting URL. Used to embed Graphite Web into non-browser web environments like IDEs.',
  },
} as const;

export const command = 'start';
export const canonical = 'internal-only start';
export const description = 'Start GT Interactive';
export const builder = args;
