package `in`.gov.jk.schoolmaster.data.local

import android.content.Context
import androidx.room.Database
import androidx.room.Room
import androidx.room.RoomDatabase
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.combine
import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Locale

@Database(
    entities = [
        StudentEntity::class,
        TeacherEntity::class,
        TeacherLeaveEntity::class,
        ExaminationEntity::class,
        BiometricAuditLogEntity::class,
        TeacherAttendanceEntity::class,
        ScannerHistoryEntity::class,
        HpcCardEntity::class,
        LeaveAuditLogEntity::class
    ],
    version = 6,
    exportSchema = false
)
abstract class SchoolMasterDatabase : RoomDatabase() {
    abstract fun studentDao(): StudentDao
    abstract fun teacherDao(): TeacherDao
    abstract fun protectedModulesDao(): ProtectedModulesDao
    abstract fun teacherAttendanceDao(): TeacherAttendanceDao
    abstract fun scannerHistoryDao(): ScannerHistoryDao
    abstract fun hpcCardDao(): HpcCardDao

    companion object {
        @Volatile
        private var INSTANCE: SchoolMasterDatabase? = null

        fun getInstance(context: Context): SchoolMasterDatabase {
            return INSTANCE ?: synchronized(this) {
                val instance = Room.databaseBuilder(
                    context.applicationContext,
                    SchoolMasterDatabase::class.java,
                    "school_master_offline.db"
                )
                    .fallbackToDestructiveMigration()
                    .build()
                INSTANCE = instance
                instance
            }
        }
    }
}

class SchoolMasterRepository(private val db: SchoolMasterDatabase) {

    fun observeStudents(query: String = ""): Flow<List<StudentEntity>> {
        val trimmed = query.trim()
        return if (trimmed.isEmpty()) {
            db.studentDao().observeAllStudents()
        } else {
            db.studentDao().searchStudents(trimmed)
        }
    }

    suspend fun findStudentForQrScan(rawQr: String): StudentEntity? {
        val cleaned = rawQr.trim()
        if (cleaned.isEmpty()) return null
        // Extract Admission Number or Student ID from 7-field QR format or direct ID
        val admRegex = Regex("(?:Admission Number:\\s*)([A-Za-z0-9-]+)", RegexOption.IGNORE_CASE)
        val idRegex = Regex("(?:Student ID:\\s*)([A-Za-z0-9-]+)", RegexOption.IGNORE_CASE)
        val candidates = listOfNotNull(
            admRegex.find(cleaned)?.groupValues?.getOrNull(1),
            idRegex.find(cleaned)?.groupValues?.getOrNull(1),
            cleaned.lines().firstOrNull()?.trim()
        ).distinct()

        for (code in candidates) {
            val found = db.studentDao().findByAdmissionOrId(code)
            if (found != null) return found
        }
        return null
    }

    fun observeTeachers(query: String = ""): Flow<List<TeacherEntity>> {
        val trimmed = query.trim()
        return if (trimmed.isEmpty()) {
            db.teacherDao().observeAllTeachers()
        } else {
            db.teacherDao().searchTeachers(trimmed)
        }
    }

    fun observeLeaves(): Flow<List<TeacherLeaveEntity>> = db.protectedModulesDao().observeLeaves()

    fun observeExaminations(): Flow<List<ExaminationEntity>> = db.protectedModulesDao().observeExaminations()

    fun observeRecentBiometricAuditLogs(): Flow<List<BiometricAuditLogEntity>> =
        db.protectedModulesDao().observeRecentBiometricAuditLogs()

    fun observeAllBiometricAuditLogs(): Flow<List<BiometricAuditLogEntity>> =
        db.protectedModulesDao().observeAllBiometricAuditLogs()

    fun searchBiometricAuditLogs(
        query: String,
        startMillis: Long = 0L,
        endMillis: Long = Long.MAX_VALUE
    ): Flow<List<BiometricAuditLogEntity>> =
        db.protectedModulesDao().searchBiometricAuditLogs(query.trim(), startMillis, endMillis)

    suspend fun getAllBiometricAuditLogsOnce(): List<BiometricAuditLogEntity> =
        db.protectedModulesDao().getAllBiometricAuditLogsOnce()

