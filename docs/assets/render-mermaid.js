// GitHub Pages renders Mermaid fences as code; GitHub's repository view handles them itself.
const blocks = document.querySelectorAll('pre > code.language-mermaid');

if (blocks.length > 0) {
  for (const block of blocks) {
    const diagram = document.createElement('pre');
    diagram.className = 'mermaid';
    diagram.textContent = block.textContent;
    block.parentElement.replaceWith(diagram);
  }

  const { default: mermaid } = await import(
    'https://cdn.jsdelivr.net/npm/mermaid@11.17.2/dist/mermaid.esm.min.mjs'
  );
  mermaid.initialize({ startOnLoad: false, securityLevel: 'strict' });
  await mermaid.run({ querySelector: '.mermaid' });
}
