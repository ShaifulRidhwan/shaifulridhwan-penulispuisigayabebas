plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    id("org.jetbrains.kotlin.plugin.compose")
}
// Keep default Cloud APK build reproducible; enable heavy native runtime with -PenableSdTurboNative=true.
val enableSdTurboNative = providers.gradleProperty("enableSdTurboNative").orNull == "true"
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
    compileSdk = 35
    defaultConfig {
        if (enableSdTurboNative) {
            ndk { abiFilters.add("arm64-v8a") }
        }
        applicationId = "my.aksara.nativeapp"
        minSdk = 31
        targetSdk = 35
        versionCode = 3
        versionName = "0.1.0-eclipse-v3"
        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
        buildConfigField("String", "API_ORIGIN", "\"https://shaifulridhwan-penulispuisigayabebas.netlify.app\"")
        buildConfigField("String", "WEB_REFERENCE_COMMIT", "\"f482b8ed393fe0eb4277ae3eaf3938f1593489c4\"")
    }
    buildFeatures { compose = true; buildConfig = true }
    compileOptions { sourceCompatibility = JavaVersion.VERSION_17; targetCompatibility = JavaVersion.VERSION_17 }
    kotlinOptions { jvmTarget = "17" }
    testOptions { animationsDisabled = true }
    packaging { resources.excludes += setOf("META-INF/LICENSE*", "META-INF/NOTICE*") }
}
dependencies {
    implementation("androidx.webkit:webkit:1.12.1")
    implementation(project(":engine:runtime"))
    implementation(project(":engine:voice"))
    implementation(project(":engine:avatar"))
    val composeBom = platform("androidx.compose:compose-bom:2025.06.01")
    implementation(composeBom); androidTestImplementation(composeBom)
    implementation("androidx.activity:activity-compose:1.10.1")
    implementation("androidx.compose.ui:ui")
    implementation("androidx.compose.ui:ui-tooling-preview")
    implementation("androidx.compose.foundation:foundation")
    implementation("androidx.compose.animation:animation")
    implementation("androidx.lifecycle:lifecycle-viewmodel-compose:2.9.1")
    implementation("androidx.lifecycle:lifecycle-runtime-compose:2.9.1")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.10.2")
    implementation("com.squareup.okhttp3:okhttp:4.12.0")
    implementation("dev.chrisbanes.haze:haze:1.5.4")
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
