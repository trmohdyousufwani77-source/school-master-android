package `in`.gov.jk.schoolmaster.security

import android.content.ComponentName
import android.content.ContentValues
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Canvas
import android.graphics.Color as AndroidColor
import android.graphics.Paint
import android.graphics.Rect
import android.graphics.RectF
import android.graphics.Typeface
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.CancellationSignal
import android.os.ParcelFileDescriptor
import android.print.PageRange
import android.print.PrintAttributes
import android.print.PrintDocumentAdapter
import android.print.PrintDocumentInfo
import android.print.PrintManager
import android.print.pdf.PrintedPdfDocument
import android.provider.MediaStore
import androidx.core.content.FileProvider
import `in`.gov.jk.schoolmaster.data.local.BiometricAuditLogEntity
import `in`.gov.jk.schoolmaster.data.local.ScannerHistoryEntity
import `in`.gov.jk.schoolmaster.data.local.TeacherAttendanceEntity
import `in`.gov.jk.schoolmaster.qr.QrCodeGenerator
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.io.File
import java.io.FileOutputStream
import java.io.OutputStreamWriter
import java.net.HttpURLConnection
import java.net.URI
import java.net.URL
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

enum class LauncherIconAlias(val aliasShortName: String, val displayName: String) {
    DEFAULT(".MainActivityDefault", "Classic Indigo"),
    EMERALD(".MainActivityEmerald", "Emerald Crest"),
    GOLD(".MainActivityGold", "Gold Heritage")
}

object SecurityPreferences {
    private const val PREFS_NAME = "school_master_security_prefs"
    private const val KEY_MANDATORY_BIOMETRIC = "mandatory_biometric_auth"
    private const val KEY_LAUNCHER_ALIAS = "launcher_icon_alias"

    fun isMandatoryBiometricEnabled(context: Context): Boolean {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        return prefs.getBoolean(KEY_MANDATORY_BIOMETRIC, true)
    }

    fun setMandatoryBiometricEnabled(context: Context, enabled: Boolean) {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        prefs.edit().putBoolean(KEY_MANDATORY_BIOMETRIC, enabled).apply()
    }

    fun getActiveLauncherIconAlias(context: Context): LauncherIconAlias {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val stored = prefs.getString(KEY_LAUNCHER_ALIAS, LauncherIconAlias.DEFAULT.name)
        return LauncherIconAlias.entries.find { it.name == stored } ?: LauncherIconAlias.DEFAULT
    }

    fun applyLauncherIconAlias(context: Context, target: LauncherIconAlias) {
        val pm = context.packageManager
        val pkg = context.packageName
        LauncherIconAlias.entries.forEach { alias ->
            val componentName = ComponentName(pkg, "$pkg${alias.aliasShortName}")
            val newState = if (alias == target) {
                PackageManager.COMPONENT_ENABLED_STATE_ENABLED
            } else {
                PackageManager.COMPONENT_ENABLED_STATE_DISABLED
            }
            try {
                pm.setComponentEnabledSetting(
                    componentName,
                    newState,
                    PackageManager.DONT_KILL_APP
                )
            } catch (_: Exception) {
                // Ignore if alias cannot be toggled in test/instrumented environments
            }
        }
        context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            .edit()
            .putString(KEY_LAUNCHER_ALIAS, target.name)
            .apply()
    }
}

object BiometricAuditCsvExporter {

    private fun escapeCsvField(raw: String): String {
        val cleaned = raw.replace("\"", "\"\"")
        return "\"$cleaned\""
    }

