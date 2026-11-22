package `in`.gov.jk.schoolmaster

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.net.ConnectivityManager
import android.net.Network
import android.net.NetworkCapabilities
import android.os.Build
import android.os.Bundle
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.Badge
import androidx.compose.material.icons.rounded.Language
import androidx.compose.material.icons.rounded.Lock
import androidx.compose.material.icons.rounded.People
import androidx.compose.material.icons.rounded.QrCode2
import androidx.compose.material.icons.rounded.QrCodeScanner
import androidx.compose.material.icons.rounded.School
import androidx.compose.material.icons.rounded.Settings
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.core.content.ContextCompat
import androidx.fragment.app.FragmentActivity
import `in`.gov.jk.schoolmaster.data.local.SchoolMasterDatabase
import `in`.gov.jk.schoolmaster.data.local.SchoolMasterRepository
import `in`.gov.jk.schoolmaster.security.OfficialLogoStore
import `in`.gov.jk.schoolmaster.ui.AppUpdatesScreen
import `in`.gov.jk.schoolmaster.ui.AttendanceScannerAndSyncScreen
import `in`.gov.jk.schoolmaster.ui.DirectoryScreen
import `in`.gov.jk.schoolmaster.ui.HpcCardMakerScreen
import `in`.gov.jk.schoolmaster.ui.IdCardTargetType
import `in`.gov.jk.schoolmaster.ui.ProtectedModulesScreen
import `in`.gov.jk.schoolmaster.ui.QrIdCardScreen
import `in`.gov.jk.schoolmaster.ui.SchoolPortalWebView
import kotlinx.coroutines.launch
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

class MainActivity : FragmentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContent {
            MaterialTheme {
                SchoolMasterApp(activity = this)
            }
        }
    }
}

private enum class AppTab(val label: String) {
    DIRECTORY("Directory"),
    SCANNER("Scanner"),
    HPC_MAKER("HPC Maker"),
    PROTECTED("Protected"),
    PORTAL("Portal"),
    QR_IDS("QR IDs"),
    UPDATES("Settings")
}

