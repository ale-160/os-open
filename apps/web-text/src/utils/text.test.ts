import { describe, expect, it } from 'vitest';
import {
  appendMarkdownImage,
  countText,
  docNameFromFileName,
  ensureMdExtension,
  isMarkdownFileName,
} from './text';

describe('countText', () => {
  it('空文本', () => {
    expect(countText('')).toEqual({ chars: 0, words: 0 });
  });

  it('英文按词计数，缩写与连字符算一个词', () => {
    expect(countText("Hello world, it's a well-known fact").words).toBe(6);
    // 弯引号缩写同样算一个词
    expect(countText('don’t stop').words).toBe(2);
  });

  it('中文按字计数，标点不计', () => {
    expect(countText('你好，世界。').words).toBe(4);
  });

  it('中英混排：中文字数 + 英文词数', () => {
    // 使用/构建/编辑器 = 7 字；Next、js、Markdown = 3 词
    expect(countText('使用 Next.js 构建 Markdown 编辑器').words).toBe(10);
  });

  it('日文假名与韩文按字计数', () => {
    expect(countText('ひらがなカタカナ').words).toBe(8);
    expect(countText('안녕하세요').words).toBe(5);
  });

  it('Markdown 语法符号不计为词', () => {
    expect(countText('## Title\n\n- **bold** `code`').words).toBe(3);
  });

  it('chars 按码点计数：emoji 等代理对只算 1 个字符', () => {
    expect(countText('a😀b').chars).toBe(3);
    expect(countText('𠮷野家').chars).toBe(3);
    expect(countText('换行\n也算').chars).toBe(5);
  });
});

describe('appendMarkdownImage', () => {
  it('空文档直接写入图片行', () => {
    expect(appendMarkdownImage('', 'data:image/png;base64,AA', 'a.png')).toBe(
      '![a.png](data:image/png;base64,AA)\n'
    );
  });

  it('非空文档以空行分隔追加到末尾', () => {
    expect(appendMarkdownImage('# T', 'u', 'n')).toBe('# T\n\n![n](u)\n');
  });

  it('去掉名称中的方括号，避免破坏 Markdown 图片语法', () => {
    expect(appendMarkdownImage('', 'u', 'shot [1] [final]')).toBe('![shot 1 final](u)\n');
  });
});

describe('文件名处理', () => {
  it('isMarkdownFileName 识别 md/markdown/txt（大小写不敏感）', () => {
    expect(isMarkdownFileName('a.md')).toBe(true);
    expect(isMarkdownFileName('a.MARKDOWN')).toBe(true);
    expect(isMarkdownFileName('a.Txt')).toBe(true);
    expect(isMarkdownFileName('a.md.png')).toBe(false);
    expect(isMarkdownFileName('md')).toBe(false);
  });

  it('docNameFromFileName 只去掉末尾的一个扩展名', () => {
    expect(docNameFromFileName('notes.md')).toBe('notes');
    expect(docNameFromFileName('v1.2.markdown')).toBe('v1.2');
    expect(docNameFromFileName('a.md.txt')).toBe('a.md');
    expect(docNameFromFileName('image.png')).toBe('image.png');
  });

  it('ensureMdExtension 补全 .md，已有后缀（含大写）不重复追加', () => {
    expect(ensureMdExtension('notes')).toBe('notes.md');
    expect(ensureMdExtension('notes.md')).toBe('notes.md');
    expect(ensureMdExtension('NOTES.MD')).toBe('NOTES.MD');
    expect(ensureMdExtension('notes.markdown')).toBe('notes.markdown.md');
  });
});
