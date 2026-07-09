# Zhoushan Zhongkao Query

一个简洁的舟山市中考查询网站，整合成绩查询和录取查询，适配桌面端与移动端。

## 功能

- **成绩查询**：总分、区域排名、科目成绩、综合素质
- **录取查询**：录取学校、录取专业、毕业学校
- **录取身份核验**：当录取结果为"舟山市六横中学"时，自动生成约 35 字符的校验码，并展示微信二维码供添加

## 录取身份核验

### 工作原理

当考生查询到的录取学校为"舟山市六横中学"时，页面会自动：

1. 展示微信二维码供添加
2. 调用服务端 Server Action，对准考证号、出生年月日和考生姓名进行紧凑加密
3. 生成约 **35 字符** 的校验码
4. 考生添加微信通过后，将校验码发送给管理员

管理员在本地使用 `decrypt.py` 输入校验码即可解密出准考证号、出生年月日和考生姓名。

> 完整姓名写入支持最多 6 个常用汉字。超出该范围或包含生僻字时，页面会提示校验码生成失败。

### 环境变量配置

在项目根目录的 `.env` 中配置加密密钥，用于模拟 Vercel 部署后配置的环境变量：

```env
ENCRYPTION_KEY=your_custom_secret_key_here
TEST=true
```

> ⚠️ **部署前请务必将默认密钥替换为自定义的强密钥**，并确保本地解密时使用相同的密钥。
> `TEST=true` 时页面会显示“生成模拟录取结果”按钮；生产环境不配置 `TEST` 即可隐藏该按钮。

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

#### 本地模拟校验码

开发环境页面会显示“生成模拟录取结果”按钮。点击后会使用当前环境变量中的 `ENCRYPTION_KEY` 生成校验码，用于模拟 Vercel 部署后配置环境变量的情况。

```bash
npm run dev
```

## 技术栈

- Next.js App Router
- TypeScript
- Tailwind CSS
- Node.js `crypto`（服务端 AES-256-CTR 紧凑加密）

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