    fun formatAuditLogsToCsv(logs: List<BiometricAuditLogEntity>): String {
        val formatter = SimpleDateFormat("yyyy-MM-dd HH:mm:ss", Locale.US)
        val header = "ID,Timestamp,Actor Name,Event Type,Auth Method,Module,Description"
        val rows = logs.map { entry ->
            listOf(
                entry.id.toString(),
                escapeCsvField(formatter.format(Date(entry.timestampMillis))),
                escapeCsvField(entry.actorName),
                escapeCsvField(entry.eventType),
                escapeCsvField(entry.authMethod),
                escapeCsvField(entry.moduleName),
                escapeCsvField(entry.description.ifBlank { entry.detailMessage })
            ).joinToString(",")
        }
        return (listOf(header) + rows).joinToString("\n")
    }

    fun writeCsvToUri(context: Context, uri: Uri, logs: List<BiometricAuditLogEntity>): Boolean {
        return try {
            val csvText = formatAuditLogsToCsv(logs)
            context.contentResolver.openOutputStream(uri)?.use { out ->
                out.write(csvText.toByteArray(Charsets.UTF_8))
                out.flush()
            }
            true
        } catch (_: Exception) {
            false
        }
    }

    fun shareAuditLogsCsv(context: Context, logs: List<BiometricAuditLogEntity>): Boolean {
        return try {
            val dir = File(context.cacheDir, "shared_csv").apply { mkdirs() }
            val file = File(dir, "SchoolMaster_Biometric_Audit_${System.currentTimeMillis()}.csv")
            file.writeText(formatAuditLogsToCsv(logs), Charsets.UTF_8)

            val uri = FileProvider.getUriForFile(
                context,
                "${context.packageName}.fileprovider",
                file
            )

            val intent = Intent(Intent.ACTION_SEND).apply {
                type = "text/csv"
                putExtra(Intent.EXTRA_SUBJECT, "School Master — Biometric Security Audit Log")
                putExtra(Intent.EXTRA_STREAM, uri)
                addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
            }
            context.startActivity(Intent.createChooser(intent, "Share Biometric Audit CSV"))
            true
        } catch (_: Exception) {
            false
        }
    }

    fun shareBitmapImage(
        context: Context,
        bitmap: Bitmap,
        subDir: String,
        fileNamePrefix: String,
        chooserTitle: String,
        shareText: String = "",
        preferWhatsApp: Boolean = false
    ): Boolean {
        return try {
            val dir = File(context.cacheDir, subDir).apply { mkdirs() }
            val safePrefix = fileNamePrefix.replace(Regex("[^A-Za-z0-9_-]"), "_")
            val file = File(dir, "${safePrefix}_${System.currentTimeMillis()}.png")
            FileOutputStream(file).use { out ->
                bitmap.compress(Bitmap.CompressFormat.PNG, 100, out)
                out.flush()
            }

            val uri = FileProvider.getUriForFile(
                context,
                "${context.packageName}.fileprovider",
                file
            )

            val intent = Intent(Intent.ACTION_SEND).apply {
                type = "image/png"
                putExtra(Intent.EXTRA_STREAM, uri)
                if (shareText.isNotBlank()) {
                    putExtra(Intent.EXTRA_TEXT, shareText)
                }
                addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                if (preferWhatsApp) {
                    setPackage("com.whatsapp")
                }
            }
            try {
                context.startActivity(
                    if (preferWhatsApp) intent else Intent.createChooser(intent, chooserTitle)
                )
            } catch (_: Exception) {
                // Fallback to general share chooser if WhatsApp is not installed
                intent.setPackage(null)
                context.startActivity(Intent.createChooser(intent, chooserTitle))
            }
            true
        } catch (_: Exception) {
            false
        }
    }
}

object ScannerHistoryCsvExporter {

    private fun escapeCsvField(raw: String): String {
        val cleaned = raw.replace("\"", "\"\"").replace("\r", " ").replace("\n", " | ")
        return "\"$cleaned\""
    }

