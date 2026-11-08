package my.aksara.nativeapp.feature.library

import androidx.compose.foundation.*
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import my.aksara.nativeapp.core.design.*
import org.json.JSONArray
import org.json.JSONObject

/** Avoid indexing an empty novel after a failed asset load or while loading. */
internal fun novelIndexOrNull(requested:Int,sectionCount:Int):Int? =
    if(sectionCount<=0) null else requested.coerceIn(0,sectionCount-1)

private data class Poem(val id:Int,val title:String,val lines:List<String>)
private data class Section(val title:String,val paragraphs:List<String>)

@Composable fun LibraryContent(onNavigate:(String)->Unit) {
    val context=LocalContext.current
    var poems by remember{mutableStateOf<List<Poem>>(emptyList())}
    var error by remember{mutableStateOf<String?>(null)}
    var query by rememberSaveable{mutableStateOf("")}
    var selected by rememberSaveable{mutableIntStateOf(-1)}
    LaunchedEffect(Unit){
        try{
            poems=withContext(Dispatchers.IO){
                val raw=context.assets.open("karya-index.json").bufferedReader().use{it.readText()}
                val list=JSONArray(raw)
                (0 until list.length()).map{list.getJSONObject(it)}.map{p->
                    val lines=p.optJSONArray("lines")?:JSONArray()
                    Poem(p.optInt("id"),p.getString("title"),(0 until lines.length()).map{lines.optString(it)})
                }
            }
        }catch(e:Exception){error=e.message?:"Arkib puisi gagal dibaca."}
    }
    Spacer(Modifier.height(14.dp))
    AksaraText("Perpustakaan AKSARA · Native",size=14f,weight=650)
    AksaraText("Novel dan puisi asal disimpan bersama APK. Boleh dibaca tanpa internet.",size=11f,color=AksaraColors.muted)
    Spacer(Modifier.height(12.dp))
    AksaraButton("Baca novel · Antara Cahaya dan Gelap",{onNavigate("novel")},Modifier.fillMaxWidth(),height=49.dp,icon="book")
    Spacer(Modifier.height(14.dp))
    AksaraText("Arkib puisi · "+poems.size+" karya",size=12f,weight=600)
    Spacer(Modifier.height(8.dp))
    AksaraGlassSurface(Modifier.fillMaxWidth().height(46.dp),radius=14.dp){
        BasicTextField(query,{query=it.take(100)},Modifier.fillMaxSize().padding(12.dp),
            singleLine=true,textStyle=AksaraTypography.style(12f,18f),cursorBrush=SolidColor(AksaraColors.gold),
            decorationBox={inner->Box{if(query.isEmpty())AksaraText("Cari judul atau bait puisi",size=12f,color=AksaraColors.muted);inner()}})
    }
    if(error!=null)AksaraText(error.orEmpty(),size=11f,color=Color(0xffffaa9d))
    val filtered=remember(poems,query){
        val q=query.trim().lowercase()
        if(q.isBlank())poems else poems.filter{it.title.lowercase().contains(q)||it.lines.any{line->line.lowercase().contains(q)}}
    }
    Spacer(Modifier.height(9.dp))
    filtered.forEach{poem->
        AksaraGlassSurface(Modifier.fillMaxWidth().clickable{selected=if(selected==poem.id)-1 else poem.id},radius=14.dp){
            Column(Modifier.fillMaxWidth().padding(13.dp)){
                Row(verticalAlignment=Alignment.CenterVertically){
                    AksaraText(poem.title,Modifier.weight(1f),size=11.5f,weight=600)
                    AksaraText(if(selected==poem.id)"−" else "+",size=16f,color=AksaraColors.gold)
                }
                if(selected==poem.id){
                    Spacer(Modifier.height(12.dp))
                    AksaraText(poem.lines.joinToString("\n"),size=13f,line=21f,color=Color(0xffefdfc9))
                }
            }
        }
        Spacer(Modifier.height(7.dp))
    }
    if(filtered.isEmpty()&&error==null&&poems.isNotEmpty())AksaraText("Tiada karya sepadan.",size=12f,color=AksaraColors.muted)
}

@Composable fun NovelContent() {
    val context=LocalContext.current
    val prefs=remember{context.getSharedPreferences("aksara.reader",0)}
    var sections by remember{mutableStateOf<List<Section>>(emptyList())}
    var error by remember{mutableStateOf<String?>(null)}
    var index by rememberSaveable{mutableIntStateOf(prefs.getInt("section",0))}
    LaunchedEffect(Unit){
        try{
            sections=withContext(Dispatchers.IO){
                val raw=context.assets.open("novel-kb.json").bufferedReader().use{it.readText()}
                val rows=JSONObject(raw).getJSONArray("sections")
                (0 until rows.length()).map{rows.getJSONObject(it)}.map{section->
                    val paragraphs=section.getJSONArray("paragraphs")
                    Section(section.getString("title"),(0 until paragraphs.length()).map{paragraphs.getString(it)})
                }
            }
        }catch(e:Exception){error=e.message?:"Novel gagal dimuatkan."}
    }
    Spacer(Modifier.height(14.dp))
    AksaraText("ANTARA CAHAYA DAN GELAP",size=15f,weight=700,family=AksaraTypography.heading)
    AksaraText("Prosa falsafah · Shaiful Ridhwan · Bacaan offline",size=11f,color=AksaraColors.muted)
    Spacer(Modifier.height(12.dp))
    if(error!=null)AksaraText(error.orEmpty(),size=12f,color=Color(0xffffaa9d))
    if(sections.isEmpty()){
        if(error==null)AksaraText("Memuatkan naskhah asal…",size=12f)
        // An unreadable or missing novel asset is an error, not a valid empty chapter.
        return
    }
    val safe=novelIndexOrNull(index,sections.size)?:return
    val chapter=sections[safe]
    AksaraText("Bahagian "+(safe+1)+"/"+sections.size+" · "+chapter.title,size=13f,weight=600)
    Spacer(Modifier.height(8.dp))
    Row(horizontalArrangement=Arrangement.spacedBy(7.dp)){
        AksaraButton("Sebelum",{
            index=(safe-1).coerceAtLeast(0);prefs.edit().putInt("section",index).apply()
        },Modifier.weight(1f),height=38.dp,enabled=safe>0)
        AksaraButton("Seterusnya",{
            index=(safe+1).coerceAtMost(sections.lastIndex);prefs.edit().putInt("section",index).apply()
        },Modifier.weight(1f),height=38.dp,enabled=safe<sections.lastIndex)
    }
    Spacer(Modifier.height(15.dp))
    chapter.paragraphs.forEach{paragraph->
        if(paragraph.isNotBlank()){
            AksaraText(paragraph,size=13.5f,line=23f,color=Color(0xfff2e9df))
            Spacer(Modifier.height(13.dp))
        }
    }
    Spacer(Modifier.height(16.dp))
    AksaraText("Kemajuan bahagian disimpan di peranti ini.",size=10f,color=AksaraColors.muted)
}
