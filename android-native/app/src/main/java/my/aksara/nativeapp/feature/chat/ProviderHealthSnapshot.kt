package my.aksara.nativeapp.feature.chat

import org.json.JSONObject

/** Only actual backend evidence is displayed; configured/listed is never a successful inference. */
data class ProviderSlotHealth(
    val slot: Int, val status: String, val model: String,
    val http: Int?, val latencyMs: Long?, val checkedAt: Long?, val reason: String
)
data class ProviderHealthDetail(
    val id: String, val name: String, val status: String, val model: String,
    val http: Int?, val latencyMs: Long?, val reason: String,
    val slots: List<ProviderSlotHealth>
)
data class ProviderHealthSnapshot(
    val checkedAt: Long?, val providers: List<ProviderHealthDetail>,
    val catalogModels: List<String>, val catalogTotal: Int,
    val catalogStatus: String
) {
    val connectedCount get() = providers.count { it.status == "online" }
    val readyCount get() = providers.count { it.status == "ready" }
    val remainingCount get() = providers.size - connectedCount - readyCount
}

internal object ProviderHealthParser {
    private val names = mapOf("gemini" to "Google Gemini", "groq" to "Groq",
        "workers_ai" to "Cloudflare Workers AI", "openrouter" to "OpenRouter")
    private fun JSONObject?.string(name:String,limit:Int=140):String =
        this?.optString(name).orEmpty().takeIf { it != "null" }?.take(limit).orEmpty()
    private fun JSONObject?.number(name:String,max:Long):Long? {
        if(this==null || !has(name) || isNull(name)) return null
        val value=optLong(name,-1)
        return value.takeIf { it in 0..max }
    }
    fun parse(response:JSONObject):ProviderHealthSnapshot {
        val array=response.optJSONArray("providers")
            ?: throw IllegalArgumentException("Provider health has no providers array")
        val rows=(0 until array.length()).mapNotNull rowLoop@{ index ->
            val entry=array.optJSONObject(index)?:return@rowLoop null
            val id=entry.string("id",35)
            val name=names[id]?:return@rowLoop null
            val pool=entry.optJSONArray("pool")
            val slots=(0 until (pool?.length()?:0).coerceAtMost(8)).mapNotNull slotLoop@{ j ->
                val slot=pool?.optJSONObject(j)?:return@slotLoop null
                val slotNumber=slot.optInt("slot",0)
                if (slotNumber<=0) return@slotLoop null
                ProviderSlotHealth(slotNumber,slot.string("status",32),
                    slot.string("model"),slot.number("http",599)?.toInt(),
                    slot.number("latencyMs",120_000),slot.number("checkedAt",4_102_444_800_000),
                    slot.string("reason",180))
            }
            ProviderHealthDetail(id,name,entry.string("status",32),
                entry.string("model"),entry.number("http",599)?.toInt(),
                entry.number("latencyMs",120_000),entry.string("reason",180),slots)
        }
        val catalogue=response.optJSONObject("freeModels")
        val raw=catalogue?.optJSONArray("models")
        val models=(0 until (raw?.length()?:0).coerceAtMost(150)).mapNotNull modelLoop@{ i ->
            val model=raw?.optJSONObject(i)?:return@modelLoop null
            model.string("name").ifBlank { model.string("id") }.takeIf { it.isNotBlank() }
        }
        return ProviderHealthSnapshot(
            response.number("checkedAt",4_102_444_800_000),rows,models,
            (catalogue?.optInt("total",models.size)?:models.size).coerceAtLeast(models.size),
            catalogue.string("status",35))
    }
}
