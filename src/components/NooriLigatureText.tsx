import React, { useMemo } from 'react';
import { segmentArabicUrduLigatures } from '../utils/urduTypography';

interface NooriLigatureTextProps {
  text: string;
  inspectorActive: boolean;
}

export const NooriLigatureText: React.FC<NooriLigatureTextProps> = ({
  text,
  inspectorActive,
}) => {
  const tokens = useMemo(() => segmentArabicUrduLigatures(text), [text]);

  if (!inspectorActive) {
    return <>{text}</>;
  }

  return (
    <>
      {tokens.map((tok, idx) =>
        tok.isLigature ? (
          <span
            key={idx}
            className={`noori-ligature-token ${tok.hasOverlapRisk ? 'noori-ligature-risk' : ''}`}
            title={
              tok.hasOverlapRisk
                ? `Dense Nastaleeq ligature ("${tok.text}") — high overlap risk, benefits from 'kern-optimize'`
                : `Arabic/Urdu ligature ("${tok.text}")`
            }
          >
            {tok.text}
          </span>
        ) : (
          <React.Fragment key={idx}>{tok.text}</React.Fragment>
        )
      )}
    </>
  );
};