    suspend fun recordBiometricAuditAttempt(
        moduleName: String,
        outcome: String,
        authMethod: String,
        detailMessage: String,
        actorName: String = "Mohd Yousuf Wani"
    ) {
        val isSuccess = outcome.equals("SUCCESS", ignoreCase = true)
        val normalizedEvent = if (isSuccess) "SUCCESS" else "FAILURE"
        val normalizedOutcome = if (isSuccess) "SUCCESS" else "FAILED"
        val cleanDesc = detailMessage.trim().ifEmpty { "Authentication attempt recorded" }
        db.protectedModulesDao().insertBiometricAuditLog(
            BiometricAuditLogEntity(
                moduleName = moduleName,
                actorName = actorName.trim().ifEmpty { "Mohd Yousuf Wani" },
                eventType = normalizedEvent,
                outcome = normalizedOutcome,
                authMethod = authMethod.trim().ifEmpty { "Biometric / Credential" },
                description = cleanDesc,
                detailMessage = cleanDesc,
                timestampMillis = System.currentTimeMillis()
            )
        )
    }

    fun observeTeacherAttendance(): Flow<List<TeacherAttendanceEntity>> =
        db.teacherAttendanceDao().observeAllAttendance()

    fun observePendingSyncCount(): Flow<Int> =
        combine(
            db.teacherAttendanceDao().observePendingSyncCount(),
            db.scannerHistoryDao().observePendingScanCount()
        ) { teacherPending, studentScanPending ->
            teacherPending + studentScanPending
        }

    suspend fun queueOfflineTeacherAttendance(teacherName: String, teacherId: String, dateIso: String) {
        db.teacherAttendanceDao().upsert(
            TeacherAttendanceEntity(
                id = "ATT-$teacherId-$dateIso",
                teacherId = teacherId,
                teacherName = teacherName,
                dateIso = dateIso,
                status = "Present",
                syncStatus = "PENDING",
                lastModified = System.currentTimeMillis()
            )
        )
    }

    suspend fun saveEditableTeacherAttendanceRecord(
        teacherId: String,
        teacherName: String,
        dateIso: String,
        status: String,
        arrivalTime: String,
        departureTime: String,
        designation: String,
        remarksByHoi: String,
        updatedBy: String,
        changeHistoryJson: String = "[]"
    ) {
        val now = System.currentTimeMillis()
        db.teacherAttendanceDao().upsert(
            TeacherAttendanceEntity(
                id = "ATT-$teacherId-$dateIso",
                teacherId = teacherId,
                teacherName = teacherName,
                dateIso = dateIso,
                status = status,
                arrivalTime = arrivalTime,
                departureTime = departureTime,
                designation = designation,
                remarksByHoi = remarksByHoi,
                updatedBy = updatedBy,
                changeHistoryJson = changeHistoryJson,
                syncStatus = "PENDING",
                lastModified = now
            )
        )
    }

    suspend fun getPendingTeacherAttendanceOnce(): List<TeacherAttendanceEntity> =
        db.teacherAttendanceDao().getPendingAttendanceOnce()

    suspend fun syncAllPendingTeacherAttendance() {
        db.teacherAttendanceDao().markAllPendingSynced(System.currentTimeMillis())
        db.scannerHistoryDao().markAllPendingScansSynced()
    }

    fun observeScannerHistory(): Flow<List<ScannerHistoryEntity>> =
        db.scannerHistoryDao().observeHistory()

    suspend fun recordAttendanceScan(student: StudentEntity, rawPayload: String) {
        db.scannerHistoryDao().insertScan(
            ScannerHistoryEntity(
                studentId = student.id,
                studentName = student.fullName,
                admissionNumber = student.admissionNumber,
                classSection = "Class ${student.classNumber}-${student.section}",
                rawQrPayload = rawPayload,
                scannedAtMillis = System.currentTimeMillis()
            )
        )
        // Update student's attendance metric locally
        db.studentDao().upsert(
            student.copy(
                attendancePct = (student.attendancePct + 1).coerceAtMost(100),
                updatedAtMillis = System.currentTimeMillis()
            )
        )
    }

    fun observeHpcCards(query: String = ""): Flow<List<HpcCardEntity>> {
        val trimmed = query.trim()
        return if (trimmed.isEmpty()) {
            db.hpcCardDao().observeAllCards()
        } else {
            db.hpcCardDao().searchCards(trimmed)
        }
    }

