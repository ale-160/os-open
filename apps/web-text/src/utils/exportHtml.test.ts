import { describe, expect, it } from 'vitest';
import { renderMarkdownHtml } from './exportHtml';

const bodyOf = (html: string) => html.slice(html.indexOf('<div class="container">'));

describe('renderMarkdownHtml', () => {
  it('输出完整 HTML 文档骨架', () => {
    const html = renderMarkdownHtml('hello', 'doc');
    expect(html.startsWith('<!DOCTYPE html>')).toBe(true);
    expect(html).toContain('<meta charset="UTF-8" />');
    expect(html).toContain('<title>doc</title>');
    expect(bodyOf(html)).toContain('<p>hello</p>');
  });

  it('标题转义 < 与 &，防止注入 / 实体被误解析', () => {
    const html = renderMarkdownHtml('', '</title><script>x</script> R&D &copy;');
    expect(html).toContain('<title>&lt;/title>&lt;script>x&lt;/script> R&amp;D &amp;copy;</title>');
    expect(html).not.toContain('<script>');
  });

  it('GFM：表格、删除线、任务列表', () => {
    const body = bodyOf(
      renderMarkdownHtml('| a | b |\n|---|---|\n| 1 | 2 |\n\n~~old~~\n\n- [x] done\n- [ ] todo', 't')
    );
    expect(body).toContain('<table>');
    expect(body).toContain('<td>1</td>');
    expect(body).toContain('<del>old</del>');
    expect(body.match(/type="checkbox"/g)).toHaveLength(2);
    expect(body).toMatch(/<input[^>]*checked/);
  });

  it('代码块带 highlight.js 高亮类名', () => {
    const body = bodyOf(renderMarkdownHtml('```js\nconst x = 1;\n```', 't'));
    expect(body).toContain('language-js');
    expect(body).toContain('hljs');
    expect(body).toMatch(/<span class="hljs-keyword">const<\/span>/);
  });

  it('允许安全的内联 HTML，但清除脚本、事件处理器与 javascript: 链接', () => {
    const md = [
      '<kbd>Ctrl</kbd>',
      '',
      '<script>alert(1)</script>',
      '',
      '<img src="x.png" onerror="alert(1)">',
      '',
      '[bad](javascript:alert(1)) [good](https://example.com)',
    ].join('\n');
    const body = bodyOf(renderMarkdownHtml(md, 't'));
    expect(body).toContain('<kbd>Ctrl</kbd>');
    expect(body).not.toContain('<script');
    expect(body).not.toContain('onerror');
    expect(body).not.toContain('javascript:');
    expect(body).toContain('href="https://example.com"');
    expect(body).toContain('src="x.png"');
  });
});
