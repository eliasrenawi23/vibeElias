import { colors, palette as brandPalette, type ThemeMode } from '@renawi/brand/tokens';
import { useUi } from '../../app/providers/UiProvider';

/**
 * Chart colours, derived from the brand (`@renawi/brand/tokens`) and validated with the dataviz
 * six-checks validator (`validate_palette.js`) against the card surfaces the charts render on
 * (light `#FFFFFF`, dark `#17171A`). Re-run it after changing any value:
 *
 *   node validate_palette.js "#AD8200,#007654,#1D5FD1,#C3457F" --mode light --surface "#FFFFFF"
 *     band, chroma, contrast PASS; worst adjacent CVD dE 11.3, normal-vision dE 20.0
 *   node validate_palette.js "#B68B00,#2B9C71,#4885DF,#CD568B" --mode dark --surface "#17171A"
 *     band, chroma, contrast PASS; worst adjacent CVD dE 8.5, normal-vision dE 16.3
 *   node validate_palette.js "#DCA80A,#BA8E06,#997403,#7A5B01,#5B4400" --ordinal --mode light
 *   node validate_palette.js "#6A5100,#8D6D01,#B18904,#D6A708,#F9C635" --ordinal --mode dark
 *     monotone L, adjacent dL >= 0.06, light end >= 2:1, single hue: PASS
 *
 * Categorical slots, in fixed order (never cycled; assign by entity, not by rank):
 *   1 brand yellow (yellow 700 on light; the dark step sits in the dark lightness band)
 *   2 licence green (the brand's "green number" hue, one chroma step up to clear the floor)
 *   3 blue (the brand link / info hue)
 *   4 magenta
 * Status colours (success / warning / error) stay reserved for state and never become a series.
 * Labels inside a categorical fill are white in both themes (APCA beats near-black on all four).
 */

export interface ChartPalette {
  /** Categorical slots 1-4. */
  series: readonly [string, string, string, string];
  /** Ordinal one-hue ramp (5 steps, least -> most); the end nearest the surface still >= 2:1. */
  ordinal: readonly [string, string, string, string, string];
  /** Ink of a label set inside a categorical fill. */
  onSeries: string;
  /** Chart surface (the card). */
  surface: string;
  /** Hairline gridlines, one step off the surface. */
  grid: string;
  /** Baseline / zero line. */
  axis: string;
  /** Axis ticks and secondary labels (muted ink). */
  tick: string;
  /** Direct labels and values (secondary ink). */
  label: string;
  /** Hover lift on a bar (a ghost wash). */
  hover: string;
}

const { grey } = brandPalette;

export const CHART_PALETTES: Readonly<Record<ThemeMode, ChartPalette>> = {
  light: {
    series: ['#AD8200', '#007654', '#1D5FD1', '#C3457F'],
    ordinal: ['#DCA80A', '#BA8E06', '#997403', '#7A5B01', '#5B4400'],
    onSeries: '#FFFFFF',
    surface: colors.light.bgContainer,
    grid: grey[200],
    axis: grey[300],
    tick: colors.light.textTertiary,
    label: colors.light.textSecondary,
    hover: 'rgba(15, 15, 16, 0.04)',
  },
  dark: {
    series: ['#B68B00', '#2B9C71', '#4885DF', '#CD568B'],
    // Dark flips the anchor: the least step is the one nearest the (dark) surface.
    ordinal: ['#6A5100', '#8D6D01', '#B18904', '#D6A708', '#F9C635'],
    onSeries: '#FFFFFF',
    surface: colors.dark.bgContainer,
    grid: colors.dark.divider,
    axis: colors.dark.borderStrong,
    tick: colors.dark.textTertiary,
    label: colors.dark.textSecondary,
    hover: 'rgba(255, 255, 255, 0.05)',
  },
};

/** The chart palette of the theme currently applied. */
export function useChartPalette(): ChartPalette {
  const { themeMode } = useUi();
  return CHART_PALETTES[themeMode];
}
