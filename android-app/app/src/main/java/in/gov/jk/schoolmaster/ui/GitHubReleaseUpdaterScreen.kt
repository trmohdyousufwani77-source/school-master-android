package `in`.gov.jk.schoolmaster.ui

import android.net.Uri
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.AddPhotoAlternate
import androidx.compose.material.icons.rounded.CheckCircle
import androidx.compose.material.icons.rounded.CloudDownload
import androidx.compose.material.icons.rounded.ContentCopy
import androidx.compose.material.icons.rounded.Delete
import androidx.compose.material.icons.rounded.Edit
import androidx.compose.material.icons.rounded.Link
import androidx.compose.material.icons.rounded.Lock
import androidx.compose.material.icons.rounded.OpenInNew
import androidx.compose.material.icons.rounded.Person
import androidx.compose.material.icons.rounded.Refresh
import androidx.compose.material.icons.rounded.School
import androidx.compose.material.icons.rounded.Security
import androidx.compose.material.icons.rounded.Settings
import androidx.compose.material.icons.rounded.SystemUpdateAlt
import androidx.compose.material.icons.rounded.Verified
import androidx.compose.material.icons.rounded.Visibility
import androidx.compose.material.icons.rounded.Warning
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.SegmentedButton
import androidx.compose.material3.SegmentedButtonDefaults
import androidx.compose.material3.SingleChoiceSegmentedButtonRow
import androidx.compose.material3.Surface
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
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
import androidx.compose.ui.platform.LocalClipboardManager
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import `in`.gov.jk.schoolmaster.BuildConfig
import `in`.gov.jk.schoolmaster.data.local.TeacherAttendanceEntity
import `in`.gov.jk.schoolmaster.security.ManualHeadmasterProfile
import `in`.gov.jk.schoolmaster.security.ManualHeadmasterStore
import `in`.gov.jk.schoolmaster.security.OfficialLogoStore
import `in`.gov.jk.schoolmaster.security.SecurityPreferences
import `in`.gov.jk.schoolmaster.updates.ApkDownloadOutcome
import `in`.gov.jk.schoolmaster.updates.GitHubBuildArtifact
import `in`.gov.jk.schoolmaster.updates.GitHubBuildReleaseClient
import kotlinx.coroutines.launch

@Composable
fun AppUpdatesScreen(
    isOnline: Boolean,
    teacherAttendance: List<TeacherAttendanceEntity> = emptyList(),
    pendingSyncCount: Int = 0,
    onQueueOfflineAttendance: () -> Unit = {},
    onSyncAllPending: suspend () -> Pair<Boolean, String> = { true to "All pending records synced." },
    modifier: Modifier = Modifier
) {
    val context = LocalContext.current
    var mandatoryBiometricAuth by remember {
        mutableStateOf(SecurityPreferences.isMandatoryBiometricEnabled(context))
    }

    Column(
        modifier = modifier
            .fillMaxSize()
            .background(Color(0xFFF8FAFC))
            .verticalScroll(rememberScrollState())
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp)
    ) {
        // Sync Status card observing Room TeacherAttendanceEntity records flagged with 'pending' syncStatus
        SyncStatusDashboardCard(
            teacherAttendance = teacherAttendance,
            pendingSyncCount = pendingSyncCount,
            onQueueOfflineAttendance = onQueueOfflineAttendance,
            onSyncAllPending = onSyncAllPending
        )

        // Headmaster Teacher Leave Biometric Configuration Card
        Card(
            shape = RoundedCornerShape(18.dp),
            colors = CardDefaults.cardColors(containerColor = Color.White),
            elevation = CardDefaults.cardElevation(defaultElevation = 2.dp),
            modifier = Modifier.fillMaxWidth()
        ) {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(16.dp),
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
                            .size(40.dp)
                            .clip(RoundedCornerShape(12.dp))
                            .background(Color(0xFFEEF2FF)),
                        contentAlignment = Alignment.Center
                    ) {
                        Icon(
                            imageVector = Icons.Rounded.Security,
                            contentDescription = null,
                            tint = Color(0xFF4F46E5),
                            modifier = Modifier.size(22.dp)
                        )
                    }
                    Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
                        Text(
                            text = "Mandatory Biometric Auth",
                            style = MaterialTheme.typography.titleSmall,
                            fontWeight = FontWeight.Bold,
                            color = Color(0xFF0F172A)
                        )
                        Text(
                            text = "Require Headmaster BiometricPrompt verification before approving Teacher Leave requests",
                            style = MaterialTheme.typography.bodySmall,
                            color = Color(0xFF64748B)
                        )
                    }
                }
                Switch(
                    checked = mandatoryBiometricAuth,
                    onCheckedChange = { enabled ->
                        mandatoryBiometricAuth = enabled
                        SecurityPreferences.setMandatoryBiometricEnabled(context, enabled)
                    }
                )
            }
        }

        // Centralized Official School Logo Management (Clean Section — No School Name or Emblem Fields)
        OfficialSchoolLogoManagementCard()

        // Manual Headmaster Profile Management (Edit / Save / Cancel — Never Auto-Overwritten)
        ManualHeadmasterProfileCard()

        GitHubBuildUpdaterCard(isOnline = isOnline)
    }
}

