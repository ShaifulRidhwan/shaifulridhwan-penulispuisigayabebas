package my.aksara.nativeapp.feature.studio

import androidx.compose.foundation.*
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import my.aksara.nativeapp.core.design.*

/** Prompt-only templates: no fake generated output or remote thumbnail fetch. */
internal data class ImageTemplate(
    val id: String, val title: String, val symbol: String, val subtitle: String,
    val style: String, val ratio: String, val prompt: String,
    val top: Color, val bottom: Color
)
internal object StudioTemplates {
    val all = listOf(
        ImageTemplate("poster","Poster","✦","Tipografi editorial",
            "minimal","4:5",
            "Elegant contemporary editorial poster, a single scarlet poppy flower as the focal point, sophisticated print typography composition with clear negative space for a title, textured paper, premium magazine art direction",
            Color(0xffa84b2c),Color(0xff32221e)),
        ImageTemplate("interior","Interior Design","⌂","Ruang 3D minimal",
            "realistic","1:1",
            "Isometric interior design rendering of a modern warm living room, floor-to-ceiling windows, textured cream sofa, walnut coffee table, natural sunlight, realistic materials, harmonious architecture",
            Color(0xffab8d9f),Color(0xff353549)),
        ImageTemplate("logo","Logo","◇","Identiti jenama",
            "minimal","1:1",
            "A clean premium vector-style logo for a contemporary creative studio, minimal monoline abstract geometric symbol, refined balanced negative space, crisp flat design, centered on solid understated background, no watermark",
            Color(0xff5d7c8c),Color(0xff172b43)),
        ImageTemplate("illustration","Illustration","❀","Seni karakter",
            "illustration","4:5",
            "Warm editorial illustration of a young woman gently hugging a large fluffy black and white cat, natural facial expression, painterly lines, soft lavender background, cohesive character proportions",
            Color(0xff9687bf),Color(0xff242945)),
        ImageTemplate("portrait","Potret","◉","Fotografi studio",
            "realistic","4:5",
            "Professional environmental portrait photograph with candid natural expression, beautiful soft studio key light, realistic skin texture, neutral warm background, tasteful cinematic color grading, editorial photography",
            Color(0xff897c73),Color(0xff25272e)),
        ImageTemplate("sticker","Sticker","✳","Set ikon & pelekat",
            "illustration","1:1",
            "A coherent collection of eight cute playful illustrated stickers, celestial symbols, botanical motifs and abstract whimsical animals, thick clean outlines, unified pastel color palette, separate shapes, no text",
            Color(0xff277e82),Color(0xff102f38)),
        ImageTemplate("fantasy","Fantasi","☾","Dunia imaginasi",
            "fantasy","9:16",
            "A cinematic fantasy landscape with monumental ancient architecture among moonlit clouds, subtle amber and sapphire lighting, intricate believable materials, atmospheric depth, breathtaking composition",
            Color(0xff37577a),Color(0xff141426)),
        ImageTemplate("literature","Sastera","✎","Ilustrasi puisi",
            "sastera","4:5",
            "A poetic still life of a handwritten notebook and a single wilted rose beside a rain-soaked window, introspective mood, cinematic film grain, quiet chiaroscuro lighting, elegant subtle literary symbolism",
            Color(0xff775947),Color(0xff1a2028))
    )
    fun byId(id: String): ImageTemplate? = all.firstOrNull { it.id == id }
}

@Composable
internal fun StudioTemplateGallery(onSelect:(ImageTemplate)->Unit) {
    AksaraText("Template Imej",size=15f,weight=700,family=AksaraTypography.heading)
    AksaraText("Pilih gaya, ubah prompt, kemudian jana dengan enjin sebenar.",
        size=10.5f,color=AksaraColors.muted)
    Spacer(Modifier.height(10.dp))
    StudioTemplates.all.chunked(2).forEach { row ->
        Row(Modifier.fillMaxWidth(),horizontalArrangement=Arrangement.spacedBy(9.dp)) {
            row.forEach { template ->
                AksaraGlassSurface(
                    Modifier.weight(1f).height(150.dp).clickable { onSelect(template) },
                    radius=19.dp,blur=5.dp,border=Color(240,216,188,90),
                    brush=Brush.verticalGradient(listOf(template.top,template.bottom))) {
                    Column(Modifier.fillMaxSize().padding(12.dp),
                        verticalArrangement=Arrangement.SpaceBetween) {
                        Box(Modifier.fillMaxWidth().weight(1f),contentAlignment=Alignment.Center) {
                            AksaraText(template.symbol,size=48f,color=Color.White)
                        }
                        AksaraText(template.title,size=12.5f,weight=700,
                            maxLines=1,color=Color.White)
                        AksaraText(template.subtitle,size=9.5f,maxLines=1,
                            color=Color(237,234,230,208))
                    }
                }
            }
            if(row.size==1)Spacer(Modifier.weight(1f))
        }
        Spacer(Modifier.height(9.dp))
    }
}
