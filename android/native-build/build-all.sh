#!/usr/bin/env bash
# ============================================================================
#  build-all.sh — cross-compile every native dependency for all Android ABIs
#  and assemble the prebuilt/ tree consumed by cpp/CMakeLists.txt.
#
#  Output (bind-mounted at /out):
#     /out/include/<headers>
#     /out/lib/<abi>/*.a
#
#  Build order (deps first):
#     zlib -> sqlite3(FTS5+RTREE) -> proj -> geos -> spatialite
#          -> boost(subset) -> oneTBB -> osrm(libosrm)
# ============================================================================
set -euo pipefail

source /opt/versions.env

: "${ANDROID_NDK:?ANDROID_NDK must be set}"
OUT=/out
SRC=/tmp/src
mkdir -p "$OUT/include" "$OUT/lib" "$SRC"

HOST_TAG=linux-x86_64
TOOLCHAIN="$ANDROID_NDK/toolchains/llvm/prebuilt/$HOST_TAG"
CMAKE_TC="$ANDROID_NDK/build/cmake/android.toolchain.cmake"
NCPU="$(nproc)"

ABIS=(arm64-v8a armeabi-v7a x86 x86_64)

# ---------------------------------------------------------------------------
#  Per-ABI toolchain environment (used by autotools builds like SpatiaLite).
# ---------------------------------------------------------------------------
set_abi_env() {
    local abi="$1"
    case "$abi" in
        arm64-v8a)    TRIPLE=aarch64-linux-android;   HOST=aarch64-linux-android ;;
        armeabi-v7a)  TRIPLE=armv7a-linux-androideabi; HOST=arm-linux-androideabi ;;
        x86)          TRIPLE=i686-linux-android;       HOST=i686-linux-android ;;
        x86_64)       TRIPLE=x86_64-linux-android;     HOST=x86_64-linux-android ;;
        *) echo "unknown abi $abi"; exit 1 ;;
    esac

    export CC="$TOOLCHAIN/bin/${TRIPLE}${API_LEVEL}-clang"
    export CXX="$TOOLCHAIN/bin/${TRIPLE}${API_LEVEL}-clang++"
    export AR="$TOOLCHAIN/bin/llvm-ar"
    export RANLIB="$TOOLCHAIN/bin/llvm-ranlib"
    export STRIP="$TOOLCHAIN/bin/llvm-strip"
    export LD="$TOOLCHAIN/bin/ld"
    export SYSROOT="$TOOLCHAIN/sysroot"

    # Staging prefix that later deps read headers/libs from.
    STAGE="$OUT/staging/$abi"
    mkdir -p "$STAGE/lib" "$STAGE/include"
    export PKG_CONFIG_PATH="$STAGE/lib/pkgconfig"
    export CFLAGS="-fPIC -O2 -I$STAGE/include"
    export CXXFLAGS="-fPIC -O2 -std=c++17 -I$STAGE/include"
    export LDFLAGS="-L$STAGE/lib"
}

cmake_common_args() {
    local abi="$1"
    echo "-DCMAKE_TOOLCHAIN_FILE=$CMAKE_TC \
          -DANDROID_ABI=$abi \
          -DANDROID_PLATFORM=android-$API_LEVEL \
          -DANDROID_STL=c++_shared \
          -DCMAKE_BUILD_TYPE=Release \
          -DBUILD_SHARED_LIBS=OFF \
          -DCMAKE_INSTALL_PREFIX=$OUT/staging/$abi \
          -DCMAKE_FIND_ROOT_PATH=$OUT/staging/$abi \
          -DCMAKE_PREFIX_PATH=$OUT/staging/$abi \
          -GNinja"
}

fetch() { # url  outfile
    local url="$1" out="$2"
    [ -f "$out" ] || curl -fsSL -o "$out" "$url"
}

