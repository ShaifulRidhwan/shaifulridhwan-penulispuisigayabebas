package my.aksara.nativeapp

import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class NativeLibraryAssetsTest {
    @Test fun originalLiteraryAssetsArePackaged() {
        val app=InstrumentationRegistry.getInstrumentation().targetContext
        val poems=JSONArray(app.assets.open("karya-index.json").bufferedReader().use{it.readText()})
        assertTrue("Poetry catalogue missing",poems.length()>=30)
        for(i in 0 until poems.length()) {
            val row=poems.getJSONObject(i)
            assertTrue(row.optString("title").isNotBlank())
            assertTrue((row.optJSONArray("lines")?.length() ?: 0) > 0)
        }
        val novel=JSONObject(app.assets.open("novel-kb.json").bufferedReader().use{it.readText()})
        val sections=novel.getJSONArray("sections")
        assertTrue("Novel sections missing",sections.length()>=8)
        for(i in 0 until sections.length()){
            val section=sections.getJSONObject(i)
            assertTrue(section.getString("title").isNotBlank())
            assertTrue(section.getJSONArray("paragraphs").length()>0)
        }
    }
}
