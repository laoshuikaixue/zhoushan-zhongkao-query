# Zhoushan Zhongkao Query

一个简洁的舟山市中考查询网站，整合成绩查询和录取查询，适配桌面端与移动端。

## 功能

- 成绩查询：总分、区域排名、科目成绩、综合素质
- 录取查询：录取学校、录取专业、毕业学校
- 服务端 API 代理：避免前端直接请求上游接口产生跨域问题
- 手动验证码输入：不接入第三方验证码识别服务

## 技术栈

- Next.js App Router
- TypeScript
- Tailwind CSS
- Vercel/Node 部署

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

查询结果仅供参考，最终以官方成绩单和录取通知书为准。
