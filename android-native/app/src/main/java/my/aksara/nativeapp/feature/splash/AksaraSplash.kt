package my.aksara.nativeapp.feature.splash

import android.animation.ValueAnimator
import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.delay
import my.aksara.nativeapp.R
import my.aksara.nativeapp.core.design.AksaraText
import my.aksara.nativeapp.core.design.AksaraTypography

/** V1's dark native launch handoff, with a bounded, local convergence sequence.
 * Content initializes underneath. Recreation skips the optional intro; leaving
 * composition cancels its animation. No provider/network readiness is awaited.
 */
@Composable fun AksaraLaunchGate(initialIntro: Boolean = true, reducedMotion: Boolean = !ValueAnimator.areAnimatorsEnabled(), content: @Composable () -> Unit) {
    var visible by remember { mutableStateOf(initialIntro) }
    val reduced = reducedMotion
    val timeline = remember { Animatable(if (reduced) .85f else 0f) }
    LaunchedEffect(Unit) {
        if (visible) {
            if (reduced) delay(200) else timeline.animateTo(1f, tween(2300, easing = LinearEasing))
            visible = false
        }
    }
    Box(Modifier.fillMaxSize().background(Color(0xFF03040C))) {
        content()
        if (visible) AksaraSplashContent(timeline.value, reduced)
    }
}

@Composable fun AksaraSplashContent(progress: Float = .85f, reducedMotion: Boolean = false) {
    val p = progress.coerceIn(0f,1f)
    val identity = if(reducedMotion) 1f else ((p-.48f)/.19f).coerceIn(0f,1f)
    val fade = if(reducedMotion) 1f else ((1f-p)/.10f).coerceIn(0f,1f)
    Box(Modifier.fillMaxSize().testTag("aksara-splash-screen")
        .graphicsLayer { alpha = fade }
        .background(Color(0xFF03040C))
        .clickable(interactionSource = remember { MutableInteractionSource() }, indication = null) {}) {
        Canvas(Modifier.fillMaxSize()) {
            val approach = ((p-.10f)/.40f).coerceIn(0f,1f)
            val ambient = if(reducedMotion) .12f else (.08f + approach*.18f)*(1f-identity*.65f)
            val radius = size.minDimension*.72f
            val left = Offset(size.width*(-.20f+.70f*approach),size.height*.43f)
            val right = Offset(size.width*(1.20f-.70f*approach),size.height*.43f)
            drawCircle(Brush.radialGradient(listOf(Color(0xFFE6B765).copy(alpha=ambient),Color.Transparent),left,radius),radius,left)
            drawCircle(Brush.radialGradient(listOf(Color(0xFF9157ED).copy(alpha=ambient),Color.Transparent),right,radius),radius,right)
            val impact = if(reducedMotion) 0f else (1f-kotlin.math.abs(p-.50f)/.09f).coerceIn(0f,1f)
            val center = Offset(size.width*.5f,size.height*.43f)
            drawCircle(Brush.radialGradient(listOf(Color(0xFFFFE9BE).copy(alpha=impact*.55f),Color.Transparent),center,radius*.4f),radius*.4f,center)
        }
        BoxWithConstraints(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
            Column(Modifier.padding(24.dp).graphicsLayer {
                alpha = identity
                val scale = if(reducedMotion) 1f else .94f+.06f*identity
                scaleX = scale; scaleY = scale
            }, horizontalAlignment = Alignment.CenterHorizontally) {
                Image(painterResource(R.drawable.aksara_glass_sigil),"Official Aksara Glass Sigil",
                    Modifier.size(minOf(156.dp,maxHeight*.32f)))
                Spacer(Modifier.height(20.dp))
                AksaraText("AKSARA A.I.",size=28f,line=36f,weight=700,family=AksaraTypography.heading)
                Spacer(Modifier.height(8.dp))
                AksaraText("ANTARA AKSARA DAN CODE",size=10.5f,line=17f,weight=600,tracking=1.15f,color=Color(0xFFD4C6B2))
            }
        }
    }
}
