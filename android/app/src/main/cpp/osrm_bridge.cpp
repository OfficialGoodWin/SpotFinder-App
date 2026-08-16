// ============================================================================
//  osrm_bridge.cpp  —  JNI wrapper around libosrm (MLD) for offline routing.
//
//  Kotlin side:  com.spotfinder.app.nav.OsrmEngine
//
//  Lifecycle / memory model
//  ------------------------
//   * nativeInit(basePath)      -> returns an opaque jlong handle that OWNS one
//                                  heap-allocated OsrmHandle (which owns the
//                                  osrm::OSRM engine). Returns 0 on failure.
//   * nativeRoute(handle, ...)  -> runs one query, returns a freshly allocated
//                                  jdoubleArray (caller/JVM owns it; GC frees).
//   * nativeDestroy(handle)     -> deletes the OsrmHandle exactly once.
//
//  Every native allocation has exactly one owner. JNI string/array resources are
//  released on every code path (including exceptions) so there are no leaks.
// ============================================================================

#include <jni.h>
#include <android/log.h>

#include <memory>
#include <string>
#include <vector>
#include <exception>

#include "osrm/osrm.hpp"
#include "osrm/engine_config.hpp"
#include "osrm/route_parameters.hpp"
#include "osrm/coordinate.hpp"
#include "osrm/json_container.hpp"
#include "osrm/status.hpp"

#define LOG_TAG "OsrmBridge"
#define LOGI(...) __android_log_print(ANDROID_LOG_INFO,  LOG_TAG, __VA_ARGS__)
#define LOGE(...) __android_log_print(ANDROID_LOG_ERROR, LOG_TAG, __VA_ARGS__)

namespace {

// Packed result-array layout (index -> meaning):
//   [0] status   : 1.0 = OK, 0.0 = no route / error
//   [1] distance : meters
//   [2] duration : seconds
//   [3] count N  : number of coordinate pairs that follow
//   [4 .. 4+2N)  : lat0, lon0, lat1, lon1, ...   (WGS84 degrees)
constexpr int HEADER = 4;

// Owns the engine for the lifetime of the handle. Created on the heap, deleted
// exactly once in nativeDestroy.
struct OsrmHandle {
    std::unique_ptr<osrm::OSRM> engine;
    std::string base_path;
};

inline OsrmHandle *fromJ(jlong h) {
    return reinterpret_cast<OsrmHandle *>(static_cast<uintptr_t>(h));
}

// RAII wrapper so GetStringUTFChars is always released, even if we throw.
class ScopedUtf {
public:
    ScopedUtf(JNIEnv *env, jstring s) : env_(env), jstr_(s) {
        chars_ = (s != nullptr) ? env->GetStringUTFChars(s, nullptr) : nullptr;
    }
    ~ScopedUtf() {
        if (chars_ != nullptr) env_->ReleaseStringUTFChars(jstr_, chars_);
    }
    ScopedUtf(const ScopedUtf &) = delete;
    ScopedUtf &operator=(const ScopedUtf &) = delete;
    const char *c_str() const { return chars_ ? chars_ : ""; }
private:
    JNIEnv *env_;
    jstring jstr_;
    const char *chars_;
};

// Build a jdoubleArray from a std::vector<double>. Returns a local ref owned by
// the JVM; nullptr on allocation failure.
jdoubleArray toJDoubleArray(JNIEnv *env, const std::vector<double> &v) {
    jdoubleArray arr = env->NewDoubleArray(static_cast<jsize>(v.size()));
    if (arr == nullptr) return nullptr; // OOM pending exception
    env->SetDoubleArrayRegion(arr, 0, static_cast<jsize>(v.size()), v.data());
    return arr;
}

// A single-element array signalling failure ([0] = 0.0).
jdoubleArray failureArray(JNIEnv *env) {
    std::vector<double> v(HEADER, 0.0);
    return toJDoubleArray(env, v);
}

} // namespace

