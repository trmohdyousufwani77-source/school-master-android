package `in`.gov.jk.schoolmaster.updates

import android.app.DownloadManager
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Environment
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.BufferedReader
import java.io.InputStreamReader
import java.net.HttpURLConnection
import java.net.URL
import java.util.Locale

data class GitHubBuildArtifact(
    val repoSlug: String,
    val releaseTag: String,
    val releaseName: String,
    val buildMode: String, // "Release" or "Debug"
    val assetName: String,
    val downloadUrl: String,
    val releasePageUrl: String,
    val sizeBytes: Long,
    val publishedAt: String,
    val isLiveFromApi: Boolean
)

sealed interface ApkDownloadOutcome {
    data class Enqueued(val downloadId: Long, val fileName: String) : ApkDownloadOutcome
    data class OpenedInBrowser(val url: String) : ApkDownloadOutcome
    data class Failed(val message: String) : ApkDownloadOutcome
}

object GitHubBuildReleaseClient {

    private const val PREFS_NAME = "school_master_github_updates"
    private const val KEY_REPO_SLUG = "github_repo_slug"

    fun loadSavedRepoSlug(context: Context, buildDefaultSlug: String): String {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val saved = prefs.getString(KEY_REPO_SLUG, null)?.trim().orEmpty()
        return normalizeRepoSlug(saved.ifEmpty { buildDefaultSlug })
    }

    fun saveRepoSlug(context: Context, rawInput: String): String {
        val normalized = normalizeRepoSlug(rawInput)
        context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            .edit()
            .putString(KEY_REPO_SLUG, normalized)
            .apply()
        return normalized
    }

    fun normalizeRepoSlug(raw: String): String {
        var cleaned = raw.trim()
        cleaned = cleaned.removePrefix("https://github.com/")
        cleaned = cleaned.removePrefix("http://github.com/")
        cleaned = cleaned.removePrefix("github.com/")
        cleaned = cleaned.removeSuffix(".git")
        cleaned = cleaned.trim('/')
        val parts = cleaned.split('/').filter { it.isNotBlank() }
        return if (parts.size >= 2) "${parts[0]}/${parts[1]}" else ""
    }

    fun buildDirectLatestApkUrl(repoSlug: String, preferRelease: Boolean = false): String {
        val normalized = normalizeRepoSlug(repoSlug)
        if (normalized.isEmpty()) return ""
        val asset = if (preferRelease) "SchoolMaster-release-latest.apk" else "SchoolMaster-debug-latest.apk"
        return "https://github.com/$normalized/releases/latest/download/$asset"
    }

    fun buildFallbackArtifact(repoSlug: String, preferRelease: Boolean = false): GitHubBuildArtifact? {
        val normalized = normalizeRepoSlug(repoSlug)
        if (normalized.isEmpty()) return null
        val asset = if (preferRelease) "SchoolMaster-release-latest.apk" else "SchoolMaster-debug-latest.apk"
        return GitHubBuildArtifact(
            repoSlug = normalized,
            releaseTag = "latest",
            releaseName = if (preferRelease) "Latest Production Release APK" else "Latest Automated Debug APK",
            buildMode = if (preferRelease) "Release" else "Debug",
            assetName = asset,
            downloadUrl = "https://github.com/$normalized/releases/latest/download/$asset",
            releasePageUrl = "https://github.com/$normalized/releases/latest",
            sizeBytes = 0L,
            publishedAt = "",
            isLiveFromApi = false
        )
    }

