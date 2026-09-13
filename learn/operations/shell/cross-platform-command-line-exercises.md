---
title: 跨平台命令行全面练习：参数、管道、退出状态与可移植性
domain: operations
depth: deep-dive
created: 2026-09-07
updated: 2026-09-07
---

# 跨平台命令行全面练习：参数、管道、退出状态与可移植性

这组练习围绕[跨平台命令行实验 Demo](./cross-platform-command-line-demo/run-demo.mjs)展开。先阅读[Linux、Windows 与 macOS 命令行：从命令结构到跨平台对照](./cross-platform-command-line.md)，再按下面的闭环操作：

```text
运行 → 观察 → 推理 → 修改 → 验证
```

练习目标不是背诵三套命令，而是能够用证据回答四个问题：谁解析了输入、程序实际收到了哪些参数、数据经过了哪条流、Shell 为什么认为命令成功或失败。

## 运行基线

在仓库根目录执行：

```sh
node learn/operations/shell/cross-platform-command-line-demo/verify.mjs
```

预期顶层状态为 `PASS`，并列出当前机器实际验证的 Shell。例如本仓库在 macOS 14.6、Node.js 22.16.0 上验证时输出：

```text
PASS: command-line demo verified sh, bash, zsh on darwin v22.16.0
```

这个输出不是跨平台认证。验证器只运行当前机器能够找到的 profile；缺少的环境会记录在 `unavailableProfiles` 中。

查看完整实验记录：

```sh
node learn/operations/shell/cross-platform-command-line-demo/run-demo.mjs
```

Demo 会创建一个名称以 `cross-platform-command-line-` 开头的系统临时目录，完成实验后验证路径并自动删除。它不联网、不读取全部环境变量，也不执行任意输入的命令。

## 练习一：从报告重建命令的真实执行链

先不要看答案。运行 `run-demo.mjs`，从 `direct` 和任意一个 `shells` 项中记录：

| 观察项 | 你的记录 |
| --- | --- |
| `direct.actual` |  |
| `literalArguments` |  |
| `expandedVariable` |  |
| `explicitFailureStatus` |  |
| `upstreamFailurePipelineStatus` |  |
| `pipefailStatus` |  |

回答：

1. `direct` 场景有没有 Shell 参与参数解析？
2. `literalArguments` 中为什么 `$HOME` 和 `*.md` 没有展开？
3. `expandedVariable` 为什么仍然只有一个参数，而不是三个单词？
4. 为什么上游退出 7，默认管道状态却可能是 0？

<details>
<summary>答案与评价标准</summary>

1. 没有。`run-demo.mjs` 使用 `spawnSync(process.execPath, [script, ...args])`，参数已经是数组，Node.js 直接把它们交给子进程。
2. Demo 使用各 Shell 的字面量引用规则构造参数。引号在 Shell 解析阶段建立边界并被移除，程序最终只收到字符串 `$HOME` 和 `*.md`。
3. 变量引用被双引号包围；Shell 展开变量后保留一个参数边界。若在 POSIX Shell 中省略双引号，结果还会受到字段拆分和文件名展开影响。
4. 默认情况下，POSIX 风格 Shell 的管道状态通常取最后一个命令。上游探针退出 7，但下游过滤器找到 `error` 后退出 0。Bash/Zsh 开启 `pipefail` 后，报告才显示 7。

完整答案必须区分“程序返回的状态”“整个管道的状态”和“Shell 进程最终返回给父进程的状态”。

</details>

## 练习二：先预测 argv，再让探针裁决

### Bash / Zsh

```bash
probe=learn/operations/shell/cross-platform-command-line-demo/argv-probe.mjs
SHELL_LAB_VALUE='value with spaces'
node "$probe" "two words" '$HOME' '*.md' -dash
node "$probe" "$SHELL_LAB_VALUE"
```

### PowerShell

```powershell
$probe = 'learn\operations\shell\cross-platform-command-line-demo\argv-probe.mjs'
$env:SHELL_LAB_VALUE = 'value with spaces'
node $probe 'two words' '$HOME' '*.md' '-dash'
node $probe "$env:SHELL_LAB_VALUE"
```

### CMD

```bat
set "probe=learn\operations\shell\cross-platform-command-line-demo\argv-probe.mjs"
set "SHELL_LAB_VALUE=value with spaces"
node "%probe%" "two words" "$HOME" "*.md" "-dash"
node "%probe%" "%SHELL_LAB_VALUE%"
```

