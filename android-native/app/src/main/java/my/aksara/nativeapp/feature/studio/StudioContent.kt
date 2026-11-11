package my.aksara.nativeapp.feature.studio

import android.content.ContentValues
import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.provider.MediaStore
import android.util.Base64
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.launch
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException
import kotlinx.coroutines.withContext
import my.aksara.nativeapp.core.design.*
import my.aksara.nativeapp.core.network.BackendRoutes
import my.aksara.nativeapp.core.network.BackendNetworkErrors
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONObject
import java.io.IOException
import java.util.concurrent.TimeUnit

/** Native client for the same published Studio contract, with no provider tokens in the APK. */
internal object StudioGateway {
    private val client = OkHttpClient.Builder().connectTimeout(15,TimeUnit.SECONDS)
        .readTimeout(80,TimeUnit.SECONDS).callTimeout(85,TimeUnit.SECONDS).build()
    private suspend fun awaitResponse(request:Request):okhttp3.Response = suspendCancellableCoroutine { continuation ->
        val call=client.newCall(request)
        continuation.invokeOnCancellation { call.cancel() }
        call.enqueue(object:okhttp3.Callback {
            override fun onFailure(call:okhttp3.Call, error:IOException) {
                if(continuation.isActive)continuation.resumeWithException(error)
            }
            override fun onResponse(call:okhttp3.Call,response:okhttp3.Response) {
                if(continuation.isActive)continuation.resume(response)
                else response.close()
            }
        })
    }
    private val endpoint get() = BackendRoutes.configuredOrigin + BackendRoutes.STUDIO_IMAGE
    data class Result(val bitmap:Bitmap,val model:String,val elapsed:Long,val width:Int,val height:Int)
    suspend fun generate(prompt:String,model:String,style:String,quality:String,ratio:String,seed:Long?=null):Result = withContext(Dispatchers.IO) {
        require(prompt.trim().length in 4..1200) {"Prompt mesti 4 hingga 1200 aksara."}
        require(model in setOf("schnell","klein","ovh")) {"Model tidak disokong."}
        require(style in setOf("none","antara","sastera","langit","falsafah","cinta","futuristik","realistic","illustration","minimal","fantasy")) {"Preset tidak disokong."}
        require(quality in setOf("fast","balanced","detail")) {"Kualiti tidak disokong."}
        require(ratio in setOf("1:1","4:5","9:16","16:9","3:2")) {"Nisbah tidak disokong."}
        StudioRules.cloud(model,ratio,quality,seed)
        val body=JSONObject().put("prompt",prompt.trim()).put("model",model)
            .put("style",style).put("quality",quality).put("ratio",ratio).apply { if(seed!=null) put("seed",seed) }
        val request=Request.Builder().url(endpoint).post(body.toString().toRequestBody("application/json".toMediaType()))
            .header("Accept","application/json").header("Origin",BackendRoutes.configuredOrigin).build()
        val response=try{awaitResponse(request)}catch(e:IOException){throw BackendNetworkErrors.translate(e,BackendRoutes.configuredOrigin)}
        response.use{ response ->
            val raw=response.body?.string()?.takeIf{it.length<=7_000_000}
                ?: throw IOException("Respons Studio kosong atau terlalu besar.")
            val json=try{JSONObject(raw)}catch(_:Exception){throw IOException("Studio memulangkan respons yang tidak sah (HTTP "+response.code+").")}
            if(!response.isSuccessful||!json.optBoolean("ok"))
                throw IOException(json.optString("error","Studio gagal (HTTP "+response.code+")."))
            val encoded=json.optString("image")
            require(encoded.isNotBlank()&&encoded.length<=6_500_000) {"Data imej tidak sah."}
            val bytes=Base64.decode(encoded,Base64.DEFAULT)
            val bounds=BitmapFactory.Options().apply{inJustDecodeBounds=true}
            BitmapFactory.decodeByteArray(bytes,0,bytes.size,bounds)
            require(bounds.outWidth in 256..1920&&bounds.outHeight in 256..1920) {"Dimensi imej tidak sah."}
            // Preserve full ARGB fidelity; never perform density scaling on generated pixels.
            val decode=BitmapFactory.Options().apply {
                inPreferredConfig=Bitmap.Config.ARGB_8888
                inScaled=false
                inMutable=false
            }
            val bitmap=BitmapFactory.decodeByteArray(bytes,0,bytes.size,decode)
                ?: throw IOException("Imej Studio tidak dapat dibaca.")
            Result(bitmap,json.optString("modelName",model),json.optLong("durationMs"),bounds.outWidth,bounds.outHeight)
        }
    }
    suspend fun enhance(prompt:String):String = withContext(Dispatchers.IO) {
        val clean=StudioRules.prompt(prompt)
        require(clean.length<=850) {"Perkemas A.I. menerima prompt maksimum 850 aksara."}
        val req=Request.Builder().url(BackendRoutes.configuredOrigin + BackendRoutes.STUDIO_ENHANCE)
            .post(JSONObject().put("prompt",clean).toString().toRequestBody("application/json".toMediaType()))
            .header("Accept","application/json").build()
        awaitResponse(req).use { response ->
            val json=JSONObject(response.body?.string() ?: "{}")
            if(!response.isSuccessful)throw IOException(json.optString("error","Perkemas A.I. gagal."))
            val enhanced=json.optString("prompt")
            require(enhanced.length in 4..1200) {"Draf A.I. tidak sah."}
            enhanced
        }
    }
    suspend fun save(context:Context,bitmap:Bitmap):String = withContext(Dispatchers.IO) {
        val name="aksara-studio-"+System.currentTimeMillis()+".png"
        val values=ContentValues().apply{
            put(MediaStore.Images.Media.DISPLAY_NAME,name)
            put(MediaStore.Images.Media.MIME_TYPE,"image/png")
            put(MediaStore.Images.Media.RELATIVE_PATH,"Pictures/AKSARA")
            put(MediaStore.Images.Media.IS_PENDING,1)
        }
        val resolver=context.contentResolver
        val uri=resolver.insert(MediaStore.Images.Media.EXTERNAL_CONTENT_URI,values)
            ?: throw IOException("Gagal mencipta fail galeri.")
        try{
            resolver.openOutputStream(uri)?.use{ out->
                if(!bitmap.compress(Bitmap.CompressFormat.PNG,100,out))throw IOException("Gagal menulis imej.")
            } ?: throw IOException("Storan galeri tidak tersedia.")
            resolver.update(uri,ContentValues().apply{put(MediaStore.Images.Media.IS_PENDING,0)},null,null)
            name
        }catch(e:Exception){resolver.delete(uri,null,null);throw e}
    }
}

