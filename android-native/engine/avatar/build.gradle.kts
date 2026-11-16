import java.io.File
import java.nio.file.Files
import java.nio.file.StandardCopyOption
import java.net.URI
import java.net.HttpURLConnection
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
        fun sha256(target: File): String =
            MessageDigest.getInstance("SHA-256").let { digest ->
                target.inputStream().buffered().use { input ->
                    val chunk=ByteArray(64*1024)
                    while(true) {
                        val count=input.read(chunk)
                        if(count<0) break
                        if(count>0) digest.update(chunk,0,count)
                    }
                }
                digest.digest().joinToString("") { "%02x".format(it) }
            }
        if(file.exists() && sha256(file)==expected) {
            logger.lifecycle("Using verified, cached Voice avatar")
            return@doLast
        }
        // Pin the upstream commit AND checksum. CDN failure must not break an APK build
        // when GitHub still serves the verified source. Never ship a corrupt download.
        val urls=listOf(
            "https://raw.githubusercontent.com/met4citizen/TalkingHead/166b443a445eeb63a4ea02270aa9e7d6ba8b4d88/avatars/brunette.glb",
            "https://cdn.jsdelivr.net/gh/met4citizen/TalkingHead@166b443a445eeb63a4ea02270aa9e7d6ba8b4d88/avatars/brunette.glb"
        )
        val failures=mutableListOf<String>()
        val candidate=File(file.parentFile,file.name+".partial")
        try {
            for(url in urls) {
                for(attempt in 1..3) {
                    try {
                        val connection=URI(url).toURL().openConnection() as HttpURLConnection
                        connection.connectTimeout=15_000
                        connection.readTimeout=90_000
                        connection.setRequestProperty("User-Agent","Aksara-Android-Avatar-Build")
                        try {
                            check(connection.responseCode in 200..299) {
                                "HTTP ${connection.responseCode}"
                            }
                            connection.inputStream.use { input ->
                                candidate.outputStream().buffered().use { output ->
                                    input.copyTo(output)
                                }
                            }
                        } finally {
                            connection.disconnect()
                        }
                        check(sha256(candidate)==expected) {
                            "SHA-256 mismatch for downloaded avatar"
                        }
                        Files.move(candidate.toPath(),file.toPath(),
                            StandardCopyOption.REPLACE_EXISTING)
                        logger.lifecycle("Verified Voice avatar from pinned upstream source")
                        return@doLast
                    } catch(error: Exception) {
                        failures.add("${URI(url).host} attempt $attempt: ${error.message}")
                        candidate.delete()
                        if(attempt<3) Thread.sleep(800L*attempt)
                    }
                }
            }
            error("Verified Voice avatar unavailable after both pinned sources: "+
                failures.joinToString(" | "))
        } finally {
            candidate.delete()
        }
    }
}
tasks.named("preBuild").configure{dependsOn(prepareVoiceAvatar)}
dependencies {
    implementation("com.google.android.filament:filament-android:1.56.0")
    implementation("com.google.android.filament:gltfio-android:1.56.0")
    implementation("com.google.android.filament:filament-utils-android:1.56.0")
}
