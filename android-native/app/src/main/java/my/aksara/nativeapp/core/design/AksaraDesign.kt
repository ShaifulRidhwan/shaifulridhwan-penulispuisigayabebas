package my.aksara.nativeapp.core.design

import androidx.compose.foundation.*
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicText
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.Alignment
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawWithContent
import androidx.compose.ui.graphics.*
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.drawscope.*
import androidx.compose.ui.graphics.vector.PathParser
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.*
import androidx.compose.ui.text.style.LineHeightStyle
import androidx.compose.ui.text.font.*
import androidx.compose.ui.unit.*
import androidx.compose.ui.layout.ContentScale
import dev.chrisbanes.haze.*
import my.aksara.nativeapp.R

object AksaraColors {
    val text = Color(0xfffff4e4)
    val gold = Color(0xffe6c58b)
    val muted = Color(0xffb9c1cd)
    val border = Color(244, 225, 192, 79)
}
object AksaraTypography {
    val body = FontFamily(Font(R.font.dm_sans, weight = FontWeight.Normal), Font(R.font.dm_sans, weight = FontWeight.Medium), Font(R.font.dm_sans, weight = FontWeight.SemiBold), Font(R.font.dm_sans, weight = FontWeight.Bold))
    val heading = FontFamily(Font(R.font.space_grotesk, weight = FontWeight.Normal), Font(R.font.space_grotesk, weight = FontWeight.SemiBold))
    fun style(size: Float = 14f, line: Float = size * 1.6f, weight: Int = 400, color: Color = AksaraColors.text) = TextStyle(
        color = color, fontFamily = body, fontSize = size.sp, lineHeight = line.sp, fontWeight = FontWeight(weight),
        platformStyle = PlatformTextStyle(includeFontPadding = false),lineHeightStyle=LineHeightStyle(LineHeightStyle.Alignment.Center,LineHeightStyle.Trim.None))
}
object AksaraSpacing { val shellSide = 7.dp; val shellBottom = 7.dp; val headerTop = 10.dp; val dialogPadding = 15.dp }
@Composable fun AksaraText(text: String, modifier: Modifier = Modifier, size: Float = 14f, line: Float = size * 1.6f,
    weight: Int = 400, color: Color = AksaraColors.text, tracking: Float = 0f) {
    BasicText(text, modifier, style = AksaraTypography.style(size, line, weight, color).copy(letterSpacing = tracking.sp))
}
val LocalBackdrop = staticCompositionLocalOf<HazeState> { error("Backdrop source missing") }
/** CSS gradient angles use physical viewport geometry, rather than corner-to-corner offsets. */
fun cssGradient(degrees:Float,colors:List<Color>):Brush=object:ShaderBrush(){
    override fun createShader(size:androidx.compose.ui.geometry.Size):Shader{
        val angle=Math.toRadians(degrees.toDouble())
        val dx=kotlin.math.sin(angle).toFloat();val dy=-kotlin.math.cos(angle).toFloat()
        val half=(kotlin.math.abs(size.width*dx)+kotlin.math.abs(size.height*dy))/2f
        val center=Offset(size.width/2f,size.height/2f)
        return LinearGradientShader(center-Offset(dx*half,dy*half),center+Offset(dx*half,dy*half),colors)
    }
}
val GlassGradient: Brush get() = cssGradient(145f,listOf(Color(255,247,224,9), Color(125,167,205,5)))
val DialogGradient: Brush get() = cssGradient(150f,listOf(Color(23,31,45,92), Color(9,14,24,110)))
@Composable fun AksaraGlassSurface(modifier: Modifier = Modifier, radius: Dp = 13.dp, blur: Dp = 2.dp,
    brush: Brush = GlassGradient, border: Color = AksaraColors.border, shape: Shape = RoundedCornerShape(radius), saturation:Float=1.1f, content: @Composable BoxScope.() -> Unit) {
    val haze = LocalBackdrop.current
    val surfaceBackdrop=remember {HazeState()}
    val saturationEffect=remember(saturation){android.graphics.RenderEffect.createColorFilterEffect(android.graphics.ColorMatrixColorFilter(android.graphics.ColorMatrix().apply{setSaturation(saturation)})).asComposeRenderEffect()}
    Box(modifier.clip(shape).border(1.dp,border,shape)) {
        // Record only this surface's processed background; foreground children never
        // feed back into their own blur input. Nested glass samples this layer.
        Box(Modifier.matchParentSize().hazeSource(surfaceBackdrop)
            .graphicsLayer{renderEffect=saturationEffect}.hazeEffect(haze,HazeStyle(tints=emptyList(),backgroundColor=Color(0xff070911),blurRadius=blur*1.75f,noiseFactor=0f))
            .background(brush))
        CompositionLocalProvider(LocalBackdrop provides surfaceBackdrop){content()}
    }
}
@Composable fun AksaraButton(label: String, onClick: () -> Unit, modifier: Modifier = Modifier, icon: String? = null,
    size: Float = 12f, height: Dp = 44.dp, radius: Dp = 13.dp, enabled: Boolean = true, contentColor: Color = AksaraColors.text) {
    val engine=icon=="code"||icon=="terminal"
    val material=when{engine->cssGradient(180f,listOf(Color(255,255,255,11),Color(5,8,16,41)));icon=="brain"->cssGradient(145f,listOf(Color(238,201,140,22),Color(19,31,49,31)));icon=="send"->cssGradient(145f,listOf(Color(244,216,171,14),Color(64,87,112,9)));else->GlassGradient}
    val edge=when{engine->Color(233,205,158,87);icon=="brain"->Color(245,208,157,110);icon=="send"->Color(244,213,166,77);else->AksaraColors.border}
    AksaraGlassSurface(modifier.graphicsLayer { alpha=if(enabled)1f else .6f }.height(height).clip(RoundedCornerShape(radius)).clickable(enabled = enabled, onClick = onClick), radius,blur=if(engine)8.dp else 2.dp,brush=material,border=edge,saturation=if(engine)1.12f else if(icon=="brain"||icon=="send")1f else 1.1f) {
        Row(Modifier.align(Alignment.Center).padding(horizontal = if(size<10f)6.dp else 10.dp), horizontalArrangement = Arrangement.spacedBy(if(size<10f)4.dp else 6.dp), verticalAlignment = Alignment.CenterVertically) {
            if (icon != null) AksaraIcon(icon, Modifier.size(if(icon=="code")15.dp else if(icon=="terminal")17.dp else if(icon=="brain")23.dp else if(icon=="send")19.dp else if(icon=="voice"&&size<10)12.dp else if(size<10)15.dp else 18.dp), contentColor)
            if (label.isNotEmpty()) AksaraText(label, size = size, line = size*1.4f, weight = 500, color = contentColor)
        }
    }
}
@Composable fun AksaraBackground(modifier: Modifier = Modifier) {
    BoxWithConstraints(modifier) {
        Image(painterResource(if(maxWidth>760.dp) R.drawable.aksara_cinematic_desktop else R.drawable.aksara_cinematic_mobile), null,
            Modifier.fillMaxSize(), contentScale = ContentScale.Crop)
        Box(Modifier.fillMaxSize().background(Brush.verticalGradient(0f to Color(3,6,12,33), .30f to Color(4,7,13,46), .55f to Color(3,6,13,82), 1f to Color(3,5,10,156))))
    }
}
private val iconPaths = mapOf(
    "sun" to listOf("M16 12a4 4 0 1 1-8 0a4 4 0 1 1 8 0Z", "M12 2v2m0 16v2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M2 12h2m16 0h2M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42"),
    "moon" to listOf("M20.5 14.3A8.5 8.5 0 0 1 9.7 3.5 8.5 8.5 0 1 0 20.5 14.3Z"),
    "send" to listOf("m5 12 14-9-3.6 18L11 13l-6-1Z", "m11 13 8-10"),
    "attach" to listOf("m21.4 11.6-8.9 9a6.4 6.4 0 0 1-9.1-9.1L13 1.9a4.3 4.3 0 0 1 6.1 6.1l-9.5 9.5a2.2 2.2 0 0 1-3.1-3.1l8.6-8.6"),
    "brain" to listOf("M12 20V5a3 3 0 0 0-5.8-.9A3.7 3.7 0 0 0 3.5 9a3.4 3.4 0 0 0 .1 5.4A3.6 3.6 0 0 0 6.8 19 3 3 0 0 0 12 20Zm0 0V5a3 3 0 0 1 5.8-.9A3.7 3.7 0 0 1 20.5 9a3.4 3.4 0 0 1-.1 5.4A3.6 3.6 0 0 1 17.2 19 3 3 0 0 1 12 20Z", "M5.5 9h3l2 2.1v3.2M18.5 9h-3l-2 2.1v3.2M6.2 15.5h2.6m6.4 0h2.6"),
    "terminal" to listOf("M5.3 4.2h13.4a2.8 2.8 0 0 1 2.8 2.8v10a2.8 2.8 0 0 1-2.8 2.8H5.3a2.8 2.8 0 0 1-2.8-2.8V7a2.8 2.8 0 0 1 2.8-2.8Z", "m7 9 3.7 3-3.7 3m6.2.4h4.2"),
    "code" to listOf("M8 6h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2Z", "M10 9h4a1 1 0 0 1 1 1v4a1 1 0 0 1-1 1h-4a1 1 0 0 1-1-1v-4a1 1 0 0 1 1-1Z", "M9 2v4m6-4v4M9 18v4m6-4v4M2 9h4m-4 6h4m12-6h4m-4 6h4"),
    "network" to listOf("M5 5.5 12 12l7-7M12 12l7.3 7M12 12 4.8 18.5", "m12 7.2 1.25 3.55L16.8 12l-3.55 1.25L12 16.8l-1.25-3.55L7.2 12l3.55-1.25Z"),
    "grid" to listOf("M4 4h6v6H4ZM14 4h6v6h-6ZM4 14h6v6H4ZM14 14h6v6h-6Z"),
    "voice" to listOf("M3 10v4m4-7v10m5-13v16m5-13v10m4-7v4"),
    "mic" to listOf("M9 6a3 3 0 0 1 6 0v6a3 3 0 0 1-6 0ZM5 11v1a7 7 0 0 0 14 0v-1M12 19v3m-4 0h8"),
    "close" to listOf("m6 6 12 12M6 18 18 6"),
    "book" to listOf("M4 5.5c3-1.5 5.5-1.5 8 .2 2.5-1.7 5-1.7 8-.2V19c-3-1.5-5.5-1.5-8 .2-2.5-1.7-5-1.7-8-.2zM12 5.7v13.5"),
    "shield" to listOf("M12 2 4 5v6c0 5.4 3.6 9.4 8 11 4.4-1.6 8-5.6 8-11V5l-8-3Z", "m9 12 2 2 4-4"),
    "end" to listOf("M4 8q8-7 16 0v6h-4v-4q-4-2-8 0v4H4Z"),
    "speaker" to listOf("M4 9h4l5-4v14l-5-4H4ZM17 8a6 6 0 0 1 0 8M20 5a10 10 0 0 1 0 14")
)
@Composable fun AksaraIcon(name: String, modifier: Modifier = Modifier.size(20.dp), color: Color = AksaraColors.gold) {
    val paths = remember(name) { iconPaths[name].orEmpty().map { PathParser().parsePathString(it).toPath() } }
    Canvas(modifier) { scale(size.width/24f, size.height/24f, pivot = Offset.Zero) { paths.forEach { drawPath(it, color, style = Stroke(1.5f, cap = StrokeCap.Round, join = StrokeJoin.Round)) }; if(name=="network")listOf(Offset(5f,5.5f),Offset(19f,5f),Offset(19.3f,19f),Offset(4.8f,18.5f)).forEach{drawCircle(color,1.55f,it)} } }
}
