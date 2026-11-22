package `in`.gov.jk.schoolmaster.ui

import android.Manifest
import android.content.pm.PackageManager
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.camera.core.CameraSelector
import androidx.camera.core.ImageAnalysis
import androidx.camera.core.ImageProxy
import androidx.camera.core.Preview
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.camera.view.PreviewView
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.CheckCircle
import androidx.compose.material.icons.rounded.Close
import androidx.compose.material.icons.rounded.CloudDone
import androidx.compose.material.icons.rounded.CloudOff
import androidx.compose.material.icons.rounded.Download
import androidx.compose.material.icons.rounded.History
import androidx.compose.material.icons.rounded.Palette
import androidx.compose.material.icons.rounded.Pause
import androidx.compose.material.icons.rounded.PlayArrow
import androidx.compose.material.icons.rounded.QrCodeScanner
import androidx.compose.material.icons.rounded.Search
import androidx.compose.material.icons.rounded.Sync
import androidx.compose.material.icons.rounded.Warning
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.FilterChip
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.SegmentedButton
import androidx.compose.material3.SegmentedButtonDefaults
import androidx.compose.material3.SingleChoiceSegmentedButtonRow
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableLongStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalLifecycleOwner
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.core.content.ContextCompat
import com.airbnb.lottie.compose.LottieAnimation
import com.airbnb.lottie.compose.LottieCompositionSpec
import com.airbnb.lottie.compose.LottieConstants
import com.airbnb.lottie.compose.rememberLottieComposition
import com.google.zxing.BinaryBitmap
import com.google.zxing.MultiFormatReader
import com.google.zxing.PlanarYUVLuminanceSource
import com.google.zxing.common.HybridBinarizer
import `in`.gov.jk.schoolmaster.data.local.ScannerHistoryEntity
import `in`.gov.jk.schoolmaster.data.local.StudentEntity
import `in`.gov.jk.schoolmaster.data.local.TeacherAttendanceEntity
import `in`.gov.jk.schoolmaster.security.LauncherIconAlias
import `in`.gov.jk.schoolmaster.security.ScannerHistoryCsvExporter
import `in`.gov.jk.schoolmaster.security.SecurityPreferences
import kotlinx.coroutines.launch
import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Date
import java.util.Locale
import java.util.concurrent.Executors

// Self-contained minimal Lottie JSON animation for Sync Status Dashboard (works 100% offline)
private const val SYNC_LOTTIE_JSON = """
{
  "v": "5.7.4",
  "fr": 30,
  "ip": 0,
  "op": 60,
  "w": 120,
  "h": 120,
  "nm": "SyncPulse",
  "ddd": 0,
  "assets": [],
  "layers": [
    {
      "ddd": 0,
      "ind": 1,
      "ty": 4,
      "nm": "SpinnerRing",
      "sr": 1,
      "ks": {
        "o": { "a": 0, "k": 100 },
        "r": {
          "a": 1,
          "k": [
            { "t": 0, "s": [0] },
            { "t": 60, "s": [360] }
          ]
        },
        "p": { "a": 0, "k": [60, 60, 0] },
        "a": { "a": 0, "k": [0, 0, 0] },
        "s": { "a": 0, "k": [100, 100, 100] }
      },
      "shapes": [
        {
          "ty": "el",
          "p": { "a": 0, "k": [0, 0] },
          "s": { "a": 0, "k": [76, 76] },
          "nm": "Circle"
        },
        {
          "ty": "st",
          "c": { "a": 0, "k": [0.31, 0.27, 0.90, 1] },
          "o": { "a": 0, "k": 100 },
          "w": { "a": 0, "k": 10 },
          "lc": 2,
          "nm": "Stroke"
        },
        {
          "ty": "tm",
          "s": { "a": 0, "k": 0 },
          "e": { "a": 0, "k": 68 },
          "o": { "a": 0, "k": 0 },
          "nm": "Trim"
        }
      ],
      "ip": 0,
      "op": 60,
      "st": 0
    }
  ]
}
"""

