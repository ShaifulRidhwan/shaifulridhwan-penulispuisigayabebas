plugins { `java-library` }
java { sourceCompatibility = JavaVersion.VERSION_17; targetCompatibility = JavaVersion.VERSION_17 }
dependencies {
    api("org.apache.commons:commons-lang3:3.18.0")
    testImplementation("junit:junit:4.13.2")
}
