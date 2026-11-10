package my.aksara.nativeapp.feature.chat

import androidx.compose.foundation.Canvas
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.scale

/** Small static glass glyphs used exclusively by Explore navigation. */
@Composable
internal fun ExploreGameIcon(kind: String, modifier: Modifier = Modifier) {
    Canvas(modifier) {
        scale(size.width / 32f, size.height / 32f, pivot = Offset.Zero) {
            val gold = Color(0xFFE6C58B)
            val violet = Color(0xFFC1A0FF)
            val edge = Brush.linearGradient(listOf(gold, violet), Offset.Zero, Offset(32f,32f))
            drawRoundRect(Brush.linearGradient(listOf(Color(0xFF343043),Color(0xFF101322))),
                size = androidx.compose.ui.geometry.Size(32f,32f), cornerRadius = CornerRadius(8f))
            drawRoundRect(edge, size = androidx.compose.ui.geometry.Size(32f,32f),
                cornerRadius = CornerRadius(8f), style = Stroke(.8f))
            if (kind == "explore-knight") {
                val knight = Path().apply {
                    moveTo(9f,25f); lineTo(23f,25f); lineTo(22f,22f)
                    cubicTo(20f,18f,25f,15f,21f,10f)
                    lineTo(18f,7f); lineTo(17f,4.5f); lineTo(14f,8f)
                    lineTo(8f,14f); lineTo(10f,17f); lineTo(15f,15f)
                    cubicTo(15f,19f,10f,19f,10f,22f); close()
                }
                drawPath(knight, Brush.linearGradient(listOf(Color(0xFF69506C),Color(0xFF191B2D))))
                drawPath(knight, edge, style = Stroke(1.3f))
                drawCircle(gold,1f,Offset(16f,10.5f))
                drawLine(violet,Offset(8f,27f),Offset(24f,27f),1.4f)
            } else {
                fun sword(mirror: Boolean, tone: Color) {
                    fun point(x: Float,y: Float) = Offset(if(mirror)32f-x else x,y)
                    val blade = Path().apply {
                        val points = listOf(point(7f,5f),point(12f,7f),point(23f,21f),point(20f,23f),point(8f,10f))
                        moveTo(points[0].x,points[0].y)
                        points.drop(1).forEach { lineTo(it.x,it.y) }; close()
                    }
                    drawPath(blade,Brush.linearGradient(listOf(tone,Color(0xFF42405B))))
                    drawPath(blade,tone,style=Stroke(.8f))
                    drawLine(tone,point(18f,24f),point(25f,18f),2f)
                    drawLine(tone,point(22f,23f),point(26f,27f),2.5f)
                }
                sword(false,gold)
                sword(true,violet)
            }
        }
    }
}
