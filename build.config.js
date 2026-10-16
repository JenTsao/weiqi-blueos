// 不覆盖 css.postcss，改用 BlueOS Studio 内置的默认配置：
//   d:\BlueOSStudio\resources\app\extensions\blueos-debugger\node_modules\blueos-pack\postcss.config.js
//
// 理由：
// 1. 该默认配置的 tailwind content glob 为 './src/**/*.{ux,html,js,ts}'，
//    相对工程根目录解析，与本工程 src 完全一致；
// 2. 默认配置额外带 dpTextRescue() 插件，处理蓝河 <text> 的 dp 文本，
//    原工程级 postcss.config.js 缺失该插件；
// 3. 默认配置从 Studio 自带 node_modules 解析 tailwindcss，
//    不依赖工程级依赖，规避工程目录变更/包管理器布局导致的模块解析失败。
//
// 本工程未使用任何 Tailwind 工具类，改用默认配置对产出无影响。
module.exports = {}