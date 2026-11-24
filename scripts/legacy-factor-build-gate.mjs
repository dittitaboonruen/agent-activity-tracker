// Production must fail closed if confidential AIA factors are missing or invalid.
// Preview uses synthetic browser fixtures; no screenshot-only QA factors are copied.
if(process.env.VERCEL_ENV==='production' ||
   (process.env.VERCEL_ENV==='preview' &&
    process.env.VERCEL_GIT_COMMIT_REF==='release/legacy-prestige-public-table-b-20261123')){
  await import('./legacy-factor-build-release.mjs');
}else{
  console.log('[Legacy Release Factor] Other previews/CI: private factor verification is scoped to the Legacy release preview');
}