运行前写出你预测的 `argv` 数组。运行后解释：引号是否出现在最终参数中？三种 Shell 分别用什么语法读取环境变量？

<details>
<summary>答案与评价标准</summary>

两次调用的关键数组应分别是：

```json
["two words", "$HOME", "*.md", "-dash"]
["value with spaces"]
```

引号通常是 Shell 输入语言的一部分，用来建立一个参数边界，不作为普通字符进入最终数组。POSIX Shell 使用 `$SHELL_LAB_VALUE`，PowerShell 使用 `$env:SHELL_LAB_VALUE`，CMD 使用 `%SHELL_LAB_VALUE%`。

完整答案还应指出：PowerShell 变量 `$HOME` 与环境变量 `$env:HOME` 不是同一种语法；CMD 的单引号通常没有 Bash/PowerShell 的字面量字符串含义，所以示例使用双引号。

</details>

## 练习三：不要把屏幕文字当作退出结果

运行：

```sh
node learn/operations/shell/cross-platform-command-line-demo/stream-probe.mjs \
  --stdout "normal result" \
  --stderr "diagnostic message" \
  --exit 7
```

分别记录：

1. 哪一行来自 stdout；
2. 哪一行来自 stderr；
3. Shell 显示的退出状态；
4. 终端是否仅凭颜色就能可靠区分两条流。

Bash/Zsh 查看状态：

```bash
printf 'status=%s\n' "$?"
```

CMD 查看状态：

```bat
echo status=%ERRORLEVEL%
```

PowerShell 查看原生程序状态：

```powershell
$LASTEXITCODE
$?
```

注意：必须在探针之后立即读取状态，不能先运行另一条普通命令再读取。

<details>
<summary>答案与评价标准</summary>

`normal result` 写入 stdout，`diagnostic message` 写入 stderr，原生程序退出码是 7。终端主题可能把 stderr 显示成不同颜色，也可能完全不区分；颜色不是进程协议。

Bash/Zsh 的 `$?` 是上一条管道的整数状态。CMD 使用 `%ERRORLEVEL%`。PowerShell 的 `$LASTEXITCODE` 保存最近原生程序的退出码，`$?` 则是 PowerShell 对上一操作是否成功的布尔判断。二者不能互换成同一个概念。

</details>

## 练习四：分离三条标准流

在一个确认可删除的练习目录中执行下面的等价结构：

```text
stream-probe --stdout OUT --stderr ERR > stdout.txt 2> stderr.txt
```

Bash/Zsh 示例：

```bash
practice_dir=$(mktemp -d)
node learn/operations/shell/cross-platform-command-line-demo/stream-probe.mjs \
  --stdout OUT --stderr ERR \
  > "$practice_dir/stdout.txt" \
  2> "$practice_dir/stderr.txt"
cat "$practice_dir/stdout.txt"
cat "$practice_dir/stderr.txt"
```

回答：

1. 终端为什么没有显示 OUT 和 ERR？
2. 把第二个 `2>` 错写成 `>` 会发生什么？
3. 把第一个 `>` 改成 `>>` 后重复两次，文件内容怎样变化？

完成后先打印并检查 `$practice_dir`，再删除这个由 `mktemp -d` 创建的目录。

```bash
printf '%s\n' "$practice_dir"
ls -la "$practice_dir"
rm "$practice_dir/stdout.txt" "$practice_dir/stderr.txt"
rmdir "$practice_dir"
```

<details>
<summary>答案与评价标准</summary>

- stdout 和 stderr 分别被 Shell 在启动进程前连接到了两个文件，因此不再连接终端显示。
- 两次使用 `>` 指向同一文件会各自以覆盖方式打开目标，结果受打开顺序和写入时机影响，不能当作“自动合并两条流”。合并到 stdout 应明确使用目标 Shell 支持的 `2>&1` 语法。
- `>>` 以追加方式打开；重复两次后应出现两行 `OUT`。

完整答案应说明 `>` 是 Shell 语法，不是 `stream-probe.mjs` 的参数。

</details>

## 练习五：解释默认管道为什么掩盖上游失败

Bash：

```bash
producer=learn/operations/shell/cross-platform-command-line-demo/stream-probe.mjs
filter=learn/operations/shell/cross-platform-command-line-demo/line-filter.mjs

node "$producer" --stdout error --exit 7 | node "$filter" error
printf 'default=%s\n' "$?"

set -o pipefail
node "$producer" --stdout error --exit 7 | node "$filter" error
printf 'pipefail=%s\n' "$?"
```

先预测两次状态，再运行。然后把过滤词从 `error` 改为 `missing`，解释新的结果。

