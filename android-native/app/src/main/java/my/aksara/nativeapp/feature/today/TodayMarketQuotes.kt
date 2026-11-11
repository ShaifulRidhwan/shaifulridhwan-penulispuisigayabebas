package my.aksara.nativeapp.feature.today

import android.content.Context
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.OkHttpClient
import okhttp3.Request
import org.json.JSONObject
import java.util.concurrent.TimeUnit

internal data class TodayMarketQuote(
    val symbol:String,val usd:Double,val change24h:Double?,val updatedAt:Long?
)
internal data class TodayMarketResult(
    val quotes:Map<String,TodayMarketQuote>,val cached:Boolean,val checkedAt:Long
)

/** Explicit CoinGecko IDs, never ticker-search heuristics that confuse unrelated tokens. */
internal object TodayMarketIds {
    val mapped=linkedMapOf(
        "BTC" to "bitcoin", "ETH" to "ethereum", "XRP" to "ripple",
        "LTC" to "litecoin", "BCH" to "bitcoin-cash", "SOL" to "solana",
        "ADA" to "cardano", "LINK" to "chainlink", "UNI" to "uniswap",
        "AVAX" to "avalanche-2", "DOT" to "polkadot",
        "ATOM" to "cosmos", "WLD" to "worldcoin-wld", "XLM" to "stellar",
        "SNX" to "havven", "MKR" to "maker", "CRV" to "curve-dao-token",
        "AAVE" to "aave", "NEAR" to "near", "ALGO" to "algorand",
        "HBAR" to "hedera-hashgraph", "GRT" to "the-graph"
    )
    // SC's older MATIC determination must not be silently attached to migrated POL.
    const val unsupportedLegacy="MATIC"
    fun parse(raw:String):Map<String,TodayMarketQuote> {
        val root=JSONObject(raw)
        val result=linkedMapOf<String,TodayMarketQuote>()
        mapped.forEach { (symbol,id) ->
            val row=root.optJSONObject(id) ?: return@forEach
            if(!row.has("usd") || row.isNull("usd"))return@forEach
            val usd=row.optDouble("usd",Double.NaN)
            if(!usd.isFinite() || usd<=0)return@forEach
            val change=row.optDouble("usd_24h_change",Double.NaN)
                .takeIf { it.isFinite() }
            val stamp=row.optLong("last_updated_at",0).takeIf { it>0L }
            result[symbol]=TodayMarketQuote(symbol,usd,change,stamp)
        }
        require(result.isNotEmpty()) { "Tiada sebarang harga sah" }
        return result
    }
}

internal class TodayMarketQuotes(context:Context) {
    private val prefs=context.applicationContext.getSharedPreferences("aksara_today_markets",Context.MODE_PRIVATE)
    private val client=OkHttpClient.Builder().connectTimeout(8,TimeUnit.SECONDS)
        .readTimeout(12,TimeUnit.SECONDS).callTimeout(18,TimeUnit.SECONDS).build()
    suspend fun quotes():TodayMarketResult=withContext(Dispatchers.IO) {
        val now=System.currentTimeMillis()
        val old=prefs.getString("json",null)
        val fetched=prefs.getLong("at",0L)
        fun saved():TodayMarketResult?=old?.let {
            runCatching { TodayMarketResult(TodayMarketIds.parse(it),true,fetched) }.getOrNull()
        }
        if(now-fetched<15*60_000L)saved()?.let { return@withContext it }
        val ids=TodayMarketIds.mapped.values.joinToString(",")
        val url="https://api.coingecko.com/api/v3/simple/price?ids="+ids+
            "&vs_currencies=usd&include_24hr_change=true&include_last_updated_at=true"
        runCatching {
            client.newCall(Request.Builder().url(url)
                .header("User-Agent","AksaraAndroid/0.2 (crypto dashboard)")
                .build()).execute().use { response ->
                check(response.isSuccessful) { "CoinGecko HTTP "+response.code }
                val raw=response.body?.string() ?: error("Tiada respons CoinGecko")
                check(raw.length<100_000) { "Respons harga terlalu besar" }
                val parsed=TodayMarketIds.parse(raw)
                prefs.edit().putString("json",raw).putLong("at",now).apply()
                TodayMarketResult(parsed,false,now)
            }
        }.getOrElse {saved() ?: TodayMarketResult(emptyMap(),false,0L)}
    }
}
