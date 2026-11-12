package my.aksara.nativeapp.core.neural

/** Tracks confirmed native state separately from a pending verification/load request. */
data class NeuralActivationState(val loadedId: String? = null, val pendingId: String? = null) {
    fun begin(id: String) = copy(pendingId = id)
    fun unloaded() = copy(loadedId = null)
    fun confirmed(nativeLoaded: Boolean): NeuralActivationState {
        check(nativeLoaded && pendingId != null) { "Runtime belum mengesahkan model dimuatkan." }
        return NeuralActivationState(loadedId = pendingId)
    }
    fun reconcile(nativeLoaded: Boolean) = if (nativeLoaded) copy(pendingId = null) else NeuralActivationState()
    fun canUse(runtimeAvailable: Boolean, busy: Boolean) = runtimeAvailable && loadedId != null && pendingId == null && !busy
}