    fun formatScannerHistoryToCsv(entries: List<ScannerHistoryEntity>): String {
        val formatter = SimpleDateFormat("yyyy-MM-dd HH:mm:ss", Locale.US)
        val header = "ID,Timestamp,Student Name,Admission Number,Class & Section,Sync Status,QR Payload"
        val rows = entries.map { entry ->
            listOf(
                entry.id.toString(),
                escapeCsvField(formatter.format(Date(entry.scannedAtMillis))),
                escapeCsvField(entry.studentName),
                escapeCsvField(entry.admissionNumber),
                escapeCsvField(entry.classSection),
                escapeCsvField(entry.syncStatus),
                escapeCsvField(entry.rawQrPayload)
            ).joinToString(",")
        }
        return (listOf(header) + rows).joinToString("\n")
    }

    fun writeCsvToUri(context: Context, uri: Uri, entries: List<ScannerHistoryEntity>): Boolean {
        return try {
            val csvText = formatScannerHistoryToCsv(entries)
            context.contentResolver.openOutputStream(uri)?.use { out ->
                out.write(csvText.toByteArray(Charsets.UTF_8))
                out.flush()
            }
            true
        } catch (_: Exception) {
            false
        }
    }
}

/**
 * Strictly manual Headmaster profile store.
 * Persisted independently in SharedPreferences and NEVER automatically overwritten
 * by any other database, teacher table, or module.
 */
data class ManualHeadmasterProfile(
    val fullName: String = "Mohd Yousuf Wani",
    val designation: String = "Headmaster",
    val qualification: String = "M.Sc., M.Ed.",
    val contactNumber: String = "+91 94190-00000",
    val email: String = "headmaster@gmspamposh.edu.in",
    val manuallyEdited: Boolean = false
)

object ManualHeadmasterStore {
    private const val PREFS_NAME = "school_master_manual_headmaster_v1"
    private const val KEY_NAME = "hm_name"
    private const val KEY_DESIGNATION = "hm_designation"
    private const val KEY_QUALIFICATION = "hm_qualification"
    private const val KEY_CONTACT = "hm_contact"
    private const val KEY_EMAIL = "hm_email"
    private const val KEY_MANUALLY_EDITED = "hm_manually_edited"

    private val _version = MutableStateFlow(0)
    val version: StateFlow<Int> = _version.asStateFlow()

    fun load(context: Context): ManualHeadmasterProfile {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        return ManualHeadmasterProfile(
            fullName = prefs.getString(KEY_NAME, "Mohd Yousuf Wani").orEmpty().ifBlank { "Mohd Yousuf Wani" },
            designation = prefs.getString(KEY_DESIGNATION, "Headmaster").orEmpty().ifBlank { "Headmaster" },
            qualification = prefs.getString(KEY_QUALIFICATION, "M.Sc., M.Ed.").orEmpty(),
            contactNumber = prefs.getString(KEY_CONTACT, "+91 94190-00000").orEmpty(),
            email = prefs.getString(KEY_EMAIL, "headmaster@gmspamposh.edu.in").orEmpty(),
            manuallyEdited = prefs.getBoolean(KEY_MANUALLY_EDITED, false)
        )
    }

    fun saveManual(context: Context, profile: ManualHeadmasterProfile) {
        context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            .edit()
            .putString(KEY_NAME, profile.fullName.trim())
            .putString(KEY_DESIGNATION, profile.designation.trim().ifBlank { "Headmaster" })
            .putString(KEY_QUALIFICATION, profile.qualification.trim())
            .putString(KEY_CONTACT, profile.contactNumber.trim())
            .putString(KEY_EMAIL, profile.email.trim())
            .putBoolean(KEY_MANUALLY_EDITED, true)
            .apply()
        _version.value = _version.value + 1
    }
}

/**
 * Centralized Official School Logo manager.
 * Shared identically across the School Master Widget, Automatic School Logo Generator,
 * Smart ID Card Maker, and Holistic Progress Card without automatic regeneration.
 */
object OfficialLogoStore {
    private const val FILE_NAME = "official_school_logo.png"

    private val _logoVersion = MutableStateFlow(0)
    val logoVersion: StateFlow<Int> = _logoVersion.asStateFlow()

