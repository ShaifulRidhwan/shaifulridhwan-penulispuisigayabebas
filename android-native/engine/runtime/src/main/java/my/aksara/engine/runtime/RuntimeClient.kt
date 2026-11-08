package my.aksara.engine.runtime

import android.content.*
import android.os.*
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException

class RuntimeClient(private val context:Context) {
    suspend fun execute(language:String,code:String):String = suspendCancellableCoroutine { continuation ->
        var remote:Messenger?=null
        var bound=false
        lateinit var connection:ServiceConnection
        fun unbind(){if(bound){bound=false;runCatching{context.unbindService(connection)}}}
        val reply=Messenger(Handler(Looper.getMainLooper()){message ->
            if(continuation.isActive){val error=message.data.getString("error");if(error!=null)continuation.resumeWithException(IllegalStateException(error)) else continuation.resume(message.data.getString("output").orEmpty())}
            unbind();true
        })
        connection=object:ServiceConnection{
            override fun onServiceConnected(name:ComponentName,binder:IBinder){
                remote=Messenger(binder)
                try{remote!!.send(Message.obtain(null,1).apply {replyTo=reply;data=Bundle().apply{putString("language",language);putString("code",code)}})}
                catch(e:Exception){if(continuation.isActive)continuation.resumeWithException(e);unbind()}
            }
            override fun onServiceDisconnected(name:ComponentName){if(continuation.isActive)continuation.resumeWithException(IllegalStateException("Runtime terputus."));unbind()}
            override fun onBindingDied(name:ComponentName){onServiceDisconnected(name)}
            override fun onNullBinding(name:ComponentName){onServiceDisconnected(name)}
        }
        continuation.invokeOnCancellation {runCatching{remote?.send(Message.obtain(null,2))};unbind()}
        bound=context.bindService(Intent(context,RuntimeService::class.java),connection,Context.BIND_AUTO_CREATE)
        if(!bound&&continuation.isActive)continuation.resumeWithException(IllegalStateException("Runtime tidak dapat dimulakan."))
    }
}
