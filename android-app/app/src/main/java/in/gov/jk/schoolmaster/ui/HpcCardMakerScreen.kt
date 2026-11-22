package `in`.gov.jk.schoolmaster.ui

import android.content.ContentValues
import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Canvas
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
import android.Manifest
import android.content.pm.PackageManager
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.camera.core.CameraSelector
import androidx.camera.core.ImageCapture
import androidx.camera.core.ImageCaptureException
import androidx.camera.core.Preview
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.camera.view.PreviewView
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
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.Badge
import androidx.compose.material.icons.rounded.CameraAlt
import androidx.compose.material.icons.rounded.CheckCircle
import androidx.compose.material.icons.rounded.Close
import androidx.compose.material.icons.rounded.Delete
import androidx.compose.material.icons.rounded.Edit
import androidx.compose.material.icons.rounded.Image
import androidx.compose.material.icons.rounded.PictureAsPdf
import androidx.compose.material.icons.rounded.Print
import androidx.compose.material.icons.rounded.Search
import androidx.compose.material.icons.rounded.Share
import androidx.compose.material.icons.rounded.Visibility
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Checkbox
import androidx.compose.material3.FilterChip
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
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalLifecycleOwner
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import androidx.core.content.ContextCompat
import `in`.gov.jk.schoolmaster.data.local.HpcCardEntity
import `in`.gov.jk.schoolmaster.data.local.StudentEntity
import `in`.gov.jk.schoolmaster.qr.QrCodeGenerator
import `in`.gov.jk.schoolmaster.security.BiometricAuditCsvExporter
import `in`.gov.jk.schoolmaster.security.ManualHeadmasterStore
import `in`.gov.jk.schoolmaster.security.OfficialLogoStore
import java.io.File
import java.io.FileOutputStream

data class HpcCardTemplateStyle(
    val id: String,
    val title: String,
    val subtitle: String,
    val headerColor: Color,
    val accentColor: Color,
    val surfaceTint: Color
)

val HPC_CARD_TEMPLATES = listOf(
    HpcCardTemplateStyle(
        id = "royal_indigo",
        title = "Royal Indigo Heritage",
        subtitle = "Official navy header with gold emblem strip",
        headerColor = Color(0xFF1E1B4B),
        accentColor = Color(0xFFF59E0B),
        surfaceTint = Color(0xFFEEF2FF)
    ),
    HpcCardTemplateStyle(
        id = "kashmir_emerald",
        title = "Kashmir Emerald Crest",
        subtitle = "Deep emerald banner with warm ivory card body",
        headerColor = Color(0xFF065F46),
        accentColor = Color(0xFF10B981),
        surfaceTint = Color(0xFFECFDF5)
    ),
    HpcCardTemplateStyle(
        id = "ivory_official",
        title = "Classic Crimson Seal",
        subtitle = "Formal burgundy band with print-ready contrast",
        headerColor = Color(0xFF7F1D1D),
        accentColor = Color(0xFFD97706),
        surfaceTint = Color(0xFFFFFBEB)
    )
)

fun findHpcTemplate(templateId: String): HpcCardTemplateStyle =
    HPC_CARD_TEMPLATES.find { it.id == templateId } ?: HPC_CARD_TEMPLATES.first()

