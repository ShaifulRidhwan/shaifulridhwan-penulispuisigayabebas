# AKSARA Android Stable Recovery · 17 Nov 2026

Rollback merged Agentic PR #328, close unmerged experimental mic PR #331, preserve Linux Advanced PR #329 and all other Android features.

Embedded Alpine 3.22 ARM64 pentest suite:
nmap, ncat, ffuf, nikto.pl, sqlmap, openssl, john, hydra, tshark, tcpdump.

The build should install security tools within Alpine at CI packaging time, with sqlmap pinned to upstream commit 6faa9bb929347189a62c046d7d02349140e9933d, and check that each executable exists inside the final APK. One package installation failure must not prevent attempts for other tools; the release gate must reject incomplete APKs.

Local inspection: aksara-security --live | --check | --report | --local. Local scan targets only 127.0.0.1. Rootless PRoot has no promise of raw packet privileges.

Only use penetration-testing tools on owned or expressly authorized targets. Never mark an APK stable without successful CI and real device QA.