    suspend fun saveHpcCard(card: HpcCardEntity): Long =
        db.hpcCardDao().upsert(card.copy(updatedAtMillis = System.currentTimeMillis()))

    suspend fun deleteHpcCard(cardId: Long) {
        db.hpcCardDao().deleteById(cardId)
    }

    suspend fun saveStudent(student: StudentEntity) {
        db.studentDao().upsert(student.copy(updatedAtMillis = System.currentTimeMillis()))
    }

    suspend fun saveTeacher(teacher: TeacherEntity) {
        db.teacherDao().upsert(teacher.copy(updatedAtMillis = System.currentTimeMillis()))
    }

    suspend fun submitLeaveRequest(leave: TeacherLeaveEntity): Boolean {
        val overlap = db.protectedModulesDao().findOverlappingLeave(
            teacherId = leave.teacherId,
            startDate = leave.startDate,
            endDate = leave.endDate,
            excludeId = leave.id
        )
        if (overlap != null) return false
        val now = System.currentTimeMillis()
        db.protectedModulesDao().insertLeave(leave.copy(updatedAtMillis = now))
        db.protectedModulesDao().insertLeaveAuditLog(
            LeaveAuditLogEntity(
                applicationId = leave.id,
                action = "CREATE",
                actorName = leave.teacherName,
                actorRole = "teacher",
                summary = "Submitted ${leave.leaveType} (${leave.startDate} to ${leave.endDate}, ${leave.totalDays}d)",
                timestampMillis = now
            )
        )
        return true
    }

    suspend fun editPendingLeave(leave: TeacherLeaveEntity, actorName: String): Boolean {
        if (leave.status != "Pending") return false
        val overlap = db.protectedModulesDao().findOverlappingLeave(
            teacherId = leave.teacherId,
            startDate = leave.startDate,
            endDate = leave.endDate,
            excludeId = leave.id
        )
        if (overlap != null) return false
        val now = System.currentTimeMillis()
        db.protectedModulesDao().insertLeave(leave.copy(updatedAtMillis = now))
        db.protectedModulesDao().insertLeaveAuditLog(
            LeaveAuditLogEntity(
                applicationId = leave.id,
                action = "EDIT",
                actorName = actorName,
                actorRole = "teacher",
                summary = "Edited pending leave (${leave.startDate} to ${leave.endDate}, ${leave.totalDays}d)",
                timestampMillis = now
            )
        )
        return true
    }

    suspend fun deletePendingLeave(leaveId: String, actorName: String, reason: String) {
        val now = System.currentTimeMillis()
        db.protectedModulesDao().softDeletePendingLeave(leaveId, actorName, reason, now)
        db.protectedModulesDao().insertLeaveAuditLog(
            LeaveAuditLogEntity(
                applicationId = leaveId,
                action = "DELETE",
                actorName = actorName,
                actorRole = "teacher",
                summary = "Soft-deleted pending leave for audit trail: $reason",
                timestampMillis = now
            )
        )
    }

    suspend fun decideLeave(
        leaveId: String,
        approved: Boolean,
        actorName: String = "Mohd Yousuf Wani",
        remarks: String = "",
        rejectionReason: String = ""
    ) {
        val status = if (approved) "Approved" else "Rejected"
        val today = SimpleDateFormat("yyyy-MM-dd", Locale.US).format(Calendar.getInstance().time)
        val now = System.currentTimeMillis()
        db.protectedModulesDao().recordLeaveDecision(
            leaveId = leaveId,
            status = status,
            remarks = remarks,
            rejectionReason = if (approved) "" else rejectionReason,
            decidedBy = actorName,
            decisionDate = today,
            nowMillis = now
        )
        db.protectedModulesDao().insertLeaveAuditLog(
            LeaveAuditLogEntity(
                applicationId = leaveId,
                action = if (approved) "APPROVE" else "REJECT",
                actorName = actorName,
                actorRole = "headmaster",
                summary = if (approved) "Approved by $actorName: $remarks" else "Rejected by $actorName: $rejectionReason",
                timestampMillis = now
            )
        )
    }

