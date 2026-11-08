# Build and device testing

Use JDK 17, Android SDK 35 and the checked-in Gradle 8.13 wrapper with its SHA-256 verification.

```sh
cd android-native
./gradlew testDebugUnitTest :engine:runtime:testDebugUnitTest assembleDebug assembleDebugAndroidTest
adb install -r app/build/outputs/apk/debug/app-debug.apk
adb shell am start -n my.aksara.nativeapp/.MainActivity
```

The debug application ID is `my.aksara.nativeapp`. Android 12/API 31 or newer is required. This is a new application ID; it does not overwrite an old APK's data. A different debug signing certificate across independent build environments may require uninstalling the previous debug installation; export any needed session before doing so.

Practical acceptance checklist:

- Compare 360/390/412dp welcome, chat, streaming, Connection, Code Engine, Terminal, Portal, Thinking Mode, attachments and voice permission screenshots with the pinned web references. Inspect fonts, wrapping, glass clipping and icon alignment separately from the background score.
- Launch/re-enter without automatically opening the keyboard. Type a multiline message; open and dismiss every overlay; check IME resizing and Back behavior.
- Send real chat, cancel during response, disconnect the network, restore it and check that partial messages are not falsely marked complete. Validate server-side quota errors and retry timing.
- Verify original local journey starters and explicit provider handoff on a newly typed question.
- Close/reopen and rotate; restore the saved conversation. Validate encrypted storage and recovery from an unreadable session without overwriting it.
- Execute JS arithmetic, a timeout loop, SQL SELECT and Android shell `printf`. Verify isolated code cannot read the application's private test file. Do not classify this as a Linux distribution.
- Deny microphone permission; check no audio is sent. Then allow it, validate a real Gemini Live conversation, Aoede, mic mute, speaker mute, volume, interruption and timer. Background the app and confirm microphone shutdown.
- Test supported attachments and actual backend rejection paths. Large file and unsupported format errors must be explicit.
- Measure cold launch, memory PSS, installed footprint and crashes on an emulator and a physical phone. Emulator measurements are not claimed as physical-device measurements.

CI screenshots use labelled fixtures with backend inference intercepted. The actual live-chat smoke response is separately recorded in `test-evidence/`. The visual job intentionally fails if any screen or component is below 98% SSIM, missing, or uses a different viewport. That threshold does not waive manual inspection.

Do not merge the draft PR or claim full completion while the feature audit or visual report contains critical gaps.
