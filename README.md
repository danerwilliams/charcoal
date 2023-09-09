# Graphite Open Source

> A CLI for managing stacked pull requests

<img width="1346" alt="CleanShot 2023-09-09 at 19 48 49@2x" src="https://github.com/danerwilliams/graphite-cli/assets/22798229/17385828-f235-4b56-84dd-ad73350d55b9">

## What is Graphite?

From Graphite:

> [Graphite](https://graphite.dev) is a **fast, simple code review platform** designed for engineers who want to **write and review smaller pull requests, stay unblocked, and ship faster**.  Anyone can start using Graphite individually without needing their coworkers to change tools - we'll seamlessly sync your code changes and reviews.  We built Graphite because we missed internal code review tools like Phabricator (at Facebook) and Critique (Google) that help engineers create, approve, and ship small, incremental changes, and long-term we’re passionate about creating products & workflows that help fast-moving eng teams achieve more.

## What is Graphite Open Source?

Graphite Open Source is simply the Graphite CLI, but open source!

On 7/14/2023 the Graphite team announced that they closed open source development of the Graphite CLI and [moved development to their private monorepo](https://github.com/withgraphite/graphite-cli). They also added a pay wall limiting free users to 10 open stacks at a time per organization starting 8/7/2023.

Graphite is an amazing company and you should absolutely check out their products. In addition to a stacking CLI, they have an entire code review platform, merge queue, and more developer productivity tools.

However, many organizations aren't interested in paying for Graphite's team plan at this time.

The Graphite CLI does not need to depend on Graphite's API, so this project allows for use of the CLI with any git repository (even ones hosted on platforms other than GitHub!), entirely for free.

## User guide

<https://graphite.dev/docs/graphite-cli/>

Right now, the Graphite Docs are more or less in sync with this Open Source version.

As Graphite continues to develop their private version of the CLI, however, these will become out of sync. Ideally we can add our own open source docs to accompany this project.

## Developing and Running tests

Interested in contributing to graphite CLI? Here's how to get started.

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
nvm use
yarn install
yarn build
```

Running tests

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

Running the CLI locally (after build)

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

Running into difficulties getting the CLI repo set up on your system? Check out [this PR](https://github.com/withgraphite/graphite-cli/pull/1066?no-redirect=1)

By contributing to the Graphite CLI, you agree to the terms of the Graphite Individual Contributor License Agreement as defined in CLA.md
