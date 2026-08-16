# ============================================================================
#  Reproducible cross-compile environment for SpotFinder's native deps.
#  Produces static .a libraries for all four Android ABIs.
#
#  Build:  docker build -t spotfinder-native android/native-build
#  Run:    docker run --rm \
#            -v "$(pwd)/android/app/src/main/cpp/prebuilt:/out" \
#            spotfinder-native
# ============================================================================
FROM ubuntu:22.04

ARG NDK_VER=r26d
ARG DEBIAN_FRONTEND=noninteractive

RUN apt-get update && apt-get install -y --no-install-recommends \
        build-essential cmake ninja-build git curl ca-certificates \
        autoconf automake libtool pkg-config python3 unzip xz-utils \
        file patch \
    && rm -rf /var/lib/apt/lists/*

# --- Android NDK ---
WORKDIR /opt
RUN curl -fsSL -o ndk.zip \
        https://dl.google.com/android/repository/android-ndk-${NDK_VER}-linux.zip \
 && unzip -q ndk.zip && rm ndk.zip
ENV ANDROID_NDK=/opt/android-ndk-${NDK_VER}

# --- Host tools needed by cross builds (sqlite3 CLI for proj.db, etc.) ---
RUN apt-get update && apt-get install -y --no-install-recommends sqlite3 \
    && rm -rf /var/lib/apt/lists/*

COPY versions.env /opt/versions.env
COPY build-all.sh /opt/build-all.sh
RUN chmod +x /opt/build-all.sh

# Bind-mount the repo's prebuilt/ dir here to collect artifacts.
VOLUME ["/out"]
ENTRYPOINT ["/bin/bash", "/opt/build-all.sh"]
