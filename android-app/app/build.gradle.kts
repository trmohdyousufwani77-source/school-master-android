plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    id("org.jetbrains.kotlin.plugin.compose")
    id("com.google.devtools.ksp")
}

android {
    namespace = "in.gov.jk.schoolmaster"
    compileSdk = 34

    val githubRepoSlug = (project.findProperty("GITHUB_REPO") as? String)
        ?: System.getenv("GITHUB_REPOSITORY")
        ?: ""

    val releaseKeystorePath = (project.findProperty("ANDROID_KEYSTORE_PATH") as? String)
        ?: System.getenv("ANDROID_KEYSTORE_PATH")
        ?: ""
    val releaseKeystorePassword = (project.findProperty("ANDROID_KEYSTORE_PASSWORD") as? String)
        ?: System.getenv("ANDROID_KEYSTORE_PASSWORD")
        ?: ""
    val releaseKeyAlias = (project.findProperty("ANDROID_KEY_ALIAS") as? String)
        ?: System.getenv("ANDROID_KEY_ALIAS")
        ?: ""
    val releaseKeyPassword = (project.findProperty("ANDROID_KEY_PASSWORD") as? String)
        ?: System.getenv("ANDROID_KEY_PASSWORD")
        ?: ""

    val hasReleaseSigning = releaseKeystorePath.isNotBlank() &&
        file(releaseKeystorePath).exists() &&
        releaseKeystorePassword.isNotBlank() &&
        releaseKeyAlias.isNotBlank() &&
        releaseKeyPassword.isNotBlank()

    defaultConfig {
        applicationId = "in.gov.jk.schoolmaster"
        minSdk = 26
        targetSdk = 34
        versionCode = 104
        versionName = "1.0.4"

        buildConfigField("String", "GITHUB_REPO", "\"$githubRepoSlug\"")

        vectorDrawables {
            useSupportLibrary = true
        }
    }

    signingConfigs {
        if (hasReleaseSigning) {
            create("release") {
                storeFile = file(releaseKeystorePath)
                storePassword = releaseKeystorePassword
                keyAlias = releaseKeyAlias
                keyPassword = releaseKeyPassword
                enableV1Signing = true
                enableV2Signing = true
            }
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
            if (hasReleaseSigning) {
                signingConfig = signingConfigs.getByName("release")
            }
        }
        debug {
            applicationIdSuffix = ".debug"
            versionNameSuffix = "-debug"
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = "17"
    }

    buildFeatures {
        compose = true
        buildConfig = true
    }
}

dependencies {
    val composeBom = platform("androidx.compose:compose-bom:2024.09.00")
    implementation(composeBom)
    androidTestImplementation(composeBom)

    implementation("androidx.core:core-ktx:1.13.1")
    implementation("androidx.fragment:fragment-ktx:1.8.4")
    implementation("androidx.lifecycle:lifecycle-runtime-ktx:2.8.6")
    implementation("androidx.lifecycle:lifecycle-runtime-compose:2.8.6")
    implementation("androidx.lifecycle:lifecycle-viewmodel-compose:2.8.6")
    implementation("androidx.activity:activity-compose:1.9.2")
    implementation("androidx.compose.ui:ui")
    implementation("androidx.compose.ui:ui-graphics")
    implementation("androidx.compose.ui:ui-tooling-preview")
    implementation("androidx.compose.material3:material3")
    implementation("androidx.compose.material:material-icons-extended")

    // Room Database (Offline Student & Teacher persistence)
    implementation("androidx.room:room-runtime:2.6.1")
    implementation("androidx.room:room-ktx:2.6.1")
    ksp("androidx.room:room-compiler:2.6.1")

    // AndroidX BiometricPrompt API (Leave & Examination protection)
    implementation("androidx.biometric:biometric:1.1.0")

    // ZXing Core QR Code Generator & Decoder (Student & Teacher ID cards + Attendance Scanner)
    implementation("com.google.zxing:core:3.5.3")

    // CameraX (Offline Attendance QR Scanner & HPC Card CameraView)
    val cameraXVersion = "1.3.4"
    implementation("androidx.camera:camera-core:$cameraXVersion")
    implementation("androidx.camera:camera-camera2:$cameraXVersion")
    implementation("androidx.camera:camera-lifecycle:$cameraXVersion")
    implementation("androidx.camera:camera-view:$cameraXVersion")

    // Lottie Compose (Sync Status Dashboard syncing animation)
    implementation("com.airbnb.android:lottie-compose:6.5.2")

    testImplementation("junit:junit:4.13.2")
    debugImplementation("androidx.compose.ui:ui-tooling")
    debugImplementation("androidx.compose.ui:ui-test-manifest")
}
