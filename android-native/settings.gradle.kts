pluginManagement { repositories { google(); mavenCentral(); gradlePluginPortal() } }
dependencyResolutionManagement { repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS); repositories { google(); mavenCentral(); maven { url = uri("https://jitpack.io") } } }
rootProject.name = "AksaraNative"
include(":app")

include(":engine:runtime")
include(":engine:voice")
include(":engine:avatar")

include(":engine:chess")

// Hardware-only performance benchmarking, excluded from standard cloud preview CI.
if (providers.gradleProperty("aksaraPerformanceBenchmarks").orNull == "true") {
    include(":macrobenchmark")
}
