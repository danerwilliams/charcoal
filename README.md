# Charcoal

> A CLI for managing stacked pull requests

<img width="1346" alt="CleanShot 2023-09-09 at 19 48 49@2x" src="https://github.com/danerwilliams/graphite-cli/assets/22798229/17385828-f235-4b56-84dd-ad73350d55b9">

## Install

`brew install danerwilliams/tap/charcoal`

The command is `ch`:

```sh
ch --help
```

> [!IMPORTANT]
> As of `v1.0.0` the binary is `ch` (previously `gt`). This avoids colliding with
> Graphite's own `gt` if you have both installed. If you have muscle memory for
> `gt`, alias it in your shell:
>
> ```sh
> alias gt=ch   # add to ~/.zshrc or ~/.bashrc
> ```

## Announcement

Check out my blog post announcement [here](https://danewilliams.com/announcing-charcoal) 🙂

## What is Graphite?

From Graphite:

> [Graphite](https://graphite.dev) is a **fast, simple code review platform** designed for engineers who want to **write and review smaller pull requests, stay unblocked, and ship faster**. Anyone can start using Graphite individually without needing their coworkers to change tools - we'll seamlessly sync your code changes and reviews. We built Graphite because we missed internal code review tools like Phabricator (at Facebook) and Critique (Google) that help engineers create, approve, and ship small, incremental changes, and long-term we’re passionate about creating products & workflows that help fast-moving eng teams achieve more.

## What is Charcoal?

Charcoal is simply the Graphite CLI, but open source!

On 7/14/2023 the Graphite team announced that they closed open source development of the Graphite CLI and [moved development to their private monorepo](https://github.com/withgraphite/graphite-cli). They also added a pay wall limiting free users to 10 open stacks at a time per organization starting 8/7/2023.

Graphite is an amazing company and you should absolutely check out their products. In addition to a stacking CLI, they have an entire code review platform, merge queue, and more developer productivity tools.

However, many organizations aren't interested in paying for Graphite's team plan at this time.

The Graphite CLI does not need to depend on Graphite's API, so this project allows for use of the CLI with any git repository (even ones hosted on platforms other than GitHub!), entirely for free.

## Commands

Charcoal uses a flat command surface that mirrors modern Graphite, e.g.:

```sh
ch create -m "my change"   # create a branch + commit staged changes
ch modify -a               # amend the current branch and restack upstack
ch submit --stack          # push the stack and open/update PRs
ch sync                    # pull trunk, prune merged branches, restack
ch ls                      # view your stacks
ch up / ch down            # move through the stack
ch checkout                # interactively switch branches
```

See **[DOCUMENTATION.md](./DOCUMENTATION.md)** for the full command reference.

> [!NOTE]
> Graphite's own docs (<https://graphite.dev/docs/graphite-cli/>) have diverged
> from this fork — they now require a Graphite account and document commands that
> differ from Charcoal's. Use [DOCUMENTATION.md](./DOCUMENTATION.md) instead.

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md)
