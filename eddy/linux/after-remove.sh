#!/bin/bash
# eddy omega's copy of resources/linux/packaging/after-remove.sh: removes the PATH symlink
# after-install.sh created, only if it still points into eddy omega's install dir.
set -e

# RPM passes an instance count; dpkg passes the package lifecycle action.
case "${1-}" in
  0 | remove | purge) ;;
  *) exit 0 ;;
esac

link="/usr/bin/eddy-omega"

if [ -L "$link" ]; then
  case "$(readlink "$link" || true)" in
    /opt/eddy-omega/*) rm -f "$link" ;;
  esac
fi

exit 0