    private fun logoFile(context: Context): File = File(context.filesDir, FILE_NAME)

    fun hasOfficialLogo(context: Context): Boolean {
        val f = logoFile(context)
        return f.exists() && f.length() > 0L
    }

    fun loadOfficialLogoBitmap(context: Context): Bitmap? {
        val f = logoFile(context)
        if (!f.exists() || f.length() == 0L) return null
        return try {
            BitmapFactory.decodeFile(f.absolutePath)
        } catch (_: Exception) {
            null
        }
    }

    fun saveLogoFromUri(context: Context, uri: Uri): Boolean {
        return try {
            val bitmap = context.contentResolver.openInputStream(uri)?.use { stream ->
                BitmapFactory.decodeStream(stream)
            } ?: return false
            saveLogoBitmap(context, bitmap)
        } catch (_: Exception) {
            false
        }
    }

    fun saveLogoBitmap(context: Context, bitmap: Bitmap): Boolean {
        return try {
            val target = logoFile(context)
            FileOutputStream(target).use { out ->
                bitmap.compress(Bitmap.CompressFormat.PNG, 100, out)
                out.flush()
            }
            _logoVersion.value = _logoVersion.value + 1
            true
        } catch (_: Exception) {
            false
        }
    }

    fun deleteOfficialLogo(context: Context): Boolean {
        val target = logoFile(context)
        val deleted = if (target.exists()) target.delete() else true
        _logoVersion.value = _logoVersion.value + 1
        return deleted
    }
}

/**
 * Individual Student/Staff Smart ID Card renderer & exporter (PDF via PrintManager + JPEG via MediaStore).
 */
object SmartIdCardExporter {

    fun renderSmartIdCardBitmap(
        context: Context,
        holderName: String,
        subtitleLine: String,
        idNumber: String,
        extraDetail: String,
        isStudent: Boolean,
        qrPayload: String,
        schoolName: String = "GOVT MIDDLE SCHOOL PAMPOSH COLONY",
        academicSession: String = "Session 2026-2027"
    ): Bitmap {
        val width = 1050
        val height = 650
        val bitmap = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888)
        val canvas = Canvas(bitmap)
        val hm = ManualHeadmasterStore.load(context)
        val officialLogo = OfficialLogoStore.loadOfficialLogoBitmap(context)

        val primaryColor = if (isStudent) AndroidColor.parseColor("#1E1B4B") else AndroidColor.parseColor("#065F46")
        val accentColor = AndroidColor.parseColor("#F59E0B")

