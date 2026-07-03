# Zhoushan Zhongkao Query

一个简洁的舟山市中考查询网站，整合成绩查询和录取查询，适配桌面端与移动端。

## 功能

- **成绩查询**：总分、区域排名、科目成绩、综合素质
- **录取查询**：录取学校、录取专业、毕业学校
- **录取身份核验**：当录取结果为"舟山市六横中学"时，自动生成 24 字符的入群校验码，并展示新生交流群二维码

## 录取身份核验

### 工作原理

当考生查询到的录取学校为"舟山市六横中学"时，页面会自动：

1. 展示微信新生交流群二维码
2. 调用服务端 Server Action，使用 AES-256-ECB 对准考证号进行加密
3. 生成固定 **24 字符** 的 Base64 校验码（适配微信入群申请 ≤30 字符的限制）
4. 考生复制校验码并填入微信入群申请信息

管理员在本地使用 `decrypt.py` 输入校验码即可解密出准考证号，核验考生录取身份。

### 环境变量配置

在项目根目录的 `.env.local` 中配置加密密钥：

```env
ENCRYPTION_KEY=your_custom_secret_key_here
```

> ⚠️ **部署前请务必将默认密钥替换为自定义的强密钥**，并确保本地解密时使用相同的密钥。

### 本地解密核验

#### 依赖安装

```bash
pip install cryptography
```

#### 运行解密脚本

```bash
# 方式一：通过环境变量传入密钥
export ENCRYPTION_KEY=your_custom_secret_key_here   # Linux/macOS
set ENCRYPTION_KEY=your_custom_secret_key_here       # Windows CMD
python decrypt.py

# 方式二：运行后手动输入密钥
python decrypt.py
```

#### 配合录取名单使用（可选）

在 `decrypt.py` 同目录下放置 `students.csv` 文件，脚本会自动检索考生信息：

```csv
准考证号,姓名,毕业学校,录取专业
2409029113001,张三,某某中学,普通班
2409029113002,李四,某某中学,重点班
```

解密成功后将自动打印匹配到的考生姓名、毕业学校和录取专业。

## 技术栈

- Next.js App Router
- TypeScript
- Tailwind CSS
- Node.js `crypto`（服务端 AES-256-ECB 加密）

## 本地运行

```bash
npm install
npm run dev
```

打开 `http://localhost:3000`。

## 构建

```bash
npm run build
```

---

查询结果仅供参考，最终以官方成绩单和录取通知书为准。