@Composable
fun HpcCardMakerScreen(
    savedCards: List<HpcCardEntity>,
    searchQuery: String,
    onSearchQueryChange: (String) -> Unit,
    onSaveCard: (HpcCardEntity) -> Unit,
    onDeleteCard: (Long) -> Unit,
    modifier: Modifier = Modifier,
    students: List<StudentEntity> = emptyList()
) {
    val context = LocalContext.current
    var activeTab by remember { mutableIntStateOf(0) } // 0 = Create/Edit, 1 = Templates, 2 = My Saved Cards

    val hmVersion by ManualHeadmasterStore.version.collectAsState()
    val logoVersion by OfficialLogoStore.logoVersion.collectAsState()
    val savedManualHeadmaster = remember(hmVersion) { ManualHeadmasterStore.load(context) }
    val officialLogoBitmap = remember(logoVersion) { OfficialLogoStore.loadOfficialLogoBitmap(context) }

    // Form state (supports Hindi, Urdu, and English text cleanly)
    var editingId by remember { mutableStateOf(0L) }
    var selectedStudentId by remember { mutableStateOf<String?>(null) }
    var hpcId by remember { mutableStateOf("HPC-2026-${(100..999).random()}") }
    var fullName by remember { mutableStateOf("") }
    var fatherName by remember { mutableStateOf("") }
    var dob by remember { mutableStateOf("2015-05-15") }
    var gender by remember { mutableStateOf("Male") }
    var address by remember { mutableStateOf("Pamposh Colony, Palapora Zone, Iddgah") }
    var mobileNumber by remember { mutableStateOf("") }
    var bloodGroup by remember { mutableStateOf("B+") }
    var photoPath by remember { mutableStateOf("") }
    var includeQr by remember { mutableStateOf(true) }
    var selectedTemplateId by remember { mutableStateOf("royal_indigo") }
    var schoolName by remember { mutableStateOf("Govt Middle School Pamposh Colony") }
    var headmasterName by remember { mutableStateOf(savedManualHeadmaster.fullName) }

    LaunchedEffect(hmVersion) {
        if (editingId == 0L) {
            headmasterName = ManualHeadmasterStore.load(context).fullName
        }
    }

    var showCameraModal by remember { mutableStateOf(false) }
    var previewCard by remember { mutableStateOf<HpcCardEntity?>(null) }
    var deleteCandidate by remember { mutableStateOf<HpcCardEntity?>(null) }
    var feedbackBanner by remember { mutableStateOf<String?>(null) }

    val selectedBulkIds = remember { mutableStateListOf<Long>() }

    val galleryPicker = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.GetContent()
    ) { uri: Uri? ->
        if (uri != null) {
            val savedPath = copyUriPhotoToAppStorage(context, uri)
            if (savedPath != null) {
                photoPath = savedPath
                feedbackBanner = "Photograph attached to HPC card."
            }
        }
    }

    fun buildCurrentDraft(): HpcCardEntity = HpcCardEntity(
        id = editingId,
        hpcId = hpcId.trim().ifEmpty { "HPC-2026-${(100..999).random()}" },
        fullName = fullName.trim().ifEmpty { "Student / Card Holder" },
        fatherName = fatherName.trim().ifEmpty { "Parent / Guardian" },
        dob = dob.trim(),
        gender = gender,
        address = address.trim(),
        mobileNumber = mobileNumber.trim(),
        bloodGroup = bloodGroup.trim(),
        photoPath = photoPath,
        includeQr = includeQr,
        templateId = selectedTemplateId,
        schoolName = schoolName.trim().ifEmpty { "Govt Middle School Pamposh Colony" },
        headmasterName = headmasterName.trim().ifEmpty { "Mohd Yousuf Wani" }
    )

    fun loadCardIntoEditor(card: HpcCardEntity) {
        editingId = card.id
        hpcId = card.hpcId
        fullName = card.fullName
        fatherName = card.fatherName
        dob = card.dob
        gender = card.gender
        address = card.address
        mobileNumber = card.mobileNumber
        bloodGroup = card.bloodGroup
        photoPath = card.photoPath
        includeQr = card.includeQr
        selectedTemplateId = card.templateId
        schoolName = card.schoolName
        headmasterName = card.headmasterName
        activeTab = 0
    }

    Column(
        modifier = modifier
            .fillMaxSize()
            .background(Color(0xFFF8FAFC))
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        SingleChoiceSegmentedButtonRow(modifier = Modifier.fillMaxWidth()) {
            SegmentedButton(
                selected = activeTab == 0,
                onClick = { activeTab = 0 },
                shape = SegmentedButtonDefaults.itemShape(index = 0, count = 3)
            ) {
                Text("Create Card", maxLines = 1)
            }
            SegmentedButton(
                selected = activeTab == 1,
                onClick = { activeTab = 1 },
                shape = SegmentedButtonDefaults.itemShape(index = 1, count = 3)
            ) {
                Text("Templates", maxLines = 1)
            }
            SegmentedButton(
                selected = activeTab == 2,
                onClick = { activeTab = 2 },
                shape = SegmentedButtonDefaults.itemShape(index = 2, count = 3)
            ) {
                Text("Saved (${savedCards.size})", maxLines = 1)
            }
        }

        if (feedbackBanner != null) {
            Surface(
                color = Color(0xFFD1FAE5),
                shape = RoundedCornerShape(12.dp),
                modifier = Modifier.fillMaxWidth()
            ) {
                Row(
                    modifier = Modifier.padding(horizontal = 12.dp, vertical = 8.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    Text(
                        text = feedbackBanner ?: "",
                        style = MaterialTheme.typography.labelSmall,
                        fontWeight = FontWeight.Bold,
                        color = Color(0xFF065F46),
                        modifier = Modifier.weight(1f)
                    )
                    IconButton(onClick = { feedbackBanner = null }, modifier = Modifier.size(22.dp)) {
                        Icon(Icons.Rounded.Close, contentDescription = "Dismiss", tint = Color(0xFF065F46))
                    }
                }
            }
        }

        when (activeTab) {
            0 -> {
                // Create / Edit HPC Card Form
                Column(
                    modifier = Modifier
                        .fillMaxSize()
                        .verticalScroll(rememberScrollState()),
                    verticalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    // Student-Wise Manual Selection & Direct PDF / JPEG / Preview / Print Controls
                    Card(
                        shape = RoundedCornerShape(16.dp),
                        colors = CardDefaults.cardColors(containerColor = Color(0xFFEEF2FF)),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Column(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(14.dp),
                            verticalArrangement = Arrangement.spacedBy(10.dp)
                        ) {
                            Text(
                                text = "Student-Wise Holistic Progress Card (Manual Download)",
                                style = MaterialTheme.typography.titleSmall,
                                fontWeight = FontWeight.Bold,
                                color = Color(0xFF1E1B4B)
                            )
                            Text(
                                text = "Select an individual student and export only their Holistic Progress Card as PDF, JPEG, Preview, or Print.",
                                style = MaterialTheme.typography.labelSmall,
                                color = Color(0xFF475569)
                            )

                            if (students.isNotEmpty()) {
                                LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                    items(students, key = { it.id }) { student ->
                                        FilterChip(
                                            selected = selectedStudentId == student.id,
                                            onClick = {
                                                selectedStudentId = student.id
                                                editingId = 0L
                                                hpcId = "HPC-${student.admissionNumber}"
                                                fullName = student.fullName
                                                fatherName = student.fatherName
                                                mobileNumber = student.mobileNumber
                                                headmasterName = savedManualHeadmaster.fullName
                                                feedbackBanner = "Loaded ${student.fullName} (Class ${student.classNumber}-${student.section}) for individual HPC export."
                                            },
                                            label = {
                                                Text(
                                                    text = "${student.fullName} (${student.classNumber}-${student.section})",
                                                    maxLines = 1,
                                                    overflow = TextOverflow.Ellipsis
                                                )
                                            }
                                        )
                                    }
                                }
                            }

                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.spacedBy(8.dp)
                            ) {
                                Button(
                                    onClick = {
                                        val draft = buildCurrentDraft()
                                        launchBulkHpcPrintJob(
                                            context = context,
                                            cards = listOf(draft),
                                            isA4Layout = true
                                        )
                                        feedbackBanner = "Opened Save as PDF / Print for ${draft.fullName}."
                                    },
                                    colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF4F46E5)),
                                    shape = RoundedCornerShape(10.dp),
                                    contentPadding = PaddingValues(horizontal = 10.dp, vertical = 8.dp),
                                    modifier = Modifier.weight(1f)
                                ) {
                                    Icon(Icons.Rounded.PictureAsPdf, contentDescription = null, modifier = Modifier.size(16.dp))
                                    Spacer(modifier = Modifier.width(4.dp))
                                    Text("Download PDF", maxLines = 1, style = MaterialTheme.typography.labelMedium, fontWeight = FontWeight.Bold)
                                }

                                Button(
                                    onClick = {
                                        val draft = buildCurrentDraft()
                                        val frontBmp = renderHpcCardSideBitmap(draft, isBackSide = false, officialLogo = officialLogoBitmap)
                                        val ok = saveBitmapToGallery(
                                            context = context,
                                            bitmap = frontBmp,
                                            fileName = "HPC_${draft.fullName.replace(Regex("[^A-Za-z0-9_-]"), "_")}_${draft.hpcId}",
                                            format = Bitmap.CompressFormat.JPEG
                                        )
                                        feedbackBanner = if (ok) {
                                            "Saved JPEG Holistic Progress Card for ${draft.fullName} to Pictures/SchoolMaster_HPC."
                                        } else {
                                            "Unable to save JPEG image. Check storage permissions."
                                        }
                                    },
                                    colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF059669)),
                                    shape = RoundedCornerShape(10.dp),
                                    contentPadding = PaddingValues(horizontal = 10.dp, vertical = 8.dp),
                                    modifier = Modifier.weight(1f)
                                ) {
                                    Icon(Icons.Rounded.Image, contentDescription = null, modifier = Modifier.size(16.dp))
                                    Spacer(modifier = Modifier.width(4.dp))
                                    Text("Download JPEG", maxLines = 1, style = MaterialTheme.typography.labelMedium, fontWeight = FontWeight.Bold)
                                }
                            }

                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.spacedBy(8.dp)
                            ) {
                                OutlinedButton(
                                    onClick = { previewCard = buildCurrentDraft() },
                                    shape = RoundedCornerShape(10.dp),
                                    contentPadding = PaddingValues(horizontal = 10.dp, vertical = 8.dp),
                                    modifier = Modifier.weight(1f)
                                ) {
                                    Icon(Icons.Rounded.Visibility, contentDescription = null, modifier = Modifier.size(16.dp))
                                    Spacer(modifier = Modifier.width(4.dp))
                                    Text("Preview", maxLines = 1, style = MaterialTheme.typography.labelMedium, fontWeight = FontWeight.Bold)
                                }

                                OutlinedButton(
                                    onClick = {
                                        val draft = buildCurrentDraft()
                                        launchBulkHpcPrintJob(
                                            context = context,
                                            cards = listOf(draft),
                                            isA4Layout = true
                                        )
                                        feedbackBanner = "Opened Print dialog for ${draft.fullName}."
                                    },
                                    shape = RoundedCornerShape(10.dp),
                                    contentPadding = PaddingValues(horizontal = 10.dp, vertical = 8.dp),
                                    modifier = Modifier.weight(1f)
                                ) {
                                    Icon(Icons.Rounded.Print, contentDescription = null, modifier = Modifier.size(16.dp))
                                    Spacer(modifier = Modifier.width(4.dp))
                                    Text("Print", maxLines = 1, style = MaterialTheme.typography.labelMedium, fontWeight = FontWeight.Bold)
                                }
                            }
                        }
                    }

                    // Photo Picker & CameraX CameraView Row
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
                            horizontalArrangement = Arrangement.spacedBy(12.dp)
                        ) {
                            val loadedPhoto = remember(photoPath) {
                                if (photoPath.isNotBlank() && File(photoPath).exists()) {
                                    BitmapFactory.decodeFile(photoPath)?.asImageBitmap()
                                } else null
                            }
                            Box(
                                modifier = Modifier
                                    .size(68.dp)
                                    .clip(RoundedCornerShape(14.dp))
                                    .background(Color(0xFFEEF2FF))
                                    .border(1.dp, Color(0xFFCBD5E1), RoundedCornerShape(14.dp)),
                                contentAlignment = Alignment.Center
                            ) {
                                if (loadedPhoto != null) {
                                    Image(
                                        bitmap = loadedPhoto,
                                        contentDescription = "Card Holder Photograph",
                                        contentScale = ContentScale.Crop,
                                        modifier = Modifier.fillMaxSize()
                                    )
                                } else {
                                    Icon(
                                        imageVector = Icons.Rounded.Badge,
                                        contentDescription = null,
                                        tint = Color(0xFF4F46E5),
                                        modifier = Modifier.size(30.dp)
                                    )
                                }
                            }

                            Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                                Text(
                                    text = "HPC Photograph (CameraX / Gallery)",
                                    style = MaterialTheme.typography.titleSmall,
                                    fontWeight = FontWeight.Bold
                                )
                                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                    Button(
                                        onClick = { showCameraModal = true },
                                        colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF4F46E5)),
                                        contentPadding = PaddingValues(horizontal = 10.dp, vertical = 6.dp),
                                        shape = RoundedCornerShape(10.dp)
                                    ) {
                                        Icon(Icons.Rounded.CameraAlt, contentDescription = null, modifier = Modifier.size(15.dp))
                                        Spacer(modifier = Modifier.width(4.dp))
                                        Text("Camera")
                                    }
                                    OutlinedButton(
                                        onClick = { galleryPicker.launch("image/*") },
                                        contentPadding = PaddingValues(horizontal = 10.dp, vertical = 6.dp),
                                        shape = RoundedCornerShape(10.dp)
                                    ) {
                                        Icon(Icons.Rounded.Image, contentDescription = null, modifier = Modifier.size(15.dp))
                                        Spacer(modifier = Modifier.width(4.dp))
                                        Text("Gallery")
                                    }
                                }
                            }
                        }
                    }

                    OutlinedTextField(
                        value = fullName,
                        onValueChange = { fullName = it },
                        label = { Text("Full Name (English / हिंदी / اردو) *") },
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth()
                    )
                    OutlinedTextField(
                        value = fatherName,
                        onValueChange = { fatherName = it },
                        label = { Text("Father's / Guardian's Name *") },
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth()
                    )
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        OutlinedTextField(
                            value = hpcId,
                            onValueChange = { hpcId = it },
                            label = { Text("HPC ID / Reg No.") },
                            singleLine = true,
                            modifier = Modifier.weight(1f)
                        )
                        OutlinedTextField(
                            value = dob,
                            onValueChange = { dob = it },
                            label = { Text("DOB (YYYY-MM-DD)") },
                            singleLine = true,
                            modifier = Modifier.weight(1f)
                        )
                    }
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        OutlinedTextField(
                            value = gender,
                            onValueChange = { gender = it },
                            label = { Text("Gender") },
                            singleLine = true,
                            modifier = Modifier.weight(1f)
                        )
                        OutlinedTextField(
                            value = bloodGroup,
                            onValueChange = { bloodGroup = it },
                            label = { Text("Blood Group (Opt)") },
                            singleLine = true,
                            modifier = Modifier.weight(1f)
                        )
                    }
                    OutlinedTextField(
                        value = mobileNumber,
                        onValueChange = { mobileNumber = it },
                        label = { Text("Mobile Number") },
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Phone),
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth()
                    )
                    OutlinedTextField(
                        value = address,
                        onValueChange = { address = it },
                        label = { Text("Address") },
                        modifier = Modifier.fillMaxWidth()
                    )
                    OutlinedTextField(
                        value = headmasterName,
                        onValueChange = { headmasterName = it },
                        label = { Text("Headmaster's Name (Signature Block)") },
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth()
                    )

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(
                            text = "Include Scannable QR Code on Card",
                            style = MaterialTheme.typography.bodySmall,
                            fontWeight = FontWeight.SemiBold
                        )
                        Switch(checked = includeQr, onCheckedChange = { includeQr = it })
                    }

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        OutlinedButton(
                            onClick = { previewCard = buildCurrentDraft() },
                            shape = RoundedCornerShape(12.dp),
                            modifier = Modifier.weight(1f)
                        ) {
                            Icon(Icons.Rounded.Visibility, contentDescription = null, modifier = Modifier.size(16.dp))
                            Spacer(modifier = Modifier.width(6.dp))
                            Text("Preview & Export")
                        }
                        Button(
                            enabled = fullName.isNotBlank(),
                            onClick = {
                                val card = buildCurrentDraft()
                                onSaveCard(card)
                                feedbackBanner = "HPC Card saved for ${card.fullName} (${card.hpcId})"
                                previewCard = card
                            },
                            colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF4F46E5)),
                            shape = RoundedCornerShape(12.dp),
                            modifier = Modifier.weight(1f)
                        ) {
                            Text(if (editingId > 0L) "Update Card" else "Save to Room DB")
                        }
                    }

                    Spacer(modifier = Modifier.height(24.dp))
                }
            }

            1 -> {
                // Card Templates Screen using LazyVerticalGrid
                Column(
                    modifier = Modifier.fillMaxSize(),
                    verticalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    Text(
                        text = "Select HPC Card Design Template",
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.Bold,
                        color = Color(0xFF0F172A)
                    )
                    Text(
                        text = "Applied instantly to your HPC Card Preview, PDF print sheets, and JPG/PNG exports.",
                        style = MaterialTheme.typography.bodySmall,
                        color = Color(0xFF64748B)
                    )

                    LazyVerticalGrid(
                        columns = GridCells.Fixed(2),
                        horizontalArrangement = Arrangement.spacedBy(12.dp),
                        verticalArrangement = Arrangement.spacedBy(12.dp),
                        modifier = Modifier.weight(1f)
                    ) {
                        items(HPC_CARD_TEMPLATES, key = { it.id }) { tpl ->
                            val isSelected = selectedTemplateId == tpl.id
                            Card(
                                shape = RoundedCornerShape(18.dp),
                                colors = CardDefaults.cardColors(containerColor = Color.White),
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .border(
                                        width = if (isSelected) 2.5.dp else 1.dp,
                                        color = if (isSelected) tpl.headerColor else Color(0xFFE2E8F0),
                                        shape = RoundedCornerShape(18.dp)
                                    )
                                    .clickable {
                                        selectedTemplateId = tpl.id
                                        feedbackBanner = "Applied template: ${tpl.title}"
                                    }
                            ) {
                                Column {
                                    Box(
                                        modifier = Modifier
                                            .fillMaxWidth()
                                            .height(64.dp)
                                            .background(tpl.headerColor)
                                            .padding(10.dp)
                                    ) {
                                        Row(
                                            modifier = Modifier.fillMaxWidth(),
                                            horizontalArrangement = Arrangement.SpaceBetween,
                                            verticalAlignment = Alignment.CenterVertically
                                        ) {
                                            Text(
                                                text = "HPC",
                                                style = MaterialTheme.typography.titleSmall,
                                                color = Color.White,
                                                fontWeight = FontWeight.Black
                                            )
                                            if (isSelected) {
                                                Icon(
                                                    imageVector = Icons.Rounded.CheckCircle,
                                                    contentDescription = "Selected",
                                                    tint = tpl.accentColor,
                                                    modifier = Modifier.size(20.dp)
                                                )
                                            }
                                        }
                                    }
                                    Box(
                                        modifier = Modifier
                                            .fillMaxWidth()
                                            .height(5.dp)
                                            .background(tpl.accentColor)
                                    )
                                    Column(
                                        modifier = Modifier.padding(12.dp),
                                        verticalArrangement = Arrangement.spacedBy(4.dp)
                                    ) {
                                        Text(
                                            text = tpl.title,
                                            style = MaterialTheme.typography.titleSmall,
                                            fontWeight = FontWeight.Bold,
                                            color = Color(0xFF0F172A)
                                        )
                                        Text(
                                            text = tpl.subtitle,
                                            style = MaterialTheme.typography.labelSmall,
                                            color = Color(0xFF64748B)
                                        )
                                    }
                                }
                            }
                        }
                    }

                    Button(
                        onClick = { previewCard = buildCurrentDraft() },
                        colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF4F46E5)),
                        shape = RoundedCornerShape(14.dp),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Icon(Icons.Rounded.Visibility, contentDescription = null, modifier = Modifier.size(18.dp))
                        Spacer(modifier = Modifier.width(8.dp))
                        Text("Preview Active Template", fontWeight = FontWeight.Bold)
                    }
                }
            }

            else -> {
                // My Saved Cards with Room Search + Multi-Select Bulk Print + Confirm Delete
                Column(
                    modifier = Modifier.fillMaxSize(),
                    verticalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    OutlinedTextField(
                        value = searchQuery,
                        onValueChange = onSearchQueryChange,
                        placeholder = { Text("Search by Full Name or HPC Registration No...") },
                        leadingIcon = { Icon(Icons.Rounded.Search, contentDescription = null) },
                        trailingIcon = {
                            if (searchQuery.isNotEmpty()) {
                                IconButton(onClick = { onSearchQueryChange("") }) {
                                    Icon(Icons.Rounded.Close, contentDescription = "Clear")
                                }
                            }
                        },
                        singleLine = true,
                        shape = RoundedCornerShape(14.dp),
                        modifier = Modifier.fillMaxWidth()
                    )

                    // Bulk Print Bar
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(
                            text = "${selectedBulkIds.size} selected for batch print",
                            style = MaterialTheme.typography.labelMedium,
                            color = Color(0xFF475569),
                            fontWeight = FontWeight.SemiBold
                        )
                        Button(
                            enabled = selectedBulkIds.isNotEmpty(),
                            onClick = {
                                val batch = savedCards.filter { selectedBulkIds.contains(it.id) }
                                if (batch.isNotEmpty()) {
                                    launchBulkHpcPrintJob(context, batch, isA4Layout = true)
                                    feedbackBanner = "Started Android PrintManager bulk job for ${batch.size} HPC card(s)."
                                }
                            },
                            colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF059669)),
                            shape = RoundedCornerShape(12.dp)
                        ) {
                            Icon(Icons.Rounded.Print, contentDescription = null, modifier = Modifier.size(16.dp))
                            Spacer(modifier = Modifier.width(6.dp))
                            Text("Bulk Print (${selectedBulkIds.size})")
                        }
                    }

                    LazyColumn(
                        modifier = Modifier.fillMaxSize(),
                        verticalArrangement = Arrangement.spacedBy(10.dp),
                        contentPadding = PaddingValues(bottom = 24.dp)
                    ) {
                        items(savedCards, key = { it.id }) { card ->
                            val isChecked = selectedBulkIds.contains(card.id)
                            val tpl = findHpcTemplate(card.templateId)
                            Card(
                                shape = RoundedCornerShape(16.dp),
                                colors = CardDefaults.cardColors(containerColor = Color.White),
                                modifier = Modifier.fillMaxWidth()
                            ) {
                                Row(
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .padding(12.dp),
                                    verticalAlignment = Alignment.CenterVertically,
                                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                                ) {
                                    Checkbox(
                                        checked = isChecked,
                                        onCheckedChange = { checked ->
                                            if (checked) {
                                                if (!selectedBulkIds.contains(card.id)) selectedBulkIds.add(card.id)
                                            } else {
                                                selectedBulkIds.remove(card.id)
                                            }
                                        }
                                    )
                                    Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                                        Text(
                                            text = card.fullName,
                                            style = MaterialTheme.typography.titleSmall,
                                            fontWeight = FontWeight.Bold
                                        )
                                        Text(
                                            text = "${card.hpcId} • Father: ${card.fatherName}",
                                            style = MaterialTheme.typography.bodySmall,
                                            color = Color(0xFF475569)
                                        )
                                        Text(
                                            text = "Template: ${tpl.title} • Headmaster: ${card.headmasterName}",
                                            style = MaterialTheme.typography.labelSmall,
                                            color = Color(0xFF64748B)
                                        )
                                    }
                                    IconButton(onClick = { previewCard = card }) {
                                        Icon(Icons.Rounded.Visibility, contentDescription = "Preview", tint = Color(0xFF4F46E5))
                                    }
                                    IconButton(onClick = { loadCardIntoEditor(card) }) {
                                        Icon(Icons.Rounded.Edit, contentDescription = "Edit", tint = Color(0xFF0F766E))
                                    }
                                    IconButton(onClick = { deleteCandidate = card }) {
                                        Icon(Icons.Rounded.Delete, contentDescription = "Delete", tint = Color(0xFFDC2626))
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    // CameraX Photo Capture Modal for HPC Card Maker
    if (showCameraModal) {
        HpcCameraViewDialog(
            onDismiss = { showCameraModal = false },
            onPhotoCaptured = { capturedPath ->
                photoPath = capturedPath
                showCameraModal = false
                feedbackBanner = "Captured photo with CameraX and linked to HPC record."
            }
        )
    }

    // HPC Card Preview Modal (A4 Print & ID-Card Sizes, Front & Back + PDF / JPG / PNG / WhatsApp Export)
    previewCard?.let { card ->
        HpcCardPreviewExportDialog(
            card = card,
            onDismiss = { previewCard = null },
            onStatusMessage = { msg -> feedbackBanner = msg }
        )
    }

    // Confirm Delete Dialog
    deleteCandidate?.let { card ->
        AlertDialog(
            onDismissRequest = { deleteCandidate = null },
            title = { Text("Delete Saved HPC Card?") },
            text = { Text("Are you sure you want to delete the HPC card for ${card.fullName} (${card.hpcId})?") },
            confirmButton = {
                Button(
                    onClick = {
                        onDeleteCard(card.id)
                        selectedBulkIds.remove(card.id)
                        deleteCandidate = null
                        feedbackBanner = "Deleted HPC card ${card.hpcId}."
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = Color(0xFFDC2626))
                ) {
                    Text("Delete")
                }
            },
            dismissButton = {
                TextButton(onClick = { deleteCandidate = null }) { Text("Cancel") }
            }
        )
    }
}

@Composable
private fun HpcCameraViewDialog(
    onDismiss: () -> Unit,
    onPhotoCaptured: (String) -> Unit
) {
    val context = LocalContext.current
    val lifecycleOwner = LocalLifecycleOwner.current
    var hasCameraPermission by remember {
        mutableStateOf(
            ContextCompat.checkSelfPermission(context, Manifest.permission.CAMERA) ==
                PackageManager.PERMISSION_GRANTED
        )
    }
    val permissionLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.RequestPermission()
    ) { granted ->
        hasCameraPermission = granted
    }
    var imageCapture by remember { mutableStateOf<ImageCapture?>(null) }
    var captureError by remember { mutableStateOf<String?>(null) }

    Dialog(
        onDismissRequest = onDismiss,
        properties = DialogProperties(usePlatformDefaultWidth = false)
    ) {
        Surface(
            shape = RoundedCornerShape(22.dp),
            color = Color(0xFF0F172A),
            modifier = Modifier
                .fillMaxSize()
                .padding(16.dp)
        ) {
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(16.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = "HPC CameraView (CameraX)",
                        style = MaterialTheme.typography.titleMedium,
                        color = Color.White,
                        fontWeight = FontWeight.Bold
                    )
                    IconButton(onClick = onDismiss) {
                        Icon(Icons.Rounded.Close, contentDescription = "Close", tint = Color.White)
                    }
                }

                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .weight(1f)
                        .clip(RoundedCornerShape(18.dp))
                        .background(Color.Black),
                    contentAlignment = Alignment.Center
                ) {
                    if (hasCameraPermission) {
                        AndroidView(
                            modifier = Modifier.fillMaxSize(),
                            factory = { ctx ->
                                val previewView = PreviewView(ctx)
                                val future = ProcessCameraProvider.getInstance(ctx)
                                future.addListener({
                                    try {
                                        val provider = future.get()
                                        val preview = Preview.Builder().build().also {
                                            it.setSurfaceProvider(previewView.surfaceProvider)
                                        }
                                        val capture = ImageCapture.Builder().build()
                                        imageCapture = capture
                                        provider.unbindAll()
                                        val selector = if (provider.hasCamera(CameraSelector.DEFAULT_FRONT_CAMERA)) {
                                            CameraSelector.DEFAULT_FRONT_CAMERA
                                        } else {
                                            CameraSelector.DEFAULT_BACK_CAMERA
                                        }
                                        provider.bindToLifecycle(lifecycleOwner, selector, preview, capture)
                                    } catch (ex: Exception) {
                                        captureError = ex.localizedMessage ?: "Camera unavailable on this device."
                                    }
                                }, ContextCompat.getMainExecutor(ctx))
                                previewView
                            }
                        )
                    } else {
                        Column(
                            horizontalAlignment = Alignment.CenterHorizontally,
                            verticalArrangement = Arrangement.spacedBy(10.dp),
                            modifier = Modifier.padding(24.dp)
                        ) {
                            Text(
                                text = "Camera permission is required to capture a student photograph.",
                                style = MaterialTheme.typography.bodySmall,
                                color = Color(0xFFCBD5E1)
                            )
                            Button(
                                onClick = { permissionLauncher.launch(Manifest.permission.CAMERA) },
                                colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF4F46E5))
                            ) {
                                Text("Grant Camera Permission")
                            }
                        }
                    }
                }

                if (captureError != null) {
                    Text(
                        text = captureError ?: "",
                        style = MaterialTheme.typography.labelSmall,
                        color = Color(0xFFFCA5A5)
                    )
                }

                Button(
                    onClick = {
                        val capture = imageCapture ?: return@Button
                        val photoDir = File(context.filesDir, "hpc_photos").apply { mkdirs() }
                        val outFile = File(photoDir, "hpc_photo_${System.currentTimeMillis()}.jpg")
                        val options = ImageCapture.OutputFileOptions.Builder(outFile).build()
                        capture.takePicture(
                            options,
                            ContextCompat.getMainExecutor(context),
                            object : ImageCapture.OnImageSavedCallback {
                                override fun onImageSaved(outputFileResults: ImageCapture.OutputFileResults) {
                                    onPhotoCaptured(outFile.absolutePath)
                                }

                                override fun onError(exception: ImageCaptureException) {
                                    captureError = exception.localizedMessage ?: "Failed to capture image."
                                }
                            }
                        )
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF10B981)),
                    shape = RoundedCornerShape(14.dp),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Icon(Icons.Rounded.CameraAlt, contentDescription = null)
                    Spacer(modifier = Modifier.width(8.dp))
                    Text("Capture Photo for HPC Card", fontWeight = FontWeight.Bold)
                }
            }
        }
    }
}