@Composable internal fun LegacyStudioContent() {
    val context=androidx.compose.ui.platform.LocalContext.current
    val scope=rememberCoroutineScope()
    var prompt by rememberSaveable{mutableStateOf("")}
    var model by rememberSaveable{mutableStateOf("klein")}
    var style by rememberSaveable{mutableStateOf("antara")}
    var quality by rememberSaveable{mutableStateOf("balanced")}
    var ratio by rememberSaveable{mutableStateOf("1:1")}
    var result by remember{mutableStateOf<StudioGateway.Result?>(null)}
    var message by remember{mutableStateOf("Hasil imej akan muncul di sini.")}
    var job by remember{mutableStateOf<Job?>(null)}
    DisposableEffect(Unit){onDispose{job?.cancel()}}
    Spacer(Modifier.height(15.dp))
    AksaraText("Studio Antara · Cloud",size=14f,weight=650)
    AksaraText("FLUX melalui pelayan Studio yang sama dengan web. Kuota dan ketersediaan penyedia masih terpakai.",size=11f,color=AksaraColors.muted)
    Spacer(Modifier.height(10.dp))
    AksaraGlassSurface(Modifier.fillMaxWidth().height(116.dp),radius=16.dp) {
        BasicTextField(prompt,{if(it.length<=1200)prompt=it},Modifier.fillMaxSize().padding(12.dp),
            textStyle=AksaraTypography.style(13f,19f),cursorBrush=SolidColor(AksaraColors.gold),
            decorationBox={inner->Box {if(prompt.isBlank())AksaraText("Apa yang kau nak lihat?",size=13f,color=AksaraColors.muted);inner()}})
    }
    Spacer(Modifier.height(8.dp))
    AksaraText("Model",size=11f,color=AksaraColors.muted)
    Row(horizontalArrangement=Arrangement.spacedBy(5.dp)){
        listOf("klein" to "Klein","schnell" to "Schnell","ovh" to "OVH Beta").forEach{(id,label)->
            AksaraButton((if(model==id)"✓ " else "")+label,{model=id;if(id!="klein")ratio="1:1"},Modifier.weight(1f),size=10f,height=36.dp)
        }
    }
    Spacer(Modifier.height(8.dp))
    AksaraText("Nisbah",size=11f,color=AksaraColors.muted)
    Row(horizontalArrangement=Arrangement.spacedBy(4.dp)){
        listOf("1:1","4:5","9:16","16:9","3:2").forEach{id->
            AksaraButton((if(ratio==id)"✓" else "")+id,{ratio=id},Modifier.weight(1f),size=9f,height=32.dp,enabled=model=="klein"||id=="1:1")
        }
    }
    Spacer(Modifier.height(8.dp))
    AksaraText("Preset visual",size=11f,color=AksaraColors.muted)
    Row(Modifier.horizontalScroll(rememberScrollState()),horizontalArrangement=Arrangement.spacedBy(5.dp)){
        listOf("none" to "Ikut prompt","antara" to "Cahaya/Gelap","sastera" to "Sastera","langit" to "Langit",
            "falsafah" to "Falsafah","cinta" to "Cinta","futuristik" to "Futuristik","realistic" to "Realistik",
            "illustration" to "Ilustrasi","minimal" to "Minimal","fantasy" to "Fantasi").forEach{(id,label)->
            AksaraButton((if(style==id)"✓ " else "")+label,{style=id},Modifier.width(113.dp),size=10f,height=34.dp)
        }
    }
    Spacer(Modifier.height(8.dp))
    Row(horizontalArrangement=Arrangement.spacedBy(5.dp)){
        listOf("fast" to "Pantas","balanced" to "Seimbang","detail" to "Detail").forEach{(id,label)->
            AksaraButton((if(quality==id)"✓ " else "")+label,{quality=id},Modifier.weight(1f),size=10f,height=34.dp)
        }
    }
    Spacer(Modifier.height(12.dp))
    AksaraButton(if(job?.isActive==true)"Menghasilkan…" else "Jana imej",{
        if(job?.isActive!=true){
            job=scope.launch {
                message="Menghubungi Studio…"
                try{result=StudioGateway.generate(prompt,model,style,quality,ratio);message="Imej berjaya dijana."}
                catch(_:CancellationException){message="Penjanaan dihentikan."}
                catch(e:Exception){message=e.message?:"Penjanaan gagal."}
            }
        }
    },Modifier.fillMaxWidth(),enabled=job?.isActive!=true&&prompt.trim().length>=4)
    Spacer(Modifier.height(8.dp))
    if(job?.isActive==true) AksaraButton("Henti",{
        job?.cancel();message="Dihentikan. Kuota pelayan yang telah digunakan mungkin tidak dipulangkan."
    },Modifier.fillMaxWidth(),height=36.dp)
    AksaraText(message,size=11f,line=17f,color=AksaraColors.muted)
    result?.let{image->
        Spacer(Modifier.height(10.dp))
        Image(bitmap=image.bitmap.asImageBitmap(),contentDescription="Hasil sebenar Studio Antara",modifier=Modifier.fillMaxWidth().height(260.dp)
            .border(1.dp,AksaraColors.border,RoundedCornerShape(16.dp)),contentScale=ContentScale.Fit)
        AksaraText(image.model+" · "+image.width+"×"+image.height+" · "+image.elapsed+" ms",size=10f,color=AksaraColors.muted)
        AksaraButton("Simpan ke galeri",{
            scope.launch{
                try{message="Disimpan: "+StudioGateway.save(context,image.bitmap)}
                catch(e:Exception){message=e.message?:"Gagal menyimpan imej."}
            }
        },Modifier.fillMaxWidth(),height=40.dp)
    }
    Spacer(Modifier.height(12.dp))
    AksaraText("SD-Turbo offline belum tersedia dalam binaan ini. Tiada hasil tempatan palsu dipaparkan.",size=10f,color=AksaraColors.muted)
}
