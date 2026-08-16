// ============================================================================
//  spatialite_bridge.cpp  —  JNI wrapper around statically-linked
//  SQLite (FTS5 + R*Tree) + SpatiaLite for offline spatial POI/Spot queries.
//
//  Kotlin side:  com.spotfinder.app.data.SpatiaLiteDatabase
//
//  Android's system libsqlite cannot dlopen mod_spatialite, so we link our own
//  sqlite3 + libspatialite statically (see CMakeLists.txt) and initialise the
//  SpatiaLite extension in-process via spatialite_init_ex().
//
//  Memory model
//  ------------
//   * nativeOpen  -> allocates one DbHandle (owns the sqlite3* and the
//                    SpatiaLite connection cache). Returned as a jlong.
//   * nativeClose -> closes the db and frees the cache exactly once.
//   * Prepared statements are always finalized; JNI strings/arrays are always
//     released, including on error paths.
// ============================================================================

#include <jni.h>
#include <android/log.h>

#include <string>
#include <sstream>
#include <cstdint>

#include <sqlite3.h>
#include <spatialite.h>

#define LOG_TAG "SpatiaLiteBridge"
#define LOGI(...) __android_log_print(ANDROID_LOG_INFO,  LOG_TAG, __VA_ARGS__)
#define LOGE(...) __android_log_print(ANDROID_LOG_ERROR, LOG_TAG, __VA_ARGS__)

namespace {

struct DbHandle {
    sqlite3 *db = nullptr;
    void *spatialite_cache = nullptr;   // from spatialite_alloc_connection()
};

inline DbHandle *fromJ(jlong h) {
    return reinterpret_cast<DbHandle *>(static_cast<uintptr_t>(h));
}

// RAII for GetStringUTFChars.
class ScopedUtf {
public:
    ScopedUtf(JNIEnv *env, jstring s) : env_(env), jstr_(s) {
        chars_ = (s != nullptr) ? env->GetStringUTFChars(s, nullptr) : nullptr;
    }
    ~ScopedUtf() { if (chars_) env_->ReleaseStringUTFChars(jstr_, chars_); }
    ScopedUtf(const ScopedUtf &) = delete;
    ScopedUtf &operator=(const ScopedUtf &) = delete;
    const char *c_str() const { return chars_ ? chars_ : ""; }
private:
    JNIEnv *env_;
    jstring jstr_;
    const char *chars_;
};

// Append a JSON-escaped string to `out`.
void appendJsonString(std::string &out, const char *s) {
    out.push_back('"');
    for (const char *p = s; p && *p; ++p) {
        switch (*p) {
            case '"':  out += "\\\""; break;
            case '\\': out += "\\\\"; break;
            case '\n': out += "\\n";  break;
            case '\r': out += "\\r";  break;
            case '\t': out += "\\t";  break;
            default:
                if (static_cast<unsigned char>(*p) < 0x20) {
                    char buf[8];
                    snprintf(buf, sizeof(buf), "\\u%04x", *p);
                    out += buf;
                } else {
                    out.push_back(*p);
                }
        }
    }
    out.push_back('"');
}

// Bind a Java String[] of text args to positional '?' parameters (1-based).
// Coordinates/radius are inlined as literals by the Kotlin layer; only free
// text (FTS terms, titles, descriptions) arrives here, bound safely to avoid
// SQL injection.
bool bindTextArgs(JNIEnv *env, sqlite3_stmt *stmt, jobjectArray args) {
    if (args == nullptr) return true;
    const jsize n = env->GetArrayLength(args);
    for (jsize i = 0; i < n; ++i) {
        auto js = reinterpret_cast<jstring>(env->GetObjectArrayElement(args, i));
        if (js == nullptr) {
            sqlite3_bind_null(stmt, i + 1);
        } else {
            ScopedUtf s(env, js);
            // SQLITE_TRANSIENT: sqlite copies the bytes, so our buffer can die.
            sqlite3_bind_text(stmt, i + 1, s.c_str(), -1, SQLITE_TRANSIENT);
            env->DeleteLocalRef(js);
        }
    }
    return true;
}

} // namespace

