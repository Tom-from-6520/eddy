#!/bin/bash
# eddy omega's copy of resources/linux/packaging/after-install.sh: Orca's script only knows
# /opt/Orca, /opt/orca-ide and /opt/orca. Makes Chromium's sandbox helper usable and puts the
# bundled CLI on PATH as `eddy-omega` (never touching Orca's /usr/bin/orca-ide).
set -e

dir="/opt/eddy-omega"
link="/usr/bin/eddy-omega"

sandbox="$dir/chrome-sandbox"
if [ -f "$sandbox" ]; then
  # Hosts without unprivileged user namespaces need the setuid sandbox helper.
  chmod 4755 "$sandbox" || true
fi

shim="$dir/resources/bin/orca-ide"
if [ -x "$shim" ]; then
  # Only manage our own symlink.
  if { [ ! -e "$link" ] && [ ! -L "$link" ]; } || [ "$(readlink -f -- "$link" 2>/dev/null || true)" = "$(readlink -f -- "$shim")" ]; then
    ln -sfn -- "$shim" "$link"
  fi
fi

exit 0
