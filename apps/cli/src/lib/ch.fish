### Installation: ch fish >> ~/.config/fish/completions/ch.fish
# git helpers adapted from fish git completion
function __fish_git_local_branches
    command git for-each-ref --format='%(refname:strip=2)' refs/heads/ 2>/dev/null
end

function __fish_git_remote_branches
    command git for-each-ref --format="%(refname:strip=3)" refs/remotes/ 2>/dev/null
end

# charcoal helpers
function __ch_command_completions
    set -lx SHELL (type -p fish)
    set -l command (commandline -opc)
    # uncomment to include options, e.g. -q, --help
    # $command --get-yargs-completions
    # uncomment to exclude options (default)
    $command --get-yargs-completions | string replace -r '\-.*' ''
end

# disable file completions for the entire command
complete -c ch -f

# add completions as provided by CLI
complete -c ch -a "(__ch_command_completions)"

# commands that take branches
complete -c ch -x -n "__fish_seen_subcommand_from checkout co delete dl track tr untrack ut move mv" -a "(__fish_git_local_branches)"

# ch get takes remote branches
complete -c ch -x -n "__fish_seen_subcommand_from get g" -a "(__fish_git_remote_branches)"
