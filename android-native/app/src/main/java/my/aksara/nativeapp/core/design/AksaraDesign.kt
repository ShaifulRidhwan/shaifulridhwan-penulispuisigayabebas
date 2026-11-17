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
import androidx.compose.ui.text.style.TextMotion
import androidx.compose.ui.text.font.*
import androidx.compose.ui.unit.*
import androidx.compose.ui.layout.ContentScale
import dev.chrisbanes.haze.*
import my.aksara.nativeapp.R


/**
 * Safe glass-frame gutters for immersive Android screens.
 *
 * Compose safeDrawing handles cutouts and visible system bars; these additional
 * bounded gutters protect border strokes from the *physical* rounded display
 * corners, which safeDrawing does not describe. Background art remains edge-to-edge.
 */
data class AksaraDeviceMargins(val horizontal: Dp, val top: Dp, val bottom: Dp)
@Composable fun aksaraDeviceMargins(): AksaraDeviceMargins {
    val view = androidx.compose.ui.platform.LocalView.current
    val density = androidx.compose.ui.platform.LocalDensity.current.density
    val insets = if (android.os.Build.VERSION.SDK_INT >= 31) view.rootWindowInsets else null
    val topRadiusPx = if (android.os.Build.VERSION.SDK_INT >= 31) maxOf(
        insets?.getRoundedCorner(android.view.RoundedCorner.POSITION_TOP_LEFT)?.radius ?: 0,
        insets?.getRoundedCorner(android.view.RoundedCorner.POSITION_TOP_RIGHT)?.radius ?: 0
    ) else 0
    val bottomRadiusPx = if (android.os.Build.VERSION.SDK_INT >= 31) maxOf(
        insets?.getRoundedCorner(android.view.RoundedCorner.POSITION_BOTTOM_LEFT)?.radius ?: 0,
        insets?.getRoundedCorner(android.view.RoundedCorner.POSITION_BOTTOM_RIGHT)?.radius ?: 0
    ) else 0
    val topRadiusDp = topRadiusPx / density
    val bottomRadiusDp = bottomRadiusPx / density
    val widestRadiusDp = maxOf(topRadiusDp, bottomRadiusDp)
    return AksaraDeviceMargins(
        horizontal = maxOf(12f, minOf(20f, widestRadiusDp * .35f)).dp,
        top = maxOf(6f, minOf(13f, topRadiusDp * .25f)).dp,
        bottom = maxOf(12f, minOf(20f, bottomRadiusDp * .36f)).dp
    )
}

