package my.aksara.nativeapp.feature.chess

import android.content.Context
import android.graphics.*
import android.os.SystemClock
import kotlin.math.*

/** Original procedural 2.5D arena. Standard rules coordinates survive every camera transform. */
class ArenaBoardView(context:Context):ChessBoardView(context) {
    var animationSpeed=1f
    private val ink=Paint(Paint.ANTI_ALIAS_FLAG)
    private val boardMatrix=Matrix()
    private val inverse=Matrix()
    private val quad=Path()
    private val source=floatArrayOf(0f,0f,8f,0f,8f,8f,0f,8f)
    private val destination=FloatArray(8)
    private val centers=FloatArray(128)
    private val rawCenters=FloatArray(128){i -> if(i%2==0) (i/2%8)+.5f else 7-(i/2/8)+.5f }
    private val touch=FloatArray(2)
    private val marble=material(true)
    private val obsidian=material(false)
    private val lightShader=BitmapShader(marble,Shader.TileMode.REPEAT,Shader.TileMode.REPEAT)
    private val darkShader=BitmapShader(obsidian,Shader.TileMode.REPEAT,Shader.TileMode.REPEAT)
    private val textureMatrix=Matrix().apply{setScale(8f/512,8f/512)}
    private var aura:Shader?=null
    private var cell=1f
    private var started=0L
    private var duration=550L
    private var packet=-1
    private var from=-1
    private var to=-1
    private var rookFrom=-1
    private var rookTo=-1
    private var captured=-1
    private var actor='P'
    private var victim='p'
    private var active=false
    private var checkmate=false
    private var statusPulse=0L
    private val rays=FloatArray(48){i -> if(i%2==0) cos(i/2*.83f) else sin(i/2*.83f) }
    private var geometryReady=false
    init {
        lightShader.setLocalMatrix(textureMatrix);darkShader.setLocalMatrix(textureMatrix)
        contentDescription="Arena catur Cahaya vs Gelap. Putih di bawah, h1 petak cerah."
    }
    fun showCommittedMove(before:Array<String>?,move:String,id:Int,mate:Boolean,committedAt:Long=0L) {
        if(id==packet) return
        packet=id
        active=false;checkmate=mate
        if(before==null || move.length<4) {statusPulse=0L;invalidate();return}
        from=ChessModel.index(move.take(2));to=ChessModel.index(move.substring(2,4))
        actor=before[from].firstOrNull()?:return
        captured=if(before[to].isNotBlank()) to else if(actor.uppercaseChar()=='P' && from%8!=to%8) from/8*8+to%8 else -1
        victim=if(captured>=0)before[captured].firstOrNull()?:'p' else 'p'
        rookFrom=-1;rookTo=-1
        if(actor.uppercaseChar()=='K' && abs(from-to)==2) {
            rookFrom=if(to>from)from+3 else from-4;rookTo=if(to>from)from+1 else from-1
        }
        duration=((if(mate)1100 else if(captured>=0)780 else 480)/animationSpeed.coerceIn(.5f,2f)).toLong()
        started=if(committedAt>0)committedAt else SystemClock.uptimeMillis();active=true;checkmate=mate;statusPulse=started;invalidate()
    }
    fun skipAnimation() {active=false;statusPulse=0L;geometry(0f);invalidate()}
    override fun onSizeChanged(w:Int,h:Int,oldw:Int,oldh:Int) {
        super.onSizeChanged(w,h,oldw,oldh)
        geometry(0f)
        aura=RadialGradient(w*.45f,h*.48f,max(w,h)*.7f,intArrayOf(0xff25213e.toInt(),0xff090c17.toInt()),null,Shader.TileMode.CLAMP)
    }
    private fun geometry(focus:Float) {
        val span=min(width*.94f,height*1.12f)
        cell=span/8
        val x=width/2f
        val y=(height-span*.72f)/2f+cell*.28f
        val zoom=1f+focus*.035f
        val sx=if(active) (4f-(from%8+to%8+1f)/2f)*cell*.08f*focus else 0f
        val sy=if(active) (from/8+to/8-7)*cell*.014f*focus else 0f
        destination[0]=x-span*.38f*zoom+sx;destination[1]=y+sy
        destination[2]=x+span*.38f*zoom+sx;destination[3]=y+sy
        destination[4]=x+span*.50f*zoom+sx;destination[5]=y+span*.72f*zoom+sy
        destination[6]=x-span*.50f*zoom+sx;destination[7]=y+span*.72f*zoom+sy
        boardMatrix.setPolyToPoly(source,0,destination,0,4);boardMatrix.invert(inverse)
        boardMatrix.mapPoints(centers,rawCenters);geometryReady=true
    }
    override fun squareCenter(square:Int):PointF {
        if(!geometryReady)geometry(0f)
        return PointF(centers[square*2],centers[square*2+1])
    }
    override fun squareAt(x:Float,y:Float):Int {
        touch[0]=x;touch[1]=y;inverse.mapPoints(touch)
        val file=floor(touch[0]).toInt();val rank=7-floor(touch[1]).toInt()
        return if(file in 0..7 && rank in 0..7)rank*8+file else -1
    }
    override fun onDraw(c:Canvas) {
        val now=SystemClock.uptimeMillis()
        val t=if(active)((now-started).toFloat()/duration).coerceIn(0f,1f) else 1f
        if(t>=1f) active=false
        val focus=if(active && (captured>=0 || check || actor.uppercaseChar()=='Q'))sin(t*PI).toFloat() else 0f
        geometry(focus)
        ink.shader=aura;c.drawPaint(ink);ink.shader=null
        // Board volume, soft floor shadow and bevel are separate from the playing plane.
        ink.color=0x33000000;c.drawOval(width*.06f,height*.43f,width*.96f,height*.98f,ink)
        quad.rewind();quad.moveTo(destination[6],destination[7]);quad.lineTo(destination[4],destination[5]);quad.lineTo(destination[4],destination[5]+cell*.25f);quad.lineTo(destination[6],destination[7]+cell*.25f);quad.close()
        ink.color=0xff211a2a.toInt();c.drawPath(quad,ink)
        ink.style=Paint.Style.STROKE;ink.strokeWidth=2f;ink.color=0xffac8e5b.toInt();c.drawPath(quad,ink);ink.style=Paint.Style.FILL
        c.save();c.concat(boardMatrix)
        ink.color=0xffb8a17b.toInt();c.drawRoundRect(-.11f,-.11f,8.11f,8.11f,.10f,.10f,ink)
        for(s in 0..63) {
            val file=(s%8).toFloat();val row=(7-s/8).toFloat()
            ink.shader=if((s%8+s/8)%2==1)lightShader else darkShader
            c.drawRect(file,row,file+1,row+1,ink);ink.shader=null
            ink.style=Paint.Style.STROKE;ink.strokeWidth=.012f;ink.color=0x225b5270;c.drawRect(file,row,file+1,row+1,ink);ink.style=Paint.Style.FILL
            if(s==selected || s==lastFrom || s==lastTo) {
                ink.color=if(s==selected)0x6666bba6 else 0x447da292;c.drawRect(file+.025f,row+.025f,file+.975f,row+.975f,ink)
            }
            if(selected>=0 && targets[s]) {
                ink.color=0xff85c0ae.toInt();c.drawCircle(file+.5f,row+.5f,.09f,ink)
            }
            if(check && pieces[s]==checkKing) {
                ink.style=Paint.Style.STROKE;ink.strokeWidth=.045f;ink.color=0xffc2586f.toInt();c.drawRect(file+.05f,row+.05f,file+.95f,row+.95f,ink);ink.style=Paint.Style.FILL
            }
            if(coordinates && (s/8==0 || s%8==0)) {
                ink.color=if((s%8+s/8)%2==1)0xff5d5049.toInt() else 0xffb8a988.toInt();ink.textSize=.17f;ink.typeface=Typeface.DEFAULT
                if(s/8==0)c.drawText(('a'+s%8).toString(),file+.80f,row+.94f,ink)
                if(s%8==0)c.drawText((s/8+1).toString(),file+.06f,row+.20f,ink)
            }
        }
        c.restore()
        // Back-to-front upright silhouettes preserve legibility instead of flattening pieces.
        for(rank in 7 downTo 0)for(file in 0..7) {
            val s=rank*8+file
            if(active && (s==to || s==rookTo))continue
            if(pieces[s].isNotBlank())piece(c,s,pieces[s][0])
        }
        if(active) {
            if(captured>=0 && t<.72f) {
                c.save();ink.alpha=255;piece(c,captured,victim);c.restore()
            }
            val u=t*t*(3f-2f*t)
            val px=centers[from*2]+(centers[to*2]-centers[from*2])*u
            var py=centers[from*2+1]+(centers[to*2+1]-centers[from*2+1])*u
            if(actor.uppercaseChar()=='N')py-=sin(t*PI).toFloat()*cell*.72f
            val size=cell*(.78f+(1f-(from/8*(1-u)+to/8*u))/30f)
            // Short trails differ by piece, and expire with the move packet.
            val trail=when(actor.uppercaseChar()){'Q'->9;'B'->7;'P'->3;else->4}
            for(i in 1..trail) {
                val f=i.toFloat()/trail
                ink.color=if(actor.isUpperCase())0x55e7c77f else 0x667e4da3
                ink.alpha=(65*(1f-f)).toInt();c.drawCircle(px-(px-centers[from*2])*f*.4f,py-(py-centers[from*2+1])*f*.4f,cell*.08f*(1-f),ink)
            }
            ink.alpha=255
            drawPiece(c,px,py,size,if(t>.85f && lastMove.length==5)lastMove[4].let{if(actor.isUpperCase())it.uppercaseChar() else it} else actor)
            if(rookFrom>=0)drawPiece(c,centers[rookFrom*2]+(centers[rookTo*2]-centers[rookFrom*2])*u,centers[rookFrom*2+1]+(centers[rookTo*2+1]-centers[rookFrom*2+1])*u,cell*.85f,if(actor.isUpperCase())'R' else 'r')
            if(t>.72f && (captured>=0 || actor.uppercaseChar() in "NRQ")) {
                val burst=((t-.72f)/.28f).coerceIn(0f,1f)
                for(i in 0..23) {
                    ink.color=if(actor.isUpperCase())0xffeed193.toInt() else 0xffb78acc.toInt();ink.alpha=(190*(1-burst)).toInt()
                    c.drawCircle(centers[to*2]+rays[i*2]*cell*.85f*burst,centers[to*2+1]+rays[i*2+1]*cell*.55f*burst,cell*.025f*(1-burst),ink)
                }
                ink.alpha=255;ink.style=Paint.Style.STROKE;ink.strokeWidth=cell*.015f;ink.color=if(actor.isUpperCase())0x88e7c47a.toInt() else 0x88ac6ad3.toInt()
                c.drawOval(centers[to*2]-cell*burst,centers[to*2+1]-cell*.45f*burst,centers[to*2]+cell*burst,centers[to*2+1]+cell*.45f*burst,ink);ink.style=Paint.Style.FILL
            }
        }
        if(checkmate && now-statusPulse<1800 && statusPulse>0) {
            ink.color=0xffe4c790.toInt();ink.textSize=cell*.35f;ink.textAlign=Paint.Align.CENTER
            c.drawText("CHECKMATE",width/2f,height*.12f,ink);ink.textAlign=Paint.Align.LEFT
        }
        hasRendered=true
        if(active && isAttachedToWindow && hasWindowFocus())postInvalidateOnAnimation()
    }
    private fun piece(c:Canvas,s:Int,ch:Char) {drawPiece(c,centers[s*2],centers[s*2+1],cell*(.80f+(7-s/8)*.014f),ch)}
    private fun material(light:Boolean):Bitmap {
        val bitmap=Bitmap.createBitmap(512,512,Bitmap.Config.ARGB_8888)
        val c=Canvas(bitmap);val p=Paint(Paint.ANTI_ALIAS_FLAG);val path=Path()
        p.shader=LinearGradient(0f,0f,512f,512f,if(light)0xffe1d8bd.toInt() else 0xff30283d.toInt(),if(light)0xffb9b7ad.toInt() else 0xff191c29.toInt(),Shader.TileMode.CLAMP);c.drawPaint(p);p.shader=null
        val random=java.util.Random(if(light)841 else 197)
        p.style=Paint.Style.STROKE
        repeat(45) {
            val y=random.nextFloat()*650-80;p.color=if(light)0x22ffffff else 0x225d496a;p.strokeWidth=if(it%3==0)2f else .7f
            path.rewind();path.moveTo(-20f,y);path.cubicTo(130f,y-80,270f,y+110,540f,y-30);c.drawPath(path,p)
        }
        return bitmap
    }
}
