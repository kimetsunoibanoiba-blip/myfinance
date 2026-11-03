/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: { DEFAULT: '#1685E5', ink: '#0F63B0', soft: '#E3F1FD' },
        income: { DEFAULT: '#22A06B', ink: '#167A50', soft: '#E6F6EF' },
        expense: { DEFAULT: '#E5484D', ink: '#C93037', soft: '#FDECEC' },
        surface: '#F4F6F9',
        ink: '#263238',
        mute: { DEFAULT: '#87909B', ink: '#66707B' },
        line: '#E1E6EC'
      },
      fontFamily: { sans: ['"Plus Jakarta Sans"', 'system-ui', 'sans-serif'] },
      boxShadow: { card: '0 1px 3px rgba(38,50,56,.08)' }
    }
  },
  plugins: []
}
