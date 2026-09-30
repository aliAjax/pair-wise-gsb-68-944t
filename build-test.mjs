import { build } from 'esbuild'
// 无头逻辑测试打包脚本（esbuild 随 vite 已安装，无需额外依赖）
await build({
  entryPoints: ['test/logic-test.ts'],
  bundle: true,
  format: 'cjs',
  platform: 'node',
  outfile: 'test/test-bundle.cjs',
  inject: ['test/shim.ts'],
  define: { 'import.meta.env': '{}' },
  logLevel: 'warning'
})
