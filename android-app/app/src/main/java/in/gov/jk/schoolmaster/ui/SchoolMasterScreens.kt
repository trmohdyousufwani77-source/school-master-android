package `in`.gov.jk.schoolmaster.ui

import android.annotation.SuppressLint
import android.webkit.GeolocationPermissions
import android.webkit.PermissionRequest
import android.webkit.WebChromeClient
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
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
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.Add
import androidx.compose.material.icons.rounded.AssignmentTurnedIn
import androidx.compose.material.icons.rounded.Badge
import androidx.compose.material.icons.rounded.CheckCircle
import androidx.compose.material.icons.rounded.Close
import androidx.compose.material.icons.rounded.DateRange
import androidx.compose.material.icons.rounded.Download
import androidx.compose.material.icons.rounded.EventNote
import androidx.compose.material.icons.rounded.Fingerprint
import androidx.compose.material.icons.rounded.Fullscreen
import androidx.compose.material.icons.rounded.History
import androidx.compose.material.icons.rounded.Image
import androidx.compose.material.icons.rounded.Lock
import androidx.compose.material.icons.rounded.LockOpen
import androidx.compose.material.icons.rounded.Person
import androidx.compose.material.icons.rounded.PictureAsPdf
import androidx.compose.material.icons.rounded.QrCode2
import androidx.compose.material.icons.rounded.School
import androidx.compose.material.icons.rounded.Search
import androidx.compose.material.icons.rounded.Security
import androidx.compose.material.icons.rounded.Share
import androidx.compose.material.icons.rounded.Storage
import androidx.compose.material.icons.rounded.VerifiedUser
import androidx.compose.material.icons.rounded.Warning
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.DatePickerDialog
import androidx.compose.material3.DateRangePicker
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.FloatingActionButton
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SegmentedButton
import androidx.compose.material3.SegmentedButtonDefaults
import androidx.compose.material3.SingleChoiceSegmentedButtonRow
import androidx.compose.material3.Surface
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.rememberDateRangePickerState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.FilterQuality
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import androidx.fragment.app.FragmentActivity
import `in`.gov.jk.schoolmaster.data.local.BiometricAuditLogEntity
import `in`.gov.jk.schoolmaster.data.local.ExaminationEntity
import `in`.gov.jk.schoolmaster.data.local.StudentEntity
import `in`.gov.jk.schoolmaster.data.local.TeacherEntity
import `in`.gov.jk.schoolmaster.data.local.TeacherLeaveEntity
import `in`.gov.jk.schoolmaster.qr.QrCodeGenerator
import `in`.gov.jk.schoolmaster.security.BiometricAuditCsvExporter
import `in`.gov.jk.schoolmaster.security.BiometricAuthHelper
import `in`.gov.jk.schoolmaster.security.BiometricAvailability
import `in`.gov.jk.schoolmaster.security.ManualHeadmasterStore
import `in`.gov.jk.schoolmaster.security.OfficialLogoStore
import `in`.gov.jk.schoolmaster.security.SecurityPreferences
import `in`.gov.jk.schoolmaster.security.SmartIdCardExporter
import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Date
import java.util.Locale

enum class IdCardTargetType {
    STUDENT,
    TEACHER
}

@Composable
fun DirectoryScreen(
    students: List<StudentEntity>,
    teachers: List<TeacherEntity>,
    searchQuery: String,
    onSearchQueryChange: (String) -> Unit,
    isOnline: Boolean,
    onAddStudent: (StudentEntity) -> Unit,
    onAddTeacher: (TeacherEntity) -> Unit,
    onOpenStudentQr: (StudentEntity) -> Unit,
    onOpenTeacherQr: (TeacherEntity) -> Unit,
    modifier: Modifier = Modifier
) {
    val context = LocalContext.current
    var selectedSegment by remember { mutableIntStateOf(0) } // 0 = Students, 1 = Teachers
    var showAddDialog by remember { mutableStateOf(false) }

    val logoVersion by OfficialLogoStore.logoVersion.collectAsState()
    val hmVersion by ManualHeadmasterStore.version.collectAsState()
    val officialLogoBitmap = remember(logoVersion) { OfficialLogoStore.loadOfficialLogoBitmap(context) }
    val headmasterProfile = remember(hmVersion) { ManualHeadmasterStore.load(context) }

    Scaffold(
        modifier = modifier,
        containerColor = Color(0xFFF8FAFC),
        floatingActionButton = {
            FloatingActionButton(
                onClick = { showAddDialog = true },
                containerColor = Color(0xFF4F46E5),
                contentColor = Color.White
            ) {
                Icon(
                    imageVector = Icons.Rounded.Add,
                    contentDescription = if (selectedSegment == 0) "Add Student" else "Add Teacher"
                )
            }
        }
    ) { innerPadding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding)
                .padding(horizontal = 16.dp, vertical = 12.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            // Customized School Master Widget displaying centralized Official School Logo
            Card(
                shape = RoundedCornerShape(18.dp),
                colors = CardDefaults.cardColors(containerColor = Color(0xFF1E1B4B)),
                modifier = Modifier.fillMaxWidth()
            ) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(14.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(12.dp),
                        modifier = Modifier.weight(1f)
                    ) {
                        Box(
                            modifier = Modifier
                                .size(58.dp)
                                .clip(RoundedCornerShape(14.dp))
                                .background(Color.White)
                                .padding(6.dp),
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
                                    tint = Color(0xFF1E1B4B),
                                    modifier = Modifier.size(32.dp)
                                )
                            }
                        }
                        Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
                            Text(
                                text = "School Master",
                                style = MaterialTheme.typography.titleMedium,
                                color = Color.White,
                                fontWeight = FontWeight.Bold
                            )
                            Text(
                                text = "Pamposh Colony, Palapora Zone, Iddgah",
                                style = MaterialTheme.typography.labelSmall,
                                color = Color(0xFFE0E7FF),
                                maxLines = 1,
                                overflow = TextOverflow.Ellipsis
                            )
                            Text(
                                text = "${students.size} Students • ${teachers.size} Teachers • Room Vault",
                                style = MaterialTheme.typography.labelSmall,
                                color = Color(0xFFC7D2FE)
                            )
                            Text(
                                text = "${headmasterProfile.designation}: ${headmasterProfile.fullName}",
                                style = MaterialTheme.typography.labelSmall,
                                color = Color(0xFFFDE68A),
                                maxLines = 1,
                                overflow = TextOverflow.Ellipsis
                            )
                        }
                    }
                    Surface(
                        color = if (isOnline) Color(0xFF065F46) else Color(0xFF92400E),
                        shape = RoundedCornerShape(10.dp)
                    ) {
                        Text(
                            text = if (isOnline) "SYNC READY" else "OFFLINE MODE",
                            style = MaterialTheme.typography.labelSmall,
                            color = Color.White,
                            fontWeight = FontWeight.Bold,
                            modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp)
                        )
                    }
                }
            }

            SingleChoiceSegmentedButtonRow(modifier = Modifier.fillMaxWidth()) {
                SegmentedButton(
                    selected = selectedSegment == 0,
                    onClick = { selectedSegment = 0 },
                    shape = SegmentedButtonDefaults.itemShape(index = 0, count = 2)
                ) {
                    Text("Students (${students.size})")
                }
                SegmentedButton(
                    selected = selectedSegment == 1,
                    onClick = { selectedSegment = 1 },
                    shape = SegmentedButtonDefaults.itemShape(index = 1, count = 2)
                ) {
                    Text("Teachers (${teachers.size})")
                }
            }

            OutlinedTextField(
                value = searchQuery,
                onValueChange = onSearchQueryChange,
                placeholder = {
                    Text(
                        if (selectedSegment == 0) {
                            "Search student name, admission no., class..."
                        } else {
                            "Search teacher name, employee code, subject..."
                        }
                    )
                },
                leadingIcon = {
                    Icon(imageVector = Icons.Rounded.Search, contentDescription = null)
                },
                trailingIcon = {
                    if (searchQuery.isNotEmpty()) {
                        IconButton(onClick = { onSearchQueryChange("") }) {
                            Icon(imageVector = Icons.Rounded.Close, contentDescription = "Clear search")
                        }
                    }
                },
                singleLine = true,
                shape = RoundedCornerShape(14.dp),
                modifier = Modifier.fillMaxWidth()
            )

            LazyColumn(
                modifier = Modifier.fillMaxSize(),
                contentPadding = PaddingValues(bottom = 84.dp),
                verticalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                if (selectedSegment == 0) {
                    items(students, key = { it.id }) { student ->
                        StudentDirectoryCard(
                            student = student,
                            onShowQr = { onOpenStudentQr(student) }
                        )
                    }
                } else {
                    items(teachers, key = { it.id }) { teacher ->
                        TeacherDirectoryCard(
                            teacher = teacher,
                            onShowQr = { onOpenTeacherQr(teacher) }
                        )
                    }
                }
            }
        }
    }

    if (showAddDialog) {
        if (selectedSegment == 0) {
            AddStudentDialog(
                onDismiss = { showAddDialog = false },
                onSave = { newStudent ->
                    onAddStudent(newStudent)
                    showAddDialog = false
                }
            )
        } else {
            AddTeacherDialog(
                onDismiss = { showAddDialog = false },
                onSave = { newTeacher ->
                    onAddTeacher(newTeacher)
                    showAddDialog = false
                }
            )
        }
    }
}

