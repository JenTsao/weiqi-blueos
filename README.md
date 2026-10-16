# Hello World | Tailwind CSS

## 文件结构

```
├── sign                # 存储 rpk 包签名模块(ℹ️须自行生成);
│   ├── certificate.pem # 证书文件
│   └── private.pem     # 私钥文件
├── scripts             # 模版内置辅助开发脚本；
└── src
│   ├── assets          # 公用的资源(images/styles/字体...)；
│   │   ├──images       # 存储 png/jpg/svg 等公共图片资源；
│   │   └──styles       # 存放 less/css/sass 等公共样式；
│   ├── pages           # 统一存放项目页面级代码；
│   ├── app.ux          # 应用程序代码的人口文件；
│   ├── app.d.ts        # 应用声明文件，声明全局变量、类型等；
│   └── manifest.json   # 配置 BlueOS 应用基本信息；
└── .eslintrc           # Eslint 配置文件；
└── .prettierrc         # prettier 配置文件；
└── tailwind.config.js  # Tailwind CSS 自定义配置文件；
└── tsconfig.json       # 为 JavaScript 语言服务提供配置选项；
└── build.config.js     # BlueOS Toolkit 自定义配置；
└── postcss.config.js   # PostCSS 配置文件（=> Tailwind）；
└── package.json        # 定义项目需要的各种模块及配置信息；
```

## 如何开始

```bash
# 安装依赖（或基于 Studio 图形化操作）
pnpm i
```

[pnpm](https://pnpm.io/)、 [yarn](https://yarnpkg.com/) 与 npm 是功能类似的包管理工具，不过它们在某些方面表现更为出色，因此我们更加推荐使用它们。当然，如果您本地没有安装，使用 NPM 也是可以的。关于本项目更详细介绍如下：

- **内置 Tailwind CSS**：支持您基于 [Tailwind CSS](https://tailwindcss.com/) 这种现代的 CSS 框架（快速、灵活、可靠，且运行时间为零），处理页面样式，从而获得多方面好处：更快的编写效率、更小的代码总体积、更高的运行效率、更易于项目维护；此外，项目配置了 [prettier-plugin-tailwindcss](https://github.com/tailwindlabs/prettier-plugin-tailwindcss)（Tailwind CSS 的 Prettier 插件），可根据 Tailwind CSS 推荐的类顺序自动对 Class 进行排序。
-  **添加新增页面命令脚本**：如果需要新建页面，只需运行：`yarn gen YourPageName`，后面的工作，诸如把页面注入 `manifest.json`，脚本已帮着处理；当然，也可以根据需要，自行定定制模板：*/command/gen/template.ux*；

**温馨提示**：您可以在应用开发工具的「扩展市场」，通过关键字 `Tailwind` 检索并安装 “**Tailwind CSS IntelliSense**” 扩展——为用户提供自动完成、语法突出显示和 linting 等高级功能，来增强 Tailwind 开发体验；更多基于 Tailwind CSS 提升开发效率技巧，可参见文章：[如何在应用开发中使用 Tailwind CSS 提升开发效率？](https://studio.blueos.com.cn/practice/tailwind-css/)。

## 内置命令

|  命令 | 描述  | 备注 |
|---|---|---|
| `pnpm tailwindcss`  | Tailwind CLI 构建，扫描模板文件中的类并构建 CSS | Studio 默认支持 [PostCSS 用法](https://tailwindcss.com/docs/installation/using-postcss) |
| `pnpm gen`  | 新增「 BlueOS 应用」页面 | [Studio 已内置，可通过图形化操作](https://studio.blueos.com.cn/write/create-page/) |
| `pnpm lint`  | 运行 Eslint 检测项目代码 | 可以按需使用（如 `CICD`） | 