    suspend fun fetchLatestBuildArtifact(repoSlug: String): Result<GitHubBuildArtifact> =
        withContext(Dispatchers.IO) {
            val normalized = normalizeRepoSlug(repoSlug)
            if (normalized.isEmpty()) {
                return@withContext Result.failure(
                    IllegalArgumentException("Enter a valid GitHub repository in owner/repo format.")
                )
            }

            val apiUrl = "https://api.github.com/repos/$normalized/releases/latest"
            var connection: HttpURLConnection? = null
            try {
                connection = (URL(apiUrl).openConnection() as HttpURLConnection).apply {
                    requestMethod = "GET"
                    connectTimeout = 10_000
                    readTimeout = 10_000
                    setRequestProperty("Accept", "application/vnd.github+json")
                    setRequestProperty("User-Agent", "SchoolMaster-Android-Updater/1.0.4")
                }

                val code = connection.responseCode
                val stream = if (code in 200..299) connection.inputStream else connection.errorStream
                val body = stream?.use { input ->
                    BufferedReader(InputStreamReader(input)).readText()
                }.orEmpty()

                if (code !in 200..299) {
                    val hint = when (code) {
                        404 -> "No published GitHub Release found yet for $normalized."
                        403 -> "GitHub API rate limit reached. You can still use the direct latest APK URL."
                        else -> "GitHub API returned HTTP $code."
                    }
                    return@withContext Result.failure(IllegalStateException(hint))
                }

                val parsed = parseLatestReleaseJson(normalized, body)
                    ?: return@withContext Result.failure(
                        IllegalStateException("Latest release for $normalized does not contain an .apk asset.")
                    )

                Result.success(parsed)
            } catch (ex: Exception) {
                Result.failure(
                    IllegalStateException(
                        ex.localizedMessage ?: "Unable to reach GitHub Releases right now."
                    )
                )
            } finally {
                connection?.disconnect()
            }
        }

    fun parseLatestReleaseJson(repoSlug: String, jsonText: String): GitHubBuildArtifact? {
        val normalized = normalizeRepoSlug(repoSlug).ifEmpty { repoSlug.trim() }
        if (jsonText.isBlank()) return null

        val tagName = extractJsonString(jsonText, "tag_name") ?: "latest"
        val releaseName = extractJsonString(jsonText, "name") ?: "School Master ($tagName)"
        val htmlUrl = extractJsonString(jsonText, "html_url")
            ?: "https://github.com/$normalized/releases/tag/$tagName"
        val publishedAt = extractJsonString(jsonText, "published_at").orEmpty()

        val apkAssets = extractApkAssets(jsonText)
        if (apkAssets.isEmpty()) return null

        val chosen = apkAssets.firstOrNull {
            it.name.contains("release-latest", ignoreCase = true)
        } ?: apkAssets.firstOrNull {
            it.name.contains("release", ignoreCase = true)
        } ?: apkAssets.firstOrNull {
            it.name.contains("debug-latest", ignoreCase = true)
        } ?: apkAssets.first()

        val mode = if (
            chosen.name.contains("release", ignoreCase = true) ||
            (tagName.contains("release", ignoreCase = true) && !chosen.name.contains("debug", ignoreCase = true))
        ) {
            "Release"
        } else {
            "Debug"
        }

        return GitHubBuildArtifact(
            repoSlug = normalized,
            releaseTag = tagName,
            releaseName = releaseName,
            buildMode = mode,
            assetName = chosen.name,
            downloadUrl = chosen.downloadUrl,
            releasePageUrl = htmlUrl,
            sizeBytes = chosen.sizeBytes,
            publishedAt = publishedAt,
            isLiveFromApi = true
        )
    }

