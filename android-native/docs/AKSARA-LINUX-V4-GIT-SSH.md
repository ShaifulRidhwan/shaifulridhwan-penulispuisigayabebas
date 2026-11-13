# AKSARA Linux V4 · Git and SSH Workstation

Git, OpenSSH and development tools are bundled with Alpine V3. The V4 GIT
shortcuts are explicit commands on the existing terminal, not a second Git UI.

## Create local repo
cd /workspace
mkdir -p project && cd project
git init
git config user.name "Your Name"
git config user.email "you@example.com"
printf 'hello\n' > hello.txt
git add hello.txt
git commit -m "first commit"
git status

## Generate a private SSH identity on-device
mkdir -p ~/.ssh
chmod 700 ~/.ssh
ssh-keygen -t ed25519 -a 64 -f ~/.ssh/id_ed25519
chmod 600 ~/.ssh/id_ed25519
chmod 644 ~/.ssh/id_ed25519.pub
cat ~/.ssh/id_ed25519.pub

Upload **only** the public .pub key through the Git provider's trusted key
settings. Review host fingerprints before accepting new hosts. Never paste
private keys/tokens into Chat or send them to cloud APIs.

## GitHub
ssh -T git@github.com
git clone git@github.com:OWNER/REPOSITORY.git
git -C REPOSITORY status
git -C REPOSITORY pull --ff-only

The Linux Project Vault excludes ~/.ssh and common .env/secrets from backups.
User changes to rootfs are preserved on compatible APK updates; an incompatible
rootfs revision must not be silently replaced.

A remote push/pull requires the owner's credentials and actual network access.
No background sync, credential injection or automatic write authorization.
