package my.aksara.engine.runtime
import org.junit.Assert.*
import org.junit.Test
class JavaScriptEngineTest {
    @Test fun actuallyExecutesJavaScript(){assertEquals("42",JavaScriptEngine.execute("console.log([1,2,3].reduce((a,b)=>a+b,0)*7)"))}
    @Test fun cannotReadJavaOrAndroidObjects(){assertThrows(Exception::class.java){JavaScriptEngine.execute("java.lang.System.getenv()")}}
    @Test fun terminatesInfiniteLoops(){assertThrows(Exception::class.java){JavaScriptEngine.execute("while(true){}",20)}}
}
