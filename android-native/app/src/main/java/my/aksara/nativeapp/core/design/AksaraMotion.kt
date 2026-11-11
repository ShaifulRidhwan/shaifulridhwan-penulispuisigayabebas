package my.aksara.nativeapp.core.design

import android.animation.ValueAnimator
import androidx.compose.animation.core.Spring
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.spring
import androidx.compose.animation.core.tween
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsPressedAsState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.graphicsLayer

/** Central motion policy: honor Android's reduced-motion / animator scale. */
internal fun aksaraAnimationsEnabled():Boolean = ValueAnimator.areAnimatorsEnabled()

/**
 * Touch feedback is transform-only. No layout resizing or backdrop recomposition.
 * The same spring governs buttons and small interactive cards.
 */
@Composable
fun Modifier.aksaraBouncyClick(
    enabled:Boolean=true,
    onClick:()->Unit
):Modifier {
    val interaction=remember { MutableInteractionSource() }
    val pressed by interaction.collectIsPressedAsState()
    val motion=aksaraAnimationsEnabled()
    val scale by animateFloatAsState(
        targetValue=if(enabled && pressed && motion) .965f else 1f,
        animationSpec=spring(
            dampingRatio=Spring.DampingRatioMediumBouncy,
            stiffness=Spring.StiffnessMedium
        ),
        label="aksara-press-scale"
    )
    return this.graphicsLayer {
        scaleX=scale
        scaleY=scale
    }.clickable(
        enabled=enabled,
        interactionSource=interaction,
        indication=null,
        onClick=onClick
    )
}

/** Subtle modal entrance, implemented on the GPU layer to avoid relayout. */
@Composable
fun Modifier.aksaraModalEntrance():Modifier {
    val motion=aksaraAnimationsEnabled()
    var entered by remember { mutableStateOf(false) }
    LaunchedEffect(Unit) { entered=true }
    val scale by animateFloatAsState(
        targetValue=if(entered || !motion)1f else .96f,
        animationSpec=spring(
            dampingRatio=Spring.DampingRatioMediumBouncy,
            stiffness=Spring.StiffnessMediumLow
        ),
        label="aksara-modal-scale"
    )
    val alpha by animateFloatAsState(
        targetValue=if(entered || !motion)1f else 0f,
        animationSpec=tween(durationMillis=170),
        label="aksara-modal-opacity"
    )
    return this.graphicsLayer {
        scaleX=scale
        scaleY=scale
        this.alpha=alpha
    }
}
