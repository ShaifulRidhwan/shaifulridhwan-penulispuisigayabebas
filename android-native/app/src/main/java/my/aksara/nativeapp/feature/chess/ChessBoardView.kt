package my.aksara.nativeapp.feature.chess

import android.content.Context
import android.graphics.*
import android.view.MotionEvent
import android.view.View
import kotlin.math.*

/** Hardware accelerated native board. Rendering never owns or delays a rules transition. */
open class ChessBoardView(context:Context): View(context) {
    var pieces=Array(64){""}; set(value){field=value; invalidate()}
    var selected=-1; set(value){field=value;updateTargets();invalidate()}
    var legal=emptyList<String>(); set(value){field=value;updateTargets();invalidate()}
    var lastMove=""; set(value){field=value;lastFrom=if(value.length>=4)ChessModel.index(value.take(2)) else -1;lastTo=if(value.length>=4)ChessModel.index(value.substring(2,4)) else -1;invalidate()}
    protected var lastFrom=-1
    protected var lastTo=-1
    protected val targets=BooleanArray(64)
    var disableRenderCachesForBenchmark=false;set(value){check(my.aksara.nativeapp.BuildConfig.DEBUG);field=value}
    private val silhouettes=mutableMapOf<Char,Path>()
    private val pieceImages=mutableMapOf<Char,Bitmap>()
    private val spritePaint=Paint(Paint.ANTI_ALIAS_FLAG or Paint.FILTER_BITMAP_FLAG)
    private val spriteBounds=RectF()
    private fun updateTargets() {
        targets.fill(false)
        if(selected<0)return
        val prefix=ChessModel.uci(selected)
        for(move in legal)if(move.startsWith(prefix))targets[ChessModel.index(move.substring(2,4))]=true
    }
    var checkKing="K"
    var check=false; set(value){field=value;invalidate()}
    var onSquare: (Int)->Unit = {}
    var onDrop: (Int,Int)->Unit = {_,_->}
    var coordinates=true
    var hasRendered=false; protected set
    private val paint=Paint(Paint.ANTI_ALIAS_FLAG)
    private val pearl=LinearGradient(-30f,-35f,30f,30f,intArrayOf(0xffb69a66.toInt(),0xfffff6dd.toInt(),0xffd7c69d.toInt()),floatArrayOf(0f,.38f,1f),Shader.TileMode.CLAMP)
    private val abyss=LinearGradient(-30f,-35f,30f,30f,intArrayOf(0xff181b2b.toInt(),0xff756080.toInt(),0xff251c31.toInt()),floatArrayOf(0f,.38f,1f),Shader.TileMode.CLAMP)
    private var cell=1f
    private var left=0f
    private var top=0f
    private var down=-1
    private var downX=0f
    private var downY=0f
    private var dragged=false
    init { isFocusable=true; contentDescription="Papan catur Cahaya lawan Gelap"; setLayerType(LAYER_TYPE_HARDWARE,null) }
    open fun squareCenter(square:Int):PointF=PointF(left+(square%8+.5f)*cell,top+(7-square/8+.5f)*cell)
    protected open fun squareAt(x:Float,y:Float):Int {
        val f=floor((x-left)/cell).toInt(); val r=7-floor((y-top)/cell).toInt()
        return if(f in 0..7 && r in 0..7) r*8+f else -1
    }
    override fun onSizeChanged(w:Int,h:Int,oldw:Int,oldh:Int) {
        super.onSizeChanged(w,h,oldw,oldh)
        if(my.aksara.nativeapp.BuildConfig.DEBUG)android.util.Log.i("AksaraChess","board ${hashCode()} resized ${w}x$h")
        cell=min(w,h)*.92f/8;left=(w-cell*8)/2;top=(h-cell*8)/2;hasRendered=false
    }
    override fun onDraw(c:Canvas) {
        super.onDraw(c)
        if(!hasRendered && my.aksara.nativeapp.BuildConfig.DEBUG)android.util.Log.i("AksaraChess","board ${hashCode()} first draw ${width}x$height focus=${hasWindowFocus()}")
        hasRendered=true
        paint.color=Color.rgb(8,10,20); c.drawColor(paint.color)
        paint.color=Color.rgb(144,118,72); c.drawRoundRect(left-5,top-5,left+cell*8+5,top+cell*8+5,10f,10f,paint)
        for(s in 0..63) {
            val p=squareCenter(s); val x=p.x-cell/2; val y=p.y-cell/2
            paint.color=if((s%8+s/8)%2==1) Color.rgb(202,196,173) else Color.rgb(45,40,58)
            c.drawRect(x,y,x+cell,y+cell,paint)
            if(s==selected || s==lastFrom || s==lastTo) {
                paint.color=if(s==selected) 0x8855ccbb.toInt() else 0x557fae9a; c.drawRect(x,y,x+cell,y+cell,paint)
            }
            if(check && pieces[s]==checkKing) { paint.color=0x99c83255.toInt(); c.drawRect(x,y,x+cell,y+cell,paint) }
            if(selected>=0 && targets[s]) {
                paint.color=0x99b9ead5.toInt(); c.drawCircle(p.x,p.y,cell*.13f,paint)
            }
            val piece=pieces[s]
            if(piece.isNotBlank()) drawPiece(c,p.x,p.y,cell,piece[0])
            if(coordinates && (s/8==0 || s%8==0)) {
                paint.color=if((s%8+s/8)%2==1) Color.DKGRAY else 0xffc9b992.toInt(); paint.textSize=cell*.18f; paint.typeface=Typeface.DEFAULT
                if(s/8==0)c.drawText(('a'+s%8).toString(),x+cell*.78f,y+cell*.93f,paint)
                if(s%8==0)c.drawText((s/8+1).toString(),x+cell*.05f,y+cell*.21f,paint)
            }
        }
    }
    protected fun drawPiece(c:Canvas,x:Float,y:Float,size:Float,ch:Char) {
        if(!disableRenderCachesForBenchmark) {
            // Bake the same original vectors at 512px, well above their on-screen size.
            // Gradients, silhouettes and shadows are retained; animation reuses GPU textures.
            val image=pieceImages.getOrPut(ch){Bitmap.createBitmap(512,512,Bitmap.Config.ARGB_8888).also{drawPieceVector(Canvas(it),256f,256f,512f,ch)}}
            spriteBounds.set(x-size/2,y-size/2,x+size/2,y+size/2)
            c.drawBitmap(image,null,spriteBounds,spritePaint)
            return
        }
        drawPieceVector(c,x,y,size,ch)
    }
    private fun drawPieceVector(c:Canvas,x:Float,y:Float,size:Float,ch:Char) {
        val light=ch.isUpperCase(); c.save(); c.translate(x,y); c.scale(size/100,size/100)
        paint.shader=null; paint.color=0x55000000; c.drawOval(-30f,25f,32f,39f,paint)
        paint.alpha=255;paint.shader=if(light)pearl else abyss
        paint.style=Paint.Style.FILL
        c.drawRoundRect(-27f,22f,27f,33f,4f,4f,paint)
        val kind=ch.uppercaseChar()
        val path=if(disableRenderCachesForBenchmark)Path() else silhouettes.getOrPut(kind){Path()}
        if(kind=='P')c.drawCircle(0f,-20f,12f,paint)
        if(kind=='K'){c.drawRect(-4f,-45f,4f,-20f,paint);c.drawRect(-12f,-38f,12f,-31f,paint)}
        if(path.isEmpty)when(kind) {
            'P' -> { path.moveTo(-8f,-8f);path.lineTo(8f,-8f);path.lineTo(19f,23f);path.lineTo(-19f,23f);path.close() }
            'R' -> { path.moveTo(-18f,23f);path.lineTo(-14f,-12f);path.lineTo(-22f,-18f);path.lineTo(-22f,-33f);path.lineTo(-12f,-33f);path.lineTo(-12f,-25f);path.lineTo(-5f,-25f);path.lineTo(-5f,-33f);path.lineTo(5f,-33f);path.lineTo(5f,-25f);path.lineTo(12f,-25f);path.lineTo(12f,-33f);path.lineTo(22f,-33f);path.lineTo(22f,-18f);path.lineTo(14f,-12f);path.lineTo(18f,23f);path.close() }
            'N' -> { path.moveTo(-21f,23f);path.cubicTo(-16f,0f,6f,-1f,-1f,-14f);path.lineTo(-20f,-8f);path.lineTo(-25f,-18f);path.lineTo(-10f,-33f);path.lineTo(-4f,-43f);path.lineTo(4f,-34f);path.cubicTo(29f,-29f,25f,9f,20f,23f);path.close() }
            'B' -> { path.moveTo(-20f,23f);path.lineTo(-7f,-1f);path.cubicTo(-32f,-17f,-2f,-36f,0f,-43f);path.cubicTo(3f,-34f,31f,-16f,7f,-1f);path.lineTo(20f,23f);path.close() }
            'Q' -> { path.moveTo(-21f,23f);path.lineTo(-10f,-7f);path.lineTo(-23f,-32f);path.lineTo(-8f,-24f);path.lineTo(0f,-43f);path.lineTo(8f,-24f);path.lineTo(23f,-32f);path.lineTo(10f,-7f);path.lineTo(21f,23f);path.close() }
            'K' -> { path.moveTo(-20f,23f);path.lineTo(-8f,-3f);path.cubicTo(-31f,-16f,-13f,-29f,0f,-21f);path.cubicTo(13f,-29f,31f,-16f,8f,-3f);path.lineTo(20f,23f);path.close() }
        }
        c.drawPath(path,paint)
        paint.shader=null;paint.style=Paint.Style.STROKE; paint.strokeWidth=1.4f; paint.color=if(light) 0xff947449.toInt() else 0xffbc86cf.toInt();c.drawPath(path,paint)
        if(ch.uppercaseChar()=='B')c.drawLine(1f,-30f,9f,-18f,paint)
        if(ch.uppercaseChar()=='N'){paint.style=Paint.Style.FILL;c.drawCircle(-3f,-25f,2f,paint)}
        paint.style=Paint.Style.FILL; c.restore()
    }
    override fun onTouchEvent(e:MotionEvent):Boolean {
        val square=squareAt(e.x,e.y)
        when(e.actionMasked) {
            MotionEvent.ACTION_DOWN -> { down=square;downX=e.x;downY=e.y;dragged=false;parent?.requestDisallowInterceptTouchEvent(true);return true }
            MotionEvent.ACTION_MOVE -> { if(hypot(e.x-downX,e.y-downY)>cell*.15f)dragged=true;return true }
            MotionEvent.ACTION_UP -> { if(my.aksara.nativeapp.BuildConfig.DEBUG)android.util.Log.d("AksaraChess","touch square=$square from=$down selected=$selected"); if(square>=0 && down>=0) { if(dragged && square!=down)onDrop(down,square) else onSquare(square) };performClick();down=-1;return true }
            MotionEvent.ACTION_CANCEL -> {down=-1;return true}
        }
        return true
    }
    override fun performClick():Boolean {super.performClick();return true}
}
