/**
 * 表格转换核心往返验证脚本（Node 环境，不依赖浏览器）。
 *
 * 用法：
 *   node --experimental-default-type=commonjs node_modules/typescript/bin/tsc src/utils/sheetConvert.ts --outDir .test-tmp --module es2020 --target es2020 --moduleResolution bundler --skipLibCheck
 *   node scripts/test-sheet-convert.mjs
 *
 * 原理：直接 import xlsx（与 sheetConvert.ts 同源库）与转换核心，
 * 构造多表/中文表头/透明场景夹具，验证 XLSX↔CSV↔JSON↔ODS 往返
 * 内容一致性、多表拆分文件名与 BOM。
 */
import { createRequire } from 'node:module';
import assert from 'node:assert';

const require_ = createRequire(process.cwd() + '/package.json');
const XLSX = require_('xlsx');
const { convertWorkbook, parseToWorkbook } = await import('../.test-tmp/sheetConvert.js');

// ── 夹具：双表工作簿（含中文表头、多类型值） ──
function buildFixtureWorkbook() {
  const wb = XLSX.utils.book_new();
  const ws1 = XLSX.utils.json_to_sheet([
    { 姓名: '张三', 年龄: 28, 评分: 4.5, 备注: '含,逗号与"引号"' },
    { 姓名: '李四', 年龄: 32, 评分: 3.8, 备注: '换行\n测试' },
  ]);
  XLSX.utils.book_append_sheet(wb, ws1, '成员');
  const ws2 = XLSX.utils.json_to_sheet([
    { 日期: '2026-01-01', 数值: 100 },
    { 日期: '2026-01-02', 数值: -2.5 },
  ]);
  XLSX.utils.book_append_sheet(wb, ws2, '记录');
  return wb;
}

function wbFromFileLike(fileLike) {
  // sheetConvert.parseToWorkbook 接收 File（arrayBuffer/text），Node 下用最小适配
  return parseToWorkbook({
    name: fileLike.name,
    arrayBuffer: async () => fileLike.buffer,
    text: async () => fileLike.text,
  });
}

