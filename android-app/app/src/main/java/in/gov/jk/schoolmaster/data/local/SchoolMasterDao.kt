package `in`.gov.jk.schoolmaster.data.local

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import kotlinx.coroutines.flow.Flow

@Dao
interface StudentDao {
    @Query("SELECT * FROM students ORDER BY CAST(classNumber AS INTEGER) ASC, section ASC, rollNumber ASC")
    fun observeAllStudents(): Flow<List<StudentEntity>>

    @Query(
        """
        SELECT * FROM students
        WHERE fullName LIKE '%' || :query || '%'
           OR admissionNumber LIKE '%' || :query || '%'
           OR classNumber LIKE '%' || :query || '%'
        ORDER BY CAST(classNumber AS INTEGER) ASC, section ASC, rollNumber ASC
        """
    )
    fun searchStudents(query: String): Flow<List<StudentEntity>>

    @Query("SELECT * FROM students WHERE admissionNumber = :code OR id = :code LIMIT 1")
    suspend fun findByAdmissionOrId(code: String): StudentEntity?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsertAll(students: List<StudentEntity>)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsert(student: StudentEntity)

    @Query("DELETE FROM students WHERE id = :id")
    suspend fun deleteById(id: String)

    @Query("SELECT COUNT(*) FROM students")
    suspend fun count(): Int
}

@Dao
interface TeacherDao {
    @Query("SELECT * FROM teachers ORDER BY fullName ASC")
    fun observeAllTeachers(): Flow<List<TeacherEntity>>

    @Query(
        """
        SELECT * FROM teachers
        WHERE fullName LIKE '%' || :query || '%'
           OR employeeCode LIKE '%' || :query || '%'
           OR subject LIKE '%' || :query || '%'
        ORDER BY fullName ASC
        """
    )
    fun searchTeachers(query: String): Flow<List<TeacherEntity>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsertAll(teachers: List<TeacherEntity>)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsert(teacher: TeacherEntity)

    @Query("SELECT COUNT(*) FROM teachers")
    suspend fun count(): Int
}

@Dao
interface ProtectedModulesDao {
    @Query("SELECT * FROM teacher_leaves WHERE deletedStatus = 'Active' ORDER BY startDate DESC")
    fun observeLeaves(): Flow<List<TeacherLeaveEntity>>

    @Query("SELECT * FROM teacher_leaves ORDER BY updatedAtMillis DESC")
    fun observeAllLeavesIncludingDeleted(): Flow<List<TeacherLeaveEntity>>

    @Query("SELECT * FROM teacher_leaves WHERE deletedStatus = 'Active' AND teacherId = :teacherId ORDER BY startDate DESC")
    fun observeLeavesByTeacher(teacherId: String): Flow<List<TeacherLeaveEntity>>

    @Query(
        """
        SELECT * FROM teacher_leaves
        WHERE deletedStatus = 'Active'
          AND status != 'Rejected'
          AND teacherId = :teacherId
          AND id != :excludeId
          AND startDate <= :endDate
          AND endDate >= :startDate
        LIMIT 1
        """
    )
    suspend fun findOverlappingLeave(
        teacherId: String,
        startDate: String,
        endDate: String,
        excludeId: String = ""
    ): TeacherLeaveEntity?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsertLeaves(items: List<TeacherLeaveEntity>)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertLeave(item: TeacherLeaveEntity)

    @Query("UPDATE teacher_leaves SET status = :status, updatedAtMillis = :nowMillis WHERE id = :leaveId")
    suspend fun updateLeaveStatus(
        leaveId: String,
        status: String,
        nowMillis: Long = System.currentTimeMillis()
    )

    @Query(
        """
        UPDATE teacher_leaves
        SET status = :status,
            headmasterRemarks = :remarks,
            rejectionReason = :rejectionReason,
            decidedBy = :decidedBy,
            decisionDate = :decisionDate,
            updatedAtMillis = :nowMillis
        WHERE id = :leaveId
        """
    )
    suspend fun recordLeaveDecision(
        leaveId: String,
        status: String,
        remarks: String,
        rejectionReason: String,
        decidedBy: String,
        decisionDate: String,
        nowMillis: Long = System.currentTimeMillis()
    )

    @Query(
        """
        UPDATE teacher_leaves
        SET deletedStatus = 'Deleted',
            deletedBy = :deletedBy,
            deletionReason = :reason,
            updatedAtMillis = :nowMillis
        WHERE id = :leaveId AND status = 'Pending'
        """
    )
    suspend fun softDeletePendingLeave(
        leaveId: String,
        deletedBy: String,
        reason: String,
        nowMillis: Long = System.currentTimeMillis()
    )

    @Query("SELECT * FROM leave_audit_logs ORDER BY timestampMillis DESC")
    fun observeLeaveAuditLogs(): Flow<List<LeaveAuditLogEntity>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertLeaveAuditLog(entry: LeaveAuditLogEntity)

    @Query("SELECT COUNT(*) FROM teacher_leaves")
    suspend fun countLeaves(): Int