@Composable
fun AttendanceScannerAndSyncScreen(
    students: List<StudentEntity>,
    scannerHistory: List<ScannerHistoryEntity>,
    teacherAttendance: List<TeacherAttendanceEntity>,
    pendingSyncCount: Int,
    onQrCodeScanned: suspend (rawPayload: String) -> Pair<Boolean, String>,
    onQueueOfflineAttendance: () -> Unit,
    onSyncAllPending: suspend () -> Pair<Boolean, String>,
    modifier: Modifier = Modifier
) {
    var selectedSubTab by remember { mutableIntStateOf(0) } // 0 = Scanner, 1 = History, 2 = Sync & Icon

    Column(
        modifier = modifier
            .fillMaxSize()
            .background(Color(0xFFF8FAFC))
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        SingleChoiceSegmentedButtonRow(modifier = Modifier.fillMaxWidth()) {
            SegmentedButton(
                selected = selectedSubTab == 0,
                onClick = { selectedSubTab = 0 },
                shape = SegmentedButtonDefaults.itemShape(index = 0, count = 3)
            ) {
                Text("Scanner", maxLines = 1)
            }
            SegmentedButton(
                selected = selectedSubTab == 1,
                onClick = { selectedSubTab = 1 },
                shape = SegmentedButtonDefaults.itemShape(index = 1, count = 3)
            ) {
                Text(
                    text = "Scanner History (${scannerHistory.size})",
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )
            }
            SegmentedButton(
                selected = selectedSubTab == 2,
                onClick = { selectedSubTab = 2 },
                shape = SegmentedButtonDefaults.itemShape(index = 2, count = 3)
            ) {
                Text("Sync ($pendingSyncCount)", maxLines = 1)
            }
        }

        when (selectedSubTab) {
            0 -> OfflineQrAttendanceScannerView(
                students = students,
                onQrCodeScanned = onQrCodeScanned
            )
            1 -> ScannerHistoryListView(scannerHistory = scannerHistory)
            else -> SyncStatusAndIconDashboard(
                teacherAttendance = teacherAttendance,
                pendingSyncCount = pendingSyncCount,
                onQueueOfflineAttendance = onQueueOfflineAttendance,
                onSyncAllPending = onSyncAllPending
            )
        }
    }
}

