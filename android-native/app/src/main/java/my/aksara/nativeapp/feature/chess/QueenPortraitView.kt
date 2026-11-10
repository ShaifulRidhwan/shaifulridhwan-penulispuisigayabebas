package my.aksara.nativeapp.feature.chess

import android.content.Context
import android.graphics.*
import android.os.SystemClock
import android.view.View
import kotlin.math.sin

/** Original vector portrait, drawn from paths; no downloaded or placeholder artwork. */
class QueenPortraitView(context:Context):View(context) {
    var speaking=false;set(value){field=value;invalidate()}
    private val p=Paint(Paint.ANTI_ALIAS_FLAG)
    private val path=Path()
    private val skin=LinearGradient(35f,25f,70f,77f,0xffcab8b6.toInt(),0xff786879.toInt(),Shader.TileMode.CLAMP)
    init{contentDescription="Ratu Gelap — potret original AKSARA"}
    override fun onDraw(c:Canvas) {
        c.save();c.scale(width/100f,height/100f)
        p.shader=null;p.color=0xff21192e.toInt();c.drawCircle(50f,50f,48f,p)
        p.style=Paint.Style.STROKE;p.strokeWidth=1f;p.color=0xffa486b0.toInt();c.drawCircle(50f,50f,46f,p);p.style=Paint.Style.FILL
        path.rewind();path.moveTo(13f,94f);path.cubicTo(9f,64f,14f,22f,40f,15f);path.cubicTo(75f,1f,91f,49f,87f,94f);path.close();p.color=0xff0e111f.toInt();c.drawPath(path,p)
        path.rewind();path.moveTo(26f,94f);path.lineTo(40f,73f);path.lineTo(60f,73f);path.lineTo(76f,94f);path.close();p.color=0xff564160.toInt();c.drawPath(path,p)
        path.rewind();path.moveTo(31f,37f);path.cubicTo(36f,22f,63f,22f,69f,37f);path.lineTo(66f,59f);path.cubicTo(64f,69f,56f,76f,50f,78f);path.cubicTo(42f,74f,34f,65f,33f,58f);path.close();p.shader=skin;c.drawPath(path,p);p.shader=null
        path.rewind();path.moveTo(28f,48f);path.lineTo(26f,29f);path.lineTo(41f,17f);path.lineTo(53f,22f);path.cubicTo(46f,33f,33f,33f,28f,48f);p.color=0xff181523.toInt();c.drawPath(path,p)
        path.rewind();path.moveTo(53f,22f);path.cubicTo(58f,31f,69f,35f,73f,54f);path.lineTo(75f,30f);path.lineTo(64f,19f);path.close();c.drawPath(path,p)
        p.style=Paint.Style.STROKE;p.strokeWidth=1.3f;p.color=0xff3b263e.toInt();c.drawLine(37f,48f,45f,49f,p);c.drawLine(55f,49f,63f,48f,p)
        p.color=0xffa98564.toInt();path.rewind();path.moveTo(28f,31f);path.lineTo(25f,13f);path.lineTo(41f,23f);path.lineTo(50f,5f);path.lineTo(59f,23f);path.lineTo(75f,13f);path.lineTo(71f,31f);c.drawPath(path,p)
        p.strokeWidth=.8f;p.color=0xff6e5268.toInt();path.rewind();path.moveTo(50f,49f);path.lineTo(47f,59f);path.lineTo(52f,60f);c.drawPath(path,p)
        c.drawLine(44f,66f,56f,66f,p);p.style=Paint.Style.FILL
        val glow=if(speaking).5f+.5f*sin(SystemClock.uptimeMillis()/130f) else .35f
        p.color=Color.argb((150+glow*100).toInt(),193,142,219);c.drawCircle(41f,49f,1f+glow*.5f,p);c.drawCircle(59f,49f,1f+glow*.5f,p)
        p.color=0xffd2b382.toInt();c.drawCircle(50f,20f,2.3f,p);c.drawCircle(50f,86f,2.5f,p)
        c.restore();if(speaking && hasWindowFocus())postInvalidateOnAnimation()
    }
}
