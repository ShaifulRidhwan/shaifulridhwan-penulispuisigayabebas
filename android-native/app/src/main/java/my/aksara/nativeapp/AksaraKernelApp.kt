package my.aksara.nativeapp

import android.app.Application
import my.aksara.nativeapp.core.nexus.NexusEngine

/** Application-scope kernel: no network or shell execution at startup. */
class AksaraKernelApp : Application() {
    override fun onCreate() {
        super.onCreate()
        NexusEngine.initialize(this)
    }
}
