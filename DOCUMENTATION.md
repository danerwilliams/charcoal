# Charcoal command reference

Charcoal is an open-source fork of the Graphite CLI for working with stacked branches and pull requests on GitHub. The command is `ch`.

> **Migrating from Graphite?** Charcoal is a *flat* CLI: top-level verbs like `ch create`, `ch submit`, and `ch sync` replace the old noun-verb forms (`gt branch create`, `gt stack submit`, …). If you have muscle memory for `gt`, add `alias gt=ch` to your shell profile. The binary is also installed as `charcoal` if you prefer the long name.

---

## Concepts

- **Stack** — a chain of dependent branches, each based on the one below it. Charcoal tracks the parent/child relationships so it can keep the whole chain rebased and submitted together.
- **Trunk** — your repo's base branch (e.g. `main`). Every stack starts from trunk.
- **Downstack** — the branches *below* the current one, toward trunk (its ancestors).
- **Upstack** — the branches *above* the current one, away from trunk (its descendants).

When a command "restacks", it rebases each affected branch onto its parent so the stack stays consistent.

---

## Global options

Every command accepts these:

| Flag | Description |
| --- | --- |
| `--interactive` / `--no-interactive` | Prompt the user. On by default; disable for scripts/CI. |
| `-q`, `--quiet` | Minimize output to the terminal. |
| `--verify` / `--no-verify` | Run git hooks. On by default; `--no-verify` skips them. |
| `--debug` | Display debug output. |
| `--help` | Show help for any command. |
| `--version` | Show the installed version. |

**Environment overrides** (apply to a single invocation):

- `CH_EDITOR` — override the editor Charcoal opens.
- `CH_PAGER` — override the pager Charcoal opens.

---

## Create & modify

### `create` (alias `c`)
Create a new branch stacked on top of the current branch and commit staged changes. If no branch name is given but a commit message is passed, the branch name is generated from the message.

| Flag | Description |
| --- | --- |
| `[name]` | Positional: name for the new branch. |
| `-m`, `--message` | Commit staged changes on the new branch with this message. |
| `-a`, `--all` | Stage all unstaged changes before committing. |
| `-p`, `--patch` | Pick hunks to stage before committing. |
| `-i`, `--insert` | Existing children of the current branch become children of the new branch. |

```
ch create -am "Add login form"
```

### `modify` (alias `m`)
Modify the current branch by amending its commit (or creating a new one with `--commit`) and restack upstack branches. **Amends by default.**

| Flag | Description |
| --- | --- |
| `-a`, `--all` | Stage all changes before committing. |
| `-c`, `--commit` | Create a new commit instead of amending the current one. |
| `-m`, `--message` | The message for the commit. |
| `--edit` / `-n`, `--no-edit` | Whether to edit the existing message when amending (`--no-edit` takes precedence). |
| `-p`, `--patch` | Pick hunks to stage before committing. |

```
ch modify -a            # amend current commit with all changes
ch modify -c -m "Fix"   # add a new commit instead
```

### `squash` (alias `sq`)
Squash all commits in the current branch into one and restack upstack branches.

| Flag | Description |
| --- | --- |
| `-m`, `--message` | The updated message for the commit. |
| `--edit` / `-n`, `--no-edit` | Whether to modify the existing commit message (`--no-edit` takes precedence). |

```
ch squash -m "Implement feature"
```

### `edit` (alias `e`)
Run an interactive rebase on the current branch's commits and restack upstack branches.

```
ch edit
```

### `split` (alias `sp`)
Split the current branch into multiple single-commit branches.

| Flag | Description |
| --- | --- |
| `-c`, `--by-commit`, `--commit` | Split by commit — slice up the branch's history. |
| `-h`, `--by-hunk`, `--hunk` | Split by hunk into new single-commit branches. |

```
ch split --by-commit
```

### `fold`
Fold a branch's changes into its parent, update descendants' dependencies, and restack.

| Flag | Description |
| --- | --- |
| `-k`, `--keep` | Keep the current branch's name instead of the parent's name. |

```
ch fold
```