@Composable
private fun OfficialSchoolLogoManagementCard() {
    val context = LocalContext.current
    val logoVersion by OfficialLogoStore.logoVersion.collectAsState()
    val savedLogoBitmap = remember(logoVersion) { OfficialLogoStore.loadOfficialLogoBitmap(context) }

    var showPreviewDialog by remember { mutableStateOf(false) }
    var showDeleteConfirm by remember { mutableStateOf(false) }
    var statusMessage by remember { mutableStateOf<String?>(null) }

    val logoPicker = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.GetContent()
    ) { uri: Uri? ->
        if (uri != null) {
            val saved = OfficialLogoStore.saveLogoFromUri(context, uri)
            statusMessage = if (saved) {
                "Official School Logo saved & synced across Widget, Smart IDs, and HPC."
            } else {
                "Unable to load selected image. Please choose a valid PNG or JPEG."
            }
        }
    }

    Card(
        shape = RoundedCornerShape(18.dp),
        colors = CardDefaults.cardColors(containerColor = Color.White),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp),
        modifier = Modifier.fillMaxWidth()
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                Box(
                    modifier = Modifier
                        .size(64.dp)
                        .clip(RoundedCornerShape(14.dp))
                        .background(Color(0xFFF8FAFC))
                        .border(1.5.dp, Color(0xFFCBD5E1), RoundedCornerShape(14.dp)),
                    contentAlignment = Alignment.Center
                ) {
                    if (savedLogoBitmap != null) {
                        Image(
                            bitmap = savedLogoBitmap.asImageBitmap(),
                            contentDescription = "Official School Logo",
                            contentScale = ContentScale.Fit,
                            modifier = Modifier
                                .fillMaxSize()
                                .padding(6.dp)
                        )
                    } else {
                        Icon(
                            imageVector = Icons.Rounded.School,
                            contentDescription = null,
                            tint = Color(0xFF4F46E5),
                            modifier = Modifier.size(30.dp)
                        )
                    }
                }
                Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                    Text(
                        text = "Official School Logo",
                        style = MaterialTheme.typography.titleSmall,
                        fontWeight = FontWeight.Bold,
                        color = Color(0xFF0F172A)
                    )
                    Text(
                        text = "Centralized logo mirrored identically across School Master Widget, Automatic Logo Generator, Smart IDs, and HPC.",
                        style = MaterialTheme.typography.bodySmall,
                        color = Color(0xFF64748B)
                    )
                }
            }

            if (statusMessage != null) {
                Surface(
                    color = Color(0xFFECFDF5),
                    shape = RoundedCornerShape(10.dp),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Text(
                        text = statusMessage.orEmpty(),
                        style = MaterialTheme.typography.labelSmall,
                        color = Color(0xFF065F46),
                        fontWeight = FontWeight.SemiBold,
                        modifier = Modifier.padding(horizontal = 10.dp, vertical = 7.dp)
                    )
                }
            }

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                Button(
                    onClick = { logoPicker.launch("image/*") },
                    colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF4F46E5)),
                    shape = RoundedCornerShape(12.dp),
                    modifier = Modifier.weight(1f)
                ) {
                    Icon(
                        imageVector = if (savedLogoBitmap != null) Icons.Rounded.Edit else Icons.Rounded.AddPhotoAlternate,
                        contentDescription = null,
                        modifier = Modifier.size(16.dp)
                    )
                    Spacer(modifier = Modifier.width(6.dp))
                    Text(if (savedLogoBitmap != null) "Edit Logo" else "Add Logo")
                }

                OutlinedButton(
                    enabled = savedLogoBitmap != null,
                    onClick = { showPreviewDialog = true },
                    shape = RoundedCornerShape(12.dp)
                ) {
                    Icon(Icons.Rounded.Visibility, contentDescription = "Preview", modifier = Modifier.size(16.dp))
                    Spacer(modifier = Modifier.width(4.dp))
                    Text("Preview")
                }

                if (savedLogoBitmap != null) {
                    OutlinedButton(
                        onClick = { showDeleteConfirm = true },
                        shape = RoundedCornerShape(12.dp),
                        colors = ButtonDefaults.outlinedButtonColors(contentColor = Color(0xFFDC2626))
                    ) {
                        Icon(Icons.Rounded.Delete, contentDescription = "Delete", modifier = Modifier.size(16.dp))
                    }
                }
            }
        }
    }

    if (showPreviewDialog && savedLogoBitmap != null) {
        AlertDialog(
            onDismissRequest = { showPreviewDialog = false },
            title = { Text("Official School Logo Preview", fontWeight = FontWeight.Bold) },
            text = {
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(220.dp)
                        .clip(RoundedCornerShape(16.dp))
                        .background(Color(0xFFF8FAFC))
                        .border(1.dp, Color(0xFFE2E8F0), RoundedCornerShape(16.dp))
                        .padding(16.dp),
                    contentAlignment = Alignment.Center
                ) {
                    Image(
                        bitmap = savedLogoBitmap.asImageBitmap(),
                        contentDescription = "Official School Logo",
                        contentScale = ContentScale.Fit,
                        modifier = Modifier.fillMaxSize()
                    )
                }
            },
            confirmButton = {
                TextButton(onClick = { showPreviewDialog = false }) { Text("Close") }
            }
        )
    }

    if (showDeleteConfirm) {
        AlertDialog(
            onDismissRequest = { showDeleteConfirm = false },
            title = { Text("Delete Official School Logo?", fontWeight = FontWeight.Bold) },
            text = { Text("This removes the saved Official School Logo from the School Master Widget and all ID/HPC templates.") },
            confirmButton = {
                Button(
                    onClick = {
                        OfficialLogoStore.deleteOfficialLogo(context)
                        showDeleteConfirm = false
                        statusMessage = "Official School Logo deleted."
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = Color(0xFFDC2626))
                ) {
                    Text("Delete")
                }
            },
            dismissButton = {
                TextButton(onClick = { showDeleteConfirm = false }) { Text("Cancel") }
            }
        )
    }
}