@Composable
private fun StudentDirectoryCard(
    student: StudentEntity,
    onShowQr: () -> Unit
) {
    val lowAttendance = student.attendancePct < 75
    Card(
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(containerColor = Color.White),
        elevation = CardDefaults.cardElevation(defaultElevation = 1.dp),
        modifier = Modifier
            .fillMaxWidth()
            .clickable { onShowQr() }
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(14.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(3.dp)) {
                Text(
                    text = student.fullName,
                    style = MaterialTheme.typography.titleSmall,
                    fontWeight = FontWeight.Bold,
                    color = Color(0xFF0F172A)
                )
                Text(
                    text = "Class ${student.classNumber}-${student.section} • Roll #${student.rollNumber} • ${student.admissionNumber}",
                    style = MaterialTheme.typography.bodySmall,
                    color = Color(0xFF475569)
                )
                Text(
                    text = "Father: ${student.fatherName} • ${student.mobileNumber}",
                    style = MaterialTheme.typography.labelSmall,
                    color = Color(0xFF64748B)
                )
                Text(
                    text = if (lowAttendance) {
                        "Attendance: ${student.attendancePct}% (Below 75% alert)"
                    } else {
                        "Attendance: ${student.attendancePct}%"
                    },
                    style = MaterialTheme.typography.labelSmall,
                    fontWeight = FontWeight.SemiBold,
                    color = if (lowAttendance) Color(0xFFB91C1C) else Color(0xFF047857)
                )
            }
            OutlinedButton(
                onClick = onShowQr,
                shape = RoundedCornerShape(12.dp),
                contentPadding = PaddingValues(horizontal = 12.dp, vertical = 8.dp)
            ) {
                Icon(
                    imageVector = Icons.Rounded.QrCode2,
                    contentDescription = "View Student QR",
                    modifier = Modifier.size(18.dp)
                )
                Spacer(modifier = Modifier.width(6.dp))
                Text("QR ID")
            }
        }
    }
}

@Composable
private fun TeacherDirectoryCard(
    teacher: TeacherEntity,
    onShowQr: () -> Unit
) {
    Card(
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(containerColor = Color.White),
        elevation = CardDefaults.cardElevation(defaultElevation = 1.dp),
        modifier = Modifier
            .fillMaxWidth()
            .clickable { onShowQr() }
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(14.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(3.dp)) {
                Text(
                    text = teacher.fullName,
                    style = MaterialTheme.typography.titleSmall,
                    fontWeight = FontWeight.Bold,
                    color = Color(0xFF0F172A)
                )
                Text(
                    text = "${teacher.designation} • ${teacher.employeeCode}",
                    style = MaterialTheme.typography.bodySmall,
                    color = Color(0xFF475569)
                )
                Text(
                    text = "${teacher.subject} • Class ${teacher.assignedClass}",
                    style = MaterialTheme.typography.labelSmall,
                    color = Color(0xFF64748B)
                )
                Text(
                    text = "Leave Balance: ${teacher.leaveBalanceDays} days • ${teacher.mobileNumber}",
                    style = MaterialTheme.typography.labelSmall,
                    fontWeight = FontWeight.SemiBold,
                    color = Color(0xFF4338CA)
                )
            }
            OutlinedButton(
                onClick = onShowQr,
                shape = RoundedCornerShape(12.dp),
                contentPadding = PaddingValues(horizontal = 12.dp, vertical = 8.dp)
            ) {
                Icon(
                    imageVector = Icons.Rounded.QrCode2,
                    contentDescription = "View Teacher QR",
                    modifier = Modifier.size(18.dp)
                )
                Spacer(modifier = Modifier.width(6.dp))
                Text("QR ID")
            }
        }
    }
}

@Composable
private fun AddStudentDialog(
    onDismiss: () -> Unit,
    onSave: (StudentEntity) -> Unit
) {
    var fullName by remember { mutableStateOf("") }
    var fatherName by remember { mutableStateOf("") }
    var classNumber by remember { mutableStateOf("5") }
    var section by remember { mutableStateOf("A") }
    var rollNumber by remember { mutableStateOf("") }
    var admissionNumber by remember { mutableStateOf("") }
    var mobileNumber by remember { mutableStateOf("") }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Add Offline Student Record") },
        text = {
            Column(
                modifier = Modifier.verticalScroll(rememberScrollState()),
                verticalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                OutlinedTextField(
                    value = fullName,
                    onValueChange = { fullName = it },
                    label = { Text("Student Full Name") },
                    singleLine = true
                )
                OutlinedTextField(
                    value = fatherName,
                    onValueChange = { fatherName = it },
                    label = { Text("Father Name") },
                    singleLine = true
                )
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    OutlinedTextField(
                        value = classNumber,
                        onValueChange = { classNumber = it },
                        label = { Text("Class") },
                        singleLine = true,
                        modifier = Modifier.weight(1f)
                    )
                    OutlinedTextField(
                        value = section,
                        onValueChange = { section = it },
                        label = { Text("Sec") },
                        singleLine = true,
                        modifier = Modifier.weight(1f)
                    )
                    OutlinedTextField(
                        value = rollNumber,
                        onValueChange = { rollNumber = it.filter(Char::isDigit) },
                        label = { Text("Roll") },
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                        singleLine = true,
                        modifier = Modifier.weight(1f)
                    )
                }
                OutlinedTextField(
                    value = admissionNumber,
                    onValueChange = { admissionNumber = it },
                    label = { Text("Admission No. (e.g. ADM-2026-009)") },
                    singleLine = true
                )
                OutlinedTextField(
                    value = mobileNumber,
                    onValueChange = { mobileNumber = it.filter(Char::isDigit) },
                    label = { Text("Parent Mobile Number") },
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Phone),
                    singleLine = true
                )
            }
        },
        confirmButton = {
            Button(
                enabled = fullName.isNotBlank() && admissionNumber.isNotBlank(),
                onClick = {
                    val cleanAdm = admissionNumber.trim().uppercase()
                    onSave(
                        StudentEntity(
                            id = "SM-${System.currentTimeMillis() % 100000}",
                            admissionNumber = cleanAdm,
                            fullName = fullName.trim(),
                            fatherName = fatherName.trim().ifEmpty { "Parent / Guardian" },
                            classNumber = classNumber.trim().ifEmpty { "5" },
                            section = section.trim().uppercase().ifEmpty { "A" },
                            rollNumber = rollNumber.toIntOrNull() ?: 1,
                            mobileNumber = mobileNumber.trim().ifEmpty { "9810000000" }
                        )
                    )
                }
            ) {
                Text("Save to Room DB")
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) { Text("Cancel") }
        }
    )
}

@Composable
private fun AddTeacherDialog(
    onDismiss: () -> Unit,
    onSave: (TeacherEntity) -> Unit
) {
    var fullName by remember { mutableStateOf("") }
    var employeeCode by remember { mutableStateOf("") }
    var designation by remember { mutableStateOf("Teacher") }
    var subject by remember { mutableStateOf("") }
    var assignedClass by remember { mutableStateOf("5-A") }
    var mobileNumber by remember { mutableStateOf("") }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Add Offline Teacher Record") },
        text = {
            Column(
                modifier = Modifier.verticalScroll(rememberScrollState()),
                verticalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                OutlinedTextField(
                    value = fullName,
                    onValueChange = { fullName = it },
                    label = { Text("Teacher Full Name") },
                    singleLine = true
                )
                OutlinedTextField(
                    value = employeeCode,
                    onValueChange = { employeeCode = it },
                    label = { Text("Employee Code (e.g. JKEDU-T-120)") },
                    singleLine = true
                )
                OutlinedTextField(
                    value = designation,
                    onValueChange = { designation = it },
                    label = { Text("Designation") },
                    singleLine = true
                )
                OutlinedTextField(
                    value = subject,
                    onValueChange = { subject = it },
                    label = { Text("Primary Subject") },
                    singleLine = true
                )
                OutlinedTextField(
                    value = assignedClass,
                    onValueChange = { assignedClass = it },
                    label = { Text("Assigned Class") },
                    singleLine = true
                )
                OutlinedTextField(
                    value = mobileNumber,
                    onValueChange = { mobileNumber = it.filter(Char::isDigit) },
                    label = { Text("Mobile Number") },
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Phone),
                    singleLine = true
                )
            }
        },
        confirmButton = {
            Button(
                enabled = fullName.isNotBlank() && employeeCode.isNotBlank(),
                onClick = {
                    onSave(
                        TeacherEntity(
                            id = "TCH-${System.currentTimeMillis() % 100000}",
                            employeeCode = employeeCode.trim().uppercase(),
                            fullName = fullName.trim(),
                            designation = designation.trim().ifEmpty { "Teacher" },
                            subject = subject.trim().ifEmpty { "General" },
                            assignedClass = assignedClass.trim().ifEmpty { "All" },
                            mobileNumber = mobileNumber.trim().ifEmpty { "9419000000" }
                        )
                    )
                }
            ) {
                Text("Save to Room DB")
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) { Text("Cancel") }
        }
    )
}

