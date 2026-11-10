package my.aksara.nativeapp.feature.chat

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import my.aksara.nativeapp.core.design.*
import java.text.DateFormat
import java.util.Date

/** Evidence-first provider health. List virtualization keeps long free catalogues fast. */
@Composable internal fun ProviderHealthContent(
    state: ChatState,
    onRefresh: () -> Unit,
    modifier: Modifier = Modifier
) {
    val snapshot = state.providerHealth
    val backendFailure = state.providers.firstOrNull { it.first == "backend" }?.second
    var expandedId by rememberSaveable { mutableStateOf("gemini") }
    val checked = snapshot?.checkedAt?.let {
        DateFormat.getDateTimeInstance(DateFormat.SHORT, DateFormat.SHORT).format(Date(it))
    } ?: "Belum disahkan"
    Column(modifier.fillMaxWidth()) {
        Spacer(Modifier.height(10.dp))
        if (snapshot == null) {
            AksaraText(backendFailure ?: "Status penyedia belum diperiksa.",
                size=11.5f,line=16f,color=AksaraColors.muted)
        } else {
            Row(horizontalArrangement=Arrangement.spacedBy(11.dp)) {
                HealthCount(snapshot.connectedCount.toString(),"Connected",ProviderStatusPalette.online,Modifier.weight(1f))
                HealthCount(snapshot.readyCount.toString(),"Ready",ProviderStatusPalette.ready,Modifier.weight(1f))
                HealthCount(snapshot.remainingCount.toString(),"Lain-lain",ProviderStatusPalette.unknown,Modifier.weight(1f))
            }
            Spacer(Modifier.height(8.dp))
            AksaraText("Disemak: $checked · Ready/Listed bukan bukti inferens berjaya.",
                size=10f,line=14f,color=AksaraColors.muted)
        }
        Spacer(Modifier.height(10.dp))
        LazyColumn(Modifier.fillMaxWidth().weight(1f),
            contentPadding=PaddingValues(bottom=8.dp),
            verticalArrangement=Arrangement.spacedBy(7.dp)) {
            ProviderConnectionStatus.expected.forEach { id ->
                val detail=snapshot?.providers?.firstOrNull { it.id == id }
                val name=detail?.name ?: when(id) {
                    "gemini"->"Google Gemini";"groq"->"Groq"
                    "workers_ai"->"Cloudflare Workers AI";else->"OpenRouter"
                }
                val normalized=state.providers.firstOrNull { it.first==id }?.second
                    ?: if(backendFailure!=null) "Unverified" else "Unverified"
                item(key="provider-$id") {
                    AksaraGlassSurface(
                        Modifier.fillMaxWidth().height(49.dp).clickable {
                            expandedId=if(expandedId==id) "" else id
                        },radius=15.dp,blur=8.dp) {
                        Row(Modifier.fillMaxSize().padding(horizontal=11.dp),
                            verticalAlignment=Alignment.CenterVertically,
                            horizontalArrangement=Arrangement.spacedBy(7.dp)) {
                            AksaraIcon(ProviderIdentity.of(id)?.icon ?: "network",
                                Modifier.size(17.dp),AksaraColors.gold)
                            AksaraText(name,Modifier.weight(1f),size=11f,line=15f,weight=600)
                            AksaraText(healthLabel(normalized),size=10f,line=14f,
                                weight=600,color=ProviderStatusPalette.color(normalized))
                            AksaraText(if(expandedId==id)"⌃" else "⌄",size=14f,color=AksaraColors.muted)
                        }
                    }
                }
                if(expandedId==id) {
                    if(detail==null) {
                        item(key="detail-$id") {
                            AksaraText(backendFailure ?: "Status terperinci belum disahkan.",
                                Modifier.padding(horizontal=9.dp),size=10f,
                                line=14f,color=AksaraColors.muted)
                        }
                    } else {
                        item(key="detail-$id") {
                            Column(Modifier.fillMaxWidth().padding(horizontal=11.dp),verticalArrangement=Arrangement.spacedBy(5.dp)) {
                                if(detail.model.isNotBlank()) HealthDetailLine("Model",detail.model)
                                if(detail.http!=null) HealthDetailLine("HTTP",detail.http.toString())
                                if(detail.latencyMs!=null) HealthDetailLine("Respons", "${detail.latencyMs} ms")
                                if(detail.reason.isNotBlank()) HealthDetailLine("Butiran",detail.reason)
                                if(id=="openrouter") {
                                    AksaraText("Katalog: ${snapshot?.catalogTotal ?: 0} model disenaraikan. Listed bukan Connected.",
                                        size=10f,line=14f,color=AksaraColors.muted)
                                    if(snapshot?.catalogStatus=="unavailable")
                                        AksaraText("Katalog belum tersedia.",size=10f,color=AksaraColors.muted)
                                }
                            }
                        }
                        if(id=="gemini") {
                            items(detail.slots, key={ "slot-${it.slot}" }) { slot ->
                                Column(Modifier.fillMaxWidth().padding(start=19.dp,end=8.dp,top=5.dp,bottom=6.dp)) {
                                    Row(verticalAlignment=Alignment.CenterVertically) {
                                        AksaraText("Gemini ${slot.slot}",Modifier.weight(1f),size=11f,weight=600)
                                        AksaraText(healthLabel(slot.status),size=10f,
                                            color=ProviderStatusPalette.color(slot.status),weight=600)
                                    }
                                    if(slot.model.isNotBlank()) AksaraText(slot.model,size=10f,color=AksaraColors.muted)
                                    val evidence=listOfNotNull(
                                        slot.http?.let{"HTTP $it"},
                                        slot.latencyMs?.let{"$it ms"},
                                        slot.checkedAt?.let{"Disemak: "+DateFormat.getTimeInstance(DateFormat.SHORT).format(Date(it))}
                                    ).joinToString(" · ")
                                    if(evidence.isNotBlank()) AksaraText(evidence,size=9.5f,
                                        line=14f,color=AksaraColors.muted)
                                    if(slot.reason.isNotBlank()) AksaraText(slot.reason,
                                        size=9.5f,line=14f,color=AksaraColors.muted)
                                    if(slot.checkedAt==null) AksaraText("Belum diuji",size=9.5f,
                                        color=AksaraColors.muted)
                                }
                            }
                        }
                        if(id=="openrouter" && snapshot!=null) {
                            items(snapshot.catalogModels.size,key={"catalog-$it"}) { index ->
                                Row(Modifier.fillMaxWidth().padding(start=19.dp,end=9.dp,top=4.dp,bottom=4.dp),
                                    verticalAlignment=Alignment.CenterVertically) {
                                    AksaraText(snapshot.catalogModels[index],Modifier.weight(1f),
                                        size=10f,line=14f,color=AksaraColors.muted)
                                    AksaraText("Listed",size=9.5f,color=ProviderStatusPalette.unknown)
                                }
                            }
                        }
                    }
                }
            }
        }
        Spacer(Modifier.height(8.dp))
        AksaraButton("Refresh Status",onRefresh,Modifier.fillMaxWidth(),height=46.dp,radius=15.dp)
    }
}

@Composable private fun HealthCount(value:String,label:String,color:Color,modifier:Modifier=Modifier) {
    AksaraGlassSurface(modifier.height(57.dp),radius=13.dp,blur=7.dp) {
        Column(Modifier.align(Alignment.Center),horizontalAlignment=Alignment.CenterHorizontally) {
            AksaraText(value,size=17f,line=22f,weight=700,color=color)
            AksaraText(label,size=9f,line=12f,color=AksaraColors.muted)
        }
    }
}

@Composable private fun HealthDetailLine(label:String,value:String) {
    AksaraText("$label: "+value.take(190),size=10f,line=14f,color=AksaraColors.muted)
}

private fun healthLabel(value:String):String=when(value.lowercase()) {
    "online","connected"->"Connected"
    "ready"->"Ready"
    "rate limited"->"Rate Limited"
    "offline","off","unavailable","misconfigured"->"Unavailable"
    "degraded"->"Degraded"
    else->"Unverified"
}