@Composable
private fun OfflineQrAttendanceScannerView(
    students: List<StudentEntity>,
    onQrCodeScanned: suspend (String) -> Pair<Boolean, String>
) {
    val context = LocalContext.current
    val lifecycleOwner = LocalLifecycleOwner.current
    val scope = rememberCoroutineScope()
    var hasCameraPermission by remember {
        mutableStateOf(
            ContextCompat.checkSelfPermission(context, Manifest.permission.CAMERA) ==
                PackageManager.PERMISSION_GRANTED
        )
    }
    val cameraPermissionLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.RequestPermission()
    ) { granted ->
        hasCameraPermission = granted
    }

    var isCameraActive by remember { mutableStateOf(true) }
    var manualCode by remember { mutableStateOf("") }
    var lastScanFeedback by remember { mutableStateOf<String?>(null) }
    var lastScanIsError by remember { mutableStateOf(false) }
    var lastScanMillis by remember { mutableLongStateOf(0L) }

    val handleDecodedPayload: (String) -> Unit = { decoded ->
        val now = System.currentTimeMillis()
        if (now - lastScanMillis > 1800L) {
            lastScanMillis = now
            scope.launch {
                val (matched, message) = onQrCodeScanned(decoded)
                lastScanIsError = !matched
                lastScanFeedback = message
            }
        }
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState()),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        Card(
            shape = RoundedCornerShape(20.dp),
            colors = CardDefaults.cardColors(containerColor = Color(0xFF0F172A)),
            modifier = Modifier
                .fillMaxWidth()
                .height(290.dp)
        ) {
            Box(modifier = Modifier.fillMaxSize()) {
                if (hasCameraPermission && isCameraActive) {
                    CameraXQrPreview(
                        lifecycleOwner = lifecycleOwner,
                        onQrDecoded = handleDecodedPayload,
                        modifier = Modifier.fillMaxSize()
                    )
                    // Subtle Jetpack Compose Canvas + InfiniteTransition scanning animation overlay while camera is active
                    ScannerAnimatedOverlay(modifier = Modifier.fillMaxSize())
                } else if (hasCameraPermission && !isCameraActive) {
                    Column(
                        modifier = Modifier
                            .fillMaxSize()
                            .padding(24.dp),
                        verticalArrangement = Arrangement.Center,
                        horizontalAlignment = Alignment.CenterHorizontally
                    ) {
                        Icon(
                            imageVector = Icons.Rounded.QrCodeScanner,
                            contentDescription = null,
                            tint = Color(0xFF94A3B8),
                            modifier = Modifier.size(44.dp)
                        )
                        Spacer(modifier = Modifier.height(8.dp))
                        Text(
                            text = "Camera Scanner Paused",
                            style = MaterialTheme.typography.titleSmall,
                            color = Color.White,
                            fontWeight = FontWeight.Bold
                        )
                        Text(
                            text = "Tap Resume Camera below to reactivate live QR scanning.",
                            style = MaterialTheme.typography.bodySmall,
                            color = Color(0xFFCBD5E1)
                        )
                    }
                } else {
                    Column(
                        modifier = Modifier
                            .fillMaxSize()
                            .padding(24.dp),
                        verticalArrangement = Arrangement.Center,
                        horizontalAlignment = Alignment.CenterHorizontally
                    ) {
                        Icon(
                            imageVector = Icons.Rounded.QrCodeScanner,
                            contentDescription = null,
                            tint = Color(0xFF34D399),
                            modifier = Modifier.size(48.dp)
                        )
                        Spacer(modifier = Modifier.height(10.dp))
                        Text(
                            text = "Camera permission needed for live QR scanning",
                            style = MaterialTheme.typography.titleSmall,
                            color = Color.White,
                            fontWeight = FontWeight.Bold
                        )
                        Text(
                            text = "Use quick offline admission lookup below or enable live CameraX QR scanning.",
                            style = MaterialTheme.typography.bodySmall,
                            color = Color(0xFFCBD5E1)
                        )
                        Spacer(modifier = Modifier.height(10.dp))
                        Button(
                            onClick = { cameraPermissionLauncher.launch(Manifest.permission.CAMERA) },
                            colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF059669)),
                            shape = RoundedCornerShape(10.dp)
                        ) {
                            Text("Enable Camera Scanner", fontWeight = FontWeight.Bold)
                        }
                    }
                }

                if (hasCameraPermission) {
                    Surface(
                        onClick = { isCameraActive = !isCameraActive },
                        color = Color(0xCC0F172A),
                        shape = RoundedCornerShape(10.dp),
                        modifier = Modifier
                            .align(Alignment.TopEnd)
                            .padding(12.dp)
                    ) {
                        Row(
                            modifier = Modifier.padding(horizontal = 10.dp, vertical = 6.dp),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(4.dp)
                        ) {
                            Icon(
                                imageVector = if (isCameraActive) Icons.Rounded.Pause else Icons.Rounded.PlayArrow,
                                contentDescription = null,
                                tint = if (isCameraActive) Color(0xFF34D399) else Color(0xFFFBBF24),
                                modifier = Modifier.size(16.dp)
                            )
                            Text(
                                text = if (isCameraActive) "Pause" else "Resume",
                                style = MaterialTheme.typography.labelSmall,
                                color = Color.White,
                                fontWeight = FontWeight.Bold
                            )
                        }
                    }
                }

                Surface(
                    color = Color(0xCC0F172A),
                    shape = RoundedCornerShape(10.dp),
                    modifier = Modifier
                        .align(Alignment.BottomCenter)
                        .padding(bottom = 12.dp)
                ) {
                    Text(
                        text = if (hasCameraPermission && isCameraActive) {
                            "Scanning Active • Align Student QR ID inside frame"
                        } else {
                            "ZXing + CameraX Offline Attendance Scanner"
                        },
                        style = MaterialTheme.typography.labelSmall,
                        color = Color(0xFFA7F3D0),
                        fontWeight = FontWeight.Bold,
                        modifier = Modifier.padding(horizontal = 12.dp, vertical = 6.dp)
                    )
                }
            }
        }

        if (lastScanFeedback != null) {
            Surface(
                color = if (lastScanIsError) Color(0xFFFEE2E2) else Color(0xFFD1FAE5),
                shape = RoundedCornerShape(14.dp),
                modifier = Modifier.fillMaxWidth()
            ) {
                Row(
                    modifier = Modifier.padding(12.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    Icon(
                        imageVector = if (lastScanIsError) Icons.Rounded.Warning else Icons.Rounded.CheckCircle,
                        contentDescription = null,
                        tint = if (lastScanIsError) Color(0xFFDC2626) else Color(0xFF059669)
                    )
                    Text(
                        text = lastScanFeedback ?: "",
                        style = MaterialTheme.typography.bodySmall,
                        color = if (lastScanIsError) Color(0xFF991B1B) else Color(0xFF065F46),
                        fontWeight = FontWeight.SemiBold
                    )
                }
            }
        }

        // Manual / Quick Student Scan Fallback for offline verification
        Card(
            shape = RoundedCornerShape(16.dp),
            colors = CardDefaults.cardColors(containerColor = Color.White),
            modifier = Modifier.fillMaxWidth()
        ) {
            Column(
                modifier = Modifier.padding(14.dp),
                verticalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                Text(
                    text = "Quick Offline Admission Number Check-In",
                    style = MaterialTheme.typography.titleSmall,
                    fontWeight = FontWeight.Bold,
                    color = Color(0xFF0F172A)
                )
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    OutlinedTextField(
                        value = manualCode,
                        onValueChange = { manualCode = it },
                        placeholder = { Text("e.g. ADM-2026-001") },
                        singleLine = true,
                        modifier = Modifier.weight(1f)
                    )
                    Button(
                        enabled = manualCode.isNotBlank(),
                        onClick = {
                            val query = manualCode.trim()
                            manualCode = ""
                            scope.launch {
                                val (matched, message) = onQrCodeScanned(query)
                                lastScanIsError = !matched
                                lastScanFeedback = message
                            }
                        },
                        colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF059669)),
                        shape = RoundedCornerShape(12.dp)
                    ) {
                        Text("Mark")
                    }
                }

                if (students.isNotEmpty()) {
                    Text(
                        text = "Tap a student for instant offline check-in:",
                        style = MaterialTheme.typography.labelSmall,
                        color = Color(0xFF64748B)
                    )
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(6.dp)
                    ) {
                        students.take(3).forEach { st ->
                            FilterChip(
                                selected = false,
                                onClick = {
                                    scope.launch {
                                        val (matched, message) = onQrCodeScanned(st.admissionNumber)
                                        lastScanIsError = !matched
                                        lastScanFeedback = message
                                    }
                                },
                                label = { Text(st.fullName.substringBefore(" "), maxLines = 1) }
                            )
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun CameraXQrPreview(
    lifecycleOwner: androidx.lifecycle.LifecycleOwner,
    onQrDecoded: (String) -> Unit,
    modifier: Modifier = Modifier
) {
    val context = LocalContext.current
    val analysisExecutor = remember { Executors.newSingleThreadExecutor() }

    DisposableEffect(Unit) {
        onDispose {
            analysisExecutor.shutdown()
        }
    }

    AndroidView(
        modifier = modifier,
        factory = { ctx ->
            val previewView = PreviewView(ctx)
            val cameraProviderFuture = ProcessCameraProvider.getInstance(ctx)
            cameraProviderFuture.addListener({
                try {
                    val cameraProvider = cameraProviderFuture.get()
                    val preview = Preview.Builder().build().also {
                        it.setSurfaceProvider(previewView.surfaceProvider)
                    }

                    val imageAnalysis = ImageAnalysis.Builder()
                        .setBackpressureStrategy(ImageAnalysis.STRATEGY_KEEP_ONLY_LATEST)
                        .build()

                    val reader = MultiFormatReader()
                    imageAnalysis.setAnalyzer(analysisExecutor) { imageProxy ->
                        decodeQrFromImageProxy(imageProxy, reader)?.let { decodedText ->
                            ContextCompat.getMainExecutor(ctx).execute {
                                onQrDecoded(decodedText)
                            }
                        }
                        imageProxy.close()
                    }

                    cameraProvider.unbindAll()
                    cameraProvider.bindToLifecycle(
                        lifecycleOwner,
                        CameraSelector.DEFAULT_BACK_CAMERA,
                        preview,
                        imageAnalysis
                    )
                } catch (_: Exception) {
                    // Gracefully ignore camera binding failure on emulators without camera hardware
                }
            }, ContextCompat.getMainExecutor(ctx))
            previewView
        }
    )
}

private fun decodeQrFromImageProxy(imageProxy: ImageProxy, reader: MultiFormatReader): String? {
    return try {
        val plane = imageProxy.planes.firstOrNull() ?: return null
        val buffer = plane.buffer
        val data = ByteArray(buffer.remaining())
        buffer.get(data)

        val source = PlanarYUVLuminanceSource(
            data,
            imageProxy.width,
            imageProxy.height,
            0,
            0,
            imageProxy.width,
            imageProxy.height,
            false
        )
        val bitmap = BinaryBitmap(HybridBinarizer(source))
        reader.decode(bitmap).text
    } catch (_: Exception) {
        null
    } finally {
        reader.reset()
    }
}

@Composable
private fun ScannerAnimatedOverlay(modifier: Modifier = Modifier) {
    val infiniteTransition = rememberInfiniteTransition(label = "qr_scanner_laser")
    val laserProgress by infiniteTransition.animateFloat(
        initialValue = 0f,
        targetValue = 1f,
        animationSpec = infiniteRepeatable(
            animation = tween(durationMillis = 2200, easing = LinearEasing),
            repeatMode = RepeatMode.Reverse
        ),
        label = "laser_y_progress"
    )
    val bracketAlpha by infiniteTransition.animateFloat(
        initialValue = 0.55f,
        targetValue = 1.0f,
        animationSpec = infiniteRepeatable(
            animation = tween(durationMillis = 1100, easing = LinearEasing),
            repeatMode = RepeatMode.Reverse
        ),
        label = "reticle_pulse_alpha"
    )

    Canvas(modifier = modifier) {
        val boxSize = size.minDimension * 0.64f
        val left = (size.width - boxSize) / 2f
        val top = (size.height - boxSize) / 2f
        val right = left + boxSize
        val bottom = top + boxSize
        val cornerLen = 28.dp.toPx()
        val strokePx = 4.dp.toPx()
        val scrimColor = Color(0x660F172A)
        val bracketColor = Color(0xFF34D399).copy(alpha = bracketAlpha)

        // Translucent dark outside scrim framing the active QR scan window
        drawRect(color = scrimColor, topLeft = Offset.Zero, size = Size(size.width, top))
        drawRect(color = scrimColor, topLeft = Offset(0f, bottom), size = Size(size.width, size.height - bottom))
        drawRect(color = scrimColor, topLeft = Offset(0f, top), size = Size(left, boxSize))
        drawRect(color = scrimColor, topLeft = Offset(right, top), size = Size(size.width - right, boxSize))

        // Subtle inner guide outline
        drawRect(
            color = Color(0x3334D399),
            topLeft = Offset(left, top),
            size = Size(boxSize, boxSize),
            style = Stroke(width = 1.dp.toPx())
        )

        // Pulsing corner reticle brackets
        // Top-left corner
        drawLine(bracketColor, Offset(left, top), Offset(left + cornerLen, top), strokePx, StrokeCap.Round)
        drawLine(bracketColor, Offset(left, top), Offset(left, top + cornerLen), strokePx, StrokeCap.Round)
        // Top-right corner
        drawLine(bracketColor, Offset(right - cornerLen, top), Offset(right, top), strokePx, StrokeCap.Round)
        drawLine(bracketColor, Offset(right, top), Offset(right, top + cornerLen), strokePx, StrokeCap.Round)
        // Bottom-left corner
        drawLine(bracketColor, Offset(left, bottom), Offset(left + cornerLen, bottom), strokePx, StrokeCap.Round)
        drawLine(bracketColor, Offset(left, bottom - cornerLen), Offset(left, bottom), strokePx, StrokeCap.Round)
        // Bottom-right corner
        drawLine(bracketColor, Offset(right - cornerLen, bottom), Offset(right, bottom), strokePx, StrokeCap.Round)
        drawLine(bracketColor, Offset(right, bottom - cornerLen), Offset(right, bottom), strokePx, StrokeCap.Round)

        // Animated glowing laser trail + beam sweeping vertically inside viewfinder
        val laserY = top + (boxSize * laserProgress)
        val glowHalfHeight = 16.dp.toPx()
        val glowTop = (laserY - glowHalfHeight).coerceAtLeast(top)
        val glowBottom = (laserY + glowHalfHeight).coerceAtMost(bottom)
        if (glowBottom > glowTop) {
            drawRect(
                brush = Brush.verticalGradient(
                    colors = listOf(Color.Transparent, Color(0x4410B981), Color.Transparent),
                    startY = glowTop,
                    endY = glowBottom
                ),
                topLeft = Offset(left + 4f, glowTop),
                size = Size((boxSize - 8f).coerceAtLeast(0f), glowBottom - glowTop)
            )
        }

        drawLine(
            brush = Brush.horizontalGradient(
                colors = listOf(Color.Transparent, Color(0xFF10B981), Color(0xFFA7F3D0), Color(0xFF10B981), Color.Transparent),
                startX = left,
                endX = right
            ),
            start = Offset(left + 8f, laserY),
            end = Offset(right - 8f, laserY),
            strokeWidth = 3.dp.toPx(),
            cap = StrokeCap.Round
        )
    }
}

@Composable
private fun ScannerHistoryListView(scannerHistory: List<ScannerHistoryEntity>) {
    val context = LocalContext.current
    val formatter = remember { SimpleDateFormat("dd MMM yyyy, hh:mm:ss a", Locale.getDefault()) }
    var searchQuery by remember { mutableStateOf("") }
    var exportStatusMessage by remember { mutableStateOf<String?>(null) }

    val filteredHistory = remember(scannerHistory, searchQuery) {
        val q = searchQuery.trim().lowercase()
        if (q.isEmpty()) {
            scannerHistory
        } else {
            scannerHistory.filter { entry ->
                entry.studentName.lowercase().contains(q) ||
                    entry.admissionNumber.lowercase().contains(q) ||
                    entry.classSection.lowercase().contains(q)
            }
        }
    }

    val safCsvLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.CreateDocument("text/csv")
    ) { uri ->
        if (uri != null) {
            val saved = ScannerHistoryCsvExporter.writeCsvToUri(context, uri, scannerHistory)
            exportStatusMessage = if (saved) {
                "Exported ${scannerHistory.size} attendance scan log(s) to CSV via Storage Access Framework."
            } else {
                "Failed to write Scanner History CSV file."
            }
        }
    }

    Column(
        modifier = Modifier.fillMaxSize(),
        verticalArrangement = Arrangement.spacedBy(10.dp)
    ) {
        // Administrative Review & Export CSV Header Card (Android Storage Access Framework)
        Card(
            shape = RoundedCornerShape(18.dp),
            colors = CardDefaults.cardColors(containerColor = Color.White),
            elevation = CardDefaults.cardElevation(defaultElevation = 1.dp),
            modifier = Modifier.fillMaxWidth()
        ) {
            Column(
                modifier = Modifier.padding(14.dp),
                verticalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Column(modifier = Modifier.weight(1f)) {
                        Text(
                            text = "Scanner History (Room DB)",
                            style = MaterialTheme.typography.titleSmall,
                            fontWeight = FontWeight.Bold,
                            color = Color(0xFF0F172A)
                        )
                        Text(
                            text = "${scannerHistory.size} successful attendance scan(s) logged",
                            style = MaterialTheme.typography.labelSmall,
                            color = Color(0xFF64748B)
                        )
                    }
                    Button(
                        enabled = scannerHistory.isNotEmpty(),
                        onClick = {
                            safCsvLauncher.launch(
                                "SchoolMaster_ScannerHistory_${System.currentTimeMillis()}.csv"
                            )
                        },
                        colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF4F46E5)),
                        shape = RoundedCornerShape(10.dp)
                    ) {
                        Icon(
                            imageVector = Icons.Rounded.Download,
                            contentDescription = "Export CSV",
                            modifier = Modifier.size(16.dp)
                        )
                        Spacer(modifier = Modifier.width(6.dp))
                        Text("Export CSV", fontWeight = FontWeight.Bold)
                    }
                }

                OutlinedTextField(
                    value = searchQuery,
                    onValueChange = { searchQuery = it },
                    placeholder = { Text("Search by student name or admission number...") },
                    leadingIcon = { Icon(Icons.Rounded.Search, contentDescription = null) },
                    trailingIcon = {
                        if (searchQuery.isNotEmpty()) {
                            IconButton(onClick = { searchQuery = "" }) {
                                Icon(Icons.Rounded.Close, contentDescription = "Clear search")
                            }
                        }
                    },
                    singleLine = true,
                    shape = RoundedCornerShape(12.dp),
                    modifier = Modifier.fillMaxWidth()
                )

                if (exportStatusMessage != null) {
                    Surface(
                        color = Color(0xFFD1FAE5),
                        shape = RoundedCornerShape(10.dp),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Text(
                            text = exportStatusMessage ?: "",
                            style = MaterialTheme.typography.labelSmall,
                            color = Color(0xFF065F46),
                            fontWeight = FontWeight.SemiBold,
                            modifier = Modifier.padding(10.dp)
                        )
                    }
                }
            }
        }

        if (filteredHistory.isEmpty()) {
            Card(
                shape = RoundedCornerShape(18.dp),
                colors = CardDefaults.cardColors(containerColor = Color.White),
                modifier = Modifier.fillMaxWidth()
            ) {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(24.dp),
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    Icon(
                        imageVector = Icons.Rounded.History,
                        contentDescription = null,
                        tint = Color(0xFF4F46E5),
                        modifier = Modifier.size(36.dp)
                    )
                    Text(
                        text = if (scannerHistory.isEmpty()) {
                            "No Attendance Scans Logged Yet"
                        } else {
                            "No Matching Scan Logs"
                        },
                        style = MaterialTheme.typography.titleSmall,
                        fontWeight = FontWeight.Bold
                    )
                    Text(
                        text = if (scannerHistory.isEmpty()) {
                            "Scan a student QR ID card to record offline attendance locally in Room."
                        } else {
                            "Try a different student name or admission number."
                        },
                        style = MaterialTheme.typography.bodySmall,
                        color = Color(0xFF64748B)
                    )
                }
            }
            return
        }

        LazyColumn(
            modifier = Modifier.fillMaxSize(),
            verticalArrangement = Arrangement.spacedBy(10.dp),
            contentPadding = PaddingValues(bottom = 24.dp)
        ) {
            items(filteredHistory, key = { it.id }) { entry ->
                Card(
                    shape = RoundedCornerShape(16.dp),
                    colors = CardDefaults.cardColors(containerColor = Color.White),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(14.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                            Text(
                                text = entry.studentName,
                                style = MaterialTheme.typography.titleSmall,
                                fontWeight = FontWeight.Bold,
                                color = Color(0xFF0F172A)
                            )
                            Text(
                                text = "Adm #: ${entry.admissionNumber} • ${entry.classSection}",
                                style = MaterialTheme.typography.bodySmall,
                                color = Color(0xFF475569)
                            )
                            Text(
                                text = "Scanned: ${formatter.format(Date(entry.scannedAtMillis))}",
                                style = MaterialTheme.typography.labelSmall.copy(fontFamily = FontFamily.Monospace),
                                color = Color(0xFF64748B)
                            )
                        }
                        val isPendingSync = entry.syncStatus.equals("pending", ignoreCase = true)
                        Surface(
                            color = if (isPendingSync) Color(0xFFFEF3C7) else Color(0xFFD1FAE5),
                            shape = RoundedCornerShape(8.dp)
                        ) {
                            Text(
                                text = if (isPendingSync) "PENDING SYNC" else "SYNCED",
                                style = MaterialTheme.typography.labelSmall,
                                fontWeight = FontWeight.Bold,
                                color = if (isPendingSync) Color(0xFF92400E) else Color(0xFF065F46),
                                modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp)
                            )
                        }
                    }
                }
            }
        }
    }
}