@Composable
private fun HpcCardPreviewExportDialog(
    card: HpcCardEntity,
    onDismiss: () -> Unit,
    onStatusMessage: (String) -> Unit
) {
    val context = LocalContext.current
    var previewSizeMode by remember { mutableIntStateOf(0) } // 0 = ID-Card Size, 1 = A4 Print Sheet
    var showBackSide by remember { mutableStateOf(false) }

    val logoVersion by OfficialLogoStore.logoVersion.collectAsState()
    val officialLogoBitmap = remember(logoVersion) { OfficialLogoStore.loadOfficialLogoBitmap(context) }

    val frontBitmap = remember(card, logoVersion) { renderHpcCardSideBitmap(card, isBackSide = false, officialLogo = officialLogoBitmap) }
    val backBitmap = remember(card, logoVersion) { renderHpcCardSideBitmap(card, isBackSide = true, officialLogo = officialLogoBitmap) }

    Dialog(
        onDismissRequest = onDismiss,
        properties = DialogProperties(usePlatformDefaultWidth = false)
    ) {
        Surface(
            shape = RoundedCornerShape(24.dp),
            color = Color.White,
            modifier = Modifier
                .fillMaxSize()
                .padding(14.dp)
        ) {
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .verticalScroll(rememberScrollState())
                    .padding(16.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Column {
                        Text(
                            text = "HPC Card Preview & Export",
                            style = MaterialTheme.typography.titleMedium,
                            fontWeight = FontWeight.Bold
                        )
                        Text(
                            text = "Headmaster signature only • Print-ready PDF, JPG & PNG",
                            style = MaterialTheme.typography.labelSmall,
                            color = Color(0xFF64748B)
                        )
                    }
                    IconButton(onClick = onDismiss) {
                        Icon(Icons.Rounded.Close, contentDescription = "Close")
                    }
                }

                // Layout Size Selector (ID-Card vs A4 Print)
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    FilterChip(
                        selected = previewSizeMode == 0,
                        onClick = { previewSizeMode = 0 },
                        label = { Text("ID-Card Size") }
                    )
                    FilterChip(
                        selected = previewSizeMode == 1,
                        onClick = { previewSizeMode = 1 },
                        label = { Text("A4 Print Sheet") }
                    )
                    FilterChip(
                        selected = showBackSide,
                        onClick = { showBackSide = !showBackSide },
                        label = { Text(if (showBackSide) "Showing: Back" else "Showing: Front") }
                    )
                }

                // Visual Preview Container
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(16.dp))
                        .background(if (previewSizeMode == 1) Color(0xFFF1F5F9) else Color.Transparent)
                        .border(1.dp, Color(0xFFCBD5E1), RoundedCornerShape(16.dp))
                        .padding(if (previewSizeMode == 1) 18.dp else 4.dp),
                    contentAlignment = Alignment.Center
                ) {
                    Column(
                        horizontalAlignment = Alignment.CenterHorizontally,
                        verticalArrangement = Arrangement.spacedBy(10.dp)
                    ) {
                        if (previewSizeMode == 1) {
                            Text(
                                text = "A4 PRINT PREVIEW (FRONT & BACK ON PRINT SHEET)",
                                style = MaterialTheme.typography.labelSmall,
                                fontWeight = FontWeight.Bold,
                                color = Color(0xFF475569)
                            )
                            Image(
                                bitmap = frontBitmap.asImageBitmap(),
                                contentDescription = "HPC Front A4",
                                contentScale = ContentScale.FillWidth,
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .clip(RoundedCornerShape(12.dp))
                            )
                            Image(
                                bitmap = backBitmap.asImageBitmap(),
                                contentDescription = "HPC Back A4",
                                contentScale = ContentScale.FillWidth,
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .clip(RoundedCornerShape(12.dp))
                            )
                        } else {
                            val activeBmp = if (showBackSide) backBitmap else frontBitmap
                            Image(
                                bitmap = activeBmp.asImageBitmap(),
                                contentDescription = "HPC Card Preview",
                                contentScale = ContentScale.FillWidth,
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .clip(RoundedCornerShape(12.dp))
                            )
                        }
                    }
                }

                HorizontalDivider(color = Color(0xFFE2E8F0))

                // Three Separate Download Buttons + WhatsApp Share
                Button(
                    onClick = {
                        launchBulkHpcPrintJob(
                            context = context,
                            cards = listOf(card),
                            isA4Layout = previewSizeMode == 1
                        )
                        onStatusMessage("Launched PrintManager PDF export (${if (previewSizeMode == 1) "A4" else "ID-Card"} size).")
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF4F46E5)),
                    shape = RoundedCornerShape(12.dp),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Icon(Icons.Rounded.PictureAsPdf, contentDescription = null, modifier = Modifier.size(18.dp))
                    Spacer(modifier = Modifier.width(8.dp))
                    Text("1. Download PDF (${if (previewSizeMode == 1) "A4 Print" else "ID-Card"})", fontWeight = FontWeight.Bold)
                }

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    Button(
                        onClick = {
                            val ok = saveBitmapToGallery(
                                context = context,
                                bitmap = if (showBackSide) backBitmap else frontBitmap,
                                fileName = "${card.hpcId}_${if (showBackSide) "back" else "front"}",
                                format = Bitmap.CompressFormat.JPEG
                            )
                            onStatusMessage(if (ok) "High-resolution JPG saved to Gallery." else "Could not save JPG image.")
                        },
                        colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF059669)),
                        shape = RoundedCornerShape(12.dp),
                        modifier = Modifier.weight(1f)
                    ) {
                        Text("2. Download JPG", fontWeight = FontWeight.Bold)
                    }

                    Button(
                        onClick = {
                            val ok = saveBitmapToGallery(
                                context = context,
                                bitmap = if (showBackSide) backBitmap else frontBitmap,
                                fileName = "${card.hpcId}_${if (showBackSide) "back" else "front"}",
                                format = Bitmap.CompressFormat.PNG
                            )
                            onStatusMessage(if (ok) "High-resolution PNG saved to Gallery." else "Could not save PNG image.")
                        },
                        colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF0F766E)),
                        shape = RoundedCornerShape(12.dp),
                        modifier = Modifier.weight(1f)
                    ) {
                        Text("3. Download PNG", fontWeight = FontWeight.Bold)
                    }
                }

                OutlinedButton(
                    onClick = {
                        BiometricAuditCsvExporter.shareBitmapImage(
                            context = context,
                            bitmap = frontBitmap,
                            subDir = "shared_hpc",
                            fileNamePrefix = card.hpcId,
                            chooserTitle = "Share HPC Card",
                            shareText = "HPC Card — ${card.fullName} (${card.hpcId})",
                            preferWhatsApp = true
                        )
                    },
                    shape = RoundedCornerShape(12.dp),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Icon(Icons.Rounded.Share, contentDescription = null, modifier = Modifier.size(16.dp))
                    Spacer(modifier = Modifier.width(6.dp))
                    Text("Share HPC Card via WhatsApp")
                }
            }
        }
    }
}