### `rename` (alias `rn`)
Rename a branch and update metadata referencing it. If no name is supplied, you'll be prompted. **This removes any associated GitHub pull request.**

| Flag | Description |
| --- | --- |
| `[name]` | Positional: the new branch name. |
| `-f`, `--force` | Allow renaming a branch already associated with an open PR. |

```
ch rename better-name
```

### `delete` (alias `dl`)
Delete a branch and its corresponding Charcoal metadata.

| Flag | Description |
| --- | --- |
| `[name]` | Positional: branch to delete. |
| `-f`, `--force` | Delete even if the branch is not merged or closed. |

```
ch delete old-branch -f
```

### `pop`
Delete the current branch but retain the state of files in the working tree.

```
ch pop
```

---

## Navigate

### `checkout` (alias `co`)
Switch to a branch. With no argument, opens an interactive selector.

| Flag | Description |
| --- | --- |
| `[branch]` | Positional: branch to switch to. |
| `-u`, `--show-untracked` | Include untracked branches in the interactive selector. |

```
ch co            # interactive
ch co my-branch
```

### `up` (alias `u`)
Switch to the child of the current branch. Prompts if ambiguous.

| Flag | Description |
| --- | --- |
| `[steps]` / `-n`, `--steps` | Number of levels to traverse upstack (default 1). |

```
ch up 2
```

### `down` (alias `d`)
Switch to the parent of the current branch.

| Flag | Description |
| --- | --- |
| `[steps]` / `-n`, `--steps` | Number of levels to traverse downstack (default 1). |

```
ch down
```

### `top` (alias `t`)
Switch to the tip branch of the current stack. Prompts if ambiguous.

```
ch top
```

### `bottom` (alias `b`)
Switch to the first branch from trunk in the current stack.

```
ch bottom
```

---

## Stack operations

### `restack` (alias `r`)
Ensure each branch in the current stack is based on its parent, rebasing if necessary. Use scope flags to limit which branches are restacked.

| Flag | Description |
| --- | --- |
| `--branch` | Which branch to run from (default: current branch). |
| `-d`, `--downstack` | Only restack this branch and its ancestors. |
| `-u`, `--upstack` | Only restack this branch and its descendants. |
| `-o`, `--only` | Only restack this branch. |

```
ch restack
ch restack --upstack
```

### `move` (alias `mv`)
Rebase the current branch onto the latest commit of a target branch and restack all of its descendants. With no argument, opens an interactive selector.

| Flag | Description |
| --- | --- |
| `[branch]` | Positional: the target branch to rebase onto. |
| `--source` | Branch to rebase (defaults to current branch). |

```
ch move main
```

### `reorder` (alias `ro`)
Reorder the branches between trunk and the current branch, restacking all descendants. Opens an interactive editor.

```
ch reorder
```

### `track` (alias `tr`)
Start tracking the current (or provided) branch with Charcoal by selecting its parent. Also used to fix corrupted Charcoal metadata.

| Flag | Description |
| --- | --- |
| `[branch]` | Positional: branch to track. |
| `-p`, `--parent` | The tracked branch's parent. If unset, prompts. |
| `-f`, `--force` | Set the parent to the most recent tracked ancestor. Takes precedence over `--parent`. |
| `-d`, `--downstack` | Track a chain of untracked branches downstack, from the current branch down to the first tracked branch. |

```
ch track -p main
ch track --downstack
```

### `untrack` (alias `ut`)
Stop tracking a branch with Charcoal. If it has children, they are also untracked. Defaults to the current branch.

| Flag | Description |
| --- | --- |
| `[branch]` | Positional: branch to untrack. |
| `-f`, `--force` | Don't prompt before untracking a branch with children. |

```
ch untrack feature-x
```

### `test`
Run a command on each branch in the current stack and aggregate the results. Use scope flags to limit which branches run.

| Flag | Description |
| --- | --- |
| `<command>` | Positional: the command to run on each branch. |
| `-d`, `--downstack` | Run from trunk to the current branch. |
| `-u`, `--upstack` | Run on the current branch and its descendants. |
| `-t`, `--trunk` | Also run on the trunk branch. |

```
ch test "npm test"
ch test --upstack "npm run lint"
```

