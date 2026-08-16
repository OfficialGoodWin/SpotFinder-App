# ============================================================================
#  SpotFinder native layer.
#
#  Builds ONE shared library (libspotfinder_native.so) that Kotlin loads via
#  System.loadLibrary("spotfinder_native"). It statically links the pre-compiled
#  libosrm + libspatialite (and their full dependency graph) that were produced
#  by android/native-build into:
#
#      cpp/prebuilt/include/            (ABI-agnostic headers)
#      cpp/prebuilt/lib/<ABI>/*.a       (per-ABI static archives)
#
#  With abiFilters = ["arm64-v8a"] in build.gradle.kts, ${ANDROID_ABI} resolves
#  to "arm64-v8a", so PB_LIB below points at cpp/prebuilt/lib/arm64-v8a.
# ============================================================================
cmake_minimum_required(VERSION 3.22.1)
project("spotfinder_native")

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# ---------------------------------------------------------------------------
#  Prebuilt tree location (selected per ABI by the NDK toolchain variable).
# ---------------------------------------------------------------------------
set(PREBUILT "${CMAKE_CURRENT_SOURCE_DIR}/prebuilt")
set(PB_INC   "${PREBUILT}/include")
set(PB_LIB   "${PREBUILT}/lib/${ANDROID_ABI}")

if(NOT EXISTS "${PB_LIB}")
    message(FATAL_ERROR
        "No prebuilt static libs for ABI '${ANDROID_ABI}' at:\n  ${PB_LIB}\n"
        "Run android/native-build first (docker build + docker run).")
endif()

# Explicit search path for the static archives (no placeholders).
link_directories("${PB_LIB}")
include_directories(
    "${PB_INC}"
    "${PB_INC}/osrm"
    "${PB_INC}/spatialite"
)

# ---------------------------------------------------------------------------
#  Declare each pre-compiled archive as a STATIC IMPORTED target with an exact
#  IMPORTED_LOCATION. These are the files collect() drops into prebuilt/lib.
# ---------------------------------------------------------------------------
function(import_static NAME FILE)
    add_library(${NAME} STATIC IMPORTED)
    set_target_properties(${NAME} PROPERTIES
        IMPORTED_LOCATION "${PB_LIB}/${FILE}")
endfunction()

# --- OSRM routing engine + its dependencies ---
import_static(osrm             libosrm.a)
import_static(tbb              libtbb.a)
import_static(boost_system     libboost_system.a)
import_static(boost_filesystem libboost_filesystem.a)
import_static(boost_iostreams  libboost_iostreams.a)
import_static(boost_thread     libboost_thread.a)
import_static(boost_date_time  libboost_date_time.a)

# --- SpatiaLite spatial DB + its dependencies ---
import_static(spatialite       libspatialite.a)
import_static(sqlite3          libsqlite3.a)   # compiled with FTS5 + RTREE
import_static(proj             libproj.a)
import_static(geos_c           libgeos_c.a)
import_static(geos             libgeos.a)
import_static(zlibstatic       libz.a)

# ---------------------------------------------------------------------------
#  Our JNI shared library.
# ---------------------------------------------------------------------------
add_library(spotfinder_native SHARED
    osrm_bridge.cpp
    spatialite_bridge.cpp
)

# Android system libs.
find_library(log-lib log)
find_library(android-lib android)

# ---------------------------------------------------------------------------
#  Link. --start-group/--end-group lets the static linker resolve the circular
#  references between osrm<->boost<->tbb and spatialite<->geos<->proj<->sqlite
#  without hand-tuning order.
# ---------------------------------------------------------------------------
target_link_libraries(spotfinder_native
    -Wl,--start-group
        osrm
        boost_system
        boost_filesystem
        boost_iostreams
        boost_thread
        boost_date_time
        tbb
        spatialite
        sqlite3
        proj
        geos_c
        geos
        zlibstatic
    -Wl,--end-group
    ${log-lib}
    ${android-lib}
)