<details>
<summary>答案与评价标准</summary>

- 默认管道：下游找到 `error` 并退出 0，所以管道状态为 0，上游的 7 没有成为整体状态。
- 开启 `pipefail`：管道暴露上游的非零状态，结果为 7。
- 把过滤词改为 `missing` 后，下游也失败并退出 1。默认状态成为 1；开启 `pipefail` 时，Bash 返回最右侧的非零状态，因此也是 1。

合格答案不能只写“`pipefail` 更严格”，而要指出它改变了哪一个状态被选为管道结果。PowerShell 和 CMD 不能直接照抄 Bash 的 `set -o pipefail`。

</details>

## 练习六：用同一个日志任务比较三种管道

目标：从 `fixtures/app.log` 中找出 ERROR 行并统计数量。

Bash/Zsh：

```bash
grep -c ' ERROR ' learn/operations/shell/cross-platform-command-line-demo/fixtures/app.log
```

CMD：

```bat
findstr /c:" ERROR " learn\operations\shell\cross-platform-command-line-demo\fixtures\app.log | find /c /v ""
```

PowerShell：

```powershell
(Select-String ' ERROR ' learn\operations\shell\cross-platform-command-line-demo\fixtures\app.log).Count
```

回答：这三条为什么只能称为“任务等价”，而不是“命令一一对应”？PowerShell 管道中传递的匹配结果是什么类型？

<details>
<summary>答案与评价标准</summary>

预期数量为 2。

- `grep -c` 自己完成匹配和计数。
- CMD 用 `findstr` 输出文本行，再让 `find` 统计行数。
- PowerShell 的 `Select-String` 产生匹配信息对象，`.Count` 读取结果集合数量。

三者达到相同业务结果，但中间数据模型、退出码和空结果行为并不相同。优秀答案会进一步检查“零条匹配”时各命令的输出和退出状态。

</details>

## 练习七：查出一个名字最终解析成什么

在你的环境依次检查 `cd`、`ls`、`curl` 和 `node`。

Bash/Zsh：

```bash
type -a cd
type -a ls
type -a curl
command -v node
```

PowerShell：

```powershell
Get-Command cd -All
Get-Command ls -All
Get-Command curl -All
Get-Command node -All
```

CMD：

```bat
where curl
where node
```

解释每个结果属于 alias、function、Shell builtin、Cmdlet 还是 external executable。然后回答：为什么 PowerShell 中能够输入 `ls`，却不能推断 GNU `ls -la` 一定可用？

<details>
<summary>答案与评价标准</summary>

结果取决于当前机器和配置，没有统一路径答案。判断过程才是练习重点：

- `cd` 在 POSIX Shell 中通常是 builtin，因为子进程无法改变父 Shell 的工作目录。
- PowerShell 的 `ls` 常是 `Get-ChildItem` 的 alias，参数由 Cmdlet 绑定器解释，不是 GNU `ls`。
- `curl` 可能是外部程序，也可能在旧 Windows PowerShell 中解析成别名；用 `Get-Command -All` 才能看见被遮蔽的同名项。
- `where` 主要定位 PATH 中的文件，不能完整报告 CMD 内建命令。

</details>

## 练习八：把 GNU/BSD 差异改成能力检测

下面脚本假设 GNU `stat`：

```bash
size=$(stat -c '%s' some-file.txt)
```

在 macOS 系统 `stat` 上通常需要：

```bash
size=$(stat -f '%z' some-file.txt)
```

任务：不要只判断 `$OSTYPE`，而是先探测目标命令是否支持需要的能力，再选择分支。写出伪代码或可运行脚本，并说明为什么能力检测通常比操作系统名称更精确。

<details>
<summary>答案与评价标准</summary>

一种可接受的结构：

```bash
if stat -c '%s' some-file.txt >/dev/null 2>&1; then
  size=$(stat -c '%s' some-file.txt)
elif stat -f '%z' some-file.txt >/dev/null 2>&1; then
  size=$(stat -f '%z' some-file.txt)
else
  printf '%s\n' 'unsupported stat implementation' >&2
  exit 1
fi
```

操作系统名称不能说明 PATH 最前面是哪一个实现：macOS 可能通过包管理器安装 GNU 工具，容器和精简发行版也可能提供不同实现。能力检测直接验证脚本依赖的行为。

优秀答案还会避免让探测修改数据，并检查测试文件确实存在。

</details>

## 练习九：修改样本，再验证推理是否仍成立