extern "C" {

// ---------------------------------------------------------------------------
//  nativeOpen: open db read/write and initialise the SpatiaLite extension.
// ---------------------------------------------------------------------------
JNIEXPORT jlong JNICALL
Java_com_spotfinder_app_data_SpatiaLiteDatabase_nativeOpen(JNIEnv *env, jobject /*thiz*/,
                                                           jstring dbPath) {
    ScopedUtf path(env, dbPath);
    if (std::string(path.c_str()).empty()) {
        LOGE("nativeOpen: empty path");
        return 0;
    }

    auto *h = new DbHandle();
    int rc = sqlite3_open_v2(path.c_str(), &h->db,
                             SQLITE_OPEN_READWRITE, nullptr);
    if (rc != SQLITE_OK) {
        LOGE("nativeOpen: sqlite3_open_v2 failed: %s",
             h->db ? sqlite3_errmsg(h->db) : "unknown");
        if (h->db) sqlite3_close(h->db);
        delete h;
        return 0;
    }

    // Attach the SpatiaLite spatial engine to this connection.
    h->spatialite_cache = spatialite_alloc_connection();
    spatialite_init_ex(h->db, h->spatialite_cache, 0);

    // WAL keeps custom_spots writes from blocking concurrent reads.
    sqlite3_exec(h->db, "PRAGMA journal_mode=WAL;", nullptr, nullptr, nullptr);

    LOGI("nativeOpen: opened %s", path.c_str());
    return static_cast<jlong>(reinterpret_cast<uintptr_t>(h));
}

// ---------------------------------------------------------------------------
//  nativeQueryJson: run a SELECT, return rows as a JSON array of objects.
// ---------------------------------------------------------------------------
JNIEXPORT jstring JNICALL
Java_com_spotfinder_app_data_SpatiaLiteDatabase_nativeQueryJson(JNIEnv *env, jobject /*thiz*/,
                                                                jlong handle, jstring sql,
                                                                jobjectArray args) {
    DbHandle *h = fromJ(handle);
    if (h == nullptr || h->db == nullptr) {
        return env->NewStringUTF(R"({"error":"db not open"})");
    }

    ScopedUtf sqlStr(env, sql);
    sqlite3_stmt *stmt = nullptr;
    int rc = sqlite3_prepare_v2(h->db, sqlStr.c_str(), -1, &stmt, nullptr);
    if (rc != SQLITE_OK) {
        std::string err = std::string(R"({"error":)");
        appendJsonString(err, sqlite3_errmsg(h->db));
        err.push_back('}');
        LOGE("nativeQueryJson: prepare failed: %s", sqlite3_errmsg(h->db));
        return env->NewStringUTF(err.c_str());
    }

    bindTextArgs(env, stmt, args);

    std::string out = "[";
    bool firstRow = true;
    const int cols = sqlite3_column_count(stmt);

    while ((rc = sqlite3_step(stmt)) == SQLITE_ROW) {
        if (!firstRow) out.push_back(',');
        firstRow = false;
        out.push_back('{');
        for (int c = 0; c < cols; ++c) {
            if (c > 0) out.push_back(',');
            appendJsonString(out, sqlite3_column_name(stmt, c));
            out.push_back(':');
            switch (sqlite3_column_type(stmt, c)) {
                case SQLITE_INTEGER: {
                    out += std::to_string(sqlite3_column_int64(stmt, c));
                    break;
                }
                case SQLITE_FLOAT: {
                    std::ostringstream oss;
                    oss.precision(9);
                    oss << std::fixed << sqlite3_column_double(stmt, c);
                    out += oss.str();
                    break;
                }
                case SQLITE_NULL: {
                    out += "null";
                    break;
                }
                default: {
                    const auto *txt = reinterpret_cast<const char *>(
                        sqlite3_column_text(stmt, c));
                    appendJsonString(out, txt ? txt : "");
                }
            }
        }
        out.push_back('}');
    }

    sqlite3_finalize(stmt);   // always finalize
    out.push_back(']');

    if (rc != SQLITE_DONE) {
        LOGE("nativeQueryJson: step failed: %s", sqlite3_errmsg(h->db));
    }
    return env->NewStringUTF(out.c_str());
}

// ---------------------------------------------------------------------------
//  nativeInsert: run an INSERT, return last_insert_rowid() (0 on failure).
// ---------------------------------------------------------------------------
JNIEXPORT jlong JNICALL
Java_com_spotfinder_app_data_SpatiaLiteDatabase_nativeInsert(JNIEnv *env, jobject /*thiz*/,
                                                             jlong handle, jstring sql,
                                                             jobjectArray args) {
    DbHandle *h = fromJ(handle);
    if (h == nullptr || h->db == nullptr) return -1;

    ScopedUtf sqlStr(env, sql);
    sqlite3_stmt *stmt = nullptr;
    if (sqlite3_prepare_v2(h->db, sqlStr.c_str(), -1, &stmt, nullptr) != SQLITE_OK) {
        LOGE("nativeInsert: prepare failed: %s", sqlite3_errmsg(h->db));
        return -1;
    }
    bindTextArgs(env, stmt, args);

    jlong rowid = -1;
    if (sqlite3_step(stmt) == SQLITE_DONE) {
        rowid = static_cast<jlong>(sqlite3_last_insert_rowid(h->db));
    } else {
        LOGE("nativeInsert: step failed: %s", sqlite3_errmsg(h->db));
    }
    sqlite3_finalize(stmt);
    return rowid;
}

// ---------------------------------------------------------------------------
//  nativeExecute: run an UPDATE/DELETE, return rows affected (-1 on failure).
// ---------------------------------------------------------------------------
JNIEXPORT jint JNICALL
Java_com_spotfinder_app_data_SpatiaLiteDatabase_nativeExecute(JNIEnv *env, jobject /*thiz*/,
                                                              jlong handle, jstring sql,
                                                              jobjectArray args) {
    DbHandle *h = fromJ(handle);
    if (h == nullptr || h->db == nullptr) return -1;

    ScopedUtf sqlStr(env, sql);
    sqlite3_stmt *stmt = nullptr;
    if (sqlite3_prepare_v2(h->db, sqlStr.c_str(), -1, &stmt, nullptr) != SQLITE_OK) {
        LOGE("nativeExecute: prepare failed: %s", sqlite3_errmsg(h->db));
        return -1;
    }
    bindTextArgs(env, stmt, args);

    jint changes = -1;
    if (sqlite3_step(stmt) == SQLITE_DONE) {
        changes = sqlite3_changes(h->db);
    } else {
        LOGE("nativeExecute: step failed: %s", sqlite3_errmsg(h->db));
    }
    sqlite3_finalize(stmt);
    return changes;
}

// ---------------------------------------------------------------------------
//  nativeClose: free db + SpatiaLite cache exactly once.
// ---------------------------------------------------------------------------
JNIEXPORT void JNICALL
Java_com_spotfinder_app_data_SpatiaLiteDatabase_nativeClose(JNIEnv * /*env*/, jobject /*thiz*/,
                                                            jlong handle) {
    DbHandle *h = fromJ(handle);
    if (h == nullptr) return;
    if (h->db) sqlite3_close(h->db);
    if (h->spatialite_cache) spatialite_cleanup_ex(h->spatialite_cache);
    delete h;
    LOGI("nativeClose: handle freed");
}

} // extern "C"