        val bgPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = AndroidColor.WHITE }
        val headerPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = primaryColor }
        val accentPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = accentColor }
        val borderPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = primaryColor
            style = Paint.Style.STROKE
            strokeWidth = 6f
        }

        canvas.drawRoundRect(RectF(6f, 6f, width - 6f, height - 6f), 28f, 28f, bgPaint)
        canvas.drawRoundRect(RectF(6f, 6f, width - 6f, height - 6f), 28f, 28f, borderPaint)

        // Official Header Band
        canvas.drawRect(8f, 8f, width - 8f, 134f, headerPaint)
        canvas.drawRect(8f, 134f, width - 8f, 144f, accentPaint)

        // Centralized Official School Logo inside Header
        val logoBox = RectF(28f, 22f, 118f, 112f)
        val logoBg = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = AndroidColor.WHITE }
        canvas.drawRoundRect(logoBox, 16f, 16f, logoBg)
        if (officialLogo != null) {
            canvas.drawBitmap(officialLogo, null, RectF(34f, 28f, 112f, 106f), null)
        } else {
            val fallbackPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
                color = primaryColor
                textSize = 28f
                textAlign = Paint.Align.CENTER
                typeface = Typeface.create(Typeface.DEFAULT, Typeface.BOLD)
            }
            canvas.drawText("SM", logoBox.centerX(), logoBox.centerY() + 10f, fallbackPaint)
        }

        val titlePaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = AndroidColor.WHITE
            textSize = 28f
            typeface = Typeface.create(Typeface.DEFAULT, Typeface.BOLD)
        }
        val subPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = AndroidColor.parseColor("#E0E7FF")
            textSize = 19f
        }
        val labelPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = AndroidColor.parseColor("#64748B")
            textSize = 19f
            typeface = Typeface.create(Typeface.DEFAULT, Typeface.BOLD)
        }
        val valuePaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = AndroidColor.parseColor("#0F172A")
            textSize = 25f
            typeface = Typeface.create(Typeface.DEFAULT, Typeface.BOLD)
        }

        canvas.drawText(schoolName.uppercase(), 140f, 62f, titlePaint)
        canvas.drawText(
            "${if (isStudent) "OFFICIAL STUDENT SMART ID CARD" else "OFFICIAL FACULTY SMART ID CARD"} • $academicSession",
            140f,
            100f,
            subPaint
        )

        // Left Details
        var y = 212f
        val rows = listOf(
            "FULL NAME" to holderName,
            (if (isStudent) "CLASS & ROLL" else "DESIGNATION") to subtitleLine,
            (if (isStudent) "ADMISSION NO." else "EMPLOYEE CODE") to idNumber,
            "DETAILS" to extraDetail
        )
        rows.forEach { (k, v) ->
            canvas.drawText(k, 38f, y, labelPaint)
            canvas.drawText(v.take(36), 38f, y + 32f, valuePaint)
            y += 88f
        }

        // Right Scannable QR Code
        if (qrPayload.isNotBlank()) {
            QrCodeGenerator.encodeQrBitmap(qrPayload, 290)?.let { qr ->
                val qrRect = Rect(width - 320, 180, width - 40, 460)
                val qrBorder = Paint(Paint.ANTI_ALIAS_FLAG).apply {
                    color = AndroidColor.parseColor("#CBD5E1")
                    style = Paint.Style.STROKE
                    strokeWidth = 3f
                }
                canvas.drawRect(qrRect, qrBorder)
                canvas.drawBitmap(qr, null, qrRect, null)
            }
        }

        // Bottom Signature Strip with Manual Headmaster Profile
        val linePaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = AndroidColor.parseColor("#CBD5E1")
            strokeWidth = 2f
        }
        canvas.drawLine(36f, height - 92f, width - 36f, height - 92f, linePaint)
        canvas.drawText("ISSUING AUTHORITY (${hm.designation.uppercase()})", 38f, height - 58f, labelPaint)
        canvas.drawText(hm.fullName, 38f, height - 26f, valuePaint)

        return bitmap
    }

    fun saveSmartIdAsJpeg(context: Context, bitmap: Bitmap, fileNamePrefix: String): Boolean {
        return try {
            val safePrefix = fileNamePrefix.replace(Regex("[^A-Za-z0-9_-]"), "_")
            val values = ContentValues().apply {
                put(MediaStore.Images.Media.DISPLAY_NAME, "${safePrefix}_${System.currentTimeMillis()}.jpg")
                put(MediaStore.Images.Media.MIME_TYPE, "image/jpeg")
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                    put(MediaStore.Images.Media.RELATIVE_PATH, "Pictures/SchoolMaster_SmartID")
                }
            }
            val uri = context.contentResolver.insert(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, values)
                ?: return false
            context.contentResolver.openOutputStream(uri)?.use { out ->
                bitmap.compress(Bitmap.CompressFormat.JPEG, 96, out)
                out.flush()
            }
            true
        } catch (_: Exception) {
            false
        }
    }

    fun printSmartIdAsPdf(context: Context, bitmap: Bitmap, jobTitle: String): Boolean {
        return try {
            val printManager = context.getSystemService(Context.PRINT_SERVICE) as? PrintManager ?: return false
            val adapter = object : PrintDocumentAdapter() {
                private var pdfDocument: PrintedPdfDocument? = null

                override fun onLayout(
                    oldAttributes: PrintAttributes?,
                    newAttributes: PrintAttributes,
                    cancellationSignal: CancellationSignal?,
                    callback: LayoutResultCallback,
                    extras: Bundle?
                ) {
                    if (cancellationSignal?.isCanceled == true) {
                        callback.onLayoutCancelled()
                        return
                    }
                    pdfDocument = PrintedPdfDocument(context, newAttributes)
                    val info = PrintDocumentInfo.Builder("${jobTitle.replace(Regex("[^A-Za-z0-9_-]"), "_")}.pdf")
                        .setContentType(PrintDocumentInfo.CONTENT_TYPE_DOCUMENT)
                        .setPageCount(1)
                        .build()
                    callback.onLayoutFinished(info, true)
                }

                override fun onWrite(
                    pages: Array<out PageRange>,
                    destination: ParcelFileDescriptor,
                    cancellationSignal: CancellationSignal?,
                    callback: WriteResultCallback
                ) {
                    val doc = pdfDocument ?: run {
                        callback.onWriteFailed("PDF document not initialized")
                        return
                    }
                    val page = doc.startPage(0)
                    val pageCanvas = page.canvas
                    val margin = 36f
                    val availW = pageCanvas.width - margin * 2f
                    val targetH = availW * (bitmap.height.toFloat() / bitmap.width.toFloat())
                    val destRect = RectF(margin, margin, margin + availW, margin + targetH)
                    pageCanvas.drawBitmap(bitmap, null, destRect, null)
                    doc.finishPage(page)

                    try {
                        FileOutputStream(destination.fileDescriptor).use { out ->
                            doc.writeTo(out)
                        }
                        callback.onWriteFinished(arrayOf(PageRange.ALL_PAGES))
                    } catch (e: Exception) {
                        callback.onWriteFailed(e.message)
                    } finally {
                        doc.close()
                        pdfDocument = null
                    }
                }
            }
            val attrs = PrintAttributes.Builder()
                .setMediaSize(PrintAttributes.MediaSize.ISO_A4)
                .setColorMode(PrintAttributes.COLOR_MODE_COLOR)
                .build()
            printManager.print(jobTitle, adapter, attrs)
            true
        } catch (_: Exception) {
            false
        }
    }
}

