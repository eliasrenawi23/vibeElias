import type { ReportCell, ReportColumn, ReportResult } from '@renawi/shared';
import { Card, Grid, Table, Typography } from 'antd';
import { useTranslation } from 'react-i18next';
import { AutoDir, Ltr } from '../../../shared/lib/bidi';
import { useDynamicT } from '../../../shared/lib/i18n';
import { formatCount } from '../../../shared/lib/money';
import { DataTable, type DataTableColumn } from '../../../shared/ui/DataTable';
import { DateText } from '../../../shared/ui/DateText';
import { DateTimeText } from '../../../shared/ui/DateTimeText';
import { EmptyState } from '../../../shared/ui/EmptyState';
import { Money } from '../../../shared/ui/Money';
import { PlateNo } from '../../../shared/ui/PlateNo';

/** Columns whose cells are numbers (end-aligned, summed in the totals row). */
const NUMERIC_TYPES: ReadonlySet<ReportColumn['type']> = new Set(['money', 'int']);

/**
 * One report cell by its column type: money as `Money`, dates as `DateText` / `DateTimeText`,
 * plates as `PlateNo`, enums translated (`enums.<enum>.<VALUE>`), booleans as yes / no, numbers
 * with Latin digits, text in its own direction. A missing value (`null`) is the translated
 * "n/a", never 0.
 */
export function ReportCellView({ column, value }: { column: ReportColumn; value: ReportCell | undefined }) {
  const { t, i18n } = useTranslation();
  const dynamicT = useDynamicT();
  if (value === null || value === undefined || value === '') {
    return (
      <span className="rm-empty-value rm-report-na" data-na>
        {t('reports.na')}
      </span>
    );
  }
  switch (column.type) {
    case 'money':
      return <Money amount={Number(value)} signColor />;
    case 'int':
      return <Ltr>{formatCount(Number(value), i18n.resolvedLanguage)}</Ltr>;
    case 'date':
      return <DateText value={String(value)} />;
    case 'datetime':
      return <DateTimeText value={String(value)} />;
    case 'plate':
      return <PlateNo value={String(value)} />;
    case 'bool':
      return <span>{value === true || value === 'true' ? t('reports.bool.true') : t('reports.bool.false')}</span>;
    case 'enum':
      return (
        <span data-enum={column.enum}>
          {column.enum ? dynamicT(`enums.${column.enum}.${String(value)}`) : String(value)}
        </span>
      );
    default:
      return <AutoDir>{String(value)}</AutoDir>;
  }
}

interface Row {
  __key: string;
  cells: Record<string, ReportCell>;
}

/** Column header: the label is an i18n key (`reports.columns.<key>`); unknown keys show the key. */
export function useColumnTitle(): (column: ReportColumn) => string {
  const { i18n } = useTranslation();
  const dynamicT = useDynamicT();
  return (column) => (i18n.exists(column.label) ? dynamicT(column.label) : column.key);
}

/**
 * A report as a table, built from its `columns` (type-driven cells) and `rows`, with the totals
 * row at the foot (a card under the list on phones). Cards below `md`, like every list.
 */
export interface ReportTableProps {
  result: ReportResult;
  /** Accessible name (the report title). */
  label: string;
  loading?: boolean;
}

export function ReportTable({ result, label, loading = false }: ReportTableProps) {
  const { t } = useTranslation();
  const screens = Grid.useBreakpoint();
  const isMobile = screens.md === false;
  const columnTitle = useColumnTitle();
  const rows: Row[] = result.rows.map((cells, i) => ({ __key: String(i), cells }));
  const totals = result.totals;
  const hasTotals = Boolean(totals && Object.values(totals).some((v) => v !== null && v !== undefined));

  const columns: DataTableColumn<Row>[] = result.columns.map((column, i) => ({
    key: column.key,
    title: columnTitle(column),
    align: NUMERIC_TYPES.has(column.type) ? 'end' : undefined,
    mobile: i === 0 ? 'title' : undefined,
    render: (row) => <ReportCellView column={column} value={row.cells[column.key]} />,
  }));

  const totalCell = (column: ReportColumn, index: number) => {
    const value = totals?.[column.key];
    if (value !== null && value !== undefined) return <ReportCellView column={column} value={value} />;
    return index === 0 ? <strong>{t('reports.total')}</strong> : null;
  };

  return (
    <>
      <DataTable<Row>
        label={label}
        data-testid="report-table"
        rowKey={(row) => row.__key}
        columns={columns}
        data={rows}
        loading={loading}
        size="small"
        empty={<EmptyState compact description={t('reports.noData')} />}
        summary={
          hasTotals && rows.length > 0
            ? () => (
                <Table.Summary>
                  <Table.Summary.Row className="rm-report-totals" data-testid="report-totals">
                    {result.columns.map((column, i) => (
                      <Table.Summary.Cell
                        key={column.key}
                        index={i}
                        align={NUMERIC_TYPES.has(column.type) ? 'right' : undefined}
                        className={NUMERIC_TYPES.has(column.type) ? 'rm-report-total-num' : undefined}
                      >
                        {totalCell(column, i)}
                      </Table.Summary.Cell>
                    ))}
                  </Table.Summary.Row>
                </Table.Summary>
              )
            : undefined
        }
      />
      {isMobile && hasTotals && rows.length > 0 && (
        <Card size="small" variant="borderless" className="rm-report-totals-card" data-testid="report-totals">
          <Typography.Text strong>{t('reports.total')}</Typography.Text>
          <dl className="rm-data-card-fields">
            {result.columns
              .filter((c) => totals?.[c.key] !== null && totals?.[c.key] !== undefined)
              .map((column) => (
                <div key={column.key} className="rm-data-card-field">
                  <dt>
                    <Typography.Text type="secondary">{columnTitle(column)}</Typography.Text>
                  </dt>
                  <dd>
                    <ReportCellView column={column} value={totals?.[column.key]} />
                  </dd>
                </div>
              ))}
          </dl>
        </Card>
      )}
    </>
  );
}