# ===========================================================================
#  1) zlib  (CMake)
# ===========================================================================
build_zlib() {
    local abi="$1"
    local d="$SRC/zlib-$ZLIB_VER"
    fetch "https://zlib.net/zlib-$ZLIB_VER.tar.gz" "$SRC/zlib.tgz"
    [ -d "$d" ] || tar -xf "$SRC/zlib.tgz" -C "$SRC"
    rm -rf "$d/build-$abi"
    cmake -S "$d" -B "$d/build-$abi" $(cmake_common_args "$abi")
    cmake --build "$d/build-$abi" --target zlibstatic -j"$NCPU"
    cmake --install "$d/build-$abi"
    # Normalise name to libz.a for the linker.
    cp -f "$OUT/staging/$abi/lib/libz.a" "$OUT/staging/$abi/lib/libz.a" 2>/dev/null || \
    cp -f "$d/build-$abi/libzlibstatic.a" "$OUT/staging/$abi/lib/libz.a"
}

# ===========================================================================
#  2) SQLite amalgamation, compiled with FTS5 + R*Tree (direct clang)
# ===========================================================================
build_sqlite() {
    local abi="$1"
    local d="$SRC/sqlite"
    if [ ! -f "$d/sqlite3.c" ]; then
        fetch "https://www.sqlite.org/$SQLITE_YEAR/sqlite-amalgamation-$SQLITE_AMALG.zip" "$SRC/sqlite.zip"
        rm -rf "$d" && unzip -q "$SRC/sqlite.zip" -d "$SRC"
        mv "$SRC/sqlite-amalgamation-$SQLITE_AMALG" "$d"
    fi
    local stage="$OUT/staging/$abi"
    "$CC" $CFLAGS -c "$d/sqlite3.c" -o "$SRC/sqlite3-$abi.o" \
        -DSQLITE_ENABLE_FTS5 \
        -DSQLITE_ENABLE_RTREE \
        -DSQLITE_ENABLE_COLUMN_METADATA \
        -DSQLITE_ENABLE_LOAD_EXTENSION \
        -DSQLITE_ENABLE_GEOPOLY \
        -DSQLITE_THREADSAFE=1
    "$AR" rcs "$stage/lib/libsqlite3.a" "$SRC/sqlite3-$abi.o"
    "$RANLIB" "$stage/lib/libsqlite3.a"
    cp -f "$d/sqlite3.h" "$stage/include/"
    cp -f "$d/sqlite3ext.h" "$stage/include/" 2>/dev/null || true
    # Minimal pkg-config so PROJ/SpatiaLite find it.
    mkdir -p "$stage/lib/pkgconfig"
    cat > "$stage/lib/pkgconfig/sqlite3.pc" <<EOF
prefix=$stage
libdir=\${prefix}/lib
includedir=\${prefix}/include
Name: SQLite
Version: 3.46.1
Libs: -L\${libdir} -lsqlite3
Cflags: -I\${includedir}
EOF
}

# ===========================================================================
#  3) PROJ  (CMake) — coordinate transforms for SpatiaLite
# ===========================================================================
build_proj() {
    local abi="$1"
    local d="$SRC/proj-$PROJ_VER"
    fetch "https://download.osgeo.org/proj/proj-$PROJ_VER.tar.gz" "$SRC/proj.tgz"
    [ -d "$d" ] || tar -xf "$SRC/proj.tgz" -C "$SRC"
    rm -rf "$d/build-$abi"
    cmake -S "$d" -B "$d/build-$abi" $(cmake_common_args "$abi") \
        -DBUILD_TESTING=OFF \
        -DENABLE_TIFF=OFF \
        -DENABLE_CURL=OFF \
        -DBUILD_APPS=OFF \
        -DBUILD_PROJSYNC=OFF \
        -DSQLITE3_INCLUDE_DIR="$OUT/staging/$abi/include" \
        -DSQLITE3_LIBRARY="$OUT/staging/$abi/lib/libsqlite3.a" \
        -DEXE_SQLITE3="$(command -v sqlite3)"
    cmake --build "$d/build-$abi" -j"$NCPU"
    cmake --install "$d/build-$abi"
}

