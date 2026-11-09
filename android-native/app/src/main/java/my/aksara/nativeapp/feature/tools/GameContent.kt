package my.aksara.nativeapp.feature.tools

import android.content.Intent
import androidx.compose.runtime.*
import androidx.compose.ui.platform.LocalContext
import my.aksara.nativeapp.GameActivity

/** Launch a separate window; never rotate or resize the live Chat composition. */
@Composable fun GameContent(onClose:()->Unit) {
    val context=LocalContext.current
    LaunchedEffect(Unit) {
        context.startActivity(Intent(context,GameActivity::class.java))
        onClose()
    }
}
