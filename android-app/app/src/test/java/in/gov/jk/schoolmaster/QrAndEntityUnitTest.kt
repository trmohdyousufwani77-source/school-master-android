package `in`.gov.jk.schoolmaster

import `in`.gov.jk.schoolmaster.data.local.BiometricAuditLogEntity
import `in`.gov.jk.schoolmaster.data.local.HpcCardEntity
import `in`.gov.jk.schoolmaster.data.local.ScannerHistoryEntity
import `in`.gov.jk.schoolmaster.data.local.StudentEntity
import `in`.gov.jk.schoolmaster.data.local.TeacherAttendanceEntity
import `in`.gov.jk.schoolmaster.data.local.TeacherEntity
import `in`.gov.jk.schoolmaster.qr.QrCodeGenerator
import `in`.gov.jk.schoolmaster.security.BiometricAuditCsvExporter
import `in`.gov.jk.schoolmaster.security.ScannerHistoryCsvExporter
import `in`.gov.jk.schoolmaster.updates.GitHubBuildReleaseClient
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Test

class QrAndEntityUnitTest {

    @Test
    fun studentQrPayloadMatchesAttendanceScannerSevenFieldFormat() {
        val student = StudentEntity(
            id = "SM-2026-001",
            admissionNumber = "ADM-2026-001",
            fullName = "Aarav Sharma",
            fatherName = "Rajesh Sharma",
            classNumber = "5",
            section = "A",
            rollNumber = 1,
            mobileNumber = "9810001101"
        )

        val payload = QrCodeGenerator.buildStudentQrPayload(student)

        assertTrue(payload.contains("1. Student Name: Aarav Sharma"))
        assertTrue(payload.contains("4. Admission Number: ADM-2026-001"))
        assertTrue(payload.contains("6. Student ID: SM-2026-001"))
    }

    @Test
    fun teacherQrPayloadIncludesEmployeeCodeAndTeacherId() {
        val teacher = TeacherEntity(
            id = "TCH-2026-001",
            employeeCode = "JKEDU-T-104",
            fullName = "Nazir Ahmad Dar",
            designation = "Senior Teacher",
            subject = "Mathematics & Science",
            assignedClass = "5-A",
            mobileNumber = "9419002201"
        )

        val payload = QrCodeGenerator.buildTeacherQrPayload(teacher)

        assertTrue(payload.contains("1. Staff Name: Nazir Ahmad Dar"))
        assertTrue(payload.contains("2. Employee Code: JKEDU-T-104"))
        assertTrue(payload.contains("6. Teacher ID: TCH-2026-001"))
    }

    @Test
    fun biometricAuditLogTracksSuccessAndFailureAndRespectsLastFiveWindow() {
        val entries = (1..7).map { idx ->
            BiometricAuditLogEntity(
                id = idx.toLong(),
                moduleName = "Teacher Leave & Examinations",
                actorName = "Mohd Yousuf Wani",
                eventType = if (idx % 2 == 0) "SUCCESS" else "FAILURE",
                outcome = if (idx % 2 == 0) "SUCCESS" else "FAILED",
                authMethod = if (idx % 2 == 0) "Biometric Sensor" else "Device PIN / Pattern",
                description = "Attempt #$idx",
                detailMessage = "Attempt #$idx",
                timestampMillis = 1_700_000_000_000L + idx * 1_000L
            )
        }

        val lastFiveNewestFirst = entries
            .sortedByDescending { it.timestampMillis }
            .take(5)

        assertEquals(5, lastFiveNewestFirst.size)
        assertEquals(7L, lastFiveNewestFirst.first().id)
        assertEquals(3L, lastFiveNewestFirst.last().id)
        assertEquals("FAILED", lastFiveNewestFirst.first().outcome)
        assertEquals("FAILURE", lastFiveNewestFirst.first().eventType)
        assertEquals("SUCCESS", lastFiveNewestFirst[1].outcome)
    }

    @Test
    fun biometricAuditCsvExporterFormatsHeaderAndEscapesRows() {
        val logs = listOf(
            BiometricAuditLogEntity(
                id = 11L,
                actorName = "Mohd Yousuf Wani",
                eventType = "SUCCESS",
                authMethod = "Biometric Sensor",
                moduleName = "Teacher Leave",
                description = "Approved leave for \"Nazir Ahmad Dar\"",
                timestampMillis = 1_700_000_000_000L
            )
        )

        val csv = BiometricAuditCsvExporter.formatAuditLogsToCsv(logs)
        val lines = csv.lines()

        assertEquals(2, lines.size)
        assertTrue(lines.first().startsWith("ID,Timestamp,Actor Name,Event Type,Auth Method,Module,Description"))
        assertTrue(lines[1].contains("\"Mohd Yousuf Wani\""))
        assertTrue(lines[1].contains("\"SUCCESS\""))
        assertTrue(lines[1].contains("\"\"Nazir Ahmad Dar\"\""))
    }

