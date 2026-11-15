# okapi

`VERSION` is the source of truth for the public app version. Versioning starts at `0.0.1`. The release build copies this version into the page so About shows the version currently deployed.

- Small fixes, polish, and maintenance are patch releases. Run `bash frontend/build.sh` from the project root. It bumps the last number automatically.
- Large features and substantial changes are minor releases. Run `bash frontend/build.sh minor`. It bumps the middle number and resets the patch to zero.
- Bump the first number only when the user explicitly requests it. In that case run `bash frontend/build.sh major --user-requested`. It resets both lower numbers to zero.
- For development or to build a version that has already been assigned, use `bash frontend/build.sh --current`, which leaves `VERSION` as is.

Choose the release type once per set of changes. Do validation builds with `--current`, then run the release build once and deploy its generated HTML, matching asset directory, and `VERSION`. The script updates `VERSION` after building successfully. If deployment needs a retry, deploy the same artifacts instead of bumping again. Keep the deployed `VERSION` with the matching HTML.