@Composable
fun SyncStatusDashboardCard(
    teacherAttendance: List<TeacherAttendanceEntity>,
    pendingSyncCount: Int,
    onQueueOfflineAttendance: () -> Unit,
    onSyncAllPending: suspend () -> Pair<Boolean, String>,
    modifier: Modifier = Modifier
) {
    val scope = rememberCoroutineScope()
    var isSyncing by remember { mutableStateOf(false) }
    var syncFeedback by remember { mutableStateOf<String?>(null) }
    var syncFeedbackIsError by remember { mutableStateOf(false) }
    val lottieComposition by rememberLottieComposition(
        LottieCompositionSpec.JsonString(SYNC_LOTTIE_JSON)
    )

    // Compute 7-day pending trend directly from Room TeacherAttendanceEntity rows
    val sevenDayCounts = remember(teacherAttendance) {
        val fmt = SimpleDateFormat("yyyy-MM-dd", Locale.US)
        val labelFmt = SimpleDateFormat("EEE", Locale.US)
        val cal = Calendar.getInstance()
        (6 downTo 0).map { offset ->
            val d = (cal.clone() as Calendar).apply { add(Calendar.DAY_OF_YEAR, -offset) }
            val iso = fmt.format(d.time)
            val pendingForDay = teacherAttendance.count {
                it.dateIso == iso && it.syncStatus.equals("pending", ignoreCase = true)
            }
            labelFmt.format(d.time) to pendingForDay
        }
    }

    Card(
        shape = RoundedCornerShape(20.dp),
        colors = CardDefaults.cardColors(containerColor = Color.White),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp),
        modifier = modifier.fillMaxWidth()
    ) {
        Column(
            modifier = Modifier.padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(10.dp),
                    modifier = Modifier.weight(1f)
                ) {
                    Box(
                        modifier = Modifier
                            .size(48.dp)
                            .clip(RoundedCornerShape(14.dp))
                            .background(
                                if (isSyncing) Color(0xFFEEF2FF)
                                else if (pendingSyncCount > 0) Color(0xFFFEF3C7)
                                else Color(0xFFD1FAE5)
                            ),
                        contentAlignment = Alignment.Center
                    ) {
                        if (isSyncing) {
                            LottieAnimation(
                                composition = lottieComposition,
                                iterations = LottieConstants.IterateForever,
                                modifier = Modifier.size(40.dp)
                            )
                        } else {
                            Icon(
                                imageVector = if (pendingSyncCount > 0) Icons.Rounded.CloudOff else Icons.Rounded.CloudDone,
                                contentDescription = null,
                                tint = if (pendingSyncCount > 0) Color(0xFFD97706) else Color(0xFF059669),
                                modifier = Modifier.size(26.dp)
                            )
                        }
                    }
                    Column {
                        Text(
                            text = "Sync Status",
                            style = MaterialTheme.typography.titleMedium,
                            fontWeight = FontWeight.Bold,
                            color = Color(0xFF0F172A)
                        )
                        Text(
                            text = if (isSyncing) {
                                "Uploading pending Room attendance records..."
                            } else {
                                "$pendingSyncCount Attendance record(s) waiting for cloud upload"
                            },
                            style = MaterialTheme.typography.bodySmall,
                            color = Color(0xFF475569)
                        )
                    }
                }

                Surface(
                    color = if (pendingSyncCount > 0) Color(0xFFFEF3C7) else Color(0xFFD1FAE5),
                    shape = RoundedCornerShape(10.dp)
                ) {
                    Text(
                        text = "$pendingSyncCount PENDING",
                        style = MaterialTheme.typography.labelSmall,
                        fontWeight = FontWeight.Bold,
                        color = if (pendingSyncCount > 0) Color(0xFF92400E) else Color(0xFF065F46),
                        modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp)
                    )
                }
            }

            // 7-Day Pending Sync Trend Chart (Compose Canvas)
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(14.dp))
                    .background(Color(0xFFF8FAFC))
                    .border(1.dp, Color(0xFFE2E8F0), RoundedCornerShape(14.dp))
                    .padding(12.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                Text(
                    text = "7-DAY PENDING SYNC TREND (ROOM DB)",
                    style = MaterialTheme.typography.labelSmall,
                    fontWeight = FontWeight.Bold,
                    color = Color(0xFF4F46E5)
                )
                Canvas(
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(110.dp)
                ) {
                    val maxVal = (sevenDayCounts.maxOfOrNull { it.second } ?: 1).coerceAtLeast(2)
                    val stepX = size.width / (sevenDayCounts.size - 1).coerceAtLeast(1)
                    val padY = 14.dp.toPx()
                    val usableH = (size.height - padY * 2).coerceAtLeast(1f)

                    // Horizontal guide lines
                    for (g in 0..2) {
                        val gy = padY + (usableH * g / 2f)
                        drawLine(
                            color = Color(0xFFE2E8F0),
                            start = Offset(0f, gy),
                            end = Offset(size.width, gy),
                            strokeWidth = 1.dp.toPx()
                        )
                    }

                    val path = Path()
                    sevenDayCounts.forEachIndexed { idx, pair ->
                        val x = idx * stepX
                        val y = size.height - padY - (pair.second.toFloat() / maxVal) * usableH
                        if (idx == 0) path.moveTo(x, y) else path.lineTo(x, y)
                    }
                    drawPath(
                        path = path,
                        color = Color(0xFF4F46E5),
                        style = Stroke(width = 3.dp.toPx(), cap = StrokeCap.Round)
                    )
                    sevenDayCounts.forEachIndexed { idx, pair ->
                        val x = idx * stepX
                        val y = size.height - padY - (pair.second.toFloat() / maxVal) * usableH
                        drawCircle(
                            color = if (pair.second > 0) Color(0xFFD97706) else Color(0xFF059669),
                            radius = 5.dp.toPx(),
                            center = Offset(x, y)
                        )
                    }
                }
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    sevenDayCounts.forEach { (dayLabel, count) ->
                        Text(
                            text = "$dayLabel ($count)",
                            style = MaterialTheme.typography.labelSmall.copy(fontFamily = FontFamily.Monospace),
                            color = Color(0xFF64748B)
                        )
                    }
                }
            }

            if (!syncFeedback.isNullOrBlank()) {
                Surface(
                    color = if (syncFeedbackIsError) Color(0xFFFEF3C7) else Color(0xFFD1FAE5),
                    shape = RoundedCornerShape(12.dp),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Row(
                        modifier = Modifier.padding(10.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        Icon(
                            imageVector = if (syncFeedbackIsError) Icons.Rounded.Warning else Icons.Rounded.CheckCircle,
                            contentDescription = null,
                            tint = if (syncFeedbackIsError) Color(0xFFD97706) else Color(0xFF059669),
                            modifier = Modifier.size(18.dp)
                        )
                        Text(
                            text = syncFeedback.orEmpty(),
                            style = MaterialTheme.typography.labelSmall,
                            color = if (syncFeedbackIsError) Color(0xFF92400E) else Color(0xFF065F46),
                            fontWeight = FontWeight.SemiBold
                        )
                    }
                }
            }

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                OutlinedButton(
                    onClick = onQueueOfflineAttendance,
                    shape = RoundedCornerShape(12.dp),
                    modifier = Modifier.weight(1f)
                ) {
                    Text("+ Queue Offline")
                }
                Button(
                    enabled = !isSyncing,
                    onClick = {
                        scope.launch {
                            isSyncing = true
                            syncFeedback = null
                            val (ok, msg) = onSyncAllPending()
                            syncFeedbackIsError = !ok
                            syncFeedback = msg
                            isSyncing = false
                        }
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF4F46E5)),
                    shape = RoundedCornerShape(12.dp),
                    modifier = Modifier.weight(1f)
                ) {
                    Icon(
                        imageVector = Icons.Rounded.Sync,
                        contentDescription = null,
                        modifier = Modifier.size(16.dp)
                    )
                    Spacer(modifier = Modifier.width(6.dp))
                    Text(if (isSyncing) "Syncing..." else "Sync Pending")
                }
            }
        }
    }
}