@Composable
fun QrIdCardScreen(
    students: List<StudentEntity>,
    teachers: List<TeacherEntity>,
    targetType: IdCardTargetType,
    selectedStudentId: String?,
    selectedTeacherId: String?,
    onTargetTypeChange: (IdCardTargetType) -> Unit,
    onSelectStudent: (String) -> Unit,
    onSelectTeacher: (String) -> Unit,
    modifier: Modifier = Modifier
) {
    val context = LocalContext.current
    var showFullScreenQr by remember { mutableStateOf(false) }
    var exportFeedback by remember { mutableStateOf<String?>(null) }

    val logoVersion by OfficialLogoStore.logoVersion.collectAsState()
    val officialLogoBitmap = remember(logoVersion) { OfficialLogoStore.loadOfficialLogoBitmap(context) }

    val selectedStudent = students.find { it.id == selectedStudentId } ?: students.firstOrNull()
    val selectedTeacher = teachers.find { it.id == selectedTeacherId } ?: teachers.firstOrNull()

    val payload = when (targetType) {
        IdCardTargetType.STUDENT -> selectedStudent?.let { QrCodeGenerator.buildStudentQrPayload(it) } ?: ""
        IdCardTargetType.TEACHER -> selectedTeacher?.let { QrCodeGenerator.buildTeacherQrPayload(it) } ?: ""
    }

    val qrBitmap = remember(payload) {
        if (payload.isNotEmpty()) QrCodeGenerator.encodeQrImageBitmap(payload, 560) else null
    }

    Column(
        modifier = modifier
            .fillMaxSize()
            .background(Color(0xFFF8FAFC))
            .verticalScroll(rememberScrollState())
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp)
    ) {
        SingleChoiceSegmentedButtonRow(modifier = Modifier.fillMaxWidth()) {
            SegmentedButton(
                selected = targetType == IdCardTargetType.STUDENT,
                onClick = { onTargetTypeChange(IdCardTargetType.STUDENT) },
                shape = SegmentedButtonDefaults.itemShape(index = 0, count = 2)
            ) {
                Text("Student ID Card")
            }
            SegmentedButton(
                selected = targetType == IdCardTargetType.TEACHER,
                onClick = { onTargetTypeChange(IdCardTargetType.TEACHER) },
                shape = SegmentedButtonDefaults.itemShape(index = 1, count = 2)
            ) {
                Text("Teacher ID Card")
            }
        }

        LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            if (targetType == IdCardTargetType.STUDENT) {
                items(students, key = { it.id }) { student ->
                    FilterChip(
                        selected = selectedStudent?.id == student.id,
                        onClick = { onSelectStudent(student.id) },
                        label = {
                            Text(
                                text = "${student.fullName} (${student.classNumber}-${student.section})",
                                maxLines = 1,
                                overflow = TextOverflow.Ellipsis
                            )
                        }
                    )
                }
            } else {
                items(teachers, key = { it.id }) { teacher ->
                    FilterChip(
                        selected = selectedTeacher?.id == teacher.id,
                        onClick = { onSelectTeacher(teacher.id) },
                        label = {
                            Text(
                                text = teacher.fullName,
                                maxLines = 1,
                                overflow = TextOverflow.Ellipsis
                            )
                        }
                    )
                }
            }
        }

        Card(
            shape = RoundedCornerShape(22.dp),
            colors = CardDefaults.cardColors(containerColor = Color.White),
            elevation = CardDefaults.cardElevation(defaultElevation = 2.dp),
            modifier = Modifier.fillMaxWidth()
        ) {
            Column(modifier = Modifier.fillMaxWidth()) {
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .background(
                            if (targetType == IdCardTargetType.STUDENT) Color(0xFF1E1B4B) else Color(0xFF0F766E)
                        )
                        .padding(16.dp)
                ) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(12.dp)
                    ) {
                        Box(
                            modifier = Modifier
                                .size(50.dp)
                                .clip(RoundedCornerShape(12.dp))
                                .background(Color.White)
                                .padding(5.dp),
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
                                    imageVector = if (targetType == IdCardTargetType.STUDENT) Icons.Rounded.Person else Icons.Rounded.Badge,
                                    contentDescription = null,
                                    tint = if (targetType == IdCardTargetType.STUDENT) Color(0xFF1E1B4B) else Color(0xFF0F766E),
                                    modifier = Modifier.size(28.dp)
                                )
                            }
                        }
                        Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
                            Text(
                                text = "GOVT MIDDLE SCHOOL PAMPOSH COLONY",
                                style = MaterialTheme.typography.labelSmall,
                                color = Color(0xFFE0E7FF),
                                fontWeight = FontWeight.Bold
                            )
                            Text(
                                text = "Pamposh Colony, Palapora Zone, Iddgah",
                                style = MaterialTheme.typography.labelSmall,
                                color = Color(0xFFFDE68A)
                            )
                            Text(
                                text = if (targetType == IdCardTargetType.STUDENT) {
                                    "OFFICIAL STUDENT SMART ID CARD"
                                } else {
                                    "OFFICIAL FACULTY SMART ID CARD"
                                },
                                style = MaterialTheme.typography.titleSmall,
                                color = Color.White,
                                fontWeight = FontWeight.Bold
                            )
                        }
                    }
                }

                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(20.dp),
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    if (targetType == IdCardTargetType.STUDENT && selectedStudent != null) {
                        Text(
                            text = selectedStudent.fullName,
                            style = MaterialTheme.typography.titleLarge,
                            fontWeight = FontWeight.Bold,
                            color = Color(0xFF0F172A)
                        )
                        Text(
                            text = "Class ${selectedStudent.classNumber}-${selectedStudent.section} • Roll #${selectedStudent.rollNumber} • ${selectedStudent.admissionNumber}",
                            style = MaterialTheme.typography.bodyMedium,
                            color = Color(0xFF475569)
                        )
                    } else if (targetType == IdCardTargetType.TEACHER && selectedTeacher != null) {
                        Text(
                            text = selectedTeacher.fullName,
                            style = MaterialTheme.typography.titleLarge,
                            fontWeight = FontWeight.Bold,
                            color = Color(0xFF0F172A)
                        )
                        Text(
                            text = "${selectedTeacher.designation} • ${selectedTeacher.employeeCode}",
                            style = MaterialTheme.typography.bodyMedium,
                            color = Color(0xFF475569)
                        )
                    }

                    if (qrBitmap != null) {
                        Box(
                            modifier = Modifier
                                .size(236.dp)
                                .clip(RoundedCornerShape(16.dp))
                                .background(Color.White)
                                .border(2.dp, Color(0xFFE2E8F0), RoundedCornerShape(16.dp))
                                .clickable { showFullScreenQr = true }
                                .padding(10.dp),
                            contentAlignment = Alignment.Center
                        ) {
                            Image(
                                bitmap = qrBitmap,
                                contentDescription = "Scannable QR ID Card",
                                filterQuality = FilterQuality.None,
                                contentScale = ContentScale.Fit,
                                modifier = Modifier.fillMaxSize()
                            )
                        }
                    }

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        Button(
                            onClick = { showFullScreenQr = true },
                            colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF4F46E5)),
                            shape = RoundedCornerShape(12.dp),
                            modifier = Modifier.weight(1f)
                        ) {
                            Icon(
                                imageVector = Icons.Rounded.Fullscreen,
                                contentDescription = null,
                                modifier = Modifier.size(18.dp)
                            )
                            Spacer(modifier = Modifier.width(6.dp))
                            Text("Enlarge QR", fontWeight = FontWeight.Bold)
                        }

                        OutlinedButton(
                            enabled = payload.isNotEmpty(),
                            onClick = {
                                val rawBitmap = QrCodeGenerator.encodeQrBitmap(payload, 720)
                                if (rawBitmap != null) {
                                    val holderName = if (targetType == IdCardTargetType.STUDENT) {
                                        selectedStudent?.fullName ?: "Student_QR"
                                    } else {
                                        selectedTeacher?.fullName ?: "Teacher_QR"
                                    }
                                    BiometricAuditCsvExporter.shareBitmapImage(
                                        context = context,
                                        bitmap = rawBitmap,
                                        subDir = "shared_qr",
                                        fileNamePrefix = "QR_${holderName}",
                                        chooserTitle = "Quick Share QR ID Card",
                                        shareText = "Official School Master QR ID — $holderName"
                                    )
                                }
                            },
                            shape = RoundedCornerShape(12.dp),
                            modifier = Modifier.weight(1f)
                        ) {
                            Icon(
                                imageVector = Icons.Rounded.Share,
                                contentDescription = "Quick Share QR",
                                modifier = Modifier.size(18.dp)
                            )
                            Spacer(modifier = Modifier.width(6.dp))
                            Text("Quick Share", fontWeight = FontWeight.Bold)
                        }
                    }

                    // Student-Wise / Faculty Individual Smart ID Card Download (PDF & JPEG)
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        Button(
                            enabled = payload.isNotEmpty(),
                            onClick = {
                                val isStudent = targetType == IdCardTargetType.STUDENT
                                val holderName = if (isStudent) selectedStudent?.fullName ?: "Student" else selectedTeacher?.fullName ?: "Teacher"
                                val subtitle = if (isStudent) {
                                    "Class ${selectedStudent?.classNumber ?: ""}-${selectedStudent?.section ?: ""} • Roll #${selectedStudent?.rollNumber ?: ""}"
                                } else {
                                    selectedTeacher?.designation ?: "Faculty"
                                }
                                val idNum = if (isStudent) selectedStudent?.admissionNumber ?: "" else selectedTeacher?.employeeCode ?: ""
                                val extra = if (isStudent) {
                                    "Parent: ${selectedStudent?.parentPhone?.ifBlank { "On Record" } ?: "On Record"}"
                                } else {
                                    "Dept: ${selectedTeacher?.subjectSpecialty?.ifBlank { "General" } ?: "General"}"
                                }
                                val idBitmap = SmartIdCardExporter.renderSmartIdCardBitmap(
                                    context = context,
                                    holderName = holderName,
                                    subtitleLine = subtitle,
                                    idNumber = idNum,
                                    extraDetail = extra,
                                    isStudent = isStudent,
                                    qrPayload = payload
                                )
                                val ok = SmartIdCardExporter.printSmartIdAsPdf(
                                    context = context,
                                    bitmap = idBitmap,
                                    jobTitle = "SmartID_${holderName}"
                                )
                                exportFeedback = if (ok) {
                                    "Opened Print / Save as PDF for $holderName Smart ID."
                                } else {
                                    "Unable to launch PDF print service on this device."
                                }
                            },
                            colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF0F766E)),
                            shape = RoundedCornerShape(12.dp),
                            modifier = Modifier.weight(1f)
                        ) {
                            Icon(
                                imageVector = Icons.Rounded.PictureAsPdf,
                                contentDescription = null,
                                modifier = Modifier.size(18.dp)
                            )
                            Spacer(modifier = Modifier.width(6.dp))
                            Text("Download PDF", fontWeight = FontWeight.Bold)
                        }

                        Button(
                            enabled = payload.isNotEmpty(),
                            onClick = {
                                val isStudent = targetType == IdCardTargetType.STUDENT
                                val holderName = if (isStudent) selectedStudent?.fullName ?: "Student" else selectedTeacher?.fullName ?: "Teacher"
                                val subtitle = if (isStudent) {
                                    "Class ${selectedStudent?.classNumber ?: ""}-${selectedStudent?.section ?: ""} • Roll #${selectedStudent?.rollNumber ?: ""}"
                                } else {
                                    selectedTeacher?.designation ?: "Faculty"
                                }
                                val idNum = if (isStudent) selectedStudent?.admissionNumber ?: "" else selectedTeacher?.employeeCode ?: ""
                                val extra = if (isStudent) {
                                    "Parent: ${selectedStudent?.parentPhone?.ifBlank { "On Record" } ?: "On Record"}"
                                } else {
                                    "Dept: ${selectedTeacher?.subjectSpecialty?.ifBlank { "General" } ?: "General"}"
                                }
                                val idBitmap = SmartIdCardExporter.renderSmartIdCardBitmap(
                                    context = context,
                                    holderName = holderName,
                                    subtitleLine = subtitle,
                                    idNumber = idNum,
                                    extraDetail = extra,
                                    isStudent = isStudent,
                                    qrPayload = payload
                                )
                                val ok = SmartIdCardExporter.saveSmartIdAsJpeg(
                                    context = context,
                                    bitmap = idBitmap,
                                    fileNamePrefix = "SmartID_${holderName}"
                                )
                                exportFeedback = if (ok) {
                                    "Saved JPEG Smart ID for $holderName to Pictures/SchoolMaster_SmartID."
                                } else {
                                    "Could not save JPEG image. Check storage permissions."
                                }
                            },
                            colors = ButtonDefaults.buttonColors(containerColor = Color(0xFFD97706)),
                            shape = RoundedCornerShape(12.dp),
                            modifier = Modifier.weight(1f)
                        ) {
                            Icon(
                                imageVector = Icons.Rounded.Image,
                                contentDescription = null,
                                modifier = Modifier.size(18.dp)
                            )
                            Spacer(modifier = Modifier.width(6.dp))
                            Text("Download JPEG", fontWeight = FontWeight.Bold)
                        }
                    }

                    if (!exportFeedback.isNullOrBlank()) {
                        Surface(
                            color = Color(0xFFECFDF5),
                            shape = RoundedCornerShape(10.dp),
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            Text(
                                text = exportFeedback.orEmpty(),
                                style = MaterialTheme.typography.bodySmall,
                                color = Color(0xFF065F46),
                                fontWeight = FontWeight.Medium,
                                modifier = Modifier.padding(horizontal = 12.dp, vertical = 8.dp)
                            )
                        }
                    }
                }
            }
        }

        if (payload.isNotEmpty()) {
            Card(
                shape = RoundedCornerShape(16.dp),
                colors = CardDefaults.cardColors(containerColor = Color.White),
                modifier = Modifier.fillMaxWidth()
            ) {
                Column(modifier = Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    Text(
                        text = "ENCODED SCANNER PAYLOAD (7-FIELD FORMAT)",
                        style = MaterialTheme.typography.labelSmall,
                        fontWeight = FontWeight.Bold,
                        color = Color(0xFF4F46E5)
                    )
                    Text(
                        text = payload,
                        style = MaterialTheme.typography.bodySmall.copy(fontFamily = FontFamily.Monospace),
                        color = Color(0xFF334155)
                    )
                }
            }
        }
    }

    if (showFullScreenQr && qrBitmap != null) {
        Dialog(
            onDismissRequest = { showFullScreenQr = false },
            properties = DialogProperties(usePlatformDefaultWidth = false)
        ) {
            Surface(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(16.dp),
                shape = RoundedCornerShape(24.dp),
                color = Color.White
            ) {
                Column(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(24.dp),
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.Center
                ) {
                    Text(
                        text = if (targetType == IdCardTargetType.STUDENT) {
                            selectedStudent?.fullName ?: "Student QR ID"
                        } else {
                            selectedTeacher?.fullName ?: "Teacher QR ID"
                        },
                        style = MaterialTheme.typography.headlineSmall,
                        fontWeight = FontWeight.Bold,
                        color = Color(0xFF0F172A)
                    )
                    Spacer(modifier = Modifier.height(6.dp))
                    Text(
                        text = "Hold steady in front of the Attendance Scanner camera",
                        style = MaterialTheme.typography.bodySmall,
                        color = Color(0xFF64748B)
                    )
                    Spacer(modifier = Modifier.height(24.dp))
                    Image(
                        bitmap = qrBitmap,
                        contentDescription = "Full Screen QR Code",
                        filterQuality = FilterQuality.None,
                        contentScale = ContentScale.Fit,
                        modifier = Modifier
                            .size(310.dp)
                            .border(2.dp, Color(0xFFCBD5E1), RoundedCornerShape(16.dp))
                            .padding(10.dp)
                    )
                    Spacer(modifier = Modifier.height(24.dp))
                    Button(
                        onClick = { showFullScreenQr = false },
                        shape = RoundedCornerShape(12.dp)
                    ) {
                        Text("Close Display")
                    }
                }
            }
        }
    }
}

