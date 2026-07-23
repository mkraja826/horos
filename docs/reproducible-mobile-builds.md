# Reproducible mobile build contract

Horos production mobile builds use the exact toolchain declared in the repository.

- Node.js: `20.19.4`
- npm: `10.8.2`
- Lockfile: npm lockfile version 3
- EAS build profiles: inherit the pinned Node runtime from `build.base`
- Root and legacy Worker direct dependencies: exact semantic versions only

## Install and verify

```powershell
nvm use 20.19.4
npm install --global npm@10.8.2
npm ci
npm run verify:reproducible
npx expo install --check
npm run typecheck
npm run lint
```

Do not hand-edit resolved package versions in `package-lock.json`. Use a dedicated dependency pull request, regenerate the lockfile with the pinned npm version, and require the complete CI suite before merging.

The legacy Cloudflare Worker is retained for type-checking only. Wrangler 4.104.0 requires Node.js 22 or newer for Worker development or deployment; it is not part of the active Supabase backend or EAS mobile build runtime.
