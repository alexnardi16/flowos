#!/usr/bin/env bash
# Installs just enough of the Android SDK to run `eas build --local` and
# `expo run:android` inside a Codespace/devcontainer. Versions are pinned to
# match what this project's Gradle build actually requests (see the
# [RUN_GRADLEW] "Configure project" log lines of any local Android build) —
# check those if a future SDK bump makes this script's versions stale.
#
# Usage:
#   bash .devcontainer/setup-android-sdk.sh
#   source ~/.bashrc   # (or open a new terminal) to pick up the env vars
#
# Idempotent: safe to re-run, it skips the download if already installed.
set -euo pipefail

ANDROID_SDK_ROOT="${ANDROID_SDK_ROOT:-$HOME/android-sdk}"
CMDLINE_TOOLS_VERSION="11076708" # commandlinetools-linux-<version>_latest.zip
PLATFORM="android-36"
BUILD_TOOLS="36.0.0"
NDK_VERSION="27.1.12297006"

echo "==> Installing Android SDK to $ANDROID_SDK_ROOT"

if [ ! -d "$ANDROID_SDK_ROOT/cmdline-tools/latest" ]; then
  TMP_ZIP="$(mktemp -d)/cmdline-tools.zip"
  URL="https://dl.google.com/android/repository/commandlinetools-linux-${CMDLINE_TOOLS_VERSION}_latest.zip"
  echo "==> Downloading command-line tools from $URL"
  if ! curl -fsSL -o "$TMP_ZIP" "$URL"; then
    echo "!! Download failed. The pinned build number ($CMDLINE_TOOLS_VERSION) may be stale."
    echo "!! Get the current one from https://developer.android.com/studio#command-tools"
    echo "!! (look for 'commandlinetools-linux-<NUMBER>_latest.zip'), then re-run:"
    echo "!!   CMDLINE_TOOLS_VERSION=<NUMBER> bash .devcontainer/setup-android-sdk.sh"
    exit 1
  fi
  mkdir -p "$ANDROID_SDK_ROOT/cmdline-tools"
  unzip -q "$TMP_ZIP" -d "$ANDROID_SDK_ROOT/cmdline-tools"
  mv "$ANDROID_SDK_ROOT/cmdline-tools/cmdline-tools" "$ANDROID_SDK_ROOT/cmdline-tools/latest"
  rm -rf "$(dirname "$TMP_ZIP")"
else
  echo "==> Command-line tools already present, skipping download"
fi

export ANDROID_HOME="$ANDROID_SDK_ROOT"
export ANDROID_SDK_ROOT
export PATH="$PATH:$ANDROID_SDK_ROOT/cmdline-tools/latest/bin:$ANDROID_SDK_ROOT/platform-tools"

echo "==> Accepting SDK licenses"
yes | sdkmanager --licenses > /dev/null

echo "==> Installing platform-tools, platforms;$PLATFORM, build-tools;$BUILD_TOOLS, ndk;$NDK_VERSION"
sdkmanager "platform-tools" "platforms;$PLATFORM" "build-tools;$BUILD_TOOLS" "ndk;$NDK_VERSION"

# Persist for every future terminal in this Codespace (this script itself
# only exports for the current shell).
if ! grep -q "ANDROID_SDK_ROOT" "$HOME/.bashrc" 2>/dev/null; then
  {
    echo ''
    echo '# Added by .devcontainer/setup-android-sdk.sh'
    echo "export ANDROID_HOME=\"$ANDROID_SDK_ROOT\""
    echo "export ANDROID_SDK_ROOT=\"$ANDROID_SDK_ROOT\""
    echo "export PATH=\"\$PATH:$ANDROID_SDK_ROOT/cmdline-tools/latest/bin:$ANDROID_SDK_ROOT/platform-tools\""
  } >> "$HOME/.bashrc"
  echo "==> Added ANDROID_HOME/PATH to ~/.bashrc for future terminals"
fi

echo "==> Done. Run 'source ~/.bashrc' (or open a new terminal), then:"
echo "==>   eas build --platform android --profile preview --local"
