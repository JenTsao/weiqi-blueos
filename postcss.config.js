const tailwindcss = require('tailwindcss')
const tailwindcssconfig = require('./tailwind.config.js')

module.exports = {
  plugins: [tailwindcss(tailwindcssconfig)],
}