@Composable
private fun ManualHeadmasterProfileCard() {
    val context = LocalContext.current
    val hmVersion by ManualHeadmasterStore.version.collectAsState()
    val savedProfile = remember(hmVersion) { ManualHeadmasterStore.load(context) }

    var isEditing by remember { mutableStateOf(false) }
    var draftName by remember(savedProfile) { mutableStateOf(savedProfile.fullName) }
    var draftDesignation by remember(savedProfile) { mutableStateOf(savedProfile.designation) }
    var draftQualification by remember(savedProfile) { mutableStateOf(savedProfile.qualification) }
    var draftContact by remember(savedProfile) { mutableStateOf(savedProfile.contactNumber) }
    var draftEmail by remember(savedProfile) { mutableStateOf(savedProfile.email) }
    var feedback by remember { mutableStateOf<String?>(null) }

    Card(
        shape = RoundedCornerShape(18.dp),
        colors = CardDefaults.cardColors(containerColor = Color.White),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp),
        modifier = Modifier.fillMaxWidth()
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp)
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
                            .size(40.dp)
                            .clip(RoundedCornerShape(12.dp))
                            .background(Color(0xFFEEF2FF)),
                        contentAlignment = Alignment.Center
                    ) {
                        Icon(
                            imageVector = Icons.Rounded.Person,
                            contentDescription = null,
                            tint = Color(0xFF4F46E5),
                            modifier = Modifier.size(22.dp)
                        )
                    }
                    Column {
                        Text(
                            text = "Headmaster Profile (Manual)",
                            style = MaterialTheme.typography.titleSmall,
                            fontWeight = FontWeight.Bold,
                            color = Color(0xFF0F172A)
                        )
                        Text(
                            text = "Saved manually — never auto-overwritten from other modules.",
                            style = MaterialTheme.typography.labelSmall,
                            color = Color(0xFF64748B)
                        )
                    }
                }
                if (!isEditing) {
                    OutlinedButton(
                        onClick = {
                            draftName = savedProfile.fullName
                            draftDesignation = savedProfile.designation
                            draftQualification = savedProfile.qualification
                            draftContact = savedProfile.contactNumber
                            draftEmail = savedProfile.email
                            isEditing = true
                            feedback = null
                        },
                        shape = RoundedCornerShape(10.dp)
                    ) {
                        Icon(Icons.Rounded.Edit, contentDescription = null, modifier = Modifier.size(15.dp))
                        Spacer(modifier = Modifier.width(4.dp))
                        Text("Edit Headmaster", style = MaterialTheme.typography.labelSmall, fontWeight = FontWeight.Bold)
                    }
                }
            }

            if (feedback != null) {
                Surface(
                    color = Color(0xFFECFDF5),
                    shape = RoundedCornerShape(10.dp),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Text(
                        text = feedback.orEmpty(),
                        style = MaterialTheme.typography.labelSmall,
                        color = Color(0xFF065F46),
                        fontWeight = FontWeight.SemiBold,
                        modifier = Modifier.padding(horizontal = 10.dp, vertical = 7.dp)
                    )
                }
            }

            if (!isEditing) {
                Surface(
                    color = Color(0xFFF8FAFC),
                    shape = RoundedCornerShape(12.dp),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Column(
                        modifier = Modifier.padding(12.dp),
                        verticalArrangement = Arrangement.spacedBy(4.dp)
                    ) {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(6.dp)
                        ) {
                            Text(
                                text = savedProfile.fullName,
                                style = MaterialTheme.typography.titleSmall,
                                fontWeight = FontWeight.ExtraBold,
                                color = Color(0xFF0F172A)
                            )
                            Surface(
                                color = Color(0xFFECFDF5),
                                shape = RoundedCornerShape(6.dp)
                            ) {
                                Row(
                                    modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp),
                                    verticalAlignment = Alignment.CenterVertically,
                                    horizontalArrangement = Arrangement.spacedBy(3.dp)
                                ) {
                                    Icon(
                                        imageVector = Icons.Rounded.Lock,
                                        contentDescription = null,
                                        tint = Color(0xFF047857),
                                        modifier = Modifier.size(11.dp)
                                    )
                                    Text(
                                        text = savedProfile.designation,
                                        style = MaterialTheme.typography.labelSmall,
                                        color = Color(0xFF047857),
                                        fontWeight = FontWeight.Bold
                                    )
                                }
                            }
                        }
                        Text(
                            text = "Qualification: ${savedProfile.qualification.ifBlank { "—" }} • Contact: ${savedProfile.contactNumber.ifBlank { "—" }}",
                            style = MaterialTheme.typography.bodySmall,
                            color = Color(0xFF475569)
                        )
                        if (savedProfile.email.isNotBlank()) {
                            Text(
                                text = savedProfile.email,
                                style = MaterialTheme.typography.labelSmall,
                                color = Color(0xFF64748B)
                            )
                        }
                    }
                }
            } else {
                OutlinedTextField(
                    value = draftName,
                    onValueChange = { draftName = it },
                    label = { Text("Headmaster Full Name *") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth()
                )
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    OutlinedTextField(
                        value = draftDesignation,
                        onValueChange = { draftDesignation = it },
                        label = { Text("Designation") },
                        singleLine = true,
                        modifier = Modifier.weight(1f)
                    )
                    OutlinedTextField(
                        value = draftQualification,
                        onValueChange = { draftQualification = it },
                        label = { Text("Qualification") },
                        singleLine = true,
                        modifier = Modifier.weight(1f)
                    )
                }
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    OutlinedTextField(
                        value = draftContact,
                        onValueChange = { draftContact = it },
                        label = { Text("Contact Number") },
                        singleLine = true,
                        modifier = Modifier.weight(1f)
                    )
                    OutlinedTextField(
                        value = draftEmail,
                        onValueChange = { draftEmail = it },
                        label = { Text("Email") },
                        singleLine = true,
                        modifier = Modifier.weight(1f)
                    )
                }
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    OutlinedButton(
                        onClick = {
                            isEditing = false
                            feedback = null
                        },
                        shape = RoundedCornerShape(12.dp),
                        modifier = Modifier.weight(1f)
                    ) {
                        Text("Cancel")
                    }
                    Button(
                        enabled = draftName.isNotBlank(),
                        onClick = {
                            ManualHeadmasterStore.saveManual(
                                context,
                                ManualHeadmasterProfile(
                                    fullName = draftName.trim(),
                                    designation = draftDesignation.trim().ifBlank { "Headmaster" },
                                    qualification = draftQualification.trim(),
                                    contactNumber = draftContact.trim(),
                                    email = draftEmail.trim(),
                                    manuallyEdited = true
                                )
                            )
                            isEditing = false
                            feedback = "Headmaster profile saved manually."
                        },
                        colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF059669)),
                        shape = RoundedCornerShape(12.dp),
                        modifier = Modifier.weight(1f)
                    ) {
                        Text("Save")
                    }
                }
            }
        }
    }
}