private fun copyUriPhotoToAppStorage(context: Context, uri: Uri): String? {
    return try {
        val dir = File(context.filesDir, "hpc_photos").apply { mkdirs() }
        val target = File(dir, "hpc_gallery_${System.currentTimeMillis()}.jpg")
        context.contentResolver.openInputStream(uri)?.use { input ->
            FileOutputStream(target).use { output ->
                input.copyTo(output)
            }
        }
        target.absolutePath
    } catch (_: Exception) {
        null
    }
}

private fun saveBitmapToGallery(
    context: Context,
    bitmap: Bitmap,
    fileName: String,
    format: Bitmap.CompressFormat
): Boolean {
    return try {
        val isPng = format == Bitmap.CompressFormat.PNG
        val ext = if (isPng) "png" else "jpg"
        val mime = if (isPng) "image/png" else "image/jpeg"
        val values = ContentValues().apply {
            put(MediaStore.Images.Media.DISPLAY_NAME, "${fileName}_${System.currentTimeMillis()}.$ext")
            put(MediaStore.Images.Media.MIME_TYPE, mime)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                put(MediaStore.Images.Media.RELATIVE_PATH, "Pictures/SchoolMaster_HPC")
            }
        }
        val uri = context.contentResolver.insert(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, values)
            ?: return false
        context.contentResolver.openOutputStream(uri)?.use { out ->
            bitmap.compress(format, 96, out)
            out.flush()
        }
        true
    } catch (_: Exception) {
        false
    }
}

