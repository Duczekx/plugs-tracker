"use client";

import styles from "./PlowCard.module.css";

type VariantCounts = {
  zinc: number;
  orange: number;
};

type PlowCardProps = {
  title: string;
  quantity: number;
  quantityLabel: string;
  unitLabel?: string;
  standardLabel: string;
  schwenkbockLabel: string;
  zincLabel: string;
  orangeLabel: string;
  standard: VariantCounts;
  schwenkbock: VariantCounts;
  onDelete?: () => void;
  deleteLabel?: string;
  deleteDisabled?: boolean;
};

export default function PlowCard({
  title,
  quantity,
  quantityLabel,
  unitLabel = "szt.",
  standardLabel,
  schwenkbockLabel,
  zincLabel,
  orangeLabel,
  standard,
  schwenkbock,
  onDelete,
  deleteLabel,
  deleteDisabled,
}: PlowCardProps) {
  const totalLabel = `${quantity} ${unitLabel}`;

  return (
    <article className={styles.card}>
      <header className={styles.header}>
        <div className={styles.quantityWrap}>
          <span className={styles.quantityLabel}>{quantityLabel}</span>
          <span className={styles.quantityPill}>{quantity}</span>
        </div>
        {onDelete && deleteLabel ? (
          <button
            type="button"
            className={styles.actionBtn}
            onClick={onDelete}
            disabled={deleteDisabled}
            aria-label={deleteLabel}
            title={deleteLabel}
          >
            <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
              <path
                d="M5 7h14M9 7V5h6v2M9 11v6M15 11v6"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        ) : null}
      </header>
      <div className={styles.titleRow}>
        <div className={styles.title}>{title}</div>
        <div className={styles.subtitle}>{totalLabel}</div>
      </div>
      <section className={styles.section}>
        <div className={styles.sectionTitle}>{standardLabel}</div>
        <div className={styles.boxGrid}>
          <div className={styles.box}>
            <div
              className={`${styles.boxValue} ${
                standard.zinc === 0 ? styles.boxValueMuted : ""
              }`}
            >
              {standard.zinc}
            </div>
            <div className={styles.boxLabel}>
              <span className={`${styles.dot} ${styles.dotZinc}`} />
              {zincLabel}
            </div>
          </div>
          <div className={`${styles.box} ${styles.boxOrange}`}>
            <div
              className={`${styles.boxValue} ${
                standard.orange === 0 ? styles.boxValueMuted : ""
              }`}
            >
              {standard.orange}
            </div>
            <div className={styles.boxLabel}>
              <span className={`${styles.dot} ${styles.dotOrange}`} />
              {orangeLabel}
            </div>
          </div>
        </div>
      </section>
      <section className={styles.section}>
        <div className={styles.sectionTitle}>{schwenkbockLabel}</div>
        <div className={styles.boxGrid}>
          <div className={styles.box}>
            <div
              className={`${styles.boxValue} ${
                schwenkbock.zinc === 0 ? styles.boxValueMuted : ""
              }`}
            >
              {schwenkbock.zinc}
            </div>
            <div className={styles.boxLabel}>
              <span className={`${styles.dot} ${styles.dotZinc}`} />
              {zincLabel}
            </div>
          </div>
          <div className={`${styles.box} ${styles.boxOrange}`}>
            <div
              className={`${styles.boxValue} ${
                schwenkbock.orange === 0 ? styles.boxValueMuted : ""
              }`}
            >
              {schwenkbock.orange}
            </div>
            <div className={styles.boxLabel}>
              <span className={`${styles.dot} ${styles.dotOrange}`} />
              {orangeLabel}
            </div>
          </div>
        </div>
      </section>
    </article>
  );
}