    suspend fun markLeaveUnderReview(leaveId: String, actorName: String, remarks: String) {
        val today = SimpleDateFormat("yyyy-MM-dd", Locale.US).format(Calendar.getInstance().time)
        val now = System.currentTimeMillis()
        db.protectedModulesDao().recordLeaveDecision(
            leaveId = leaveId,
            status = "Under_Review",
            remarks = remarks,
            rejectionReason = "",
            decidedBy = actorName,
            decisionDate = today,
            nowMillis = now
        )
        db.protectedModulesDao().insertLeaveAuditLog(
            LeaveAuditLogEntity(
                applicationId = leaveId,
                action = "REVIEW",
                actorName = actorName,
                actorRole = "headmaster",
                summary = "Marked Under Review by $actorName: $remarks",
                timestampMillis = now
            )
        )
    }

    suspend fun seedOfflineRecordsIfEmpty() {
        if (db.studentDao().count() == 0) {
            db.studentDao().upsertAll(
                listOf(
                    StudentEntity(
                        id = "SM-2026-001",
                        admissionNumber = "ADM-2026-001",
                        fullName = "Aarav Sharma",
                        fatherName = "Rajesh Sharma",
                        classNumber = "5",
                        section = "A",
                        rollNumber = 1,
                        mobileNumber = "9810001101",
                        attendancePct = 94
                    ),
                    StudentEntity(
                        id = "SM-2026-002",
                        admissionNumber = "ADM-2026-002",
                        fullName = "Bilal Ahmed",
                        fatherName = "Ghulam Nabi",
                        classNumber = "5",
                        section = "A",
                        rollNumber = 2,
                        mobileNumber = "9810001102",
                        attendancePct = 71
                    ),
                    StudentEntity(
                        id = "SM-2026-003",
                        admissionNumber = "ADM-2026-003",
                        fullName = "Inaya Mir",
                        fatherName = "Tariq Mir",
                        classNumber = "5",
                        section = "A",
                        rollNumber = 3,
                        mobileNumber = "9810001103",
                        attendancePct = 96
                    ),
                    StudentEntity(
                        id = "SM-2026-004",
                        admissionNumber = "ADM-2026-004",
                        fullName = "Zoya Khan",
                        fatherName = "Imran Khan",
                        classNumber = "6",
                        section = "B",
                        rollNumber = 1,
                        mobileNumber = "9810001104",
                        attendancePct = 88
                    ),
                    StudentEntity(
                        id = "SM-2026-005",
                        admissionNumber = "ADM-2026-005",
                        fullName = "Farhan Lone",
                        fatherName = "Mushtaq Lone",
                        classNumber = "7",
                        section = "A",
                        rollNumber = 4,
                        mobileNumber = "9810001105",
                        attendancePct = 68
                    )
                )
            )
        }

        if (db.teacherDao().count() == 0) {
            db.teacherDao().upsertAll(
                listOf(
                    TeacherEntity(
                        id = "TCH-2026-001",
                        employeeCode = "KHYEDU 00220000",
                        fullName = "Nazir Ahmad Dar",
                        designation = "Senior Teacher",
                        subject = "Mathematics & Science",
                        assignedClass = "5-A",
                        mobileNumber = "9419002201",
                        leaveBalanceDays = 10
                    ),
                    TeacherEntity(
                        id = "TCH-2026-002",
                        employeeCode = "JKEDU-T-108",
                        fullName = "Shabnam Jan",
                        designation = "Language Teacher",
                        subject = "Urdu & English",
                        assignedClass = "6-B",
                        mobileNumber = "9419002202",
                        leaveBalanceDays = 12
                    ),
                    TeacherEntity(
                        id = "TCH-2026-003",
                        employeeCode = "JKEDU-H-001",
                        fullName = "Mohd Yousuf Wani",
                        designation = "Headmaster",
                        subject = "Administration & Social Studies",
                        assignedClass = "All Classes",
                        mobileNumber = "9419002203",
                        leaveBalanceDays = 15
                    )
                )
            )
        }

        if (db.protectedModulesDao().countLeaves() == 0) {
            db.protectedModulesDao().upsertLeaves(
                listOf(
                    TeacherLeaveEntity(
                        id = "LV-2026-101",
                        teacherId = "TCH-2026-001",
                        teacherName = "Nazir Ahmad Dar",
                        leaveType = "Casual Leave",
                        startDate = "2026-11-18",
                        endDate = "2026-11-19",
                        totalDays = 2,
                        reason = "Medical appointment in Srinagar",
                        status = "Pending"
                    ),
                    TeacherLeaveEntity(
                        id = "LV-2026-102",
                        teacherId = "TCH-2026-002",
                        teacherName = "Shabnam Jan",
                        leaveType = "Earned Leave",
                        startDate = "2026-11-24",
                        endDate = "2026-11-25",
                        totalDays = 2,
                        reason = "Family obligation (substitutes arranged)",
                        status = "Pending"
                    )
                )
            )
        }

        if (db.protectedModulesDao().countExaminations() == 0) {
            db.protectedModulesDao().upsertExaminations(
                listOf(
                    ExaminationEntity(
                        id = "EX-2026-T1",
                        name = "Term 1 Formative & Summative Assessment",
                        term = "Term 1",
                        startDate = "2026-10-15",
                        endDate = "2026-10-25",
                        classesCsv = "1, 2, 3, 4, 5, 6, 7, 8",
                        maxMarks = 100,
                        averageScorePct = 82,
                        status = "Completed"
                    ),
                    ExaminationEntity(
                        id = "EX-2026-T2",
                        name = "Winter Pre-Board & Unit Assessment",
                        term = "Term 2",
                        startDate = "2026-11-28",
                        endDate = "2026-12-06",
                        classesCsv = "5, 6, 7, 8",
                        maxMarks = 100,
                        averageScorePct = 0,
                        status = "Scheduled"
                    )
                )
            )
        }

        if (db.teacherAttendanceDao().count() == 0) {
            val fmt = SimpleDateFormat("yyyy-MM-dd", Locale.US)
            val cal = Calendar.getInstance()
            val seededAttendance = mutableListOf<TeacherAttendanceEntity>()
            for (dayOffset in 6 downTo 0) {
                val dayCal = (cal.clone() as Calendar).apply { add(Calendar.DAY_OF_YEAR, -dayOffset) }
                val dateIso = fmt.format(dayCal.time)
                val isRecentPending = dayOffset <= 1
                seededAttendance.add(
                    TeacherAttendanceEntity(
                        id = "ATT-SEED-T1-$dateIso",
                        teacherId = "TCH-2026-001",
                        teacherName = "Nazir Ahmad Dar",
                        dateIso = dateIso,
                        status = "Present",
                        syncStatus = if (isRecentPending) "PENDING" else "SYNCED",
                        lastModified = dayCal.timeInMillis
                    )
                )
                if (dayOffset == 0 || dayOffset == 2) {
                    seededAttendance.add(
                        TeacherAttendanceEntity(
                            id = "ATT-SEED-T2-$dateIso",
                            teacherId = "TCH-2026-002",
                            teacherName = "Shabnam Jan",
                            dateIso = dateIso,
                            status = "Present",
                            syncStatus = if (dayOffset == 0) "PENDING" else "SYNCED",
                            lastModified = dayCal.timeInMillis
                        )
                    )
                }
            }
            db.teacherAttendanceDao().upsertAll(seededAttendance)
        }

        if (db.hpcCardDao().count() == 0) {
            db.hpcCardDao().upsertAll(
                listOf(
                    HpcCardEntity(
                        hpcId = "HPC-2026-001",
                        fullName = "Aarav Sharma",
                        fatherName = "Rajesh Sharma",
                        dob = "2015-05-14",
                        gender = "Male",
                        address = "Pamposh Colony, Palapora Zone, Iddgah",
                        mobileNumber = "9810001101",
                        bloodGroup = "B+",
                        includeQr = true,
                        templateId = "royal_indigo",
                        schoolName = "Govt Middle School Pamposh Colony",
                        headmasterName = "Mohd Yousuf Wani"
                    ),
                    HpcCardEntity(
                        hpcId = "HPC-2026-003",
                        fullName = "Inaya Mir",
                        fatherName = "Tariq Mir",
                        dob = "2015-09-22",
                        gender = "Female",
                        address = "Pamposh Colony, Palapora Zone, Iddgah",
                        mobileNumber = "9810001103",
                        bloodGroup = "O+",
                        includeQr = true,
                        templateId = "kashmir_emerald",
                        schoolName = "Govt Middle School Pamposh Colony",
                        headmasterName = "Mohd Yousuf Wani"
                    )
                )
            )
        }
    }
}
