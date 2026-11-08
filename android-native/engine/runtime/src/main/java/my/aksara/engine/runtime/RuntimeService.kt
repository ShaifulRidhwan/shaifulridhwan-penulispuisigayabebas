package my.aksara.engine.runtime

import android.app.Service
import android.content.Intent
import androidx.sqlite.driver.bundled.BundledSQLiteDriver
import android.os.*
import java.util.concurrent.Executors

/** An ephemeral Android isolated UID: no inherited network permission or app files. */
class RuntimeService:Service() {
    private val worker=Executors.newSingleThreadExecutor()
    private val main=Handler(Looper.getMainLooper())
    private var process:java.lang.Process?=null
    private val messenger=Messenger(Handler(Looper.getMainLooper()){message ->
        if(message.what==2){process?.destroyForcibly();Process.killProcess(Process.myPid());return@Handler true}
        if(message.what!=1)return@Handler false
        val reply=message.replyTo;val id=message.arg1;val code=message.data.getString("code").orEmpty();val language=message.data.getString("language").orEmpty()
        val timeout=Runnable {try{reply.send(Message.obtain(null,1,id,0).apply{data=Bundle().apply{putString("error","Masa runtime tamat. Proses diasingkan telah ditamatkan.")}})}finally{process?.destroyForcibly();Process.killProcess(Process.myPid())}}
        main.postDelayed(timeout,6000)
        worker.submit {
            val data=Bundle()
            try {
                require(code.toByteArray().size<=100_000){"Had kod 100 KB."}
                val output=when(language){
                    "javascript" -> JavaScriptEngine.execute(code)
                    "shell" -> {
                        val child=ProcessBuilder("/system/bin/sh","-c",code).redirectErrorStream(true).start();process=child
                        val bytes=child.inputStream.use{it.readBounded(80_001)}
                        require(bytes.size<=80_000){"Output melebihi 80 KB."}
                        child.waitFor();String(bytes)+"\n[exit ${child.exitValue()}]"
                    }
                    "sql" -> BundledSQLiteDriver().open(":memory:").use {db ->
                        db.prepare(code).use {statement ->buildString {
                            appendLine((0 until statement.getColumnCount()).joinToString(" | "){statement.getColumnName(it)})
                            var rows=0
                            while(statement.step()&&rows++<1000){
                                appendLine((0 until statement.getColumnCount()).joinToString(" | "){if(statement.isNull(it))"NULL" else statement.getText(it)})
                                require(length<=80_000){"Output melebihi 80 KB."}
                            }
                        }}
                    }
                    else -> error("Runtime $language belum tersedia secara native.")
                }
                data.putString("output",output)
            }catch(e:Throwable){data.putString("error","$language: ${e.message?:e.javaClass.simpleName}")}
            finally{process?.destroyForcibly();process=null;main.removeCallbacks(timeout)}
            runCatching{reply.send(Message.obtain(null,1,id,0).apply{this.data=data})}
            stopSelf()
        };true
    })
    override fun onBind(intent:Intent):IBinder=messenger.binder
    override fun onDestroy(){process?.destroyForcibly();worker.shutdownNow();super.onDestroy()}
}

private fun java.io.InputStream.readBounded(limit:Int):ByteArray {
    val out=java.io.ByteArrayOutputStream();val buffer=ByteArray(8192)
    while(out.size()<limit){val n=read(buffer,0,minOf(buffer.size,limit-out.size()));if(n<0)break;if(n>0)out.write(buffer,0,n)}
    return out.toByteArray()
}
