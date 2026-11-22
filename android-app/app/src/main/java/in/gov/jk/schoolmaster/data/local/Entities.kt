package `in`.gov.jk.schoolmaster.data.local

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "students")
data class StudentEntity(
    @PrimaryKey val id: String,
    val admissionNumber: String,
    val fullName: String,
    val fatherName: String,
    val classNumber: String,
    val section: String,
    val rollNumber: Int,
    val mobileNumber: String,
    val status: String = "Active",
    val attendancePct: Int = 92,
    val updatedAtMillis: Long = System.currentTimeMillis()
)

@Entity(tableName = "teachers")
data class TeacherEntity(
    @PrimaryKey val id: String,
    val employeeCode: String,
    val fullName: String,
    val designation: String,
    val subject: String,
    val assignedClass: String,
    val mobileNumber: String,
    val leaveBalanceDays: Int = 12,
    val status: String = "Active",
    val latestHoiRemarks: String = "",
    val updatedAtMillis: Long = System.currentTimeMillis()
)

@Entity(tableName = "teacher_leaves")
data class TeacherLeaveEntity(
    @PrimaryKey val id: String, // Application ID
    val teacherId: String, // Teacher ID
    val teacherName: String,
    val leaveType: String, // Casual_Leave, Medical_Leave, etc.
    val startDate: String, // From Date (YYYY-MM-DD)
    val endDate: String, // To Date (YYYY-MM-DD)
    val totalDays: Int,
    val reason: String,
    val status: String = "Pending", // Pending, Under_Review, Approved, Rejected
    val employeeId: String = "", // CPIS / Employee ID
    val applicationDate: String = "",
    val medicalDocumentUrl: String = "", // Uploaded PDF, JPG, PNG URI/path
    val headmasterRemarks: String = "",
    val rejectionReason: String = "",
    val decidedBy: String = "", // Approved / Rejected By
    val decisionDate: String = "", // Approval / Rejection Date
    val createdAtMillis: Long = System.currentTimeMillis(),
    val updatedAtMillis: Long = System.currentTimeMillis(),
    val deletedStatus: String = "Active", // Active or Deleted (audit record preserved)
    val deletedBy: String = "",
    val deletionReason: String = ""
)

@Entity(tableName = "leave_audit_logs")
data class LeaveAuditLogEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val applicationId: String,
    val action: String, // CREATE, EDIT, UPLOAD_DOC, REVIEW, APPROVE, REJECT, DELETE
    val actorName: String,
    val actorRole: String,
    val summary: String,
    val timestampMillis: Long = System.currentTimeMillis()
)

@Entity(tableName = "examinations")
data class ExaminationEntity(
    @PrimaryKey val id: String,
    val name: String,
    val term: String,
    val startDate: String,
    val endDate: String,
    val classesCsv: String,
    val maxMarks: Int,
    val averageScorePct: Int,
    val status: String = "Scheduled"
)

@Entity(tableName = "biometric_audit_logs")
data class BiometricAuditLogEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val moduleName: String = "Teacher Leave & Examinations",
    val actorName: String = "Mohd Yousuf Wani",
    val eventType: String = "SUCCESS", // "SUCCESS" or "FAILURE"
    val outcome: String = eventType, // Backwards-compatible alias ("SUCCESS" or "FAILED"/"FAILURE")
    val authMethod: String = "Biometric Sensor",
    val description: String = "Authentication attempt recorded",
    val detailMessage: String = description,
    val timestampMillis: Long = System.currentTimeMillis()
)

@Entity(tableName = "teacher_attendance")
data class TeacherAttendanceEntity(
    @PrimaryKey val id: String,
    val teacherId: String,
    val teacherName: String,
    val dateIso: String, // YYYY-MM-DD
    val status: String = "Present", // Present, Absent, Casual Leave (CL), Medical Leave (ML), On Duty (OD), Half Day, Late Arrival, Other
    val arrivalTime: String = "09:00 AM",
    val departureTime: String = "04:00 PM",
    val designation: String = "",
    val remarksByHoi: String = "",
    val updatedBy: String = "",
    val changeHistoryJson: String = "[]",
    val syncStatus: String = "PENDING", // "PENDING" or "SYNCED"
    val lastModified: Long = System.currentTimeMillis()
)

@Entity(tableName = "scanner_history")
data class ScannerHistoryEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val studentId: String,
    val studentName: String,
    val admissionNumber: String,
    val classSection: String,
    val rawQrPayload: String,
    val syncStatus: String = "PENDING", // "PENDING" or "SYNCED"
    val scannedAtMillis: Long = System.currentTimeMillis()
)

@Entity(tableName = "hpc_cards")
data class HpcCardEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val hpcId: String,
    val fullName: String,
    val fatherName: String,
    val dob: String,
    val gender: String,
    val address: String,
    val mobileNumber: String,
    val bloodGroup: String = "",
    val photoPath: String = "",
    val includeQr: Boolean = true,
    val templateId: String = "royal_indigo", // "royal_indigo", "kashmir_emerald", "ivory_official"
    val schoolName: String = "Govt Middle School Pamposh Colony",
    val headmasterName: String = "Mohd Yousuf Wani",
    val updatedAtMillis: Long = System.currentTimeMillis()
)
