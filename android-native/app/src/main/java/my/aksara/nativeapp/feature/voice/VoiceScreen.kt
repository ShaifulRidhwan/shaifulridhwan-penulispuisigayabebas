package my.aksara.nativeapp.feature.voice

import androidx.compose.foundation.*
import androidx.compose.animation.core.*
import androidx.compose.foundation.gestures.detectDragGestures
import androidx.compose.foundation.layout.*
import androidx.compose.runtime.*
import androidx.compose.ui.*
import androidx.compose.ui.draw.clip
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.ui.graphics.*
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.semantics.*
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.*
import androidx.compose.ui.viewinterop.AndroidView
import dev.chrisbanes.haze.*
import my.aksara.nativeapp.core.design.*
import my.aksara.engine.voice.VoiceState
import my.aksara.engine.avatar.VoiceAvatarView

@Composable fun VoiceScreen(state:VoiceState,onClose:()->Unit,onMic:()->Unit={},onSpeaker:()->Unit={},onVolume:(Float)->Unit={},mode:String="cahaya",onMode:(String)->Unit={},style:String="Bahasa Santai",onStyle:(String)->Unit={},preview:Boolean=false){
    val margins=aksaraDeviceMargins()
    val haze=LocalBackdrop.current
    val voiceBackdrop=remember{HazeState()}
    var modePicker by remember{mutableStateOf(false)};var stylePicker by remember{mutableStateOf(false)}
    var seconds by remember{mutableIntStateOf(0)}
    val live = !preview && state.ready && state.phase in setOf("listening","thinking","speaking")
    val pulse = rememberInfiniteTransition(label="voice-live")
    val liveGlow by pulse.animateFloat(initialValue=.35f,targetValue=1f,animationSpec=infiniteRepeatable(animation=tween(900),repeatMode=RepeatMode.Reverse),label="live-glow")
    LaunchedEffect(state.startedAt){
        if(state.startedAt==null){seconds=0;return@LaunchedEffect}
        while(state.startedAt!=null){seconds=((System.currentTimeMillis()-state.startedAt!!)/1000).toInt();kotlinx.coroutines.delay(1000)}
    }
    BoxWithConstraints(Modifier.fillMaxSize()){
        Box(Modifier.fillMaxSize().hazeSource(voiceBackdrop).hazeEffect(haze,HazeStyle(tints=emptyList(),backgroundColor=Color(0xff070911),blurRadius=29.75.dp,noiseFactor=0f)).background(Color(9,16,28,145)))
        CompositionLocalProvider(LocalBackdrop provides voiceBackdrop){
        val compact=maxWidth<=360.dp
        val side=maxOf(if(compact)8.dp else 11.dp,margins.horizontal)
        Column(Modifier.fillMaxSize().safeDrawingPadding().padding(top=margins.top,bottom=margins.bottom)){
            AksaraGlassSurface(Modifier.padding(horizontal=margins.horizontal).fillMaxWidth().height(68.dp),radius=21.dp,blur=13.dp,brush=Brush.linearGradient(listOf(Color(240,204,159,23),Color(135,181,211,14),Color(13,22,37,10))),border=Color(244,217,176,30)){
                Row(Modifier.fillMaxSize().padding(start=10.dp,end=12.dp),verticalAlignment=Alignment.CenterVertically){
                    AksaraGlassSurface(Modifier.width(73.dp).height(40.dp),radius=17.dp,blur=16.dp,brush=cssGradient(137f,listOf(Color(249,224,186,32),Color(128,173,218,18))),border=Color(245,217,173,69),saturation=1.16f){Column(Modifier.align(Alignment.Center),horizontalAlignment=Alignment.CenterHorizontally){AksaraText("AKSARA",size=13f,line=14.95f,weight=650,tracking=1.17f,family=AksaraTypography.heading);AksaraText("VOICE CHAT",size=7f,line=10.5f,tracking=1f,color=AksaraColors.gold)}}
                    Spacer(Modifier.weight(1f))
                    AksaraGlassSurface(Modifier.weight(1f).height(35.dp).semantics {
                        contentDescription = (if(live)"Gemini Live aktif" else state.phase) +
                            ", tempoh " + "%02d:%02d".format(seconds/60,seconds%60)
                    },radius=999.dp,blur=18.dp,brush=cssGradient(142f,listOf(Color(14,29,45,143),Color(20,34,54,66))),border=Color(241,214,173,78)){
                        Row(Modifier.fillMaxSize().padding(horizontal=if(compact)6.dp else 9.dp),
                            verticalAlignment=Alignment.CenterVertically,
                            horizontalArrangement=Arrangement.spacedBy(if(compact)4.dp else 5.dp)){
                            Canvas(Modifier.size(9.dp)){
                                if(live)drawCircle(Color(0xffff425b).copy(alpha=liveGlow*.32f),radius=size.minDimension/2)
                                drawCircle(if(live)Color(0xffff5365) else if(state.phase=="error")Color(0xffe8a06a) else Color(0xff9da0a4),
                                    radius=size.minDimension*(if(live).30f else .24f))
                            }
                            val status=if(preview)"PREVIEW" else if(live)"LIVE" else when(state.phase){
                                "connecting"->"CONNECTING"
                                "reconnecting"->if(compact)"RECONNECT" else "RECONNECTING"
                                "error"->"ERROR"
                                "disconnected"->"OFFLINE"
                                else->"OFFLINE"
                            }
                            AksaraText(status,size=if(compact)8f else 8.5f,line=11f,weight=650,
                                color=if(live)Color(0xffff7583) else AksaraColors.muted,
                                family=AksaraTypography.heading)
                            Spacer(Modifier.weight(1f))
                            AksaraIcon("clock",Modifier.size(11.dp),AksaraColors.muted)
                            androidx.compose.foundation.text.BasicText("%02d:%02d".format(seconds/60,seconds%60),
                                style=AksaraTypography.style(9.5f,12.5f,color=AksaraColors.muted).copy(
                                    fontFeatureSettings="tnum",fontFamily=AksaraTypography.heading))
                        }
                    }
                    Spacer(Modifier.width(if(compact)4.dp else 7.dp))
                    AksaraGlassSurface(Modifier.width(105.dp).height(38.dp).clickable(onClick=onClose).semantics{contentDescription="End Session: Tamatkan Voice Chat"},radius=999.dp,blur=18.dp,brush=cssGradient(137f,listOf(Color(174,68,80,72),Color(80,38,57,36))),border=Color(250,169,173,130)){
                        Row(Modifier.align(Alignment.Center),verticalAlignment=Alignment.CenterVertically,horizontalArrangement=Arrangement.spacedBy(5.dp)){
                            AksaraIcon("end",Modifier.size(14.dp),Color(0xffffb9b7))
                            AksaraText("End Session",size=9.5f,line=13f,weight=600,color=Color(0xffffd9d5))
                        }
                    }
                }
            }
            Box(Modifier.fillMaxWidth().weight(1f)){
                AndroidView(factory={VoiceAvatarView(it)},modifier=Modifier.fillMaxSize())
                Column(Modifier.align(Alignment.BottomCenter).fillMaxWidth().background(Brush.verticalGradient(listOf(Color.Transparent,Color(8,13,23,61),Color(7,13,24,179)))).padding(start=12.dp,end=12.dp,bottom=13.dp,top=26.dp),horizontalAlignment=Alignment.CenterHorizontally){
                    AksaraIcon("voice",Modifier.size(width=102.dp,height=15.dp),Color(230,197,139,150))
                    Spacer(Modifier.height(5.dp));AksaraText(if(preview)"Pratonton" else when(state.phase){"listening"->"Mendengar";"thinking"->"Memproses";"speaking"->"Menjawab";"connecting"->"Menyambung";"reconnecting"->"Menyambung semula";"error"->"Ralat Voice";else->"Sedia"},size=16f,line=20.8f,weight=600,tracking=.4f,family=AksaraTypography.heading)
                    Spacer(Modifier.height(3.dp));androidx.compose.foundation.text.BasicText(if(preview)"Pratonton reka bentuk sahaja. Mikrofon dan Gemini Live tidak diaktifkan." else state.message,style=AksaraTypography.style(12f,17.4f,color=Color(0xffc7c3ba)).copy(textAlign=TextAlign.Center))
                }
            }
            Spacer(Modifier.height(5.dp))
            AksaraGlassSurface(Modifier.padding(horizontal=side).fillMaxWidth().height(if(compact)150.dp else 155.dp),radius=20.dp,blur=22.dp,brush=Brush.linearGradient(listOf(Color(250,228,196,15),Color(111,163,211,9),Color(15,25,39,18))),border=Color(245,217,176,65),saturation=1.15f){
                Column(Modifier.fillMaxSize().padding(horizontal=14.dp,vertical=12.dp)){
                    Row(horizontalArrangement=Arrangement.spacedBy(10.dp)){
                        Column(Modifier.weight(1f)){AksaraText("Gaya bahasa",size=10f,line=14.5f,color=Color(0xffd3c3ab));Spacer(Modifier.height(4.dp));AksaraButton(style+"  ﹀",{stylePicker=true},Modifier.fillMaxWidth(),size=if(style.length>16)9.5f else 11f,height=42.dp,radius=17.dp)}
                        Column(Modifier.weight(1f)){AksaraText("Thinking Mode",size=10f,line=14.5f,color=Color(0xffd3c3ab));Spacer(Modifier.height(4.dp));AksaraButton(if(mode=="gelap")"Gelap" else "Cahaya",{modePicker=true},Modifier.fillMaxWidth(),icon="brain",size=11f,height=42.dp,radius=17.dp)}
                    }
                    Spacer(Modifier.height(8.dp));AksaraText("Volume",size=10f,line=14.5f,color=Color(0xffd3c3ab));Spacer(Modifier.height(4.dp))
                    AksaraGlassSurface(Modifier.fillMaxWidth().height(44.dp),radius=17.dp,blur=10.dp){
                        Row(Modifier.fillMaxSize().padding(horizontal=13.dp),verticalAlignment=Alignment.CenterVertically,horizontalArrangement=Arrangement.spacedBy(8.dp)){
                            Canvas(Modifier.weight(1f).height(30.dp).semantics{contentDescription="Volume suara Aksara";progressBarRangeInfo=ProgressBarRangeInfo(state.volume,0f..1f);setProgress{onVolume(it);true}}.pointerInput(Unit){detectDragGestures(onDragStart={onVolume((it.x/size.width).coerceIn(0f,1f))}){change,_->change.consume();onVolume((change.position.x/size.width).coerceIn(0f,1f))}}){
                                val cy=size.height/2;drawLine(Color(180,185,189,90),Offset(0f,cy),Offset(size.width,cy),strokeWidth=4.dp.toPx(),cap=StrokeCap.Round);drawLine(AksaraColors.gold,Offset(0f,cy),Offset(size.width*state.volume,cy),strokeWidth=4.dp.toPx(),cap=StrokeCap.Round);drawCircle(Color(0xffe8c68b),8.dp.toPx(),Offset(size.width*state.volume,cy));drawCircle(Color(0xfff4e1bd),6.dp.toPx(),Offset(size.width*state.volume,cy))
                            }
                            AksaraText("${(state.volume*100).toInt()}%",Modifier.width(35.dp),size=12f,line=15.6f)
                        }
                    }
                }
            }
            Spacer(Modifier.height(10.dp))
            AksaraGlassSurface(Modifier.padding(horizontal=side).fillMaxWidth().height(76.dp),radius=20.dp,blur=22.dp,brush=Brush.linearGradient(listOf(Color(250,228,196,15),Color(111,163,211,9),Color(15,25,39,18))),border=Color(245,217,176,65),saturation=1.15f){
                Row(Modifier.align(Alignment.Center),horizontalArrangement=Arrangement.spacedBy(22.dp)){
                    AksaraButton("",onMic,Modifier.width(56.dp).semantics{contentDescription=if(state.mic)"Tutup mikrofon" else "Buka mikrofon"},icon="mic",height=56.dp,radius=999.dp,iconSize=24.dp)
                    AksaraGlassSurface(Modifier.size(56.dp).clickable(onClick=onClose).semantics{contentDescription="Tamatkan sesi"},radius=999.dp,brush=Brush.linearGradient(listOf(Color(189,75,84,214),Color(105,33,52,214))),border=Color(250,170,170,190)){AksaraIcon("end",Modifier.align(Alignment.Center).size(24.dp),Color(0xffffeadb))}
                    AksaraButton("",onSpeaker,Modifier.width(56.dp).semantics{contentDescription=if(state.speaker)"Senyapkan suara" else "Buka suara"},icon="speaker",height=56.dp,radius=999.dp,iconSize=24.dp)
                }
            }
            Spacer(Modifier.height(9.dp))
        }
        if(modePicker||stylePicker)Box(Modifier.fillMaxSize().background(Color(0,0,0,80)).clickable{modePicker=false;stylePicker=false},contentAlignment=Alignment.Center){
            AksaraGlassSurface(Modifier.padding(24.dp).fillMaxWidth().heightIn(max=540.dp),radius=24.dp,blur=29.dp,brush=DialogGradient,border=Color(245,217,176,108),saturation=1.14f){
                Column(Modifier.padding(18.dp).verticalScroll(rememberScrollState())){
                    AksaraText(if(modePicker)"Thinking Mode" else "Gaya bahasa",size=17f,weight=600)
                    if(stylePicker){Spacer(Modifier.height(5.dp));AksaraText("Pilih Bahasa Santai atau loghat. Menukar gaya akan sambung semula sesi Live.",size=10f,line=15f,color=AksaraColors.muted)}
                    Spacer(Modifier.height(16.dp))
                    (if(modePicker)listOf("Cahaya","Gelap") else VoiceLanguageStyles).forEach{choice->
                        AksaraButton((if(stylePicker&&choice==style)"✓  " else "")+choice,{
                            if(modePicker)onMode(choice.lowercase()) else onStyle(choice)
                            modePicker=false;stylePicker=false
                        },Modifier.fillMaxWidth(),height=42.dp,radius=16.dp)
                        Spacer(Modifier.height(8.dp))
                    }
                }
            }
        }
        }
    }
}
