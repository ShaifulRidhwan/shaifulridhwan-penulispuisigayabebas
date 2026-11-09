package my.aksara.nativeapp.feature.chat

import android.animation.ValueAnimator
import android.os.Build
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.stateDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.testTag
import androidx.compose.ui.unit.dp
import my.aksara.nativeapp.core.design.*

private val controlBrush get() = cssGradient(145f, listOf(
    Color(244,216,171,14), Color(64,87,112,9)
))
private val controlEdge = Color(244,213,166,77)
private val brightEdge = Color(244,213,166,148)

/** Responds to a pending assistant turn only; does not claim access to hidden reasoning. */
@Composable
internal fun ReactiveThinkingButton(
    processing: Boolean,
    mode: String,
    onClick: () -> Unit
) {
    // Android's animator scale is the system-level reduced-motion switch.
    val allowMotion = Build.VERSION.SDK_INT < 26 || ValueAnimator.areAnimatorsEnabled()
    val pulse = if (processing && allowMotion) {
        val transition = rememberInfiniteTransition(label = "aksara-processing")
        val intensity by transition.animateFloat(
            initialValue = .35f, targetValue = 1f,
            animationSpec = infiniteRepeatable(
                animation = tween(1700), repeatMode = RepeatMode.Reverse),
            label = "thinking-breath"
        )
        intensity
    } else if (processing) .75f else .25f
    AksaraGlassSurface(
        Modifier.size(44.dp).clickable(onClick = onClick).semantics {
            contentDescription = "Thinking Mode"
            stateDescription = (if (mode == "gelap") "Gelap" else "Cahaya") +
                if (processing) " · Memproses" else " · Sedia"
            testTag = "thinking-glass-button"
        }, radius = 13.dp, blur = 2.dp, brush = controlBrush,
        border = if (processing) brightEdge else controlEdge, saturation = 1f
    ) {
        Box(
            Modifier.align(Alignment.Center).size(32.dp)
                .background(Brush.radialGradient(listOf(
                    AksaraColors.gold.copy(alpha = if(processing) .24f * pulse else .10f),
                    Color.Transparent
                )), RoundedCornerShape(999.dp))
        )
        AksaraIcon("brain", Modifier.align(Alignment.Center).size(23.dp),
            AksaraColors.gold.copy(alpha = if(processing) .77f + .23f*pulse else .78f))
    }
}

@Composable
internal fun ReactiveSendButton(enabled: Boolean, onClick: () -> Unit) {
    AksaraGlassSurface(
        Modifier.size(44.dp).clickable(enabled=enabled, onClick=onClick).semantics {
            contentDescription = "Hantar soalan"
            testTag = "send-glass-button"
        }, radius = 13.dp, blur = 2.dp, brush = controlBrush,
        // Idle never loses its glass outline; sending state increases emphasis.
        border = if(enabled) brightEdge else controlEdge, saturation = 1f
    ) {
        Box(
            Modifier.align(Alignment.Center).size(31.dp)
                .background(Brush.radialGradient(listOf(
                    AksaraColors.gold.copy(alpha=if(enabled) .18f else .10f),
                    Color.Transparent
                )), RoundedCornerShape(999.dp))
        )
        AksaraIcon("send", Modifier.align(Alignment.Center).size(21.dp),
            AksaraColors.gold.copy(alpha=if(enabled) 1f else .78f))
    }
}

@Composable
internal fun ReactiveVoiceChip(status: VoiceLinkState, compact: Boolean, onClick: () -> Unit) {
    AksaraGlassSurface(
        Modifier.width(if(compact) 82.328.dp else 93.484.dp)
            .height(AksaraGlassTokens.capsuleHeight)
            .clickable(onClick=onClick).semantics {
                contentDescription = "Voice Chat"
                stateDescription = status.description
                testTag = "voice-status-chip"
            },
        radius=AksaraGlassTokens.capsuleRadius,
        blur=AksaraGlassTokens.capsuleBlur
    ) {
        Row(
            Modifier.align(Alignment.Center),
            horizontalArrangement=Arrangement.spacedBy(if(compact) 4.dp else 5.dp),
            verticalAlignment=Alignment.CenterVertically
        ) {
            // Only the waveform changes tone; the capsule and its label stay neutral.
            AksaraIcon("voice", Modifier.size(if(compact) 15.dp else 17.dp), status.tone)
            AksaraText("Voice Chat",size=if(compact) 9f else 10f,
                line=13f,weight=500,color=AksaraColors.text)
        }
    }
}
