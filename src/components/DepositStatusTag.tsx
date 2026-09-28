import React from 'react';
import { Contract } from '../types';
import { getDepositCollectionStatus } from '../utils/depositUtils';

/** Mention imprimée à côté du montant de la caution : « Caution prise » / « Caution non prise ». */
export const DepositStatusTag: React.FC<{ contract: Pick<Contract, 'depositAmount' | 'depositCollected'>; className?: string }> = ({
  contract,
  className = '',
}) => {
  const status = getDepositCollectionStatus(contract);
  if (status === 'none') return null;
  const collected = status === 'collected';
  return (
    <span
      className={`inline-block font-sans font-bold rounded border px-1 leading-tight ${
        collected ? 'bg-emerald-50 text-emerald-800 border-emerald-300' : 'bg-rose-50 text-rose-800 border-rose-300'
      } ${className}`}
    >
      {collected ? '✓ Caution prise' : '⚠ Caution non prise'}
    </span>
  );
};