### `continue` (alias `cont`)
Continue the most recent Charcoal command halted by a merge conflict (e.g. during a restack or sync).

| Flag | Description |
| --- | --- |
| `-a`, `--all` | Stage all changes before continuing. |

```
ch continue -a
```

---

## Submit & sync

### `submit`
Idempotently force-push all branches from trunk to the current branch to GitHub, creating or updating a distinct PR for each. **Defaults to the current downstack** (trunk → current); pass `--stack` to also include descendants.

| Flag | Description |
| --- | --- |
| `-s`, `--stack` | Also submit the current branch's descendants, in addition to its ancestors. |
| `-d`, `--draft` | Mark PRs as draft. In `--no-interactive` mode, new PRs are created as drafts. |
| `-p`, `--publish` | Publish PRs (the inverse of draft). |
| `-e`, `--edit` / `-n`, `--no-edit` | Edit PR fields inline. `--no-edit` takes precedence. |
| `-r`, `--reviewers` | Prompt for reviewers, or pass a comma-separated list. |
| `--dry-run` | Report which PRs would be submitted, then exit. Nothing is pushed. |
| `-c`, `--confirm` | Report the PRs and ask for confirmation before pushing. Ignored with `--no-interactive`/`--dry-run`. |
| `--select` | Report the PRs and ask which to update/create. Ignored with `--no-interactive`/`--dry-run`. |
| `-u`, `--update-only` | Only update PRs that have already been submitted. |
| `-f`, `--force` | Force push (overwrites remote). Otherwise defaults to `--force-with-lease`. |
| `--always` | Always push updates even if the branch is unchanged. |
| `--branch` | Which branch to run from (default: current branch). |

```
ch submit              # submit trunk -> current
ch submit --stack -d   # whole stack, as drafts
ch submit --dry-run
```

### `sync`
Pull the trunk branch from remote and delete any branches that have been merged. If trunk can't be fast-forwarded, it is overwritten with the remote version.

| Flag | Description |
| --- | --- |
| `-p`, `--pull` | Pull the trunk branch from remote (default on). |
| `-d`, `--delete` | Delete branches that have been merged (default on). |
| `--show-delete-progress` | Show progress through merged branches. |
| `-f`, `--force` | Don't prompt before deleting a branch or resetting trunk to remote. |
| `-r`, `--restack` | Restack the current stack and any stacks with deleted branches. |

```
ch sync
ch sync -fr
```

### `auth`
Authenticate with the GitHub CLI so Charcoal can create and manage PRs.

| Flag | Description |
| --- | --- |
| `-t`, `--token` | Authenticate with the GitHub API using an OAuth token. |

```
ch auth
ch auth -t <token>
```

---

## Collaborate

### `get` (alias `g`)
Get branches from trunk to the specified branch from remote, prompting to resolve conflicts. With no argument, gets downstack from the current branch. Useful for pulling a teammate's stack.

| Flag | Description |
| --- | --- |
| `[branch]` | Positional: branch to fetch down to. |
| `-f`, `--force` | Overwrite all fetched branches with the remote source of truth. |

```
ch get teammate-branch
```

---

## Inspect

### `log` (alias `l`)
Command group that logs your stacks.

- `ch log` (default) — log all branches tracked by Charcoal, showing dependencies and info for each.
- `ch log short` (alias `s`) — log all stacks, arranged to show dependencies.
- `ch log long` (alias `l`) — display a graph of the commit ancestry of all branches.

Shared flags (on `ch log` and `ch log short`):

| Flag | Description |
| --- | --- |
| `-r`, `--reverse` | Print the log upside down. |
| `-s`, `--stack` | Only show ancestors and descendants of the current branch. |
| `-n`, `--steps` | Only show this many levels up/downstack. Implies `--stack`. |
| `-u`, `--show-untracked` | Include untracked branches. |

### `ls`
Top-level shortcut for `log short`: log all stacks tracked by Charcoal, arranged to show dependencies.

