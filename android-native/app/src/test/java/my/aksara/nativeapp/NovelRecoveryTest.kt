package my.aksara.nativeapp

import my.aksara.nativeapp.feature.library.novelIndexOrNull
import org.junit.Assert.*
import org.junit.Test

class NovelRecoveryTest {
    @Test fun emptyNovelNeverSelectsAChapter(){
        assertNull(novelIndexOrNull(0,0))
        assertNull(novelIndexOrNull(7,-1))
    }
    @Test fun bookmarksAreClampedToAvailableChapters(){
        assertEquals(0,novelIndexOrNull(-2,8))
        assertEquals(7,novelIndexOrNull(1000,8))
        assertEquals(4,novelIndexOrNull(4,8))
    }
}