# ===========================================================================
#  4) GEOS  (CMake) — geometry engine for SpatiaLite
# ===========================================================================
build_geos() {
    local abi="$1"
    local d="$SRC/geos-$GEOS_VER"
    fetch "https://download.osgeo.org/geos/geos-$GEOS_VER.tar.bz2" "$SRC/geos.tbz2"
    [ -d "$d" ] || tar -xf "$SRC/geos.tbz2" -C "$SRC"
    rm -rf "$d/build-$abi"
    cmake -S "$d" -B "$d/build-$abi" $(cmake_common_args "$abi") \
        -DBUILD_TESTING=OFF \
        -DBUILD_GEOSOP=OFF \
        -DBUILD_DOCUMENTATION=OFF
    cmake --build "$d/build-$abi" -j"$NCPU"
    cmake --install "$d/build-$abi"
}

# ===========================================================================
#  5) libspatialite  (autotools) — needs sqlite3, proj, geos, zlib
# ===========================================================================
build_spatialite() {
    local abi="$1"
    local d="$SRC/libspatialite-$SPATIALITE_VER"
    fetch "https://www.gaia-gis.it/gaia-sins/libspatialite-sources/libspatialite-$SPATIALITE_VER.tar.gz" "$SRC/spatialite.tgz"
    [ -d "$d" ] || tar -xf "$SRC/spatialite.tgz" -C "$SRC"
    local stage="$OUT/staging/$abi"

    ( cd "$d" && make distclean >/dev/null 2>&1 || true
      # PROJ 6+ new API; disable the optional bits we don't ship.
      ./configure \
        --host="$HOST" \
        --prefix="$stage" \
        --enable-static --disable-shared \
        --disable-freexl \
        --disable-libxml2 \
        --disable-examples \
        --disable-gcp \
        --disable-rttopo \
        --with-geosconfig=no \
        CFLAGS="$CFLAGS -DPROJ_NEW_API" \
        CPPFLAGS="-I$stage/include" \
        LDFLAGS="-L$stage/lib" \
        LIBS="-lgeos_c -lgeos -lproj -lsqlite3 -lz -lm"
      make -j"$NCPU"
      make install )
}

# ===========================================================================
#  6) Boost (subset) — b2 with a generated user-config for the NDK clang
# ===========================================================================
build_boost() {
    local abi="$1"
    local d="$SRC/boost_$BOOST_VER_U"
    fetch "https://archives.boost.io/release/$BOOST_VER/source/boost_$BOOST_VER_U.tar.gz" "$SRC/boost.tgz"
    [ -d "$d" ] || tar -xf "$SRC/boost.tgz" -C "$SRC"
    local stage="$OUT/staging/$abi"

    ( cd "$d"
      [ -x ./b2 ] || ./bootstrap.sh
      cat > "user-config-$abi.jam" <<EOF
using clang : android
  : $CXX
  : <archiver>$AR
    <ranlib>$RANLIB
    <cxxflags>"$CXXFLAGS"
    <linkflags>"$LDFLAGS"
  ;
EOF
      ./b2 -j"$NCPU" \
        --user-config="user-config-$abi.jam" \
        --prefix="$stage" \
        --with-system --with-filesystem --with-iostreams \
        --with-thread --with-date_time \
        toolset=clang-android \
        target-os=android \
        link=static runtime-link=shared \
        variant=release threading=multi \
        cxxstd=17 \
        -sNO_BZIP2=1 -sNO_LZMA=1 -sNO_ZSTD=1 \
        -sZLIB_INCLUDE="$stage/include" -sZLIB_LIBPATH="$stage/lib" \
        install )
}

# ===========================================================================
#  7) oneTBB  (CMake)
# ===========================================================================
build_tbb() {
    local abi="$1"
    local d="$SRC/oneTBB-$TBB_VER"
    fetch "https://github.com/oneapi-src/oneTBB/archive/refs/tags/v$TBB_VER.tar.gz" "$SRC/tbb.tgz"
    [ -d "$d" ] || tar -xf "$SRC/tbb.tgz" -C "$SRC"
    rm -rf "$d/build-$abi"
    cmake -S "$d" -B "$d/build-$abi" $(cmake_common_args "$abi") \
        -DTBB_TEST=OFF \
        -DTBB_STRICT=OFF \
        -DBUILD_SHARED_LIBS=OFF
    cmake --build "$d/build-$abi" -j"$NCPU"
    cmake --install "$d/build-$abi"
}