| Flag | Description |
| --- | --- |
| `-c`, `--classic` | Use the old logging style (other options are ignored in classic mode). |
| `-r`, `--reverse` | Print the log upside down. |
| `-s`, `--stack` | Only show ancestors and descendants of the current branch. |
| `-n`, `--steps` | Only show this many levels up/downstack. Implies `--stack`. |
| `-u`, `--show-untracked` | Include untracked branches. |

```
ch ls
ch ls -s
```

### `ll`
Top-level shortcut for `log long`: display a graph of the commit ancestry of all branches.

```
ch ll
```

### `info` (alias `i`)
Display information about the current branch.

| Flag | Description |
| --- | --- |
| `-p`, `--patch` | Show the changes made by each commit. |
| `-d`, `--diff` | Show the diff between this branch and its parent. Takes precedence over `--patch`. |
| `-b`, `--body` | Show the PR body, if it exists. |

```
ch info -d
```

---

## Config

### `repo`
Read or write Charcoal's per-repo configuration. Sub-commands generally read the current value when run with no flag and write it with `-s`/`--set`.

| Sub-command | Description |
| --- | --- |
| `repo init` (alias `i`) | Create or regenerate a `.graphite_repo_config` file. Flags: `--trunk <name>`, `--reset` (untrack all branches). |
| `repo sync` (alias `s`) | Same as the top-level `sync` (pull trunk, delete merged branches). Flags: `-p`/`--pull`, `-d`/`--delete`, `--show-delete-progress`, `-f`/`--force`, `-r`/`--restack`. |
| `repo name` | The repo's name in Charcoal (e.g. `charcoal` in `danerwilliams/charcoal`). `-s`/`--set` to override. |
| `repo owner` | The repo owner's name in Charcoal. `-s`/`--set` to override. |
| `repo remote` | The remote Charcoal pushes to / pulls from (defaults to `origin`). `-s`/`--set` to override. |
| `repo pr-templates` | List your GitHub PR templates, used to pre-fill PR bodies on submit. |
| `repo github` | Toggle the GitHub integration for this repo. `--enable` to set on/off. |

```
ch repo init --trunk main
ch repo remote -s upstream
```

> The previous command name `repo disable-github` is now `repo github` (toggle via `--enable`).

### `user`
Read or write Charcoal's user-level configuration. Sub-commands read the current value with no flag and write it with the flags below.

| Sub-command | Description |
| --- | --- |
| `user editor` | The editor Charcoal opens. `--set <editor>` (e.g. `--set vim`), `--unset`. |
| `user pager` | The pager Charcoal opens. `--set "less -FRX"`, `--disable`, `--unset` (fall back to git's pager). |
| `user tips` | Show tips while using Charcoal. `--enable`, `--disable`. |
| `user branch-prefix` | Prefix prepended to generated branch names. `-s`/`--set <prefix>`, `-r`/`--reset` (takes precedence over `--set`). |
| `user branch-date` | Prepend the date to auto-generated branch names. `--enable`, `--disable`. |
| `user branch-replacement` | Character that replaces unsupported characters in generated branch names. `--set-underscore`, `--set-dash`, `--set-empty`. |
| `user restack-date` | How committer date is handled by restack's internal rebases. `--use-author-date` passes `--committer-date-is-author-date`. |
| `user submit-body` | Defaults for PR descriptions. `--include-commit-messages` includes commit messages in the PR body by default. |

```
ch user editor --set "code --wait"
ch user branch-prefix -s dane/
```

---

## Setup & misc

### `init`
Create or regenerate a `.graphite_repo_config` file for the current repo (same as `repo init`).

| Flag | Description |
| --- | --- |
| `--trunk` | The name of your trunk branch. |
| `--reset` | Untrack all branches. |

```
ch init --trunk main
```

### `completion`
Print a yargs bash/zsh completion script to stdout. Append it to your shell profile to enable tab completion.

```
ch completion >> ~/.bashrc
```

### `fish`
Set up fish-shell tab completion.

```
ch fish
```

### `feedback`
Command group for providing feedback and debug state.

- `ch feedback debug-context` — print a debug summary of your repo, useful for bug reports.

```
ch feedback debug-context
```

### `demo`
Run an interactive demo of Charcoal.

```
ch demo
```
