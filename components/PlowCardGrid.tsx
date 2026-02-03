"use client";

import PlowCard from "./PlowCard";
import styles from "./PlowCardGrid.module.css";

type PlowCardItem = {
  key: string;
  title: string;
  quantity: number;
  standard: { zinc: number; orange: number };
  schwenkbock: { zinc: number; orange: number };
  onDelete?: () => void;
  deleteLabel?: string;
  deleteDisabled?: boolean;
};

type PlowCardGridProps = {
  items: PlowCardItem[];
  emptyLabel: string;
  quantityLabel: string;
  unitLabel?: string;
  standardLabel: string;
  schwenkbockLabel: string;
  zincLabel: string;
  orangeLabel: string;
};

export default function PlowCardGrid({
  items,
  emptyLabel,
  quantityLabel,
  unitLabel,
  standardLabel,
  schwenkbockLabel,
  zincLabel,
  orangeLabel,
}: PlowCardGridProps) {
  if (items.length === 0) {
    return <p className={styles.empty}>{emptyLabel}</p>;
  }

  return (
    <div className={styles.grid}>
      {items.map((item) => (
        <div key={item.key} className={styles.gridItem}>
          <PlowCard
            title={item.title}
            quantity={item.quantity}
            quantityLabel={quantityLabel}
            unitLabel={unitLabel}
            standardLabel={standardLabel}
            schwenkbockLabel={schwenkbockLabel}
            zincLabel={zincLabel}
            orangeLabel={orangeLabel}
            standard={item.standard}
            schwenkbock={item.schwenkbock}
            onDelete={item.onDelete}
            deleteLabel={item.deleteLabel}
            deleteDisabled={item.deleteDisabled}
          />
        </div>
      ))}
    </div>
  );
}