/**
 * Persistent configuration for the live School Master Web Portal & API backend URL.
 * Replaces hardcoded stale Cloud Run URLs and allows resetting or updating the endpoint at runtime.
 */
object PortalConfigStore {
    const val DEFAULT_PORTAL_URL =
        "https://ais-pre-nu5yauvtrpwkfmgp7wl44o-370699773036.asia-northeast1.run.app"

    private const val PREFS_NAME = "school_master_portal_config_v1"
    private const val KEY_PORTAL_URL = "portal_base_url"

    private val _urlVersion = MutableStateFlow(0)
    val urlVersion: StateFlow<Int> = _urlVersion.asStateFlow()

    fun normalizePortalUrl(raw: String): String {
        val trimmed = raw.trim().trimEnd('/')
        if (trimmed.isEmpty()) return ""
        val candidate = if (
            trimmed.startsWith("https://", ignoreCase = true) ||
            trimmed.startsWith("http://", ignoreCase = true)
        ) {
            trimmed
        } else if (trimmed.contains("://") || trimmed.startsWith("javascript:", ignoreCase = true) || trimmed.startsWith("file:", ignoreCase = true)) {
            return ""
        } else {
            "https://$trimmed"
        }
        return try {
            val uri = URI(candidate)
            val scheme = uri.scheme?.lowercase(Locale.US)
            val host = uri.host
            if ((scheme == "https" || scheme == "http") && !host.isNullOrBlank()) {
                candidate
            } else {
                ""
            }
        } catch (_: Exception) {
            ""
        }
    }

