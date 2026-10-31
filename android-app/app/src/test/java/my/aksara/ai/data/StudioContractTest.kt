package my.aksara.ai.data

import org.junit.Assert.assertEquals
import org.junit.Assert.assertThrows
import org.junit.Test

class StudioContractTest {
    @Test fun supportsWebPresetsAndModels() {
        assertEquals(11, StudioContract.presets.size)
        assertEquals(3, StudioContract.models.size)
        assertEquals(5, StudioContract.ratios.size)
    }

    @Test fun nonSquareModelsMustBeKlein() {
        assertThrows(IllegalArgumentException::class.java) {
            StudioSettings("Pemandangan hijau", model="schnell", ratio="9:16").validated()
        }
        StudioSettings("Pemandangan hijau", model="klein", ratio="9:16").validated()
    }

    @Test fun seedAllowedOnlyForKlein() {
        assertThrows(IllegalArgumentException::class.java) {
            StudioSettings("A cinematic portrait", model="ovh", seed=7).validated()
        }
        StudioSettings("A cinematic portrait", model="klein", seed=7).validated()
    }
}
