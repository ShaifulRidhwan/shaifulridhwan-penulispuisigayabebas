plugins { id("com.android.library"); id("org.jetbrains.kotlin.android") }
android {
    namespace="my.aksara.engine.runtime"
    compileSdk=35
    defaultConfig { minSdk=31 }
    compileOptions { sourceCompatibility=JavaVersion.VERSION_17; targetCompatibility=JavaVersion.VERSION_17 }
    kotlinOptions { jvmTarget="17" }
}
dependencies {
    implementation("androidx.sqlite:sqlite-bundled:2.5.1")
    implementation("org.mozilla:rhino:1.8.0")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.10.2")
    testImplementation("junit:junit:4.13.2")
}