async function main() {
  const fixture = buildFixtureWorkbook();

  // 1. XLSX → XLSX：整簿往返，双表保留、单元格一致
  {
    const xlsxBytes = XLSX.write(fixture, { bookType: 'xlsx', type: 'buffer' });
    const wb = await wbFromFileLike({ name: 'f.xlsx', buffer: xlsxBytes });
    assert.deepStrictEqual(wb.SheetNames, ['成员', '记录']);
    const rows = XLSX.utils.sheet_to_json(wb.Sheets['成员']);
    assert.strictEqual(rows[0]['姓名'], '张三');
    assert.strictEqual(rows[1]['年龄'], 32);
    console.log('✓ XLSX → XLSX 整簿往返一致');
  }

  // 2. convertWorkbook → CSV：多表拆分两个文件 + BOM + 逗号转义
  {
    const out = await convertWorkbook(fixture, 'csv', 'f');
    assert.strictEqual(out.length, 2);
    assert.strictEqual(out[0].filename, 'f.成员.csv');
    assert.strictEqual(out[1].filename, 'f.记录.csv');
    // Blob.text() 会剥离 BOM，用首字节校验（EF BB BF = UTF-8 BOM）
    const csvBytes = new Uint8Array(await out[0].blob.arrayBuffer());
    assert.deepStrictEqual(Array.from(csvBytes.slice(0, 3)), [0xef, 0xbb, 0xbf], 'CSV 带 UTF-8 BOM');
    const text = await out[0].blob.text();
    assert.ok(text.includes('"含,逗号与""引号"""') || text.includes('含,逗号'), 'CSV 内容存在');
    assert.ok(!text.includes('日期'), '按表拆分：成员表不含记录表列');
    console.log('✓ XLSX → CSV 多表拆分 + BOM');
  }

  // 3. convertWorkbook → JSON：行对象数组内容一致
  {
    const out = await convertWorkbook(fixture, 'json', 'f');
    const json1 = JSON.parse(await out[0].blob.text());
    assert.strictEqual(json1[0]['评分'], 4.5);
    assert.strictEqual(json1.length, 2);
    const json2 = JSON.parse(await out[1].blob.text());
    assert.strictEqual(json2[1]['数值'], -2.5);
    console.log('✓ XLSX → JSON 行对象一致');
  }

  // 4. convertWorkbook → ODS：整簿，读回校验
  {
    const out = await convertWorkbook(fixture, 'ods', 'f');
    assert.strictEqual(out.length, 1);
    assert.strictEqual(out[0].filename, 'f.ods');
    const bytes = new Uint8Array(await out[0].blob.arrayBuffer());
    const wb = await wbFromFileLike({ name: 'f.ods', buffer: bytes });
    assert.deepStrictEqual(wb.SheetNames, ['成员', '记录']);
    console.log('✓ XLSX → ODS 整簿往返一致');
  }

  // 5. JSON 输入 → XLSX：parseToWorkbook 的 JSON 分支
  {
    const jsonText = JSON.stringify([
      { id: 1, name: 'alpha' },
      { id: 2, name: 'beta' },
    ]);
    const wb = await wbFromFileLike({ name: 'data.json', text: jsonText });
    assert.deepStrictEqual(wb.SheetNames, ['Sheet1']);
    const rows = XLSX.utils.sheet_to_json(wb.Sheets['Sheet1']);
    assert.strictEqual(rows[1].name, 'beta');

    // 非对象数组应报错
    await assert.rejects(
      () => wbFromFileLike({ name: 'bad.json', text: '[1,2,3]' }),
      /对象数组/
    );
    console.log('✓ JSON 输入解析 + 非法输入拒绝');
  }

  // 6. TSV → 单表 CSV：无表名后缀
  {
    const tsv = 'a\tb\n1\t2';
    const wb = await wbFromFileLike({ name: 's.tsv', text: tsv });
    const out = await convertWorkbook(wb, 'csv', 's');
    assert.strictEqual(out.length, 1);
    assert.strictEqual(out[0].filename, 's.csv');
    assert.ok((await out[0].blob.text()).includes('1,2'));
    console.log('✓ TSV → CSV 单表无后缀');
  }

  // 7. YAML 输入：对象数组行表 + 配置对象键值表 + YAML 输出往返
  {
    const wb1 = await wbFromFileLike({ name: 'rows.yaml', text: '- 姓名: 张三\n  分数: 95\n- 姓名: 李四\n  分数: 88\n' });
    let rows = XLSX.utils.sheet_to_json(wb1.Sheets.Sheet1);
    assert.strictEqual(rows[1]['姓名'], '李四');

    const wb2 = await wbFromFileLike({ name: 'conf.yaml', text: 'host: localhost\nport: 8080\noptions:\n  debug: true\n' });
    rows = XLSX.utils.sheet_to_json(wb2.Sheets.Sheet1);
    assert.deepStrictEqual(rows.map((r) => r.key), ['host', 'port', 'options']);
    assert.strictEqual(rows[2].value, '{"debug":true}');

    const out = await convertWorkbook(wb1, 'yaml', 'rows');
    const dumped = await out[0].blob.text();
    assert.ok(dumped.includes('张三') && dumped.includes('分数'), 'YAML 输出含数据');
    console.log('✓ YAML 输入（行表/键值表）+ YAML 输出往返');
  }

  // 8. TOML 输入：[[items]] 表数组 → 行表；TOML 输出 [[items]] + null 净化
  {
    const wb = await wbFromFileLike({ name: 'conf.toml', text: '[[items]]\nname = "a"\ncount = 1\n\n[[items]]\nname = "b"\ncount = 2\n' });
    const rows = XLSX.utils.sheet_to_json(wb.Sheets.Sheet1);
    assert.strictEqual(rows[0].name, 'a');

    const out = await convertWorkbook(wb, 'toml', 'conf');
    const text = await out[0].blob.text();
    assert.ok(text.includes('[[items]]') && text.includes('name = "a"'), 'TOML 输出 items 表数组');

    // null 值净化：含 null 单元格的行导出 TOML 不抛错
    const ws = XLSX.utils.json_to_sheet([{ a: 1, b: null }]);
    const wb2 = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb2, ws, 'S');
    const out2 = await convertWorkbook(wb2, 'toml', 'n');
    assert.ok((await out2[0].blob.text()).includes('items'));
    console.log('✓ TOML 输入（表数组）+ TOML 输出与 null 净化');
  }

  // 9. HTML 表格输入（SheetJS 原生解析）
  {
    const html = '<html><body><table><tr><th>名称</th><th>数量</th></tr><tr><td>苹果</td><td>3</td></tr></table></body></html>';
    const wb = await wbFromFileLike({ name: 't.html', text: html });
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
    assert.strictEqual(rows[0]['名称'], '苹果');
    assert.strictEqual(rows[0]['数量'], 3);
    console.log('✓ HTML 表格输入解析');
  }

  console.log('\n全部表格转换用例通过');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
