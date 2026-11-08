package my.aksara.engine.runtime

import org.mozilla.javascript.*
import java.util.concurrent.TimeUnit

/** Pure JS only: no LiveConnect, Java, filesystem, Android objects or network. */
object JavaScriptEngine {
    fun execute(code:String,budgetMs:Long=4000):String {
        require(code.toByteArray().size<=100_000){"Had kod 100 KB."}
        val deadline=System.nanoTime()+TimeUnit.MILLISECONDS.toNanos(budgetMs)
        val factory=object:ContextFactory(){
            override fun makeContext():Context = super.makeContext().apply { optimizationLevel=-1;instructionObserverThreshold=1000;languageVersion=Context.VERSION_ES6 }
            override fun observeInstructionCount(cx:Context,count:Int){if(System.nanoTime()>deadline||Thread.currentThread().isInterrupted)throw RuntimeException("Masa pelaksanaan tamat.")}
        }
        return factory.call(ContextAction { cx ->
            cx.setClassShutter {false}
            val scope=cx.initSafeStandardObjects(null,true)
            val output=StringBuilder()
            val console=NativeObject()
            val log=object:BaseFunction(){override fun call(cx:Context,scope:Scriptable,thisObj:Scriptable,args:Array<out Any>):Any {
                val line=args.joinToString(" "){Context.toString(it)}
                if(output.length+line.length>80_000)throw RuntimeException("Output melebihi 80 KB.")
                output.appendLine(line);return Undefined.instance
            }}
            console.put("log",console,log);console.put("error",console,log)
            ScriptableObject.putProperty(scope,"console",console)
            val result=cx.evaluateString(scope,code,"aksara.js",1,null)
            if(output.isEmpty()&&result!=Undefined.instance)Context.toString(result).take(80_000) else output.toString().trimEnd()
        })
    }
}
