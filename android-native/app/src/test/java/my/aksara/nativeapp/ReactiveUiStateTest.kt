package my.aksara.nativeapp

import my.aksara.nativeapp.core.storage.Message
import my.aksara.nativeapp.feature.chat.ChatState
import my.aksara.nativeapp.feature.chat.ThinkingActivity
import my.aksara.nativeapp.feature.chat.VoiceLinkState
import my.aksara.nativeapp.feature.chat.ProviderIdentity
import org.junit.Assert.*
import org.junit.Test

class ReactiveUiStateTest {
    @Test fun processingIndicatorStopsOnFirstTokenAndCancellation() {
        val user=Message("u","user","Terangkan sesuatu")
        val waiting=Message("a","assistant","",incomplete=true)
        val pending=ChatState(messages=listOf(user,waiting),busy=true)
        assertTrue(ThinkingActivity.awaitingFirstReply(pending))
        assertFalse(ThinkingActivity.awaitingFirstReply(pending.copy(busy=false)))
        assertFalse(ThinkingActivity.awaitingFirstReply(pending.copy(
            messages=listOf(user,waiting.copy(text="Jawapan bermula"))
        )))
        assertFalse(ThinkingActivity.awaitingFirstReply(ChatState(busy=true)))
        assertFalse(ThinkingActivity.awaitingFirstReply(pending.copy(
            messages=listOf(user,waiting.copy(incomplete=false))
        )))
    }

    @Test fun voiceToneComesFromRealLivePhaseNotTextProviderHealth() {
        assertEquals(VoiceLinkState.IDLE, VoiceLinkState.from("idle",false))
        assertEquals(VoiceLinkState.CONNECTING, VoiceLinkState.from("connecting",false))
        assertEquals(VoiceLinkState.CONNECTING, VoiceLinkState.from("reconnecting",false))
        assertEquals(VoiceLinkState.LIVE, VoiceLinkState.from("listening",true))
        assertEquals(VoiceLinkState.LIVE, VoiceLinkState.from("thinking",true))
        assertEquals(VoiceLinkState.LIVE, VoiceLinkState.from("speaking",true))
        assertEquals(VoiceLinkState.IDLE, VoiceLinkState.from("listening",false))
        assertEquals(VoiceLinkState.ERROR, VoiceLinkState.from("error",false))
        assertNotEquals(VoiceLinkState.LIVE.tone,VoiceLinkState.IDLE.tone)
        assertNotEquals(VoiceLinkState.CONNECTING.tone,VoiceLinkState.ERROR.tone)
    }

    @Test fun unknownProviderIsNotSilentlyCalledGemini() {
        assertNull(ProviderIdentity.of(null))
        assertNull(ProviderIdentity.of("mystery-provider"))
        assertEquals("gemini",ProviderIdentity.of("gemini")?.id)
        val icons=listOf("gemini","groq","workers_ai","openrouter")
            .mapNotNull { ProviderIdentity.of(it)?.icon }
        assertEquals(4,icons.toSet().size)
    }
}
