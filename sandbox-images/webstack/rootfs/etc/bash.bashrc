# System-wide .bashrc for the training server
[ -z "$PS1" ] && return
shopt -s checkwinsize histappend
HISTCONTROL=ignoredups
PS1='\[\e[32m\]\u@masso-srv\[\e[0m\]:\[\e[34m\]\w\[\e[0m\]\$ '
export PATH=/usr/lib/postgresql/15/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin PGHOST=/srv/run PGUSER=student PGDATABASE=postgres
[ -f /etc/bash_completion ] && . /etc/bash_completion
# Command trail for the digital footprint (read by MASSO via exec): epoch<TAB>pwd<TAB>command
__masso_log() {
  local c; c=$(HISTTIMEFORMAT= history 1 | sed -E 's/^ *[0-9]+ +//')
  [ -n "$c" ] && [ "$c" != "$__masso_last" ] && mkdir -p /tmp/.masso && \
    printf '%s\t%s\t%s\n' "$(date +%s)" "$PWD" "$c" >> /tmp/.masso/cmd.log
  __masso_last=$c
}
PROMPT_COMMAND=__masso_log
cd /srv 2>/dev/null