    fun loadPortalUrl(context: Context): String {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val saved = prefs.getString(KEY_PORTAL_URL, null).orEmpty()
        return normalizePortalUrl(saved).ifEmpty { DEFAULT_PORTAL_URL }
    }

    fun savePortalUrl(context: Context, rawUrl: String): String {
        val normalized = normalizePortalUrl(rawUrl)
        if (normalized.isNotEmpty()) {
            context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
                .edit()
                .putString(KEY_PORTAL_URL, normalized)
                .apply()
            _urlVersion.value = _urlVersion.value + 1
        }
        return normalized
    }

    fun resetToDefault(context: Context): String {
        context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            .edit()
            .remove(KEY_PORTAL_URL)
            .apply()
        _urlVersion.value = _urlVersion.value + 1
        return DEFAULT_PORTAL_URL
    }
}

sealed interface PortalSyncResult {
    data class Success(val syncedCount: Int, val message: String) : PortalSyncResult
    data class PartialOrFailed(val syncedCount: Int, val failedCount: Int, val message: String) : PortalSyncResult
}

/**
 * Lightweight HTTP client for syncing pending offline Room records with the School Master backend API.
 */
object PortalSyncClient {

    suspend fun syncPendingTeacherAttendance(
        baseUrl: String,
        pendingRecords: List<TeacherAttendanceEntity>
    ): PortalSyncResult = withContext(Dispatchers.IO) {
        val normalizedBase = PortalConfigStore.normalizePortalUrl(baseUrl)
        if (normalizedBase.isEmpty()) {
            return@withContext PortalSyncResult.PartialOrFailed(
                syncedCount = 0,
                failedCount = pendingRecords.size,
                message = "Invalid School Portal server URL configured."
            )
        }
        if (pendingRecords.isEmpty()) {
            return@withContext PortalSyncResult.Success(
                syncedCount = 0,
                message = "All attendance records are already synced."
            )
        }

        val endpoint = "$normalizedBase/api/teacher-attendance"
        var syncedCount = 0
        var failedCount = 0
        var lastError = ""

        for (record in pendingRecords) {
            var connection: HttpURLConnection? = null
            try {
                connection = (URL(endpoint).openConnection() as HttpURLConnection).apply {
                    requestMethod = "POST"
                    connectTimeout = 8_000
                    readTimeout = 8_000
                    doOutput = true
                    setRequestProperty("Content-Type", "application/json; charset=UTF-8")
                    setRequestProperty("Accept", "application/json")
                }

                val payload = JSONObject().apply {
                    put("id", record.id)
                    put("teacherId", record.teacherId)
                    put("teacherName", record.teacherName)
                    put("date", record.dateIso)
                    put("status", record.status)
                    put("arrivalTime", record.arrivalTime)
                    put("departureTime", record.departureTime)
                    put("designation", record.designation)
                    put("remarksByHoi", record.remarksByHoi)
                    put("updatedBy", record.updatedBy)
                }

                OutputStreamWriter(connection.outputStream, Charsets.UTF_8).use { writer ->
                    writer.write(payload.toString())
                    writer.flush()
                }

                val code = connection.responseCode
                if (code in 200..299) {
                    syncedCount++
                } else {
                    failedCount++
                    lastError = "Server returned HTTP $code"
                }
            } catch (ex: Exception) {
                failedCount++
                lastError = ex.localizedMessage ?: "Network unreachable"
            } finally {
                connection?.disconnect()
            }
        }

        if (failedCount == 0) {
            PortalSyncResult.Success(
                syncedCount = syncedCount,
                message = "Synced $syncedCount attendance record(s) with School Master server."
            )
        } else {
            PortalSyncResult.PartialOrFailed(
                syncedCount = syncedCount,
                failedCount = failedCount,
                message = "Synced $syncedCount, failed $failedCount ($lastError). Pending items kept safely offline."
            )
        }
    }
}

