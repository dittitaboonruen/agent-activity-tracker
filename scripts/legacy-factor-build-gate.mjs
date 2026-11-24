// Production must fail closed if confidential AIA factors are missing or invalid.
// Preview uses synthetic browser fixtures; no screenshot-only QA factors are copied.
if(process.env.VERCEL_ENV==='production'){
  await import('./legacy-factor-build-release.mjs');
}else{
  console.log('[Legacy Release Factor] Preview/CI: factor input withheld; production verification is mandatory');
}
