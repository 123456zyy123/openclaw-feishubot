# IntelliCodeAssistant 任务与 Prompt 模板

## 待办事项

- [ ] 完成需求解析模块
- [ ] 实现代码生成模块
- [ ] 补充测试用例生成能力
- [ ] 增加 CI 配置生成能力
- [ ] 完善模块文档自动生成功能
- [ ] 增加错误定位与自动修复流程

## 模块级 Prompt 模板

### 需求解析 Prompt

```javascript
角色: 分析师
任务: 解析以下用户需求，提取功能点和输入输出要求。
输入: "实现一个函数，对输入数字数组进行排序并返回结果。"
期待输出格式: JSON，包含字段如`功能:`, `输入:`, `输出:`, `步骤:`。
示例:
{
  "功能": "对数字数组进行排序",
  "输入": "数字数组（整数列表）",
  "输出": "升序排序后的数字数组",
  "步骤": ["接收数组", "使用快速排序算法", "返回排序结果"]
}
```

### 代码生成 Prompt

```makefile
角色: 开发者
任务: 根据以下需求说明生成JavaScript函数代码。
输入: 功能"对数字数组进行排序"，输出格式“返回升序排列的数组”。
输出: 包含完整函数代码块，附必要注释。
上下文: 提供需求的JSON格式说明。
示例输出:
function sortArray(arr) {
  // 使用内置sort方法进行排序
  return arr.sort((a, b) => a - b);
}
```

### 测试用例生成 Prompt

```makefile
角色: 测试工程师
任务: 为以下函数生成2个单元测试案例。
输入: 函数名sortArray，功能"对数字数组排序"。
输出: 用于Mocha/Jest测试框架的测试代码（Assert部分）。
示例输出:
test('sortArray空数组', () => { expect(sortArray([])).toEqual([]); });
test('sortArray随机数组', () => { expect(sortArray([3,1,2])).toEqual([1,2,3]); });
```

### CI 配置生成 Prompt

```makefile
角色: DevOps工程师
任务: 生成GitHub Actions的CI配置。
输入: 使用Node.js环境，运行`npm test`。
输出: `.github/workflows/ci.yml`内容。
示例输出:
name: Node CI
on: [push]
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
        with: { node-version: '14' }
      - run: npm install
      - run: npm test
```

### 文档生成 Prompt

```makefile
角色: 文档编写者
任务: 为模块 parser.js 生成简要说明文档。
输入: 模块功能"解析用户输入并生成JSON需求"。
输出: Markdown格式的README段落。
示例输出:
parser.js

parser.js 模块用于读取用户的自然语言需求，并将其转换为结构化的JSON格式，以便后续模块使用。主要功能包括词法分析和需求提取。
```

## 调试/修复 Prompt

### 错误定位 Prompt

```makefile
角色: 调试助手
任务: 分析以下错误信息并定位可能原因。
输入: 错误消息"TypeError: data.sort is not a function"，相关代码行：```return data.sort();```。
输出: 错误原因说明和可能的解决方案。
示例输出:
错误原因: data 不是数组，sort()方法不可用。可能data为对象或未初始化。
解决方案: 确保data为数组，例如在使用之前检查并转换类型。
```

### 自动修复 Prompt

```makefile
角色: 修复助手
任务: 根据需求和错误生成修复补丁，并解释更改。
输入: 错误日志和原始函数代码，需求"返回升序数组"。
输出: 提供修改后的代码片段和注释说明。
示例输出:
修复后的代码:
function sortArray(arr) {
  if (!Array.isArray(arr)) throw new Error("输入必须为数组");
  return arr.sort((a, b) => a - b);
}
说明: 添加类型检查并使用比较函数确保正确排序。
```
