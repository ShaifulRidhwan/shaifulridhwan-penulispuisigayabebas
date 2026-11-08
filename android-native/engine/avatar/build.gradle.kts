import java.net.URI
import java.security.MessageDigest
plugins { id("com.android.library"); id("org.jetbrains.kotlin.android") }
android {
    namespace="my.aksara.engine.avatar";compileSdk=35
    defaultConfig {minSdk=31}
    compileOptions{sourceCompatibility=JavaVersion.VERSION_17;targetCompatibility=JavaVersion.VERSION_17}
    kotlinOptions{jvmTarget="17"}
    sourceSets["main"].assets.srcDir(layout.buildDirectory.dir("generated/avatar-assets"))
}
val avatarFile=layout.buildDirectory.file("generated/avatar-assets/models/brunette.glb")
val prepareVoiceAvatar=tasks.register("prepareVoiceAvatar") {
    outputs.file(avatarFile)
    doLast {
        val file=avatarFile.get().asFile
        file.parentFile.mkdirs()
        val expected="8864c504b5c11daa2f0037afffdc0815bb0fa2e6062e37a584746116a3c2f538"
        if(!file.exists()) URI("https://cdn.jsdelivr.net/gh/met4citizen/TalkingHead@166b443a445eeb63a4ea02270aa9e7d6ba8b4d88/avatars/brunette.glb").toURL().openStream().use{input->file.outputStream().use{input.copyTo(it)}}
        val actual=MessageDigest.getInstance("SHA-256").digest(file.readBytes()).joinToString(""){"%02x".format(it)}
        check(actual==expected){"Voice avatar checksum mismatch; refusing an unverified asset."}
    }
}
tasks.named("preBuild").configure{dependsOn(prepareVoiceAvatar)}
dependencies {
    implementation("com.google.android.filament:filament-android:1.56.0")
    implementation("com.google.android.filament:gltfio-android:1.56.0")
    implementation("com.google.android.filament:filament-utils-android:1.56.0")
}
