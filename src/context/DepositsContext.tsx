import React, { createContext, useContext, useState, useEffect } from 'react';
import { DepositRecord, DepositDeduction } from '../types';
import { initialDeposits } from '../data/mockData';
import { saveRemoteAgencyData } from '../lib/firestoreSync';

export interface DepositsContextType {
  deposits: DepositRecord[];
  updateDeposit: (id: string, data: Partial<DepositRecord>) => void;
  releaseDeposit: (depositId: string, refundedAmount: number, notes?: string, actorName?: string) => void;
  deductDeposit: (
    depositId: string,
    deductionData: Omit<DepositDeduction, 'id' | 'date'>,
    refundedRemaining?: boolean,
    actorName?: string
  ) => void;
  addDepositRecord: (deposit: DepositRecord) => void;
  setDepositsList: (deposits: DepositRecord[]) => void;
}

const STORAGE_KEY = 'morvello_deposits_v1';

const DepositsContext = createContext<DepositsContextType | undefined>(undefined);

export const DepositsProvider: React.FC<{
  children: React.ReactNode;
  onAuditLog?: (action: string, targetType: any, targetId: string, details: string) => void;
}> = ({ children, onAuditLog }) => {
  const [deposits, setDeposits] = useState<DepositRecord[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : initialDeposits;
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(deposits));
  }, [deposits]);

  const logAction = (action: string, targetType: any, targetId: string, details: string) => {
    if (onAuditLog) {
      onAuditLog(action, targetType, targetId, details);
    }
  };

  const updateDeposit = (id: string, data: Partial<DepositRecord>) => {
    const updated = deposits.map((d) => (d.id === id ? { ...d, ...data } : d));
    setDeposits(updated);
    saveRemoteAgencyData({ deposits: updated }).catch((err) =>
      console.warn('Auto-save updateDeposit to Firestore note:', err)
    );
    logAction('Mise à jour caution', 'contract', id, `Modification des données de caution #${id}`);
  };

  const releaseDeposit = (
    depositId: string,
    refundedAmount: number,
    notes?: string,
    actorName: string = 'Direction'
  ) => {
    const now = new Date();
    const formatted = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
      now.getDate()
    ).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    const updated = deposits.map((d) => {
      if (d.id === depositId) {
        return {
          ...d,
          status: 'released' as const,
          releasedAt: formatted,
          releasedBy: actorName,
          refundedAmount,
          notes: notes ? (d.notes ? `${d.notes}\n[Restitution]: ${notes}` : notes) : d.notes,
        };
      }
      return d;
    });

    setDeposits(updated);
    saveRemoteAgencyData({ deposits: updated }).catch((err) =>
      console.warn('Auto-save releaseDeposit to Firestore note:', err)
    );

    logAction(
      'Restitution de caution',
      'contract',
      depositId,
      `Caution ${depositId} restituée par ${actorName}. Montant remboursé : ${refundedAmount} MAD.`
    );
  };

  const deductDeposit = (
    depositId: string,
    deductionData: Omit<DepositDeduction, 'id' | 'date'>,
    refundedRemaining: boolean = false,
    actorName: string = 'Direction'
  ) => {
    const now = new Date();
    const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
      now.getDate()
    ).padStart(2, '0')}`;
    const newDeduction: DepositDeduction = {
      ...deductionData,
      id: `ded-${Date.now()}`,
      date: dateStr,
    };

    const updated = deposits.map((d) => {
      if (d.id === depositId) {
        const updatedDeductions = [...d.deductions, newDeduction];
        const totalDeducted = updatedDeductions.reduce((sum, item) => sum + item.amount, 0);
        const remaining = Math.max(0, d.amount - totalDeducted);
        const isFull = totalDeducted >= d.amount;
        const status = isFull ? ('fully_retained' as const) : ('partially_deducted' as const);

        return {
          ...d,
          deductions: updatedDeductions,
          status,
          refundedAmount: refundedRemaining ? remaining : d.refundedAmount || remaining,
          releasedAt: refundedRemaining
            ? `${dateStr} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
            : d.releasedAt,
          releasedBy: refundedRemaining ? actorName : d.releasedBy,
        };
      }
      return d;
    });

    setDeposits(updated);
    saveRemoteAgencyData({ deposits: updated }).catch((err) =>
      console.warn('Auto-save deductDeposit to Firestore note:', err)
    );

    logAction(
      'Déduction sur caution',
      'contract',
      depositId,
      `Retenue de ${deductionData.amount} MAD (${deductionData.label}) sur la caution #${depositId}`
    );
  };

  const addDepositRecord = (deposit: DepositRecord) => {
    const updated = [deposit, ...deposits];
    setDeposits(updated);
    saveRemoteAgencyData({ deposits: updated }).catch((err) =>
      console.warn('Auto-save addDepositRecord to Firestore note:', err)
    );
  };

  const setDepositsList = (newDeposits: DepositRecord[]) => {
    setDeposits(newDeposits);
  };

  return (
    <DepositsContext.Provider
      value={{
        deposits,
        updateDeposit,
        releaseDeposit,
        deductDeposit,
        addDepositRecord,
        setDepositsList,
      }}
    >
      {children}
    </DepositsContext.Provider>
  );
};

export const useDeposits = () => {
  const context = useContext(DepositsContext);
  if (!context) {
    throw new Error('useDeposits must be used within a DepositsProvider');
  }
  return context;
};
