plugins {
    id("com.android.library")
    id("org.jetbrains.kotlin.android")
}
android {
    namespace = "de.roadbooknavi.routing"
    compileSdk = 36
    defaultConfig { minSdk = 24 }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions { jvmTarget = "17" }
    sourceSets["main"].java.srcDirs("../../brouter/src", "../../brouter/vendor/brouter-core", "../../brouter/vendor/brouter-mapaccess", "../../brouter/vendor/brouter-expressions", "../../brouter/vendor/brouter-codec", "../../brouter/vendor/brouter-util")
}
dependencies { implementation(project(":tauri-android")) }
