# AKSARA Game preview

The isolated experiment branch builds a Godot 4.3 web preview with GitHub Actions. On a successful export, the workflow attempts deployment to the dedicated Netlify test site when repository secrets `AKSARA_GAME_NETLIFY_TOKEN` and `AKSARA_GAME_NETLIFY_SITE_ID` are available. Do not merge this experiment into production without mobile validation.