/** Shared glass dimensions: pill controls stay equal within their respective rows. */
object AksaraGlassTokens {
    val capsuleHeight = 40.dp
    val capsuleBlur = 16.dp
    val capsuleRadius = 999.dp
    val controlHeight = 42.dp
    val controlRadius = 17.dp
    val panelRadius = 20.dp
}
object AksaraColors {
    val text = Color(0xfffff4e4)
    val gold = Color(0xffe6c58b)
    val muted = Color(0xffb9c1cd)
    val border = Color(244, 225, 192, 79)
}
@OptIn(ExperimentalTextApi::class)
object AksaraTypography {
    // Explicit supported axes avoid relying on platform synthesis or an absent 'ital' axis.
    private fun variable(id:Int,weight:Int)=Font(id,weight=FontWeight(weight),variationSettings=if(id==R.font.dm_sans)FontVariation.Settings(FontVariation.weight(weight),FontVariation.opticalSizing(14.sp)) else FontVariation.Settings(FontVariation.weight(weight)))
    val body = FontFamily(listOf(400,450,500,600,650,700).map{variable(R.font.dm_sans,it)})
    val heading = FontFamily(listOf(400,500,600,650,700).map{variable(R.font.space_grotesk,it)})
    fun style(size: Float = 14f, line: Float = size * 1.6f, weight: Int = 400, color: Color = AksaraColors.text) = TextStyle(
        color = color, fontFamily = body, fontSize = size.sp, lineHeight = line.sp, fontWeight = FontWeight(weight), textMotion=TextMotion.Animated,
        platformStyle = PlatformTextStyle(includeFontPadding = false),lineHeightStyle=LineHeightStyle(LineHeightStyle.Alignment.Center,LineHeightStyle.Trim.None))
}
object AksaraSpacing { val shellSide = 7.dp; val shellBottom = 7.dp; val headerTop = 10.dp; val dialogPadding = 15.dp }
@Composable fun AksaraText(text: String, modifier: Modifier = Modifier, size: Float = 14f, line: Float = size * 1.6f,
    weight: Int = 400, color: Color = AksaraColors.text, tracking: Float = 0f, family:FontFamily=AksaraTypography.body) {
    BasicText(text, modifier, style = AksaraTypography.style(size, line, weight, color).copy(letterSpacing = tracking.sp,fontFamily=family))
}
val LocalBackdrop = staticCompositionLocalOf<HazeState> { error("Backdrop source missing") }
// Paint between the nearest backdrop root and a descendant filter, e.g. the status bar tint.
val LocalBackdropPaints=staticCompositionLocalOf<List<HazeState>>{emptyList()}
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
// ShaderBrush is immutable; reuse its instance across streaming and clock recompositions.
private val SharedGlassGradient: Brush by lazy {
    cssGradient(145f,listOf(Color(255,247,224,9), Color(125,167,205,5)))
}
private val SharedDialogGradient: Brush by lazy {
    cssGradient(150f,listOf(Color(23,31,45,92), Color(9,14,24,110)))
}
val GlassGradient: Brush get() = SharedGlassGradient
val DialogGradient: Brush get() = SharedDialogGradient
@Composable fun AksaraGlassSurface(modifier: Modifier = Modifier, radius: Dp = 13.dp, blur: Dp = 2.dp,
    brush: Brush = GlassGradient, border: Color = AksaraColors.border, shape: Shape = RoundedCornerShape(radius), saturation:Float=1.1f, content: @Composable BoxScope.() -> Unit) {
    val haze = LocalBackdrop.current
    val ancestorPaints=LocalBackdropPaints.current
    val surfaceBackdrop=remember {HazeState()}
    val saturationEffect=remember(saturation){android.graphics.RenderEffect.createColorFilterEffect(android.graphics.ColorMatrixColorFilter(android.graphics.ColorMatrix().apply{setSaturation(saturation)})).asComposeRenderEffect()}
    val effectStyle=remember(blur) { HazeStyle(tints=emptyList(),backgroundColor=Color.Transparent,blurRadius=blur*1.75f,noiseFactor=0f) }
    val backdropEffects=ancestorPaints.fold(Modifier.hazeEffect(haze,effectStyle)){m,paint->m.hazeEffect(paint,effectStyle)}
    Box(modifier.clip(shape).border(1.dp,border,shape)) {
        // CSS backdrop-filter establishes a backdrop root. Descendant filters sample
        // this surface's translucent paint, while the parent backdrop stays behind it.
        // Keep the incoming filtered image outside the descendant source recording.
        Box(Modifier.matchParentSize()
            .graphicsLayer{renderEffect=saturationEffect}.then(backdropEffects)
            .hazeSource(surfaceBackdrop).background(brush))
        CompositionLocalProvider(LocalBackdrop provides surfaceBackdrop,LocalBackdropPaints provides emptyList()){content()}
    }
}
@Composable fun AksaraButton(label: String, onClick: () -> Unit, modifier: Modifier = Modifier, icon: String? = null,
    size: Float = 12f, height: Dp = 44.dp, radius: Dp = 13.dp, enabled: Boolean = true, contentColor: Color = AksaraColors.text, leadingText:String?=null,iconSize:Dp?=null) {
    val engine=icon=="code"||icon=="terminal"
    val material=remember(icon) { when{engine->cssGradient(180f,listOf(Color(255,255,255,11),Color(5,8,16,41)));icon=="brain"||icon=="sun"||icon=="moon"->cssGradient(145f,listOf(Color(238,201,140,22),Color(19,31,49,31)));icon=="send"->cssGradient(145f,listOf(Color(244,216,171,14),Color(64,87,112,9)));else->GlassGradient} }
    val edge=when{engine->Color(233,205,158,87);icon=="brain"||icon=="sun"||icon=="moon"->Color(245,208,157,110);icon=="send"->Color(244,213,166,77);else->AksaraColors.border}
    AksaraGlassSurface(modifier.graphicsLayer { alpha=if(enabled)1f else .6f }.height(height).clip(RoundedCornerShape(radius)).aksaraBouncyClick(enabled = enabled, onClick = onClick), radius,blur=if(engine)8.dp else if(radius >= 100.dp) AksaraGlassTokens.capsuleBlur else 2.dp,brush=material,border=edge,saturation=if(engine)1.12f else if(icon=="brain"||icon=="sun"||icon=="moon"||icon=="send")1f else 1.1f) {
        Row(Modifier.align(Alignment.Center).padding(horizontal = if(leadingText!=null)11.dp else if(size<10f)6.dp else 10.dp), horizontalArrangement = Arrangement.spacedBy(if(leadingText!=null)7.dp else if(size<10f)4.dp else 6.dp), verticalAlignment = Alignment.CenterVertically) {
            if(leadingText!=null)AksaraText(leadingText,size=size,line=size*1.4f,weight=500,color=AksaraColors.gold)
            if (icon != null) AksaraIcon(icon, Modifier.size(iconSize?:if(icon=="code")15.dp else if(icon=="terminal")17.dp else if(icon=="brain")23.dp else if(icon=="send")19.dp else if(icon=="voice"&&size<10)12.dp else if(size<10)15.dp else 18.dp), contentColor)
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
    "search" to listOf("M10.5 3.5a7 7 0 1 0 0 14a7 7 0 1 0 0-14Z", "m16 16 5 5"),
    // Unique semantic identities, shared 24dp stroke treatment with all native icons.
    "settings" to listOf("M9.5 3h5l.5 2.4 1.7 1 2.3-.8 2.5 4.3-1.8 1.6v2l1.8 1.6-2.5 4.3-2.3-.8-1.7 1-.5 2.4h-5L9 19.6l-1.7-1-2.3.8-2.5-4.3 1.8-1.6v-2L2.5 9.9 5 5.6l2.3.8 1.7-1Z", "M15 12a3 3 0 1 1-6 0a3 3 0 1 1 6 0Z"),
    "home" to listOf("m3 10 9-7 9 7", "M5 9v12h14V9", "M9 21v-8h6v8"),
    "image" to listOf("M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z", "M8 9a1.5 1.5 0 1 0 0-3a1.5 1.5 0 1 0 0 3Z", "m3 18 6-6 4 4 3-3 5 5"),
    "video" to listOf("M3 6h13a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2Z", "m18 10 5-3v10l-5-3"),
    "file-text" to listOf("M5 2h9l5 5v15H5a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2Z", "M14 2v5h5", "M7 12h8M7 16h8"),
    "audio" to listOf("M10 5v11a4 4 0 1 1-2-3.5V7l12-3v10a4 4 0 1 1-2-3.5V4"),

    "novel" to listOf("M3 5c3-1.6 6-1.6 9 .1 3-1.7 6-1.7 9-.1v14c-3-1.6-6-1.6-9 .1-3-1.7-6-1.7-9-.1Z", "M12 5v14", "M6 9h3m6 0h3M6 13h3m6 0h3"),
    // Same 24dp single-stroke language as Home, Studio and Library. No separate icon tiles.
    "chess-knight" to listOf("M6 21h13", "M7.5 18.5h10l-.8-4.1 2.1-2.4-1.5-3.6-4-4.2-1.4 3.1-4.2 2.6-1.6 5 2.4 1.4Z", "M10.8 10.6h.2"),
    "crossed-swords" to listOf("M4 4l3.5 1 10.5 10.5M20 20l-5-5", "M20 4l-3.5 1L6 15.5M4 20l5-5", "M3.5 17.5l3 3M17.5 17.5l3 3"),
    "chat" to listOf("M4 4h13a3 3 0 0 1 3 3v8a3 3 0 0 1-3 3H9l-5 4v-4a3 3 0 0 1-3-3V7a3 3 0 0 1 3-3Z", "M6 9h9M6 13h6"),
    "research" to listOf("M5 3h10l4 4v4M15 3v4h4M5 3v18h10", "M14.5 17a3.5 3.5 0 1 0 7 0a3.5 3.5 0 1 0-7 0Z", "m21 20 2 2"),
    "activity" to listOf("M3 20h18", "M5 17 9 12l3 3 6-9", "m15 6h3v3"),
    "external" to listOf("M13 4h7v7M20 4l-9 9", "M19 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h5"),

    "location" to listOf(
        "M12 22s-7.5-6.4-7.5-12a7.5 7.5 0 0 1 15 0C19.5 15.6 12 22 12 22Z",
        "M12 7.5a2.5 2.5 0 1 0 0 5a2.5 2.5 0 1 0 0-5Z"
    ),
    "clock" to listOf("M12 3a9 9 0 1 1 0 18a9 9 0 1 1 0-18Z","M12 7v5l3 2"),
    "aksara" to listOf("M12 2.5 20.5 7.2v9.6L12 21.5l-8.5-4.7V7.2Z", "M7.6 17.3 12 6.3l4.4 11", "M9.4 13.2h5.2"),
    "gemini" to listOf("M12 2c1 5.3 4.7 9 10 10-5.3 1-9 4.7-10 10-1-5.3-4.7-9-10-10 5.3-1 9-4.7 10-10Z"),
    "groq" to listOf("M5 7a2 2 0 1 1 4 0a2 2 0 1 1-4 0ZM15 17a2 2 0 1 1 4 0a2 2 0 1 1-4 0ZM8 8l8 8M17 6l-8 12"),
    "workers_ai" to listOf("M7 18h11a4 4 0 0 0 .2-8 6 6 0 0 0-11-2A5 5 0 0 0 7 18Z"),
    "openrouter" to listOf("M3 12h11m-4-5 5 5-5 5M16 5h5v14h-5"),
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
/** Accessible to regression tests so an unknown icon cannot silently render blank. */
internal fun isKnownAksaraIcon(name: String): Boolean = iconPaths.containsKey(name)

@Composable fun AksaraIcon(name: String, modifier: Modifier = Modifier.size(20.dp), color: Color = AksaraColors.gold) {
    val paths = remember(name) { iconPaths[name].orEmpty().map { PathParser().parsePathString(it).toPath() } }
    Canvas(modifier) { scale(size.width/24f, size.height/24f, pivot = Offset.Zero) { paths.forEach { drawPath(it, color, style = Stroke(1.5f, cap = StrokeCap.Round, join = StrokeJoin.Round)) }; if(name=="network")listOf(Offset(5f,5.5f),Offset(19f,5f),Offset(19.3f,19f),Offset(4.8f,18.5f)).forEach{drawCircle(color,1.55f,it)} } }
}
