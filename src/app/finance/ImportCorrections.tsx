import { dshort } from "../core/dates";
import { money } from "../core/format";
import { Check } from "../ui/controls";
import type { ReviewCorrection } from "./statement";

export function ImportCorrections({
  rows,
  currency,
  onToggle,
}: {
  rows: ReviewCorrection[];
  currency: string | undefined;
  onToggle: (index: number, on: boolean) => void;
}) {
  if (!rows.length) return null;
  return (
    <div
      className="table-wrap"
      style={{ maxHeight: "22vh", overflow: "auto", marginBottom: "12px" }}
    >
      <table className="t">
        <thead>
          <tr>
            <th>Correct</th>
            <th>Date</th>
            <th>Saved transaction</th>
            <th className="num">Before</th>
            <th className="num">Correct amount</th>
            <th>Analysis type</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={row.transactionId}>
              <td>
                <Check
                  on={row.on}
                  label={`Correct ${row.description}`}
                  onChange={(on) => onToggle(index, on)}
                />
              </td>
              <td>{dshort(row.date)}</td>
              <td>{row.description}</td>
              <td className="num">
                {money(row.beforeAmount, { cur: currency })}
              </td>
              <td className="num">
                {money(row.afterAmount, { cur: currency })}
              </td>
              <td>
                {row.beforeKind !== row.afterKind
                  ? `${row.beforeKind} → ${row.afterKind}`
                  : row.afterKind}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
