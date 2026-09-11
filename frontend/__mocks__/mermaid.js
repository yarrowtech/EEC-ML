// Jest test double for the `mermaid` package: mermaid ships ESM-only and
// isn't transformed by the current Babel/Jest config, so any test that
// imports a component depending on it (MermaidBlock, TutorMessageContent)
// fails at import time with "Cannot use import statement outside a module"
// unless mermaid itself is swapped out here.
function initialize() {}
function render() {
  return Promise.resolve({ svg: '<svg data-testid="mermaid-mock-svg" />' });
}

module.exports = { initialize, render };
module.exports.default = module.exports;
