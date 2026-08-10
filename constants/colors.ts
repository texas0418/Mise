/**
 * The palette. Every text-on-surface pair here is checked against WCAG AA by
 * scripts/test-contrast.ts, which fails the build below 4.5:1 — so a colour
 * cannot be nudged darker in a hurry without the suite saying so.
 */
const Colors = {
  bg: {
    primary: '#0A0A0A',
    secondary: '#141414',
    tertiary: '#1C1C1E',
    card: '#1A1A1C',
    elevated: '#222224',
    input: '#2A2A2C',
  },
  accent: {
    gold: '#C8A04A',
    goldLight: '#D4B366',
    /**
     * Nudged from #8A6E30, which came to 2.97:1 on `bg.input` — just under the
     * 3:1 WCAG 1.4.11 floor for icons and borders, which is all this is used
     * for. It stays deliberately below the 4.5:1 text threshold: it is a dim
     * accent, not a colour to set words in.
     */
    goldDim: '#8D7031',
    goldBg: 'rgba(200, 160, 74, 0.12)',
  },
  text: {
    primary: '#F5F5F5',
    secondary: '#A0A0A0',
    /**
     * Was #6B6B6B, which failed AA on every surface in this palette — 3.72:1
     * at best on `bg.primary`, and 2.69:1 behind the 179 text inputs that use
     * it as their placeholder colour, where it was below even the 3:1
     * large-text floor. #919191 is the lightest-touch value that clears 4.5:1
     * on all six surfaces, so no carve-out is needed for any of them.
     *
     * It does compress the gap to `secondary`. Lightness alone can no longer
     * carry three distinct levels against a near-black background and still
     * clear AA; size and weight have to do more of that work.
     */
    tertiary: '#919191',
    inverse: '#0A0A0A',
  },
  status: {
    active: '#4ADE80',
    success: '#34D399',
    warning: '#FBBF24',
    error: '#F87171',
    info: '#60A5FA',
  },
  border: {
    subtle: '#2A2A2C',
    medium: '#3A3A3C',
  },
  department: {
    direction: '#C8A04A',
    camera: '#60A5FA',
    sound: '#A78BFA',
    art: '#F472B6',
    lighting: '#FBBF24',
    production: '#4ADE80',
    talent: '#FB923C',
    postProduction: '#34D399',
  },
};

export default Colors;
