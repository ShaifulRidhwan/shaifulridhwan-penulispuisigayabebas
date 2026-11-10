pluginManagement { repositories { google(); mavenCentral(); gradlePluginPortal() } }
dependencyResolutionManagement { repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS); repositories { google(); mavenCentral() } }
rootProject.name = "AksaraNative"
include(":app")

include(":engine:runtime")
include(":engine:voice")
include(":engine:avatar")

include(":engine:chess")