打开 `fixtures/app.log`，先预测新增下面两行后，练习六的三种命令分别会统计多少：

```text
2026-09-07T08:04:00Z error lowercase message
2026-09-07T08:05:00Z ERROR database unavailable
```

修改样本、运行命令并核对。然后设计三种明确策略：

1. 只匹配大写 `ERROR`；
2. 忽略大小写匹配 `error`；
3. 只匹配日志级别字段，避免正文里出现 `error` 时误计数。

完成后恢复样本，使 Demo 验证仍然通过。

<details>
<summary>答案与评价标准</summary>

原条件搜索带空格的 ` ERROR `，新增大写级别行后数量从 2 变成 3；小写 `error` 行不匹配。

策略不能只说“加忽略大小写”：

- 严格大写可以继续使用固定文本，但依赖日志级别规范。
- 忽略大小写可使用 `grep -i`、`findstr /i`、PowerShell `Select-String` 的默认不区分大小写行为，但可能匹配消息正文。
- 字段匹配应先确认日志格式。例如使用能表达“时间戳后的级别字段”的正则或结构化日志解析，而不是对任意位置做子串搜索。

完整答案应说明样本修改如何改变结论，并实际重新运行相关命令。

</details>

## 练习十：避免把不可信文本拼成 Shell 程序

比较两个设计：

```javascript
spawn(command, [userValue])
spawn(`${command} ${userValue}`, { shell: true })
```

假设 `userValue` 来自表单、文件名或网络请求。回答：

1. 哪一种把数据边界保留为参数数组？
2. 哪一种会让 `;`、`&`、`|`、`$()` 等字符有机会被 Shell 重新解释？
3. “给字符串加一层引号”为什么很难成为通用跨平台防护？
4. 什么情况下确实需要 Shell？

不要用真实破坏命令测试。使用 `argv-probe.mjs` 和无害字符串观察最终参数即可。

<details>
<summary>答案与评价标准</summary>

第一种直接传参数数组，父进程已经确定参数边界；第二种把数据拼进 Shell 语言，特殊字符可能参与语法解析。Bash/Zsh、CMD 和 PowerShell 的引号与转义规则不同，而且还可能存在多层解析，因此手工拼接一个“万能转义函数”非常困难。

确实需要 Shell 的场景包括使用管道、重定向、变量展开、glob 或 Shell 内建语法。即使如此，也应把可变数据通过环境变量、标准输入、临时文件或经过目标 Shell 专门验证的参数机制传入，并缩小允许值范围。

</details>

## 练习十一：为真实项目选择自动化入口

为下面四种场景选择 POSIX `sh`、Bash、Zsh、PowerShell、CMD、Node.js 或 Python，并写出验证矩阵：

1. 只部署到 Debian 容器的 15 行启动脚本。
2. 管理 Windows 服务、注册表和 NTFS ACL 的内部工具。
3. npm 项目中的文件生成任务，需要支持 Linux、Windows 和 macOS。
4. 只为个人 macOS 终端提供补全和交互快捷函数。

<details>
<summary>答案与评价标准</summary>

- Debian 容器：若只依赖 POSIX 能力，可用 `sh`；需要数组、`[[ ]]` 或 `pipefail` 等 Bash 能力时明确声明 Bash，并在镜像中安装或确认版本。
- Windows 管理：PowerShell 最接近服务、注册表和 ACL 的对象模型；CMD 仅适合遗留兼容或极小包装。
- 三平台 npm 项目：优先使用已经存在的 Node.js 运行时和参数数组 API，避免在 `package.json` 中拼复杂的 Unix 命令。
- 个人 macOS 交互增强：Zsh 合理，因为目标就是当前交互 Shell；不要把该配置伪装成跨平台脚本。

验证矩阵必须覆盖实际承诺的平台和 Shell 版本。只在 macOS 上运行 Node 脚本，不能证明 Windows 路径和原生程序参数传递已经验收。

</details>

## 完成标准

- 能从原始命令还原程序最终收到的 argv。
- 能区分 Shell 语法、命令参数和操作系统行为。
- 能分别观察 stdout、stderr 和退出状态。
- 能解释默认管道状态为什么可能掩盖上游失败。
- 能识别 GNU、BSD、CMD 与 PowerShell 的实现边界。
- 能用命令解析工具找出 alias、builtin、Cmdlet 和外部程序。
- 能为三平台项目选择自动化入口并设计真实验证矩阵。
- 实际运行过 Demo，并清楚记录哪些 Shell 已验证、哪些只是依据官方资料推演。