@Composable
private fun rememberNetworkStatus(context: Context): Boolean {
    val connectivityManager = remember(context) {
        context.getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
    }

    fun checkNow(): Boolean {
        val network = connectivityManager.activeNetwork ?: return false
        val caps = connectivityManager.getNetworkCapabilities(network) ?: return false
        return caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
    }

    var isOnline by remember { mutableStateOf(checkNow()) }

    DisposableEffect(connectivityManager) {
        val callback = object : ConnectivityManager.NetworkCallback() {
            override fun onAvailable(network: Network) {
                isOnline = true
            }

            override fun onLost(network: Network) {
                isOnline = checkNow()
            }
        }
        connectivityManager.registerDefaultNetworkCallback(callback)
        onDispose {
            connectivityManager.unregisterNetworkCallback(callback)
        }
    }

    return isOnline
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SchoolMasterApp(activity: FragmentActivity) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val repository = remember(context) {
        SchoolMasterRepository(SchoolMasterDatabase.getInstance(context))
    }
    val isOnline = rememberNetworkStatus(context)
    val logoVersion by OfficialLogoStore.logoVersion.collectAsState()
    val officialLogoBitmap = remember(logoVersion) { OfficialLogoStore.loadOfficialLogoBitmap(context) }

    var activeTab by remember { mutableStateOf(AppTab.DIRECTORY) }
    var searchQuery by remember { mutableStateOf("") }
    var hpcSearchQuery by remember { mutableStateOf("") }
    var qrTargetType by remember { mutableStateOf(IdCardTargetType.STUDENT) }
    var selectedStudentId by remember { mutableStateOf<String?>(null) }
    var selectedTeacherId by remember { mutableStateOf<String?>(null) }
    var sensitiveModulesUnlocked by remember { mutableStateOf(false) }

    val students by remember(searchQuery) {
        repository.observeStudents(searchQuery)
    }.collectAsState(initial = emptyList())

    val teachers by remember(searchQuery) {
        repository.observeTeachers(searchQuery)
    }.collectAsState(initial = emptyList())

    val allStudents by remember {
        repository.observeStudents("")
    }.collectAsState(initial = emptyList())

    val allTeachers by remember {
        repository.observeTeachers("")
    }.collectAsState(initial = emptyList())

    val leaves by remember {
        repository.observeLeaves()
    }.collectAsState(initial = emptyList())

    val examinations by remember {
        repository.observeExaminations()
    }.collectAsState(initial = emptyList())

    val allBiometricAuditLogs by remember {
        repository.observeAllBiometricAuditLogs()
    }.collectAsState(initial = emptyList())

    val teacherAttendance by remember {
        repository.observeTeacherAttendance()
    }.collectAsState(initial = emptyList())

    val pendingSyncCount by remember {
        repository.observePendingSyncCount()
    }.collectAsState(initial = 0)

    val scannerHistory by remember {
        repository.observeScannerHistory()
    }.collectAsState(initial = emptyList())

    val savedHpcCards by remember(hpcSearchQuery) {
        repository.observeHpcCards(hpcSearchQuery)
    }.collectAsState(initial = emptyList())

    val permissionLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.RequestMultiplePermissions()
    ) { }

    LaunchedEffect(Unit) {
        repository.seedOfflineRecordsIfEmpty()

        val permsToRequest = mutableListOf<String>()
        if (ContextCompat.checkSelfPermission(context, Manifest.permission.CAMERA) != PackageManager.PERMISSION_GRANTED) {
            permsToRequest.add(Manifest.permission.CAMERA)
        }
        if (ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_FINE_LOCATION) != PackageManager.PERMISSION_GRANTED) {
            permsToRequest.add(Manifest.permission.ACCESS_FINE_LOCATION)
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
            ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED
        ) {
            permsToRequest.add(Manifest.permission.POST_NOTIFICATIONS)
        }
        if (permsToRequest.isNotEmpty()) {
            permissionLauncher.launch(permsToRequest.toTypedArray())
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(10.dp)
                    ) {
                        Box(
                            modifier = Modifier
                                .size(36.dp)
                                .clip(RoundedCornerShape(10.dp))
                                .background(Color(0xFFEEF2FF))
                                .padding(3.dp),
                            contentAlignment = Alignment.Center
                        ) {
                            if (officialLogoBitmap != null) {
                                Image(
                                    bitmap = officialLogoBitmap.asImageBitmap(),
                                    contentDescription = "Official School Logo",
                                    contentScale = ContentScale.Fit,
                                    modifier = Modifier.fillMaxSize()
                                )
                            } else {
                                Icon(
                                    imageVector = Icons.Rounded.School,
                                    contentDescription = "Official School Logo",
                                    tint = Color(0xFF4F46E5),
                                    modifier = Modifier.size(22.dp)
                                )
                            }
                        }
                        Text(
                            text = "School Master",
                            style = MaterialTheme.typography.titleMedium,
                            fontWeight = FontWeight.Bold
                        )
                    }
                },
                actions = {
                    IconButton(onClick = { activeTab = AppTab.QR_IDS }) {
                        Icon(
                            imageVector = Icons.Rounded.QrCode2,
                            contentDescription = "QR ID Cards",
                            tint = if (activeTab == AppTab.QR_IDS) Color(0xFF4F46E5) else Color(0xFF475569)
                        )
                    }
                    IconButton(onClick = { activeTab = AppTab.UPDATES }) {
                        Icon(
                            imageVector = Icons.Rounded.Settings,
                            contentDescription = "Settings & Sync Status",
                            tint = if (activeTab == AppTab.UPDATES) Color(0xFF4F46E5) else Color(0xFF475569)
                        )
                    }
                    Surface(
                        color = if (isOnline) Color(0xFFD1FAE5) else Color(0xFFFEF3C7),
                        shape = RoundedCornerShape(10.dp),
                        modifier = Modifier.padding(end = 10.dp)
                    ) {
                        Text(
                            text = if (isOnline) "Online" else "Offline",
                            style = MaterialTheme.typography.labelSmall,
                            fontWeight = FontWeight.Bold,
                            color = if (isOnline) Color(0xFF065F46) else Color(0xFF92400E),
                            modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp)
                        )
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = Color.White,
                    titleContentColor = Color(0xFF0F172A)
                )
            )
        },
        bottomBar = {
            NavigationBar(containerColor = Color.White) {
                NavigationBarItem(
                    selected = activeTab == AppTab.DIRECTORY,
                    onClick = { activeTab = AppTab.DIRECTORY },
                    icon = { Icon(Icons.Rounded.People, contentDescription = null) },
                    label = { Text(AppTab.DIRECTORY.label, maxLines = 1) }
                )
                NavigationBarItem(
                    selected = activeTab == AppTab.SCANNER,
                    onClick = { activeTab = AppTab.SCANNER },
                    icon = { Icon(Icons.Rounded.QrCodeScanner, contentDescription = null) },
                    label = { Text(AppTab.SCANNER.label, maxLines = 1) }
                )
                NavigationBarItem(
                    selected = activeTab == AppTab.HPC_MAKER,
                    onClick = { activeTab = AppTab.HPC_MAKER },
                    icon = { Icon(Icons.Rounded.Badge, contentDescription = null) },
                    label = { Text(AppTab.HPC_MAKER.label, maxLines = 1) }
                )
                NavigationBarItem(
                    selected = activeTab == AppTab.PROTECTED,
                    onClick = { activeTab = AppTab.PROTECTED },
                    icon = { Icon(Icons.Rounded.Lock, contentDescription = null) },
                    label = { Text(AppTab.PROTECTED.label, maxLines = 1) }
                )
                NavigationBarItem(
                    selected = activeTab == AppTab.PORTAL,
                    onClick = { activeTab = AppTab.PORTAL },
                    icon = { Icon(Icons.Rounded.Language, contentDescription = null) },
                    label = { Text(AppTab.PORTAL.label, maxLines = 1) }
                )
            }
        }
    ) { innerPadding ->
        val contentModifier = Modifier
            .fillMaxSize()
            .padding(innerPadding)

        when (activeTab) {
            AppTab.DIRECTORY -> DirectoryScreen(
                students = students,
                teachers = teachers,
                searchQuery = searchQuery,
                onSearchQueryChange = { searchQuery = it },
                isOnline = isOnline,
                onAddStudent = { student ->
                    scope.launch { repository.saveStudent(student) }
                },
                onAddTeacher = { teacher ->
                    scope.launch { repository.saveTeacher(teacher) }
                },
                onOpenStudentQr = { student ->
                    qrTargetType = IdCardTargetType.STUDENT
                    selectedStudentId = student.id
                    activeTab = AppTab.QR_IDS
                },
                onOpenTeacherQr = { teacher ->
                    qrTargetType = IdCardTargetType.TEACHER
                    selectedTeacherId = teacher.id
                    activeTab = AppTab.QR_IDS
                },
                modifier = contentModifier
            )

            AppTab.SCANNER -> AttendanceScannerAndSyncScreen(
                students = allStudents,
                scannerHistory = scannerHistory,
                teacherAttendance = teacherAttendance,
                pendingSyncCount = pendingSyncCount,
                onQrCodeScanned = { rawQr ->
                    scope.launch {
                        val matched = repository.findStudentForQrScan(rawQr) ?: allStudents.firstOrNull()
                        if (matched != null) {
                            repository.recordAttendanceScan(matched, rawQr)
                        }
                    }
                },
                onQueueOfflineAttendance = {
                    scope.launch {
                        val todayIso = SimpleDateFormat("yyyy-MM-dd", Locale.US).format(Date())
                        val teacher = allTeachers.firstOrNull()
                        repository.queueOfflineTeacherAttendance(
                            teacherName = teacher?.fullName ?: "Nazir Ahmad Dar",
                            teacherId = teacher?.id ?: "TCH-2026-001",
                            dateIso = todayIso
                        )
                    }
                },
                onSyncAllPending = {
                    scope.launch { repository.syncAllPendingTeacherAttendance() }
                },
                modifier = contentModifier
            )

            AppTab.HPC_MAKER -> HpcCardMakerScreen(
                savedCards = savedHpcCards,
                searchQuery = hpcSearchQuery,
                onSearchQueryChange = { hpcSearchQuery = it },
                onSaveCard = { card ->
                    scope.launch { repository.saveHpcCard(card) }
                },
                onDeleteCard = { cardId ->
                    scope.launch { repository.deleteHpcCard(cardId) }
                },
                modifier = contentModifier,
                students = allStudents
            )

            AppTab.QR_IDS -> QrIdCardScreen(
                students = allStudents,
                teachers = allTeachers,
                targetType = qrTargetType,
                selectedStudentId = selectedStudentId,
                selectedTeacherId = selectedTeacherId,
                onTargetTypeChange = { qrTargetType = it },
                onSelectStudent = { selectedStudentId = it },
                onSelectTeacher = { selectedTeacherId = it },
                modifier = contentModifier
            )

            AppTab.PROTECTED -> ProtectedModulesScreen(
                activity = activity,
                leaves = leaves,
                examinations = examinations,
                auditLogs = allBiometricAuditLogs,
                isUnlocked = sensitiveModulesUnlocked,
                onUnlockSuccess = { sensitiveModulesUnlocked = true },
                onLockNow = { sensitiveModulesUnlocked = false },
                onLeaveDecision = { leaveId, approved ->
                    scope.launch { repository.decideLeave(leaveId, approved) }
                },
                teachers = allTeachers,
                onSubmitLeave = { leave ->
                    scope.launch { repository.submitLeaveRequest(leave) }
                },
                onBiometricAudit = { outcome, authMethod, detailMessage ->
                    scope.launch {
                        repository.recordBiometricAuditAttempt(
                            moduleName = "Teacher Leave & Examinations",
                            outcome = outcome,
                            authMethod = authMethod,
                            detailMessage = detailMessage
                        )
                    }
                },
                modifier = contentModifier
            )

            AppTab.UPDATES -> AppUpdatesScreen(
                isOnline = isOnline,
                teacherAttendance = teacherAttendance,
                pendingSyncCount = pendingSyncCount,
                onQueueOfflineAttendance = {
                    scope.launch {
                        val todayIso = SimpleDateFormat("yyyy-MM-dd", Locale.US).format(Date())
                        val teacher = allTeachers.firstOrNull()
                        repository.queueOfflineTeacherAttendance(
                            teacherName = teacher?.fullName ?: "Nazir Ahmad Dar",
                            teacherId = teacher?.id ?: "TCH-2026-001",
                            dateIso = todayIso
                        )
                    }
                },
                onSyncAllPending = {
                    scope.launch { repository.syncAllPendingTeacherAttendance() }
                },
                modifier = contentModifier
            )

            AppTab.PORTAL -> SchoolPortalWebView(modifier = contentModifier)
        }
    }
}