# ===========================================================================
#  8) osrm-backend -> libosrm.a  (CMake). Library target only.
# ===========================================================================
build_osrm() {
    local abi="$1"
    local d="$SRC/osrm-backend"
    if [ ! -d "$d" ]; then
        git clone --depth 1 --branch "$OSRM_GIT_TAG" \
            https://github.com/Project-OSRM/osrm-backend.git "$d"
    fi
    local stage="$OUT/staging/$abi"
    rm -rf "$d/build-$abi"
    # ENABLE_MASON=OFF forces use of our staged Boost/TBB. Tools/tests off:
    # on device we only need the query library (libosrm), not osrm-extract.
    cmake -S "$d" -B "$d/build-$abi" $(cmake_common_args "$abi") \
        -DENABLE_MASON=OFF \
        -DENABLE_CONAN=OFF \
        -DBUILD_TOOLS=OFF \
        -DBUILD_ROUTED=OFF \
        -DBUILD_UNIT_TESTS=OFF \
        -DBoost_USE_STATIC_LIBS=ON \
        -DBOOST_ROOT="$stage" \
        -DTBB_DIR="$stage/lib/cmake/TBB" \
        -DZLIB_ROOT="$stage"
    # 'osrm' is the library target.
    cmake --build "$d/build-$abi" --target osrm -j"$NCPU"

    # Collect libosrm + any bundled static archives it produced.
    find "$d/build-$abi" -name "libosrm*.a" -exec cp -f {} "$stage/lib/" \;
    # Public headers.
    cp -rf "$d/include/osrm" "$stage/include/"
    cp -rf "$d/include/util" "$stage/include/" 2>/dev/null || true
    cp -rf "$d/include/engine" "$stage/include/" 2>/dev/null || true
}

# ===========================================================================
#  Collect the final flat prebuilt/ tree from a per-ABI staging prefix.
# ===========================================================================
collect() {
    local abi="$1"
    local stage="$OUT/staging/$abi"
    local dst="$OUT/lib/$abi"
    mkdir -p "$dst"

    # Every static archive the CMakeLists imports.
    for lib in libosrm libtbb \
               libboost_system libboost_filesystem libboost_iostreams \
               libboost_thread libboost_date_time \
               libspatialite libsqlite3 libproj libgeos_c libgeos libz; do
        # Some libs carry a version/variant suffix; grab the best match.
        f="$(ls "$stage/lib/${lib}"*.a 2>/dev/null | head -n1 || true)"
        if [ -n "$f" ]; then
            cp -f "$f" "$dst/${lib}.a"
        else
            echo "  !! MISSING $lib for $abi (check its build step)"
        fi
        # Strip debug info to shrink the archives.
        [ -f "$dst/${lib}.a" ] && "$STRIP" --strip-debug "$dst/${lib}.a" 2>/dev/null || true
    done
}

# ===========================================================================
#  Main
# ===========================================================================
for abi in "${ABIS[@]}"; do
    echo "==================================================================="
    echo "  Building ABI: $abi"
    echo "==================================================================="
    set_abi_env "$abi"

    build_zlib       "$abi"
    build_sqlite     "$abi"
    build_proj       "$abi"
    build_geos       "$abi"
    build_spatialite "$abi"
    build_boost      "$abi"
    build_tbb        "$abi"
    build_osrm       "$abi"

    collect          "$abi"
done

# Headers are ABI-agnostic: copy one complete staging include tree.
cp -rf "$OUT/staging/arm64-v8a/include/." "$OUT/include/"

echo
echo "==================================================================="
echo "  DONE. Artifacts:"
echo "==================================================================="
for abi in "${ABIS[@]}"; do
    echo "  $abi:"
    ls -1 "$OUT/lib/$abi" 2>/dev/null | sed 's/^/    /'
done
echo
echo "  Prebuilt tree ready at cpp/prebuilt/ (include/ + lib/<abi>/)."
echo "  You can now run the Gradle build for the app module."
