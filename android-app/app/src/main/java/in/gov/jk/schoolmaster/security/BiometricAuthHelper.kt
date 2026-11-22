package `in`.gov.jk.schoolmaster.security

import android.os.Build
import androidx.biometric.BiometricManager
import androidx.biometric.BiometricPrompt
import androidx.core.content.ContextCompat
import androidx.fragment.app.FragmentActivity

sealed interface BiometricAvailability {
    data object Available : BiometricAvailability
    data class Unavailable(val reason: String) : BiometricAvailability
}

object BiometricAuthHelper {

    fun checkAvailability(activity: FragmentActivity): BiometricAvailability {
        val manager = BiometricManager.from(activity)
        val authenticators = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            BiometricManager.Authenticators.BIOMETRIC_STRONG or
                BiometricManager.Authenticators.BIOMETRIC_WEAK or
                BiometricManager.Authenticators.DEVICE_CREDENTIAL
        } else {
            BiometricManager.Authenticators.BIOMETRIC_WEAK
        }

        return when (manager.canAuthenticate(authenticators)) {
            BiometricManager.BIOMETRIC_SUCCESS -> BiometricAvailability.Available
            BiometricManager.BIOMETRIC_ERROR_NO_HARDWARE ->
                BiometricAvailability.Unavailable("No biometric sensor detected on this device.")
            BiometricManager.BIOMETRIC_ERROR_HW_UNAVAILABLE ->
                BiometricAvailability.Unavailable("Biometric hardware is temporarily unavailable.")
            BiometricManager.BIOMETRIC_ERROR_NONE_ENROLLED ->
                BiometricAvailability.Unavailable("No fingerprint, face, or screen lock enrolled in Android Settings.")
            else ->
                BiometricAvailability.Unavailable("Biometric authentication unavailable on this device.")
        }
    }

    fun authenticateSensitiveModule(
        activity: FragmentActivity,
        moduleTitle: String,
        subtitle: String,
        onSuccess: () -> Unit,
        onFailure: (String) -> Unit,
        onAuditEvent: (outcome: String, authMethod: String, detailMessage: String) -> Unit = { _, _, _ -> }
    ) {
        val executor = ContextCompat.getMainExecutor(activity)

        val callback = object : BiometricPrompt.AuthenticationCallback() {
            override fun onAuthenticationSucceeded(result: BiometricPrompt.AuthenticationResult) {
                super.onAuthenticationSucceeded(result)
                val authMethod = when (result.authenticationType) {
                    BiometricPrompt.AUTHENTICATION_RESULT_TYPE_BIOMETRIC -> "Biometric Sensor"
                    BiometricPrompt.AUTHENTICATION_RESULT_TYPE_DEVICE_CREDENTIAL -> "Device PIN / Pattern"
                    else -> "Biometric / Credential"
                }
                onAuditEvent("SUCCESS", authMethod, "Identity verified for $moduleTitle")
                onSuccess()
            }

            override fun onAuthenticationError(errorCode: Int, errString: CharSequence) {
                super.onAuthenticationError(errorCode, errString)
                val message = errString.toString()
                val detail = if (
                    errorCode == BiometricPrompt.ERROR_USER_CANCELED ||
                    errorCode == BiometricPrompt.ERROR_NEGATIVE_BUTTON
                ) {
                    "Authentication cancelled by user ($message)"
                } else {
                    "Auth error ($errorCode): $message"
                }
                onAuditEvent("FAILED", "Biometric / Credential", detail)
                onFailure(message)
            }

            override fun onAuthenticationFailed() {
                super.onAuthenticationFailed()
                val message = "Biometric sample not recognized. Try again."
                onAuditEvent("FAILED", "Biometric Sensor", message)
                onFailure(message)
            }
        }

        val prompt = BiometricPrompt(activity, executor, callback)

        val builder = BiometricPrompt.PromptInfo.Builder()
            .setTitle("Verify Identity — $moduleTitle")
            .setSubtitle(subtitle)

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            builder.setAllowedAuthenticators(
                BiometricManager.Authenticators.BIOMETRIC_STRONG or
                    BiometricManager.Authenticators.BIOMETRIC_WEAK or
                    BiometricManager.Authenticators.DEVICE_CREDENTIAL
            )
        } else {
            @Suppress("DEPRECATION")
            builder.setDeviceCredentialAllowed(true)
        }

        try {
            prompt.authenticate(builder.build())
        } catch (ex: Exception) {
            val errorMsg = ex.localizedMessage ?: "Unable to launch BiometricPrompt."
            onAuditEvent("FAILED", "System Prompt", errorMsg)
            onFailure(errorMsg)
        }
    }
}