fun renderHpcCardSideBitmap(
    card: HpcCardEntity,
    isBackSide: Boolean,
    officialLogo: Bitmap? = null
): Bitmap {
    val width = 1050
    val height = 660
    val bitmap = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888)
    val canvas = Canvas(bitmap)
    val tpl = findHpcTemplate(card.templateId)

    val bgPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = android.graphics.Color.WHITE }
    val headerPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = tpl.headerColor.toArgb() }
    val accentPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = tpl.accentColor.toArgb() }
    val borderPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = tpl.headerColor.toArgb()
        style = Paint.Style.STROKE
        strokeWidth = 6f
    }

    // Card background & outer border
    canvas.drawRoundRect(RectF(6f, 6f, width - 6f, height - 6f), 28f, 28f, bgPaint)
    canvas.drawRoundRect(RectF(6f, 6f, width - 6f, height - 6f), 28f, 28f, borderPaint)

    // Header band
    canvas.drawRect(8f, 8f, width - 8f, 128f, headerPaint)
    canvas.drawRect(8f, 128f, width - 8f, 138f, accentPaint)

    val titlePaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = android.graphics.Color.WHITE
        textSize = 30f
        typeface = Typeface.create(Typeface.DEFAULT, Typeface.BOLD)
    }
    val subTitlePaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = android.graphics.Color.parseColor("#E2E8F0")
        textSize = 20f
    }
    val labelPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = android.graphics.Color.parseColor("#64748B")
        textSize = 20f
        typeface = Typeface.create(Typeface.DEFAULT, Typeface.BOLD)
    }
    val valuePaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = android.graphics.Color.parseColor("#0F172A")
        textSize = 24f
        typeface = Typeface.create(Typeface.DEFAULT, Typeface.BOLD)
    }

    val headerTextStartX = if (officialLogo != null) {
        val frameLeft = 24f
        val frameTop = 18f
        val frameRight = 114f
        val frameBottom = 108f
        val logoBg = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = android.graphics.Color.WHITE }
        canvas.drawRoundRect(RectF(frameLeft, frameTop, frameRight, frameBottom), 14f, 14f, logoBg)

        // Preserve original aspect ratio inside padded logo frame without cropping or distortion
        val pad = 8f
        val maxW = (frameRight - frameLeft) - pad * 2f
        val maxH = (frameBottom - frameTop) - pad * 2f
        val bmpW = officialLogo.width.coerceAtLeast(1).toFloat()
        val bmpH = officialLogo.height.coerceAtLeast(1).toFloat()
        val scale = minOf(maxW / bmpW, maxH / bmpH)
        val drawW = bmpW * scale
        val drawH = bmpH * scale
        val drawLeft = frameLeft + ((frameRight - frameLeft) - drawW) / 2f
        val drawTop = frameTop + ((frameBottom - frameTop) - drawH) / 2f

        canvas.drawBitmap(
            officialLogo,
            null,
            RectF(drawLeft, drawTop, drawLeft + drawW, drawTop + drawH),
            Paint(Paint.ANTI_ALIAS_FLAG or Paint.FILTER_BITMAP_FLAG)
        )
        136f
    } else {
        34f
    }

    canvas.drawText(card.schoolName.uppercase(), headerTextStartX, 54f, titlePaint)
    canvas.drawText("Pamposh Colony, Palapora Zone, Iddgah", headerTextStartX, 82f, subTitlePaint)
    canvas.drawText(
        if (isBackSide) "HOLISTIC PERSONAL CARD (BACK SIDE)" else "OFFICIAL HPC PROFILE CARD • ${card.hpcId}",
        headerTextStartX,
        106f,
        subTitlePaint
    )

    if (!isBackSide) {
        // Photo frame on right
        val photoRect = RectF(width - 244f, 168f, width - 36f, 412f)
        val photoBg = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = tpl.surfaceTint.toArgb() }
        canvas.drawRoundRect(photoRect, 18f, 18f, photoBg)
        if (card.photoPath.isNotBlank() && File(card.photoPath).exists()) {
            BitmapFactory.decodeFile(card.photoPath)?.let { photoBmp ->
                canvas.drawBitmap(photoBmp, null, photoRect, null)
            }
        } else {
            val phText = Paint(Paint.ANTI_ALIAS_FLAG).apply {
                color = tpl.headerColor.toArgb()
                textSize = 22f
                textAlign = Paint.Align.CENTER
                typeface = Typeface.create(Typeface.DEFAULT, Typeface.BOLD)
            }
            canvas.drawText("PHOTO", photoRect.centerX(), photoRect.centerY() + 8f, phText)
        }

        // Left side details
        var y = 195f
        val rows = listOf(
            "FULL NAME" to card.fullName,
            "FATHER / GUARDIAN" to card.fatherName,
            "DOB & GENDER" to "${card.dob}  •  ${card.gender}",
            "MOBILE NUMBER" to card.mobileNumber.ifBlank { "—" },
            "BLOOD GROUP" to card.bloodGroup.ifBlank { "Not Specified" }
        )
        rows.forEach { (k, v) ->
            canvas.drawText(k, 36f, y, labelPaint)
            canvas.drawText(v, 285f, y, valuePaint)
            y += 62f
        }

        // Bottom signature block — STRICTLY ONLY Headmaster's Name (NO developer/admin name)
        val sigLinePaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = android.graphics.Color.parseColor("#94A3B8")
            strokeWidth = 2f
        }
        canvas.drawLine(36f, height - 102f, width - 36f, height - 102f, sigLinePaint)
        canvas.drawText("HEADMASTER'S NAME & SIGNATURE", 36f, height - 68f, labelPaint)
        canvas.drawText(card.headmasterName, 36f, height - 34f, valuePaint)
    } else {
        // Back Side: Address + Instructions + Optional QR Code + Headmaster verification
        canvas.drawText("RESIDENTIAL ADDRESS", 36f, 195f, labelPaint)
        canvas.drawText(card.address.take(54), 36f, 232f, valuePaint)
        if (card.address.length > 54) {
            canvas.drawText(card.address.drop(54).take(54), 36f, 266f, valuePaint)
        }

        canvas.drawText("CARD VERIFICATION NOTES", 36f, 338f, labelPaint)
        val notePaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = android.graphics.Color.parseColor("#334155")
            textSize = 21f
        }
        canvas.drawText("• Carry this HPC card during school & official academic verification.", 36f, 376f, notePaint)
        canvas.drawText("• If found, kindly return to ${card.schoolName}.", 36f, 412f, notePaint)
        canvas.drawText("• Verified by Headmaster: ${card.headmasterName}", 36f, 448f, notePaint)

        if (card.includeQr) {
            val qrPayload = "HPC:${card.hpcId}\nName:${card.fullName}\nFather:${card.fatherName}\nMobile:${card.mobileNumber}"
            QrCodeGenerator.encodeQrBitmap(qrPayload, 260)?.let { qrBmp ->
                canvas.drawBitmap(qrBmp, null, Rect(width - 290, 290, width - 46, 534), null)
            }
        }
    }

    return bitmap
}

