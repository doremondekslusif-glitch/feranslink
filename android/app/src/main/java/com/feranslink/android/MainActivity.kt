package com.feranslink.android

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import io.github.jan.supabase.createSupabaseClient
import io.github.jan.supabase.realtime.Realtime
import io.github.jan.supabase.realtime.broadcast
import io.github.jan.supabase.realtime.broadcastFlow
import io.github.jan.supabase.realtime.channel
import kotlinx.coroutines.flow.collectLatest
import kotlinx.coroutines.launch
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import java.security.MessageDigest
import java.util.UUID

private const val SUPABASE_URL = "https://uwhrvezysarcsyxnmkny.supabase.co"
private const val SUPABASE_PUBLISHABLE_KEY = "sb_publishable_8RFViYPI3bvRAN9OVXYh9g_bhfXIrMN"

private val supabase = createSupabaseClient(
    supabaseUrl = SUPABASE_URL,
    supabaseKey = SUPABASE_PUBLISHABLE_KEY
) {
    install(Realtime)
}

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        DeviceIdentity.init(applicationContext)
        setContent { FeransLinkApp() }
    }
}

@androidx.compose.runtime.Composable
private fun FeransLinkApp() {
    var deviceId by remember { mutableStateOf(DeviceIdentity.id) }
    var pin by remember { mutableStateOf(DeviceIdentity.pin) }
    var ready by remember { mutableStateOf(false) }
    var status by remember { mutableStateOf("Offline") }
    var request by remember { mutableStateOf<ConnectionRequest?>(null) }
    var channelHolder by remember { mutableStateOf<FeransChannel?>(null) }
    val coroutineScope = rememberCoroutineScope()

    LaunchedEffect(Unit) {
        deviceId = DeviceIdentity.id
        pin = DeviceIdentity.pin
    }

    LaunchedEffect(ready, deviceId, pin) {
        if (!ready) {
            channelHolder?.close()
            channelHolder = null
            status = "Offline"
            return@LaunchedEffect
        }

        status = "Menghubungkan..."
        val holder = FeransChannel(deviceId, pin)
        channelHolder = holder
        holder.start(
            onStatus = { status = it },
            onRequest = { request = it }
        )
    }

    Surface(modifier = Modifier.fillMaxSize(), color = MaterialTheme.colorScheme.background) {
        Column(
            modifier = Modifier.fillMaxSize().padding(24.dp),
            verticalArrangement = Arrangement.Center
        ) {
            Text("FeransLink", style = MaterialTheme.typography.headlineMedium, fontWeight = FontWeight.Bold)
            Text("Remote Device", color = MaterialTheme.colorScheme.onSurfaceVariant)
            Spacer(Modifier.height(28.dp))

            Card(Modifier.fillMaxWidth()) {
                Column(Modifier.padding(20.dp)) {
                    Text("Device ID", fontWeight = FontWeight.SemiBold)
                    Text(deviceId, style = MaterialTheme.typography.titleLarge)
                    Spacer(Modifier.height(16.dp))
                    Text("PIN Pasangan", fontWeight = FontWeight.SemiBold)
                    Text(pin, style = MaterialTheme.typography.titleLarge)
                    Spacer(Modifier.height(12.dp))
                    Text("Status: $status")
                }
            }

            Spacer(Modifier.height(20.dp))

            if (!ready) {
                Button(
                    onClick = { ready = true },
                    modifier = Modifier.fillMaxWidth()
                ) { Text("Siapkan Koneksi") }
            } else {
                OutlinedButton(
                    onClick = { ready = false },
                    modifier = Modifier.fillMaxWidth()
                ) { Text("Hentikan Koneksi") }
            }

            Spacer(Modifier.height(10.dp))
            Text(
                "Perangkat tidak menerima koneksi sebelum Anda menekan “Siapkan Koneksi”.",
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }
    }

    request?.let { req ->
        AlertDialog(
            onDismissRequest = { request = null },
            title = { Text("Permintaan koneksi") },
            text = { Text("Windows ingin terhubung ke perangkat ini. Izinkan?") },
            confirmButton = {
                Button(onClick = {
                    coroutineScope.launch {
                        channelHolder?.allow(req.sessionId)
                        request = null
                        status = "Terhubung"
                    }
                }) { Text("Izinkan") }
            },
            dismissButton = {
                OutlinedButton(onClick = {
                    coroutineScope.launch {
                        channelHolder?.deny(req.sessionId)
                        request = null
                        status = "Siap"
                    }
                }) { Text("Tolak") }
            }
        )
    }
}

@Serializable
private data class ConnectionRequestPayload(
    val sessionId: String,
    val deviceId: String? = null,
    val controller: String? = null,
    val requestedAt: String? = null
)

private data class ConnectionRequest(val sessionId: String)

private object DeviceIdentity {
    private const val PREFS = "feranslink_identity"
    private var initialized = false
    private var idValue = ""
    private var pinValue = ""

    private lateinit var prefs: android.content.SharedPreferences

    fun init(context: android.content.Context) {
        if (initialized) return
        prefs = context.getSharedPreferences(PREFS, android.content.Context.MODE_PRIVATE)
        idValue = prefs.getString("device_id", null) ?: generateId().also {
            prefs.edit().putString("device_id", it).apply()
        }
        pinValue = prefs.getString("pairing_pin", null) ?: generatePin().also {
            prefs.edit().putString("pairing_pin", it).apply()
        }
        initialized = true
    }

    val id: String
        get() = idValue

    val pin: String
        get() = pinValue

    private fun generateId(): String =
        "FL-" + UUID.randomUUID().toString().replace("-", "").take(8).uppercase()

    private fun generatePin(): String =
        (100000..999999).random().toString()
}

private class FeransChannel(
    private val deviceId: String,
    private val pin: String
) {
    private var channel: io.github.jan.supabase.realtime.RealtimeChannel? = null

    private suspend fun topic(): String {
        val bytes = MessageDigest.getInstance("SHA-256")
            .digest(("$deviceId|$pin").lowercase().toByteArray())
        return "feranslink-" + bytes.joinToString("") { "%02x".format(it) }
    }

    suspend fun start(
        onStatus: (String) -> Unit,
        onRequest: (ConnectionRequest) -> Unit
    ) {
        val c = supabase.channel(topic())
        channel = c

        c.subscribe(blockUntilSubscribed = true)
        onStatus("Siap")

        c.broadcastFlow<ConnectionRequestPayload>("connection_request")
            .collectLatest { payload ->
                onRequest(ConnectionRequest(payload.sessionId))
            }
    }

    suspend fun allow(sessionId: String) {
        channel?.broadcast(
            event = "connection_response",
            message = buildJsonObject {
                put("sessionId", sessionId)
                put("action", "allow")
            }
        )
    }

    suspend fun deny(sessionId: String) {
        channel?.broadcast(
            event = "connection_response",
            message = buildJsonObject {
                put("sessionId", sessionId)
                put("action", "deny")
            }
        )
    }

    suspend fun close() {
        channel?.unsubscribe()
        channel = null
    }
}