@Composable
private fun SyncStatusAndIconDashboard(
    teacherAttendance: List<TeacherAttendanceEntity>,
    pendingSyncCount: Int,
    onQueueOfflineAttendance: () -> Unit,
    onSyncAllPending: suspend () -> Pair<Boolean, String>
) {
    val context = LocalContext.current
    var activeAlias by remember { mutableStateOf(SecurityPreferences.getActiveLauncherIconAlias(context)) }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState()),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        SyncStatusDashboardCard(
            teacherAttendance = teacherAttendance,
            pendingSyncCount = pendingSyncCount,
            onQueueOfflineAttendance = onQueueOfflineAttendance,
            onSyncAllPending = onSyncAllPending
        )

        // Dynamic Android Launcher Icon Alias Selector
        Card(
            shape = RoundedCornerShape(18.dp),
            colors = CardDefaults.cardColors(containerColor = Color.White),
            modifier = Modifier.fillMaxWidth()
        ) {
            Column(
                modifier = Modifier.padding(16.dp),
                verticalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    Icon(
                        imageVector = Icons.Rounded.Palette,
                        contentDescription = null,
                        tint = Color(0xFF4F46E5)
                    )
                    Column {
                        Text(
                            text = "App Launcher Icon Style",
                            style = MaterialTheme.typography.titleSmall,
                            fontWeight = FontWeight.Bold
                        )
                        Text(
                            text = "Switch between Android adaptive launcher icon aliases",
                            style = MaterialTheme.typography.labelSmall,
                            color = Color(0xFF64748B)
                        )
                    }
                }

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    LauncherIconAlias.entries.forEach { alias ->
                        FilterChip(
                            selected = activeAlias == alias,
                            onClick = {
                                activeAlias = alias
                                SecurityPreferences.applyLauncherIconAlias(context, alias)
                            },
                            label = { Text(alias.displayName, maxLines = 1) },
                            modifier = Modifier.weight(1f)
                        )
                    }
                }
            }
        }
    }
}
