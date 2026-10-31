package my.aksara.ai.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import io.github.sceneview.Scene
import io.github.sceneview.createEnvironment
import io.github.sceneview.math.Position
import io.github.sceneview.rememberCameraManipulator
import io.github.sceneview.rememberCameraNode
import io.github.sceneview.rememberEngine
import io.github.sceneview.rememberEnvironment
import io.github.sceneview.rememberEnvironmentLoader
import io.github.sceneview.rememberModelInstance
import io.github.sceneview.rememberModelLoader

/**
 * Private non-commercial QA ONLY. The original Bilik Antara web avatar uses
 * TalkingHead / Ready Player Me brunette.glb under CC BY-NC 4.0.
 * Never bundle the model into a distributed release APK or present it as
 * an AKSARA-owned character. This debug-only renderer loads the identical
 * pinned reference model on demand, then discards it on leaving Voice.
 *
 * Native Filament/SceneView is a real 3D engine, not a webview or a flat PNG.
 * Scene matching and lip sync are not yet exact (GLB alone is not the JS rig).
 */
private const val NONCOMMERCIAL_QA_MODEL =
    "https://cdn.jsdelivr.net/gh/met4citizen/TalkingHead@" +
        "166b443a445eeb63a4ea02270aa9e7d6ba8b4d88/avatars/brunette.glb"

@Composable
fun AksaraAvatar3D(modifier: Modifier = Modifier) {
    if (!my.aksara.ai.BuildConfig.DEBUG) return
    val engine = rememberEngine()
    val modelLoader = rememberModelLoader(engine)
    val environmentLoader = rememberEnvironmentLoader(engine)
    val environment = rememberEnvironment(environmentLoader) {
        createEnvironment(environmentLoader)
    }
    val camera = rememberCameraNode(engine) {
        position = Position(y = 0.55f, z = 2.2f)
    }
    val model = rememberModelInstance(modelLoader, NONCOMMERCIAL_QA_MODEL)
    Box(
        modifier = modifier
            .clip(RoundedCornerShape(20.dp))
            .background(
                Brush.verticalGradient(
                    listOf(Color(0xBB24212C), Color(0xFF090D14))
                )
            )
    ) {
        Scene(
            modifier = Modifier.fillMaxSize(),
            engine = engine,
            modelLoader = modelLoader,
            cameraNode = camera,
            environment = environment,
            cameraManipulator = rememberCameraManipulator()
        ) {
            model?.let { loaded ->
                ModelNode(
                    modelInstance = loaded,
                    scaleToUnits = 1.6f,
                    autoAnimate = true
                )
            }
        }
        if (model == null) {
            Text(
                "Memuatkan model 3D…",
                modifier = Modifier.align(Alignment.BottomCenter),
                color = Color(0xFFEAC17C),
                fontSize = 10.sp
            )
        }
    }
}