    fun enqueueApkDownload(context: Context, artifact: GitHubBuildArtifact): ApkDownloadOutcome {
        val url = artifact.downloadUrl.trim()
        if (url.isEmpty()) {
            return ApkDownloadOutcome.Failed("Download URL is empty.")
        }

        val safeFileName = artifact.assetName
            .ifBlank { "SchoolMaster-latest.apk" }
            .replace(Regex("[^A-Za-z0-9._-]"), "_")

        return try {
            val dm = context.getSystemService(Context.DOWNLOAD_SERVICE) as? DownloadManager
            if (dm != null) {
                val request = DownloadManager.Request(Uri.parse(url))
                    .setTitle("School Master (${artifact.releaseTag})")
                    .setDescription("Downloading $safeFileName from GitHub Releases")
                    .setMimeType("application/vnd.android.package-archive")
                    .setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED)
                    .setAllowedOverMetered(true)
                    .setAllowedOverRoaming(true)
                    .setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, safeFileName)

                val downloadId = dm.enqueue(request)
                ApkDownloadOutcome.Enqueued(downloadId = downloadId, fileName = safeFileName)
            } else {
                openUrlInBrowser(context, url)
            }
        } catch (_: Exception) {
            openUrlInBrowser(context, url)
        }
    }

    fun openUrlInBrowser(context: Context, url: String): ApkDownloadOutcome {
        return try {
            val intent = Intent(Intent.ACTION_VIEW, Uri.parse(url)).apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            context.startActivity(intent)
            ApkDownloadOutcome.OpenedInBrowser(url)
        } catch (ex: Exception) {
            ApkDownloadOutcome.Failed(ex.localizedMessage ?: "Unable to open download URL.")
        }
    }

    fun formatFileSize(bytes: Long): String {
        if (bytes <= 0L) return "Size available on download"
        val kb = bytes / 1024.0
        val mb = kb / 1024.0
        return when {
            mb >= 1.0 -> String.format(Locale.US, "%.2f MB", mb)
            kb >= 1.0 -> String.format(Locale.US, "%.1f KB", kb)
            else -> "$bytes B"
        }
    }

    private data class ParsedApkAsset(
        val name: String,
        val sizeBytes: Long,
        val downloadUrl: String
    )

    private fun extractApkAssets(jsonText: String): List<ParsedApkAsset> {
        val assetsIndex = jsonText.indexOf("\"assets\"")
        if (assetsIndex < 0) return emptyList()
        val arrayStart = jsonText.indexOf('[', assetsIndex)
        if (arrayStart < 0) return emptyList()

        val blocks = splitTopLevelObjectsInArray(jsonText, arrayStart)
        return blocks.mapNotNull { obj ->
            val downloadUrl = extractJsonString(obj, "browser_download_url") ?: return@mapNotNull null
            val name = extractJsonString(obj, "name") ?: downloadUrl.substringAfterLast('/')
            if (!name.endsWith(".apk", ignoreCase = true) && !downloadUrl.endsWith(".apk", ignoreCase = true)) {
                return@mapNotNull null
            }
            val size = extractJsonLong(obj, "size") ?: 0L
            ParsedApkAsset(name = name, sizeBytes = size, downloadUrl = downloadUrl)
        }
    }

    private fun splitTopLevelObjectsInArray(json: String, arrayStartIndex: Int): List<String> {
        val objects = mutableListOf<String>()
        var inString = false
        var escaped = false
        var arrayDepth = 0
        var objectDepth = 0
        var currentObjStart = -1

        for (i in arrayStartIndex until json.length) {
            val ch = json[i]
            if (inString) {
                if (escaped) {
                    escaped = false
                } else if (ch == '\\') {
                    escaped = true
                } else if (ch == '"') {
                    inString = false
                }
                continue
            }

            when (ch) {
                '"' -> inString = true
                '[' -> arrayDepth++
                ']' -> {
                    arrayDepth--
                    if (arrayDepth <= 0) break
                }
                '{' -> {
                    if (arrayDepth == 1 && objectDepth == 0) {
                        currentObjStart = i
                    }
                    objectDepth++
                }
                '}' -> {
                    objectDepth--
                    if (arrayDepth == 1 && objectDepth == 0 && currentObjStart >= 0) {
                        objects.add(json.substring(currentObjStart, i + 1))
                        currentObjStart = -1
                    }
                }
            }
        }
        return objects
    }

    private fun extractJsonString(json: String, key: String): String? {
        val pattern = Regex("\"${Regex.escape(key)}\"\\s*:\\s*\"((?:\\\\.|[^\"\\\\])*)\"")
        val raw = pattern.find(json)?.groupValues?.getOrNull(1) ?: return null
        return raw
            .replace("\\/", "/")
            .replace("\\\"", "\"")
            .replace("\\\\", "\\")
            .replace("\\n", "\n")
    }

    private fun extractJsonLong(json: String, key: String): Long? {
        val pattern = Regex("\"${Regex.escape(key)}\"\\s*:\\s*(\\d+)")
        return pattern.find(json)?.groupValues?.getOrNull(1)?.toLongOrNull()
    }
}