extern "C" {

// ---------------------------------------------------------------------------
//  nativeInit: open the MLD dataset at `osrmBasePath` (e.g. ".../osrm/region.osrm").
// ---------------------------------------------------------------------------
JNIEXPORT jlong JNICALL
Java_com_spotfinder_app_nav_OsrmEngine_nativeInit(JNIEnv *env, jobject /*thiz*/,
                                                  jstring osrmBasePath) {
    ScopedUtf base(env, osrmBasePath);
    if (std::string(base.c_str()).empty()) {
        LOGE("nativeInit: empty base path");
        return 0;
    }

    // unique_ptr guards against leaking on any early return / exception until we
    // deliberately release ownership to the JVM as a jlong.
    auto handle = std::make_unique<OsrmHandle>();
    handle->base_path = base.c_str();

    try {
        osrm::EngineConfig config;
        config.storage_config = osrm::storage::StorageConfig(handle->base_path);
        // The dataset was produced with osrm-partition + osrm-customize, so it
        // MUST be loaded with the MLD algorithm. CH would refuse to load it.
        config.algorithm = osrm::EngineConfig::Algorithm::MLD;
        config.use_shared_memory = false;   // file-backed, single process on device
        config.use_mmap = true;             // memory-map the graph to keep RSS low

        if (!config.IsValid()) {
            LOGE("nativeInit: invalid engine config for %s", handle->base_path.c_str());
            return 0;
        }

        handle->engine = std::make_unique<osrm::OSRM>(config);
        LOGI("nativeInit: OSRM MLD loaded from %s", handle->base_path.c_str());
    } catch (const std::exception &e) {
        LOGE("nativeInit: exception: %s", e.what());
        return 0; // handle (and any partial engine) freed by unique_ptr here
    } catch (...) {
        LOGE("nativeInit: unknown exception");
        return 0;
    }

    // Transfer ownership to the JVM-held handle. Freed only by nativeDestroy.
    return static_cast<jlong>(reinterpret_cast<uintptr_t>(handle.release()));
}

// ---------------------------------------------------------------------------
//  nativeRoute: shortest route between (startLat,startLon) and (endLat,endLon).
//  libosrm queries are thread-safe and const, so no locking is required.
// ---------------------------------------------------------------------------
JNIEXPORT jdoubleArray JNICALL
Java_com_spotfinder_app_nav_OsrmEngine_nativeRoute(JNIEnv *env, jobject /*thiz*/,
                                                   jlong handlePtr,
                                                   jdouble startLat, jdouble startLon,
                                                   jdouble endLat, jdouble endLon) {
    OsrmHandle *handle = fromJ(handlePtr);
    if (handle == nullptr || !handle->engine) {
        LOGE("nativeRoute: null / uninitialized handle");
        return failureArray(env);
    }

    try {
        using namespace osrm;

        RouteParameters params;
        params.coordinates.push_back(
            {util::FloatLongitude{startLon}, util::FloatLatitude{startLat}});
        params.coordinates.push_back(
            {util::FloatLongitude{endLon}, util::FloatLatitude{endLat}});
        params.overview = RouteParameters::OverviewType::Full;
        params.geometries = RouteParameters::GeometriesType::GeoJSON;
        params.steps = false;
        params.annotations = false;

        engine::api::ResultT result = json::Object();
        const Status status = handle->engine->Route(params, result);
        auto &json_result = result.get<json::Object>();

        if (status != Status::Ok) {
            LOGE("nativeRoute: status not OK");
            return failureArray(env);
        }

        auto &routes = json_result.values["routes"].get<json::Array>();
        if (routes.values.empty()) {
            return failureArray(env);
        }

        auto &route = routes.values.at(0).get<json::Object>();
        const double distance = route.values["distance"].get<json::Number>().value;
        const double duration = route.values["duration"].get<json::Number>().value;

        auto &geometry = route.values["geometry"].get<json::Object>();
        auto &coords = geometry.values["coordinates"].get<json::Array>();
        const size_t n = coords.values.size();

        std::vector<double> out;
        out.reserve(HEADER + 2 * n);
        out.push_back(1.0);       // status OK
        out.push_back(distance);  // meters
        out.push_back(duration);  // seconds
        out.push_back(static_cast<double>(n));

        // GeoJSON coordinates are [lon, lat]; we emit lat, lon for the Kotlin side.
        for (size_t i = 0; i < n; ++i) {
            auto &pair = coords.values.at(i).get<json::Array>();
            const double lon = pair.values.at(0).get<json::Number>().value;
            const double lat = pair.values.at(1).get<json::Number>().value;
            out.push_back(lat);
            out.push_back(lon);
        }

        jdoubleArray arr = toJDoubleArray(env, out);
        return (arr != nullptr) ? arr : failureArray(env);
    } catch (const std::exception &e) {
        LOGE("nativeRoute: exception: %s", e.what());
        return failureArray(env);
    } catch (...) {
        LOGE("nativeRoute: unknown exception");
        return failureArray(env);
    }
}

// ---------------------------------------------------------------------------
//  nativeDestroy: free the engine and handle. Safe to call with 0.
// ---------------------------------------------------------------------------
JNIEXPORT void JNICALL
Java_com_spotfinder_app_nav_OsrmEngine_nativeDestroy(JNIEnv * /*env*/, jobject /*thiz*/,
                                                     jlong handlePtr) {
    OsrmHandle *handle = fromJ(handlePtr);
    if (handle != nullptr) {
        delete handle;             // ~unique_ptr releases the osrm::OSRM engine
        LOGI("nativeDestroy: handle freed");
    }
}

} // extern "C"