fun launchBulkHpcPrintJob(
    context: Context,
    cards: List<HpcCardEntity>,
    isA4Layout: Boolean
) {
    if (cards.isEmpty()) return
    val printManager = context.getSystemService(Context.PRINT_SERVICE) as? PrintManager ?: return
    val jobName = if (cards.size == 1) {
        "HPC_Card_${cards.first().hpcId}"
    } else {
        "HPC_Bulk_Cards_${cards.size}"
    }

    val adapter = object : PrintDocumentAdapter() {
        private var pdfDocument: PrintedPdfDocument? = null

        override fun onLayout(
            oldAttributes: PrintAttributes?,
            newAttributes: PrintAttributes,
            cancellationSignal: CancellationSignal?,
            callback: LayoutResultCallback,
            extras: Bundle?
        ) {
            pdfDocument = PrintedPdfDocument(context, newAttributes)
            if (cancellationSignal?.isCanceled == true) {
                callback.onLayoutCancelled()
                return
            }
            val info = PrintDocumentInfo.Builder("$jobName.pdf")
                .setContentType(PrintDocumentInfo.CONTENT_TYPE_DOCUMENT)
                .setPageCount(cards.size)
                .build()
            callback.onLayoutFinished(info, true)
        }

        override fun onWrite(
            pages: Array<out PageRange>?,
            destination: ParcelFileDescriptor,
            cancellationSignal: CancellationSignal?,
            callback: WriteResultCallback
        ) {
            val doc = pdfDocument ?: return
            try {
                val officialLogo = OfficialLogoStore.loadOfficialLogoBitmap(context)
                cards.forEachIndexed { index, card ->
                    val page = doc.startPage(index)
                    val pageCanvas = page.canvas
                    val front = renderHpcCardSideBitmap(card, isBackSide = false, officialLogo = officialLogo)
                    val back = renderHpcCardSideBitmap(card, isBackSide = true, officialLogo = officialLogo)
                    val pageW = pageCanvas.width.toFloat()

                    if (isA4Layout) {
                        // Draw Front + Back centered on A4 page
                        val cardW = (pageW - 80f).coerceAtMost(480f)
                        val cardH = cardW * (660f / 1050f)
                        val left = (pageW - cardW) / 2f
                        pageCanvas.drawBitmap(front, null, RectF(left, 56f, left + cardW, 56f + cardH), null)
                        pageCanvas.drawBitmap(back, null, RectF(left, 86f + cardH, left + cardW, 86f + cardH * 2f), null)
                    } else {
                        // Standard ID-Card size (3.375in x 2.125in -> ~243pt x 153pt)
                        val idW = 243f
                        val idH = 153f
                        val left = (pageW - idW) / 2f
                        pageCanvas.drawBitmap(front, null, RectF(left, 48f, left + idW, 48f + idH), null)
                        pageCanvas.drawBitmap(back, null, RectF(left, 72f + idH, left + idW, 72f + idH * 2f), null)
                    }
                    doc.finishPage(page)
                }
                FileOutputStream(destination.fileDescriptor).use { out ->
                    doc.writeTo(out)
                }
                callback.onWriteFinished(arrayOf(PageRange.ALL_PAGES))
            } catch (ex: Exception) {
                callback.onWriteFailed(ex.localizedMessage)
            } finally {
                doc.close()
                pdfDocument = null
            }
        }
    }

    val mediaSize = if (isA4Layout) PrintAttributes.MediaSize.ISO_A4 else PrintAttributes.MediaSize.NA_INDEX_3X5
    val attrs = PrintAttributes.Builder()
        .setMediaSize(mediaSize)
        .setColorMode(PrintAttributes.COLOR_MODE_COLOR)
        .build()

    printManager.print(jobName, adapter, attrs)
}