    @Query("SELECT * FROM examinations ORDER BY startDate ASC")
    fun observeExaminations(): Flow<List<ExaminationEntity>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsertExaminations(items: List<ExaminationEntity>)

    @Query("SELECT COUNT(*) FROM examinations")
    suspend fun countExaminations(): Int

    @Query("SELECT * FROM biometric_audit_logs ORDER BY timestampMillis DESC, id DESC LIMIT 5")
    fun observeRecentBiometricAuditLogs(): Flow<List<BiometricAuditLogEntity>>

    @Query("SELECT * FROM biometric_audit_logs ORDER BY timestampMillis DESC, id DESC")
    fun observeAllBiometricAuditLogs(): Flow<List<BiometricAuditLogEntity>>

    @Query("SELECT * FROM biometric_audit_logs ORDER BY timestampMillis DESC, id DESC")
    suspend fun getAllBiometricAuditLogsOnce(): List<BiometricAuditLogEntity>

    @Query(
        """
        SELECT * FROM biometric_audit_logs
        WHERE (:query = '' OR actorName LIKE '%' || :query || '%'
            OR description LIKE '%' || :query || '%'
            OR detailMessage LIKE '%' || :query || '%'
            OR eventType LIKE '%' || :query || '%')
          AND timestampMillis >= :startMillis
          AND timestampMillis <= :endMillis
        ORDER BY timestampMillis DESC, id DESC
        """
    )
    fun searchBiometricAuditLogs(
        query: String,
        startMillis: Long,
        endMillis: Long
    ): Flow<List<BiometricAuditLogEntity>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertBiometricAuditLog(entry: BiometricAuditLogEntity)

    @Query("SELECT COUNT(*) FROM biometric_audit_logs")
    suspend fun countBiometricAuditLogs(): Int
}

@Dao
interface TeacherAttendanceDao {
    @Query("SELECT * FROM teacher_attendance ORDER BY dateIso DESC, lastModified DESC")
    fun observeAllAttendance(): Flow<List<TeacherAttendanceEntity>>

    @Query("SELECT * FROM teacher_attendance WHERE dateIso = :dateIso ORDER BY teacherName ASC")
    fun observeAttendanceForDate(dateIso: String): Flow<List<TeacherAttendanceEntity>>

    @Query("SELECT * FROM teacher_attendance WHERE teacherId = :teacherId ORDER BY dateIso DESC")
    fun observeAttendanceForTeacher(teacherId: String): Flow<List<TeacherAttendanceEntity>>

    @Query("SELECT COUNT(*) FROM teacher_attendance WHERE LOWER(syncStatus) = 'pending'")
    fun observePendingSyncCount(): Flow<Int>

    @Query("SELECT * FROM teacher_attendance WHERE LOWER(syncStatus) = 'pending' ORDER BY dateIso DESC, lastModified DESC")
    fun observePendingAttendance(): Flow<List<TeacherAttendanceEntity>>

    @Query("SELECT * FROM teacher_attendance WHERE LOWER(syncStatus) = 'pending' ORDER BY dateIso DESC, lastModified DESC")
    suspend fun getPendingAttendanceOnce(): List<TeacherAttendanceEntity>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsertAll(items: List<TeacherAttendanceEntity>)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsert(item: TeacherAttendanceEntity)

    @Query("UPDATE teacher_attendance SET syncStatus = 'SYNCED', lastModified = :nowMillis WHERE LOWER(syncStatus) = 'pending'")
    suspend fun markAllPendingSynced(nowMillis: Long)

    @Query("SELECT COUNT(*) FROM teacher_attendance")
    suspend fun count(): Int
}

@Dao
interface ScannerHistoryDao {
    @Query("SELECT * FROM scanner_history ORDER BY scannedAtMillis DESC, id DESC")
    fun observeHistory(): Flow<List<ScannerHistoryEntity>>

    @Query("SELECT COUNT(*) FROM scanner_history WHERE LOWER(syncStatus) = 'pending'")
    fun observePendingScanCount(): Flow<Int>

    @Query("UPDATE scanner_history SET syncStatus = 'SYNCED' WHERE LOWER(syncStatus) = 'pending'")
    suspend fun markAllPendingScansSynced()

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertScan(entry: ScannerHistoryEntity)

    @Query("DELETE FROM scanner_history")
    suspend fun clearAll()
}

@Dao
interface HpcCardDao {
    @Query("SELECT * FROM hpc_cards ORDER BY updatedAtMillis DESC, id DESC")
    fun observeAllCards(): Flow<List<HpcCardEntity>>

    @Query(
        """
        SELECT * FROM hpc_cards
        WHERE fullName LIKE '%' || :query || '%'
           OR hpcId LIKE '%' || :query || '%'
        ORDER BY updatedAtMillis DESC, id DESC
        """
    )
    fun searchCards(query: String): Flow<List<HpcCardEntity>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsert(card: HpcCardEntity): Long

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsertAll(cards: List<HpcCardEntity>)

    @Query("DELETE FROM hpc_cards WHERE id = :id")
    suspend fun deleteById(id: Long)

    @Query("SELECT COUNT(*) FROM hpc_cards")
    suspend fun count(): Int
}
