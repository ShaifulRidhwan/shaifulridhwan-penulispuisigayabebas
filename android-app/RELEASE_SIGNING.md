# AKSARA Android · Persistent signing setup

Do **not** commit `.jks`, passwords, or base64 keystores to git, screenshots, tickets or chat.

## Why

GitHub-hosted debug builds are commonly signed with temporary debug keys. A new APK with a different signing certificate cannot update the old APK in place, even with the same `applicationId`.

Persistent QA releases use one private signing keystore across runs. A debug APK cannot normally update to the differently signed release APK in place. Expect **one final uninstall** when switching to a stable signing lineage, and back up any content you want to keep first.

## Create your own private keystore locally

Requires JDK. Example (interactive and prompts for passwords):

```bash
keytool -genkeypair -v -keystore aksara-qa-release.jks \
  -alias aksaraqa -keyalg RSA -keysize 3072 -validity 10000
```

Store the keystore and passwords in a safe location **outside git**. Losing the key may prevent upgrading existing signed installations.

Convert keystore bytes to base64 locally, taking care not to print secrets in logs. On Linux:

```bash
base64 -w 0 aksara-qa-release.jks > aksara-key.b64
```

On macOS: `base64 -i aksara-qa-release.jks | tr -d '\\n' > aksara-key.b64`.

## GitHub Actions secrets

In GitHub repository Settings -> Secrets and variables -> Actions, create four repository secrets:

| Secret | Value |
| --- | --- |
| `AKSARA_ANDROID_KEYSTORE_B64` | Entire base64 keystore text |
| `AKSARA_ANDROID_STORE_PASSWORD` | Keystore password |
| `AKSARA_ANDROID_KEY_ALIAS` | Alias used with keytool |
| `AKSARA_ANDROID_KEY_PASSWORD` | Private key password |

No secret values belong in source code or APK.

When all four secrets exist, the `aksara-android.yml` workflow builds a **signed release APK** and uploads a separate `AKSARA-Android-signed-QA` artifact. The regular debug APK is still built for smoke tests.

This is **QA-only**, not final Play Store approval. Before public release: review app id, signing/rotation and distribution method, permissions, privacy policy, abuse controls, and release tests.
