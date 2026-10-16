const colors = require('tailwindcss/colors')

const selfCustomColors = {
  brand: {
    DEFAULT: '#405eff',
  },
  warn: {
    DEFAULT: '#f59e0b',
  },
  link: {
    DEFAULT: '#0ea5e9',
  },
  mark: {
    DEFAULT: '#ff4582',
  },
  'custom-black': {
    DEFAULT: '#262626',
  },
  'custom-white': {
    DEFAULT: '#f2eada',
  },
  'custom-grey': {
    DEFAULT: '#828282',
  },
}

module.exports = {
  mode: 'jit',
  content: ['./src/**/*.{ux,html,js,ts}'],
  purge: {
    enabled: true,
    content: ['./src/**/*.{ux,html,js,ts}'],
  },
  // https://tailwindcss.com/docs/configuration#core-plugins
  corePlugins: {
    preflight: false, // disable base/reset styles
    container: false, // disable container component
    content: false, // disable `content` utility
    accentColor: false, // disable `accent-color` utility
    accessibility: false, // disable `appearance` utility
    appearance: false, // disable `appearance` utility
    aspectRatio: false, // disable `aspect-ratio` utility
    backgroundOpacity: false, // disable `background-opacity` utility
    backdropBlur: false, // disable `backdrop-blur` utility
    backdropBrightness: false, // disable `backdrop-brightness` utility
    backdropContrast: false, // disable `backdrop-contrast` utility
    backdropGrayscale: false, // disable `backdrop-grayscale` utility
    backdropHueRotate: false, // disable `backdrop-hue-rotate` utility
    backdropInvert: false, // disable `backdrop-invert` utility
    backdropOpacity: false, // disable `backdrop-opacity` utility
    backdropSaturate: false, // disable `backdrop-saturate` utility
    backdropSepia: false, // disable `backdrop-sepia` utility
    blur: false, // disable `blur` utility
    borderCollapse: false, // disable `border-collapse` utility
    borderOpacity: false, // disable `border-opacity` utility
    borderSpacing: false, // disable `border-spacing` utility
    boxShadow: false, // disable `box-shadow` utility
    boxShadowColor: false, // disable `box-shadow-color` utility
    boxDecorationBreak: false, // disable `box-decoration-break` utility
    boxSizing: false, // disable `box-sizing` utility
    breakAfter: false, // disable `break-after` utility
    breakBefore: false, // disable `break-before` utility
    breakInside: false, // disable `break-inside` utility
    brightness: false, // disable `brightness` utility
    captionSide: false, // disable `caption-side` utility
    caretColor: false, // disable `caret-color` utility
    clear: false, // disable `clear` utility
    contrast: false, // disable `contrast` utility
    divideColor: false, // disable `divide-color` utility
    divideOpacity: false, // disable `divide-opacity` utility
    divideStyle: false, // disable `divide-style` utility
    divideWidth: false, // disable `divide-width` utility
    float: false, // disable `float` utility
    filter: false, // disable `filter` utility
    fontVariantNumeric: false, // disable `font-variant-numeric` utility
    hyphens: false, // disable `hyphens` utility
    isolation: false, // disable `isolation` utility
    lineClamp: false, // disable `line-clamp` utility
    mixBlendMode: false, // diable `mix-blend-mode` utility
    listStyleImage: false, // disable `list-style-image` utility
    listStylePosition: false, // disable `list-style-position` utility
    listStyleType: false, // disable `list-style-type` utility
    objectPosition: false, // disable `object-position` utility
    outlineColor: false, // disable `outline-color` utility
    outlineOffset: false, // disable `outline-offset` utility
    outlineStyle: false, // disable `outline-style` utility
    outlineWidth: false, // disable `outline-width` utility
    overscrollBehavior: false, // disable `overscroll-behavior` utility
    placeContent: false, // disable `place-content` utility
    placeItems: false, // disable `place-items` utility
    placeSelf: false, // disable `place-self` utility
    placeholderOpacity: false, // disable `placeholder-opacity` utility
    resize: false, // disable `resize` utility
    ringColor: false, // disable `ring-color` utility
    ringOffsetColor: false, // disable `ring-offset-color` utility
    ringOffsetWidth: false, // disable `ring-offset-width` utility
    ringOpacity: false, // disable `ring-opacity` utility
    space: false, // disable `space-between` utility
    textDecorationThickness: false, // disable `text-decoration-thickness` utility
    textOpacity: false, // disable `text-opacity` utility
    textTransform: false, // disable `text-transform` utility
    textUnderlineOffset: false, // disable `text-underline-offset` utility
    touchAction: false, // disable `touch-action` utility
    transform: false, // disable `transform` utility
    userSelect: false, // disable `user-select` utility
    verticalAlign: false, // disable `vertical-align` utility
    whitespace: false, // disable `whitespace` utility
    wordBreak: false, // disable `word-break` utility
    willChange: false, // disable `will-change` utility
  },
  darkMode: false,
  theme: {
    colors: { ...colors, ...selfCustomColors },
    extend: {
      width: ({ theme }) => ({
        auto: 'auto',
        ...theme('spacing'),
      }),
      height: ({ theme }) => ({
        auto: 'auto',
        ...theme('spacing'),
      }),
      spacing: {
        1: '4px',
        2: '8px',
        3: '12px',
        4: '16px',
        5: '20px',
        6: '24px',
        7: '28px',
        8: '32px',
        9: '36px',
        10: '40px',
        11: '44px',
        12: '48px',
        14: '56px',
        16: '64px',
        18: '72px',
        20: '80px',
        24: '96px',
        28: '112px',
        32: '128px',
        36: '144px',
        40: '160px',
        44: '176px',
        48: '192px',
        52: '208px',
        56: '224px',
        60: '240px',
        64: '256px',
        72: '288px',
        80: '320px',
        84: '336px',
        96: '384px',
        100: '400px',
        112: '448px',
        120: '480px',
      },
      borderWidth: {
        DEFAULT: '1px',
        0: '0px',
        2: '2px',
        4: '4px',
        8: '8px',
      },
      borderRadius: {
        none: '0',
        '': '1px',
        xs: '1px',
        sm: '2px',
        DEFAULT: '4px',
        md: '6px',
        lg: '8px',
        xl: '12px',
        '2xl': '16px',
        '3xl': '24px',
        '4xl': '36px',
        '5xl': '48px',
      },
      fontSize: {
        xs: ['12px', { lineHeight: '16px' }],
        sm: ['15px', { lineHeight: '20px' }],
        base: ['16px', { lineHeight: '26px' }],
        lg: ['18px', { lineHeight: '28px' }],
        xl: ['20px', { lineHeight: '28px' }],
        '2xl': ['26px', { lineHeight: '32px' }],
        '3xl': ['30px', { lineHeight: '36px' }],
        '4xl': ['36px', { lineHeight: '40px' }],
        '5xl': ['48px', { lineHeight: '60px' }],
        '6xl': ['60px', { lineHeight: '60px' }],
        '7xl': ['72px', { lineHeight: '60px' }],
        '8xl': ['96px', { lineHeight: '60px' }],
        '9xl': ['128px', { lineHeight: '60px' }],
      },
      maxWidth: {
        xs: '320px',
        sm: '384px',
        md: '448px',
        lg: '512px',
        xl: '576px',
        '2xl': '672px',
        '3xl': '768px',
        '4xl': '896px',
        '5xl': '1024px',
        '6xl': '1152px',
        '7xl': '1280px',
        '8xl': '1440px',
        '9xl': '1600px',
      },
      flex: {
        1: '1',
      },
    },
  },
  variants: {
    extend: {},
  },
  plugins: [
    function ({ addUtilities }) {
      const newUtilities = {
        '.text-line-through': {
          textDecoration: 'line-through',
        },
      }
      addUtilities(newUtilities)
    },
  ],
}
