/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_DEFAULT_ORG?: string;
  readonly VITE_DATA_BASE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
