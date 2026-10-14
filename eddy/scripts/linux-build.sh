#!/usr/bin/env bash
# Builds eddy for Linux x64 (.deb + .tar.gz), following upstream's Linux pipeline
# (build/azure-pipelines/linux): native modules are compiled against a glibc 2.28
# sysroot so the package runs on older distros too.
#
# Usage (Ubuntu 22.04+/Debian 12+, e.g. WSL):
#   eddy/scripts/linux-build.sh deps      # once, as root: apt packages + Node from .nvmrc
#   eddy/scripts/linux-build.sh build     # npm ci + package + .deb + .tar.gz
#   eddy/scripts/linux-build.sh package   # only .deb + .tar.gz from the last app build
# Outputs: .build/eddy-dist/linux/
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"
export VSCODE_ARCH=x64 npm_config_arch=x64

install_deps() {
	if [ "$(id -u)" -ne 0 ]; then echo "deps: run as root (or with sudo)" >&2; exit 1; fi
	export DEBIAN_FRONTEND=noninteractive
	apt-get update
	apt-get install -y --no-install-recommends \
		build-essential pkg-config python3 python-is-python3 git curl ca-certificates xz-utils file unzip \
		libx11-dev libxkbfile-dev libsecret-1-dev libkrb5-dev libgtk-3-0 libgbm1 libnss3 libasound2t64 \
		fakeroot dpkg-dev rpm

	local version arch_url
	version="$(cat .nvmrc)"
	if ! command -v node >/dev/null || [ "$(node -v)" != "v$version" ]; then
		arch_url="https://nodejs.org/dist/v$version/node-v$version-linux-x64.tar.xz"
		echo "Installing Node $version"
		# Remove a previous global npm first: unpacking over it mixes two npm versions and breaks npm.
		rm -rf /usr/local/lib/node_modules/npm /usr/local/lib/node_modules/corepack
		curl -fsSL "$arch_url" | tar -xJ -C /usr/local --strip-components=1
		hash -r
	fi
	node -v
	npm -v
}

build() {
	export ELECTRON_SKIP_BINARY_DOWNLOAD=1 PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 FOUNDRY_LOCAL_SKIP_INSTALL=1 ONNXRUNTIME_NODE_INSTALL=skip

	( cd build && npm ci )

	# Upstream toolchain: glibc 2.28 sysroots, Chromium clang and libc++ (sets CC/CXX/CXXFLAGS/LDFLAGS).
	# shellcheck disable=SC1091
	source build/azure-pipelines/linux/setup-env.sh
	[ -x .build/CR_Clang/bin/clang ] || { echo "toolchain setup failed (no Chromium clang)" >&2; exit 1; }

	node build/npm/preinstall.ts
	for i in 1 2 3; do
		npm ci && break
		[ "$i" -eq 3 ] && { echo "npm ci failed" >&2; exit 1; }
		echo "npm ci failed (attempt $i), retrying..."
	done

	npm run gulp vscode-linux-x64-min
	package_deb_and_archive
}

package_deb_and_archive() {
	npm run gulp vscode-linux-x64-prepare-deb
	npm run gulp vscode-linux-x64-build-deb

	local version commit label dist
	version="$(node -p "require('./package.json').version")"
	commit="$(node -p "require('../VSCode-linux-x64/resources/app/product.json').commit.slice(0, 10)")"
	label="${EDDY_LABEL:-$version-$commit}"
	dist=".build/eddy-dist/linux"
	rm -rf "$dist"
	mkdir -p "$dist"
	cp .build/linux/deb/*/deb/*.deb "$dist/eddy-$label-linux-amd64.deb"
	tar -czf "$dist/eddy-$label-linux-x64.tar.gz" -C .. VSCode-linux-x64
	( cd "$dist" && sha256sum * > SHA256SUMS-linux.txt )
	ls -la "$dist"
	echo "LINUX_BUILD_OK"
}

case "${1:-}" in
	deps) install_deps ;;
	build) build ;;
	package) package_deb_and_archive ;;
	*) echo "usage: $0 deps|build|package" >&2; exit 2 ;;
esac
