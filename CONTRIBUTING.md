# Contributing

Contributions are welcome! Please first open an issue so that we can discuss before opening a PR. I have limited bandwidth to maintain this project so please bear with me if responses and reviews are slow.

## Getting Started

[Install nvm](https://github.com/nvm-sh/nvm?tab=readme-ov-file#installing-and-updating) to ensure you're using the right node version. Once that is installed, from the repository directory run:

```
nvm use
```

You'll need to install yarn on your machine

```
npm install --global yarn
```

You'll also need to install turbo

```
npm install --global turbo
```

Build the monorepo

```
yarn install
turbo run build
```

Build the CLI

```
cd apps/cli
yarn install
yarn build
```

## Running Tests

```
cd apps/cli
DEBUG=1 yarn test --full-trace
```

Running a subset of tests

```
cd apps/cli
DEBUG=1 yarn test --full-trace -g "test pattern"
```

Running one test

```
cd apps/cli
DEBUG=1 yarn test-one "<path to .js test file in dist folder>"
```

## Run CLI from Local Build

```
cd apps/cli
yarn cli <command> # (to run `gt <command>`)
```

Linking `gt` to a locally built version (includes a build)

```
cd apps/cli
yarn dev
# then to run commands:
gt <command>
```

## Generating the MacOS ARM Binary

Due to limitations with Github actions, we need to manually generate the MacOS ARM binary for a release.

From the cli app directory:

```
yarn build-pkg -t node18-macos -o gt-macos-arm64
```

## Getting Hashes for the Homebrew Tap

Download all 3 binaries and then run:

```
shasum -a 256 /path/to/mybinary
```
