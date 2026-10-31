package my.aksara.ai.ui

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.util.Base64
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.produceState
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import my.aksara.ai.data.AttachmentDraft
import my.aksara.ai.data.ChatMedia

/**
 * Decodes only a sampled local thumbnail of a pending image.
 * No file survives send/remove, and the full attachment remains in transient request memory.
 */
object AttachmentPreviewSizing {
    fun sampleSize(width: Int, height: Int, maxDimension: Int = 600): Int {
        if (width <= 0 || height <= 0 || maxDimension < 1) return 1
        var sampling = 1
        while (maxOf(width, height) / sampling > maxDimension && sampling < 256) {
            sampling *= 2
        }
        return sampling
    }
}

private fun previewBitmap(media: ChatMedia): Bitmap? {
    if (!media.mimeType.startsWith("image/") || media.data.length > 4_600_000) {
        return null
    }
    return runCatching {
        val bytes = Base64.decode(media.data, Base64.DEFAULT)
        val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
        BitmapFactory.decodeByteArray(bytes, 0, bytes.size, bounds)
        if (bounds.outWidth <= 0 || bounds.outHeight <= 0 ||
            bounds.outWidth > 12_000 || bounds.outHeight > 12_000
        ) return null
        val options = BitmapFactory.Options().apply {
            inSampleSize = AttachmentPreviewSizing.sampleSize(
                bounds.outWidth, bounds.outHeight
            )
            inPreferredConfig = Bitmap.Config.RGB_565
        }
        BitmapFactory.decodeByteArray(bytes, 0, bytes.size, options)
    }.getOrNull()
}

@Composable
fun AksaraAttachmentPreview(attachment: AttachmentDraft) {
    val images by produceState(
        initialValue = emptyList<Pair<ChatMedia, Bitmap?>>(),
        key1 = attachment
    ) {
        // Decode multi-megabyte images off the main thread, then show sampled previews.
        value = withContext(Dispatchers.Default) {
            attachment.media.filter { it.mimeType.startsWith("image/") }
                .take(3).map { it to previewBitmap(it) }
        }
    }
    if (images.isEmpty()) return
    Row(
        modifier = Modifier.fillMaxWidth()
            .horizontalScroll(rememberScrollState())
            .padding(top = 5.dp, bottom = 3.dp),
        horizontalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        images.forEach { (media, bitmap) ->
            Column(
                modifier = Modifier.width(108.dp)
                    .background(Color(0xAA1B2840), RoundedCornerShape(12.dp))
                    .border(1.dp, Color(0x448FA8FF), RoundedCornerShape(12.dp))
                    .padding(6.dp),
                verticalArrangement = Arrangement.spacedBy(4.dp)
            ) {
                if (bitmap != null) {
                    Image(
                        bitmap = bitmap.asImageBitmap(),
                        contentDescription = "Pratonton: " + media.name,
                        modifier = Modifier.size(width = 94.dp, height = 86.dp)
                            .clip(RoundedCornerShape(8.dp)),
                        contentScale = ContentScale.Crop
                    )
                } else {
                    Text("Imej", modifier = Modifier.height(86.dp),
                        color = Color(0xFFB7C9F5), fontSize = 12.sp)
                }
                Text(media.name, color = Color(0xFFDAE2F6), fontSize = 10.sp,
                    maxLines = 1)
            }
        }
    }
}
