package my.aksara.nativeapp.feature.today

import android.Manifest
import android.app.*
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.content.pm.ServiceInfo
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import android.location.Location
import android.location.LocationListener
import android.location.LocationManager
import android.os.Build
import android.os.IBinder
import android.os.Looper
import androidx.core.content.ContextCompat
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import kotlinx.coroutines.flow.MutableStateFlow
import java.util.Locale

internal data class TodayNavigationState(
    val active:Boolean=false,
    val progress:TodayNavProgress?=null,
    val latitude:Double?=null,
    val longitude:Double?=null,
    val message:String="",
    val voiceAvailable:Boolean=false,
    val offline:Boolean=false,
    val routeEpoch:Long=0L
)

/** UI can be destroyed or screen locked; service owns GPS, guidance and notification. */
internal object TodayNavigationSession {
    val state=MutableStateFlow(TodayNavigationState())
}

/**
 * Foreground LOCATION service started only after a visible user gesture and precise permission.
 * No ACCESS_BACKGROUND_LOCATION needed for a user-started foreground service.
 */
class TodayNavigationService:Service(),LocationListener {
    companion object {
        const val START="my.aksara.nativeapp.NAV_START"
        const val STOP="my.aksara.nativeapp.NAV_STOP"
        private const val CHANNEL="aksara_navigation"
        private const val NOTIFICATION_ID=33219
        fun start(context:Context) {
            val intent=Intent(context,TodayNavigationService::class.java).setAction(START)
            ContextCompat.startForegroundService(context,intent)
        }
        fun stop(context:Context) {
            context.startService(Intent(context,TodayNavigationService::class.java).setAction(STOP))
        }
    }
    private var locationManager:LocationManager?=null
    private var voice:TodayNavigationVoice?=null
    private var route:TodayRoute?=null
    private var lastIndex=0
    private var lastAnnounced=-1
    private var lastNotification=0L
    private var lastPosition=0L
    private var offRouteCount=0
    private var isRunning=false
    private val navScope=CoroutineScope(SupervisorJob()+Dispatchers.IO)
    private val routeRepository=TodayRouteRepository()
    private var lastReroute=0L
    private var rerouting=false

    override fun onBind(intent:Intent?):IBinder?=null

    override fun onCreate() {
        super.onCreate()
        val manager=getSystemService(NotificationManager::class.java)
        manager.createNotificationChannel(NotificationChannel(CHANNEL,
            "AKSARA • Panduan navigasi",NotificationManager.IMPORTANCE_LOW))
    }

    override fun onStartCommand(intent:Intent?,flags:Int,startId:Int):Int {
        if(intent?.action==STOP) {
            stopSelf()
            return START_NOT_STICKY
        }
        if(isRunning)return START_NOT_STICKY
        val fine=ContextCompat.checkSelfPermission(this,
            Manifest.permission.ACCESS_FINE_LOCATION)==PackageManager.PERMISSION_GRANTED
        if(!fine) {
            TodayNavigationSession.state.value=TodayNavigationState(
                message="Izin lokasi tepat diperlukan untuk navigasi.")
            stopSelf()
            return START_NOT_STICKY
        }
        val saved=TodaySavedRoute.load(this)
        if(saved==null) {
            TodayNavigationSession.state.value=TodayNavigationState(
                message="Simpan laluan terlebih dahulu sebelum mula.")
            stopSelf()
            return START_NOT_STICKY
        }
        route=saved
        try {
            val notification=notification("Mencari isyarat GPS…")
            if(Build.VERSION.SDK_INT>=Build.VERSION_CODES.Q) {
                startForeground(NOTIFICATION_ID,notification,
                    ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION)
            } else startForeground(NOTIFICATION_ID,notification)
            isRunning=true
            voice=TodayNavigationVoice(this)
            locationManager=getSystemService(Context.LOCATION_SERVICE) as LocationManager
            var subscribed=false
            listOf(LocationManager.GPS_PROVIDER,LocationManager.NETWORK_PROVIDER).forEach { provider ->
                if(locationManager?.isProviderEnabled(provider)==true) {
                    locationManager?.requestLocationUpdates(provider,1_500L,3f,this,
                        Looper.getMainLooper())
                    subscribed=true
                }
            }
            if(!subscribed) {
                TodayNavigationSession.state.value=TodayNavigationState(
                    message="Hidupkan perkhidmatan lokasi untuk panduan GPS.")
                stopSelf()
                return START_NOT_STICKY
            }
            TodayNavigationSession.state.value=TodayNavigationState(active=true,
                message="Navigasi aktif • berfungsi ketika skrin terkunci",
                voiceAvailable=voice?.isMalayReady()==true,
                offline=saved.provider.contains("offline",ignoreCase=true))
            voice?.speakMalay("Panduan navigasi dimulakan.")
        } catch(error:Exception) {
            TodayNavigationSession.state.value=TodayNavigationState(
                message="Tidak dapat memulakan GPS: "+(error.message ?: "ralat"))
            stopSelf()
        }
        return START_NOT_STICKY
    }