@Composable
fun GitHubBuildUpdaterCard(
    isOnline: Boolean,
    modifier: Modifier = Modifier
) {
    val context = LocalContext.current
    val clipboard = LocalClipboardManager.current
    val scope = rememberCoroutineScope()

    var repoSlug by remember {
        mutableStateOf(
            GitHubBuildReleaseClient.loadSavedRepoSlug(
                context = context,
                buildDefaultSlug = BuildConfig.GITHUB_REPO
            )
        )
    }
    var preferReleaseFallback by remember { mutableStateOf(!BuildConfig.DEBUG) }
    var isLoading by remember { mutableStateOf(false) }
    var artifact by remember { mutableStateOf<GitHubBuildArtifact?>(null) }
    var apiNotice by remember { mutableStateOf<String?>(null) }
    var actionFeedback by remember { mutableStateOf<String?>(null) }
    var actionIsError by remember { mutableStateOf(false) }
    var showRepoConfigDialog by remember { mutableStateOf(false) }

    fun refreshFromGitHub(targetSlug: String = repoSlug) {
        if (targetSlug.isBlank()) {
            artifact = null
            apiNotice = "Configure your GitHub repository (owner/repo) to fetch the latest successful build artifact URL."
            return
        }
        scope.launch {
            isLoading = true
            apiNotice = null
            val result = GitHubBuildReleaseClient.fetchLatestBuildArtifact(targetSlug)
            result.onSuccess { liveArtifact ->
                artifact = liveArtifact
                apiNotice = null
            }.onFailure { err ->
                artifact = GitHubBuildReleaseClient.buildFallbackArtifact(
                    repoSlug = targetSlug,
                    preferRelease = preferReleaseFallback
                )
                apiNotice = err.message ?: "Could not query GitHub API. Showing direct latest APK link."
            }
            isLoading = false
        }
    }

    LaunchedEffect(repoSlug, preferReleaseFallback) {
        if (repoSlug.isNotBlank()) {
            if (isOnline) {
                refreshFromGitHub(repoSlug)
            } else {
                artifact = GitHubBuildReleaseClient.buildFallbackArtifact(
                    repoSlug = repoSlug,
                    preferRelease = preferReleaseFallback
                )
                apiNotice = "Device is offline. Connect to the internet to check live GitHub Releases or download the APK."
            }
        }
    }

    Column(
        modifier = modifier.fillMaxWidth(),
        verticalArrangement = Arrangement.spacedBy(14.dp)
    ) {
        // Header banner
        Card(
            shape = RoundedCornerShape(20.dp),
            colors = CardDefaults.cardColors(containerColor = Color(0xFF1E1B4B)),
            modifier = Modifier.fillMaxWidth()
        ) {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(18.dp),
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
                            .size(44.dp)
                            .clip(RoundedCornerShape(14.dp))
                            .background(Color(0xFF312E81)),
                        contentAlignment = Alignment.Center
                    ) {
                        Icon(
                            imageVector = Icons.Rounded.SystemUpdateAlt,
                            contentDescription = "APK Updates",
                            tint = Color(0xFFA5B4FC),
                            modifier = Modifier.size(24.dp)
                        )
                    }
                    Column {
                        Text(
                            text = "GitHub Build & APK Updates",
                            style = MaterialTheme.typography.titleMedium,
                            color = Color.White,
                            fontWeight = FontWeight.Bold
                        )
                        Text(
                            text = "Installed: v${BuildConfig.VERSION_NAME} (${if (BuildConfig.DEBUG) "Debug" else "Release"})",
                            style = MaterialTheme.typography.labelSmall,
                            color = Color(0xFFC7D2FE)
                        )
                    }
                }
                IconButton(onClick = { showRepoConfigDialog = true }) {
                    Icon(
                        imageVector = Icons.Rounded.Settings,
                        contentDescription = "Configure GitHub Repository",
                        tint = Color.White
                    )
                }
            }
        }

        // Main artifact card
        Card(
            shape = RoundedCornerShape(20.dp),
            colors = CardDefaults.cardColors(containerColor = Color.White),
            elevation = CardDefaults.cardElevation(defaultElevation = 2.dp),
            modifier = Modifier
                .fillMaxWidth()
                .border(1.dp, Color(0xFFE2E8F0), RoundedCornerShape(20.dp))
        ) {
            Column(
                modifier = Modifier.padding(18.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Column(modifier = Modifier.weight(1f)) {
                        Text(
                            text = "LATEST SUCCESSFUL BUILD ARTIFACT",
                            style = MaterialTheme.typography.labelSmall,
                            fontWeight = FontWeight.Bold,
                            color = Color(0xFF4F46E5)
                        )
                        Text(
                            text = if (repoSlug.isNotBlank()) "github.com/$repoSlug" else "Repository not configured",
                            style = MaterialTheme.typography.bodySmall,
                            color = Color(0xFF475569)
                        )
                    }
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(4.dp)
                    ) {
                        if (isLoading) {
                            CircularProgressIndicator(
                                modifier = Modifier.size(20.dp),
                                strokeWidth = 2.dp,
                                color = Color(0xFF4F46E5)
                            )
                        } else {
                            IconButton(
                                onClick = { refreshFromGitHub(repoSlug) },
                                enabled = repoSlug.isNotBlank()
                            ) {
                                Icon(
                                    imageVector = Icons.Rounded.Refresh,
                                    contentDescription = "Check Latest Build",
                                    tint = Color(0xFF4F46E5)
                                )
                            }
                        }
                    }
                }

                if (repoSlug.isBlank()) {
                    Surface(
                        color = Color(0xFFFEF3C7),
                        shape = RoundedCornerShape(12.dp),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Column(
                            modifier = Modifier.padding(12.dp),
                            verticalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            Text(
                                text = "Link your GitHub repository (owner/repo) to display the latest GitHub Actions APK artifact URL and enable one-tap device downloads.",
                                style = MaterialTheme.typography.bodySmall,
                                color = Color(0xFF92400E)
                            )
                            Button(
                                onClick = { showRepoConfigDialog = true },
                                colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF4F46E5)),
                                shape = RoundedCornerShape(10.dp)
                            ) {
                                Text("Set GitHub Repository")
                            }
                        }
                    }
                } else {
                    val activeArtifact = artifact
                    if (activeArtifact != null) {
                        Row(
                            horizontalArrangement = Arrangement.spacedBy(8.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Surface(
                                color = if (activeArtifact.buildMode == "Release") Color(0xFFD1FAE5) else Color(0xFFE0E7FF),
                                shape = RoundedCornerShape(8.dp)
                            ) {
                                Row(
                                    modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp),
                                    verticalAlignment = Alignment.CenterVertically,
                                    horizontalArrangement = Arrangement.spacedBy(4.dp)
                                ) {
                                    Icon(
                                        imageVector = Icons.Rounded.Verified,
                                        contentDescription = null,
                                        tint = if (activeArtifact.buildMode == "Release") Color(0xFF065F46) else Color(0xFF3730A3),
                                        modifier = Modifier.size(14.dp)
                                    )
                                    Text(
                                        text = "${activeArtifact.buildMode.uppercase()} • ${activeArtifact.releaseTag}",
                                        style = MaterialTheme.typography.labelSmall,
                                        fontWeight = FontWeight.Bold,
                                        color = if (activeArtifact.buildMode == "Release") Color(0xFF065F46) else Color(0xFF3730A3)
                                    )
                                }
                            }
                            Surface(
                                color = if (activeArtifact.isLiveFromApi) Color(0xFFECFDF5) else Color(0xFFF1F5F9),
                                shape = RoundedCornerShape(8.dp)
                            ) {
                                Text(
                                    text = if (activeArtifact.isLiveFromApi) "LIVE GITHUB RELEASE" else "DIRECT CHANNEL URL",
                                    style = MaterialTheme.typography.labelSmall,
                                    fontWeight = FontWeight.Bold,
                                    color = if (activeArtifact.isLiveFromApi) Color(0xFF047857) else Color(0xFF475569),
                                    modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp)
                                )
                            }
                        }

                        Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
                            Text(
                                text = activeArtifact.releaseName,
                                style = MaterialTheme.typography.titleSmall,
                                fontWeight = FontWeight.Bold,
                                color = Color(0xFF0F172A)
                            )
                            Text(
                                text = "${activeArtifact.assetName} • ${GitHubBuildReleaseClient.formatFileSize(activeArtifact.sizeBytes)}",
                                style = MaterialTheme.typography.bodySmall,
                                color = Color(0xFF475569)
                            )
                            if (activeArtifact.publishedAt.isNotBlank()) {
                                Text(
                                    text = "Published: ${activeArtifact.publishedAt.replace("T", " ").removeSuffix("Z")} UTC",
                                    style = MaterialTheme.typography.labelSmall,
                                    color = Color(0xFF64748B)
                                )
                            }
                        }

                        if (!activeArtifact.isLiveFromApi) {
                            SingleChoiceSegmentedButtonRow(modifier = Modifier.fillMaxWidth()) {
                                SegmentedButton(
                                    selected = !preferReleaseFallback,
                                    onClick = { preferReleaseFallback = false },
                                    shape = SegmentedButtonDefaults.itemShape(index = 0, count = 2)
                                ) {
                                    Text("Debug Latest")
                                }
                                SegmentedButton(
                                    selected = preferReleaseFallback,
                                    onClick = { preferReleaseFallback = true },
                                    shape = SegmentedButtonDefaults.itemShape(index = 1, count = 2)
                                ) {
                                    Text("Release Latest")
                                }
                            }
                        }

                        // Artifact URL display block
                        Column(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clip(RoundedCornerShape(12.dp))
                                .background(Color(0xFF0F172A))
                                .padding(12.dp),
                            verticalArrangement = Arrangement.spacedBy(6.dp)
                        ) {
                            Row(
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.spacedBy(6.dp)
                            ) {
                                Icon(
                                    imageVector = Icons.Rounded.Link,
                                    contentDescription = null,
                                    tint = Color(0xFF38BDF8),
                                    modifier = Modifier.size(16.dp)
                                )
                                Text(
                                    text = "DIRECT ARTIFACT DOWNLOAD URL",
                                    style = MaterialTheme.typography.labelSmall,
                                    color = Color(0xFF94A3B8),
                                    fontWeight = FontWeight.Bold
                                )
                            }
                            Text(
                                text = activeArtifact.downloadUrl,
                                style = MaterialTheme.typography.bodySmall.copy(fontFamily = FontFamily.Monospace),
                                color = Color(0xFFE2E8F0)
                            )
                        }

                        // Primary Download Button
                        Button(
                            onClick = {
                                when (val outcome = GitHubBuildReleaseClient.enqueueApkDownload(context, activeArtifact)) {
                                    is ApkDownloadOutcome.Enqueued -> {
                                        actionIsError = false
                                        actionFeedback = "Downloading ${outcome.fileName} to Downloads folder (ID #${outcome.downloadId}). Tap the notification when complete to install."
                                    }
                                    is ApkDownloadOutcome.OpenedInBrowser -> {
                                        actionIsError = false
                                        actionFeedback = "Opened APK download link in your browser."
                                    }
                                    is ApkDownloadOutcome.Failed -> {
                                        actionIsError = true
                                        actionFeedback = outcome.message
                                    }
                                }
                            },
                            colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF059669)),
                            shape = RoundedCornerShape(14.dp),
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            Icon(
                                imageVector = Icons.Rounded.CloudDownload,
                                contentDescription = null,
                                modifier = Modifier.size(20.dp)
                            )
                            Spacer(modifier = Modifier.width(8.dp))
                            Text("Download Current APK", fontWeight = FontWeight.Bold)
                        }

                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            OutlinedButton(
                                onClick = {
                                    clipboard.setText(AnnotatedString(activeArtifact.downloadUrl))
                                    actionIsError = false
                                    actionFeedback = "Copied artifact URL to clipboard."
                                },
                                shape = RoundedCornerShape(12.dp),
                                modifier = Modifier.weight(1f)
                            ) {
                                Icon(
                                    imageVector = Icons.Rounded.ContentCopy,
                                    contentDescription = null,
                                    modifier = Modifier.size(16.dp)
                                )
                                Spacer(modifier = Modifier.width(6.dp))
                                Text("Copy URL")
                            }
                            OutlinedButton(
                                onClick = {
                                    val outcome = GitHubBuildReleaseClient.openUrlInBrowser(
                                        context,
                                        activeArtifact.releasePageUrl
                                    )
                                    if (outcome is ApkDownloadOutcome.Failed) {
                                        actionIsError = true
                                        actionFeedback = outcome.message
                                    }
                                },
                                shape = RoundedCornerShape(12.dp),
                                modifier = Modifier.weight(1f)
                            ) {
                                Icon(
                                    imageVector = Icons.Rounded.OpenInNew,
                                    contentDescription = null,
                                    modifier = Modifier.size(16.dp)
                                )
                                Spacer(modifier = Modifier.width(6.dp))
                                Text("Release Page")
                            }
                        }
                    }

                    if (apiNotice != null) {
                        Surface(
                            color = Color(0xFFFEF3C7),
                            shape = RoundedCornerShape(10.dp),
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            Row(
                                modifier = Modifier.padding(10.dp),
                                horizontalArrangement = Arrangement.spacedBy(8.dp),
                                verticalAlignment = Alignment.Top
                            ) {
                                Icon(
                                    imageVector = Icons.Rounded.Warning,
                                    contentDescription = null,
                                    tint = Color(0xFFD97706),
                                    modifier = Modifier.size(16.dp)
                                )
                                Text(
                                    text = apiNotice ?: "",
                                    style = MaterialTheme.typography.labelSmall,
                                    color = Color(0xFF92400E)
                                )
                            }
                        }
                    }

                    if (actionFeedback != null) {
                        Surface(
                            color = if (actionIsError) Color(0xFFFEE2E2) else Color(0xFFECFDF5),
                            shape = RoundedCornerShape(10.dp),
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            Row(
                                modifier = Modifier.padding(10.dp),
                                horizontalArrangement = Arrangement.spacedBy(8.dp),
                                verticalAlignment = Alignment.Top
                            ) {
                                Icon(
                                    imageVector = if (actionIsError) Icons.Rounded.Warning else Icons.Rounded.CheckCircle,
                                    contentDescription = null,
                                    tint = if (actionIsError) Color(0xFFDC2626) else Color(0xFF059669),
                                    modifier = Modifier.size(16.dp)
                                )
                                Text(
                                    text = actionFeedback ?: "",
                                    style = MaterialTheme.typography.labelSmall,
                                    color = if (actionIsError) Color(0xFF991B1B) else Color(0xFF065F46)
                                )
                            }
                        }
                    }
                }

                HorizontalDivider(color = Color(0xFFF1F5F9))

                Text(
                    text = "GitHub Actions (.github/workflows/android-build.yml) publishes signed Debug APKs on push and keystore-signed Release APKs on manual release runs or v* tags.",
                    style = MaterialTheme.typography.labelSmall,
                    color = Color(0xFF64748B)
                )
            }
        }
    }

    if (showRepoConfigDialog) {
        var draftRepo by remember(repoSlug) { mutableStateOf(repoSlug) }
        AlertDialog(
            onDismissRequest = { showRepoConfigDialog = false },
            title = { Text("GitHub Repository Source") },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text(
                        text = "Enter your GitHub repository (owner/repo or full GitHub URL) to pull the latest built APK release.",
                        style = MaterialTheme.typography.bodySmall,
                        color = Color(0xFF475569)
                    )
                    OutlinedTextField(
                        value = draftRepo,
                        onValueChange = { draftRepo = it },
                        label = { Text("Repository (owner/repo)") },
                        placeholder = { Text("e.g. school-admin/school-master") },
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth()
                    )
                    Spacer(modifier = Modifier.height(2.dp))
                }
            },
            confirmButton = {
                Button(
                    enabled = GitHubBuildReleaseClient.normalizeRepoSlug(draftRepo).isNotEmpty(),
                    onClick = {
                        val saved = GitHubBuildReleaseClient.saveRepoSlug(context, draftRepo)
                        repoSlug = saved
                        actionFeedback = null
                        showRepoConfigDialog = false
                        refreshFromGitHub(saved)
                    }
                ) {
                    Text("Save & Fetch")
                }
            },
            dismissButton = {
                TextButton(onClick = { showRepoConfigDialog = false }) {
                    Text("Cancel")
                }
            }
        )
    }
}
