# Keep Room, BiometricPrompt, and ZXing classes intact when minification is enabled
-keep class in.gov.jk.schoolmaster.data.local.** { *; }
-keep class androidx.biometric.** { *; }
-keep class com.google.zxing.** { *; }
