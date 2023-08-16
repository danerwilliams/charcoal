# NOTE (7/14/23)

The Graphite CLI team has decided that in order to build the ideal integrated Graphite experience, *we will be developing v1.0 of the Graphite CLI within our monorepo and leaving the public repository archived as an artifact*.  As we begin the next round of development on our CLI and the rollout of GTI, our graphical interface for branch management, this will allow us to iterate quickly and give our users the best possible experience.  We’re excited to show you what we’re working on!

# README

## What is Graphite?

[Graphite](https://graphite.dev) is a **fast, simple code review platform** designed for engineers who want to **write and review smaller pull requests, stay unblocked, and ship faster**.  Anyone can start using Graphite individually without needing their coworkers to change tools - we'll seamlessly sync your code changes and reviews.  We built Graphite because we missed internal code review tools like Phabricator (at Facebook) and Critique (Google) that help engineers create, approve, and ship small, incremental changes, and long-term we’re passionate about creating products & workflows that help fast-moving eng teams achieve more.

Graphite is designed to be used at work - unfortunately we don't yet support submitting PRs to open-source repos as an external contributor (i.e. without write access) due to limitations of GitHub.

## Graphite beta
Graphite is currently in beta, and you’ll need a Graphite account to submit pull requests with the CLI.  You can [sign up](https://graphite.dev) for early access!

## User guide

<https://docs.graphite.dev/>

Everything is still a little early, so please add comments to our user guide if you have any questions, feedback, or suggestions!

## Changelog

[View the Graphite CLI changelog](apps/cli/.CHANGELOG.md)

## Support

We *do not* consistently check GH issues — if you have any questions or issues, reach out to us on our [Community Slack server](https://join.slack.com/t/graphite-community/shared_invite/zt-1as9rdo7r-pYmEZzt6M1EhTkvJFNhsnQ)!


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
