package my.aksara.engine.avatar

import android.content.Context
import android.view.Choreographer
import android.view.TextureView
import android.view.View
import com.google.android.filament.*
import com.google.android.filament.utils.*
import com.google.android.filament.android.UiHelper
import java.nio.ByteBuffer

/** Actual native glTF renderer. The exact web model is bundled, never a screenshot. */
class VoiceAvatarView(context:Context):TextureView(context),Choreographer.FrameCallback {
    companion object {init {Utils.init()}}
    private var viewer:ModelViewer?=null
    private var lastFrame=0L
    init {isOpaque=false}
    override fun onAttachedToWindow(){
        super.onAttachedToWindow()
        val targetY=.9987407f-.4387087f*.38f
        val visibleHeight=.4387087f*2.55f
        val distance=(visibleHeight/(2*Math.tan(Math.toRadians(17.0)))*1.07).toFloat()
        val manipulator=Manipulator.Builder().targetPosition(0f,targetY,.0354368f).orbitHomePosition(0f,targetY,.0354368f+distance).build(Manipulator.Mode.ORBIT)
        val ui=UiHelper(UiHelper.ContextErrorPolicy.DONT_CHECK).apply {isOpaque=false}
        val model=ModelViewer(textureView=this,uiHelper=ui,manipulator=manipulator)
        viewer=model
        model.view.blendMode=com.google.android.filament.View.BlendMode.TRANSLUCENT
        model.renderer.clearOptions=Renderer.ClearOptions().apply{clear=true;clearColor=floatArrayOf(0f,0f,0f,0f)}
        model.loadModelGlb(ByteBuffer.wrap(context.assets.open("models/brunette.glb").use{it.readBytes()}))
        model.asset?.let {asset ->
            val box=asset.boundingBox;val center=box.center;val half=box.halfExtent;val scale=2.5f/(2f*half[1])
            val matrix=floatArrayOf(scale,0f,0f,0f,0f,scale,0f,0f,0f,0f,scale,0f,-center[0]*scale,-center[1]*scale,-center[2]*scale,1f)
            model.engine.transformManager.setTransform(model.engine.transformManager.getInstance(asset.root),matrix)
        }
        val light=model.engine.lightManager;val instance=light.getInstance(model.light)
        light.setDirection(instance,.6f,-.5f,-.65f);light.setColor(instance,.918f,.773f,.553f);light.setIntensity(instance,100000f)
        // Low order irradiance supplies the web's hemisphere fill; no duplicate HDR asset.
        model.scene.indirectLight=IndirectLight.Builder().irradiance(1,floatArrayOf(.8f,.78f,.9f)).intensity(25000f).build(model.engine)
        Choreographer.getInstance().postFrameCallback(this)
    }
    override fun doFrame(frameTimeNanos:Long){
        val model=viewer?:return
        if(isAttachedToWindow&&visibility==View.VISIBLE&&windowVisibility==View.VISIBLE){
            if(frameTimeNanos-lastFrame>=33_000_000L){
                if(width>0&&height>0)model.camera.setProjection(34.0,width.toDouble()/height,.1,40.0,Camera.Fov.VERTICAL)
                model.animator?.updateBoneMatrices();model.render(frameTimeNanos);lastFrame=frameTimeNanos
            }
            Choreographer.getInstance().postFrameCallback(this)
        }
    }
    override fun onWindowVisibilityChanged(visibility:Int){super.onWindowVisibilityChanged(visibility);if(visibility==View.VISIBLE&&viewer!=null){Choreographer.getInstance().removeFrameCallback(this);Choreographer.getInstance().postFrameCallback(this)}}
    override fun onDetachedFromWindow(){Choreographer.getInstance().removeFrameCallback(this);viewer=null;super.onDetachedFromWindow()}
}