@Composable
private fun SubmitTeacherLeaveDialog(
    teachers: List<TeacherEntity>,
    mandatoryBiometricEnabled: Boolean,
    onDismiss: () -> Unit,
    onSubmit: (TeacherLeaveEntity) -> Unit
) {
    val todayIso = remember { SimpleDateFormat("yyyy-MM-dd", Locale.US).format(Date()) }
    var selectedTeacherName by remember {
        mutableStateOf(teachers.firstOrNull()?.fullName ?: "Nazir Ahmad Dar")
    }
    var selectedTeacherId by remember {
        mutableStateOf(teachers.firstOrNull()?.id ?: "TCH-2026-001")
    }
    var leaveType by remember { mutableStateOf("Casual Leave") }
    var startDate by remember { mutableStateOf(todayIso) }
    var endDate by remember { mutableStateOf(todayIso) }
    var totalDaysText by remember { mutableStateOf("1") }
    var reason by remember { mutableStateOf("") }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                Icon(
                    imageVector = if (mandatoryBiometricEnabled) Icons.Rounded.Fingerprint else Icons.Rounded.EventNote,
                    contentDescription = null,
                    tint = Color(0xFF4F46E5)
                )
                Text("New Teacher Leave Request", fontWeight = FontWeight.Bold)
            }
        },
        text = {
            Column(
                modifier = Modifier.verticalScroll(rememberScrollState()),
                verticalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                if (teachers.isNotEmpty()) {
                    LazyRow(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                        items(teachers, key = { it.id }) { t ->
                            FilterChip(
                                selected = selectedTeacherId == t.id,
                                onClick = {
                                    selectedTeacherId = t.id
                                    selectedTeacherName = t.fullName
                                },
                                label = { Text(t.fullName.substringBefore(" "), maxLines = 1) }
                            )
                        }
                    }
                }
                OutlinedTextField(
                    value = selectedTeacherName,
                    onValueChange = { selectedTeacherName = it },
                    label = { Text("Teacher Name") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth()
                )
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(6.dp)
                ) {
                    listOf("Casual Leave", "Medical Leave", "Earned Leave").forEach { type ->
                        FilterChip(
                            selected = leaveType == type,
                            onClick = { leaveType = type },
                            label = { Text(type.substringBefore(" "), maxLines = 1) },
                            modifier = Modifier.weight(1f)
                        )
                    }
                }
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    OutlinedTextField(
                        value = startDate,
                        onValueChange = { startDate = it },
                        label = { Text("Start Date") },
                        singleLine = true,
                        modifier = Modifier.weight(1f)
                    )
                    OutlinedTextField(
                        value = endDate,
                        onValueChange = { endDate = it },
                        label = { Text("End Date") },
                        singleLine = true,
                        modifier = Modifier.weight(1f)
                    )
                }
                OutlinedTextField(
                    value = totalDaysText,
                    onValueChange = { totalDaysText = it.filter { ch -> ch.isDigit() } },
                    label = { Text("Total Days") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth()
                )
                OutlinedTextField(
                    value = reason,
                    onValueChange = { reason = it },
                    label = { Text("Reason for Leave") },
                    minLines = 2,
                    modifier = Modifier.fillMaxWidth()
                )
                if (mandatoryBiometricEnabled) {
                    Surface(
                        color = Color(0xFFEEF2FF),
                        shape = RoundedCornerShape(10.dp),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Text(
                            text = "Mandatory Biometric Auth is ON — BiometricPrompt will verify your identity before submitting.",
                            style = MaterialTheme.typography.labelSmall,
                            color = Color(0xFF3730A3),
                            modifier = Modifier.padding(8.dp)
                        )
                    }
                }
            }
        },
        confirmButton = {
            Button(
                enabled = selectedTeacherName.isNotBlank() && reason.isNotBlank(),
                onClick = {
                    val days = totalDaysText.toIntOrNull()?.coerceAtLeast(1) ?: 1
                    onSubmit(
                        TeacherLeaveEntity(
                            id = "LV-${System.currentTimeMillis()}",
                            teacherId = selectedTeacherId,
                            teacherName = selectedTeacherName.trim(),
                            leaveType = leaveType,
                            startDate = startDate.trim().ifEmpty { todayIso },
                            endDate = endDate.trim().ifEmpty { todayIso },
                            totalDays = days,
                            reason = reason.trim(),
                            status = "Pending"
                        )
                    )
                },
                colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF4F46E5))
            ) {
                Text(if (mandatoryBiometricEnabled) "Authenticate & Submit" else "Submit Request")
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) { Text("Cancel") }
        }
    )
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ProtectedModulesScreen(
    activity: FragmentActivity?,
    leaves: List<TeacherLeaveEntity>,
    examinations: List<ExaminationEntity>,
    auditLogs: List<BiometricAuditLogEntity>,
    isUnlocked: Boolean,
    onUnlockSuccess: () -> Unit,
    onLockNow: () -> Unit,
    onLeaveDecision: (String, Boolean) -> Unit,
    onBiometricAudit: (outcome: String, authMethod: String, detailMessage: String) -> Unit,
    teachers: List<TeacherEntity> = emptyList(),
    onSubmitLeave: (TeacherLeaveEntity) -> Unit = {},
    modifier: Modifier = Modifier
) {
    val context = LocalContext.current
    var selectedSubTab by remember { mutableIntStateOf(0) } // 0 = Teacher Leave, 1 = Security Audit, 2 = Examinations
    var authFeedback by remember { mutableStateOf<String?>(null) }
    var showSubmitLeaveDialog by remember { mutableStateOf(false) }
    var mandatoryBiometricEnabled by remember {
        mutableStateOf(SecurityPreferences.isMandatoryBiometricEnabled(context))
    }

    // Security Audit tab search & specific start/end date-range picker state
    var auditSearchQuery by remember { mutableStateOf("") }
    var auditDateRangeDays by remember { mutableIntStateOf(0) } // 0 = All, 1 = Today, 7 = 7d, 30 = 30d
    var customStartDateMillis by remember { mutableStateOf<Long?>(null) }
    var customEndDateMillis by remember { mutableStateOf<Long?>(null) }
    var showAuditDateRangePicker by remember { mutableStateOf(false) }
    var exportStatusMsg by remember { mutableStateOf<String?>(null) }
    val auditRangeDateFormatter = remember { SimpleDateFormat("dd MMM yyyy", Locale.getDefault()) }

    val filteredAuditLogs = remember(
        auditLogs,
        auditSearchQuery,
        auditDateRangeDays,
        customStartDateMillis,
        customEndDateMillis
    ) {
        val now = System.currentTimeMillis()
        val hasCustomRange = customStartDateMillis != null || customEndDateMillis != null
        val startBoundMillis = when {
            customStartDateMillis != null -> {
                Calendar.getInstance().apply {
                    timeInMillis = customStartDateMillis!!
                    set(Calendar.HOUR_OF_DAY, 0)
                    set(Calendar.MINUTE, 0)
                    set(Calendar.SECOND, 0)
                    set(Calendar.MILLISECOND, 0)
                }.timeInMillis
            }
            !hasCustomRange && auditDateRangeDays > 0 -> now - auditDateRangeDays * 24L * 60L * 60L * 1000L
            else -> 0L
        }
        val endBoundMillis = when {
            customEndDateMillis != null -> {
                Calendar.getInstance().apply {
                    timeInMillis = customEndDateMillis!!
                    set(Calendar.HOUR_OF_DAY, 23)
                    set(Calendar.MINUTE, 59)
                    set(Calendar.SECOND, 59)
                    set(Calendar.MILLISECOND, 999)
                }.timeInMillis
            }
            customStartDateMillis != null -> {
                Calendar.getInstance().apply {
                    timeInMillis = customStartDateMillis!!
                    set(Calendar.HOUR_OF_DAY, 23)
                    set(Calendar.MINUTE, 59)
                    set(Calendar.SECOND, 59)
                    set(Calendar.MILLISECOND, 999)
                }.timeInMillis
            }
            else -> Long.MAX_VALUE
        }
        val q = auditSearchQuery.trim().lowercase()
        auditLogs.filter { entry ->
            val matchesDate = entry.timestampMillis in startBoundMillis..endBoundMillis
            val matchesQuery = q.isEmpty() ||
                entry.actorName.lowercase().contains(q) ||
                entry.description.lowercase().contains(q) ||
                entry.detailMessage.lowercase().contains(q) ||
                entry.eventType.lowercase().contains(q) ||
                entry.authMethod.lowercase().contains(q)
            matchesDate && matchesQuery
        }
    }

    val safCsvLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.CreateDocument("text/csv")
    ) { uri ->
        if (uri != null) {
            val saved = BiometricAuditCsvExporter.writeCsvToUri(context, uri, filteredAuditLogs)
            exportStatusMsg = if (saved) {
                "Exported ${filteredAuditLogs.size} audit log record(s) to CSV via Storage Access Framework."
            } else {
                "Failed to write CSV file."
            }
        }
    }

    val availability = remember(activity) {
        if (activity != null) {
            BiometricAuthHelper.checkAvailability(activity)
        } else {
            BiometricAvailability.Unavailable("Activity context unavailable.")
        }
    }

    // Helper: enforce persistent Mandatory Biometric Auth toggle before submitting ANY new teacher leave request
    fun handleGuardedLeaveSubmission(newLeave: TeacherLeaveEntity) {
        if (!mandatoryBiometricEnabled) {
            onBiometricAudit(
                "SUCCESS",
                "Optional Policy Bypass",
                "Submitted ${newLeave.leaveType} request for ${newLeave.teacherName} (Mandatory Biometric Auth OFF)"
            )
            onSubmitLeave(newLeave)
            showSubmitLeaveDialog = false
            return
        }
        if (activity == null) {
            authFeedback = "FragmentActivity unavailable for BiometricPrompt."
            onBiometricAudit("FAILURE", "System Prompt", "Could not verify leave submission for ${newLeave.teacherName}")
            return
        }
        BiometricAuthHelper.authenticateSensitiveModule(
            activity = activity,
            moduleTitle = "Submit Teacher Leave Request",
            subtitle = "Authenticate via BiometricPrompt or PIN/Pattern before submitting ${newLeave.teacherName}'s leave request",
            onSuccess = {
                authFeedback = null
                onSubmitLeave(newLeave)
                showSubmitLeaveDialog = false
            },
            onFailure = { message ->
                authFeedback = message
            },
            onAuditEvent = { outcome, method, detail ->
                onBiometricAudit(outcome, method, "Submit Leave (${newLeave.teacherName}): $detail")
            }
        )
    }

    // Helper: enforce Mandatory Biometric Auth flag before executing Leave Approve / Reject
    fun handleGuardedLeaveAction(leave: TeacherLeaveEntity, approved: Boolean) {
        val actionWord = if (approved) "Approve" else "Reject"
        if (!mandatoryBiometricEnabled) {
            onBiometricAudit(
                "SUCCESS",
                "Optional Policy Bypass",
                "$actionWord leave for ${leave.teacherName} (Mandatory Biometric Auth OFF)"
            )
            onLeaveDecision(leave.id, approved)
            return
        }
        if (activity == null) {
            authFeedback = "FragmentActivity unavailable for BiometricPrompt."
            onBiometricAudit("FAILURE", "System Prompt", "Could not verify leave $actionWord for ${leave.teacherName}")
            return
        }
        BiometricAuthHelper.authenticateSensitiveModule(
            activity = activity,
            moduleTitle = "$actionWord Teacher Leave",
            subtitle = "Verify via Biometric or PIN/Pattern to $actionWord ${leave.teacherName}'s leave",
            onSuccess = {
                authFeedback = null
                onLeaveDecision(leave.id, approved)
            },
            onFailure = { message ->
                authFeedback = message
            },
            onAuditEvent = { outcome, method, detail ->
                onBiometricAudit(outcome, method, "$actionWord (${leave.teacherName}): $detail")
            }
        )
    }

    if (!isUnlocked && mandatoryBiometricEnabled) {
        Column(
            modifier = modifier
                .fillMaxSize()
                .background(Color(0xFFF8FAFC))
                .padding(20.dp),
            verticalArrangement = Arrangement.Center,
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Card(
                shape = RoundedCornerShape(24.dp),
                colors = CardDefaults.cardColors(containerColor = Color.White),
                elevation = CardDefaults.cardElevation(defaultElevation = 3.dp),
                modifier = Modifier.fillMaxWidth()
            ) {
                Column(
                    modifier = Modifier.padding(24.dp),
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    Box(
                        modifier = Modifier
                            .size(72.dp)
                            .clip(RoundedCornerShape(20.dp))
                            .background(Color(0xFFEEF2FF)),
                        contentAlignment = Alignment.Center
                    ) {
                        Icon(
                            imageVector = Icons.Rounded.Fingerprint,
                            contentDescription = "Biometric Security",
                            tint = Color(0xFF4F46E5),
                            modifier = Modifier.size(42.dp)
                        )
                    }

                    Text(
                        text = "Biometric & PIN/Pattern Security Gate",
                        style = MaterialTheme.typography.titleLarge,
                        fontWeight = FontWeight.Bold,
                        color = Color(0xFF0F172A)
                    )

                    Text(
                        text = "Teacher Leave Approvals & Confidential Examination Schedules are protected via Android BiometricPrompt with automatic Device PIN / Pattern fallback.",
                        style = MaterialTheme.typography.bodySmall,
                        color = Color(0xFF475569)
                    )

                    if (auditLogs.isNotEmpty()) {
                        Surface(
                            color = Color(0xFFF1F5F9),
                            shape = RoundedCornerShape(10.dp),
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            Row(
                                modifier = Modifier.padding(horizontal = 12.dp, vertical = 8.dp),
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.spacedBy(8.dp)
                            ) {
                                Icon(
                                    imageVector = Icons.Rounded.History,
                                    contentDescription = null,
                                    tint = Color(0xFF4F46E5),
                                    modifier = Modifier.size(16.dp)
                                )
                                val latest = auditLogs.first()
                                Text(
                                    text = "Audit Log Active: ${auditLogs.size} total entries (Last: ${latest.eventType})",
                                    style = MaterialTheme.typography.labelSmall,
                                    color = Color(0xFF334155),
                                    fontWeight = FontWeight.Medium
                                )
                            }
                        }
                    }

                    if (availability is BiometricAvailability.Unavailable) {
                        Surface(
                            color = Color(0xFFFEF3C7),
                            shape = RoundedCornerShape(12.dp),
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            Text(
                                text = "${availability.reason} Device PIN/Pattern fallback remains supported.",
                                style = MaterialTheme.typography.labelSmall,
                                color = Color(0xFF92400E),
                                modifier = Modifier.padding(10.dp)
                            )
                        }
                    }

                    if (authFeedback != null) {
                        Surface(
                            color = Color(0xFFFEE2E2),
                            shape = RoundedCornerShape(12.dp),
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            Text(
                                text = authFeedback ?: "",
                                style = MaterialTheme.typography.labelSmall,
                                color = Color(0xFF991B1B),
                                modifier = Modifier.padding(10.dp)
                            )
                        }
                    }

                    Button(
                        onClick = {
                            if (activity == null) {
                                val errorMsg = "Unable to access FragmentActivity for BiometricPrompt."
                                authFeedback = errorMsg
                                onBiometricAudit("FAILURE", "System Prompt", errorMsg)
                            } else {
                                authFeedback = null
                                BiometricAuthHelper.authenticateSensitiveModule(
                                    activity = activity,
                                    moduleTitle = "Teacher Leave & Examinations",
                                    subtitle = "Confirm with Fingerprint, Face, or PIN/Pattern",
                                    onSuccess = {
                                        authFeedback = null
                                        onUnlockSuccess()
                                    },
                                    onFailure = { message ->
                                        authFeedback = message
                                    },
                                    onAuditEvent = onBiometricAudit
                                )
                            }
                        },
                        colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF4F46E5)),
                        shape = RoundedCornerShape(14.dp),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Icon(
                            imageVector = Icons.Rounded.LockOpen,
                            contentDescription = null,
                            modifier = Modifier.size(18.dp)
                        )
                        Spacer(modifier = Modifier.width(8.dp))
                        Text("Authenticate (Biometric / PIN / Pattern)", fontWeight = FontWeight.Bold)
                    }
                }
            }
        }
        return
    }

    Column(
        modifier = modifier
            .fillMaxSize()
            .background(Color(0xFFF8FAFC))
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        Card(
            shape = RoundedCornerShape(16.dp),
            colors = CardDefaults.cardColors(containerColor = Color(0xFF065F46)),
            modifier = Modifier.fillMaxWidth()
        ) {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(14.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                    modifier = Modifier.weight(1f)
                ) {
                    Icon(
                        imageVector = Icons.Rounded.VerifiedUser,
                        contentDescription = null,
                        tint = Color.White
                    )
                    Column {
                        Text(
                            text = if (mandatoryBiometricEnabled) "Biometric Security Active" else "Biometric Gate Optional",
                            style = MaterialTheme.typography.titleSmall,
                            color = Color.White,
                            fontWeight = FontWeight.Bold
                        )
                        Text(
                            text = "Teacher Leave Approvals, Security Settings & Audit Log",
                            style = MaterialTheme.typography.labelSmall,
                            color = Color(0xFFD1FAE5)
                        )
                    }
                }
                OutlinedButton(
                    onClick = onLockNow,
                    colors = ButtonDefaults.outlinedButtonColors(contentColor = Color.White),
                    shape = RoundedCornerShape(10.dp)
                ) {
                    Icon(
                        imageVector = Icons.Rounded.Lock,
                        contentDescription = null,
                        modifier = Modifier.size(16.dp)
                    )
                    Spacer(modifier = Modifier.width(4.dp))
                    Text("Lock")
                }
            }
        }

        SingleChoiceSegmentedButtonRow(modifier = Modifier.fillMaxWidth()) {
            SegmentedButton(
                selected = selectedSubTab == 0,
                onClick = { selectedSubTab = 0 },
                shape = SegmentedButtonDefaults.itemShape(index = 0, count = 3)
            ) {
                Text("Leave (${leaves.size})", maxLines = 1)
            }
            SegmentedButton(
                selected = selectedSubTab == 1,
                onClick = { selectedSubTab = 1 },
                shape = SegmentedButtonDefaults.itemShape(index = 1, count = 3)
            ) {
                Text("Audit (${auditLogs.size})", maxLines = 1)
            }
            SegmentedButton(
                selected = selectedSubTab == 2,
                onClick = { selectedSubTab = 2 },
                shape = SegmentedButtonDefaults.itemShape(index = 2, count = 3)
            ) {
                Text("Exams (${examinations.size})", maxLines = 1)
            }
        }

        if (authFeedback != null) {
            Surface(
                color = Color(0xFFFEE2E2),
                shape = RoundedCornerShape(12.dp),
                modifier = Modifier.fillMaxWidth()
            ) {
                Text(
                    text = authFeedback ?: "",
                    style = MaterialTheme.typography.labelSmall,
                    color = Color(0xFF991B1B),
                    modifier = Modifier.padding(10.dp)
                )
            }
        }

        LazyColumn(
            modifier = Modifier.fillMaxSize(),
            verticalArrangement = Arrangement.spacedBy(10.dp),
            contentPadding = PaddingValues(bottom = 24.dp)
        ) {
            when (selectedSubTab) {
                0 -> {
                    // Security Settings Card (SharedPreferences Mandatory Biometric Auth toggle)
                    item(key = "security-settings-card") {
                        Card(
                            shape = RoundedCornerShape(16.dp),
                            colors = CardDefaults.cardColors(containerColor = Color.White),
                            modifier = Modifier
                                .fillMaxWidth()
                                .border(1.dp, Color(0xFFE2E8F0), RoundedCornerShape(16.dp))
                        ) {
                            Row(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(14.dp),
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.SpaceBetween
                            ) {
                                Column(modifier = Modifier.weight(1f)) {
                                    Text(
                                        text = "Teacher Leave Settings — Mandatory Biometric Auth",
                                        style = MaterialTheme.typography.titleSmall,
                                        fontWeight = FontWeight.Bold,
                                        color = Color(0xFF0F172A)
                                    )
                                    Text(
                                        text = if (mandatoryBiometricEnabled) {
                                            "Required: BiometricPrompt runs before submitting or approving any teacher leave request."
                                        } else {
                                            "Optional: Teacher leave requests can be submitted and approved without re-prompting."
                                        },
                                        style = MaterialTheme.typography.labelSmall,
                                        color = Color(0xFF64748B)
                                    )
                                }
                                Switch(
                                    checked = mandatoryBiometricEnabled,
                                    onCheckedChange = { enabled ->
                                        mandatoryBiometricEnabled = enabled
                                        SecurityPreferences.setMandatoryBiometricEnabled(context, enabled)
                                    }
                                )
                            }
                        }
                    }

                    // Action Button: Submit New Teacher Leave Request (triggers BiometricPrompt if toggle ON)
                    item(key = "submit-leave-cta") {
                        Button(
                            onClick = { showSubmitLeaveDialog = true },
                            colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF4F46E5)),
                            shape = RoundedCornerShape(14.dp),
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            Icon(
                                imageVector = if (mandatoryBiometricEnabled) Icons.Rounded.Fingerprint else Icons.Rounded.Add,
                                contentDescription = null,
                                modifier = Modifier.size(18.dp)
                            )
                            Spacer(modifier = Modifier.width(8.dp))
                            Text(
                                text = if (mandatoryBiometricEnabled) {
                                    "Submit Teacher Leave Request (Biometric Required)"
                                } else {
                                    "Submit Teacher Leave Request"
                                },
                                fontWeight = FontWeight.Bold
                            )
                        }
                    }

                    items(leaves, key = { it.id }) { leave ->
                        Card(
                            shape = RoundedCornerShape(16.dp),
                            colors = CardDefaults.cardColors(containerColor = Color.White),
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            Column(
                                modifier = Modifier.padding(14.dp),
                                verticalArrangement = Arrangement.spacedBy(6.dp)
                            ) {
                                Row(
                                    modifier = Modifier.fillMaxWidth(),
                                    horizontalArrangement = Arrangement.SpaceBetween,
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    Row(
                                        verticalAlignment = Alignment.CenterVertically,
                                        horizontalArrangement = Arrangement.spacedBy(6.dp)
                                    ) {
                                        Icon(
                                            imageVector = Icons.Rounded.EventNote,
                                            contentDescription = null,
                                            tint = Color(0xFF4F46E5),
                                            modifier = Modifier.size(18.dp)
                                        )
                                        Text(
                                            text = leave.teacherName,
                                            style = MaterialTheme.typography.titleSmall,
                                            fontWeight = FontWeight.Bold
                                        )
                                    }
                                    Surface(
                                        color = when (leave.status) {
                                            "Approved" -> Color(0xFFD1FAE5)
                                            "Rejected" -> Color(0xFFFEE2E2)
                                            else -> Color(0xFFFEF3C7)
                                        },
                                        shape = RoundedCornerShape(8.dp)
                                    ) {
                                        Text(
                                            text = leave.status.uppercase(),
                                            style = MaterialTheme.typography.labelSmall,
                                            fontWeight = FontWeight.Bold,
                                            color = when (leave.status) {
                                                "Approved" -> Color(0xFF065F46)
                                                "Rejected" -> Color(0xFF991B1B)
                                                else -> Color(0xFF92400E)
                                            },
                                            modifier = Modifier.padding(horizontal = 8.dp, vertical = 3.dp)
                                        )
                                    }
                                }
                                Text(
                                    text = "${leave.leaveType} • ${leave.startDate} to ${leave.endDate} (${leave.totalDays} days)",
                                    style = MaterialTheme.typography.bodySmall,
                                    color = Color(0xFF334155)
                                )
                                Text(
                                    text = "Reason: ${leave.reason}",
                                    style = MaterialTheme.typography.labelSmall,
                                    color = Color(0xFF64748B)
                                )
                                HorizontalDivider(color = Color(0xFFF1F5F9))
                                Row(
                                    modifier = Modifier.fillMaxWidth(),
                                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                                ) {
                                    Button(
                                        onClick = { handleGuardedLeaveAction(leave, approved = true) },
                                        enabled = leave.status != "Approved",
                                        colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF059669)),
                                        shape = RoundedCornerShape(10.dp),
                                        modifier = Modifier.weight(1f)
                                    ) {
                                        Icon(
                                            imageVector = Icons.Rounded.CheckCircle,
                                            contentDescription = null,
                                            modifier = Modifier.size(16.dp)
                                        )
                                        Spacer(modifier = Modifier.width(6.dp))
                                        Text("Approve")
                                    }
                                    OutlinedButton(
                                        onClick = { handleGuardedLeaveAction(leave, approved = false) },
                                        enabled = leave.status != "Rejected",
                                        shape = RoundedCornerShape(10.dp),
                                        modifier = Modifier.weight(1f)
                                    ) {
                                        Text("Reject", color = Color(0xFFB91C1C))
                                    }
                                }
                            }
                        }
                    }
                }

                1 -> {
                    // Dedicated Security Audit Tab (Searchable + Date Range Filter + SAF CSV Export + ShareIntent CSV)
                    item(key = "security-audit-controls") {
                        Card(
                            shape = RoundedCornerShape(18.dp),
                            colors = CardDefaults.cardColors(containerColor = Color.White),
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            Column(
                                modifier = Modifier.padding(14.dp),
                                verticalArrangement = Arrangement.spacedBy(10.dp)
                            ) {
                                OutlinedTextField(
                                    value = auditSearchQuery,
                                    onValueChange = { auditSearchQuery = it },
                                    placeholder = { Text("Search actor name or event description...") },
                                    leadingIcon = { Icon(Icons.Rounded.Search, contentDescription = null) },
                                    trailingIcon = {
                                        if (auditSearchQuery.isNotEmpty()) {
                                            IconButton(onClick = { auditSearchQuery = "" }) {
                                                Icon(Icons.Rounded.Close, contentDescription = "Clear")
                                            }
                                        }
                                    },
                                    singleLine = true,
                                    shape = RoundedCornerShape(12.dp),
                                    modifier = Modifier.fillMaxWidth()
                                )

                                // Specific Start & End Date-Range Picker Control
                                Row(
                                    modifier = Modifier.fillMaxWidth(),
                                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    OutlinedButton(
                                        onClick = { showAuditDateRangePicker = true },
                                        shape = RoundedCornerShape(10.dp),
                                        modifier = Modifier.weight(1f)
                                    ) {
                                        Icon(
                                            imageVector = Icons.Rounded.DateRange,
                                            contentDescription = "Pick Date Range",
                                            tint = Color(0xFF4F46E5),
                                            modifier = Modifier.size(16.dp)
                                        )
                                        Spacer(modifier = Modifier.width(6.dp))
                                        val rangeText = when {
                                            customStartDateMillis != null && customEndDateMillis != null ->
                                                "${auditRangeDateFormatter.format(Date(customStartDateMillis!!))} → ${auditRangeDateFormatter.format(Date(customEndDateMillis!!))}"
                                            customStartDateMillis != null ->
                                                "On ${auditRangeDateFormatter.format(Date(customStartDateMillis!!))}"
                                            else -> "Pick Start & End Dates"
                                        }
                                        Text(
                                            text = rangeText,
                                            maxLines = 1,
                                            overflow = TextOverflow.Ellipsis,
                                            fontWeight = FontWeight.SemiBold
                                        )
                                    }
                                    if (customStartDateMillis != null || customEndDateMillis != null) {
                                        TextButton(
                                            onClick = {
                                                customStartDateMillis = null
                                                customEndDateMillis = null
                                            }
                                        ) {
                                            Text("Clear")
                                        }
                                    }
                                }

                                Row(
                                    modifier = Modifier.fillMaxWidth(),
                                    horizontalArrangement = Arrangement.spacedBy(6.dp)
                                ) {
                                    listOf(0 to "All", 1 to "Today", 7 to "7 Days", 30 to "30 Days").forEach { (days, label) ->
                                        val isPresetSelected = customStartDateMillis == null &&
                                            customEndDateMillis == null &&
                                            auditDateRangeDays == days
                                        FilterChip(
                                            selected = isPresetSelected,
                                            onClick = {
                                                customStartDateMillis = null
                                                customEndDateMillis = null
                                                auditDateRangeDays = days
                                            },
                                            label = { Text(label, maxLines = 1) }
                                        )
                                    }
                                }

                                Row(
                                    modifier = Modifier.fillMaxWidth(),
                                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                                ) {
                                    Button(
                                        enabled = filteredAuditLogs.isNotEmpty(),
                                        onClick = {
                                            safCsvLauncher.launch("SchoolMaster_SecurityAudit_${System.currentTimeMillis()}.csv")
                                        },
                                        colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF4F46E5)),
                                        shape = RoundedCornerShape(10.dp),
                                        modifier = Modifier.weight(1f)
                                    ) {
                                        Icon(Icons.Rounded.Download, contentDescription = null, modifier = Modifier.size(16.dp))
                                        Spacer(modifier = Modifier.width(6.dp))
                                        Text("Export CSV")
                                    }

                                    OutlinedButton(
                                        enabled = filteredAuditLogs.isNotEmpty(),
                                        onClick = {
                                            val shared = BiometricAuditCsvExporter.shareAuditLogsCsv(context, filteredAuditLogs)
                                            exportStatusMsg = if (shared) {
                                                "Prepared CSV share intent for ${filteredAuditLogs.size} log(s)."
                                            } else {
                                                "Could not launch CSV share intent."
                                            }
                                        },
                                        shape = RoundedCornerShape(10.dp),
                                        modifier = Modifier.weight(1f)
                                    ) {
                                        Icon(Icons.Rounded.Share, contentDescription = null, modifier = Modifier.size(16.dp))
                                        Spacer(modifier = Modifier.width(6.dp))
                                        Text("Share CSV")
                                    }
                                }

                                if (exportStatusMsg != null) {
                                    Surface(
                                        color = Color(0xFFD1FAE5),
                                        shape = RoundedCornerShape(10.dp),
                                        modifier = Modifier.fillMaxWidth()
                                    ) {
                                        Text(
                                            text = exportStatusMsg ?: "",
                                            style = MaterialTheme.typography.labelSmall,
                                            color = Color(0xFF065F46),
                                            modifier = Modifier.padding(8.dp)
                                        )
                                    }
                                }
                            }
                        }
                    }

                    item(key = "biometric-security-audit-log") {
                        TeacherLeaveAuditLogCard(
                            auditLogs = if (auditSearchQuery.isBlank() && auditDateRangeDays == 0) {
                                filteredAuditLogs.take(5)
                            } else {
                                filteredAuditLogs
                            },
                            subtitle = if (auditSearchQuery.isBlank() && auditDateRangeDays == 0) {
                                "Last 5 biometric authentication attempts (Room DB)"
                            } else {
                                "${filteredAuditLogs.size} matching biometric audit event(s)"
                            }
                        )
                    }
                }

                else -> {
                    items(examinations, key = { it.id }) { exam ->
                        Card(
                            shape = RoundedCornerShape(16.dp),
                            colors = CardDefaults.cardColors(containerColor = Color.White),
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            Column(
                                modifier = Modifier.padding(14.dp),
                                verticalArrangement = Arrangement.spacedBy(6.dp)
                            ) {
                                Row(
                                    verticalAlignment = Alignment.CenterVertically,
                                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                                ) {
                                    Icon(
                                        imageVector = Icons.Rounded.AssignmentTurnedIn,
                                        contentDescription = null,
                                        tint = Color(0xFF4F46E5),
                                        modifier = Modifier.size(20.dp)
                                    )
                                    Text(
                                        text = exam.name,
                                        style = MaterialTheme.typography.titleSmall,
                                        fontWeight = FontWeight.Bold,
                                        color = Color(0xFF0F172A)
                                    )
                                }
                                Text(
                                    text = "${exam.term} • ${exam.startDate} to ${exam.endDate}",
                                    style = MaterialTheme.typography.bodySmall,
                                    color = Color(0xFF475569)
                                )
                                Text(
                                    text = "Classes: ${exam.classesCsv} • Max Marks: ${exam.maxMarks}",
                                    style = MaterialTheme.typography.labelSmall,
                                    color = Color(0xFF64748B)
                                )
                                Text(
                                    text = if (exam.averageScorePct > 0) {
                                        "Status: ${exam.status} • Class Mean: ${exam.averageScorePct}%"
                                    } else {
                                        "Status: ${exam.status} • Marks entry pending"
                                    },
                                    style = MaterialTheme.typography.labelSmall,
                                    fontWeight = FontWeight.Bold,
                                    color = Color(0xFF4338CA)
                                )
                            }
                        }
                    }
                }
            }
        }
    }

    if (showSubmitLeaveDialog) {
        SubmitTeacherLeaveDialog(
            teachers = teachers,
            mandatoryBiometricEnabled = mandatoryBiometricEnabled,
            onDismiss = { showSubmitLeaveDialog = false },
            onSubmit = { newLeave -> handleGuardedLeaveSubmission(newLeave) }
        )
    }

    if (showAuditDateRangePicker) {
        val dateRangePickerState = rememberDateRangePickerState(
            initialSelectedStartDateMillis = customStartDateMillis,
            initialSelectedEndDateMillis = customEndDateMillis
        )
        DatePickerDialog(
            onDismissRequest = { showAuditDateRangePicker = false },
            confirmButton = {
                TextButton(
                    onClick = {
                        customStartDateMillis = dateRangePickerState.selectedStartDateMillis
                        customEndDateMillis = dateRangePickerState.selectedEndDateMillis
                            ?: dateRangePickerState.selectedStartDateMillis
                        auditDateRangeDays = 0
                        showAuditDateRangePicker = false
                    }
                ) {
                    Text("Apply Range", fontWeight = FontWeight.Bold)
                }
            },
            dismissButton = {
                TextButton(onClick = { showAuditDateRangePicker = false }) {
                    Text("Cancel")
                }
            }
        ) {
            DateRangePicker(
                state = dateRangePickerState,
                title = {
                    Text(
                        text = "Filter Biometric Audit Logs by Date Range",
                        style = MaterialTheme.typography.titleSmall,
                        fontWeight = FontWeight.Bold,
                        modifier = Modifier.padding(start = 24.dp, top = 16.dp, end = 12.dp)
                    )
                },
                modifier = Modifier
                    .fillMaxWidth()
                    .height(480.dp)
            )
        }
    }
}

