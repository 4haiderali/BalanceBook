import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins:[react()],
  build:{outDir:'desktop-dist/web',rolldownOptions:{input:{home:'index.html',setup:'setup/index.html'}}},
});
