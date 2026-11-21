import { Fragment } from "react";

/** Renders privacy tokens like [Name] or [आधार] as dark "redacted" chips. */
export function MaskedText({ text }: { text: string }) {
  const parts = text.split(/(\[[^\]\n]{1,24}\])/g);
  return (
    <>
      {parts.map((p, i) =>
        /^\[[^\]\n]{1,24}\]$/.test(p) ? (
          <span key={i} className="masked-chip" title="Hidden for privacy">
            {p.slice(1, -1)}
          </span>
        ) : (
          <Fragment key={i}>{p}</Fragment>
        ),
      )}
    </>
  );
}
