/// <reference path="../.astro/types.d.ts" />
/// <reference types="astro/client" />
interface ImportMetaEnv {
  readonly PUBLIC_SITE_URL?: string;
  readonly PUBLIC_ISSUES_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare module '*?worker&url' {
  const url: string;
  export default url;
}
