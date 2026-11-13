plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    id("org.jetbrains.kotlin.plugin.compose")
}
// Keep default Cloud APK build reproducible; enable heavy native runtime with -PenableSdTurboNative=true.
val enableSdTurboNative = providers.gradleProperty("enableSdTurboNative").orNull == "true"
// Linux preview is an isolated debug APK. Production remains targetSdk 35.
val enableLinuxPreview = providers.gradleProperty("enableLinuxPreview").orNull == "true"
// Compatibility research only; Android target 36 enforces W^X app-data execution.
// This probe is NOT a supported Linux delivery until on-device PRoot exec is solved.
val enableLinuxModernProbe = providers.gradleProperty("enableLinuxModernProbe").orNull == "true"
require(!enableLinuxModernProbe || enableLinuxPreview) {
    "Modern Linux compatibility probe must be isolated from production build"
}
require(!(enableLinuxPreview && enableSdTurboNative)) { "Linux preview and SD-Turbo builds must remain separate" }
// PR preview APKs use a SHA-scoped package ID to avoid colliding with an installed
// Android app signed by a different, ephemeral CI debug keystore.
// The normal merged/development app retains its original applicationId.
val aksaraPreviewSuffix = providers.gradleProperty("aksaraPreviewSuffix").orNull
require(aksaraPreviewSuffix == null || Regex("^\\.preview\\.p[0-9]+\\.c[a-f0-9]{8}$").matches(aksaraPreviewSuffix)) {
    "Invalid AKSARA preview package suffix"
}
android {
    if (enableSdTurboNative) {
        ndkVersion = "27.2.12479018"
        externalNativeBuild {
            cmake {
                path = file("src/main/cpp/CMakeLists.txt")
                version = "3.22.1"
            }
        }
    }
    namespace = "my.aksara.nativeapp"
    compileSdk = if (enableLinuxModernProbe) 36 else 35
    defaultConfig {
        if (enableSdTurboNative || enableLinuxPreview) {
            ndk { abiFilters.add("arm64-v8a") }
        }
        applicationId = "my.aksara.nativeapp"
        minSdk = 31
        // SDK 28 is required by the *unmerged, sideload-only* rootless
        // Linux preview to exec package binaries from app-private storage.
        // Do not use this configuration for production/Play Store releases.
        targetSdk = when {
            enableLinuxModernProbe -> 36
            enableLinuxPreview -> 28
            else -> 35
        }
        versionCode = 4
        versionName = "0.2.0-chess-darkness"
        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
        buildConfigField("String", "API_ORIGIN", "\"https://shaifulridhwan-penulispuisigayabebas.netlify.app\"")
        // PR328 owner APK uses isolated Netlify draft backend; regular Chat stays
        // on the authoritative production Netlify endpoint. Non-preview APKs
        // return to the normal production agent origin after the owner merges.
        val agentPreview = aksaraPreviewSuffix?.startsWith(".preview.p328.") == true
        val agentOrigin = if (agentPreview)
            "https://aksara-agentic-pr328--shaifulridhwan-penulispuisigayabebas.netlify.app"
        else
            "https://shaifulridhwan-penulispuisigayabebas.netlify.app"
        buildConfigField("String", "AGENT_API_ORIGIN", "\"$agentOrigin\"")
        buildConfigField("String", "WEB_REFERENCE_COMMIT", "\"f482b8ed393fe0eb4277ae3eaf3938f1593489c4\"")
        // Only display a source commit when CI supplies a verified 40-hex PR head.
        // An ordinary local build leaves this unknown; never imply APK matches GitHub.
        val sourceSha = providers.environmentVariable("AKSARA_PREVIEW_HEAD_SHA").orNull
            ?.takeIf { it.matches(Regex("[a-fA-F0-9]{40}")) } ?: ""
        buildConfigField("String", "SOURCE_COMMIT_SHA", "\"$sourceSha\"")
    }
    buildTypes {
        create("benchmark") {
            initWith(getByName("release"))
            matchingFallbacks += listOf("release")
            signingConfig = signingConfigs.getByName("debug")
            isDebuggable = false
            // Capture ART profiles before R8 obfuscates benchmark classes.
            isMinifyEnabled = providers.gradleProperty("aksaraGenerateBaseline").orNull != "true"
            isShrinkResources = isMinifyEnabled
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
        }
        getByName("debug") {
            if (aksaraPreviewSuffix != null) {
                applicationIdSuffix = aksaraPreviewSuffix
                versionNameSuffix = "-preview-" + aksaraPreviewSuffix.removePrefix(".").replace('.', '-')
            }
        }
    }
    buildFeatures { compose = true; buildConfig = true }
    compileOptions { isCoreLibraryDesugaringEnabled = true; sourceCompatibility = JavaVersion.VERSION_17; targetCompatibility = JavaVersion.VERSION_17 }
    kotlinOptions { jvmTarget = "17" }
    testOptions { animationsDisabled = true }
    packaging {
        jniLibs.useLegacyPackaging = true
        jniLibs.keepDebugSymbols += setOf("**/libstockfish.so", "**/libaksara_proot*.so")
        resources.excludes += setOf("META-INF/LICENSE*", "META-INF/NOTICE*")
    }
}
dependencies {
    coreLibraryDesugaring("com.android.tools:desugar_jdk_libs:2.1.5")
    implementation(project(":engine:chess"))
    implementation("androidx.webkit:webkit:1.12.1")
    implementation("androidx.profileinstaller:profileinstaller:1.4.1")
    implementation("androidx.metrics:metrics-performance:1.0.0")
    implementation(project(":engine:runtime"))
    implementation(project(":engine:voice"))
    implementation(project(":engine:avatar"))
    val composeBom = platform("androidx.compose:compose-bom:2025.06.01")
    implementation(composeBom); androidTestImplementation(composeBom)
    implementation("androidx.activity:activity-compose:1.10.1")
    implementation("androidx.compose.ui:ui")
    implementation("androidx.compose.ui:ui-tooling-preview")
    implementation("androidx.compose.foundation:foundation")
    implementation("androidx.compose.material3:material3")
    implementation("androidx.compose.animation:animation")
    implementation("androidx.lifecycle:lifecycle-viewmodel-compose:2.9.1")
    implementation("androidx.lifecycle:lifecycle-runtime-compose:2.9.1")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.10.2")
    implementation("com.squareup.okhttp3:okhttp:4.12.0")
    implementation("dev.chrisbanes.haze:haze:1.5.4")
    // Official Termux PTY/native terminal renderer; no external Termux app needed.
    implementation("com.termux.termux-app:terminal-view:0.118.0")
    implementation("org.apache.commons:commons-compress:1.27.1")
    // Native OpenGL MapLibre for broad Android GPU compatibility; OpenFreeMap needs no paid key.
    implementation("org.maplibre.gl:android-sdk-opengl:13.7.1")
    implementation("io.noties.markwon:core:4.6.2")
    implementation("io.noties.markwon:ext-tables:4.6.2")
    testImplementation("junit:junit:4.13.2")
    testImplementation("com.squareup.okhttp3:mockwebserver:4.12.0")
    testImplementation("org.json:json:20250517")
    testImplementation("org.jetbrains.kotlinx:kotlinx-coroutines-test:1.10.2")
    androidTestImplementation("androidx.test:runner:1.6.2")
    androidTestImplementation("androidx.test.ext:junit:1.2.1")
    androidTestImplementation("androidx.test.uiautomator:uiautomator:2.3.0")
    androidTestImplementation("androidx.compose.ui:ui-test-junit4")
    debugImplementation("androidx.compose.ui:ui-test-manifest")
    debugImplementation("androidx.compose.ui:ui-tooling")
}