    override fun onLocationChanged(location:Location) {
        val saved=route ?: return
        if(!isRunning || location.accuracy>120f || location.latitude !in -90.0..90.0 ||
            location.longitude !in -180.0..180.0)return
        val now=System.currentTimeMillis()
        if(now-lastPosition<1200L)return
        lastPosition=now
        val pos=RouteCoordinate(location.latitude,location.longitude)
        val progress=TodayNavigationMath.progress(saved,pos,lastIndex)
        lastIndex=progress.nearestIndex
        val offRoute=progress.offRouteMetres>100
        offRouteCount=if(offRoute)offRouteCount+1 else 0
        val step=progress.nextStep
        val nearNext=step!=null && progress.distanceToStepMetres<155 &&
            progress.offRouteMetres<65
        if(nearNext && step!!.shapeIndex!=lastAnnounced) {
            voice?.speakMalay(TodayNavigationMath.malayVoice(step.type))
            lastAnnounced=step.shapeIndex
        }
        val destination=saved.points.last()
        val distanceToDestination=TodayNavigationMath.distanceMetres(pos,destination)
        if(distanceToDestination<35 && progress.offRouteMetres<45) {
            voice?.speakMalay("Destinasi telah tiba.")
            TodayNavigationSession.state.value=TodayNavigationState(
                message="Destinasi telah tiba.")
            stopSelf()
            return
        }
        val message=when {
            offRouteCount>=3->"Tersasar daripada laluan. Mencuba laluan semula jika internet tersedia."
            step!=null->TodayNavigationMath.malayVoice(step.type)
            else->"Ikut laluan yang dipaparkan."
        }
        if(offRouteCount>=3 && !rerouting && now-lastReroute>90_000L) {
            val net=getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
            val available=net.getNetworkCapabilities(net.activeNetwork)
                ?.hasCapability(NetworkCapabilities.NET_CAPABILITY_VALIDATED)==true
            if(available) {
                rerouting=true
                lastReroute=now
                val goal=saved.points.last()
                navScope.launch {
                    val revised=runCatching { routeRepository.route(location,goal) }
                    withContext(Dispatchers.Main) {
                        revised.onSuccess { updated ->
                            route=updated
                            TodaySavedRoute.save(this@TodayNavigationService,updated)
                            lastIndex=0
                            lastAnnounced=-1
                            offRouteCount=0
                            TodayNavigationSession.state.value=
                                TodayNavigationSession.state.value.copy(
                                    message="Laluan dikira semula.",
                                    routeEpoch=System.currentTimeMillis())
                            voice?.speakMalay("Laluan telah dikira semula.")
                        }.onFailure {
                            TodayNavigationSession.state.value=
                                TodayNavigationSession.state.value.copy(
                                    message="Rerouting tidak tersedia. Ikut papan tanda jalan.")
                        }
                        rerouting=false
                    }
                }
            }
        }
        val previous=TodayNavigationSession.state.value
        TodayNavigationSession.state.value=previous.copy(
            active=true,progress=progress,latitude=location.latitude,
            longitude=location.longitude,message=message,
            voiceAvailable=voice?.isMalayReady()==true)
        if(now-lastNotification>4_000L) {
            lastNotification=now
            (getSystemService(NotificationManager::class.java))
                .notify(NOTIFICATION_ID,notification(
                    String.format(Locale.US,"Baki %.1f km • %s",
                        progress.remainingMetres/1000.0,message)))
        }
    }

    private fun notification(message:String):Notification {
        val open=Intent(this,my.aksara.nativeapp.MainActivity::class.java)
            .addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP)
        val openPending=PendingIntent.getActivity(this,0,open,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
        val stopIntent=Intent(this,TodayNavigationService::class.java).setAction(STOP)
        val stopPending=PendingIntent.getService(this,1,stopIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
        return Notification.Builder(this,CHANNEL)
            .setSmallIcon(android.R.drawable.ic_menu_mylocation)
            .setContentTitle("AKSARA • Navigasi aktif")
            .setContentText(message.take(180))
            .setStyle(Notification.BigTextStyle().bigText(message.take(180)))
            .setContentIntent(openPending)
            .addAction(Notification.Action.Builder(
                android.R.drawable.ic_menu_close_clear_cancel,"Hentikan",stopPending).build())
            .setOnlyAlertOnce(true)
            .setOngoing(true)
            .setCategory(Notification.CATEGORY_NAVIGATION)
            .build()
    }

    override fun onDestroy() {
        navScope.cancel()
        runCatching { locationManager?.removeUpdates(this) }
        voice?.stop()
        voice=null
        isRunning=false
        TodayNavigationSession.state.value=TodayNavigationSession.state.value.copy(active=false)
        super.onDestroy()
    }
}