@Composable
private fun TeacherLeaveAuditLogCard(
    auditLogs: List<BiometricAuditLogEntity>,
    subtitle: String = "Last 5 biometric authentication attempts"
) {
    val dateFormatter = remember {
        SimpleDateFormat("dd MMM yyyy, hh:mm:ss a", Locale.getDefault())
    }
    val successCount = auditLogs.count { it.eventType.equals("SUCCESS", ignoreCase = true) || it.outcome == "SUCCESS" }
    val failedCount = auditLogs.size - successCount

    Card(
        shape = RoundedCornerShape(18.dp),
        colors = CardDefaults.cardColors(containerColor = Color.White),
        elevation = CardDefaults.cardElevation(defaultElevation = 1.dp),
        modifier = Modifier
            .fillMaxWidth()
            .border(1.dp, Color(0xFFE2E8F0), RoundedCornerShape(18.dp))
    ) {
        Column(
            modifier = Modifier.padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp)
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                    modifier = Modifier.weight(1f)
                ) {
                    Box(
                        modifier = Modifier
                            .size(34.dp)
                            .clip(RoundedCornerShape(10.dp))
                            .background(Color(0xFFEEF2FF)),
                        contentAlignment = Alignment.Center
                    ) {
                        Icon(
                            imageVector = Icons.Rounded.Security,
                            contentDescription = "Security Audit Log",
                            tint = Color(0xFF4F46E5),
                            modifier = Modifier.size(18.dp)
                        )
                    }
                    Column {
                        Text(
                            text = "Security Audit Log",
                            style = MaterialTheme.typography.titleSmall,
                            fontWeight = FontWeight.Bold,
                            color = Color(0xFF0F172A)
                        )
                        Text(
                            text = subtitle,
                            style = MaterialTheme.typography.labelSmall,
                            color = Color(0xFF64748B)
                        )
                    }
                }
                Surface(
                    color = Color(0xFFF1F5F9),
                    shape = RoundedCornerShape(8.dp)
                ) {
                    Text(
                        text = "$successCount OK / $failedCount FAIL",
                        style = MaterialTheme.typography.labelSmall,
                        fontWeight = FontWeight.Bold,
                        color = Color(0xFF334155),
                        modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp)
                    )
                }
            }

            HorizontalDivider(color = Color(0xFFF1F5F9))

            if (auditLogs.isEmpty()) {
                Text(
                    text = "No biometric authentication attempts match the current filter.",
                    style = MaterialTheme.typography.bodySmall,
                    color = Color(0xFF64748B)
                )
            } else {
                auditLogs.forEachIndexed { index, entry ->
                    val isSuccess = entry.eventType.equals("SUCCESS", ignoreCase = true) || entry.outcome == "SUCCESS"
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(12.dp))
                            .background(if (isSuccess) Color(0xFFF0FDF4) else Color(0xFFFEF2F2))
                            .padding(10.dp),
                        horizontalArrangement = Arrangement.spacedBy(10.dp),
                        verticalAlignment = Alignment.Top
                    ) {
                        Icon(
                            imageVector = if (isSuccess) Icons.Rounded.CheckCircle else Icons.Rounded.Warning,
                            contentDescription = entry.eventType,
                            tint = if (isSuccess) Color(0xFF059669) else Color(0xFFDC2626),
                            modifier = Modifier
                                .padding(top = 2.dp)
                                .size(18.dp)
                        )
                        Column(
                            modifier = Modifier.weight(1f),
                            verticalArrangement = Arrangement.spacedBy(2.dp)
                        ) {
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Text(
                                    text = "#${index + 1} • ${entry.actorName} (${entry.authMethod})",
                                    style = MaterialTheme.typography.labelMedium,
                                    fontWeight = FontWeight.Bold,
                                    color = Color(0xFF0F172A),
                                    modifier = Modifier.weight(1f)
                                )
                                Surface(
                                    color = if (isSuccess) Color(0xFFD1FAE5) else Color(0xFFFEE2E2),
                                    shape = RoundedCornerShape(6.dp)
                                ) {
                                    Text(
                                        text = if (isSuccess) "SUCCESS" else "FAILURE",
                                        style = MaterialTheme.typography.labelSmall,
                                        fontWeight = FontWeight.Bold,
                                        color = if (isSuccess) Color(0xFF065F46) else Color(0xFF991B1B),
                                        modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
                                    )
                                }
                            }
                            Text(
                                text = entry.description.ifBlank { entry.detailMessage },
                                style = MaterialTheme.typography.bodySmall,
                                color = Color(0xFF334155)
                            )
                            Text(
                                text = dateFormatter.format(Date(entry.timestampMillis)),
                                style = MaterialTheme.typography.labelSmall,
                                color = Color(0xFF64748B)
                            )
                        }
                    }
                }
            }
        }
    }
}

@SuppressLint("SetJavaScriptEnabled")
@Composable
fun SchoolPortalWebView(modifier: Modifier = Modifier) {
    AndroidView(
        modifier = modifier,
        factory = { context ->
            WebView(context).apply {
                settings.javaScriptEnabled = true
                settings.domStorageEnabled = true
                settings.mediaPlaybackRequiresUserGesture = false
                settings.setGeolocationEnabled(true)
                settings.cacheMode = WebSettings.LOAD_DEFAULT
                webViewClient = WebViewClient()
                webChromeClient = object : WebChromeClient() {
                    override fun onPermissionRequest(request: PermissionRequest?) {
                        request?.grant(request.resources)
                    }

                    override fun onGeolocationPermissionsShowPrompt(
                        origin: String?,
                        callback: GeolocationPermissions.Callback?
                    ) {
                        callback?.invoke(origin, true, false)
                    }
                }
                loadUrl("https://ais-pre-r7tdws3aisr6uosq6lza7m-370699773036.asia-northeast1.run.app")
            }
        }
    )
}
