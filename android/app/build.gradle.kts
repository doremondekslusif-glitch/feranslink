plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.plugin.serialization")
    id("org.jetbrains.kotlin.plugin.compose")
}

android {
    namespace = "com.feranslink.android"
    compileSdk = 37

    defaultConfig {
        applicationId = "com.feranslink.android"
        minSdk = 26
        targetSdk = 36
        versionCode = 2
        versionName = "1.1"
    }
}

dependencies {
    implementation("androidx.core:core-ktx:1.19.0")
    implementation("androidx.activity:activity-compose:1.12.0")
    implementation("androidx.compose.ui:ui:1.9.3")
    implementation("androidx.compose.material3:material3:1.4.0")
    implementation("androidx.lifecycle:lifecycle-runtime-compose:2.11.0")
    implementation("io.github.jan-tennert.supabase:realtime-kt:3.8.0")
    implementation("io.ktor:ktor-client-okhttp:3.2.1")
    implementation("io.ktor:ktor-client-core:3.2.1")
    implementation("io.ktor:ktor-client-websockets:3.2.1")
}
