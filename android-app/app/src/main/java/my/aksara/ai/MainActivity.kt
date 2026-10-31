package my.aksara.ai

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import my.aksara.ai.ui.AksaraApp
import my.aksara.ai.ui.AksaraTheme

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            AksaraTheme {
                AksaraApp()
            }
        }
    }
}