    @Test
    fun scannerHistoryCsvExporterFormatsStudentScansAccurately() {
        val scans = listOf(
            ScannerHistoryEntity(
                id = 5L,
                studentId = "SM-2026-001",
                studentName = "Aarav Sharma",
                admissionNumber = "ADM-2026-001",
                classSection = "Class 5-A",
                rawQrPayload = "ADM-2026-001",
                syncStatus = "PENDING",
                scannedAtMillis = 1_700_000_000_000L
            )
        )

        val csv = ScannerHistoryCsvExporter.formatScannerHistoryToCsv(scans)
        val lines = csv.lines()

        assertEquals(2, lines.size)
        assertTrue(lines.first().startsWith("ID,Timestamp,Student Name,Admission Number,Class & Section,Sync Status,QR Payload"))
        assertTrue(lines[1].contains("\"Aarav Sharma\""))
        assertTrue(lines[1].contains("\"ADM-2026-001\""))
        assertTrue(lines[1].contains("\"PENDING\""))
    }

    @Test
    fun teacherAttendancePendingSyncAndHpcCardSearchWorkAccurately() {
        val attendance = listOf(
            TeacherAttendanceEntity("A1", "TCH-1", "Nazir Ahmad Dar", "2026-11-19", "Present", syncStatus = "PENDING"),
            TeacherAttendanceEntity("A2", "TCH-2", "Shabnam Jan", "2026-11-19", "Present", syncStatus = "SYNCED"),
            TeacherAttendanceEntity("A3", "TCH-3", "Mohd Yousuf Wani", "2026-11-20", "Present", syncStatus = "PENDING")
        )
        assertEquals(2, attendance.count { it.syncStatus == "PENDING" })

        val cards = listOf(
            HpcCardEntity(
                id = 1L,
                hpcId = "HPC-2026-001",
                fullName = "Aarav Sharma",
                fatherName = "Rajesh Sharma",
                dob = "2015-05-14",
                gender = "Male",
                address = "Pamposh Colony, Srinagar",
                mobileNumber = "9810001101",
                headmasterName = "Mohd Yousuf Wani"
            ),
            HpcCardEntity(
                id = 2L,
                hpcId = "HPC-2026-003",
                fullName = "Inaya Mir",
                fatherName = "Tariq Mir",
                dob = "2015-09-22",
                gender = "Female",
                address = "Pamposh Colony, Srinagar",
                mobileNumber = "9810001103",
                headmasterName = "Mohd Yousuf Wani"
            )
        )

        val searchByName = cards.filter { it.fullName.contains("inaya", ignoreCase = true) }
        val searchByReg = cards.filter { it.hpcId.contains("001", ignoreCase = true) }
        assertEquals(1, searchByName.size)
        assertEquals("Inaya Mir", searchByName.first().fullName)
        assertEquals(1, searchByReg.size)
        assertEquals("Mohd Yousuf Wani", searchByReg.first().headmasterName)
    }

    @Test
    fun githubReleaseParserExtractsLatestApkArtifactUrl() {
        val slug = GitHubBuildReleaseClient.normalizeRepoSlug("https://github.com/jk-edu/school-master.git")
        assertEquals("jk-edu/school-master", slug)

        val sampleReleaseJson = """
            {
              "tag_name": "v1.0.4-release.12",
              "name": "School Master Release APK (v1.0.4-release.12)",
              "html_url": "https://github.com/jk-edu/school-master/releases/tag/v1.0.4-release.12",
              "published_at": "2026-11-19T10:15:00Z",
              "assets": [
                {
                  "name": "SchoolMaster-release-latest.apk.sha256",
                  "size": 96,
                  "browser_download_url": "https://github.com/jk-edu/school-master/releases/download/v1.0.4-release.12/SchoolMaster-release-latest.apk.sha256"
                },
                {
                  "name": "SchoolMaster-release-latest.apk",
                  "size": 6291456,
                  "browser_download_url": "https://github.com/jk-edu/school-master/releases/download/v1.0.4-release.12/SchoolMaster-release-latest.apk"
                }
              ]
            }
        """.trimIndent()

        val artifact = GitHubBuildReleaseClient.parseLatestReleaseJson(slug, sampleReleaseJson)
        assertNotNull(artifact)
        assertEquals("Release", artifact!!.buildMode)
        assertEquals("v1.0.4-release.12", artifact.releaseTag)
        assertEquals("SchoolMaster-release-latest.apk", artifact.assetName)
        assertEquals(
            "https://github.com/jk-edu/school-master/releases/download/v1.0.4-release.12/SchoolMaster-release-latest.apk",
            artifact.downloadUrl
        )
        assertEquals("6.00 MB", GitHubBuildReleaseClient.formatFileSize(artifact.sizeBytes))
    }

    @Test
    fun portalUrlNormalizerAcceptsHttpsAndBlocksUnsafeSchemes() {
        assertEquals(
            "https://ais-pre-nu5yauvtrpwkfmgp7wl44o-370699773036.asia-northeast1.run.app",
            `in`.gov.jk.schoolmaster.security.PortalConfigStore.normalizePortalUrl(
                "https://ais-pre-nu5yauvtrpwkfmgp7wl44o-370699773036.asia-northeast1.run.app/"
            )
        )
        assertEquals(
            "",
            `in`.gov.jk.schoolmaster.security.PortalConfigStore.normalizePortalUrl("javascript:alert(1)")
        )
        assertEquals(
            "",
            `in`.gov.jk.schoolmaster.security.PortalConfigStore.normalizePortalUrl("file:///etc/passwd")
        )
    }
}
