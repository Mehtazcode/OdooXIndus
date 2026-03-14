/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        brand:   { DEFAULT: '#1A56DB', dark: '#1240A0', light: '#EFF4FF' },
        success: { DEFAULT: '#057A55', bg: '#ECFDF5' },
        warning: { DEFAULT: '#B45309', bg: '#FFFBEB' },
        danger:  { DEFAULT: '#E02424', bg: '#FEF2F2' },
      },
    },
  },
  plugins: [],
};
