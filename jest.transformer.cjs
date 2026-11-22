const esbuild = require('esbuild');

module.exports = {
  process(sourceText, sourcePath) {
    const loader = sourcePath.endsWith('.tsx')
      ? 'tsx'
      : sourcePath.endsWith('.jsx')
      ? 'jsx'
      : 'ts';
    const result = esbuild.transformSync(sourceText, {
      loader,
      format: 'cjs',
      target: 'es2022',
      jsx: 'automatic',
      sourcemap: 'inline',
      sourcefile: sourcePath,
    });
    return {
      code: result.code,
      map: result.map,
    };
  },
};
