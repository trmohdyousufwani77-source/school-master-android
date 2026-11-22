package `in`.gov.jk.schoolmaster.qr

import android.graphics.Bitmap
import android.graphics.Color
import androidx.compose.ui.graphics.ImageBitmap
import androidx.compose.ui.graphics.asImageBitmap
import com.google.zxing.BarcodeFormat
import com.google.zxing.EncodeHintType
import com.google.zxing.qrcode.QRCodeWriter
import com.google.zxing.qrcode.decoder.ErrorCorrectionLevel
import `in`.gov.jk.schoolmaster.data.local.StudentEntity
import `in`.gov.jk.schoolmaster.data.local.TeacherEntity

object QrCodeGenerator {

    fun buildStudentQrPayload(student: StudentEntity): String {
        return listOf(
            "1. Student Name: ${student.fullName}",
            "2. Father Name: ${student.fatherName}",
            "3. Class & Section: Class ${student.classNumber}-${student.section}",
            "4. Admission Number: ${student.admissionNumber}",
            "5. Roll Number: ${student.rollNumber}",
            "6. Student ID: ${student.id}",
            "7. Contact: ${student.mobileNumber}"
        ).joinToString("\n")
    }

    fun buildTeacherQrPayload(teacher: TeacherEntity): String {
        return listOf(
            "1. Staff Name: ${teacher.fullName}",
            "2. Employee Code: ${teacher.employeeCode}",
            "3. Designation: ${teacher.designation}",
            "4. Subject: ${teacher.subject}",
            "5. Assigned Class: ${teacher.assignedClass}",
            "6. Teacher ID: ${teacher.id}",
            "7. Contact: ${teacher.mobileNumber}"
        ).joinToString("\n")
    }

    fun encodeQrBitmap(payload: String, sizePx: Int = 512): Bitmap? {
        val cleaned = payload.trim()
        if (cleaned.isEmpty() || sizePx <= 0) return null

        val hints = mapOf(
            EncodeHintType.ERROR_CORRECTION to ErrorCorrectionLevel.M,
            EncodeHintType.MARGIN to 2,
            EncodeHintType.CHARACTER_SET to "UTF-8"
        )

        val bitMatrix = QRCodeWriter().encode(
            cleaned,
            BarcodeFormat.QR_CODE,
            sizePx,
            sizePx,
            hints
        )

        val pixels = IntArray(sizePx * sizePx)
        for (y in 0 until sizePx) {
            val offset = y * sizePx
            for (x in 0 until sizePx) {
                pixels[offset + x] = if (bitMatrix.get(x, y)) Color.BLACK else Color.WHITE
            }
        }

        return Bitmap.createBitmap(sizePx, sizePx, Bitmap.Config.ARGB_8888).apply {
            setPixels(pixels, 0, sizePx, 0, 0, sizePx, sizePx)
        }
    }

    fun encodeQrImageBitmap(payload: String, sizePx: Int = 512): ImageBitmap? {
        return encodeQrBitmap(payload, sizePx)?.asImageBitmap()
    }
}
